import React, { useEffect, useRef } from 'react';
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
import { shadowLg } from '../../ui/tokens/shadows';

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

  // Staggered Mount Entry Animations
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const contentSlideAnim = useRef(new Animated.Value(35)).current;
  const headerFadeAnim = useRef(new Animated.Value(0)).current;

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
        {/* Redesigned Subject Details Card (Luxury Linear Gradient Hero Card) */}
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

        {/* 1. Pending Tasks Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>Pending Tasks</Text>

          {/* Task 1 */}
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

          {/* Task 2 */}
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
            <Pressable style={styles.taskAddButton}>
              <Feather name="plus" size={20} color="#ffffff" />
            </Pressable>
          </CardScale>
        </View>

        {/* 2. Pinned Folders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderTitle}>Pinned Folders</Text>

          {/* Folder 1: Exam Prep (Full-Width) */}
          <CardScale style={styles.fullWidthFolderCard}>
            <View style={[styles.folderIconWrapper, { backgroundColor: '#FFEBEA' }]}>
              <Feather name="folder" size={20} color="#BA1A1A" />
            </View>
            <View style={styles.fullFolderBottomRow}>
              <View>
                <Text style={styles.folderTitle}>Exam Prep</Text>
                <Text style={styles.folderSubtitle}>Midterm upcoming</Text>
              </View>
              {/* Urgent Badge */}
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentBadgeText}>URGENT</Text>
              </View>
            </View>
          </CardScale>

          {/* Folder 2 & 3 Row (Half-Width) */}
          <View style={styles.folderGridRow}>
            {/* Folder 2: Homework */}
            <CardScale style={styles.halfWidthFolderCard}>
              <View style={[styles.folderIconWrapper, { backgroundColor: '#E6F4EA' }]}>
                <Feather name="folder" size={20} color="#2b4a3f" />
              </View>
              <View style={styles.halfFolderBottomWrapper}>
                <Text style={styles.folderTitle}>Homework</Text>
                <Text style={styles.folderSubtitle}>12 items</Text>
              </View>
            </CardScale>

            {/* Folder 3: Lecture Notes */}
            <CardScale style={styles.halfWidthFolderCard}>
              <View style={[styles.folderIconWrapper, { backgroundColor: '#1e2b26' }]}>
                <Feather name="folder" size={20} color="#ffffff" />
              </View>
              <View style={styles.halfFolderBottomWrapper}>
                <Text style={styles.folderTitle}>Lecture Notes</Text>
                <Text style={styles.folderSubtitle}>Week 1-6</Text>
              </View>
            </CardScale>
          </View>
        </View>

        {/* 3. Loose Notes Section */}
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
            <Pressable style={styles.newNoteButton}>
              <Feather name="plus" size={14} color="#2b4a3f" style={{ marginRight: 6 }} />
              <Text style={styles.newNoteButtonText}>NEW NOTE</Text>
            </Pressable>
          </View>
        </View>

        {/* Spacing bottom to allow scrolling over margins nicely */}
        <View style={{ height: 40 }} />
      </Animated.ScrollView>
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
});
