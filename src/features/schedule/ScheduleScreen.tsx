import { Feather } from '@expo/vector-icons';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SubjectRecord } from '../../data/local/db';
import { shadowLg } from '../../ui/tokens/shadows';
import { parseTimeToMinutes } from '../../utils/timeUtils';

const DAY_MAP: Record<string, number> = {
  Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6,
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

const DAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
};

type ScheduleEntry = {
  id: string;
  startTime: string;
  endTime?: string;
  title: string;
  instructor?: string;
  location?: string;
};

type ScheduleScreenProps = {
  subjects: SubjectRecord[];
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

export default function ScheduleScreen({ subjects }: ScheduleScreenProps) {
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
    const map = new Map<string, ScheduleEntry[]>();
    for (const subject of subjects) {
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
        });
        map.set(matchingWeekDay.key, list);
      }
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
  }, [subjects, weekDays]);

  const entriesByDayAll = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const subject of subjects) {
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
          });
          map.set(key, list);
        }
      }
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
  }, [subjects, monthGrid, monthDate]);

  const selectedEntries = entriesByDay.get(selectedDayKey) ?? [];
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

  const renderDots = (count: number) => {
    if (count <= 0) return <View style={[styles.dot, styles.dotMuted]} />;
    return Array.from({ length: Math.min(count, 3) }).map((_, index) => (
      <View key={index} style={styles.dot} />
    ));
  };

  const hasMonthEntry = (day: number) => {
    const year = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const key = getLocalDateKey(new Date(year, m, day));
    return (entriesByDayAll.get(key)?.length ?? 0) > 0;
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleBlock}>
        <Text style={styles.headerTitle}>My Schedule</Text>
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
                const dotCount = entriesByDay.get(day.key)?.length ?? 0;

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
                    <View style={styles.dotRow}>{renderDots(dotCount)}</View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </View>

      <Animated.View style={[styles.timeline, { opacity: contentOpacity }]}>
        {selectedEntries.length > 0 && <View style={styles.timeLine} />}

        {selectedEntries.length === 0 ? (
          <View style={styles.sectionEmptyState}>
            <View style={styles.sectionEmptyIconWrapper}>
              <Feather name="calendar" size={18} color="#8f968f" />
            </View>
            <Text style={styles.sectionEmptyTitle}>Nothing scheduled</Text>
          </View>
        ) : (
          selectedEntries.map((entry) => {
            const isToday = selectedDayKey === todayKey;
            const startMins = parseTimeToMinutes(entry.startTime) ?? 0;
            const endMins = parseTimeToMinutes(entry.endTime) ?? 0;
            const isActive = isToday && currentMinutes >= startMins && currentMinutes <= endMins;

            return (
              <View key={entry.id} style={styles.timelineRow}>
                <View style={styles.timeWrapper}>
                  <Text style={styles.timeText}>{entry.startTime}</Text>
                  <View style={[styles.timeDot, isActive && styles.timeDotActive]} />
                </View>
                <View style={[styles.eventCard, isActive && styles.eventCardPrimary]}>
                  <Text style={styles.eventTitle}>{entry.title}</Text>

                  {entry.instructor ? (
                    <View style={styles.metaRow}>
                      <Feather name="user" size={14} color="#2a332e" />
                      <Text style={styles.metaText}>{entry.instructor}</Text>
                    </View>
                  ) : null}

                  <View style={[styles.metaDivider, isActive && styles.metaDividerActive]} />

                  <View style={styles.metaRow}>
                    <Feather name="clock" size={14} color="#2a332e" />
                    <Text style={styles.metaText}>
                      {entry.startTime}{entry.endTime ? ` - ${entry.endTime}` : ''}
                    </Text>
                  </View>

                  {entry.location ? (
                    <View style={styles.metaRow}>
                      <Feather name="map-pin" size={14} color="#2a332e" />
                      <Text style={styles.metaText}>{entry.location}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </Animated.View>
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
    left: 68,
    top: 10,
    bottom: 40,
    width: 1.5,
    backgroundColor: '#eeeae1',
    zIndex: -1,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timeWrapper: {
    width: 80,
    position: 'relative',
    alignItems: 'flex-end',
    paddingTop: 0,
    paddingRight: 24,
  },
  timeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#6b746f',
    marginTop: 2,
  },
  timeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    borderWidth: 2.5,
    borderColor: '#eeeae1',
    position: 'absolute',
    right: 5,
    top: 4,
    zIndex: 1,
  },
  timeDotActive: {
    backgroundColor: '#3d6657',
    borderColor: '#3d6657',
  },
  eventCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eeeae1',
    ...shadowLg,
  },
  eventCardPrimary: {
    backgroundColor: '#f1f8f4',
    borderColor: '#c9ded1',
  },
  eventTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#e2ded7',
    marginVertical: 8,
  },
  metaDividerActive: {
    backgroundColor: '#c9ded1',
  },
  metaText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#4d5852',
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
});
