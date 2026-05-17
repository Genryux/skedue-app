import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { shadowLg, shadowLgDark } from '../../ui/tokens/shadows';

type SubjectDetailScreenProps = {
  subject: any;
  onBack: () => void;
};

// Premium Touch Feedback - Scales down card on press and springs back on release
const CardScale = ({
  children,
  onPress,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
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

export default function SubjectDetailScreen({ subject, onBack }: SubjectDetailScreenProps) {
  const insets = useSafeAreaInsets();

  // Tab State
  const [activeTab, setActiveTab] = useState<'subject' | 'notes' | 'tasks'>('subject');
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  // Staggered Mount Entry Animations
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const contentSlideAnim = useRef(new Animated.Value(35)).current;
  const headerFadeAnim = useRef(new Animated.Value(0)).current;

  // Bottom Sheet Animations
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(18)).current;
  const buttonRotate = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerFadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentSlideAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.1)),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

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

  return (
    <View style={styles.container}>
      {/* Header Bar - Safe from notification bar */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerFadeAnim,
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 12 : 8),
          },
        ]}
      >
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color="#1e2b26" />
        </Pressable>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubjectCode}>{subject?.code ?? 'MTH 301'}</Text>
        </View>

        <Pressable style={styles.headerActionButton}>
          <Feather name="more-vertical" size={22} color="#1e2b26" />
        </Pressable>
      </Animated.View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        style={{
          opacity: contentFadeAnim,
          transform: [{ translateY: contentSlideAnim }],
        }}
      >
        {/* Dynamic Screen Content Based on Active Tab */}
        {activeTab === 'subject' && (
          <>
            {/* Subject details card (Luxury Linear Gradient Hero Card) */}
            <LinearGradient
              colors={['#16312b', '#0f201b']}
              style={styles.heroCard}
            >
              {/* Top Row: Academic Period Pill */}
              <View style={styles.periodPill}>
                <Text style={styles.periodPillText}>
                  {subject?.term || '1ST SEMESTER'}
                </Text>
              </View>

              {/* Prominent Subject Title */}
              <Text style={styles.heroSubjectTitle}>
                {subject?.title ?? 'Advanced Calculus'}
              </Text>

              {/* Divider */}
              <View style={styles.heroDivider} />

              {/* Bottom Grid Rows for Details */}
              <View style={styles.cardMetaRows}>
                {/* Row 1: Who & Where */}
                <View style={styles.cardMetaRow}>
                  <View style={styles.cardMetaItem}>
                    <Feather name="user" size={14} color="#A2C9BA" style={styles.metaIcon} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>
                      {subject?.instructor || 'Dr. Elena Rostova'}
                    </Text>
                  </View>
                  <View style={styles.cardMetaItem}>
                    <Feather name="map-pin" size={14} color="#A2C9BA" style={styles.metaIcon} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>
                      {subject?.location || 'Room 402, Tech Bldg'}
                    </Text>
                  </View>
                </View>

                {/* Row 2: Days & Times */}
                <View style={[styles.cardMetaRow, { marginTop: 10 }]}>
                  <View style={styles.cardMetaItem}>
                    <Feather name="calendar" size={14} color="#A2C9BA" style={styles.metaIcon} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>
                      {subject?.days && subject.days.length > 0
                        ? subject.days.join(', ')
                        : 'Mon, Wed, Fri'}
                    </Text>
                  </View>
                  <View style={styles.cardMetaItem}>
                    <Feather name="clock" size={14} color="#A2C9BA" style={styles.metaIcon} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>
                      {subject?.time || '2:00 PM - 3:30 PM'}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Redesigned Pending Tasks Section (3 Real Tasks, Urgent on Top) */}
            <View style={styles.section}>
              <Text style={styles.sectionHeaderTitle}>Pending Tasks</Text>

              {/* Task 1: Urgent (Top Priority) */}
              <CardScale onPress={() => setActiveTab('tasks')} style={[styles.taskCard, styles.urgentTaskCard]}>
                <View style={styles.taskCheckbox}>
                  <Feather name="square" size={20} color="#BA1A1A" />
                </View>
                <View style={styles.taskTextWrapper}>
                  <Text style={[styles.taskTitle, { color: '#BA1A1A' }]}>Math Assignment 3 - Fourier Series</Text>
                  <View style={styles.taskDueDateRow}>
                    <Feather name="clock" size={13} color="#BA1A1A" style={styles.dueIcon} />
                    <Text style={[styles.taskDueDateText, { color: '#BA1A1A', fontFamily: 'Manrope_700Bold' }]}>Due in 2 hours</Text>
                  </View>
                </View>
                <View style={styles.urgentTaskBadge}>
                  <Text style={styles.urgentTaskBadgeText}>URGENT</Text>
                </View>
              </CardScale>

              {/* Task 2: Regular */}
              <CardScale onPress={() => setActiveTab('tasks')} style={styles.taskCard}>
                <View style={styles.taskCheckbox}>
                  <Feather name="square" size={20} color="#a0aba5" />
                </View>
                <View style={styles.taskTextWrapper}>
                  <Text style={styles.taskTitle}>Problem Set 4</Text>
                  <View style={styles.taskDueDateRow}>
                    <Feather name="calendar" size={13} color="#6b746f" style={styles.dueIcon} />
                    <Text style={styles.taskDueDateText}>Due Tomorrow</Text>
                  </View>
                </View>
              </CardScale>

              {/* Task 3: Regular */}
              <CardScale onPress={() => setActiveTab('tasks')} style={styles.taskCard}>
                <View style={styles.taskCheckbox}>
                  <Feather name="square" size={20} color="#a0aba5" />
                </View>
                <View style={styles.taskTextWrapper}>
                  <Text style={styles.taskTitle}>Read Chapter 7: Integration</Text>
                  <View style={styles.taskDueDateRow}>
                    <Feather name="calendar" size={13} color="#6b746f" style={styles.dueIcon} />
                    <Text style={styles.taskDueDateText}>Due Thursday</Text>
                  </View>
                </View>
              </CardScale>
            </View>

            {/* Redesigned Recent Notes Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeaderTitle}>Recent Notes</Text>
              
              {/* Note 1 */}
              <CardScale onPress={() => setActiveTab('notes')} style={styles.recentNoteCard}>
                <View style={styles.noteHeaderRow}>
                  <Feather name="file-text" size={16} color="#2b4a3f" style={{ marginRight: 8 }} />
                  <Text style={styles.recentNoteTitle}>Theorem 4.1 Proofs</Text>
                </View>
                <Text style={styles.recentNoteBody} numberOfLines={2}>
                  Theorem 4.1 proof variations from office hours, including integration bounds and derivatives...
                </Text>
              </CardScale>

              {/* Note 2 */}
              <CardScale onPress={() => setActiveTab('notes')} style={styles.recentNoteCard}>
                <View style={styles.noteHeaderRow}>
                  <Feather name="file-text" size={16} color="#2b4a3f" style={{ marginRight: 8 }} />
                  <Text style={styles.recentNoteTitle}>Midterm Prep Ideas</Text>
                </View>
                <Text style={styles.recentNoteBody} numberOfLines={2}>
                  Study group ideas for midterm prep, focusing on double integrals, vectors, and polar coords.
                </Text>
              </CardScale>
            </View>
          </>
        )}

        {activeTab === 'tasks' && (
          <View style={styles.section}>
            <Text style={styles.sectionHeaderTitle}>Pending Tasks</Text>

            {/* Task 1: Urgent (Top Priority) */}
            <CardScale style={[styles.taskCard, styles.urgentTaskCard]}>
              <View style={styles.taskCheckbox}>
                <Feather name="square" size={20} color="#BA1A1A" />
              </View>
              <View style={styles.taskTextWrapper}>
                <Text style={[styles.taskTitle, { color: '#BA1A1A' }]}>Math Assignment 3 - Fourier Series</Text>
                <View style={styles.taskDueDateRow}>
                  <Feather name="clock" size={13} color="#BA1A1A" style={styles.dueIcon} />
                  <Text style={[styles.taskDueDateText, { color: '#BA1A1A', fontFamily: 'Manrope_700Bold' }]}>Due in 2 hours</Text>
                </View>
              </View>
              <View style={styles.urgentTaskBadge}>
                <Text style={styles.urgentTaskBadgeText}>URGENT</Text>
              </View>
            </CardScale>

            {/* Task 2 */}
            <CardScale style={styles.taskCard}>
              <View style={styles.taskCheckbox}>
                <Feather name="square" size={20} color="#a0aba5" />
              </View>
              <View style={styles.taskTextWrapper}>
                <Text style={styles.taskTitle}>Problem Set 4</Text>
                <View style={styles.taskDueDateRow}>
                  <Feather name="calendar" size={13} color="#6b746f" style={styles.dueIcon} />
                  <Text style={styles.taskDueDateText}>Due Tomorrow</Text>
                </View>
              </View>
            </CardScale>

            {/* Task 3 */}
            <CardScale style={styles.taskCardWithButton}>
              <View style={styles.taskCardMainContent}>
                <View style={styles.taskCheckbox}>
                  <Feather name="square" size={20} color="#a0aba5" />
                </View>
                <View style={styles.taskTextWrapper}>
                  <Text style={styles.taskTitle}>Read Chapter 7: Integration</Text>
                  <View style={styles.taskDueDateRow}>
                    <Feather name="calendar" size={13} color="#6b746f" style={styles.dueIcon} />
                    <Text style={styles.taskDueDateText}>Due Thursday</Text>
                  </View>
                </View>
              </View>
              
              {/* Embedded dark circular plus button */}
              <Pressable style={styles.taskAddButton} onPress={handleOpenActions}>
                <Feather name="plus" size={20} color="#ffffff" />
              </Pressable>
            </CardScale>
          </View>
        )}

        {activeTab === 'notes' && (
          <>
            {/* Workspace Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeaderTitle}>Workspace</Text>

              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyStateIconWrapper}>
                  <Feather name="folder-plus" size={32} color="#a7b7af" />
                </View>
                <Text style={styles.emptyStateTitle}>Your workspace is empty</Text>
                <Text style={styles.emptyStateBody}>
                  Create folders and notes to organize your study materials.
                </Text>
              </View>
            </View>

            {/* Loose Notes Section */}
            <View style={styles.section}>
              <View style={styles.notesSectionHeader}>
                <Feather name="file-text" size={22} color="#1e2b26" style={styles.notesHeaderIcon} />
                <Text style={styles.sectionHeaderTitle}>Loose Notes</Text>
              </View>

              {/* Grey Container Card */}
              <View style={styles.notesOuterContainer}>
                {/* Note 1 */}
                <CardScale style={styles.noteCard}>
                  <Text style={styles.noteText} numberOfLines={2}>
                    Theorem 4.1 proof variations from office hours...
                  </Text>
                </CardScale>

                {/* Note 2 */}
                <CardScale style={styles.noteCard}>
                  <Text style={styles.noteText} numberOfLines={2}>
                    Study group ideas for midterm prep.
                  </Text>
                </CardScale>

                {/* New Note Button */}
                <Pressable style={styles.newNoteButton} onPress={handleOpenActions}>
                  <Feather name="plus" size={14} color="#2b4a3f" style={{ marginRight: 6 }} />
                  <Text style={styles.newNoteButtonText}>NEW NOTE</Text>
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Spacing bottom to allow scrolling over margins and floating dock nicely */}
        <View style={{ height: 110 }} />
      </Animated.ScrollView>

      {/* Floating Bottom Tab Bar Navigation (Recreating Home Screen style exactly) */}
      <View style={styles.navDock}>
        <View style={styles.navPill}>
          <Pressable style={styles.navItem} onPress={() => setActiveTab('subject')}>
            <View style={[styles.navItemInner, activeTab === 'subject' ? styles.navItemActive : null]}>
              <Feather name="book-open" size={18} color={activeTab === 'subject' ? '#d7e4dd' : '#5c6762'} />
              <Text style={activeTab === 'subject' ? styles.navLabelActive : styles.navLabel}>Subject</Text>
            </View>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setActiveTab('notes')}>
            <View style={[styles.navItemInner, activeTab === 'notes' ? styles.navItemActive : null]}>
              <Feather name="folder" size={18} color={activeTab === 'notes' ? '#d7e4dd' : '#5c6762'} />
              <Text style={activeTab === 'notes' ? styles.navLabelActive : styles.navLabel}>Notes</Text>
            </View>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => setActiveTab('tasks')}>
            <View style={[styles.navItemInner, activeTab === 'tasks' ? styles.navItemActive : null]}>
              <Feather name="check-circle" size={18} color={activeTab === 'tasks' ? '#d7e4dd' : '#5c6762'} />
              <Text style={activeTab === 'tasks' ? styles.navLabelActive : styles.navLabel}>Tasks</Text>
            </View>
          </Pressable>
        </View>

        {/* Plus Button beside the navigation bar */}
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

      {/* Interactive Action Sheet Modal */}
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
            {/* Shortcut 1: Add Task */}
            <Pressable style={styles.actionButton} onPress={() => { handleCloseActions(); setActiveTab('tasks'); }}>
              <View style={styles.actionIconCircle}>
                <Feather name="check-square" size={18} color="#1e2b26" />
              </View>
              <Text style={styles.actionText}>Add Task</Text>
            </Pressable>

            {/* Shortcut 2: New Note */}
            <Pressable style={styles.actionButton} onPress={() => { handleCloseActions(); setActiveTab('notes'); }}>
              <View style={styles.actionIconCircle}>
                <Feather name="file-text" size={18} color="#1e2b26" />
              </View>
              <Text style={styles.actionText}>New Note</Text>
            </Pressable>

            {/* Shortcut 3: Create Folder */}
            <Pressable style={styles.actionButton} onPress={() => { handleCloseActions(); setActiveTab('notes'); }}>
              <View style={styles.actionIconCircle}>
                <Feather name="folder" size={18} color="#1e2b26" />
              </View>
              <Text style={styles.actionText}>Create Folder</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f7f2', // Primary warm neutral background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#f8f7f2', // Clean solid top bar matches background
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLg,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerSubjectCode: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#1e2b26',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  headerActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLg,
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 24,
    shadowColor: '#16312b',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  periodPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  periodPillText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: '#A2C9BA',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroSubjectTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 26,
    color: '#ffffff',
    marginTop: 18,
    marginBottom: 20,
    lineHeight: 34,
  },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 18,
  },
  cardMetaRows: {
    width: '100%',
  },
  cardMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metaIcon: {
    marginRight: 6,
  },
  cardMetaText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#d1e3db',
    flex: 1,
  },
  section: {
    marginBottom: 26,
  },
  sectionHeaderTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 22,
    color: '#1e2b26',
    marginBottom: 14,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    ...shadowLg,
  },
  taskCardWithButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 14,
    marginBottom: 12,
    ...shadowLg,
  },
  taskCardMainContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  dueIcon: {
    marginRight: 4,
  },
  taskDueDateText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#6b746f',
  },
  taskAddButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0f2a24',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadowLg,
  },
  urgentTaskCard: {
    backgroundColor: '#FFF5F5',
  },
  urgentTaskBadge: {
    backgroundColor: '#BA1A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  urgentTaskBadgeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 9,
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  recentNoteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    ...shadowLg,
  },
  noteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentNoteTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#1e2b26',
  },
  recentNoteBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#6b746f',
    lineHeight: 18,
  },
  fullWidthFolderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    ...shadowLg,
  },
  folderIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  fullFolderBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  folderTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
    marginBottom: 2,
  },
  folderSubtitle: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#6b746f',
  },
  urgentBadge: {
    backgroundColor: '#BA1A1A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  urgentBadgeText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 10,
    color: '#ffffff',
    letterSpacing: 0.6,
  },
  folderGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidthFolderCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    ...shadowLg,
  },
  halfFolderBottomWrapper: {
    marginTop: 4,
  },
  notesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  notesHeaderIcon: {
    marginRight: 10,
  },
  notesOuterContainer: {
    backgroundColor: '#eeeae1', // Warm container low gray
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  noteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    ...shadowLg,
  },
  noteText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#2a332e',
    lineHeight: 20,
  },
  newNoteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  newNoteButtonText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 13,
    color: '#2b4a3f',
    letterSpacing: 1.0,
  },
  navDock: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
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
