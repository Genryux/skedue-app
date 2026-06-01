import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  BackHandler,
  RefreshControl,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { usePathname, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import DynamicIslandToast from '../../ui/DynamicIslandToast';
import { shadowLg, shadowLgDark } from '../../ui/tokens/shadows';
import { springModalSlide, useDragToClose } from '../../ui/tokens/animations';
import { formatTimeDisplay, parseTimeToMinutes } from '../../utils/timeUtils';
import { findTimeConflicts } from './conflictUtils';
import {
  getFoldersBySubjectId,
  findRecentMatchingNote,
  getNotesBySubjectId,
  getSubjects,
  deleteNote,
  insertFolder,
  insertNote,
  updateNote,
  updateSubject,
  deleteSubject,
  type FolderRecord,
  type NoteRecord,
  type SubjectRecord,
} from '../../data/local/db';

declare const require: any;

const NoteEditorScreen = require('./NoteEditorScreen').default as React.ComponentType<{
  subjectId: string;
  subjectTitle: string;
  note: NoteRecord | null;
  folderOptions: Array<{ id: string; title: string; color: string }>;
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
  ) => Promise<NoteRecord>;
  onDelete: (noteId: string) => Promise<void> | void;
}>;

type SubjectDetailScreenProps = {
  subject: any;
  onBack: () => void;
  onUpdate?: (updatedSubject?: any) => void;
  onDelete?: (deletedTitle?: string) => void;
  onArchive?: (archivedTitle?: string) => void;
  onUnarchive?: (unarchivedTitle?: string) => void;
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

export const FOLDER_COLORS = [
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

export const FOLDER_BG_COLORS = [
  '#D9F2EF',
  '#E1F0E8',
  '#DCF4E2',
  '#E3EEF1',
  '#E2F0EE',
  '#D7F4F1',
  '#EEF7D8',
  '#DCEFF5',
  '#E0F5E3',
  '#E3EBF8',
  '#E8E7FC',
  '#EFE8FC',
  '#F2E8FC',
  '#FBE8E8',
  '#FAF0E2',
  '#FDF2D8',
  '#F3F4F6',
  '#F1F5F9',
  '#E7EDFF',
  '#FCE7F3',
] as const;

export const getFolderBgColor = (folderColor: string): string => {
  const idx = (FOLDER_COLORS as readonly string[]).indexOf(folderColor);
  return idx >= 0 ? FOLDER_BG_COLORS[idx] : '#f8f7f2';
};

const DAYS = [
  { label: 'Su', value: 'Su' },
  { label: 'Mo', value: 'Mo' },
  { label: 'Tu', value: 'Tu' },
  { label: 'We', value: 'We' },
  { label: 'Th', value: 'Th' },
  { label: 'Fr', value: 'Fr' },
  { label: 'Sa', value: 'Sa' },
] as const;

export default function SubjectDetailScreen({ subject, onBack, onUpdate, onDelete, onArchive, onUnarchive }: SubjectDetailScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
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
  const [showSubjectSavedToast, setShowSubjectSavedToast] = useState(false);
  const [showFolderCreatedToast, setShowFolderCreatedToast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const saveInFlightRef = useRef<Promise<NoteRecord> | null>(null);
  const folderExpansionAnim = useRef(new Animated.Value(0)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(18)).current;
  const buttonRotate = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0)).current;
  const buttonAnims = useRef(Array.from({ length: 3 }, () => new Animated.Value(0))).current;
  const folderFormSlide = useRef(new Animated.Value(0)).current;
  const folderFormOpacity = useRef(new Animated.Value(0)).current;
  const [isSubjectSheetOpen, setIsSubjectSheetOpen] = useState(false);
  const subjectSheetSlide = useRef(new Animated.Value(0)).current;
  const subjectSheetOpacity = useRef(new Animated.Value(0)).current;
  const [subjectSheetView, setSubjectSheetView] = useState<'main' | 'editInfo' | 'editTerm' | 'editSchedule' | 'delete' | 'stats'>('main');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const { height: screenHeight } = Dimensions.get('window');
  const [editTitle, setEditTitle] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editInstructor, setEditInstructor] = useState('');
  const [editTerm, setEditTerm] = useState('');
  
  const [editDays, setEditDays] = useState<Set<string>>(new Set());
  const [editStartDate, setEditStartDate] = useState(new Date(2026, 0, 1, 9, 0));
  const [editEndDate, setEditEndDate] = useState(new Date(2026, 0, 1, 10, 30));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [editLocation, setEditLocation] = useState('');
  const [existingSubjects, setExistingSubjects] = useState<SubjectRecord[]>([]);
  const featuredFolders = folders.slice(0, 3);
  const remainingFolders = folders.slice(3);
  const looseNotes = notes.filter((note) => !note.folderId);
  const recentNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  const folderNoteCounts = notes.reduce<Record<string, number>>((accumulator, note) => {
    if (note.folderId) {
      accumulator[note.folderId] = (accumulator[note.folderId] ?? 0) + 1;
    }

    return accumulator;
  }, {});
  const pinnedNotes = notes.filter((n) => n.isPinned);
  const totalNotes = notes.length;
  const totalFolders = folders.length;
  const subjectAgeDays = subject?.createdAt ? Math.max(1, Math.floor((Date.now() - subject.createdAt) / (1000 * 60 * 60 * 24))) : 0;
  const lastActivity = notes.length > 0
    ? new Date(Math.max(...notes.map((n) => n.updatedAt)))
    : null;

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
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

  useEffect(() => {
    getSubjects().then(setExistingSubjects).catch(console.warn);
  }, []);

  const scheduleConflicts = useMemo(() => {
    if (!subject?.id) return [];
    return findTimeConflicts(
      {
        id: subject.id,
        days: Array.from(editDays),
        startTime: formatTimeDisplay(editStartDate),
        endTime: formatTimeDisplay(editEndDate),
      },
      existingSubjects,
    );
  }, [subject?.id, editDays, editStartDate, editEndDate, existingSubjects]);

  const hasScheduleConflict = scheduleConflicts.length > 0;

  const isDeleteConfirmValid = deleteConfirmInput.trim() === 'DELETE THIS SUBJECT';

  const loadSubjectData = useCallback(async () => {
    if (!subject?.id) {
      setFolders([]);
      setNotes([]);
      return;
    }

    try {
      const [storedFolders, storedNotes] = await Promise.all([
        getFoldersBySubjectId(subject.id),
        getNotesBySubjectId(subject.id),
      ]);

      setFolders(storedFolders);
      setNotes(storedNotes);
    } catch (error) {
      console.warn('Failed to load subject detail data', error);
      setFolders([]);
      setNotes([]);
    }
  }, [subject?.id]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSubjectData();
    setRefreshing(false);
  }, [loadSubjectData]);

  useEffect(() => {
    loadSubjectData();
  }, [loadSubjectData, subject?.folders]);

  useFocusEffect(
    useCallback(() => {
      loadSubjectData();
    }, [loadSubjectData])
  );

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
    folderFormOpacity.setValue(0);
    folderFormSlide.setValue(0);
    setIsNoteEditorOpen(false);
    setSelectedNote(null);

    if (options?.saved) {
      setShowSaveToast(true);
    }

    if (options?.deleted) {
      setShowDeleteToast(true);
    }
  };

  const handleOpenFolderDetail = (folder: FolderRecord) => {
    router.push(`/folder/${folder.id}`);
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

  const closeSubjectSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(subjectSheetOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(subjectSheetSlide, {
        toValue: 0,
        friction: 9,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsSubjectSheetOpen(false);
        setSubjectSheetView('main');
        setDeleteConfirmInput('');
        Keyboard.dismiss();
      }
    });
  }, [subjectSheetOpacity, subjectSheetSlide]);

  const snapSubjectSheetOpen = useCallback(() => {
    Animated.spring(subjectSheetSlide, { toValue: 1, ...springModalSlide }).start();
  }, [subjectSheetSlide]);

  const { panResponder: subjectSheetPanResponder, scrollYRef: subjectSheetScrollYRef } = useDragToClose(
    subjectSheetSlide,
    snapSubjectSheetOpen,
    closeSubjectSheet,
  );

  const snapFolderFormOpen = useCallback(() => {
    Animated.spring(folderFormSlide, { toValue: 1, ...springModalSlide }).start();
  }, [folderFormSlide]);

  const closeFolderFormViaDrag = useCallback(() => {
    Animated.parallel([
      Animated.timing(folderFormOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(folderFormSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsFolderFormOpen(false);
      }
    });
  }, [folderFormOpacity, folderFormSlide]);

  const { panResponder: folderFormPanResponder, scrollYRef: folderFormScrollYRef } = useDragToClose(
    folderFormSlide,
    snapFolderFormOpen,
    closeFolderFormViaDrag,
  );

  const handleOpenFolderForm = () => {
    handleCloseActions();
    setTimeout(() => {
      setIsFolderFormOpen(true);
      folderFormSlide.setValue(0);
      folderFormOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(folderFormOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(folderFormSlide, {
          toValue: 1,
          ...springModalSlide,
        }),
      ]).start();
    }, 220);
  };

  const handleCloseFolderForm = () => {
    Animated.parallel([
      Animated.timing(folderFormOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(folderFormSlide, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsFolderFormOpen(false);
      }
    });
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFolderFormOpen) {
        handleCloseFolderForm();
        return true;
      }
      if (isSubjectSheetOpen) {
        if (subjectSheetView === 'editTerm') {
          setSubjectSheetView('editInfo');
          return true;
        }
        if (subjectSheetView === 'editInfo' || subjectSheetView === 'editSchedule' || subjectSheetView === 'stats') {
          Keyboard.dismiss();
          setSubjectSheetView('main');
          return true;
        }
        closeSubjectSheet();
        return true;
      }
      if (pathname !== '/') {
        return false;
      }
      if (isNoteEditorOpen) {
        return false;
      }
      onBack();
      return true;
    });
    return () => backHandler.remove();
  }, [onBack, isNoteEditorOpen, pathname, isSubjectSheetOpen, subjectSheetView, closeSubjectSheet, isFolderFormOpen, handleCloseFolderForm]);

  const handleDeleteSubject = useCallback(async () => {
    if (!subject?.id || !isDeleteConfirmValid) return;
    const deletedTitle = subject.title ?? 'Subject';
    Keyboard.dismiss();
    await deleteSubject(subject.id);
    onDelete?.(deletedTitle);
  }, [subject?.id, subject?.title, isDeleteConfirmValid, onDelete]);

  const handleArchiveSubject = useCallback(async () => {
    if (!subject?.id) return;
    await updateSubject(subject.id, { isArchived: true });
    closeSubjectSheet();
    onArchive?.(subject.title ?? 'Subject');
  }, [subject?.id, subject?.title, closeSubjectSheet, onArchive]);

  const handleUnarchiveSubject = useCallback(async () => {
    if (!subject?.id) return;
    await updateSubject(subject.id, { isArchived: false });
    closeSubjectSheet();
    onUnarchive?.(subject.title ?? 'Subject');
  }, [subject?.id, subject?.title, closeSubjectSheet, onUnarchive]);

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
    buttonAnims.forEach(a => a.setValue(0));
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
      Animated.stagger(80, [2, 1, 0].map(i =>
        Animated.spring(buttonAnims[i], {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        })
      )),
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
      Animated.stagger(60, [0, 1, 2].map(i =>
        Animated.spring(buttonAnims[i], { toValue: 0, useNativeDriver: true, friction: 8, tension: 40 })
      )),
    ]).start(({ finished }) => {
      if (finished) {
        setIsActionSheetOpen(false);
      }
    });
  };

  const openSubjectSheet = () => {
    Keyboard.dismiss();
    setIsSubjectSheetOpen(true);
    setSubjectSheetView('main');
    Animated.parallel([
      Animated.timing(subjectSheetOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(subjectSheetSlide, {
        toValue: 1,
        ...springModalSlide,
      }),
    ]).start();
  };

  const openEditInfo = () => {
    setEditTitle(subject?.title ?? '');
    setEditCode(subject?.code ?? '');
    setEditInstructor(subject?.instructor ?? '');
    setEditTerm(subject?.term ?? '');
    setSubjectSheetView('editInfo');
  };

  const handleSaveEditInfo = async () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle || !subject?.id) {
      return;
    }

    await updateSubject(subject.id, {
      title: trimmedTitle,
      code: editCode.trim() || undefined,
      instructor: editInstructor.trim() || undefined,
      term: editTerm || undefined,
    });

    setSubjectSheetView('main');
    setShowSubjectSavedToast(true);
    onUpdate?.({
      title: trimmedTitle,
      code: editCode.trim() || subject?.code,
      instructor: editInstructor.trim() || subject?.instructor,
      term: editTerm || subject?.term,
    });
  };

  const openEditSchedule = () => {
    setEditDays(new Set(subject?.days ?? []));
    const startMins = parseTimeToMinutes(subject?.startTime);
    const endMins = parseTimeToMinutes(subject?.endTime);
    
    const dStart = new Date();
    if (startMins !== null) {
      dStart.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
    } else {
      dStart.setHours(9, 0, 0, 0);
    }
    setEditStartDate(dStart);

    const dEnd = new Date();
    if (endMins !== null) {
      dEnd.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);
    } else {
      dEnd.setHours(10, 30, 0, 0);
    }
    setEditEndDate(dEnd);
    
    setEditLocation(subject?.location ?? '');
    getSubjects().then(setExistingSubjects).catch(console.warn);
    setSubjectSheetView('editSchedule');
  };

  const handleToggleEditDay = (day: string) => {
    setEditDays((prev) => {
      const updated = new Set(prev);
      if (updated.has(day)) {
        updated.delete(day);
      } else {
        updated.add(day);
      }
      return updated;
    });
  };

  const handleSaveEditSchedule = async () => {
    if (!subject?.id) return;
    
    const newDays = Array.from(editDays);
    const newStart = formatTimeDisplay(editStartDate);
    const newEnd = formatTimeDisplay(editEndDate);
    const newLocation = editLocation.trim() || undefined;

    await updateSubject(subject.id, {
      days: newDays,
      startTime: newStart,
      endTime: newEnd,
      location: newLocation,
    });

    setSubjectSheetView('main');
    setShowSubjectSavedToast(true);
    onUpdate?.({
      days: newDays,
      startTime: newStart,
      endTime: newEnd,
      location: newLocation,
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
        isPinned: false,
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
      setShowFolderCreatedToast(true);
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

        <Pressable style={styles.headerActionButton} onPress={openSubjectSheet}>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#2d4d43"
            colors={['#2d4d43']}
          />
        }
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
                  {subject?.term || 'NO TERM SET'}
                </Text>
              </View>

              {/* Prominent Subject Title */}
              <Text style={styles.heroSubjectTitle}>
                  {subject?.title || 'Untitled Subject'}
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
                      {subject?.instructor || 'No instructor'}
                    </Text>
                  </View>
                  <View style={styles.cardMetaItem}>
                    <Feather name="map-pin" size={14} color="#A2C9BA" style={styles.metaIcon} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>
                      {subject?.location || 'No location'}
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
                        : 'No days set'}
                    </Text>
                  </View>
                  <View style={styles.cardMetaItem}>
                    <Feather name="clock" size={14} color="#A2C9BA" style={styles.metaIcon} />
                    <Text style={styles.cardMetaText} numberOfLines={1}>
                      {subject?.time || 'No time set'}
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

            {/* Recent Notes Section */}
            <View style={styles.section}>
              <Text style={styles.sectionHeaderTitle}>Recent Notes</Text>

              {recentNotes.length === 0 ? (
                <View style={styles.recentNoteEmptyState}>
                  <View style={styles.recentNoteEmptyIconWrapper}>
                    <MaterialIcons name="note-alt" size={20} color="#8f968f" />
                  </View>
                  <Text style={styles.recentNoteEmptyTitle}>No recent notes</Text>
                  <Text style={styles.recentNoteEmptyBody}>Notes you create or edit will show up here.</Text>
                </View>
              ) : recentNotes.map((note) => {
                const folderLabel = note.folderId ? folders.find((f) => f.id === note.folderId)?.title ?? 'Unknown' : 'Loose notes';
                const date = new Date(note.updatedAt);
                const now = new Date();
                const isToday = date.toDateString() === now.toDateString();
                const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                const dateStr = isToday
                  ? timeStr
                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;

                return (
                  <CardScale key={note.id} onPress={() => handleOpenNoteEditor(note)} style={styles.recentNoteCard}>
                    <Text style={styles.recentNoteTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                    <Text style={styles.recentNoteBody} numberOfLines={3}>
                      {note.contentText || 'Tap to start writing.'}
                    </Text>
                    <View style={styles.recentNoteMetaRow}>
                      <Feather name="clock" size={12} color="#8f968f" />
                      <Text style={styles.recentNoteMetaText}>{dateStr}</Text>
                      <View style={styles.recentNoteMetaDot} />
                      <Feather name="folder" size={12} color="#8f968f" />
                      <Text style={styles.recentNoteMetaText}>{folderLabel}</Text>
                    </View>
                  </CardScale>
                );
              })}
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
                        <Pressable
                          key={folder.id ?? `${folder.title}-${variant}`}
                          onPress={() => handleOpenFolderDetail(folder)}
                          style={({ pressed }) => [
                            styles.folderCard,
                            variant === 'full' ? styles.folderCardFull : styles.folderCardCompact,
                            { backgroundColor: cardBackground },
                            pressed ? styles.folderCardPressed : null,
                          ]}
                        >
                          <LinearGradient
                            colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.02)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.folderCardSheen}
                          />
                          <View style={styles.folderCardTopRow}>
                            <Text style={styles.folderCardTitle} numberOfLines={1}>
                              {folder.title}
                            </Text>
                            <Feather name="chevron-right" size={22} color="rgba(255,255,255,0.92)" />
                          </View>

                          <View style={styles.folderCardBottomRow}>
                            <View style={styles.folderCardCountGroup}>
                              <Text style={styles.folderCardCount}>{count}</Text>
                              <Text style={styles.folderCardCountLabel}>items</Text>
                            </View>
                            {folder.isPinned ? (
                              <MaterialCommunityIcons name="bookmark" size={28} color="#FFD666" />
                            ) : null}
                          </View>
                        </Pressable>
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
                <Text style={styles.sectionHeaderTitle}>Loose Notes</Text>

                {looseNotes.length === 0 ? (
                  <View style={styles.looseNotesEmptyState}>
                    <View style={styles.looseNotesEmptyIconWrapper}>
                      <Feather name="file-text" size={22} color="#8f968f" />
                    </View>
                    <Text style={styles.looseNotesEmptyTitle}>No loose notes yet</Text>
                    <Text style={styles.looseNotesEmptyBody}>
                      Notes without a folder will appear here.
                    </Text>
                  </View>
                ) : (
                    looseNotes.map((note) => {
                      const date = new Date(note.updatedAt);
                      const now = new Date();
                      const isToday = date.toDateString() === now.toDateString();
                      const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                      const dateStr = isToday
                        ? timeStr
                        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;

                      return (
                        <CardScale key={note.id} onPress={() => handleOpenNoteEditor(note)} style={styles.noteCard}>
                          <View style={styles.noteCardTopRow}>
                            <Text style={styles.noteCardTitle} numberOfLines={1}>
                              {note.title || 'Untitled note'}
                            </Text>
                          </View>
                          <Text style={styles.noteCardPreview} numberOfLines={2}>
                            {note.contentText || 'Tap to start your first draft.'}
                          </Text>
                          <View style={styles.noteCardDateRow}>
                            <Feather name="clock" size={12} color="#8f968f" />
                            <Text style={styles.noteCardDateText}>{dateStr}</Text>
                            {note.isPinned ? <MaterialCommunityIcons name="bookmark" size={16} color="#FFD666" style={{ marginLeft: 'auto' }} /> : null}
                          </View>
                        </CardScale>
                      );
                    })
                )}
              </View>

              {/* Spacing bottom to allow scrolling over margins and floating dock nicely */}
              <View style={{ height: 110 }} />
            </Animated.View>
          </>
        )}
      </Animated.ScrollView>

      {/* Interactive Action Sheet Modal - rendered before navDock/FAB so they stay tappable */}
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
                transform: [{ translateY: sheetTranslate }],
              },
            ]}
          >
            {/* Shortcut 1: Add Task */}
            <Animated.View style={{
              opacity: buttonAnims[0],
              transform: [{
                translateY: buttonAnims[0].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            }}>
              <Pressable style={styles.actionButton} onPress={() => { handleCloseActions(); setActiveTab('tasks'); }}>
                <View style={styles.actionIconCircle}>
                  <Feather name="check-square" size={18} color="#1e2b26" />
                </View>
                <Text style={styles.actionText}>Add Task</Text>
              </Pressable>
            </Animated.View>

            {/* Shortcut 2: New Note */}
            <Animated.View style={{
              opacity: buttonAnims[1],
              transform: [{
                translateY: buttonAnims[1].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            }}>
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
            </Animated.View>

            {/* Shortcut 3: Create Folder */}
            <Animated.View style={{
              opacity: buttonAnims[2],
              transform: [{
                translateY: buttonAnims[2].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              }],
            }}>
              <Pressable style={styles.actionButton} onPress={handleOpenFolderForm}>
                <View style={styles.actionIconCircle}>
                  <Feather name="folder" size={18} color="#1e2b26" />
                </View>
                <Text style={styles.actionText}>Create Folder</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      ) : null}

      {isFolderFormOpen ? (
        <Animated.View style={[styles.folderFormBackdrop, { opacity: folderFormOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseFolderForm} />
        </Animated.View>
      ) : null}

      {isFolderFormOpen ? (
        <Animated.View
          style={[
            styles.folderFormPanelWrapper,
            {
              bottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
              transform: [{
                translateY: folderFormSlide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenHeight, 0],
                }),
              }],
            },
          ]}
        >
          <View style={[styles.folderFormPanel, { maxHeight: screenHeight * 0.8 }]} {...folderFormPanResponder.panHandlers}>
            <View style={styles.folderFormHandle} />

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ overflow: 'visible', paddingBottom: 16 }}
              onScroll={(e) => { folderFormScrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              <View style={styles.folderFormHeader}>
                <Text style={styles.folderFormTitle}>Create Folder</Text>
              </View>

              <View style={styles.folderFormSection}>
                <Text style={styles.folderFormLabel}>Folder Name</Text>
                <TextInput
                  value={folderName}
                  onChangeText={setFolderName}
                  placeholder="e.g. midterm"
                  placeholderTextColor="#c1c5c1"
                  style={styles.folderFormInput}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>

              <View style={styles.folderFormSection}>
                <Text style={styles.folderFormLabel}>Folder Color</Text>
                <View style={styles.folderSwatchRow}>
                  {FOLDER_COLORS.map((color) => {
                    const isSelected = selectedFolderColor === color;
                    return (
                      <Pressable
                        key={color}
                        onPress={() => setSelectedFolderColor(color)}
                        style={[
                          styles.folderSwatch,
                          { backgroundColor: color },
                          isSelected && styles.folderSwatchSelected,
                        ]}
                      >
                        {isSelected ? <Feather name="check" size={20} color="#ffffff" /> : null}
                      </Pressable>
                    );
                  })}
                </View>
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
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}

      {/* Floating Bottom Tab Bar Navigation */}
      <View style={styles.navDock} pointerEvents={isSubjectSheetOpen ? 'none' : 'auto'}>
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
        </View>

      {/* Plus Button - rendered after action sheet overlay to stay tappable */}
      <Animated.View
        style={[styles.floatingButtonContainer, {
          transform: [{
            scale: buttonScale.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.9],
            })
          }]
        }]}
        pointerEvents={isSubjectSheetOpen ? 'none' : 'auto'}
      >
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

      {isSubjectSheetOpen ? (
        <Animated.View style={[styles.subjectSheetBackdrop, { opacity: subjectSheetOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSubjectSheet} />
        </Animated.View>
      ) : null}

      {isSubjectSheetOpen ? (
        <Animated.View
          style={[styles.subjectSheetPanelWrapper, {
            bottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
            transform: [{
              translateY: subjectSheetSlide.interpolate({
                inputRange: [0, 1],
                outputRange: [screenHeight, 0],
              }),
            }],
          }]}
        >
          <View
            style={[styles.subjectSheetPanel, { maxHeight: screenHeight * 0.8 }]}
            {...subjectSheetPanResponder.panHandlers}
          >
            <View style={styles.subjectSheetHandleHitArea}>
              <View style={styles.subjectSheetHandle} />
            </View>
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="on-drag"
              contentContainerStyle={keyboardHeight > 0 ? { paddingBottom: 24 } : undefined}
              onScroll={(e) => { subjectSheetScrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {subjectSheetView === 'main' && (
                <>
                  <Text style={styles.subjectSheetTitle}>Subject Actions</Text>

                  <Pressable style={styles.subjectSheetActionRow} onPress={openEditInfo}>
                    <View style={styles.subjectSheetActionIcon}>
                      <Feather name="edit-3" size={16} color="#4d5a54" />
                    </View>
                    <Text style={styles.subjectSheetActionLabel}>Edit subject info</Text>
                  </Pressable>

                  <Pressable style={styles.subjectSheetActionRow} onPress={openEditSchedule}>
                    <View style={styles.subjectSheetActionIcon}>
                      <Feather name="calendar" size={16} color="#4d5a54" />
                    </View>
                    <Text style={styles.subjectSheetActionLabel}>Edit subject schedule</Text>
                  </Pressable>

                  <Pressable style={styles.subjectSheetActionRow} onPress={() => void (subject?.isArchived ? handleUnarchiveSubject() : handleArchiveSubject())}>
                    <View style={styles.subjectSheetActionIcon}>
                      <Feather name={subject?.isArchived ? 'rotate-ccw' : 'archive'} size={16} color="#4d5a54" />
                    </View>
                    <Text style={styles.subjectSheetActionLabel}>{subject?.isArchived ? 'Unarchive' : 'Archive'}</Text>
                  </Pressable>

                  <Pressable style={styles.subjectSheetActionRow} onPress={() => setSubjectSheetView('stats')}>
                    <View style={styles.subjectSheetActionIcon}>
                      <Feather name="bar-chart-2" size={16} color="#4d5a54" />
                    </View>
                    <Text style={styles.subjectSheetActionLabel}>View statistics</Text>
                  </Pressable>

                  <View style={styles.subjectSheetDivider} />

                  <Pressable
                    style={styles.subjectSheetActionRow}
                    onPress={() => { setDeleteConfirmInput(''); setSubjectSheetView('delete'); }}
                  >
                    <View style={styles.subjectSheetActionIcon}>
                      <Feather name="trash-2" size={16} color="#b42318" />
                    </View>
                    <Text style={[styles.subjectSheetActionLabel, styles.subjectSheetActionLabelDanger]}>Delete subject</Text>
                  </Pressable>
                </>
              )}

              {subjectSheetView === 'editInfo' && (
                <>
                  <Text style={styles.subjectSheetTitle}>Edit Subject Info</Text>

                  <View style={styles.editInfoCard}>
                    <View style={styles.editInfoRow}>
                      <TextInput
                        value={editTitle}
                        onChangeText={setEditTitle}
                        placeholder="Subject Title"
                        placeholderTextColor="#91948f"
                        style={styles.editInfoInput}
                      />
                    </View>
                    <View style={styles.editInfoSeparator} />
                    <View style={styles.editInfoRow}>
                      <TextInput
                        value={editCode}
                        onChangeText={setEditCode}
                        placeholder="Subject Code (Optional)"
                        placeholderTextColor="#91948f"
                        style={styles.editInfoInput}
                      />
                    </View>
                    <View style={styles.editInfoSeparator} />
                    <View style={styles.editInfoRow}>
                      <TextInput
                        value={editInstructor}
                        onChangeText={setEditInstructor}
                        placeholder="Instructor (Optional)"
                        placeholderTextColor="#91948f"
                        style={styles.editInfoInput}
                      />
                    </View>
                    <View style={styles.editInfoSeparator} />
                    <Pressable style={styles.editInfoRow} onPress={() => setSubjectSheetView('editTerm')}>
                      <Text style={[styles.editInfoInput, !editTerm && { color: '#91948f' }]}>
                        {editTerm || 'Academic Period (Optional)'}
                      </Text>
                      <Feather name="chevron-right" size={20} color="#9aa09a" />
                    </Pressable>
                  </View>

                  <View style={styles.editInfoActions}>
                    <Pressable onPress={() => setSubjectSheetView('main')}>
                      <Text style={styles.editInfoCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.editInfoSaveButton, !editTitle.trim() && styles.editInfoSaveButtonDisabled]}
                      onPress={() => void handleSaveEditInfo()}
                      disabled={!editTitle.trim()}
                    >
                      <Text style={styles.editInfoSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {subjectSheetView === 'editTerm' && (
                <>
                  <Text style={styles.subjectSheetTitle}>Academic Period</Text>

                  {['1st Semester', '2nd Semester', 'Summer / Midyear', '1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'].map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.termOption, editTerm === option && styles.termOptionSelected]}
                      onPress={() => {
                        setEditTerm(option);
                        setSubjectSheetView('editInfo');
                      }}
                    >
                      <Text style={[styles.termOptionText, editTerm === option && styles.termOptionTextSelected]}>
                        {option}
                      </Text>
                      {editTerm === option && <Feather name="check" size={20} color="#0f2a24" />}
                    </Pressable>
                  ))}

                  <Pressable style={styles.termBackButton} onPress={() => setSubjectSheetView('editInfo')}>
                    <Text style={styles.termBackText}>Back</Text>
                  </Pressable>
                </>
              )}

              {subjectSheetView === 'editSchedule' && (
                <>
                  <Text style={styles.subjectSheetTitle}>Edit Schedule</Text>

                  <View style={styles.editInfoCard}>
                    <View style={styles.daysContainer}>
                      <Text style={styles.rowLabel}>Days</Text>
                      <View style={styles.daysRow}>
                        {DAYS.map((day) => {
                          const isSelected = editDays.has(day.value);
                          return (
                            <Pressable
                              key={day.value}
                              onPress={() => handleToggleEditDay(day.value)}
                              style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}
                            >
                              <Text style={[styles.dayCircleText, isSelected && styles.dayCircleTextSelected]}>
                                {day.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    
                    <View style={styles.editInfoSeparator} />
                    
                    <View style={styles.timeGroupRow}>
                      <Pressable style={styles.timeAction} onPress={() => setShowStartPicker(true)}>
                        <Text style={styles.timeActionLabel}>Start Time</Text>
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>{formatTimeDisplay(editStartDate)}</Text>
                        </View>
                      </Pressable>
                      <View style={styles.verticalSeparator} />
                      <Pressable style={styles.timeAction} onPress={() => setShowEndPicker(true)}>
                        <Text style={styles.timeActionLabel}>End Time</Text>
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>{formatTimeDisplay(editEndDate)}</Text>
                        </View>
                      </Pressable>
                    </View>

                    {showStartPicker && (
                      <DateTimePicker
                        value={editStartDate}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowStartPicker(Platform.OS === 'ios');
                          if (selectedDate) setEditStartDate(selectedDate);
                        }}
                      />
                    )}

                    {showEndPicker && (
                      <DateTimePicker
                        value={editEndDate}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowEndPicker(Platform.OS === 'ios');
                          if (selectedDate) setEditEndDate(selectedDate);
                        }}
                      />
                    )}
                  </View>

                  <View style={[styles.editInfoCard, { marginTop: 16 }]}>
                    <View style={styles.editInfoRow}>
                      <Feather name="map-pin" size={16} color="#1e2b26" style={{ marginRight: 10 }} />
                      <TextInput
                        value={editLocation}
                        onChangeText={setEditLocation}
                        placeholder="Room, Building, or Online"
                        placeholderTextColor="#91948f"
                        style={styles.editInfoInput}
                      />
                    </View>
                  </View>

                  {hasScheduleConflict ? (
                    <View style={styles.conflictWarning}>
                      <Feather name="alert-triangle" size={20} color="#991b1b" />
                      <Text style={styles.conflictWarningBody}>
                        Conflicts with <Text style={styles.conflictSubjectName}>{scheduleConflicts[0].title}</Text>
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.editInfoActions}>
                    <Pressable onPress={() => setSubjectSheetView('main')}>
                      <Text style={styles.editInfoCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={styles.editInfoSaveButton}
                      onPress={() => void handleSaveEditSchedule()}
                    >
                      <Text style={styles.editInfoSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {subjectSheetView === 'stats' && (
                <>
                  <Text style={styles.subjectSheetTitle}>Statistics</Text>

                  <View style={styles.statsGrid}>
                    <View style={styles.statsCard}>
                      <Text style={styles.statsNumber}>{totalNotes}</Text>
                      <Text style={styles.statsLabel}>Total Notes</Text>
                    </View>
                    <View style={styles.statsCard}>
                      <Text style={styles.statsNumber}>{totalFolders}</Text>
                      <Text style={styles.statsLabel}>Folders</Text>
                    </View>
                    <View style={styles.statsCard}>
                      <Text style={styles.statsNumber}>{looseNotes.length}</Text>
                      <Text style={styles.statsLabel}>Loose Notes</Text>
                    </View>
                    <View style={styles.statsCard}>
                      <Text style={styles.statsNumber}>{pinnedNotes.length}</Text>
                      <Text style={styles.statsLabel}>Pinned</Text>
                    </View>
                  </View>

                  <View style={styles.statsInfoCard}>
                    <View style={styles.statsInfoRow}>
                      <Feather name="calendar" size={16} color="#5c6762" />
                      <Text style={styles.statsInfoLabel}>Subject age</Text>
                      <Text style={styles.statsInfoValue}>{subjectAgeDays} day{subjectAgeDays !== 1 ? 's' : ''}</Text>
                    </View>
                    {lastActivity && (
                      <View style={styles.statsInfoRow}>
                        <Feather name="clock" size={16} color="#5c6762" />
                        <Text style={styles.statsInfoLabel}>Last activity</Text>
                        <Text style={styles.statsInfoValue}>
                          {lastActivity.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    )}
                    {subject?.term && (
                      <View style={styles.statsInfoRow}>
                        <Feather name="book" size={16} color="#5c6762" />
                        <Text style={styles.statsInfoLabel}>Academic period</Text>
                        <Text style={styles.statsInfoValue}>{subject.term}</Text>
                      </View>
                    )}
                  </View>

                  <Pressable style={styles.statsBackButton} onPress={() => setSubjectSheetView('main')}>
                    <Text style={styles.statsBackText}>Back</Text>
                  </Pressable>
                </>
              )}

              {subjectSheetView === 'delete' && (
                <>
                  <Text style={styles.subjectSheetTitle}>Delete subject?</Text>
                  <Text style={styles.subjectSheetDeleteBody}>
                    This action cannot be undone. The subject, all of its folders, and all of its notes will be permanently deleted.
                  </Text>
                  <TextInput
                    style={styles.subjectSheetDeleteInput}
                    placeholder='Type "DELETE THIS SUBJECT" to confirm'
                    placeholderTextColor="#8f968f"
                    value={deleteConfirmInput}
                    onChangeText={setDeleteConfirmInput}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    spellCheck={false}
                    autoFocus
                  />
                  <Pressable
                    style={[
                      styles.subjectSheetDeleteButton,
                      !isDeleteConfirmValid && styles.subjectSheetDeleteButtonDisabled,
                    ]}
                    onPress={() => void handleDeleteSubject()}
                    disabled={!isDeleteConfirmValid}
                  >
                    <Text style={styles.subjectSheetDeleteButtonText}>Delete</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}

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

      {showSubjectSavedToast ? (
        <DynamicIslandToast
          visible={showSubjectSavedToast}
          message="Subject info updated"
          onHide={() => setShowSubjectSavedToast(false)}
        />
      ) : null}

      {showFolderCreatedToast ? (
        <DynamicIslandToast
          visible={showFolderCreatedToast}
          message="Folder created successfully"
          onHide={() => setShowFolderCreatedToast(false)}
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
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 120,
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
    ...shadowLgDark,
  },
  folderCardPressed: {
    transform: [{ scale: 0.98 }],
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
  folderCardCountGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flex: 1,
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
    alignItems: 'center',
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
    borderWidth: 1,
    borderColor: '#efede8',
    ...shadowLg,
  },
  recentNoteTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#1e2b26',
    marginBottom: 6,
  },
  recentNoteBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#6b746f',
    lineHeight: 18,
    marginBottom: 10,
  },
  recentNoteEmptyState: {
    backgroundColor: '#f3f2ee',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
  },
  recentNoteEmptyIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#efede8',
  },
  recentNoteEmptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#1e2b26',
    marginBottom: 6,
  },
  recentNoteEmptyBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#6b746f',
    textAlign: 'center',
  },
  recentNoteMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentNoteMetaText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#8f968f',
  },
  recentNoteMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#8f968f',
    marginHorizontal: 4,
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
    backgroundColor: 'rgba(5, 8, 7, 0.3)',
    zIndex: 99,
  },
  folderFormPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  folderFormPanel: {
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
    marginBottom: 14,
  },
  folderFormInput: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 17,
    color: '#111111',
    borderBottomWidth: 2,
    borderBottomColor: '#2d4d43',
    paddingVertical: 10,
    marginBottom: 8,
  },
  folderSwatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f201b',
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
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#efede8',
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
    marginBottom: 8,
  },
  noteCardDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  noteCardDateText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#8f968f',
  },
  navDock: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
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
    marginRight: 76,
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
  subjectSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 7, 0.3)',
    zIndex: 99,
  },
  subjectSheetPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  subjectSheetPanel: {
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
  subjectSheetHandleHitArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  subjectSheetHandle: {
    width: 68,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e3e0d8',
  },
  subjectSheetTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 24,
    color: '#111111',
    letterSpacing: -0.4,
    marginBottom: 20,
  },
  subjectSheetActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  subjectSheetActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f4f1',
  },
  subjectSheetActionLabel: {
    flex: 1,
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#111111',
  },
  subjectSheetActionLabelDanger: {
    color: '#b42318',
  },
  subjectSheetDivider: {
    height: 1,
    backgroundColor: '#e8e6de',
    marginVertical: 4,
  },
  editInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    ...shadowLg,
  },
  editInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 60,
  },
  editInfoInput: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
    paddingVertical: 14,
  },
  editInfoSeparator: {
    height: 1,
    backgroundColor: '#f0f0ed',
    marginLeft: 16,
  },
  editInfoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  editInfoCancelText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#9aa09a',
    paddingHorizontal: 8,
  },
  editInfoSaveButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f2a24',
  },
  editInfoSaveButtonDisabled: {
    opacity: 0.5,
  },
  editInfoSaveText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#ffffff',
  },
  conflictWarning: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#fff5f5',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  conflictWarningBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#991b1b',
    flex: 1,
  },
  conflictSubjectName: {
    fontFamily: 'Manrope_700Bold',
  },
  termOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#f9f9f6',
  },
  termOptionSelected: {
    backgroundColor: '#eef2ec',
    borderWidth: 1,
    borderColor: '#0f2a24',
  },
  termOptionText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: '#2a332e',
  },
  termOptionTextSelected: {
    color: '#0f2a24',
    fontFamily: 'Manrope_700Bold',
  },
  termBackButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  termBackText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#66706b',
  },
  daysContainer: {
    padding: 16,
  },
  rowLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#1e2b26',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f6',
  },
  dayCircleSelected: {
    backgroundColor: '#0f2a24',
  },
  dayCircleText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#9aa09a',
  },
  dayCircleTextSelected: {
    color: '#ffffff',
  },
  timeGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeAction: {
    flex: 1,
    padding: 16,
    flexDirection: 'column',
    gap: 6,
  },
  timeActionLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: '#1e2b26',
  },
  verticalSeparator: {
    width: 1,
    height: 44,
    backgroundColor: '#f0f0ed',
  },
  timeBadge: {
    backgroundColor: '#f9f9f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  timeBadgeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#0f2a24',
  },
  subjectSheetDeleteBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#5f6661',
    marginBottom: 24,
  },
  subjectSheetDeleteInput: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#1e2b26',
    backgroundColor: '#f5f5f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  subjectSheetDeleteButton: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b42318',
  },
  subjectSheetDeleteButtonDisabled: {
    opacity: 0.35,
  },
  subjectSheetDeleteButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#ffffff',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statsCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...shadowLg,
  },
  statsNumber: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 32,
    color: '#0f2a24',
    marginBottom: 4,
  },
  statsLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: '#6b746f',
    letterSpacing: 0.3,
  },
  statsInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 4,
    paddingHorizontal: 16,
    ...shadowLg,
  },
  statsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  statsInfoLabel: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#5c6762',
  },
  statsInfoValue: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#1e2b26',
  },
  statsBackButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  statsBackText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#66706b',
  },
});
