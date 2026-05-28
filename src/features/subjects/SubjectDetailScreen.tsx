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
  Modal,
  TextInput,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import DynamicIslandToast from '../../ui/DynamicIslandToast';
import { shadowLg, shadowLgDark } from '../../ui/tokens/shadows';
import {
  getFoldersBySubjectId,
  findRecentMatchingNote,
  getNotesBySubjectId,
  deleteNote,
  insertFolder,
  insertNote,
  updateNote,
  type FolderRecord,
  type NoteRecord,
} from '../../data/local/db';

declare const require: any;

const NoteEditorScreen = require('./NoteEditorScreen').default as React.ComponentType<{
  subjectId: string;
  subjectTitle: string;
  note: NoteRecord | null;
  folderOptions: Array<{ id: string; title: string; color: string }>;
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
  ) => Promise<NoteRecord>;
  onDelete: (noteId: string) => Promise<void> | void;
}>;

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

const FOLDER_COLORS = [
  '#0B3B39',
  '#1B4332',
  '#14532D',
  '#264653',
  '#2A4F4B',
  '#0F766E',
  '#4D7C0F',
  '#155E75',
  '#166534',
  '#1E3A5F',
  '#312E81',
  '#4C1D95',
  '#581C87',
  '#7F1D1D',
  '#78350F',
  '#92400E',
  '#374151',
  '#334155',
  '#172554',
  '#881337',
] as const;

export default function SubjectDetailScreen({ subject, onBack }: SubjectDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [selectedFolderColor, setSelectedFolderColor] = useState<(typeof FOLDER_COLORS)[number]>(FOLDER_COLORS[0]);
  const [isFoldersExpanded, setIsFoldersExpanded] = useState(false);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteRecord | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const saveInFlightRef = useRef<Promise<NoteRecord> | null>(null);
  const folderExpansionAnim = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(18)).current;
  const buttonRotate = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const folderSheetOpacity = useRef(new Animated.Value(0)).current;
  const folderSheetTranslate = useRef(new Animated.Value(18)).current;
  const featuredFolders = folders.slice(0, 3);
  const remainingFolders = folders.slice(3);
  const looseNotes = notes.filter((note) => !note.folderId);
  const folderNoteCounts = notes.reduce<Record<string, number>>((accumulator, note) => {
    if (note.folderId) {
      accumulator[note.folderId] = (accumulator[note.folderId] ?? 0) + 1;
    }

    return accumulator;
  }, {});

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadSubjectData = async () => {
      if (!subject?.id) {
        if (isMounted) {
          setFolders([]);
          setNotes([]);
        }
        return;
      }

      try {
        const [storedFolders, storedNotes] = await Promise.all([
          getFoldersBySubjectId(subject.id),
          getNotesBySubjectId(subject.id),
        ]);

        if (isMounted) {
          setFolders(storedFolders);
          setNotes(storedNotes);
        }
      } catch (error) {
        console.warn('Failed to load subject detail data', error);
        if (isMounted) {
          setFolders([]);
          setNotes([]);
        }
      }
    };

    loadSubjectData();

    return () => {
      isMounted = false;
    };
  }, [subject?.id, subject?.folders]);

  const handleOpenNoteEditor = (note: NoteRecord | null = null) => {
    setShowSaveToast(false);
    setShowDeleteToast(false);
    setIsActionSheetOpen(false);
    sheetOpacity.setValue(0);
    sheetTranslate.setValue(18);
    buttonRotate.setValue(0);
    buttonScale.setValue(0);
    setSelectedNote(note);
    setIsNoteEditorOpen(true);
  };

  const handleCloseNoteEditor = (options?: { saved?: boolean; deleted?: boolean }) => {
    setIsActionSheetOpen(false);
    sheetOpacity.setValue(0);
    sheetTranslate.setValue(18);
    buttonRotate.setValue(0);
    buttonScale.setValue(0);
    setIsFolderFormOpen(false);
    folderSheetOpacity.setValue(0);
    folderSheetTranslate.setValue(18);
    setIsNoteEditorOpen(false);
    setSelectedNote(null);

    if (options?.saved) {
      setShowSaveToast(true);
    }

    if (options?.deleted) {
      setShowDeleteToast(true);
    }
  };

  const handleSaveNote = async (
    noteId: string | null,
    draft: {
      subjectId: string;
      folderId: string | null;
      title: string;
      contentHtml: string;
      contentText: string;
      isPinned: boolean;
    }
  ): Promise<NoteRecord> => {
    if (saveInFlightRef.current) {
      return saveInFlightRef.current;
    }

    const savePromise = (async () => {
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

      if (subject?.id) {
        const refreshedNotes = await getNotesBySubjectId(subject.id);
        setNotes(refreshedNotes);
      }

      setSelectedNote(savedNote);

      return savedNote;
    })();

    saveInFlightRef.current = savePromise;

    try {
      const savedNote = await savePromise;
      return savedNote;
    } finally {
      if (saveInFlightRef.current === savePromise) {
        saveInFlightRef.current = null;
      }
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote(noteId);

    if (subject?.id) {
      const refreshedNotes = await getNotesBySubjectId(subject.id);
      setNotes(refreshedNotes);
    }
  };

  // Tab State
  const [activeTab, setActiveTab] = useState<'subject' | 'notes' | 'tasks'>('subject');
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

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

  if (isNoteEditorOpen) {
    return (
      <NoteEditorScreen
        subjectId={subject?.id ?? ''}
        subjectTitle={subject?.title ?? subject?.code ?? 'Subject'}
        note={selectedNote}
        folderOptions={folders.map((folder) => ({
          id: folder.id,
          title: folder.title,
          color: folder.color,
        }))}
        onClose={handleCloseNoteEditor}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
      />
    );
  }

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

  const handleOpenFolderForm = () => {
    handleCloseActions();
    setTimeout(() => {
      setIsFolderFormOpen(true);
      Animated.parallel([
        Animated.timing(folderSheetOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(folderSheetTranslate, {
          toValue: 0,
          friction: 8,
          tension: 42,
          useNativeDriver: true,
        }),
      ]).start();
    }, 220);
  };

  const handleCloseFolderForm = () => {
    Animated.parallel([
      Animated.timing(folderSheetOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(folderSheetTranslate, {
        toValue: 18,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsFolderFormOpen(false);
      }
    });
  };

  const handleSaveFolder = async () => {
    const name = folderName.trim();

    if (!name || !subject?.id) {
      return;
    }

    try {
      const savedFolder = await insertFolder({
        subjectId: subject.id,
        title: name,
        color: selectedFolderColor,
      });

      setFolders((current) => [
        ...current,
        {
          ...savedFolder,
          count: 0,
        },
      ]);
      setFolderName('');
      handleCloseFolderForm();
    } catch (error) {
      console.warn('Failed to save folder', error);
    }
  };

  const handleToggleFolderExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (isFoldersExpanded) {
      Animated.timing(folderExpansionAnim, {
        toValue: 0,
        duration: 180,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsFoldersExpanded(false);
        }
      });
      return;
    }

    setIsFoldersExpanded(true);
    Animated.timing(folderExpansionAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Workspace</Text>
                {remainingFolders.length > 0 ? (
                  <Pressable
                    onPress={handleToggleFolderExpansion}
                    style={styles.sectionHeaderActionButton}
                    accessibilityRole="button"
                    accessibilityLabel={isFoldersExpanded ? 'Collapse folders' : 'Expand folders'}
                  >
                    <Feather
                      name={isFoldersExpanded ? 'minus' : 'plus'}
                      size={18}
                      color="#1e2b26"
                    />
                  </Pressable>
                ) : null}
              </View>

              {folders.length === 0 ? (
                <View style={styles.workspaceEmptyState}>
                  <View style={styles.workspaceEmptyIconWrapper}>
                    <Feather name="folder" size={22} color="#8f968f" />
                  </View>
                  <Text style={styles.workspaceEmptyTitle}>No folders yet</Text>
                  <Text style={styles.workspaceEmptyBody}>
                    Folders will appear here once you add them to this subject.
                  </Text>
                </View>
              ) : (
                <View style={styles.folderStack}>
                  {(() => {
                    const renderFolderCard = (folder: any, variant: 'full' | 'compact') => {
                      const count = typeof folder.count === 'number' ? folder.count : (folderNoteCounts[folder.id] ?? 0);
                      const cardBackground = folder.color ?? '#2a4f4b';

                      return (
                        <View
                          key={folder.id ?? `${folder.title}-${variant}`}
                          style={[
                            styles.folderCard,
                            variant === 'full' ? styles.folderCardFull : styles.folderCardCompact,
                            { backgroundColor: cardBackground },
                          ]}
                        >
                          <LinearGradient
                            colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.01)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.folderCardSheen}
                          />
                          <View style={styles.folderCardTopRow}>
                            <Text style={styles.folderCardTitle} numberOfLines={1}>
                              {folder.title}
                            </Text>
                            <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.92)" />
                          </View>

                          <View style={styles.folderCardBottomRow}>
                            <Text style={styles.folderCardCount}>{count}</Text>
                            <Text style={styles.folderCardCountLabel}>items</Text>
                          </View>
                        </View>
                      );
                    };

                    const compactRows = [] as Array<[any | null, any | null]>;
                    for (let index = 0; index < remainingFolders.length; index += 2) {
                      compactRows.push([remainingFolders[index] ?? null, remainingFolders[index + 1] ?? null]);
                    }

                    return (
                      <>
                        {featuredFolders.length > 0 ? (
                          <View style={styles.folderGroup}>
                            {renderFolderCard(featuredFolders[0], 'full')}

                            {featuredFolders.length > 1 ? (
                              <View style={styles.folderGridRow}>
                                {renderFolderCard(featuredFolders[1], 'compact')}
                                {featuredFolders.length > 2 ? renderFolderCard(featuredFolders[2], 'compact') : <View style={styles.folderCardSpacer} />}
                              </View>
                            ) : null}
                          </View>
                        ) : null}

                        {isFoldersExpanded ? (
                          <Animated.View
                            style={[
                              styles.folderExpansionArea,
                              {
                                opacity: folderExpansionAnim,
                                transform: [
                                  {
                                    translateY: folderExpansionAnim.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [14, 0],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          >
                            {compactRows.map(([leftFolder, rightFolder], rowIndex) => (
                              <View key={`folder-row-${rowIndex}`} style={styles.folderGridRow}>
                                {leftFolder ? renderFolderCard(leftFolder, 'compact') : <View style={styles.folderCardSpacer} />}
                                {rightFolder ? renderFolderCard(rightFolder, 'compact') : <View style={styles.folderCardSpacer} />}
                              </View>
                            ))}
                          </Animated.View>
                        ) : null}
                      </>
                    );
                  })()}
                </View>
              )}
            </View>

            <Animated.View
              style={[
                styles.belowWorkspaceContent,
                {
                  opacity: folderExpansionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.98, 1],
                  }),
                  transform: [
                    {
                      translateY: folderExpansionAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 12],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Loose Notes Section */}
              <View style={styles.section}>
                <View style={styles.notesSectionHeader}>
                  <Feather name="file-text" size={22} color="#1e2b26" style={styles.notesHeaderIcon} />
                  <Text style={styles.sectionHeaderTitle}>Loose Notes</Text>
                  <Pressable
                    onPress={() => handleOpenNoteEditor()}
                    style={styles.sectionHeaderActionButton}
                    accessibilityRole="button"
                    accessibilityLabel="Create note"
                  >
                    <Feather name="plus" size={18} color="#1e2b26" />
                  </Pressable>
                </View>

                {looseNotes.length === 0 ? (
                  <View style={styles.looseNotesEmptyState}>
                    <View style={styles.looseNotesEmptyIconWrapper}>
                      <Feather name="file-text" size={22} color="#8f968f" />
                    </View>
                    <Text style={styles.looseNotesEmptyTitle}>No loose notes yet</Text>
                    <Text style={styles.looseNotesEmptyBody}>
                      Notes saved here stay outside folders for quick capture.
                    </Text>
                    <Pressable style={styles.looseNotesEmptyButton} onPress={() => handleOpenNoteEditor()}>
                      <Feather name="plus" size={16} color="#f9f9f6" />
                      <Text style={styles.looseNotesEmptyButtonText}>Create note</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.notesOuterContainer}>
                    {looseNotes.map((note) => (
                      <CardScale key={note.id} onPress={() => handleOpenNoteEditor(note)} style={styles.noteCard}>
                        <View style={styles.noteCardTopRow}>
                          <Text style={styles.noteCardTitle} numberOfLines={1}>
                            {note.title || 'Untitled note'}
                          </Text>
                          {note.isPinned ? <Feather name="star" size={14} color="#9A6700" /> : null}
                        </View>
                        <Text style={styles.noteCardPreview} numberOfLines={2}>
                          {note.contentText || 'Tap to start your first draft.'}
                        </Text>
                      </CardScale>
                    ))}
                  </View>
                )}
              </View>

              {/* Spacing bottom to allow scrolling over margins and floating dock nicely */}
              <View style={{ height: 110 }} />
            </Animated.View>
          </>
        )}
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
            <Pressable
              style={styles.actionButton}
              onPress={() => {
                handleCloseActions();
                setActiveTab('notes');
                handleOpenNoteEditor();
              }}
            >
              <View style={styles.actionIconCircle}>
                <Feather name="file-text" size={18} color="#1e2b26" />
              </View>
              <Text style={styles.actionText}>New Note</Text>
            </Pressable>

            {/* Shortcut 3: Create Folder */}
            <Pressable style={styles.actionButton} onPress={handleOpenFolderForm}>
              <View style={styles.actionIconCircle}>
                <Feather name="folder" size={18} color="#1e2b26" />
              </View>
              <Text style={styles.actionText}>Create Folder</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      <Modal
        visible={isFolderFormOpen}
        transparent
        animationType="none"
        onRequestClose={handleCloseFolderForm}
      >
        <View style={styles.folderFormOverlay}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: folderSheetOpacity }]}> 
            <BlurView
              intensity={80}
              tint="light"
              style={StyleSheet.absoluteFill}
              experimentalBlurMethod="none"
            />
            <View style={styles.folderFormBackdrop} />
          </Animated.View>

          <Pressable style={styles.folderFormPressTarget} onPress={handleCloseFolderForm} />

          <Animated.View
            style={[
              styles.folderFormSheet,
              {
                opacity: folderSheetOpacity,
                transform: [{ translateY: folderSheetTranslate }],
              },
            ]}
          >
            <View style={styles.folderFormHandle} />

            <View style={styles.folderFormHeader}>
              <Text style={styles.folderFormTitle}>Create Folder</Text>
            </View>

            <View style={styles.folderFormSection}>
              <Text style={styles.folderFormLabel}>Folder Name</Text>
              <View style={styles.folderFormInputShell}>
                <Feather name="folder" size={18} color="#59625d" style={styles.folderFormInputIcon} />
                <TextInput
                  value={folderName}
                  onChangeText={setFolderName}
                  placeholder="e.g. Fall Semester 2024"
                  placeholderTextColor="#c1c5c1"
                  style={styles.folderFormInput}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.folderFormSection}>
              <Text style={styles.folderFormLabel}>Folder Color</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.folderSwatchRow}
              >
                {FOLDER_COLORS.map((color) => {
                  const isSelected = selectedFolderColor === color;
                  return (
                    <Pressable
                      key={color}
                      onPress={() => setSelectedFolderColor(color)}
                      style={[
                        styles.folderSwatch,
                        {
                          backgroundColor: color,
                        },
                        isSelected && styles.folderSwatchSelected,
                      ]}
                    >
                      {isSelected ? <Feather name="check" size={20} color="#ffffff" /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.folderFormFooter}>
              <Pressable onPress={handleCloseFolderForm}>
                <Text style={styles.folderFormCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.folderFormSubmitButton, !folderName.trim() && styles.folderFormSubmitButtonDisabled]}
                onPress={handleSaveFolder}
                disabled={!folderName.trim()}
              >
                <Text style={styles.folderFormSubmitText}>Create Folder</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {showSaveToast ? (
        <DynamicIslandToast
          visible={showSaveToast}
          message="Note saved successfully"
          onHide={() => setShowSaveToast(false)}
        />
      ) : null}

      {showDeleteToast ? (
        <DynamicIslandToast
          visible={showDeleteToast}
          message="Note deleted successfully"
          onHide={() => setShowDeleteToast(false)}
        />
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  workspaceEmptyState: {
    backgroundColor: '#f3f2ee',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  workspaceEmptyIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e1d8',
  },
  workspaceEmptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 17,
    color: '#1e2b26',
    marginBottom: 8,
  },
  workspaceEmptyBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#6b746f',
    textAlign: 'center',
    marginBottom: 14,
  },
  folderCard: {
    flex: 1,
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...shadowLg,
  },
  folderCardFull: {
    minHeight: 144,
  },
  folderCardCompact: {
    minHeight: 118,
  },
  folderCardSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  folderCardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  folderCardTitle: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    lineHeight: 21,
    color: '#ffffff',
    letterSpacing: -0.1,
  },
  folderCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  folderCardCount: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 34,
    lineHeight: 36,
    color: '#ffffff',
    letterSpacing: -0.8,
  },
  folderCardCountLabel: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.78)',
    paddingBottom: 2,
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
  notesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeaderActionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesHeaderIcon: {
    marginRight: 10,
  },
  looseNotesEmptyState: {
    backgroundColor: '#f3f2ee',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
  },
  looseNotesEmptyIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e1d8',
  },
  looseNotesEmptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#1e2b26',
    marginBottom: 6,
  },
  looseNotesEmptyBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#6b746f',
    textAlign: 'center',
    marginBottom: 16,
  },
  looseNotesEmptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#16312b',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadowLgDark,
  },
  looseNotesEmptyButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#f9f9f6',
  },
  notesOuterContainer: {
    backgroundColor: '#f3f2ee',
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  folderStack: {
    gap: 14,
  },
  folderGroup: {
    gap: 12,
  },
  folderGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  folderCardSpacer: {
    flex: 1,
  },
  folderExpansionArea: {
    gap: 12,
    overflow: 'hidden',
  },
  belowWorkspaceContent: {
    gap: 0,
  },
  folderFormOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  folderFormBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 15, 14, 0.28)',
  },
  folderFormPressTarget: {
    ...StyleSheet.absoluteFillObject,
  },
  folderFormSheet: {
    backgroundColor: '#F9F9F6',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 14,
  },
  folderFormHandle: {
    width: 68,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e3e0d8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  folderFormHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  folderFormTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 26,
    lineHeight: 32,
    color: '#101413',
    letterSpacing: -0.3,
  },
  folderFormSection: {
    marginBottom: 16,
  },
  folderFormLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#39423e',
    marginBottom: 8,
  },
  folderFormInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e6e2da',
    paddingHorizontal: 16,
    ...shadowLg,
  },
  folderFormInputIcon: {
    marginRight: 10,
  },
  folderFormInput: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: '#1e2b26',
    paddingVertical: 0,
  },
  folderSwatchRow: {
    gap: 12,
    paddingRight: 8,
  },
  folderSwatch: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  folderSwatchSelected: {
    borderColor: '#111111',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  folderFormFooter: {
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0ed',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  folderFormCancelText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#9aa09a',
    paddingHorizontal: 8,
  },
  folderFormSubmitButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#0f201b',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLgDark,
  },
  folderFormSubmitButtonDisabled: {
    opacity: 0.5,
  },
  folderFormSubmitText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#F9F9F6',
    letterSpacing: 0.2,
  },
  noteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    ...shadowLg,
  },
  noteCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  noteCardTitle: {
    flex: 1,
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#1e2b26',
  },
  noteCardPreview: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#2a332e',
    lineHeight: 20,
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
