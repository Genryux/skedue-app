import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { springModalSlide, useDragToClose } from '../../ui/tokens/animations';
import { getAllNotes, getAllTasks, getMetaValue, getNotesBySubjectId, getSubjects, insertSubject, insertNote, updateNote, deleteNote, findRecentMatchingNote, setMetaValue, updateSubject, completeTaskOccurrence, type SubjectRecord, type NoteRecord, type TaskRecord } from '../../data/local/db';
import { shadowLg, shadowLgDark } from '../../ui/tokens/shadows';
import { parseTimeToMinutes } from '../../utils/timeUtils';
import { calculateNextOccurrenceDate, isSameCalendarDay, END_OF_TIME } from '../../utils/recurrenceUtils';
import ScheduleScreen from '../schedule/ScheduleScreen';
import AddSubjectScreen from '../subjects/AddSubjectScreen';
import SubjectsScreen from '../subjects/SubjectsScreen';
import DynamicIslandToast from '../../ui/DynamicIslandToast';
import SubjectDetailScreen from '../subjects/SubjectDetailScreen';

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
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'subjects'>('home');
  const [dbSubjects, setDbSubjects] = useState<SubjectRecord[]>([]);
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isSubjectDetailOpen, setIsSubjectDetailOpen] = useState(false);
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState<any>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<{ type: 'active' | 'archived' | 'all'; term: string | null }>({ type: 'active', term: null });
  const [isAllQuickNotesOpen, setIsAllQuickNotesOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(18)).current;
  const buttonRotate = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;

  // Transitions
  const subjectSlideAnim = useRef(new Animated.Value(0)).current; // 0: hidden, 1: visible
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
  const [recentNoteRecords, setRecentNoteRecords] = useState<NoteRecord[]>([]);
  const [selectedQuickNote, setSelectedQuickNote] = useState<NoteRecord | null>(null);
  const [noteEditorMode, setNoteEditorMode] = useState<'quick' | 'full'>('quick');
  const [allNotesSearch, setAllNotesSearch] = useState('');
  const [allNotesFilter, setAllNotesFilter] = useState<string | null>(null); // null = all, 'quick' = quick notes, subjectId = that subject
  const [isNoteFilterOpen, setIsNoteFilterOpen] = useState(false);
  const noteFilterSlide = useRef(new Animated.Value(0)).current;
  const noteFilterOpacity = useRef(new Animated.Value(0)).current;

  const loadRecentNotes = async () => {
    try {
      const notes = await getAllNotes();
      const activeSubjectIds = new Set(dbSubjects.filter((s) => !s.isArchived).map((s) => s.id));
      const filtered = notes.filter((n) => !n.subjectId || activeSubjectIds.has(n.subjectId));
      setRecentNoteRecords(filtered);
    } catch (err) {
      console.warn('Failed to load notes', err);
    }
  };

  const loadPendingTasks = async () => {
    try {
      const tasks = await getAllTasks();
      const activeSubjectIds = new Set(dbSubjects.filter((s) => !s.isArchived).map((s) => s.id));
      const pending = tasks.filter(
        (t) => t.nextOccurrenceDate < END_OF_TIME && activeSubjectIds.has(t.subjectId)
      ).sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate);
      setPendingTasks(pending);
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
      await completeTaskOccurrence(task.id, occurrenceDate, next);
      setPendingTasks((current) =>
        current
          .map((t) => (t.id === task.id ? { ...t, nextOccurrenceDate: next } : t))
          .filter((t) => t.nextOccurrenceDate < END_OF_TIME)
          .sort((a, b) => a.nextOccurrenceDate - b.nextOccurrenceDate)
      );
    } catch (error) {
      console.warn('Failed to complete task', error);
    }
  };

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
    let timeGreeting = "Good Morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good Afternoon";
    if (hour >= 17 && hour < 22) timeGreeting = "Good Evening";
    if (hour >= 22 || hour < 5) timeGreeting = "Working Late";

    const todayDay = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    const todaySubjects = activeSubjects.filter(s => (s.days ?? []).some(d => DAY_MAP[d] === todayDay));
    
    if (todaySubjects.length === 0) {
      return `${timeGreeting}! No classes today.`;
    }

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
      return "You're in class right now.";
    }

    if (remainingSubjects.length === 0) {
      return "You're all done for today!";
    }

    if (remainingSubjects.length === 1) {
      return `${timeGreeting}! Just one more class.`;
    }

    return `${timeGreeting}! You have ${remainingSubjects.length} classes left.`;
  }, [now, dbSubjects]);

  const handleOpenActions = () => {
    setIsActionSheetOpen(true);
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
    ]).start(({ finished }) => {
      if (finished) {
        setIsActionSheetOpen(false);
      }
    });
  };

  const handleStartAddSubject = () => {
    resetPlusButton();
    setIsAddSubjectOpen(true);

    Animated.spring(subjectSlideAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
      mass: 1,
    }).start(({ finished }) => {
      if (finished) {
        setIsActionSheetOpen(false);
      }
    });
  };

  const handleCancelAddSubject = () => {
    Animated.timing(subjectSlideAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsAddSubjectOpen(false);
      }
    });
  };

  const handlePressSubject = (subject: any) => {
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

  const handleCloseAllQuickNotes = () => {
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
      
      Animated.timing(subjectSlideAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsAddSubjectOpen(false);
        }
      });
      
      // Trigger success toast
      setToastMessage(`${savedSubject.title} created successfully`);
      setToastVisible(true);
    } catch (error) {
      console.warn('Failed to save subject', error);
    }
  };

  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);

  const handleStartQuickNote = () => {
    resetPlusButton();
    setIsActionSheetOpen(false);
    setSelectedQuickNote(null);
    setNoteEditorMode('quick');
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

  // Intercept hardware back to close overlays
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isAllQuickNotesOpen) {
        handleCloseAllQuickNotes();
        return true;
      }
      if (isQuickNoteOpen) {
        handleQuickNoteClose();
        return true;
      }
      if (isAddSubjectOpen) {
        handleCancelAddSubject();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [isAllQuickNotesOpen, isQuickNoteOpen, isAddSubjectOpen, handleCloseAllQuickNotes, handleQuickNoteClose, handleCancelAddSubject]);

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
      tasksCount: 0,
      notesCount: noteCounts[s.id] ?? 0,
    }));
  }, [filteredDbSubjects, noteCounts]);

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerSpacer} />
          <View style={styles.headerIcons}>
            <Pressable style={styles.headerIconButton}>
              <Feather name="bell" size={18} color="#1e2b26" />
            </Pressable>
            <Pressable style={styles.headerIconButton}>
              <Feather name="settings" size={18} color="#1e2b26" />
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
          <ScheduleScreen subjects={activeSubjects} />
        ) : (
          <>
            <View style={styles.titleBlock}>
              <Text style={styles.dateText}>{dateLabel}</Text>
              <Text style={styles.title}>{dynamicGreeting}</Text>
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

                <View style={styles.pendingTasksSection}>
                  <View style={styles.pendingTasksHeaderRow}>
                    <Text style={styles.pendingTasksTitle}>Pending Tasks</Text>
                    <Pressable style={styles.headerIconButton}>
                      <Feather name="more-horizontal" size={16} color="#6d756f" />
                    </Pressable>
                  </View>

                  {pendingTasks.length === 0 ? (
                    <View style={styles.sectionEmptyState}>
                      <View style={styles.sectionEmptyIconWrapper}>
                        <Feather name="check-circle" size={18} color="#8f968f" />
                      </View>
                      <Text style={styles.sectionEmptyTitle}>No pending tasks</Text>
                    </View>
                  ) : (
                    pendingTasks.map((task) => {
                      const due = new Date(task.nextOccurrenceDate);
                      const dueLabel = due.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      });
                      return (
                        <View key={task.id} style={styles.taskRow}>
                          {(!task.repeatType || task.repeatType === 'none' || isSameCalendarDay(task.nextOccurrenceDate, Date.now()) || task.nextOccurrenceDate < Date.now()) ? (
                            <Pressable
                              style={styles.taskCheckbox}
                              onPress={() => void handleCompleteTask(task)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Feather name="square" size={18} color="#a0aba5" />
                            </Pressable>
                          ) : (
                            <View style={styles.taskCheckbox}>
                              <Feather name="lock" size={14} color="#c9cdc9" />
                            </View>
                          )}
                          <View>
                            <Text style={styles.taskTitle}>{task.title}</Text>
                            <Text style={styles.taskMeta}>{dueLabel}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>

                <View style={styles.recentNotesSection}>
                  <View style={styles.recentNotesHeaderRow}>
                    <Text style={styles.recentNotesTitle}>Recent Notes</Text>
                    <Pressable style={styles.headerIconButton} onPress={handleOpenAllQuickNotes} hitSlop={8}>
                      <Feather name="inbox" size={16} color="#6d756f" />
                    </Pressable>
                  </View>

                  {recentNoteRecords.length === 0 ? (
                    <View style={styles.sectionEmptyState}>
                      <View style={styles.sectionEmptyIconWrapper}>
                        <Feather name="file-text" size={18} color="#8f968f" />
                      </View>
                      <Text style={styles.sectionEmptyTitle}>No notes yet</Text>
                    </View>
                  ) : (
                    recentNoteRecords.slice(0, 4).map((note) => {
                      const isQuick = !note.subjectId;
                      const subject = subjectLookup[note.subjectId];
                      return (
                        <Pressable
                          key={note.id}
                          style={[styles.noteCard, isQuick && styles.noteCardQuick]}
                          onPress={() => handlePressQuickNote(note)}
                        >
                          <Text style={styles.noteTitle}>{note.title || 'Untitled note'}</Text>
                          <Text style={styles.noteBody} numberOfLines={1}>{note.contentText}</Text>
                          <View style={styles.noteMetaRow}>
                            <Text style={styles.noteDate}>{formatNoteDate(note.updatedAt)}</Text>
                            <Text style={styles.noteOrigin}>{isQuick ? 'Quick note' : subject ? subject.code : 'Subject'}</Text>
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
        <View style={styles.navPill}>
          <Pressable style={styles.navItem} onPress={() => setActiveTab('home')}>
            <View style={[styles.navItemInner, activeTab === 'home' ? styles.navItemActive : null]}>
              <Feather name="home" size={18} color={activeTab === 'home' ? '#d7e4dd' : '#5c6762'} />
              <Text style={activeTab === 'home' ? styles.navLabelActive : styles.navLabel}>Home</Text>
            </View>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setActiveTab('schedule')}>
            <View style={[styles.navItemInner, activeTab === 'schedule' ? styles.navItemActive : null]}>
              <Feather name="calendar" size={18} color={activeTab === 'schedule' ? '#d7e4dd' : '#5c6762'} />
              <Text style={activeTab === 'schedule' ? styles.navLabelActive : styles.navLabel}>Schedule</Text>
            </View>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setActiveTab('subjects')}>
            <View style={[styles.navItemInner, activeTab === 'subjects' ? styles.navItemActive : null]}>
              <Feather name="book" size={18} color={activeTab === 'subjects' ? '#d7e4dd' : '#5c6762'} />
              <Text style={activeTab === 'subjects' ? styles.navLabelActive : styles.navLabel}>Subjects</Text>
            </View>
          </Pressable>
        </View>
        <View style={{ width: 64 }} />
      </View>

      {isActionSheetOpen ? (
        <View style={styles.actionSheetOverlay}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: sheetOpacity }]}>
            <BlurView 
              intensity={80} 
              tint="dark" 
              style={StyleSheet.absoluteFill}
              experimentalBlurMethod="none" 
            />
            <View style={styles.actionSheetBackdrop} />
          </Animated.View>
          <Pressable style={styles.actionSheetPressTarget} onPress={handleCloseActions} />
          <Animated.View
            style={[
              styles.actionSheetPanel,
              {
                opacity: sheetOpacity,
                transform: [{ translateY: sheetTranslate }],
              },
            ]}
          >
            <Pressable style={styles.actionButton} onPress={handleStartAddSubject}>
              <View style={styles.actionIconCircle}>
                <Feather name="book-open" size={18} color="#1e2b26" />
              </View>
              <Text style={styles.actionText}>Add subject</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={handleStartQuickNote}>
              <View style={styles.actionIconCircle}>
                <Feather name="edit-3" size={18} color="#1e2b26" />
              </View>
              <Text style={styles.actionText}>Create quick note</Text>
            </Pressable>
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

      {isAddSubjectOpen && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#f8f7f2', zIndex: 20 }]}>
          <Animated.View style={{
            flex: 1,
            transform: [{
              translateY: subjectSlideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [screenHeight, 0],
              })
            }]
          }}>
            <AddSubjectScreen onBack={handleCancelAddSubject} onSave={handleSaveSubject} />
          </Animated.View>
        </View>
      )}

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
        <Animated.View style={[styles.filterBackdrop, { opacity: filterOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseFilter} />
        </Animated.View>
      ) : null}

      {isFilterOpen ? (
        <Animated.View
          style={[styles.filterPanelWrapper, {
            bottom: 0,
            transform: [{
              translateY: filterSlide.interpolate({
                inputRange: [0, 1],
                outputRange: [screenHeight, 0],
              }),
            }],
          }]}
        >
          <View style={[styles.filterPanel, { maxHeight: screenHeight * 0.8 }]} {...filterPanResponder.panHandlers}>
            <View style={styles.filterHandle} />

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => { filterScrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              <Text style={styles.filterTitle}>Filter Subjects</Text>

              <Text style={styles.filterSectionLabel}>Status</Text>
              <View style={styles.filterOptionsRow}>
                {(['active', 'archived', 'all'] as const).map((type) => {
                  const label = { active: 'Active', archived: 'Archived', all: 'All' }[type];
                  const isSelected = subjectFilter.type === type && subjectFilter.term === null;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      onPress={() => handleSelectFilter({ type, term: null })}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {availableTerms.length > 0 && (
                <>
                  <Text style={styles.filterSectionLabel}>Academic Term</Text>
                  <View style={styles.filterOptionsRow}>
                    {availableTerms.map((term) => {
                      const isSelected = subjectFilter.term === term;
                      return (
                        <Pressable
                          key={term}
                          style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                          onPress={() => handleSelectFilter({ type: subjectFilter.type, term })}
                        >
                          <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{term}</Text>
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
            subjectId={selectedQuickNote?.subjectId ?? ''}
            subjectTitle={selectedQuickNote?.subjectId ? (subjectLookup[selectedQuickNote.subjectId]?.code ?? 'Subject') : 'Quick Note'}
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

      {isAllQuickNotesOpen && (
        <Animated.View
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
          <View style={styles.allQuickNotesHeader}>
            <Pressable onPress={handleCloseAllQuickNotes} hitSlop={8}>
              <Feather name="arrow-left" size={26} color="#111111" />
            </Pressable>
            <Text style={styles.allQuickNotesTitle}>All Notes</Text>
            <View style={{ width: 26 }} />
          </View>

          <ScrollView contentContainerStyle={styles.allQuickNotesList}>
            {(() => {
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
                    <Text style={styles.emptyTitle}>No notes found</Text>
                    <Text style={styles.emptyBody}>Try adjusting your search or filter.</Text>
                  </View>
                );
              }

              return filtered.map((note) => {
                const isQuick = !note.subjectId;
                const subject = subjectLookup[note.subjectId];
                return (
                  <Pressable key={note.id} style={[styles.allQuickNoteCard, isQuick && styles.noteCardQuick]} onPress={() => { handleCloseAllQuickNotes(); handlePressQuickNote(note); }}>
                    <Text style={styles.noteTitle}>{note.title || 'Untitled note'}</Text>
                    <Text style={styles.noteBody} numberOfLines={1}>{note.contentText}</Text>
                    <View style={styles.noteMetaRow}>
                      <Text style={styles.noteDate}>{formatNoteDate(note.updatedAt)}</Text>
                      <Text style={styles.noteOrigin}>{isQuick ? 'Quick note' : subject ? subject.code : 'Subject'}</Text>
                    </View>
                  </Pressable>
                );
              });
            })()}
          </ScrollView>

          <View style={[styles.allNotesSearchDock, { bottom: keyboardHeight > 0 ? keyboardHeight + 32 : (Platform.OS === 'ios' ? 34 : 20) }]}>
            <View style={styles.allNotesSearchPill}>
              <Feather name="search" size={16} color="#eef6f1" />
              <TextInput
                value={allNotesSearch}
                onChangeText={setAllNotesSearch}
                placeholder="Search notes..."
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
            <Pressable
              style={styles.allNotesFilterButton}
              onPress={handleOpenNoteFilter}
            >
              <Feather name="sliders" size={18} color={allNotesFilter !== null ? '#FFD666' : '#eef6f1'} />
            </Pressable>
          </View>
        </Animated.View>
      )}

      {isNoteFilterOpen ? (
        <Animated.View style={[styles.filterBackdrop, { opacity: noteFilterOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseNoteFilter} />
        </Animated.View>
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
          <View style={[styles.filterPanel, { maxHeight: screenHeight * 0.6 }]} {...noteFilterPanResponder.panHandlers}>
            <View style={styles.filterHandle} />

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => { noteFilterScrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              <Text style={styles.filterTitle}>Filter Notes</Text>

              <Text style={styles.filterSectionLabel}>Type</Text>
              <View style={styles.filterOptionsRow}>
                {(['all', 'quick'] as const).map((type) => {
                  const label = { all: 'All Notes', quick: 'Quick notes' }[type];
                  const isSelected = (type === 'all' && allNotesFilter === null) || allNotesFilter === type;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                      onPress={() => handleSelectNoteFilter(type === 'all' ? null : type)}
                    >
                      <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{label}</Text>
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
                    <Text style={styles.filterSectionLabel}>Subject</Text>
                    <View style={styles.filterOptionsRow}>
                      {subjects.map(({ id, info }) => {
                        const isSelected = allNotesFilter === id;
                        return (
                          <Pressable
                            key={id}
                            style={[styles.filterChip, isSelected && styles.filterChipSelected]}
                            onPress={() => handleSelectNoteFilter(isSelected ? null : id)}
                          >
                            <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>{info.code}</Text>
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
    gap: 6,
    marginBottom: 16,
  },
  title: {
    color: '#1e2b26',
    fontFamily: 'Manrope_700Bold',
    fontSize: 24,
  },
  subtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#6b746f',
  },
  nextClassCard: {
    borderRadius: 26,
    paddingVertical: 28,
    paddingHorizontal: 24,
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
  pendingTasksSection: {
    marginBottom: 26,
  },
  pendingTasksHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pendingTasksHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pendingTasksTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
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
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
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
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  taskCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#c9c6bf',
  },
  taskTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#2a332e',
    marginBottom: 2,
  },
  taskMeta: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#6b746f',
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
    backgroundColor: 'rgba(5, 8, 7, 0.4)',
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
    bottom: 0,
    zIndex: 100,
  },
  filterPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8f7f2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
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
    fontSize: 20,
    color: '#1e2b26',
    marginBottom: 20,
  },
  filterSectionLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#6b746f',
    letterSpacing: 0.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f0efea',
  },
  filterChipSelected: {
    backgroundColor: '#1c2f2a',
  },
  filterChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#2a332e',
  },
  filterChipTextSelected: {
    color: '#ffffff',
  },
});