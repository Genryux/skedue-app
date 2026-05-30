import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { getSubjects, insertSubject, type SubjectRecord } from '../../data/local/db';
import { shadowLg, shadowLgDark } from '../../ui/tokens/shadows';
import { parseTimeToMinutes } from '../../utils/timeUtils';
import ScheduleScreen from '../schedule/ScheduleScreen';
import AddSubjectScreen from '../subjects/AddSubjectScreen';
import SubjectsScreen from '../subjects/SubjectsScreen';
import DynamicIslandToast from '../../ui/DynamicIslandToast';
import SubjectDetailScreen from '../subjects/SubjectDetailScreen';

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
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isAddSubjectOpen, setIsAddSubjectOpen] = useState(false);
  const [isSubjectDetailOpen, setIsSubjectDetailOpen] = useState(false);
  const [selectedSubjectDetail, setSelectedSubjectDetail] = useState<any>(null);

  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(18)).current;
  const buttonRotate = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;

  // Transitions
  const subjectSlideAnim = useRef(new Animated.Value(0)).current; // 0: hidden, 1: visible
  const subjectDetailSlideAnim = useRef(new Animated.Value(0)).current; // 0: offscreen, 1: onscreen

  // Success Toast State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Time state for real-time updates
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  // Placeholder data for tasks and notes (not in DB yet)
  const pendingTasks: Array<{ id: string; title: string; due: string }> = [];
  const recentNotes: Array<{ id: string; title: string; preview: string }> = [];

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000); // Update every 30s
    return () => clearInterval(timer);
  }, []);

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
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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
  }, [dbSubjects, now]);

  const dynamicGreeting = useMemo(() => {
    const hour = now.getHours();
    let timeGreeting = "Good Morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good Afternoon";
    if (hour >= 17 && hour < 22) timeGreeting = "Good Evening";
    if (hour >= 22 || hour < 5) timeGreeting = "Working Late";

    const todayDay = now.getDay();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    
    const todaySubjects = dbSubjects.filter(s => (s.days ?? []).some(d => DAY_MAP[d] === todayDay));
    
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
    setIsActionSheetOpen(false);
    setIsAddSubjectOpen(true);
    
    Animated.timing(subjectSlideAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleCancelAddSubject = () => {
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

  const handleSaveSubject = async (subjectData: Omit<SubjectRecord, 'id' | 'createdAt'>) => {
    try {
      const savedSubject = await insertSubject(subjectData);
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

  // Format subjects for the All Subjects tab
  const subjects = useMemo(() => {
    return dbSubjects.map((s) => ({
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
      tasksCount: 0,
      notesCount: 0,
    }));
  }, [dbSubjects]);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.mainContent,
          {
            opacity: subjectSlideAnim.interpolate({
              inputRange: [0, 0.5],
              outputRange: [1, 0],
            }),
            transform: [{
              scale: subjectSlideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.94],
              })
            }]
          }
        ]}
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
          />
        ) : activeTab === 'schedule' ? (
          <ScheduleScreen subjects={dbSubjects} />
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
                        {dbSubjects.length > 0 ? 'No more classes today' : 'No upcoming classes'}
                      </Text>
                      <Text style={styles.nextClassEmptyBody}>
                        {dbSubjects.length > 0 
                          ? 'Check your schedule tab for the rest of the week.' 
                          : 'Add your first subject to see today\'s schedule.'}
                      </Text>
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

      </Animated.View>

      {isAddSubjectOpen && (
        <Animated.View 
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#f8f7f2',
              transform: [{
                translateY: subjectSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1000, 0],
                })
              }]
            }
          ]}
        >
          <AddSubjectScreen onBack={handleCancelAddSubject} onSave={handleSaveSubject} />
        </Animated.View>
      )}

      {isSubjectDetailOpen && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#f8f7f2',
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
          />
        </Animated.View>
      )}

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
    paddingHorizontal: 24,
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
    right: 24,
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
    paddingHorizontal: 24,
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
});