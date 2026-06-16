import { BlurView } from 'expo-blur';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SubjectRecord } from '../../data/local/db';
import { getMetaValue, setMetaValue, getAllTasks, getTaskCompletions, getTaskOccurrenceExceptions, deleteTask, completeTaskOccurrence, TaskRecord, TaskCompletionRecord } from '../../data/local/db';
import { shadowLg } from '../../ui/tokens/shadows';
import { springModalSlide } from '../../ui/tokens/animations';
import { parseTimeToMinutes } from '../../utils/timeUtils';
import { calculateNextOccurrenceDate, isSameCalendarDay, getExpandedTasksForRange } from '../../utils/recurrenceUtils';
import { useFocusEffect } from '@react-navigation/native';

const DAY_MAP: Record<string, number> = {
  Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6,
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_H_PADDING = 18;
const DAYS_IN_WEEK = 7;
const DESIRED_GAP = 4;
const DAY_CHIP_SIZE = Math.max(34, Math.min(44, Math.floor((SCREEN_WIDTH - CARD_H_PADDING * 2 - DESIRED_GAP * (DAYS_IN_WEEK - 1)) / DAYS_IN_WEEK)));
const MONTH_CELL_HEIGHT = 44;
const IS_SMALL_SCREEN = SCREEN_WIDTH < 360;

const formatTime = (time: string | null | undefined) => {
  if (!time) return '';
  if (/am|pm/i.test(time)) return time;
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

type ScheduleEntry = {
  id: string;
  startTime: string;
  endTime?: string;
  title: string;
  instructor?: string;
  location?: string;
  kind: 'subject' | 'task';
  isCompleted?: boolean;
  description?: string;
  dueAt?: number;
  priority?: string | null;
  category?: string | null;
  repeatType?: string;
  repeatDays?: string[];
  reminderMinutes?: number | null;
  subjectTitle?: string;
  subjectId?: string;
  taskId?: string;
  occurrenceDate?: number;
};

type ScheduleScreenProps = {
  subjects: SubjectRecord[];
  onToast?: (message: string) => void;
  onOpenSubjectDetail?: (subject: SubjectRecord) => void;
};

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildMonthGrid = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let row: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) row.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) row.push(null);
    weeks.push(row);
  }
  return weeks;
};

export default function ScheduleScreen({ subjects, onToast, onOpenSubjectDetail }: ScheduleScreenProps) {
  const today = new Date();
  const todayKey = getLocalDateKey(today);

  const initialWeekStart = useMemo(() => {
    const day = today.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [today]);

  const [weekStartDate, setWeekStartDate] = useState(initialWeekStart);
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [currentMinutes, setCurrentMinutes] = useState(today.getHours() * 60 + today.getMinutes());
  const [isMonthView, setIsMonthView] = useState(false);
  const [monthDate, setMonthDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [detailEntry, setDetailEntry] = useState<ScheduleEntry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const detailSlide = useRef(new Animated.Value(0)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;

  const [scheduleFilter, setScheduleFilter] = useState<{ subjects: boolean; tasks: boolean }>({ subjects: true, tasks: true });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterSlide = useRef(new Animated.Value(0)).current;
  const filterOpacity = useRef(new Animated.Value(0)).current;

  const [dbTasks, setDbTasks] = useState<TaskRecord[]>([]);
  const [taskCompletions, setTaskCompletions] = useState<TaskCompletionRecord[]>([]);
  const [deletedOccurrenceKeys, setDeletedOccurrenceKeys] = useState<Set<string>>(new Set());

  const loadTasks = useCallback(async () => {
    try {
      const tasks = await getAllTasks();
      setDbTasks(tasks);
      const completions = await getTaskCompletions(tasks.map((t) => t.id));
      setTaskCompletions(completions);
      const exceptions = await getTaskOccurrenceExceptions(tasks.map((t) => t.id));
      setDeletedOccurrenceKeys(new Set(exceptions.filter((e) => e.status === 'deleted').map((e) => `${e.taskId}-${e.occurrenceDate}`)));
    } catch (e) {
      console.warn('Failed to load tasks for schedule', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const closeDetail = useCallback(() => {
    Animated.parallel([
      Animated.timing(detailOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(detailSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsDetailOpen(false);
        setDetailEntry(null);
      }
    });
  }, [detailOpacity, detailSlide]);

  const handleMarkTaskDone = async () => {
    if (!detailEntry || !detailEntry.taskId) return;
    try {
      const isRecurring = detailEntry.repeatType && detailEntry.repeatType !== 'none';
      const occurrenceDate = detailEntry.occurrenceDate ?? detailEntry.dueAt ?? Date.now();
      if (isRecurring && occurrenceDate > Date.now() && !isSameCalendarDay(occurrenceDate, Date.now())) {
        return; // Can only complete recurring tasks on the same day or overdue
      }
      const task = dbTasks.find((t) => t.id === detailEntry.taskId);
      const next = task
        ? calculateNextOccurrenceDate(task, occurrenceDate)
        : 4102444800000;
      await completeTaskOccurrence(detailEntry.taskId, occurrenceDate, next);
      closeDetail();
      onToast?.('Task marked as done');
      await loadTasks();
    } catch (error) {
      console.warn('Failed to complete task', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      closeDetail();
      await loadTasks();
    } catch (error) {
      console.warn('Failed to delete task', error);
    }
  };

  const handlePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) {
        detailSlide.setValue(Math.max(0, 1 - g.dy / SCREEN_HEIGHT));
      }
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > SCREEN_HEIGHT * 0.15 || g.vy > 0.5) {
        closeDetail();
      } else {
        Animated.spring(detailSlide, { toValue: 1, ...springModalSlide }).start();
      }
    },
  }), [detailSlide, closeDetail]);

  const openDetail = useCallback((entry: ScheduleEntry) => {
    setDetailEntry(entry);
    setIsDetailOpen(true);
    detailSlide.setValue(0);
    detailOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(detailOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(detailSlide, {
        toValue: 1,
        ...springModalSlide,
      }),
    ]).start();
  }, [detailOpacity, detailSlide]);

  const contentOpacity = useRef(new Animated.Value(1)).current;
  const calendarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDayPress = (key: string) => {
    if (key === selectedDayKey) return;
    setSelectedDayKey(key);
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const toggleCalendarView = () => {
    const next = !isMonthView;
    setIsMonthView(next);
    if (next) {
      const sel = new Date(selectedDayKey + 'T12:00:00');
      setMonthDate(new Date(sel.getFullYear(), sel.getMonth(), 1));
    }
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + index);
      return {
        key: getLocalDateKey(date),
        dayNumber: date.getDate(),
        short: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayOfWeek: date.getDay(),
      };
    });
  }, [weekStartDate]);

  const weekRangeLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const start = new Date(weekDays[0].key);
    const end = new Date(weekDays[weekDays.length - 1].key);
    const sameMonth = start.getMonth() === end.getMonth();
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString(
      'en-US',
      sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }
    );
    return `${startLabel} - ${endLabel}`;
  }, [weekDays]);

  const monthGrid = useMemo(() => {
    return buildMonthGrid(monthDate.getFullYear(), monthDate.getMonth());
  }, [monthDate]);

  const entriesByDay = useMemo(() => {
    const activeSubjectIds = new Set(subjects.filter((s) => !s.isArchived).map((s) => s.id));
    const map = new Map<string, ScheduleEntry[]>();
    for (const subject of subjects) {
      if (!activeSubjectIds.has(subject.id)) continue;
      if (!subject.days || subject.days.length === 0) continue;
      const startTime = formatTime(subject.startTime);
      const endTime = formatTime(subject.endTime);
      for (const day of subject.days) {
        const dayNum = DAY_MAP[day];
        if (dayNum === undefined) continue;
        const matchingWeekDay = weekDays.find((wd) => wd.dayOfWeek === dayNum);
        if (!matchingWeekDay) continue;
        const list = map.get(matchingWeekDay.key) ?? [];
        list.push({
          id: `${subject.id}-${day}`,
          startTime,
          endTime,
          title: subject.title,
          instructor: subject.instructor ?? undefined,
          location: subject.location ?? undefined,
          kind: 'subject',
          subjectId: subject.id,
        });
        map.set(matchingWeekDay.key, list);
      }
    }
    
    // Expand Tasks for the Week
    const weekStart = new Date(weekDays[0].key).getTime();
    const weekEnd = new Date(weekDays[weekDays.length - 1].key);
    weekEnd.setHours(23, 59, 59, 999);
    
    const expandedTasks = getExpandedTasksForRange(dbTasks, taskCompletions, weekStart, weekEnd.getTime());

    for (const task of expandedTasks) {
      if (deletedOccurrenceKeys.has(`${task.id}-${task.occurrenceDate}`)) continue;
      if (task.subjectId && !activeSubjectIds.has(task.subjectId)) continue;
      const taskDate = new Date(task.occurrenceDate);
      const key = getLocalDateKey(taskDate);
      const list = map.get(key) ?? [];
      const taskSubject = subjects.find((s) => s.id === task.subjectId);
      list.push({
        id: task.virtualId,
        startTime: formatTime(taskDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        title: task.title,
        kind: 'task',
        isCompleted: task.isCompleted,
        description: task.description ?? undefined,
        dueAt: task.dueAt,
        priority: task.priority,
        category: task.category,
        repeatType: task.repeatType,
        repeatDays: task.repeatDays,
        reminderMinutes: task.reminderMinutes,
        subjectTitle: taskSubject?.title ?? taskSubject?.code,
        subjectId: task.subjectId,
        taskId: task.id,
        occurrenceDate: task.occurrenceDate,
      });
      map.set(key, list);
    }
    
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        const timeA = parseTimeToMinutes(a.startTime) ?? 0;
        const timeB = parseTimeToMinutes(b.startTime) ?? 0;
        return timeA - timeB;
      });
      map.set(key, list);
    }
    return map;
  }, [subjects, weekDays, dbTasks, taskCompletions, deletedOccurrenceKeys]);

  const entriesByDayAll = useMemo(() => {
    const activeSubjectIds = new Set(subjects.filter((s) => !s.isArchived).map((s) => s.id));
    const map = new Map<string, ScheduleEntry[]>();
    for (const subject of subjects) {
      if (!activeSubjectIds.has(subject.id)) continue;
      if (!subject.days || subject.days.length === 0) continue;
      const startTime = formatTime(subject.startTime);
      const endTime = formatTime(subject.endTime);
      for (const day of subject.days) {
        const dayNum = DAY_MAP[day];
        if (dayNum === undefined) continue;
        const monthGridDays = monthGrid.flat().filter(Boolean) as number[];
        const monthYear = monthDate.getFullYear();
        const monthIdx = monthDate.getMonth();
        for (const d of monthGridDays) {
          const date = new Date(monthYear, monthIdx, d);
          if (date.getDay() !== dayNum) continue;
          const key = getLocalDateKey(date);
          const list = map.get(key) ?? [];
          list.push({
            id: `${subject.id}-${day}-${d}`,
            startTime,
            endTime,
            title: subject.title,
            instructor: subject.instructor ?? undefined,
            location: subject.location ?? undefined,
            kind: 'subject',
            subjectId: subject.id,
          });
          map.set(key, list);
        }
      }
    }

    // Expand Tasks for the Month
    const monthYear = monthDate.getFullYear();
    const monthIdx = monthDate.getMonth();
    const monthStart = new Date(monthYear, monthIdx, 1).getTime();
    const monthEnd = new Date(monthYear, monthIdx + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const expandedTasks = getExpandedTasksForRange(dbTasks, taskCompletions, monthStart, monthEnd.getTime());

    for (const task of expandedTasks) {
      if (deletedOccurrenceKeys.has(`${task.id}-${task.occurrenceDate}`)) continue;
      if (task.subjectId && !activeSubjectIds.has(task.subjectId)) continue;
      const taskDate = new Date(task.occurrenceDate);
      const key = getLocalDateKey(taskDate);
      const monthList = map.get(key) ?? [];
      const taskSubject = subjects.find((s) => s.id === task.subjectId);
      monthList.push({
        id: task.virtualId,
        startTime: formatTime(taskDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
        title: task.title,
        kind: 'task',
        isCompleted: task.isCompleted,
        description: task.description ?? undefined,
        dueAt: task.dueAt,
        priority: task.priority,
        category: task.category,
        repeatType: task.repeatType,
        repeatDays: task.repeatDays,
        reminderMinutes: task.reminderMinutes,
        subjectTitle: taskSubject?.title ?? taskSubject?.code,
        subjectId: task.subjectId,
        taskId: task.id,
        occurrenceDate: task.occurrenceDate,
      });
      map.set(key, monthList);
    }
    
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => {
        const timeA = parseTimeToMinutes(a.startTime) ?? 0;
        const timeB = parseTimeToMinutes(b.endTime ?? b.startTime) ?? 0;
        return timeA - timeB;
      });
      map.set(key, list);
    }
    return map;
  }, [subjects, monthGrid, monthDate, dbTasks, taskCompletions, deletedOccurrenceKeys]);

  const selectedEntries = entriesByDay.get(selectedDayKey) ?? entriesByDayAll.get(selectedDayKey) ?? [];
  const selectedDayIndex = weekDays.findIndex((day) => day.key === selectedDayKey);

  const handleShiftWeek = (direction: 'prev' | 'next') => {
    const nextStart = new Date(weekStartDate);
    nextStart.setDate(nextStart.getDate() + (direction === 'next' ? 7 : -7));
    nextStart.setHours(0, 0, 0, 0);
    setWeekStartDate(nextStart);
    const nextWeekDays = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(nextStart);
      date.setDate(nextStart.getDate() + index);
      return getLocalDateKey(date);
    });
    const fallbackIndex = selectedDayIndex >= 0 ? selectedDayIndex : 0;
    setSelectedDayKey(nextWeekDays[fallbackIndex]);
  };

  const handleShiftMonth = (direction: 'prev' | 'next') => {
    const next = new Date(monthDate);
    next.setMonth(next.getMonth() + (direction === 'next' ? 1 : -1));
    setMonthDate(next);
    const firstDayKey = getLocalDateKey(new Date(next.getFullYear(), next.getMonth(), 1));
    setSelectedDayKey(firstDayKey);
  };

  // Load persisted filter
  useEffect(() => {
    (async () => {
      try {
        const saved = await getMetaValue('scheduleFilter');
        if (saved) {
          const parsed = JSON.parse(saved);
          setScheduleFilter(parsed);
        }
      } catch {}
    })();
  }, []);

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

  const handleToggleFilter = (kind: 'subjects' | 'tasks') => {
    const next = { ...scheduleFilter, [kind]: !scheduleFilter[kind] };
    setScheduleFilter(next);
    setMetaValue('scheduleFilter', JSON.stringify(next)).catch(() => {});
  };

  const filterPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) {
        filterSlide.setValue(Math.max(0, 1 - g.dy / SCREEN_HEIGHT));
      }
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > SCREEN_HEIGHT * 0.15 || g.vy > 0.5) {
        handleCloseFilter();
      } else {
        Animated.spring(filterSlide, { toValue: 1, ...springModalSlide }).start();
      }
    },
  }), [filterSlide]);

  const filteredSelectedEntries = useMemo(() => {
    return selectedEntries.filter((entry) => {
      if (!scheduleFilter.subjects && entry.kind === 'subject') return false;
      if (!scheduleFilter.tasks && entry.kind === 'task') return false;
      return true;
    });
  }, [selectedEntries, scheduleFilter]);

  const renderDots = (count: number, isToday?: boolean) => {
    if (count <= 0) return <View style={[styles.dot, isToday ? styles.dotToday : styles.dotMuted]} />;
    return Array.from({ length: Math.min(count, 3) }).map((_, index) => (
      <View key={index} style={[styles.dot, isToday && styles.dotToday]} />
    ));
  };

  const hasMonthEntry = (day: number) => {
    const year = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const key = getLocalDateKey(new Date(year, m, day));
    return (entriesByDayAll.get(key)?.length ?? 0) > 0;
  };

  const formatHourLabel = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${hour12} ${h < 12 ? 'AM' : 'PM'}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.headerTitle}>My Schedule</Text>
        <Pressable style={styles.filterButton} onPress={handleOpenFilter} hitSlop={8}>
          {scheduleFilter.subjects !== scheduleFilter.tasks ? (
            <MaterialCommunityIcons name="filter-variant" size={16} color="#4d7e6a" />
          ) : (
            <Feather name="filter" size={16} color="#1e2b26" />
          )}
        </Pressable>
      </View>

      <View style={styles.weekCard}>
        {isMonthView ? (
          <>
            <View style={styles.monthHeader}>
              <Text style={styles.monthLabel}>
                {MONTH_NAMES[monthDate.getMonth()]} {monthDate.getFullYear()}
              </Text>
              <View style={styles.headerRightGroup}>
                <Pressable style={styles.calendarToggle} onPress={toggleCalendarView} hitSlop={8}>
                  <Feather name={isMonthView ? 'columns' : 'calendar'} size={18} color="#1e2b26" />
                </Pressable>
                <Pressable style={styles.arrowButton} onPress={() => handleShiftMonth('prev')}>
                  <Feather name="chevron-left" size={18} color="#1f2d28" />
                </Pressable>
                <Pressable style={styles.arrowButton} onPress={() => handleShiftMonth('next')}>
                  <Feather name="chevron-right" size={18} color="#1f2d28" />
                </Pressable>
              </View>
            </View>

            <View style={styles.monthDayHeaders}>
              {DAY_HEADERS.map((d, i) => (
                <Text key={`hdr-${i}`} style={styles.monthDayHeaderText}>{d}</Text>
              ))}
            </View>

            <View style={styles.monthGrid}>
              {monthGrid.map((week, wi) => (
                <View key={`w${wi}`} style={styles.monthWeekRow}>
                  {week.map((day, di) => {
                    if (day === null) {
                      return <View key={`e${wi}-${di}`} style={styles.monthCellEmpty} />;
                    }
                    const year = monthDate.getFullYear();
                    const m = monthDate.getMonth();
                    const key = getLocalDateKey(new Date(year, m, day));
                    const isToday = key === todayKey;
                    const isSelected = key === selectedDayKey;
                    const hasEntries = hasMonthEntry(day);

                    const cellStyle = isToday
                      ? styles.monthCellToday
                      : isSelected
                        ? styles.monthCellSelected
                        : styles.monthCell;

                    const numStyle = isToday
                      ? styles.monthCellNumToday
                      : isSelected
                        ? styles.monthCellNumSelected
                        : styles.monthCellNum;

                    return (
                      <Pressable
                        key={`d${wi}-${di}`}
                        style={cellStyle}
                        onPress={() => handleDayPress(key)}
                      >
                        <Text style={numStyle}>{day}</Text>
                        {hasEntries ? <View style={[styles.monthDot, (isToday || isSelected) && styles.monthDotLight]} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.weekHeader}>
              <Text style={styles.weekRange}>{weekRangeLabel}</Text>
              <View style={styles.headerRightGroup}>
                <Pressable style={styles.calendarToggle} onPress={toggleCalendarView} hitSlop={8}>
                  <Feather name={isMonthView ? 'columns' : 'calendar'} size={18} color="#1e2b26" />
                </Pressable>
                <Pressable style={styles.arrowButton} onPress={() => handleShiftWeek('prev')}>
                  <Feather name="chevron-left" size={18} color="#1f2d28" />
                </Pressable>
                <Pressable style={styles.arrowButton} onPress={() => handleShiftWeek('next')}>
                  <Feather name="chevron-right" size={18} color="#1f2d28" />
                </Pressable>
              </View>
            </View>

            <View style={styles.weekDaysRow}>
              {weekDays.map((day) => {
                const isSelected = day.key === selectedDayKey;
                const isToday = day.key === todayKey;
                const dotCount = (entriesByDay.get(day.key) ?? entriesByDayAll.get(day.key) ?? []).length;

                const chipStyle = isToday
                  ? styles.dayChipToday
                  : isSelected
                    ? styles.dayChipFocused
                    : styles.dayChip;

                const letterStyle = isToday
                  ? styles.dayLetterSelected
                  : isSelected
                    ? styles.dayLetterFocused
                    : styles.dayLetter;

                const numberStyle = isToday
                  ? styles.dayNumberSelected
                  : isSelected
                    ? styles.dayNumberFocused
                    : styles.dayNumber;

                return (
                  <Pressable
                    key={day.key}
                    style={chipStyle}
                    onPress={() => handleDayPress(day.key)}
                  >
                    <Text style={letterStyle}>{day.short.charAt(0)}</Text>
                    <Text style={numberStyle}>{day.dayNumber}</Text>
                    <View style={styles.dotRow}>{renderDots(dotCount, isToday)}</View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <Animated.View style={[styles.timeline, { opacity: contentOpacity }]}>
        {filteredSelectedEntries.length > 0 && <View style={styles.timeLine} />}

        {filteredSelectedEntries.length === 0 ? (
          <View style={styles.sectionEmptyState}>
            <View style={styles.sectionEmptyIconWrapper}>
              <Feather name="calendar" size={18} color="#8f968f" />
            </View>
            <Text style={styles.sectionEmptyTitle}>Nothing scheduled</Text>
          </View>
        ) : (
          filteredSelectedEntries.map((entry, ei) => {
            const isToday = selectedDayKey === todayKey;
            const startMins = parseTimeToMinutes(entry.startTime) ?? 0;
            const endMins = parseTimeToMinutes(entry.endTime) ?? 0;
            const isActive = isToday && currentMinutes >= startMins && currentMinutes <= endMins;
            const cutoffMins = parseTimeToMinutes(entry.endTime ?? entry.startTime) ?? 0;
            const isPast = selectedDayKey < todayKey || (isToday && currentMinutes > cutoffMins);
            const isCompletedToday = entry.isCompleted && entry.taskId
              ? taskCompletions.some((tc) => tc.taskId === entry.taskId && tc.occurrenceDate === entry.occurrenceDate && getLocalDateKey(new Date(tc.completedAt)) === todayKey)
              : false;
            const prevStartMins = ei > 0 ? (parseTimeToMinutes(selectedEntries[ei - 1].startTime) ?? 0) : -1;
            const sameHourAsPrev = ei > 0 && Math.floor(startMins / 60) === Math.floor(prevStartMins / 60);
            const nextStartMins = ei < selectedEntries.length - 1 ? (parseTimeToMinutes(selectedEntries[ei + 1].startTime) ?? 0) : -1;
            const sameHourAsNext = ei < selectedEntries.length - 1 && Math.floor(startMins / 60) === Math.floor(nextStartMins / 60);

            return (
              <View key={entry.id} style={[styles.timelineRow, sameHourAsNext && styles.timelineRowCompact]}>
                {sameHourAsPrev ? (
                  <View style={styles.timeWrapperSpacer} />
                ) : (
                  <View style={styles.timeWrapper}>
                    <Text style={styles.timeText}>{formatHourLabel(startMins)}</Text>
                    <View style={[styles.timeDot, isActive && styles.timeDotActive]} />
                  </View>
                )}
                <Pressable style={[styles.eventCard, isActive && styles.eventCardPrimary, isPast && styles.eventCardPast, entry.isCompleted && styles.eventCardDone]} onPress={() => openDetail(entry)}>
                  <View style={[styles.eventAccent, isActive && styles.eventAccentActive, isPast && styles.eventAccentPast]} />
                  <View style={[styles.eventContent, entry.isCompleted && styles.eventContentDone]}>
                    <View style={styles.eventTitleRow}>
                      <Text style={[styles.eventTitle, entry.isCompleted && styles.eventTitleDone]} numberOfLines={1}>{entry.title}</Text>
                    </View>
                    <View style={styles.eventTimeRow}>
                      <Text style={[styles.eventTimeText, entry.isCompleted && styles.eventTimeTextDone, entry.kind === 'task' && isPast && !entry.isCompleted && styles.eventTimeTextPast]}>
                        {entry.startTime}{entry.endTime ? ` - ${entry.endTime}` : ''}
                      </Text>
                      {entry.isCompleted ? (
                        <Text style={styles.completedLabel}>
                          {isCompletedToday ? '(completed today)' : '(completed)'}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.eventIconWrapper}>
                    {entry.kind === 'task' ? (
                      <MaterialIcons
                        name="flag"
                        size={16}
                        color={entry.isCompleted ? '#d0d4d0' : entry.priority === 'high' ? '#d1453b' : entry.priority === 'low' ? '#e88d3f' : (isActive ? '#8fbaa4' : isPast ? '#c9cdc9' : '#c5c9c5')}
                      />
                    ) : (
                      <Feather name="book-open" size={16} color={isActive ? '#8fbaa4' : isPast ? '#c9cdc9' : '#c5c9c5'} />
                    )}
                  </View>
                </Pressable>
              </View>
            );
          })
        )}
      </Animated.View>

      {/* Filter Sheet */}
      <Modal visible={isFilterOpen} transparent animationType="none" onRequestClose={handleCloseFilter}>
        <View style={styles.filterRoot}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: filterOpacity }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseFilter} />

          <Animated.View
            style={[styles.filterPanelWrapper, {
              bottom: 0,
              transform: [{
                translateY: filterSlide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SCREEN_HEIGHT, 0],
                }),
              }],
            }]}
          >
            <View style={[styles.filterPanel, { maxHeight: SCREEN_HEIGHT * 0.6 }]} {...filterPanResponder.panHandlers}>
              <View style={styles.filterHandle} />
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.filterTitle}>Show</Text>

                <View style={styles.filterOptionsCard}>
                  <Pressable style={styles.filterCheckRow} onPress={() => handleToggleFilter('subjects')}>
                    <View style={[styles.filterCheckbox, scheduleFilter.subjects && styles.filterCheckboxChecked]}>
                      {scheduleFilter.subjects ? <Feather name="check" size={12} color="#ffffff" /> : null}
                    </View>
                    <Text style={styles.filterCheckLabel}>Subjects</Text>
                  </Pressable>
                  <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                  <Pressable style={styles.filterCheckRow} onPress={() => handleToggleFilter('tasks')}>
                    <View style={[styles.filterCheckbox, scheduleFilter.tasks && styles.filterCheckboxChecked]}>
                      {scheduleFilter.tasks ? <Feather name="check" size={12} color="#ffffff" /> : null}
                    </View>
                    <Text style={styles.filterCheckLabel}>Tasks</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={isDetailOpen} transparent animationType="none" onRequestClose={closeDetail}>
        <View style={styles.detailRoot}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: detailOpacity }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDetail} />

          <Animated.View
            pointerEvents="box-none"
            style={[styles.detailPanelWrapper, {
              transform: [{
                translateY: detailSlide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SCREEN_HEIGHT, 0],
                }),
              }],
            }]}
          >
            <View style={styles.detailPanel} {...handlePanResponder.panHandlers}>
              <View style={styles.detailHandle} />
              {detailEntry && (
                <>
                  {detailEntry.kind === 'task' ? (
                    <View style={styles.detailCard}>
                      <View style={styles.editInfoRow}>
                        <MaterialIcons
                          name="flag"
                          size={16}
                          color={detailEntry.isCompleted ? '#d0d4d0' : detailEntry.priority === 'high' ? '#d1453b' : detailEntry.priority === 'low' ? '#e88d3f' : '#8f968f'}
                          style={{ marginRight: 10 }}
                        />
                        <Text style={styles.editInfoInput}>{detailEntry.title}</Text>
                      </View>
                      {detailEntry.subjectTitle ? (
                        <>
                          <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                          {detailEntry.subjectId ? (
                            <Pressable style={styles.editInfoRow} onPress={() => {
                              closeDetail();
                              const subject = subjects.find((s) => s.id === detailEntry.subjectId);
                              if (subject) onOpenSubjectDetail?.(subject);
                            }}>
                              <Feather name="book-open" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                              <Text style={styles.editInfoInput}>{detailEntry.subjectTitle}</Text>
                              <Feather name="arrow-right" size={16} color="#c5c9c5" />
                            </Pressable>
                          ) : (
                            <View style={styles.editInfoRow}>
                              <Feather name="book-open" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                              <Text style={styles.editInfoInput}>{detailEntry.subjectTitle}</Text>
                            </View>
                          )}
                        </>
                      ) : null}
                      {detailEntry.description ? (
                        <>
                          <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                          <View style={[styles.editInfoRow, { minHeight: 88, alignItems: 'flex-start' }]}>
                            <Feather name="align-left" size={16} color="#8f968f" style={{ marginRight: 10, marginTop: 16 }} />
                            <Text style={styles.editInfoInput}>{detailEntry.description}</Text>
                          </View>
                        </>
                      ) : null}
                      {detailEntry.dueAt ? (
                        <>
                          <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                          <View style={styles.editInfoRow}>
                            <Feather name="calendar" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                            <Text style={styles.editInfoInput}>
                              {new Date(detailEntry.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              {' '}
                              {detailEntry.startTime ? new Date(detailEntry.dueAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''}
                            </Text>
                          </View>
                        </>
                      ) : null}
                      {detailEntry.priority ? (
                        <>
                          <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                          <View style={styles.editInfoRow}>
                            <MaterialIcons name="flag" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                            <Text style={styles.editInfoInput}>
                              {detailEntry.priority === 'high' ? 'High' : 'Low'} Priority
                            </Text>
                          </View>
                        </>
                      ) : null}
                      {detailEntry.category ? (
                        <>
                          <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                          <View style={styles.editInfoRow}>
                            <Feather name="folder" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                            <Text style={styles.editInfoInput}>{detailEntry.category}</Text>
                          </View>
                        </>
                      ) : null}
                      {detailEntry.repeatType && detailEntry.repeatType !== 'none' ? (
                        <>
                          <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                          <View style={styles.editInfoRow}>
                            <Feather name="repeat" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                            <Text style={styles.editInfoInput}>
                              {detailEntry.repeatType === 'daily' ? 'Daily' : detailEntry.repeatType === 'weekly' ? `Weekly${detailEntry.repeatDays && detailEntry.repeatDays.length > 0 ? ` (${detailEntry.repeatDays.join(', ')})` : ''}` : detailEntry.repeatType === 'monthly' ? 'Monthly' : ''}
                            </Text>
                          </View>
                        </>
                      ) : null}
                      <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                      {(() => {
                        const isRecurring = detailEntry.repeatType && detailEntry.repeatType !== 'none';
                        const occDate = detailEntry.occurrenceDate ?? detailEntry.dueAt ?? 0;
                        const canMarkDone = !detailEntry.isCompleted && (!isRecurring || isSameCalendarDay(occDate, Date.now()) || occDate < Date.now());
                        const label = detailEntry.isCompleted ? 'Completed' : canMarkDone ? 'Mark as done' : 'Locked';
                        const color = canMarkDone ? '#0f2a24' : '#c9cdc9';
                        return (
                          <Pressable
                            style={[styles.editInfoRow, !canMarkDone && { opacity: 0.4 }]}
                            onPress={canMarkDone ? handleMarkTaskDone : undefined}
                            disabled={!canMarkDone}
                          >
                            <Feather name="check-circle" size={16} color={color} style={{ marginRight: 10 }} />
                            <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 16, color }}>{label}</Text>
                          </Pressable>
                        );
                      })()}
                    </View>
                  ) : (
                    <View style={styles.detailCard}>
                      <Pressable style={styles.editInfoRow} onPress={() => {
                        closeDetail();
                        const subject = subjects.find((s) => s.id === detailEntry.subjectId);
                        if (subject) onOpenSubjectDetail?.(subject);
                      }}>
                        <Feather name="book-open" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                        <Text style={styles.editInfoInput}>{detailEntry.title}</Text>
                        <Feather name="arrow-right" size={16} color="#c5c9c5" />
                      </Pressable>
                      <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                      <View style={styles.editInfoRow}>
                        <Feather name="clock" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                        <Text style={styles.editInfoInput}>
                          {detailEntry.startTime}{detailEntry.endTime ? ` - ${detailEntry.endTime}` : ''}
                        </Text>
                      </View>
                      {detailEntry.location ? (
                        <>
                          <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                          <View style={styles.editInfoRow}>
                            <Feather name="map-pin" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                            <Text style={styles.editInfoInput}>{detailEntry.location}</Text>
                          </View>
                        </>
                      ) : null}
                      {detailEntry.instructor ? (
                        <>
                          <View style={{ height: 1, backgroundColor: '#f0f0ed' }} />
                          <View style={styles.editInfoRow}>
                            <Feather name="user" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                            <Text style={styles.editInfoInput}>{detailEntry.instructor}</Text>
                          </View>
                        </>
                      ) : null}
                    </View>
                  )}
                </>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 20 : 22,
    color: '#1e2b26',
  },
  calendarToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e6e2dc',
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fcfbfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f2f1ee',
  },
  weekCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: CARD_H_PADDING,
    ...shadowLg,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekRange: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 17 : 20,
    color: '#1e2b26',
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0eee9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowButtonDisabled: {
    opacity: 0.5,
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    alignItems: 'center',
    justifyContent: 'center',
    width: DAY_CHIP_SIZE,
    height: IS_SMALL_SCREEN ? 78 : 90,
    borderRadius: 18,
    gap: IS_SMALL_SCREEN ? 4 : 6,
  },
  dayChipToday: {
    alignItems: 'center',
    justifyContent: 'center',
    width: DAY_CHIP_SIZE,
    height: IS_SMALL_SCREEN ? 78 : 90,
    borderRadius: 18,
    gap: IS_SMALL_SCREEN ? 4 : 6,
    backgroundColor: '#0f2a24',
  },
  dayChipFocused: {
    alignItems: 'center',
    justifyContent: 'center',
    width: DAY_CHIP_SIZE,
    height: IS_SMALL_SCREEN ? 78 : 90,
    borderRadius: 18,
    gap: IS_SMALL_SCREEN ? 4 : 6,
    backgroundColor: '#f0eee9',
    borderWidth: 1,
    borderColor: '#e1ddd6',
  },
  dayLetter: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    color: '#9aa09a',
  },
  dayLetterSelected: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    color: '#d9e4dd',
  },
  dayLetterFocused: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    color: '#6b746f',
  },
  dayNumber: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
    color: '#4d5852',
  },
  dayNumberSelected: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
    color: '#f1f6f2',
  },
  dayNumberFocused: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 14 : 16,
    color: '#2a332e',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1e2b26',
  },
  dotToday: {
    backgroundColor: '#d7e4dd',
  },
  dotMuted: {
    backgroundColor: '#c9cdc9',
  },
  // Month view
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 16 : 18,
    color: '#1e2b26',
  },
  monthDayHeaders: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  monthDayHeaderText: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 11 : 12,
    color: '#9aa09a',
  },
  monthGrid: {
    gap: 2,
  },
  monthWeekRow: {
    flexDirection: 'row',
    gap: 2,
  },
  monthCell: {
    flex: 1,
    height: MONTH_CELL_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  monthCellEmpty: {
    flex: 1,
    height: MONTH_CELL_HEIGHT,
  },
  monthCellToday: {
    flex: 1,
    height: MONTH_CELL_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#0f2a24',
  },
  monthCellSelected: {
    flex: 1,
    height: MONTH_CELL_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#f0eee9',
    borderWidth: 1,
    borderColor: '#e1ddd6',
  },
  monthCellNum: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: IS_SMALL_SCREEN ? 12 : 14,
    color: '#4d5852',
  },
  monthCellNumToday: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 12 : 14,
    color: '#f1f6f2',
  },
  monthCellNumSelected: {
    fontFamily: 'Manrope_700Bold',
    fontSize: IS_SMALL_SCREEN ? 12 : 14,
    color: '#2a332e',
  },
  monthDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1e2b26',
  },
  monthDotLight: {
    backgroundColor: '#ffffff',
  },
  // Timeline
  timeline: {
    position: 'relative',
    paddingBottom: 20,
  },
  timeLine: {
    position: 'absolute',
    left: 39,
    top: 10,
    bottom: 40,
    width: 1.5,
    backgroundColor: '#efede8',
    zIndex: -1,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  timelineRowCompact: {
    marginBottom: 6,
  },
  timeWrapper: {
    width: 44,
    position: 'relative',
    alignItems: 'flex-start',
    paddingTop: 0,
    paddingRight: 0,
  },
  timeWrapperSpacer: {
    width: 44,
  },
  timeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: '#6b746f',
  },
  timeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#efede8',
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  timeDotActive: {
    backgroundColor: '#3d6657',
    borderColor: '#3d6657',
  },
  eventCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 4.5,
    overflow: 'hidden',
    ...shadowLg,
  },
  eventCardPrimary: {
    backgroundColor: '#f1f8f4',
  },
  eventCardPast: {
    backgroundColor: '#f7f7f7',
  },
  eventCardDone: {
    backgroundColor: '#f3f3f3',
    opacity: 0.75,
  },
  eventAccent: {
    width: 6,
    backgroundColor: '#efefef',
    borderRadius: 4,
  },
  eventAccentActive: {
    backgroundColor: '#4d7e6a',
  },
  eventAccentPast: {
    backgroundColor: '#d8dbd8',
  },
  eventContent: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  eventContentDone: {
    paddingVertical: 6,
    gap: 2,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#1e2b26',
  },
  eventTitleDone: {
    textDecorationLine: 'line-through',
    color: '#b0b5b0',
  },
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTimeText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: '#6b746f',
  },
  eventTimeTextDone: {
    color: '#c9cdc9',
  },
  eventTimeTextPast: {
    color: '#d1453b',
  },
  completedLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 11,
    color: '#9aa09a',
  },
  eventIconWrapper: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  filterRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  filterOptionsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
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
  filterCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  filterCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#c9cdc9',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCheckboxChecked: {
    backgroundColor: '#0f2a24',
    borderColor: '#0f2a24',
  },
  filterCheckLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
  },
  detailRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailHandle: {
    width: 68,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e3e0d8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  detailPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  detailPanel: {
    backgroundColor: '#f8f7f2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: SCREEN_HEIGHT * 0.8,
    ...shadowLg,
  },
  detailTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#101413',
    letterSpacing: -0.3,
    marginBottom: 16,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  detailText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
    flex: 1,
  },
  editInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  editInfoInput: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
    paddingVertical: 14,
  },
});
