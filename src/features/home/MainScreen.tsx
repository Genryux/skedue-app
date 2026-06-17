import { useFocusEffect, useRouter } from 'expo-router';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleProp,
  ViewStyle,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { springModalSlide, useDragToClose } from '../../ui/tokens/animations';
import { getAllNotes, getAllTasks, getMetaValue, getNotesBySubjectId, getTasksBySubjectId, getSubjects, insertSubject, insertNote, updateNote, deleteNote, deleteTask, insertTask, findRecentMatchingNote, setMetaValue, updateSubject, completeTaskOccurrence, uncompleteTaskOccurrence, getTaskCompletions, deleteTaskOccurrence, type SubjectRecord, type NoteRecord, type TaskRecord, type TaskCompletionRecord } from '../../data/local/db';
import { shadowLg, shadowLgDark } from '../../ui/tokens/shadows';
import { useTheme } from '../../ui/theme/ThemeContext';
import { parseTimeToMinutes } from '../../utils/timeUtils';
import { calculateNextOccurrenceDate, isSameCalendarDay, END_OF_TIME } from '../../utils/recurrenceUtils';
import ScheduleScreen from '../schedule/ScheduleScreen';
import AddSubjectScreen from '../subjects/AddSubjectScreen';
import SubjectsScreen from '../subjects/SubjectsScreen';
import DynamicIslandToast from '../../ui/DynamicIslandToast';
import SubjectDetailScreen from '../subjects/SubjectDetailScreen';
import TaskEditModal from './TaskEditModal';
import CreateTaskModal from './CreateTaskModal';

const QuickNoteEditor = require('../subjects/NoteEditorScreen').default as React.ComponentType<{
  subjectId: string;
  subjectTitle: string;
  note: NoteRecord | null;
  folderOptions: Array<{ id: string; title: string; color: string }>;
  subjectOptions?: Array<{ id: string; title: string; code: string }>;
  mode?: 'quick' | 'full';
  onClose: (options?: { saved?: boolean; deleted?: boolean }) => void;
  onSave: (
    noteId: string | null,
    draft: {
      subjectId: string;
      folderId: string | null;
      title: string;
      contentHtml: string;
      contentText: string;
      isPinned: boolean;
    }
  ) => Promise<NoteRecord | null>;
  onDelete: (noteId: string) => Promise<void> | void;
}>;

const formatTime = (time: string | null | undefined) => {
  if (!time) return '';
  // If the string already contains AM/PM (stored by AddSubjectScreen), pass through
  if (/am|pm/i.test(time)) return time;
  // Otherwise parse as HH:MM 24h
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
};

const formatNoteDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const CardScale = ({
  children,
  onPress,
  onLongPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ overflow: 'visible' }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const DAY_MAP: Record<string, number> = {
  Su: 0,
  Mo: 1,
  Tu: 2,
  We: 3,
  Th: 4,
  Fr: 5,
  Sa: 6,
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const formatMinutesDiff = (minutes: number) => {
  if (minutes <= 0) return 'Just now';
  if (minutes < 60) return `In ${minutes} min${minutes > 1 ? 's' : ''}`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  
  if (remainingMins === 0) {
    return `In ${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `In ${hours} hour${hours > 1 ? 's' : ''} and ${remainingMins} min${remainingMins > 1 ? 's' : ''}`;
};

export default function MainScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'subjects'>('home');
  const [navPillWidth, setNavPillWidth] = useState(0);
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const [dbSubjects, setDbSubjects] = useState<SubjectRecord[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isSubjectDetailOpen, setIsSubjectDetailOpen] = useState(false);
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState<any>(null);
  const [subjectDetailInitialTab, setSubjectDetailInitialTab] = useState<'subject' | 'notes' | 'tasks'>('subject');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<{ type: 'active' | 'archived' | 'all'; term: string | null }>({ type: 'active', term: null });
  const [isAllQuickNotesOpen, setIsAllQuickNotesOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(18)).current;
  const buttonRotate = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const buttonAnims = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;

  // Transitions
  const subjectDetailSlideAnim = useRef(new Animated.Value(0)).current; // 0: offscreen, 1: onscreen
  const allQuickNotesSlideAnim = useRef(new Animated.Value(0)).current; // 0: offscreen, 1: onscreen

  // Filter modal
  const filterSlide = useRef(new Animated.Value(0)).current;
  const filterOpacity = useRef(new Animated.Value(0)).current;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // Success Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Time state for real-time updates
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Recent notes state (quick notes + subject notes)
  const [pendingTasks, setPendingTasks] = useState<TaskRecord[]>([]);
  const [allLoadedTasks, setAllLoadedTasks] = useState<TaskRecord[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<TaskCompletionRecord[]>([]);
  const [editingTaskForEdit, setEditingTaskForEdit] = useState<TaskRecord | null>(null);
  const [isTaskEditOpen, setIsTaskEditOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<TaskRecord | null>(null);
  const [detailTaskOccurrenceDate, setDetailTaskOccurrenceDate] = useState<number | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const taskDetailSlide = useRef(new Animated.Value(0)).current;
  const taskDetailOpacity = useRef(new Animated.Value(0)).current;

  // Refs for BackHandler to avoid re-registration ordering conflicts
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const isTaskDetailOpenRef = useRef(false);
  isTaskDetailOpenRef.current = isTaskDetailOpen;
  const isTaskEditOpenRef = useRef(false);
  isTaskEditOpenRef.current = isTaskEditOpen;
  const isCreateTaskOpenRef = useRef(false);
  isCreateTaskOpenRef.current = isCreateTaskOpen;
  const isAllQuickNotesOpenRef = useRef(false);
  isAllQuickNotesOpenRef.current = isAllQuickNotesOpen;
  const isAddSubjectOpenRef = useRef(false);
  isAddSubjectOpenRef.current = isAddSubjectOpen;
  const isActionSheetOpenRef = useRef(false);
  isActionSheetOpenRef.current = isActionSheetOpen;
  const isSubjectDetailOpenRef = useRef(false);
  isSubjectDetailOpenRef.current = isSubjectDetailOpen;
  const isFilterOpenRef = useRef(false);
  isFilterOpenRef.current = isFilterOpen;
  const [recentNoteRecords, setRecentNoteRecords] = useState<NoteRecord[]>([]);
  const [selectedQuickNote, setSelectedQuickNote] = useState<NoteRecord | null>(null);
  const [noteEditorMode, setNoteEditorMode] = useState<'quick' | 'full'>('quick');
  const [noteEditorSubjectId, setNoteEditorSubjectId] = useState('');
  const [allNotesSearch, setAllNotesSearch] = useState('');
  const [allNotesFilter, setAllNotesFilter] = useState<string | null>(null); // null = all, 'quick' = quick notes, subjectId = that subject
  const [isNoteFilterOpen, setIsNoteFilterOpen] = useState(false);
  const noteFilterSlide = useRef(new Animated.Value(0)).current;
  const noteFilterOpacity = useRef(new Animated.Value(0)).current;
  const [allViewMode, setAllViewMode] = useState<'notes' | 'tasks'>('notes');
  const [isAllViewModeSheetOpen, setIsAllViewModeSheetOpen] = useState(false);
  const allViewModeSheetSlide = useRef(new Animated.Value(0)).current;
  const isAllViewModeSheetOpenRef = useRef(false);
  isAllViewModeSheetOpenRef.current = isAllViewModeSheetOpen;
  const isNoteFilterOpenRef = useRef(false);
  isNoteFilterOpenRef.current = isNoteFilterOpen;
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({ Overdue: true, Today: true, Future: false, Completed: false }));
  const toggleSection = useCallback((title: string) => {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
  }, []);

  const loadRecentNotes = async () => {
    try {
      const notes = await getAllNotes();
      const activeSubjectIds = new Set(dbSubjects.filter((s) => !s.isArchived).map((s) => s.id));
      const filtered = notes.filter((n) => !n.subjectId || activeSubjectIds.has(n.subjectId));
      setRecentNoteRecords(filtered.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (err) {
      console.warn('Failed to load notes', err);
    }
  };

  const loadPendingTasks = async () => {
    try {
      const tasks = await getAllTasks();
      setAllLoadedTasks(tasks);
      const activeSubjectIds = new Set(dbSubjects.filter((s) => !s.isArchived).map((s) => s.id));
      const pending = tasks.filter(
        (t) => t.nextOccurrenceDate < END_OF_TIME && (!t.subjectId || activeSubjectIds.has(t.subjectId))
      ).sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate);
      setPendingTasks(pending);
      const completions = await getTaskCompletions(tasks.map((t) => t.id));
      setTaskCompletions(completions);
    } catch (err) {
      console.warn('Failed to load pending tasks', err);
    }
  };

  const handleCompleteTask = async (task: TaskRecord) => {
    try {
      const isRecurring = task.repeatType && task.repeatType !== 'none';
      if (isRecurring && task.nextOccurrenceDate > Date.now() && !isSameCalendarDay(task.nextOccurrenceDate, Date.now())) {
        return;
      }
      const occurrenceDate = task.nextOccurrenceDate;
      const next = calculateNextOccurrenceDate(task, occurrenceDate);
      const completedAt = Date.now();
      const updatedTask = { ...task, nextOccurrenceDate: next };
      await completeTaskOccurrence(task.id, occurrenceDate, next);
      setPendingTasks((current) =>
        current
          .map((t) => (t.id === task.id ? { ...t, nextOccurrenceDate: next } : t))
          .filter((t) => t.nextOccurrenceDate < END_OF_TIME)
          .sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate)
      );
      setAllLoadedTasks((current) => {
        const exists = current.some((t) => t.id === task.id);
        if (!exists) return [...current, updatedTask];
        return current.map((t) => (t.id === task.id ? updatedTask : t));
      });
      setTaskCompletions((current) => [
        ...current,
        { id: `${completedAt}-${Math.round(Math.random() * 1e6)}`, taskId: task.id, occurrenceDate, completedAt },
      ]);
    } catch (error) {
      console.warn('Failed to complete task', error);
      setToastMessage('Failed to complete task');
      setToastVisible(true);
    }
  };

  const completedOccurrences = useMemo(() => {
    const taskMap = new Map(allLoadedTasks.map((t) => [t.id, t]));
    const result: Array<{ task: TaskRecord; completion: TaskCompletionRecord }> = [];
    for (const completion of taskCompletions) {
      const task = taskMap.get(completion.taskId);
      if (!task) continue;
      result.push({ task, completion });
    }
    return result.sort((a, b) => b.completion.completedAt - a.completion.completedAt).slice(0, 20);
  }, [allLoadedTasks, taskCompletions]);

  const handleUncompleteTask = async (task: TaskRecord) => {
    try {
      const restoredDate = await uncompleteTaskOccurrence(task.id);
      setPendingTasks((current) => {
        const exists = current.find((t) => t.id === task.id);
        if (exists) {
          return current.map((t) =>
            t.id === task.id ? { ...t, nextOccurrenceDate: restoredDate } : t
          ).sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate);
        }
        return [...current, { ...task, nextOccurrenceDate: restoredDate }]
          .sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate);
      });
      setAllLoadedTasks((current) =>
        current.map((t) => (t.id === task.id ? { ...t, nextOccurrenceDate: restoredDate } : t))
      );
      setTaskCompletions((current) => {
        const latestCompletion = current
          .filter((c) => c.taskId === task.id)
          .sort((a, b) => b.completedAt - a.completedAt)[0];
        if (latestCompletion) {
          return current.filter((c) => c.id !== latestCompletion.id);
        }
        return current;
      });
      setToastMessage('Task uncompleted');
      setToastVisible(true);
    } catch (error) {
      console.warn('Failed to uncomplete task', error);
      setToastMessage('Failed to uncomplete task');
      setToastVisible(true);
    }
  };

  const handleStartAddTask = useCallback(() => {
    resetPlusButton();
    setIsCreateTaskOpen(true);
    setIsActionSheetOpen(false);
  }, []);

  const handleTaskCreated = useCallback((task: TaskRecord) => {
    setAllLoadedTasks((current) => {
      const exists = current.some((t) => t.id === task.id);
      return exists ? current.map((t) => (t.id === task.id ? task : t)) : [...current, task];
    });
    setPendingTasks((current) => [...current, task].sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate));
    setToastMessage('Task created');
    setToastVisible(true);
  }, []);

  const handleOpenTaskEdit = useCallback((task: TaskRecord) => {
    setEditingTaskForEdit(task);
    setIsTaskEditOpen(true);
  }, []);

  const handleCloseTaskEdit = useCallback(() => {
    setEditingTaskForEdit(null);
    setIsTaskEditOpen(false);
  }, []);

  const handleSaveTaskEdit = useCallback((saved: TaskRecord) => {
    setAllLoadedTasks((current) =>
      current.map((t) => (t.id === saved.id ? saved : t))
    );
    setPendingTasks((current) =>
      current.map((t) => (t.id === saved.id ? saved : t)).sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate)
    );
    setToastMessage('Task updated');
    setToastVisible(true);
  }, []);

  const handleOpenTaskDetail = useCallback((task: TaskRecord, occurrenceDate?: number) => {
    setDetailTask(task);
    setDetailTaskOccurrenceDate(occurrenceDate ?? task.nextOccurrenceDate);
    setIsTaskDetailOpen(true);
    taskDetailSlide.setValue(0);
    taskDetailOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(taskDetailOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(taskDetailSlide, { toValue: 1, ...springModalSlide }),
    ]).start();
  }, [taskDetailOpacity, taskDetailSlide]);

  const snapTaskDetailOpen = useCallback(() => {
    Animated.spring(taskDetailSlide, { toValue: 1, ...springModalSlide }).start();
  }, [taskDetailSlide]);

  const closeTaskDetail = useCallback(() => {
    Animated.parallel([
      Animated.timing(taskDetailOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(taskDetailSlide, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsTaskDetailOpen(false);
        setDetailTask(null);
        setDetailTaskOccurrenceDate(null);
      }
    });
  }, [taskDetailOpacity, taskDetailSlide]);

  const { panResponder: taskDetailPanResponder, scrollYRef: taskDetailScrollYRef } = useDragToClose(
    taskDetailSlide, snapTaskDetailOpen, closeTaskDetail,
  );

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setPendingTasks((current) => current.filter((t) => t.id !== taskId));
      setAllLoadedTasks((current) => current.filter((t) => t.id !== taskId));
      setTaskCompletions((current) => current.filter((c) => c.taskId !== taskId));
      setToastMessage('Task deleted');
      setToastVisible(true);
    } catch (error) {
      console.warn('Failed to delete task', error);
      setToastMessage('Failed to delete task');
      setToastVisible(true);
    }
  };

  const handleDeleteTaskOccurrence = async (task: TaskRecord, occurrenceDate: number) => {
    try {
      const nextDate = await deleteTaskOccurrence(task.id, occurrenceDate);
      setTaskCompletions((current) =>
        current.filter((c) => !(c.taskId === task.id && c.occurrenceDate === occurrenceDate))
      );
      setPendingTasks((current) => {
        const idx = current.findIndex((t) => t.id === task.id);
        if (idx === -1) return current;
        const t = current[idx];
        if (t.nextOccurrenceDate !== occurrenceDate) return current;
        const updated = [...current];
        updated[idx] = { ...t, nextOccurrenceDate: nextDate };
        if (nextDate >= END_OF_TIME) return updated.filter((t) => t.nextOccurrenceDate < END_OF_TIME);
        return updated.sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate);
      });
      setAllLoadedTasks((current) =>
        current.map((t) => (t.id === task.id ? { ...t, nextOccurrenceDate: nextDate } : t))
      );
      setToastMessage('Occurrence deleted');
      setToastVisible(true);
    } catch (error) {
      console.warn('Failed to delete occurrence', error);
      setToastMessage('Failed to delete occurrence');
      setToastVisible(true);
    }
  };

  const handleOpenTaskSubject = useCallback((task: TaskRecord) => {
    const subject = dbSubjects.find((s) => s.id === task.subjectId);
    if (subject) {
      setSubjectDetailInitialTab('subject');
      setSelectedSubjectDetail(subject);
      setIsSubjectDetailOpen(true);
    }
  }, [dbSubjects]);

  const handleOpenDetailTaskSubject = useCallback((subject: SubjectRecord, _taskId: string) => {
    setIsTaskDetailOpen(false);
    setDetailTask(null);
    setDetailTaskOccurrenceDate(null);
    setSelectedSubjectDetail(subject);
    setSubjectDetailInitialTab('tasks');
    setIsSubjectDetailOpen(true);
    Animated.timing(subjectDetailSlideAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [subjectDetailSlideAnim]);

  const isBeforeToday = useCallback((date: number) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return date < todayStart.getTime();
  }, []);

  const todayCompletedOccurrenceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of taskCompletions) {
      if (isSameCalendarDay(c.occurrenceDate, Date.now())) {
        ids.add(c.taskId);
      }
    }
    return ids;
  }, [taskCompletions]);

  const overdueTasks = useMemo(
    () => pendingTasks.filter((t) => !todayCompletedOccurrenceIds.has(t.id) && isBeforeToday(t.nextOccurrenceDate)),
    [pendingTasks, todayCompletedOccurrenceIds, isBeforeToday]
  );
  const todayTasks = useMemo(
    () => pendingTasks.filter((t) => !todayCompletedOccurrenceIds.has(t.id) && isSameCalendarDay(t.nextOccurrenceDate, Date.now())),
    [pendingTasks, todayCompletedOccurrenceIds]
  );
  const futureTasks = useMemo(
    () => pendingTasks.filter((t) => t.nextOccurrenceDate > Date.now() && !isSameCalendarDay(t.nextOccurrenceDate, Date.now())),
    [pendingTasks]
  );

  const urgentTasksPreview = useMemo(() => {
    const priorityOrder = (p: string | null | undefined) => {
      if (p === 'high') return 0;
      if (p === 'low') return 1;
      return 2;
    };
    const sortGroup = (arr: typeof overdueTasks) =>
      [...arr].sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
    return [
      ...sortGroup(overdueTasks),
      ...sortGroup(todayTasks),
    ].slice(0, 4);
  }, [overdueTasks, todayTasks]);

  const prioritySortFn = useCallback((p: string | null | undefined) => {
    if (p === 'high') return 0;
    if (p === 'low') return 1;
    return 2;
  }, []);

  const overviewSortedOverdue = useMemo(() => {
    if (allViewMode !== 'tasks') return overdueTasks;
    const sorted = [...overdueTasks].sort((a, b) => prioritySortFn(a.priority) - prioritySortFn(b.priority));
    if (!allNotesSearch.trim()) return sorted;
    return sorted.filter((t) => t.title.toLowerCase().includes(allNotesSearch.toLowerCase()));
  }, [overdueTasks, allViewMode, allNotesSearch, prioritySortFn]);

  const overviewSortedToday = useMemo(() => {
    if (allViewMode !== 'tasks') return todayTasks;
    const sorted = [...todayTasks].sort((a, b) => prioritySortFn(a.priority) - prioritySortFn(b.priority));
    if (!allNotesSearch.trim()) return sorted;
    return sorted.filter((t) => t.title.toLowerCase().includes(allNotesSearch.toLowerCase()));
  }, [todayTasks, allViewMode, allNotesSearch, prioritySortFn]);

  const overviewSortedFuture = useMemo(() => {
    if (allViewMode !== 'tasks') return futureTasks;
    const sorted = [...futureTasks].sort((a, b) => prioritySortFn(a.priority) - prioritySortFn(b.priority));
    if (!allNotesSearch.trim()) return sorted;
    return sorted.filter((t) => t.title.toLowerCase().includes(allNotesSearch.toLowerCase()));
  }, [futureTasks, allViewMode, allNotesSearch, prioritySortFn]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000); // Update every 30s
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const activeSubjects = useMemo(() => dbSubjects.filter((s) => !s.isArchived), [dbSubjects]);

  const subjectLookup = useMemo(() => {
    const map: Record<string, { code: string; title: string }> = {};
    dbSubjects.forEach((s) => {
      map[s.id] = { code: s.code ?? s.title.slice(0, 6).toUpperCase(), title: s.title };
    });
    return map;
  }, [dbSubjects]);

  const loadData = async () => {
    try {
      const rows = await getSubjects();
      setDbSubjects(rows);
    } catch (err) {
      console.warn('MainScreen: failed to load subjects', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadRecentNotes();
    await loadPendingTasks();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadRecentNotes();
    loadPendingTasks();
  }, [dbSubjects]);

  // Reload notes when subject detail closes (notes may have changed)
  const prevSubjectDetailOpen = useRef(isSubjectDetailOpen);
  useEffect(() => {
    if (prevSubjectDetailOpen.current && !isSubjectDetailOpen) {
      loadRecentNotes();
      loadPendingTasks();
    }
    prevSubjectDetailOpen.current = isSubjectDetailOpen;
  }, [isSubjectDetailOpen]);

  useEffect(() => {
    const loadNoteCounts = async () => {
      const counts: Record<string, number> = {};
      for (const s of activeSubjects) {
        const notes = await getNotesBySubjectId(s.id);
        counts[s.id] = notes.length;
      }
      setNoteCounts(counts);
    };
    loadNoteCounts();
  }, [activeSubjects]);

  useEffect(() => {
    const loadTaskCounts = async () => {
      const counts: Record<string, number> = {};
      for (const s of activeSubjects) {
        const tasks = await getTasksBySubjectId(s.id);
        counts[s.id] = tasks.length;
      }
      setTaskCounts(counts);
    };
    loadTaskCounts();
  }, [activeSubjects]);

  // Load persisted filter
  useEffect(() => {
    (async () => {
      try {
        const saved = await getMetaValue('subjectFilter');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSubjectFilter(parsed);
        }
      } catch {}
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadRecentNotes();
      loadPendingTasks();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Collect unique terms from subjects for filter options
  const availableTerms = useMemo(() => {
    const terms = new Set<string>();
    dbSubjects.forEach((s) => { if (s.term) terms.add(s.term); });
    return Array.from(terms).sort();
  }, [dbSubjects]);

  const handleOpenFilter = () => {
    setIsFilterOpen(true);
    Animated.parallel([
      Animated.spring(filterSlide, { toValue: 1, ...springModalSlide }),
      Animated.timing(filterOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const handleCloseFilter = () => {
    Animated.parallel([
      Animated.timing(filterSlide, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(filterOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setIsFilterOpen(false);
    });
  };

  const handleSelectFilter = (newFilter: { type: 'active' | 'archived' | 'all'; term: string | null }) => {
    setSubjectFilter(newFilter);
    setMetaValue('subjectFilter', JSON.stringify(newFilter)).catch(() => {});
    handleCloseFilter();
  };

  const { panResponder: filterPanResponder, scrollYRef: filterScrollYRef } = useDragToClose(
    filterSlide,
    () => Animated.spring(filterSlide, { toValue: 1, ...springModalSlide }).start(),
    handleCloseFilter,
  );

  const handleOpenNoteFilter = () => {
    setIsNoteFilterOpen(true);
    Animated.parallel([
      Animated.spring(noteFilterSlide, { toValue: 1, ...springModalSlide }),
      Animated.timing(noteFilterOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const handleCloseNoteFilter = () => {
    Animated.parallel([
      Animated.timing(noteFilterSlide, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(noteFilterOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setIsNoteFilterOpen(false);
    });
  };

  const handleSelectNoteFilter = (newFilter: string | null) => {
    setAllNotesFilter(newFilter);
    handleCloseNoteFilter();
  };

  const { panResponder: noteFilterPanResponder, scrollYRef: noteFilterScrollYRef } = useDragToClose(
    noteFilterSlide,
    () => Animated.spring(noteFilterSlide, { toValue: 1, ...springModalSlide }).start(),
    handleCloseNoteFilter,
  );

  const handleOpenAllViewModeSheet = () => {
    setIsAllViewModeSheetOpen(true);
    Animated.spring(allViewModeSheetSlide, { toValue: 1, ...springModalSlide }).start();
  };

  const handleCloseAllViewModeSheet = () => {
    Animated.timing(allViewModeSheetSlide, { toValue: 0, duration: 280, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setIsAllViewModeSheetOpen(false);
    });
  };

  const handleSelectAllViewMode = (mode: 'notes' | 'tasks') => {
    setAllViewMode(mode);
    setAllNotesSearch('');
    handleCloseAllViewModeSheet();
  };

  const { panResponder: allViewModeSheetPanResponder, scrollYRef: allViewModeSheetScrollYRef } = useDragToClose(
    allViewModeSheetSlide,
    () => Animated.spring(allViewModeSheetSlide, { toValue: 1, ...springModalSlide }).start(),
    handleCloseAllViewModeSheet,
  );

  // Apply filter to subjects
  const filteredDbSubjects = useMemo(() => {
    let result = dbSubjects;
    if (subjectFilter.type === 'active') result = result.filter((s) => !s.isArchived);
    else if (subjectFilter.type === 'archived') result = result.filter((s) => s.isArchived);
    if (subjectFilter.term) result = result.filter((s) => s.term === subjectFilter.term);
    return result;
  }, [dbSubjects, subjectFilter]);

  const dateLabel = now
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase();

  const nextClassState = useMemo(() => {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const todayDay = now.getDay();

    const classesToday = activeSubjects
      .filter((subject) => (subject.days ?? []).some((day) => DAY_MAP[day] === todayDay))
      .map((subject) => {
        const startMinutes = parseTimeToMinutes(subject.startTime ?? null);
        if (startMinutes === null) return null;
        const endMinutes =
          parseTimeToMinutes(subject.endTime ?? null) ?? Math.min(startMinutes + 60, 24 * 60);

        return {
          id: subject.id,
          title: subject.title,
          location: subject.location ?? 'No location set',
          instructor: subject.instructor ?? 'No instructor',
          startMinutes,
          endMinutes: endMinutes <= startMinutes ? Math.min(startMinutes + 60, 24 * 60) : endMinutes,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    const currentClasses = classesToday.filter(
      (item) => nowMinutes >= item.startMinutes && nowMinutes < item.endMinutes
    );
    const currentClass = currentClasses.sort((a, b) => a.endMinutes - b.endMinutes)[0] ?? null;
    const nextClass = classesToday.find((item) => item.startMinutes > nowMinutes) ?? null;

    if (currentClass) {
      return {
        state: 'current' as const,
        classInfo: currentClass,
        headerMeta: 'In progress',
        nextHint: nextClass
          ? {
              title: nextClass.title,
              inLabel: formatMinutesDiff(nextClass.startMinutes - nowMinutes),
            }
          : null,
      };
    }

    if (nextClass) {
      return {
        state: 'upcoming' as const,
        classInfo: nextClass,
        headerMeta: formatMinutesDiff(nextClass.startMinutes - nowMinutes),
        nextHint: null,
      };
    }

    return {
      state: 'empty' as const,
      classInfo: null,
      headerMeta: null,
      nextHint: null,
    };
  }, [dbSubjects, now]);

  const dynamicGreeting = useMemo(() => {
    const hour = now.getHours();
    const timePeriod = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';

    const todayDay = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const todaySubjects = activeSubjects.filter(s => (s.days ?? []).some(d => DAY_MAP[d] === todayDay));

    const hasTasks = overdueTasks.length > 0 || todayTasks.length > 0;

    let classStatus: string;
    let classCount = 0;
    if (todaySubjects.length === 0) {
      classStatus = 'no_classes';
    } else {
      const remainingSubjects = todaySubjects.filter(s => {
        const start = parseTimeToMinutes(s.startTime ?? null) ?? 0;
        return start > nowMinutes;
      });
      const currentSubjects = todaySubjects.filter(s => {
        const start = parseTimeToMinutes(s.startTime ?? null) ?? 0;
        const end = parseTimeToMinutes(s.endTime ?? null) ?? (start + 60);
        return nowMinutes >= start && nowMinutes < end;
      });
      if (currentSubjects.length > 0) {
        classStatus = 'in_class';
      } else if (remainingSubjects.length === 0) {
        classStatus = 'all_done';
      } else {
        classCount = remainingSubjects.length;
        classStatus = classCount === 1 ? 'one_left' : 'n_left';
      }
    }

    const taskKey = hasTasks ? 'with_tasks' : 'no_tasks';

    const GREETINGS: Record<string, Record<string, Record<string, string>>> = {
      no_classes: {
        no_tasks: {
          morning: "No classes, nothing due. Did you accidentally become a free person?",
          afternoon: "Nothing on the board. Genuinely nothing. Don't ruin it by being productive.",
          evening: "All free tonight. Go touch grass or something.",
        },
        with_tasks: {
          morning: "No class today. The tasks, however, did not get the memo.",
          afternoon: "No classes, just tasks. Could be worse. Could also be better.",
          evening: "No class tonight. Just you, the tasks, and whatever snack you're stress-eating.",
        },
      },
      all_done: {
        no_tasks: {
          morning: "You're done. Nothing left. Are you even a student right now?",
          afternoon: "All clear. Not a single thing to do. Sit with that. You earned it.",
          evening: "All done, nothing left. Somewhere out there a procrastinator is crying; not you though.",
        },
        with_tasks: {
          morning: "Classes: done. Tasks: still here, unfortunately. So close.",
          afternoon: "Classes are cooked. Tasks are the only thing standing between you and freedom.",
          evening: "Classes wrapped. Tasks remain. Finish them and you can finally exhale.",
        },
      },
      one_left: {
        no_tasks: {
          morning: "One class. That's literally it. You could do this in your sleep.",
          afternoon: "One class left and zero tasks. You're practically on vacation.",
          evening: "One class standing between you and a free night. Don't let it win.",
        },
        with_tasks: {
          morning: "One class and tasks. So close to freedom, yet here we are.",
          afternoon: "One class left, tasks after. The finish line is right there and it's laughing at you.",
          evening: "One class and tasks at this hour. Truly a villain arc.",
        },
      },
      n_left: {
        no_tasks: {
          morning: "{n} classes today. No tasks at least, so the universe isn't completely against you.",
          afternoon: "Still {n} classes to go. No tasks though; small win, take it.",
          evening: "{n} classes left. No tasks after. Just get through them and you're free.",
        },
        with_tasks: {
          morning: "{n} classes and tasks today. Whoever made this schedule was not your friend.",
          afternoon: "Still {n} classes and tasks. At this point you're not a student, you're a hostage.",
          evening: "{n} classes and tasks at this hour? The audacity of this day, honestly.",
        },
      },
      in_class: {
        no_tasks: {
          morning: "You're in class right now. At least there's nothing waiting after; small mercy.",
          afternoon: "Currently in class. No tasks though, so this is technically the hardest part of your day.",
          evening: "In class at this hour with nothing due after. Respect, honestly.",
        },
        with_tasks: {
          morning: "You're in class and tasks are already waiting outside like debt collectors.",
          afternoon: "Currently in class, tasks pending. You're basically paying to suffer twice.",
          evening: "In class at night with tasks after. Who hurt you? (Was it you?)",
        },
      },
    };

    let greeting = GREETINGS[classStatus][taskKey][timePeriod];
    if (classStatus === 'n_left') {
      greeting = greeting.replace('{n}', String(classCount));
    }

    return greeting;
  }, [now, dbSubjects, overdueTasks, todayTasks]);

  const handleTabPress = (tab: 'home' | 'schedule' | 'subjects') => {
    if (tab === activeTab) return;
    const idx = tab === 'home' ? 0 : tab === 'schedule' ? 1 : 2;
    Animated.spring(tabIndicatorAnim, {
      toValue: idx,
      friction: 9,
      tension: 50,
      useNativeDriver: true,
    }).start();
    setActiveTab(tab);
  };

  const handleOpenActions = () => {
    setIsActionSheetOpen(true);
    buttonAnims.forEach(a => a.setValue(0));
    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslate, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(buttonRotate, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }),
      Animated.sequence([
        Animated.timing(buttonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(buttonScale, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(80, [3, 2, 1, 0].map(i =>
        Animated.spring(buttonAnims[i], {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        })
      )),
    ]).start();
  };

  const resetPlusButton = () => {
    Animated.spring(buttonRotate, {
      toValue: 0,
      useNativeDriver: true,
      friction: 7,
      tension: 40,
    }).start();
  };

  const handleCloseActions = () => {
    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslate, {
        toValue: 20,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(buttonRotate, {
        toValue: 0,
        useNativeDriver: true,
        friction: 7,
        tension: 40,
      }),
      Animated.stagger(60, [0, 1, 2, 3].map(i =>
        Animated.spring(buttonAnims[i], { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 })
      )),
    ]).start(({ finished }) => {
      if (finished) {
        setIsActionSheetOpen(false);
      }
    });
  };

  const handleStartAddSubject = () => {
    resetPlusButton();
    setIsAddSubjectOpen(true);
    setIsActionSheetOpen(false);
  };

  const handleCancelAddSubject = () => {
    setIsAddSubjectOpen(false);
  };

  const handlePressSubject = (subject: any) => {
    setSubjectDetailInitialTab('subject');
    setSelectedSubjectDetail(subject);
    setIsSubjectDetailOpen(true);
    Animated.timing(subjectDetailSlideAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleTogglePin = async (subjectId: string, isPinned: boolean) => {
    await updateSubject(subjectId, { isPinned });
    await loadData();
  };

  const handleOpenAllQuickNotes = () => {
    Keyboard.dismiss();
    setIsAllQuickNotesOpen(true);
    Animated.timing(allQuickNotesSlideAnim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleOpenAllQuickTasks = () => {
    setAllViewMode('tasks');
    handleOpenAllQuickNotes();
  };

  const handleCloseAllQuickNotes = () => {
    setAllViewMode('notes');
    setExpandedSections({ Overdue: true, Today: true, Future: false, Completed: false });
    Animated.timing(allQuickNotesSlideAnim, {
      toValue: 0,
      duration: 350,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsAllQuickNotesOpen(false);
      }
    });
  };

  const handleCloseSubjectDetail = () => {
    Animated.timing(subjectDetailSlideAnim, {
      toValue: 0,
      duration: 350,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsSubjectDetailOpen(false);
        setSelectedSubjectDetail(null);
      }
    });
  };

  const handleSaveSubject = async (subjectData: {
    title: string;
    code?: string;
    instructor?: string;
    term?: string;
    days: string[];
    startTime: string;
    endTime: string;
    location?: string;
  }) => {
    try {
      const savedSubject = await insertSubject({ ...subjectData, isArchived: false, isPinned: false });
      setDbSubjects((prev) => [...prev, savedSubject]);
      resetPlusButton();
      setIsAddSubjectOpen(false);
      
      // Trigger success toast
      setToastMessage(`${savedSubject.title} created successfully`);
      setToastVisible(true);
    } catch (error) {
      console.warn('Failed to save subject', error);
      setToastMessage('Failed to save subject');
      setToastVisible(true);
    }
  };

  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const isQuickNoteOpenRef = useRef(false);
  isQuickNoteOpenRef.current = isQuickNoteOpen;

  const handleStartQuickNote = () => {
    resetPlusButton();
    setIsActionSheetOpen(false);
    setSelectedQuickNote(null);
    setNoteEditorMode('quick');
    setIsQuickNoteOpen(true);
  };

  const handleStartSubjectNote = (subjectId: string, subjectTitle: string) => {
    resetPlusButton();
    setIsActionSheetOpen(false);
    setSelectedQuickNote(null);
    setNoteEditorMode('full');
    setNoteEditorSubjectId(subjectId);
    setIsQuickNoteOpen(true);
  };

  const handlePressQuickNote = (note: NoteRecord) => {
    resetPlusButton();
    setSelectedQuickNote(note);
    setNoteEditorMode(note.subjectId ? 'full' : 'quick');
    setIsQuickNoteOpen(true);
  };

  const handleQuickNoteClose = () => {
    setIsQuickNoteOpen(false);
    setSelectedQuickNote(null);
    setNoteEditorSubjectId('');
  };

  const handleQuickNoteSave = async (
    noteId: string | null,
    draft: {
      subjectId: string;
      folderId: string | null;
      title: string;
      contentHtml: string;
      contentText: string;
      isPinned: boolean;
    }
  ): Promise<NoteRecord | null> => {
    let savedNote: NoteRecord;
    if (noteId) {
      savedNote = await updateNote(noteId, draft);
    } else {
      const recentMatch = await findRecentMatchingNote(draft);
      if (recentMatch) {
        savedNote = recentMatch;
      } else {
        savedNote = await insertNote(draft);
      }
    }
    await loadRecentNotes();
    await loadPendingTasks();
    return savedNote;
  };

  const handleQuickNoteDelete = async (noteId: string) => {
    await deleteNote(noteId);
    await loadRecentNotes();
    await loadPendingTasks();
  };

  // Intercept hardware back to close overlays and handle tab navigation
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isTaskDetailOpenRef.current) {
        closeTaskDetail();
        return true;
      }
      if (isTaskEditOpenRef.current) {
        handleCloseTaskEdit();
        return true;
      }
      if (isCreateTaskOpenRef.current) {
        setIsCreateTaskOpen(false);
        return true;
      }
      if (isAllQuickNotesOpenRef.current) {
        handleCloseAllQuickNotes();
        return true;
      }
      if (isQuickNoteOpenRef.current) {
        handleQuickNoteClose();
        return true;
      }
      if (isAddSubjectOpenRef.current) {
        handleCancelAddSubject();
        return true;
      }
      if (isActionSheetOpenRef.current) {
        handleCloseActions();
        return true;
      }
      if (isSubjectDetailOpenRef.current) {
        handleCloseSubjectDetail();
        return true;
      }
      if (isFilterOpenRef.current) {
        handleCloseFilter();
        return true;
      }
      if (isAllViewModeSheetOpenRef.current) {
        handleCloseAllViewModeSheet();
        return true;
      }
      if (isNoteFilterOpenRef.current) {
        handleCloseNoteFilter();
        return true;
      }
      // Tab navigation: schedule/subjects → home, home → close app
      if (activeTabRef.current === 'schedule' || activeTabRef.current === 'subjects') {
        setActiveTab('home');
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, []);

  // Format subjects for the All Subjects tab
  const subjects = useMemo(() => {
    return filteredDbSubjects.map((s) => ({
      id: s.id,
      code: s.code ?? s.title.slice(0, 6).toUpperCase(),
      title: s.title,
      instructor: s.instructor ?? '',
      days: s.days ?? [],
      time:
        s.startTime && s.endTime
          ? `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`
          : s.startTime
            ? formatTime(s.startTime)
            : '',
      location: s.location ?? '',
      term: s.term ?? '',
      isArchived: s.isArchived,
      isPinned: s.isPinned,
      tasksCount: taskCounts[s.id] ?? 0,
      notesCount: noteCounts[s.id] ?? 0,
    }));
  }, [filteredDbSubjects, noteCounts, taskCounts]);

  return (
    <View style={styles.container}>
      <View style={[styles.mainContent, isDark && styles.mainContentDark]}
      >
        <View style={[styles.headerRow, isDark && styles.headerRowDark]}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerIcons}>
            <Pressable style={[styles.headerIconButton, isDark && styles.headerIconButtonDark]} onPress={handleOpenAllQuickTasks}>
              <Feather name="grid" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
            </Pressable>
            <Pressable style={[styles.headerIconButton, isDark && styles.headerIconButtonDark]} onPress={() => router.push('/settings')}>
              <Feather name="settings" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
            </Pressable>
          </View>
        </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh}
            tintColor="#1c2f2a" // iOS-like spinner color
            colors={["#1c2f2a"]} // Android spinner color
          />
        }
      >
        {activeTab === 'subjects' ? (
          <SubjectsScreen 
            subjects={subjects} 
            onPressSubject={handlePressSubject}
            onFilterPress={handleOpenFilter}
            onTogglePin={handleTogglePin}
            hasActiveFilter={subjectFilter.type !== 'active' || subjectFilter.term !== null}
          />
        ) : activeTab === 'schedule' ? (
          <ScheduleScreen
            subjects={activeSubjects}
            onToast={(msg) => { setToastMessage(msg); setToastVisible(true); }}
            onOpenSubjectDetail={(subject) => {
              const time = subject.startTime && subject.endTime
                ? `${formatTime(subject.startTime)} - ${formatTime(subject.endTime)}`
                : subject.startTime
                  ? formatTime(subject.startTime)
                  : '';
              setSelectedSubjectDetail({ ...subject, time });
              setSubjectDetailInitialTab('subject');
              setIsSubjectDetailOpen(true);
              Animated.timing(subjectDetailSlideAnim, {
                toValue: 1,
                duration: 400,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }).start();
            }}
          />
        ) : (
          <>
            <View style={styles.titleBlock}>
              <View style={styles.greetingAccent} />
              <View style={styles.greetingContent}>
                <Text style={[styles.dateText, isDark && styles.dateTextDark]}>{dateLabel}</Text>
                <Text style={[styles.greetingLine2, isDark && styles.greetingLine2Dark]}>{dynamicGreeting}</Text>
              </View>
            </View>

            <>
                <LinearGradient colors={['#223632', '#1c2f2a']} style={styles.nextClassCard}>
                  <View style={styles.nextClassHeader}>
                    <View style={styles.nextClassLabelRow}>
                      <Feather name="book-open" size={18} color="#d3e3dc" />
                      <Text style={styles.nextClassLabel}>
                        {nextClassState.state === 'current' ? 'CURRENT CLASS' : 'NEXT CLASS'}
                      </Text>
                    </View>
                    {nextClassState.headerMeta ? (
                      <Text style={styles.nextClassMeta}>{nextClassState.headerMeta}</Text>
                    ) : null}
                  </View>
                  {nextClassState.classInfo ? (
                    <>
                      <Text style={styles.nextClassTitle}>{nextClassState.classInfo.title}</Text>
                      <View style={styles.nextClassDivider} />
                      <View style={styles.nextClassMetaRow}>
                        <View style={styles.nextClassMetaItem}>
                          <Feather name="map-pin" size={14} color="#90a39a" />
                          <Text style={styles.nextClassMetaText}>{nextClassState.classInfo.location}</Text>
                        </View>
                        <View style={styles.nextClassMetaItem}>
                          <Feather name="user" size={14} color="#90a39a" />
                          <Text style={styles.nextClassMetaText}>{nextClassState.classInfo.instructor}</Text>
                        </View>
                      </View>
                      {nextClassState.nextHint ? (
                        <View style={styles.nextClassHintRow}>
                          <Text style={styles.nextClassHintText}>
                            Next class: {nextClassState.nextHint.title}
                          </Text>
                          <Text style={styles.nextClassHintMeta}>
                            {nextClassState.nextHint.inLabel}
                          </Text>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <View style={styles.nextClassEmpty}>
                      <Text style={styles.nextClassEmptyTitle}>
                        {activeSubjects.length > 0 ? 'No more classes today' : 'No upcoming classes'}
                      </Text>
                      <Text style={styles.nextClassEmptyBody}>
                          {activeSubjects.length > 0
                          ? 'Check your schedule tab for the rest of the week.' 
                          : 'Add your first subject to see today\'s schedule.'}
                      </Text>
                    </View>
                  )}
                </LinearGradient>

                <View style={styles.urgentTasksSection}>
                  <View style={styles.recentNotesHeaderRow}>
                    <Text style={[styles.dateText, isDark && styles.dateTextDark, { fontSize: 13 }]}>URGENT TASKS</Text>
                    <Pressable style={[styles.headerIconButton, isDark && styles.headerIconButtonDark]} onPress={handleOpenAllQuickTasks} hitSlop={8}>
                      <Feather name="arrow-right" size={16} color={isDark ? '#8f9b95' : '#6d756f'} />
                    </Pressable>
                  </View>

                  {urgentTasksPreview.length === 0 ? (
                    <View style={[styles.sectionEmptyState, isDark && styles.sectionEmptyStateDark]}>
                      <View style={[styles.sectionEmptyIconWrapper, isDark && styles.sectionEmptyIconWrapperDark]}>
                        <Feather name="check-circle" size={18} color={isDark ? '#6e7b74' : '#8f968f'} />
                      </View>
                      <Text style={[styles.sectionEmptyTitle, isDark && styles.sectionEmptyTitleDark]}>No urgent tasks</Text>
                    </View>
                  ) : (
                    urgentTasksPreview.map((task) => {
                      const occDate = task.nextOccurrenceDate;
                      const due = new Date(occDate);
                      const dueLabel = due.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                      const isRecurring = task.repeatType && task.repeatType !== 'none';
                      const canComplete = !isRecurring || (isSameCalendarDay(occDate, Date.now()) || occDate < Date.now());
                      const isTimeOverdue = task.startDate ? occDate < Date.now() : false;
                      const subject = task.subjectId ? subjectLookup[task.subjectId] : null;
                      return (
                        <CardScale
                          key={task.id}
                          onPress={() => handleOpenTaskEdit(task)}
                          onLongPress={() => handleOpenTaskDetail(task)}
                          style={[styles.taskCard, isDark && styles.taskCardDark]}
                        >
                          {canComplete ? (
                            <Pressable
                              style={styles.taskCheckbox}
                              onPress={() => void handleCompleteTask(task)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <MaterialCommunityIcons name="circle-outline" size={22} color={isDark ? '#6e7b74' : '#a0aba5'} />
                            </Pressable>
                          ) : (
                            <View style={styles.taskCheckbox}>
                              <Feather name="lock" size={15} color={isDark ? '#4a5a52' : '#c9cdc9'} />
                            </View>
                          )}
                          <View style={styles.taskTextWrapper}>
                            <Text style={[styles.taskTitle, isDark && styles.taskTitleDark]} numberOfLines={1}>
                              {task.title}
                            </Text>
                            {task.startDate ? (
                            <View style={styles.taskDueDateRow}>
                              <Text style={[styles.taskDueDateText, isDark && styles.taskDueDateTextDark, isTimeOverdue && { color: '#BA1A1A' }]} numberOfLines={1}>
                                {dueLabel}
                              </Text>
                              <View style={styles.repeatBadge}>
                                {isRecurring ? (
                                  <Feather name="repeat" size={12} color={isDark ? '#6e7b74' : '#8f968f'} style={task.reminderMinutes != null ? { marginRight: 4 } : undefined} />
                                ) : null}
                                {task.reminderMinutes != null ? (
                                  <Feather name="bell" size={12} color={isDark ? '#6e7b74' : '#8f968f'} />
                                ) : null}
                                {subject ? (
                                  <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 16, color: isDark ? '#6e7b74' : '#6b746f', marginLeft: 6, lineHeight: 12, marginRight: 6 }}>·</Text>
                                ) : null}
                                {subject ? (
                                  <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: isDark ? '#6e7b74' : '#6b746f' }}>{subject.code ?? subject.title}</Text>
                                ) : null}
                              </View>
                            </View>
                            ) : null}
                          </View>
                          {task.priority ? (
                            <MaterialIcons name="flag" size={22} color={task.priority === 'high' ? '#d1453b' : '#e88d3f'} style={{ marginLeft: 12 }} />
                          ) : null}
                        </CardScale>
                      );
                    })
                  )}
                </View>

                <View style={styles.recentNotesSection}>
                  <View style={styles.recentNotesHeaderRow}>
                    <Text style={[styles.dateText, isDark && styles.dateTextDark, { fontSize: 13 }]}>RECENT NOTES</Text>
                    <Pressable style={[styles.headerIconButton, isDark && styles.headerIconButtonDark]} onPress={handleOpenAllQuickNotes} hitSlop={8}>
                      <Feather name="arrow-right" size={16} color={isDark ? '#8f9b95' : '#6d756f'} />
                    </Pressable>
                  </View>

                  {recentNoteRecords.length === 0 ? (
                    <View style={[styles.sectionEmptyState, isDark && styles.sectionEmptyStateDark]}>
                      <View style={[styles.sectionEmptyIconWrapper, isDark && styles.sectionEmptyIconWrapperDark]}>
                        <Feather name="file-text" size={18} color={isDark ? '#6e7b74' : '#8f968f'} />
                      </View>
                      <Text style={[styles.sectionEmptyTitle, isDark && styles.sectionEmptyTitleDark]}>No notes yet</Text>
                    </View>
                  ) : (
                    recentNoteRecords.slice(0, 4).map((note) => {
                      const isQuick = !note.subjectId;
                      const subject = subjectLookup[note.subjectId];
                      return (
                        <Pressable
                          key={note.id}
                          style={[styles.noteCard, isQuick && styles.noteCardQuick, !isQuick && isDark && styles.noteCardDark, isQuick && isDark && { backgroundColor: '#2a3d36', borderColor: '#3a4f47' }]}
                          onPress={() => handlePressQuickNote(note)}
                        >
                          <Text style={[styles.noteTitle, isDark && styles.noteTitleDark]}>{note.title || 'Untitled note'}</Text>
                          <Text style={[styles.noteBody, isDark && styles.noteBodyDark]} numberOfLines={1}>{note.contentText}</Text>
                          <View style={styles.noteMetaRow}>
                            <Text style={[styles.noteDate, isDark && styles.noteDateDark]}>{formatNoteDate(note.updatedAt)}</Text>
                            <Text style={[styles.noteOrigin, isDark && styles.noteOriginDark]}>{isQuick ? 'Quick note' : subject ? subject.code : 'Subject'}</Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
            </>
          </>
        )}
      </ScrollView>

      <View style={styles.navDock}>
        <View style={styles.navPill} onLayout={(e) => setNavPillWidth(e.nativeEvent.layout.width)}>
          <Animated.View style={[styles.activeIndicator, {
            transform: [{ translateX: tabIndicatorAnim.interpolate({
              inputRange: [0, 1, 2],
              outputRange: navPillWidth > 0
                ? [8, 8 + (navPillWidth - 16) / 3, 8 + 2 * (navPillWidth - 16) / 3]
                : [0, 0, 0],
            }) }],
            width: navPillWidth > 0 ? (navPillWidth - 16) / 3 : 0,
          }]} />
          <Pressable style={styles.navItem} onPress={() => handleTabPress('home')}>
            <View style={styles.navItemInner}>
              <Feather name="home" size={18} color={activeTab === 'home' ? '#d7e4dd' : isDark ? '#6e7b74' : '#5c6762'} />
              <Text style={activeTab === 'home' ? styles.navLabelActive : [styles.navLabel, isDark && { color: '#6e7b74' }]}>Home</Text>
            </View>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => handleTabPress('schedule')}>
            <View style={styles.navItemInner}>
              <Feather name="calendar" size={18} color={activeTab === 'schedule' ? '#d7e4dd' : isDark ? '#6e7b74' : '#5c6762'} />
              <Text style={activeTab === 'schedule' ? styles.navLabelActive : [styles.navLabel, isDark && { color: '#6e7b74' }]}>Schedule</Text>
            </View>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => handleTabPress('subjects')}>
            <View style={styles.navItemInner}>
              <Feather name="book" size={18} color={activeTab === 'subjects' ? '#d7e4dd' : isDark ? '#6e7b74' : '#5c6762'} />
              <Text style={activeTab === 'subjects' ? styles.navLabelActive : [styles.navLabel, isDark && { color: '#6e7b74' }]}>Subjects</Text>
            </View>
          </Pressable>
        </View>
        <View style={{ width: 64 }} />
      </View>

      {isActionSheetOpen ? (
        <View style={styles.actionSheetOverlay}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: sheetOpacity }]}>
            <BlurView 
              intensity={20} 
              tint="dark" 
              style={StyleSheet.absoluteFill}
              experimentalBlurMethod="dimezisBlurView" 
            />
            <View style={styles.actionSheetBackdrop} />
          </Animated.View>
          <Pressable style={styles.actionSheetPressTarget} onPress={handleCloseActions} />
          <Animated.View
            style={[
              styles.actionSheetPanel,
              {
                transform: [{ translateY: sheetTranslate }],
              },
            ]}
          >
            <Animated.View style={{
              opacity: buttonAnims[0],
              transform: [{
                translateY: buttonAnims[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            }}>
              <Pressable style={[styles.actionButton, isDark && styles.actionButtonDark]} onPress={handleStartAddSubject}>
                <View style={[styles.actionIconCircle, isDark && styles.actionIconCircleDark]}>
                  <Feather name="book-open" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
                </View>
                <Text style={[styles.actionText, isDark && styles.actionTextDark]}>Add subject</Text>
              </Pressable>
            </Animated.View>
            <Animated.View style={{
              opacity: buttonAnims[1],
              transform: [{
                translateY: buttonAnims[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            }}>
              <Pressable style={[styles.actionButton, isDark && styles.actionButtonDark]} onPress={handleStartAddTask}>
                <View style={[styles.actionIconCircle, isDark && styles.actionIconCircleDark]}>
                  <Feather name="check-circle" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
                </View>
                <Text style={[styles.actionText, isDark && styles.actionTextDark]}>Quick task</Text>
              </Pressable>
            </Animated.View>
            <Animated.View style={{
              opacity: buttonAnims[2],
              transform: [{
                translateY: buttonAnims[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            }}>
              <Pressable style={[styles.actionButton, isDark && styles.actionButtonDark]} onPress={handleStartQuickNote}>
                <View style={[styles.actionIconCircle, isDark && styles.actionIconCircleDark]}>
                  <Feather name="edit-3" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
                </View>
                <Text style={[styles.actionText, isDark && styles.actionTextDark]}>Quick note</Text>
              </Pressable>
            </Animated.View>
            {nextClassState?.state === 'current' ? (
              <Animated.View style={{
                opacity: buttonAnims[3],
                transform: [{
                  translateY: buttonAnims[3].interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                }],
              }}>
                <Pressable style={[styles.actionButton, isDark && styles.actionButtonDark]} onPress={() => handleStartSubjectNote(nextClassState.classInfo.id, nextClassState.classInfo.title)}>
                  <View style={[styles.actionIconCircle, isDark && styles.actionIconCircleDark]}>
                    <Feather name="edit-3" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
                  </View>
                  <Text style={[styles.actionText, isDark && styles.actionTextDark]}>Take notes for {subjectLookup[nextClassState.classInfo.id]?.code ?? nextClassState.classInfo.title}</Text>
                </Pressable>
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      ) : null}

      <Animated.View style={[styles.floatingButtonContainer, {
        transform: [{
          scale: buttonScale.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.9],
          })
        }]
      }]}>
        <Pressable style={styles.navAddButton} onPress={isActionSheetOpen ? handleCloseActions : handleOpenActions}>
          <Animated.View style={{
            transform: [{
              rotate: buttonRotate.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '45deg'],
              })
            }]
          }}>
            <Feather name="plus" size={24} color="#f4f7f4" />
          </Animated.View>
        </Pressable>
      </Animated.View>

      </View>

      <AddSubjectScreen visible={isAddSubjectOpen} onClose={handleCancelAddSubject} onSave={handleSaveSubject} />

      {isSubjectDetailOpen && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#f8f7f2',
              zIndex: 20,
              transform: [{
                translateX: subjectDetailSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [500, 0],
                })
              }]
            }
          ]}
        >
          <SubjectDetailScreen 
            subject={selectedSubjectDetail} 
            onBack={handleCloseSubjectDetail} 
            initialTab={subjectDetailInitialTab}
            onUpdate={(updatedSubject) => {
              loadData();
              if (updatedSubject) {
                setSelectedSubjectDetail((prev: any) => ({ ...prev, ...updatedSubject }));
              }
            }}
            onDelete={(deletedTitle) => {
              loadData();
              handleCloseSubjectDetail();
              setToastMessage(`${deletedTitle ?? 'Subject'} deleted successfully`);
              setToastVisible(true);
            }}
            onArchive={(archivedTitle) => {
              loadData();
              handleCloseSubjectDetail();
              setToastMessage(`${archivedTitle ?? 'Subject'} archived`);
              setToastVisible(true);
            }}
            onUnarchive={(unarchivedTitle) => {
              loadData();
              handleCloseSubjectDetail();
              setToastMessage(`${unarchivedTitle ?? 'Subject'} unarchived`);
              setToastVisible(true);
            }}
          />
        </Animated.View>
      )}

      {/* Filter Modal */}
      {isFilterOpen ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 99 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: filterOpacity }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseFilter} />
        </View>
      ) : null}

      {isFilterOpen ? (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.filterPanelWrapper, {
            transform: [{
              translateY: filterSlide.interpolate({
                inputRange: [0, 1],
                outputRange: [screenHeight, 0],
              }),
            }],
          }]}
        >
          <View style={[styles.filterPanel, isDark && styles.filterPanelDark, { maxHeight: screenHeight * 0.8 }]} {...filterPanResponder.panHandlers}>
            <View style={[styles.filterHandle, isDark && styles.filterHandleDark]} />

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => { filterScrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              <Text style={[styles.filterTitle, isDark && styles.filterTitleDark]}>Filter Subjects</Text>

              <Text style={[styles.filterSectionLabel, isDark && styles.filterSectionLabelDark]}>Status</Text>
              <View style={styles.filterOptionsRow}>
                {(['active', 'archived', 'all'] as const).map((type) => {
                  const label = { active: 'Active', archived: 'Archived', all: 'All' }[type];
                  const isSelected = subjectFilter.type === type && subjectFilter.term === null;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.filterChip, isDark && styles.filterChipDark, isSelected && styles.filterChipSelected]}
                      onPress={() => handleSelectFilter({ type, term: null })}
                    >
                      <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark, isSelected && styles.filterChipTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {availableTerms.length > 0 && (
                <>
                  <Text style={[styles.filterSectionLabel, isDark && styles.filterSectionLabelDark]}>Academic Term</Text>
                  <View style={styles.filterOptionsRow}>
                    {availableTerms.map((term) => {
                      const isSelected = subjectFilter.term === term;
                      return (
                        <Pressable
                          key={term}
                          style={[styles.filterChip, isDark && styles.filterChipDark, isSelected && styles.filterChipSelected]}
                          onPress={() => handleSelectFilter({ type: subjectFilter.type, term })}
                        >
                          <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark, isSelected && styles.filterChipTextSelected]}>{term}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}

      {isQuickNoteOpen && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
          <QuickNoteEditor
            subjectId={selectedQuickNote?.subjectId ?? noteEditorSubjectId}
            subjectTitle={selectedQuickNote?.subjectId ? (subjectLookup[selectedQuickNote.subjectId]?.code ?? 'Subject') : noteEditorSubjectId ? (subjectLookup[noteEditorSubjectId]?.code ?? 'Subject') : 'Quick Note'}
            note={selectedQuickNote}
            folderOptions={[]}
            subjectOptions={activeSubjects.map((s) => ({ id: s.id, title: s.title, code: s.code ?? s.title.slice(0, 6).toUpperCase() }))}
            mode={noteEditorMode}
            onClose={handleQuickNoteClose}
            onSave={handleQuickNoteSave}
            onDelete={handleQuickNoteDelete}
          />
        </View>
      )}

      <Animated.View
        pointerEvents={isAllQuickNotesOpen ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: '#f8f7f2',
            zIndex: 25,
            transform: [{
              translateX: allQuickNotesSlideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [500, 0],
              })
            }]
          }
        ]}
      >
        {isAllQuickNotesOpen && (
        <>
          <View style={[styles.allQuickNotesHeader, isDark && { backgroundColor: '#0a1613' }]}>
            <Pressable onPress={handleCloseAllQuickNotes} style={[styles.backButton, isDark && styles.backButtonDark]}>
              <Feather name="arrow-left" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
            </Pressable>
            <Pressable
              style={[styles.backButton, isDark && styles.backButtonDark, { width: undefined, minWidth: 36, height: 40, flexDirection: 'row', gap: 4, paddingHorizontal: 12, borderRadius: 10 }]}
              onPress={handleOpenAllViewModeSheet}
            >
              <Text style={[styles.allQuickNotesTitle, isDark && styles.allQuickNotesTitleDark]}>{allViewMode === 'notes' ? 'Notes' : 'Tasks'}</Text>
              <Feather name="chevron-down" size={14} color={isDark ? '#d7e4dd' : '#111111'} />
            </Pressable>
            <View style={{ width: 26 }} />
          </View>
          <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: isDark ? '#8f9b95' : '#6b746f', textAlign: 'center', paddingHorizontal: 18, paddingBottom: 14 }}>
            {allViewMode === 'notes'
              ? 'All of your notes in one place, search and filter by subject.'
              : 'All of your tasks grouped by overdue, today, and future.'}
          </Text>

          <ScrollView contentContainerStyle={styles.allQuickNotesList}>
            {allViewMode === 'notes' ? (
              (() => {
                const filtered = recentNoteRecords.filter((note) => {
                  if (allNotesFilter === 'quick' && note.subjectId) return false;
                  if (allNotesFilter && allNotesFilter !== 'quick' && note.subjectId !== allNotesFilter) return false;
                  if (allNotesSearch.trim()) {
                    const q = allNotesSearch.toLowerCase();
                    const matchTitle = note.title.toLowerCase().includes(q);
                    const matchBody = note.contentText.toLowerCase().includes(q);
                    if (!matchTitle && !matchBody) return false;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <View style={styles.allQuickNotesEmpty}>
                      <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>No notes found</Text>
                      <Text style={[styles.emptyBody, isDark && styles.emptyBodyDark]}>Try adjusting your search or filter.</Text>
                    </View>
                  );
                }

                return filtered.map((note) => {
                  const isQuick = !note.subjectId;
                  const subject = subjectLookup[note.subjectId];
                  return (
                    <Pressable key={note.id} style={[styles.allQuickNoteCard, isDark && styles.allQuickNoteCardDark, isQuick && styles.noteCardQuick, isQuick && isDark && { backgroundColor: '#2a3d36', borderColor: '#3a4f47' }]} onPress={() => { handleCloseAllQuickNotes(); handlePressQuickNote(note); }}>
                      <Text style={[styles.noteTitle, isDark && styles.noteTitleDark]}>{note.title || 'Untitled note'}</Text>
                      <Text style={[styles.noteBody, isDark && styles.noteBodyDark]} numberOfLines={1}>{note.contentText}</Text>
                      <View style={styles.noteMetaRow}>
                        <Text style={[styles.noteDate, isDark && styles.noteDateDark]}>{formatNoteDate(note.updatedAt)}</Text>
                        <Text style={[styles.noteOrigin, isDark && styles.noteOriginDark]}>{isQuick ? 'Quick note' : subject ? subject.code : 'Subject'}</Text>
                      </View>
                    </Pressable>
                  );
                });
              })()
            ) : (
              (() => {
                const overdue = overviewSortedOverdue;
                const today = overviewSortedToday;
                const future = overviewSortedFuture;
                const completed = allNotesSearch.trim() && allViewMode === 'tasks'
                  ? completedOccurrences.filter(({ task }) => task.title.toLowerCase().includes(allNotesSearch.toLowerCase()))
                  : completedOccurrences;
                const hasAny = overdue.length > 0 || today.length > 0 || future.length > 0 || completed.length > 0;

                if (!hasAny) {
                  return (
                    <View style={styles.allQuickNotesEmpty}>
                      <Text style={[styles.emptyTitle, isDark && styles.emptyTitleDark]}>No tasks found</Text>
                      <Text style={[styles.emptyBody, isDark && styles.emptyBodyDark]}>Complete all your pending tasks.</Text>
                    </View>
                  );
                }

                const renderTaskCard = (task: TaskRecord) => {
                  const occDate = task.nextOccurrenceDate;
                  const due = new Date(occDate);
                  const dueLabel = due.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                  const isRecurring = task.repeatType && task.repeatType !== 'none';
                  const canComplete = !isRecurring || (isSameCalendarDay(occDate, Date.now()) || occDate < Date.now());
                  const isTimeOverdue = task.startDate ? occDate < Date.now() : false;
                  const subject = task.subjectId ? subjectLookup[task.subjectId] : null;
                  return (
                    <CardScale
                      key={task.id}
                      onPress={() => handleOpenTaskEdit(task)}
                      onLongPress={() => handleOpenTaskDetail(task)}
                      style={[styles.taskCard, isDark && styles.taskCardDark]}
                    >
                      {canComplete ? (
                        <Pressable
                          style={styles.taskCheckbox}
                          onPress={() => void handleCompleteTask(task)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons name="circle-outline" size={22} color={isDark ? '#6e7b74' : '#a0aba5'} />
                        </Pressable>
                      ) : (
                        <View style={styles.taskCheckbox}>
                          <Feather name="lock" size={15} color={isDark ? '#4a5a52' : '#c9cdc9'} />
                        </View>
                      )}
                      <View style={styles.taskTextWrapper}>
                        <Text style={[styles.taskTitle, isDark && styles.taskTitleDark]} numberOfLines={1}>{task.title}</Text>
                        {task.startDate ? (
                        <View style={styles.taskDueDateRow}>
                          <Text style={[styles.taskDueDateText, isDark && styles.taskDueDateTextDark, isTimeOverdue && { color: '#BA1A1A' }]} numberOfLines={1}>
                            {dueLabel}
                          </Text>
                          <View style={styles.repeatBadge}>
                            {isRecurring ? (
                              <Feather name="repeat" size={12} color={isDark ? '#6e7b74' : '#8f968f'} style={task.reminderMinutes != null ? { marginRight: 4 } : undefined} />
                            ) : null}
                            {task.reminderMinutes != null ? (
                              <Feather name="bell" size={12} color={isDark ? '#6e7b74' : '#8f968f'} />
                            ) : null}
                            {subject ? (
                              <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 16, color: isDark ? '#6e7b74' : '#6b746f', marginLeft: 6, lineHeight: 12, marginRight: 6 }}>·</Text>
                            ) : null}
                            {subject ? (
                              <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: isDark ? '#6e7b74' : '#6b746f' }}>{subject.code ?? subject.title}</Text>
                            ) : null}
                          </View>
                        </View>
                        ) : null}
                      </View>
                      {task.priority ? (
                        <MaterialIcons name="flag" size={22} color={task.priority === 'high' ? '#d1453b' : '#e88d3f'} style={{ marginLeft: 12 }} />
                      ) : null}
                    </CardScale>
                  );
                };

                const renderSection = (title: string, tasks: TaskRecord[]) => {
                  if (tasks.length === 0) return null;
                  const isExpanded = expandedSections[title] ?? true;
                  return (
                    <View key={title} style={{ marginBottom: 8 }}>
                      <Pressable onPress={() => toggleSection(title)} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
                        <Text style={[styles.filterSectionLabel, isDark && styles.filterSectionLabelDark, { color: title === 'Overdue' ? '#BA1A1A' : isDark ? '#8f9b95' : '#6b746f', flex: 1 }]}>{title}</Text>
                        <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={isDark ? '#6e7b74' : '#6b746f'} style={{ marginLeft: 6 }} />
                      </Pressable>
                      {isExpanded ? tasks.map(renderTaskCard) : null}
                    </View>
                  );
                };

                return (
                  <>
                    {renderSection('Overdue', overdue)}
                    {renderSection('Today', today)}
                    {renderSection('Future', future)}
                    {completed.length > 0 && (() => {
                      const isExpanded = expandedSections['Completed'] ?? false;
                      return (
                      <View style={{ marginBottom: 8 }}>
                        <Pressable onPress={() => toggleSection('Completed')} style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
                          <Text style={[styles.filterSectionLabel, isDark && styles.filterSectionLabelDark, { color: isDark ? '#6e7b74' : '#8f968f', flex: 1 }]}>COMPLETED</Text>
                          <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginLeft: 6 }} />
                        </Pressable>
                        {isExpanded ? completed.map(({ task, completion }) => {
                          const isRecurring = task.repeatType && task.repeatType !== 'none';
                          const canUncomplete = isSameCalendarDay(completion.completedAt, Date.now());
                          const due = new Date(completion.occurrenceDate);
                          const dueLabel = due.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                          const subject = task.subjectId ? subjectLookup[task.subjectId] : null;
                          return (
                            <CardScale
                              key={completion.id}
                              onPress={() => handleOpenTaskEdit(task)}
                              onLongPress={() => handleOpenTaskDetail(task, completion.occurrenceDate)}
                              style={[styles.taskCard, isDark && styles.taskCardDark, { opacity: 0.7 }]}
                            >
                              <View style={styles.taskCheckbox}>
                                {canUncomplete ? (
                                  <Pressable
                                    onPress={() => void handleUncompleteTask(task)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Feather name="rotate-ccw" size={16} color={isDark ? '#6e7b74' : '#8f968f'} />
                                  </Pressable>
                                ) : (
                                  <Feather name="lock" size={14} color={isDark ? '#4a5a52' : '#c9cdc9'} />
                                )}
                              </View>
                              <View style={styles.taskTextWrapper}>
                                <Text style={[styles.taskTitle, { color: isDark ? '#6e7b74' : '#8f968f', textDecorationLine: 'line-through' }]} numberOfLines={1}>{task.title}</Text>
                                {task.startDate ? (
                                <View style={styles.taskDueDateRow}>
                                  <Text style={[styles.taskDueDateText, { color: isDark ? '#6e7b74' : '#8f968f' }]} numberOfLines={1}>{dueLabel}</Text>
                                  {isRecurring ? (
                                    <Text style={[styles.taskDueDateText, { color: isDark ? '#6e7b74' : '#8f968f', marginLeft: 6 }]} numberOfLines={1}>
                                      {canUncomplete ? '(Completed today)' : '(Completed)'}
                                    </Text>
                                  ) : null}
                                  <View style={styles.repeatBadge}>
                                    {isRecurring ? (
                                      <Feather name="repeat" size={12} color={isDark ? '#6e7b74' : '#8f968f'} style={task.reminderMinutes != null ? { marginRight: 4 } : undefined} />
                                    ) : null}
                                    {task.reminderMinutes != null ? (
                                      <Feather name="bell" size={12} color={isDark ? '#6e7b74' : '#8f968f'} />
                                    ) : null}
                                    {subject ? (
                                      <Text style={{ fontFamily: 'Manrope_700Bold', fontSize: 16, color: isDark ? '#6e7b74' : '#8f968f', marginLeft: 6, lineHeight: 12, marginRight: 6 }}>·</Text>
                                    ) : null}
                                    {subject ? (
                                      <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: isDark ? '#6e7b74' : '#8f968f' }}>{subject.code ?? subject.title}</Text>
                                    ) : null}
                                  </View>
                                </View>
                                ) : null}
                              </View>
                              {task.priority ? (
                                <MaterialIcons name="flag" size={22} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginLeft: 12 }} />
                              ) : null}
                            </CardScale>
                          );
                        }) : null}
                      </View>
                    );
                    })()}
                  </>
                );
              })()
            )}
          </ScrollView>

          <View style={[styles.allNotesSearchDock, { bottom: keyboardHeight > 0 ? keyboardHeight + 32 : (Platform.OS === 'ios' ? 34 : 20) }]}>
            <View style={styles.allNotesSearchPill}>
              <Feather name="search" size={16} color="#eef6f1" />
              <TextInput
                value={allNotesSearch}
                onChangeText={setAllNotesSearch}
                placeholder={allViewMode === 'notes' ? 'Search notes...' : 'Search tasks...'}
                placeholderTextColor="rgba(238,246,241,0.5)"
                style={styles.allNotesSearchInput}
                returnKeyType="search"
              />
              {allNotesSearch.length > 0 && (
                <Pressable onPress={() => setAllNotesSearch('')} hitSlop={8}>
                  <Feather name="x" size={16} color="#eef6f1" />
                </Pressable>
              )}
            </View>
            {allViewMode === 'notes' && (
              <Pressable
                style={styles.allNotesFilterButton}
                onPress={handleOpenNoteFilter}
              >
                <Feather name="sliders" size={18} color={allNotesFilter !== null ? '#FFD666' : '#eef6f1'} />
              </Pressable>
            )}
          </View>
        </>
        )}
      </Animated.View>

      {isAllViewModeSheetOpen ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 161 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: allViewModeSheetSlide.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseAllViewModeSheet} />
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.taskFormPanelWrapper,
              {
                transform: [{
                  translateY: allViewModeSheetSlide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [screenHeight, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={[styles.panel, isDark && styles.panelDark, { maxHeight: screenHeight * 0.5 }]} {...allViewModeSheetPanResponder.panHandlers}>
              <View style={[styles.handle, isDark && styles.handleDark]} />
              <View style={{ backgroundColor: isDark ? '#0f201b' : '#ffffff', borderRadius: 20, overflow: 'hidden', ...shadowLg, marginBottom: 24 }}>
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}
                  onPress={() => handleSelectAllViewMode('notes')}
                >
                  <Feather name="file-text" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#d7e4dd' : '#1e2b26', paddingVertical: 14 }}>Notes</Text>
                  {allViewMode === 'notes' && <Feather name="check" size={20} color="#3d6657" />}
                </Pressable>
                <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                <Pressable
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}
                  onPress={() => handleSelectAllViewMode('tasks')}
                >
                  <Feather name="check-square" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
                  <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#d7e4dd' : '#1e2b26', paddingVertical: 14 }}>Tasks</Text>
                  {allViewMode === 'tasks' && <Feather name="check" size={20} color="#3d6657" />}
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </View>
      ) : null}

      {isNoteFilterOpen ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 99 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: noteFilterOpacity }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseNoteFilter} />
        </View>
      ) : null}

      {isNoteFilterOpen ? (
        <Animated.View
          style={[styles.filterPanelWrapper, {
            bottom: 0,
            transform: [{
              translateY: noteFilterSlide.interpolate({
                inputRange: [0, 1],
                outputRange: [screenHeight, 0],
              }),
            }],
          }]}
        >
          <View style={[styles.filterPanel, isDark && styles.filterPanelDark, { maxHeight: screenHeight * 0.6 }]} {...noteFilterPanResponder.panHandlers}>
            <View style={[styles.filterHandle, isDark && styles.filterHandleDark]} />

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => { noteFilterScrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              <Text style={[styles.filterTitle, isDark && styles.filterTitleDark]}>Filter Notes</Text>

              <Text style={[styles.filterSectionLabel, isDark && styles.filterSectionLabelDark]}>Type</Text>
              <View style={styles.filterOptionsRow}>
                {(['all', 'quick'] as const).map((type) => {
                  const label = { all: 'All Notes', quick: 'Quick notes' }[type];
                  const isSelected = (type === 'all' && allNotesFilter === null) || allNotesFilter === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.filterChip, isDark && styles.filterChipDark, isSelected && styles.filterChipSelected]}
                      onPress={() => handleSelectNoteFilter(type === 'all' ? null : type)}
                    >
                      <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark, isSelected && styles.filterChipTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {(() => {
                const subjectIds = [...new Set(recentNoteRecords.filter((n) => n.subjectId).map((n) => n.subjectId))];
                const subjects = subjectIds.map((id) => ({ id, info: subjectLookup[id] })).filter((s) => s.info);
                if (subjects.length === 0) return null;
                return (
                  <>
                    <Text style={[styles.filterSectionLabel, isDark && styles.filterSectionLabelDark]}>Subject</Text>
                    <View style={styles.filterOptionsRow}>
                      {subjects.map(({ id, info }) => {
                        const isSelected = allNotesFilter === id;
                        return (
                          <Pressable
                            key={id}
                            style={[styles.filterChip, isDark && styles.filterChipDark, isSelected && styles.filterChipSelected]}
                            onPress={() => handleSelectNoteFilter(isSelected ? null : id)}
                          >
                            <Text style={[styles.filterChipText, isDark && styles.filterChipTextDark, isSelected && styles.filterChipTextSelected]}>{info.code}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                );
              })()}
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}

      <TaskEditModal
        visible={isTaskEditOpen}
        task={editingTaskForEdit}
        subjectOptions={activeSubjects.map((s) => ({ id: s.id, title: s.title, code: s.code ?? '' }))}
        onClose={handleCloseTaskEdit}
        onSaved={handleSaveTaskEdit}
        onError={(msg) => { setToastMessage(msg); setToastVisible(true); }}
      />

      <CreateTaskModal
        visible={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        onCreated={handleTaskCreated}
        onError={(msg) => { setToastMessage(msg); setToastVisible(true); }}
      />

      {isTaskDetailOpen && detailTask ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 161 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: taskDetailOpacity }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTaskDetail} />
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.taskFormPanelWrapper,
              {
                zIndex: 161,
                transform: [{
                  translateY: taskDetailSlide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [screenHeight, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={[styles.panel, isDark && styles.panelDark, { maxHeight: screenHeight * 0.8 }]} {...taskDetailPanResponder.panHandlers}>
              <View style={[styles.handle, isDark && styles.handleDark]} />
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
                onScroll={(e) => { taskDetailScrollYRef.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                  <View style={{ backgroundColor: isDark ? '#0f201b' : '#ffffff', borderRadius: 20, overflow: 'hidden', ...shadowLg, marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}>
                    <Feather name="check-square" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
                    <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#d7e4dd' : '#1e2b26', paddingVertical: 14 }}>{detailTask.title}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                  <Pressable
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}
                    onPress={() => {
                      const sub = dbSubjects.find((s) => s.id === detailTask.subjectId);
                      if (sub) handleOpenDetailTaskSubject(sub, detailTask.id);
                    }}
                  >
                    <Feather name="book-open" size={16} color={isDark ? '#6e7b74' : '#5c6762'} style={{ marginRight: 10 }} />
                    <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#6e7b74' : '#5c6762', paddingVertical: 14 }}>
                      {dbSubjects.find((s) => s.id === detailTask.subjectId)?.title ?? 'Unknown'}
                    </Text>
                    <Feather name="arrow-right" size={18} color={isDark ? '#6e7b74' : '#9aa09a'} />
                  </Pressable>
                  {detailTask.description ? (
                    <>
                      <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, minHeight: 88 }}>
                        <Feather name="align-left" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10, marginTop: 16 }} />
                        <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#d7e4dd' : '#1e2b26', paddingVertical: 14 }}>{detailTask.description}</Text>
                      </View>
                    </>
                  ) : null}
                  {detailTask.startDate ? (
                    <>
                      <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}>
                        <Feather name="calendar" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
                        <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#d7e4dd' : '#1e2b26', paddingVertical: 14 }}>
                          {new Date(detailTask.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' '}
                          {new Date(detailTask.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                      </View>
                    </>
                  ) : null}
                  {detailTask.priority ? (
                    <>
                      <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}>
                        <MaterialIcons name="flag" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
                        <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#d7e4dd' : '#1e2b26', paddingVertical: 14 }}>
                          {detailTask.priority === 'high' ? 'High' : 'Low'} Priority
                        </Text>
                      </View>
                    </>
                  ) : null}
                  {detailTask.category ? (
                    <>
                      <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}>
                        <Feather name="folder" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
                        <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#d7e4dd' : '#1e2b26', paddingVertical: 14 }}>{detailTask.category}</Text>
                      </View>
                    </>
                  ) : null}
                  {detailTask.repeatType !== 'none' ? (
                    <>
                      <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}>
                        <Feather name="repeat" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
                        <Text style={{ flex: 1, fontFamily: 'Manrope_500Medium', fontSize: 16, color: isDark ? '#d7e4dd' : '#1e2b26', paddingVertical: 14 }}>
                          {detailTask.repeatType === 'daily' ? 'Daily' : detailTask.repeatType === 'weekly' ? `Weekly${detailTask.repeatDays && detailTask.repeatDays.length > 0 ? ` (${detailTask.repeatDays.join(', ')})` : ''}` : detailTask.repeatType === 'monthly' ? 'Monthly' : ''}
                        </Text>
                      </View>
                    </>
                  ) : null}
                  {detailTask.repeatType !== 'none' ? (
                    <>
                      <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}
                        onPress={() => {
                          void handleDeleteTaskOccurrence(detailTask, detailTaskOccurrenceDate ?? detailTask.nextOccurrenceDate);
                          closeTaskDetail();
                        }}
                      >
                        <Feather name="trash-2" size={16} color="#b42318" style={{ marginRight: 10 }} />
                        <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 16, color: '#b42318' }}>Delete this occurrence only</Text>
                      </Pressable>
                      <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}
                        onPress={() => {
                          void handleDeleteTask(detailTask.id);
                          closeTaskDetail();
                        }}
                      >
                        <Feather name="trash-2" size={16} color="#b42318" style={{ marginRight: 10 }} />
                        <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 16, color: '#b42318' }}>Delete entire series</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={{ height: 1, backgroundColor: isDark ? '#2a3d36' : '#f0f0ed' }} />
                      <Pressable
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 }}
                        onPress={() => {
                          void handleDeleteTask(detailTask.id);
                          closeTaskDetail();
                        }}
                      >
                        <Feather name="trash-2" size={16} color="#b42318" style={{ marginRight: 10 }} />
                        <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 16, color: '#b42318' }}>Delete Task</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      ) : null}

      <DynamicIslandToast 
        visible={toastVisible} 
        message={toastMessage} 
        onHide={() => setToastVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
    backgroundColor: '#000', // To make the scale-down look good
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0,
    backgroundColor: '#f8f7f2', // The original app background
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#f8f7f2',
    zIndex: 10,
  },
  headerSpacer: {
    width: 28,
    height: 28,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fcfbfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f2f1ee',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 140,
  },
  scrollView: {
    flex: 1,
    overflow: 'hidden', // Changed from visible to ensure content stays within the scroll area
  },
  dateText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 1.4,
    color: '#6b746f',
    marginBottom: 6,
  },
  titleBlock: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  greetingAccent: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: '#5a8f78',
    alignSelf: 'stretch',
  },
  greetingContent: {
    flex: 1,
    gap: 2,
    justifyContent: 'center',
  },
  greetingLine2: {
    color: '#1e2b26',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    lineHeight: 21,
  },
  subtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#6b746f',
  },
  nextClassCard: {
    borderRadius: 26,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 28,
    ...shadowLg,
  },
  nextClassHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  nextClassLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextClassLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 1.3,
    color: '#d3e3dc',
  },
  nextClassMeta: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#91a39a',
  },
  nextClassTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 22,
    color: '#f1f6f2',
    marginBottom: 18,
  },
  nextClassDivider: {
    height: 1,
    backgroundColor: '#2f4440',
    marginBottom: 14,
  },
  nextClassMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextClassHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  nextClassHintText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#a7b7af',
  },
  nextClassHintMeta: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#d3e3dc',
  },
  nextClassMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextClassMetaText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#90a39a',
  },
  nextClassEmpty: {
    gap: 6,
  },
  nextClassEmptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#f1f6f2',
  },
  nextClassEmptyBody: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#a7b7af',
  },
  recentNotesSection: {
    marginBottom: 26,
  },
  recentNotesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  recentNotesTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
  },
  urgentTasksSection: {
    marginBottom: 26,
  },
  sectionHeaderTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  sectionEmptyState: {
    backgroundColor: '#f3f2ee',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    alignItems: 'center',
  },
  sectionEmptyIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  sectionEmptyTitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#9aa09a',
    marginBottom: 0,
  },
  sectionEmptyBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#6b746f',
    textAlign: 'center',
    marginBottom: 16,
  },
  allQuickNotesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) + 8 : 8,
    paddingBottom: 8,
    minHeight: 62,
  },
  allQuickNotesTitle: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#111111',
  },
  allQuickNotesDivider: {
    height: 1,
    backgroundColor: '#d9d6ce',
  },
  allQuickNotesList: {
    padding: 16,
    paddingBottom: 100,
    gap: 8,
  },
  allQuickNotesEmpty: {
    paddingTop: 40,
    alignItems: 'center',
  },
  allQuickNoteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#efede8',
    ...shadowLg,
  },
  allNotesSearchDock: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: Platform.OS === 'ios' ? 34 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  allNotesSearchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c2f2a',
    borderRadius: 26,
    height: 64,
    paddingHorizontal: 20,
    gap: 12,
    ...shadowLgDark,
  },
  allNotesSearchInput: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#eef6f1',
    paddingVertical: 0,
  },
  allNotesFilterButton: {
    width: 64,
    height: 64,
    borderRadius: 26,
    backgroundColor: '#1c2f2a',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLgDark,
  },
  emptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#2a332e',
    marginBottom: 6,
  },
  emptyBody: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#6b746f',
  },
  quickNoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: '#f3f2ee',
  },
  quickNoteButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#2b4a3f',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#efede8',
    ...shadowLg,
  },
  taskCheckbox: {
    marginRight: 14,
  },
  taskTextWrapper: {
    flex: 1,
    paddingRight: 8,
  },
  taskTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#1e2b26',
    marginBottom: 4,
  },
  taskDueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskDueDateText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#6b746f',
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  noteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#efede8',
    ...shadowLg,
  },
  noteCardQuick: {
    backgroundColor: '#fef3c7',
    borderColor: 'rgba(0,0,0,0.04)',
  },
  noteTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#2a332e',
    marginBottom: 2,
  },
  noteBody: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#6b746f',
    marginBottom: 4,
  },
  noteDate: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: '#9aa09a',
  },
  noteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  noteOrigin: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: '#9aa09a',
  },
  navDock: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navPill: {
    flex: 1,
    backgroundColor: '#1c2f2a',
    borderRadius: 26,
    height: 64,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
    ...shadowLgDark,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemInner: {
    width: '100%',
    maxWidth: 92,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 6,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#2c3b35',
  },
  navItemActive: {
    backgroundColor: '#2c3b35',
  },
  navLabel: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 11,
    color: '#6b7470',
  },
  navLabelActive: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: '#d7e4dd',
  },
  navAddButton: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#3d6657', // Balanced vibrant green
    alignItems: 'center',
    justifyContent: 'center',
    // Enhanced Premium iOS Glow
    shadowColor: '#3d6657',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  floatingButtonContainer: {
    position: 'absolute',
    right: 18,
    bottom: 20,
    zIndex: 20,
    ...shadowLgDark,
  },
  actionSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 15,
  },
  actionSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 7, 0.2)',
  },
  actionSheetPressTarget: {
    ...StyleSheet.absoluteFillObject,
  },
  actionSheetPanel: {
    paddingHorizontal: 18,
    paddingBottom: 110, // Just above the FAB
    gap: 12,
    alignItems: 'flex-end', // Aligns to the right side above FAB
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end', // Ensures it only takes minimum width
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    ...shadowLg,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e9f3ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#1e2b26',
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 7, 0.3)',
    zIndex: 99,
  },
  filterPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  filterPanel: {
    backgroundColor: '#f8f7f2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    ...shadowLg,
  },
  filterHandle: {
    width: 68,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e3e0d8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#101413',
    letterSpacing: -0.3,
    marginBottom: 16,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  filterSectionLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#6b746f',
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#efede8',
  },
  filterChipSelected: {
    backgroundColor: '#0f2a24',
    borderColor: '#0f2a24',
  },
  filterChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#2a332e',
  },
  filterChipTextSelected: {
    color: '#ffffff',
  },
  panel: {
    backgroundColor: '#f8f7f2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    ...shadowLg,
  },
  handle: {
    width: 68,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e3e0d8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  taskFormBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 7, 0.3)',
    zIndex: 160,
  },
  taskFormPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    zIndex: 161,
    justifyContent: 'flex-end',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fcfbfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f2f1ee',
  },
  mainContentDark: {
    backgroundColor: '#0a1613',
  },
  headerRowDark: {
    backgroundColor: '#0a1613',
  },
  headerIconButtonDark: {
    backgroundColor: '#0f201b',
    borderColor: '#2a3d36',
  },
  greetingLine2Dark: { color: '#d7e4dd' },
  subtitleDark: { color: '#8f9b95' },
  dateTextDark: { color: '#8f9b95' },
  sectionHeaderTitleDark: { color: '#d7e4dd' },
  cardDark: { backgroundColor: '#0f201b' },
  sectionEmptyStateDark: { backgroundColor: '#0f201b' },
  sectionEmptyIconWrapperDark: { backgroundColor: '#2a3d36', borderColor: 'rgba(255,255,255,0.04)' },
  sectionEmptyTitleDark: { color: '#7a8a82' },
  sectionEmptyBodyDark: { color: '#6e7b74' },
  emptyTitleDark: { color: '#d7e4dd' },
  emptyBodyDark: { color: '#8f9b95' },
  quickNoteButtonDark: { backgroundColor: '#0f201b' },
  quickNoteButtonTextDark: { color: '#8f9b95' },
  taskCardDark: { backgroundColor: '#0f201b', borderColor: '#2a3d36' },
  taskTitleDark: { color: '#d7e4dd' },
  taskDueDateTextDark: { color: '#8f9b95' },
  noteCardDark: { backgroundColor: '#0f201b', borderColor: '#2a3d36' },
  noteTitleDark: { color: '#d7e4dd' },
  noteBodyDark: { color: '#8f9b95' },
  noteDateDark: { color: '#6e7b74' },
  noteOriginDark: { color: '#6e7b74' },
  actionButtonDark: { backgroundColor: '#0f201b' },
  actionIconCircleDark: { backgroundColor: '#2a3d36' },
  actionTextDark: { color: '#d7e4dd' },
  filterPanelDark: { backgroundColor: '#0a1613' },
  filterHandleDark: { backgroundColor: '#2a3d36' },
  filterTitleDark: { color: '#d7e4dd' },
  filterSectionLabelDark: { color: '#8f9b95' },
  filterChipDark: { backgroundColor: '#0f201b', borderColor: '#2a3d36' },
  filterChipTextDark: { color: '#d7e4dd' },
  panelDark: { backgroundColor: '#0a1613' },
  handleDark: { backgroundColor: '#2a3d36' },
  allQuickNotesTitleDark: { color: '#d7e4dd' },
  allQuickNotesDividerDark: { backgroundColor: '#2a3d36' },
  allQuickNoteCardDark: { backgroundColor: '#0f201b', borderColor: '#2a3d36' },
  backButtonDark: { backgroundColor: '#0f201b', borderColor: '#2a3d36' },
});
