import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getSubjects, insertSubject, type SubjectRecord } from '../../data/local/db';
import { shadowLg, shadowLgDark } from '../../ui/tokens/shadows';
import ScheduleScreen from '../schedule/ScheduleScreen';
import AddSubjectScreen from '../subjects/AddSubjectScreen';
import SubjectsScreen from '../subjects/SubjectsScreen';

const formatTime = (time: string | null | undefined) => {
  if (!time) return '';
  // If the string already contains AM/PM (stored by AddSubjectScreen), pass through
  if (/am|pm/i.test(time)) return time;
  // Otherwise parse as HH:MM 24h
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
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

const parseTimeToMinutes = (time: string | null | undefined) => {
  if (!time) return null;
  const hasAmPm = /am|pm/i.test(time);
  const clean = time.replace(/am|pm/gi, '').trim();
  const [hRaw, mRaw] = clean.split(':').map(Number);
  if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) return null;
  let hours = hRaw;
  const minutes = mRaw;

  if (hasAmPm) {
    const ampm = time.match(/am|pm/i)?.[0]?.toUpperCase();
    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
  }

  return hours * 60 + minutes;
};

const formatMinutesDiff = (minutes: number) => {
  if (minutes <= 1) return 'In 1 min';
  return `In ${minutes} mins`;
};

export default function MainScreen() {
  const [activeTab, setActiveTab] = useState<'home' | 'schedule' | 'subjects'>('home');
  const [dbSubjects, setDbSubjects] = useState<SubjectRecord[]>([]);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(18)).current;

  // Placeholder data for tasks and notes (not in DB yet)
  const pendingTasks: Array<{ id: string; title: string; due: string }> = [];
  const recentNotes: Array<{ id: string; title: string; preview: string }> = [];

  useEffect(() => {
    let isMounted = true;
    getSubjects()
      .then((rows) => {
        if (isMounted) setDbSubjects(rows);
      })
      .catch((err) => console.warn('MainScreen: failed to load subjects', err));
    return () => {
      isMounted = false;
    };
  }, []);

  const dateLabel = new Date()
    .toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    .toUpperCase();

  const nextClassState = useMemo(() => {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const todayDay = now.getDay();

    const classesToday = dbSubjects
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
  }, [dbSubjects]);

  const handleOpenActions = () => {
    setIsActionSheetOpen(true);
    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslate, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCloseActions = () => {
    Animated.parallel([
      Animated.timing(sheetOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslate, {
        toValue: 18,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsActionSheetOpen(false);
      }
    });
  };

  const handleStartAddSubject = () => {
    setIsActionSheetOpen(false);
    setIsAddSubjectOpen(true);
  };

  const handleCancelAddSubject = () => {
    setIsAddSubjectOpen(false);
  };

  const handleSaveSubject = async (subjectData: Omit<SubjectRecord, 'id' | 'createdAt'>) => {
    try {
      const savedSubject = await insertSubject(subjectData);
      setDbSubjects((prev) => [...prev, savedSubject]);
      setIsAddSubjectOpen(false);
    } catch (error) {
      console.warn('Failed to save subject', error);
    }
  };

  // Format subjects for the All Subjects tab
  const subjects = useMemo(() => {
    return dbSubjects.map((s) => ({
      id: s.id,
      code: s.code ?? s.title.slice(0, 6).toUpperCase(),
      title: s.title,
      instructor: s.instructor ?? '',
      days: s.days ? s.days.join(', ') : '',
      time:
        s.startTime && s.endTime
          ? `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`
          : s.startTime
            ? formatTime(s.startTime)
            : '',
      location: s.location ?? '',
      tasksCount: 0,
      notesCount: 0,
    }));
  }, [dbSubjects]);

  return (
    <View style={styles.container}>
      {activeTab !== 'schedule' ? (
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
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {activeTab === 'subjects' ? (
          <SubjectsScreen subjects={subjects} />
        ) : activeTab === 'schedule' ? (
          <ScheduleScreen subjects={dbSubjects} />
        ) : (
          <>
            <View style={styles.titleBlock}>
              <Text style={styles.dateText}>{dateLabel}</Text>
              <Text style={styles.title}>Your Day</Text>
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
                      <Text style={styles.nextClassEmptyTitle}>No upcoming classes</Text>
                      <Text style={styles.nextClassEmptyBody}>Add your first subject to see today's schedule.</Text>
                    </View>
                  )}
                </LinearGradient>

                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.cardIconCircle}>
                        <Feather name="check-circle" size={18} color="#1e2b26" />
                      </View>
                      <Text style={styles.cardTitle}>Pending Tasks</Text>
                    </View>
                    <Feather name="more-horizontal" size={18} color="#6d756f" />
                  </View>

                  {pendingTasks.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>No pending tasks</Text>
                      <Text style={styles.emptyBody}>Add a task to keep track of upcoming work.</Text>
                    </View>
                  ) : (
                    pendingTasks.map((task) => (
                      <View key={task.id} style={styles.taskRow}>
                        <View style={styles.taskCheckbox} />
                        <View>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          <Text style={styles.taskMeta}>{task.due}</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={styles.cardIconCircle}>
                        <Feather name="edit-3" size={18} color="#1e2b26" />
                      </View>
                      <Text style={styles.cardTitle}>Recent Notes</Text>
                    </View>
                    <Feather name="external-link" size={18} color="#6d756f" />
                  </View>

                  {recentNotes.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyTitle}>No notes yet</Text>
                      <Text style={styles.emptyBody}>Create a note to capture your first class insights.</Text>
                    </View>
                  ) : (
                    recentNotes.map((note) => (
                      <View key={note.id} style={styles.noteCard}>
                        <Text style={styles.noteTitle}>{note.title}</Text>
                        <Text style={styles.noteBody}>{note.preview}</Text>
                      </View>
                    ))
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
        <Pressable style={styles.navAddButton} onPress={handleOpenActions}>
          <Feather name="plus" size={22} color="#f4f7f4" />
        </Pressable>
      </View>
      {isActionSheetOpen ? (
        <View style={styles.actionSheetOverlay}>
          <Animated.View style={[styles.actionSheetBackdrop, { opacity: sheetOpacity }]} />
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
          </Animated.View>
        </View>
      ) : null}
      <Modal visible={isAddSubjectOpen} animationType="slide" presentationStyle="fullScreen">
        <AddSubjectScreen onBack={handleCancelAddSubject} onSave={handleSaveSubject} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0,
    overflow: 'visible',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e6e2dc',
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 140,
  },
  scrollView: {
    overflow: 'visible',
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
    fontSize: 30,
  },
  subtitle: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#6b746f',
  },
  nextClassCard: {
    borderRadius: 26,
    padding: 20,
    marginBottom: 18,
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
  },
  emptyState: {
    paddingVertical: 14,
  },
  emptyCard: {
    backgroundColor: '#f9f6f1',
    borderRadius: 18,
    padding: 16,
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
    backgroundColor: '#f9f6f1',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  noteTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#2a332e',
    marginBottom: 6,
  },
  noteBody: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#6b746f',
  },
  navDock: {
    position: 'absolute',
    left: 24,
    right: 24,
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
    backgroundColor: '#2b4a3f',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLgDark,
  },
  actionSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  actionSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 13, 0.46)',
  },
  actionSheetPressTarget: {
    ...StyleSheet.absoluteFillObject,
  },
  actionSheetPanel: {
    paddingHorizontal: 24,
    paddingBottom: 120,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e1db',
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
});