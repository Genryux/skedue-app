import { Feather } from '@expo/vector-icons';
import { useMemo, useRef, useState, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SubjectRecord } from '../../data/local/db';
import { shadowLg } from '../../ui/tokens/shadows';
import { parseTimeToMinutes } from '../../utils/timeUtils';

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

  const contentOpacity = useRef(new Animated.Value(1)).current;

  // Update current time periodically for accurate highlighting
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60000); // Update every minute
    return () => clearInterval(timer);
  }, []);

  const handleDayPress = (key: string) => {
    if (key === selectedDayKey) return;
    
    // Immediately set the day and restart the fade-in animation.
    // This prevents the "white screen" bug caused by rapid tapping where opacity gets stuck at 0.
    setSelectedDayKey(key);
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
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
    if (weekDays.length === 0) {
      return '';
    }

    const start = new Date(weekDays[0].key);
    const end = new Date(weekDays[weekDays.length - 1].key);
    const sameMonth = start.getMonth() === end.getMonth();

    const startLabel = start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endLabel = end.toLocaleDateString(
      'en-US',
      sameMonth
        ? { day: 'numeric' }
        : {
            month: 'short',
            day: 'numeric',
          }
    );

    return `${startLabel} - ${endLabel}`;
  }, [weekDays]);

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

  const renderDots = (count: number) => {
    if (count <= 0) {
      return <View style={[styles.dot, styles.dotMuted]} />;
    }

    return Array.from({ length: Math.min(count, 3) }).map((_, index) => (
      <View key={index} style={styles.dot} />
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerIconsRow}>
          <Pressable style={styles.headerIconButton}>
            <Feather name="bell" size={18} color="#1e2b26" />
          </Pressable>
          <Pressable style={styles.headerIconButton}>
            <Feather name="settings" size={18} color="#1e2b26" />
          </Pressable>
        </View>
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.headerTitle}>Your Subjects this Week</Text>
      </View>

      <View style={styles.weekCard}>
        <View style={styles.weekHeader}>
          <Text style={styles.weekRange}>{weekRangeLabel}</Text>
          <View style={styles.weekArrows}>
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
            const chipStyles = [styles.dayChip];
            const letterStyles = [styles.dayLetter];
            const numberStyles = [styles.dayNumber];

            if (isToday) {
              chipStyles.push(styles.dayChipToday);
              letterStyles.push(styles.dayLetterSelected);
              numberStyles.push(styles.dayNumberSelected);
            } else if (isSelected) {
              chipStyles.push(styles.dayChipFocused);
              letterStyles.push(styles.dayLetterFocused);
              numberStyles.push(styles.dayNumberFocused);
            }

            return (
              <Pressable
                key={day.key}
                style={chipStyles}
                onPress={() => handleDayPress(day.key)}
              >
                <Text style={letterStyles}>
                  {day.short.charAt(0)}
                </Text>
                <Text style={numberStyles}>{day.dayNumber}</Text>
                <View style={styles.dotRow}>{renderDots(dotCount)}</View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Animated.View style={[styles.timeline, { opacity: contentOpacity }]}>
        {selectedEntries.length > 0 && <View style={styles.timeLine} />}
        
        {selectedEntries.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="calendar" size={18} color="#1f2d28" />
            </View>
            <Text style={styles.emptyTitle}>No classes scheduled</Text>
            <Text style={styles.emptyBody}>Add a subject to populate your schedule.</Text>
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
                  {entry.location ? (
                    <>
                      <View style={styles.metaRow}>
                        <Feather name="map-pin" size={14} color="#2a332e" />
                        <Text style={styles.metaText}>{entry.location}</Text>
                      </View>
                      {entry.instructor ? <View style={styles.metaDivider} /> : null}
                    </>
                  ) : null}
                  {entry.instructor ? (
                    <View style={styles.metaRow}>
                      <Feather name="user" size={14} color="#2a332e" />
                      <Text style={styles.metaText}>{entry.instructor}</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 28,
    height: 28,
  },
  titleBlock: {
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 22,
    color: '#1e2b26',
  },
  headerIconsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e6e2dc',
  },
  weekCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
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
    fontSize: 20,
    color: '#1e2b26',
  },
  weekArrows: {
    flexDirection: 'row',
    gap: 10,
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
    width: 42,
    height: 90,
    borderRadius: 18,
    gap: 6,
  },
  dayChipToday: {
    backgroundColor: '#0f2a24',
  },
  dayChipFocused: {
    backgroundColor: '#f0eee9',
    borderWidth: 1,
    borderColor: '#e1ddd6',
  },
  dayLetter: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#9aa09a',
  },
  dayLetterSelected: {
    color: '#d9e4dd',
  },
  dayLetterFocused: {
    color: '#6b746f',
  },
  dayNumber: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#4d5852',
  },
  dayNumberSelected: {
    color: '#f1f6f2',
  },
  dayNumberFocused: {
    color: '#2a332e',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1e2b26',
  },
  dotMuted: {
    backgroundColor: '#c9cdc9',
  },
  timeline: {
    position: 'relative',
    paddingBottom: 20,
  },
  timeLine: {
    position: 'absolute',
    left: 68,
    top: 10,
    bottom: 40,
    width: 2,
    backgroundColor: '#e1ddd6',
    zIndex: -1,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  timeWrapper: {
    width: 80,
    position: 'relative',
    alignItems: 'flex-end',
    paddingTop: 0, // Removed top padding to align with the very top of the card
    paddingRight: 24, // Space for dot and gap
  },
  timeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#2a332e',
    marginTop: 2, // Minor tweak for visual centering with the dot
  },
  timeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e1ddd6', // Neutral inactive color
    borderWidth: 2,
    borderColor: '#c9c4bc', // Muted inactive border
    position: 'absolute',
    right: 5,
    top: 4, // Aligned with the top section of the card
    zIndex: 1,
  },
  timeDotActive: {
    backgroundColor: '#2b4a3f', // Primary green when active
    borderColor: '#d7e4dd', // Light border for pop
  },
  eventCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    // Removed borders
  },
  eventCardPrimary: {
    backgroundColor: '#e9f3ec',
    // Removed borders
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
  metaDivider: {
    height: 1,
    backgroundColor: '#e2ded7',
    marginBottom: 8,
  },
  metaText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#4d5852',
  },
  emptyCard: {
    backgroundColor: '#f7f5f0',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e4e1db',
    alignItems: 'flex-start',
    gap: 10,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0ebe4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#1e2b26',
  },
  emptyBody: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#6b746f',
  },
});
