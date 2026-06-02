import { Feather } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SubjectRecord } from '../../data/local/db';
import { shadowLg } from '../../ui/tokens/shadows';
import { springModalSlide } from '../../ui/tokens/animations';
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
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  kind: 'subject' | 'task';
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
  const [detailEntry, setDetailEntry] = useState<ScheduleEntry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const detailSlide = useRef(new Animated.Value(0)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;

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
          kind: 'subject',
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
            kind: 'subject',
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
        {selectedEntries.length > 0 && <View style={styles.timeLine} />}

        {selectedEntries.length === 0 ? (
          <View style={styles.sectionEmptyState}>
            <View style={styles.sectionEmptyIconWrapper}>
              <Feather name="calendar" size={18} color="#8f968f" />
            </View>
            <Text style={styles.sectionEmptyTitle}>Nothing scheduled</Text>
          </View>
        ) : (
          selectedEntries.map((entry, ei) => {
            const isToday = selectedDayKey === todayKey;
            const startMins = parseTimeToMinutes(entry.startTime) ?? 0;
            const endMins = parseTimeToMinutes(entry.endTime) ?? 0;
            const isActive = isToday && currentMinutes >= startMins && currentMinutes <= endMins;
            const isPast = selectedDayKey < todayKey || (isToday && currentMinutes > endMins);
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
                <Pressable style={[styles.eventCard, isActive && styles.eventCardPrimary, isPast && styles.eventCardPast]} onPress={() => openDetail(entry)}>
                  <View style={[styles.eventAccent, isActive && styles.eventAccentActive, isPast && styles.eventAccentPast]} />
                  <View style={styles.eventContent}>
                    <View style={styles.eventTitleRow}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{entry.title}</Text>
                    </View>
                    <View style={styles.eventTimeRow}>
                      <Text style={styles.eventTimeText}>
                        {entry.startTime}{entry.endTime ? ` - ${entry.endTime}` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eventIconWrapper}>
                    <Feather name={entry.kind === 'task' ? 'check-square' : 'book-open'} size={16} color={isActive ? '#8fbaa4' : isPast ? '#c9cdc9' : '#c5c9c5'} />
                  </View>
                </Pressable>
              </View>
            );
          })
        )}
      </Animated.View>

      <Modal visible={isDetailOpen} transparent animationType="none" onRequestClose={closeDetail}>
        <View style={styles.detailRoot}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: detailOpacity, backgroundColor: 'rgba(5, 8, 7, 0.3)' }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeDetail} />
          </Animated.View>

          <Animated.View
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
                  <Text style={styles.detailTitle}>{detailEntry.title}</Text>
                  <View style={styles.detailDivider} />
                  <View style={styles.detailRow}>
                    <Feather name="clock" size={16} color="#6b746f" />
                    <Text style={styles.detailText}>
                      {detailEntry.startTime}{detailEntry.endTime ? ` - ${detailEntry.endTime}` : ''}
                    </Text>
                  </View>
                  {detailEntry.location ? (
                    <View style={styles.detailRow}>
                      <Feather name="map-pin" size={16} color="#6b746f" />
                      <Text style={styles.detailText}>{detailEntry.location}</Text>
                    </View>
                  ) : null}
                  {detailEntry.instructor ? (
                    <View style={styles.detailRow}>
                      <Feather name="user" size={16} color="#6b746f" />
                      <Text style={styles.detailText}>{detailEntry.instructor}</Text>
                    </View>
                  ) : null}
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
    bottom: 0,
  },
  detailPanel: {
    backgroundColor: '#f8f7f2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.8,
    ...shadowLg,
  },
  detailTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
    marginBottom: 4,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#efefe8',
    marginVertical: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  detailText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#4d5852',
  },
});
