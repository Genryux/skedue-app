import { FOLDER_COLORS, getFolderBgColor } from '../../src/features/subjects/SubjectDetailScreen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  deleteNote,
  deleteFolder,
  findRecentMatchingNote,
  getFolderById,
  getFoldersBySubjectId,
  getMetaValue,
  getNotesByFolderId,
  getSubjectById,
  insertNote,
  moveNotesToFolder,
  setMetaValue,
  updateFolder,
  updateNote,
  type FolderRecord,
  type NoteRecord,
  type SubjectRecord,
} from '../../src/data/local/db';
import { shadowLg, shadowLgDark } from '../../src/ui/tokens/shadows';
import { springModalSlide, useDragToClose } from '../../src/ui/tokens/animations';

const NoteEditorScreen = require('../../src/features/subjects/NoteEditorScreen').default as React.ComponentType<{
  subjectId: string;
  subjectTitle: string;
  note: NoteRecord | null;
  defaultFolderId?: string;
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

const isLightColor = (hex: string) => {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55;
};

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [folder, setFolder] = useState<FolderRecord | null>(null);
  const [subject, setSubject] = useState<SubjectRecord | null>(null);
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteRecord | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [folderMenuView, setFolderMenuView] = useState<'main' | 'rename' | 'delete' | 'color' | 'info' | 'move' | 'view'>('main');
  const [noteViewMode, setNoteViewMode] = useState<'list' | 'card' | 'grid'>('card');
  const [renameText, setRenameText] = useState('');
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [moveTargetFolderId, setMoveTargetFolderId] = useState<string | null | undefined>(undefined);
  const [allSubjectFolders, setAllSubjectFolders] = useState<FolderRecord[]>([]);

  const folderMenuSlide = useRef(new Animated.Value(0)).current;
  const folderMenuOpacity = useRef(new Animated.Value(0)).current;
  const viewTransition = useRef(new Animated.Value(1)).current;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const gridColumnWidth = (screenWidth - 28 * 2 - 12) / 2;
  const searchInputRef = useRef<TextInput>(null);

  const saveInFlightRef = useRef<Promise<NoteRecord> | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const load = async () => {
      const f = await getFolderById(id);
      if (!mounted) return;
      setFolder(f);

      if (f) {
        const [s, n, savedMode] = await Promise.all([
          getSubjectById(f.subjectId),
          getNotesByFolderId(f.id),
          getMetaValue('noteViewMode'),
        ]);
        if (!mounted) return;
        setSubject(s);
        setNotes(n);
        if (savedMode === 'list' || savedMode === 'card' || savedMode === 'grid') {
          setNoteViewMode(savedMode);
        }
      }
    };

    load();
    return () => { mounted = false; };
  }, [id]);

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

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.contentText.toLowerCase().includes(q)
      );
    }
    return result;
  }, [notes, searchQuery]);

  const pinnedNotes = useMemo(() => filteredNotes.filter((n) => n.isPinned), [filteredNotes]);
  const otherNotes = useMemo(() => filteredNotes.filter((n) => !n.isPinned), [filteredNotes]);
  const hasPinned = pinnedNotes.length > 0;

  const dateStr = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return d.toDateString() === now.toDateString()
      ? time
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` at ${time}`;
  };

  const handleOpenNote = (note: NoteRecord | null) => {
    setSelectedNote(note);
    setIsNoteEditorOpen(true);
  };

  const handleCloseEditor = (opts?: { saved?: boolean; deleted?: boolean }) => {
    setIsNoteEditorOpen(false);
    setSelectedNote(null);
    if (id) getNotesByFolderId(id).then(setNotes);
  };

  const handleSaveNote = useCallback(
    async (
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
      if (saveInFlightRef.current) return saveInFlightRef.current;

      const promise = (async () => {
        let saved: NoteRecord;
        if (noteId) {
          saved = await updateNote(noteId, draft);
        } else {
          const match = await findRecentMatchingNote(draft);
          saved = match ?? (await insertNote(draft));
        }
        if (id) setNotes(await getNotesByFolderId(id));
        return saved;
      })();

      saveInFlightRef.current = promise;
      try { return await promise; }
      finally {
        if (saveInFlightRef.current === promise) saveInFlightRef.current = null;
      }
    },
    [id]
  );

  const handleDeleteNote = async (noteId: string) => {
    await deleteNote(noteId);
    if (id) setNotes(await getNotesByFolderId(id));
  };

  const openFolderMenu = useCallback(() => {
    Keyboard.dismiss();
    searchInputRef.current?.blur();
    setFolderMenuView('main');
    setRenameText(folder?.title ?? '');
    setSelectedColor(folder?.color ?? '');
    setIsFolderMenuOpen(true);
    Animated.parallel([
      Animated.spring(folderMenuSlide, {
        toValue: 1,
        ...springModalSlide,
      }),
      Animated.timing(folderMenuOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
    if (folder && id) {
      getFoldersBySubjectId(folder.subjectId).then(setAllSubjectFolders);
    }
  }, [folder, id, folderMenuSlide, folderMenuOpacity]);

  const closeFolderMenu = useCallback(() => {
    Animated.parallel([
      Animated.timing(folderMenuSlide, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(folderMenuOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsFolderMenuOpen(false);
        Keyboard.dismiss();
      }
    });
  }, [folderMenuSlide, folderMenuOpacity]);

  const { panResponder, scrollYRef } = useDragToClose(
    folderMenuSlide,
    () => { Animated.spring(folderMenuSlide, { toValue: 1, ...springModalSlide }).start(); },
    closeFolderMenu,
  );

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isFolderMenuOpen) {
        closeFolderMenu();
        return true;
      }
      if (isNoteEditorOpen) return false;
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [isFolderMenuOpen, isNoteEditorOpen, router, closeFolderMenu]);

  const handleRenameFolder = useCallback(async () => {
    if (!folder || !renameText.trim() || !id) return;
    await updateFolder(id, { title: renameText.trim() });
    setFolder((prev) => prev ? { ...prev, title: renameText.trim() } : null);
    closeFolderMenu();
  }, [folder, renameText, id, closeFolderMenu]);

  const handleDeleteFolder = useCallback(async () => {
    if (!folder || !id) return;
    await deleteFolder(id);
    router.back();
  }, [folder, id, router]);

  const handleChangeColor = useCallback(async (color: string) => {
    if (!folder || !id) return;
    await updateFolder(id, { color });
    setFolder((prev) => prev ? { ...prev, color } : null);
    setSelectedColor(color);
    setFolderMenuView('main');
  }, [folder, id]);

  const handleTogglePin = useCallback(async () => {
    if (!folder || !id) return;
    const newPinned = !folder.isPinned;
    await updateFolder(id, { isPinned: newPinned });
    setFolder((prev) => prev ? { ...prev, isPinned: newPinned } : null);
    closeFolderMenu();
  }, [folder, id, closeFolderMenu]);

  const handleMoveNotes = useCallback(async (targetId: string | null) => {
    if (!id) return;
    await moveNotesToFolder(id, targetId);
    if (id) setNotes(await getNotesByFolderId(id));
    closeFolderMenu();
  }, [id, closeFolderMenu]);

  const switchViewMode = useCallback((mode: 'list' | 'card' | 'grid') => {
    viewTransition.setValue(0);
    setNoteViewMode(mode);
    setMetaValue('noteViewMode', mode);
    Animated.spring(viewTransition, {
      toValue: 1,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [viewTransition]);

  if (!folder) return null;

  if (isNoteEditorOpen) {
    return (
      <NoteEditorScreen
        subjectId={folder.subjectId}
        subjectTitle={subject?.title || 'Subject'}
        note={selectedNote}
        defaultFolderId={folder.id}
        folderOptions={[{ id: folder.id, title: folder.title, color: folder.color }]}
        onClose={handleCloseEditor}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
      />
    );
  }

  const subjectLabel = subject?.code?.trim() || subject?.title || 'Subject';
  const dockBg = folder.color || '#1c2f2a';
  const screenBg = getFolderBgColor(dockBg);
  const lightDock = isLightColor(dockBg);
  const listBorderColor = dockBg + '20';
  const listIconColor = dockBg + '70';

  return (
    <><View style={[styles.container, { backgroundColor: screenBg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color="#1e2b26" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel} numberOfLines={1}>
            {subjectLabel}: {folder.title}
          </Text>
        </View>
        <Pressable style={styles.headerActionButton} onPress={openFolderMenu} hitSlop={8}>
          <Feather name="more-horizontal" size={22} color="#1e2b26" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, filteredNotes.length === 0 && styles.scrollContentEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: viewTransition, flex: 1 }}>
        {filteredNotes.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Feather name="file-text" size={22} color="#8f968f" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No matching notes' : 'No notes in this folder'}
            </Text>
            <Text style={styles.emptyBody}>
              {searchQuery
                ? 'Try a different search term.'
                : 'Tap the plus button to add a note here.'}
            </Text>
          </View>
        ) : noteViewMode === 'grid' ? (
          <>
            {hasPinned && <Text style={styles.sectionHeader}>Pinned</Text>}
            {pinnedNotes.length > 0 && (
              <View style={styles.gridContainer}>
                <View style={styles.gridColumn}>
                  {pinnedNotes.filter((_, i) => i % 2 === 0).map((note) => (
                    <Pressable key={note.id} style={[styles.gridCard, { width: gridColumnWidth }]} onPress={() => handleOpenNote(note)}>
                      <View style={styles.noteCardTopRow}>
                        <Text style={styles.gridCardTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                      </View>
                      <Text style={styles.gridCardPreview} numberOfLines={6}>{note.contentText || 'Tap to start your first draft.'}</Text>
                      <View style={styles.gridCardBottomRow}>
                        <Text style={styles.gridCardDate}>{dateStr(note.updatedAt)}</Text>
                        <MaterialCommunityIcons name="bookmark" size={16} color="#FFD666" />
                      </View>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.gridColumn}>
                  {pinnedNotes.filter((_, i) => i % 2 === 1).map((note) => (
                    <Pressable key={note.id} style={[styles.gridCard, { width: gridColumnWidth }]} onPress={() => handleOpenNote(note)}>
                      <View style={styles.noteCardTopRow}>
                        <Text style={styles.gridCardTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                      </View>
                      <Text style={styles.gridCardPreview} numberOfLines={6}>{note.contentText || 'Tap to start your first draft.'}</Text>
                      <View style={styles.gridCardBottomRow}>
                        <Text style={styles.gridCardDate}>{dateStr(note.updatedAt)}</Text>
                        <MaterialCommunityIcons name="bookmark" size={16} color="#FFD666" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            {hasPinned && otherNotes.length > 0 && <Text style={[styles.sectionHeader, styles.sectionHeaderOthers]}>Others</Text>}
            {otherNotes.length > 0 && (
              <View style={styles.gridContainer}>
                <View style={styles.gridColumn}>
                  {otherNotes.filter((_, i) => i % 2 === 0).map((note) => (
                    <Pressable key={note.id} style={[styles.gridCard, { width: gridColumnWidth }]} onPress={() => handleOpenNote(note)}>
                      <View style={styles.noteCardTopRow}>
                        <Text style={styles.gridCardTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                      </View>
                      <Text style={styles.gridCardPreview} numberOfLines={6}>{note.contentText || 'Tap to start your first draft.'}</Text>
                      <Text style={styles.gridCardDate}>{dateStr(note.updatedAt)}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.gridColumn}>
                  {otherNotes.filter((_, i) => i % 2 === 1).map((note) => (
                    <Pressable key={note.id} style={[styles.gridCard, { width: gridColumnWidth }]} onPress={() => handleOpenNote(note)}>
                      <View style={styles.noteCardTopRow}>
                        <Text style={styles.gridCardTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                      </View>
                      <Text style={styles.gridCardPreview} numberOfLines={6}>{note.contentText || 'Tap to start your first draft.'}</Text>
                      <Text style={styles.gridCardDate}>{dateStr(note.updatedAt)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : noteViewMode === 'list' ? (
          <>
            {hasPinned && <Text style={styles.sectionHeader}>Pinned</Text>}
            {pinnedNotes.map((note) => (
              <Pressable key={note.id} style={[styles.listRow, { borderBottomColor: listBorderColor }]} onPress={() => handleOpenNote(note)}>
                <View style={styles.listRowLeft}>
                  <Feather name="file-text" size={15} color={listIconColor} />
                  <Text style={styles.listRowTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                </View>
                <View style={styles.listRowRight}>
                  <MaterialCommunityIcons name="bookmark" size={16} color="#FFD666" />
                  <Text style={styles.listRowDate}>{dateStr(note.updatedAt)}</Text>
                </View>
              </Pressable>
            ))}
            {hasPinned && otherNotes.length > 0 && <Text style={[styles.sectionHeader, styles.sectionHeaderOthers]}>Others</Text>}
            {otherNotes.map((note) => (
              <Pressable key={note.id} style={[styles.listRow, { borderBottomColor: listBorderColor }]} onPress={() => handleOpenNote(note)}>
                <View style={styles.listRowLeft}>
                  <Feather name="file-text" size={15} color={listIconColor} />
                  <Text style={styles.listRowTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                </View>
                <Text style={styles.listRowDate}>{dateStr(note.updatedAt)}</Text>
              </Pressable>
            ))}
          </>
        ) : (
          <>
            {hasPinned && <Text style={styles.sectionHeader}>Pinned</Text>}
            {pinnedNotes.map((note) => (
              <Pressable key={note.id} style={styles.noteCard} onPress={() => handleOpenNote(note)}>
                <View style={styles.noteCardTopRow}>
                  <Text style={styles.noteCardTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                </View>
                <Text style={styles.noteCardPreview} numberOfLines={3}>{note.contentText || 'Tap to start your first draft.'}</Text>
                <View style={styles.noteCardDateRow}>
                  <Feather name="clock" size={12} color="#8f968f" />
                  <Text style={styles.noteCardDateText}>{dateStr(note.updatedAt)}</Text>
                  <MaterialCommunityIcons name="bookmark" size={16} color="#FFD666" style={styles.noteCardPinnedIcon} />
                </View>
              </Pressable>
            ))}
            {hasPinned && otherNotes.length > 0 && <Text style={[styles.sectionHeader, styles.sectionHeaderOthers]}>Others</Text>}
            {otherNotes.map((note) => (
              <Pressable key={note.id} style={styles.noteCard} onPress={() => handleOpenNote(note)}>
                <View style={styles.noteCardTopRow}>
                  <Text style={styles.noteCardTitle} numberOfLines={1}>{note.title || 'Untitled note'}</Text>
                </View>
                <Text style={styles.noteCardPreview} numberOfLines={3}>{note.contentText || 'Tap to start your first draft.'}</Text>
                <View style={styles.noteCardDateRow}>
                  <Feather name="clock" size={12} color="#8f968f" />
                  <Text style={styles.noteCardDateText}>{dateStr(note.updatedAt)}</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View
        style={[
          styles.searchDock,
          {
            bottom: keyboardHeight > 0 ? keyboardHeight + 32 : 20,
            opacity: folderMenuOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0],
            }),
            transform: [{
              translateY: folderMenuOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 20],
              }),
            }],
          },
        ]}
        pointerEvents={isFolderMenuOpen ? 'none' : 'auto'}
      >
        <View style={[styles.searchPill, { backgroundColor: dockBg, flex: 1 }]}>
          <Feather name="search" size={16} color={lightDock ? '#2a332e' : '#eef6f1'} />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search notes..."
            placeholderTextColor={lightDock ? '#8f968f' : 'rgba(238,246,241,0.5)'}
            style={[styles.searchInput, { color: lightDock ? '#1e2b26' : '#eef6f1' }]}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Feather name="x" size={16} color={lightDock ? '#2a332e' : '#eef6f1'} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          style={[styles.addNoteButton, { backgroundColor: dockBg }]}
          onPress={() => handleOpenNote(null)}
        >
          <Feather name="plus" size={22} color={lightDock ? '#1e2b26' : '#eef6f1'} />
        </Pressable>
      </Animated.View>
    </View>

      {isFolderMenuOpen ? (
        <Animated.View
          style={[
            styles.folderMenuBackdrop,
            { opacity: folderMenuOpacity },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeFolderMenu} />
        </Animated.View>
      ) : null}

      {isFolderMenuOpen ? (
        <Animated.View
          style={[
            styles.folderMenuPanelWrapper,
            {
              bottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
              transform: [{
                translateY: folderMenuSlide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [screenHeight, 0],
                }),
              }],
            },
          ]}
        >
          <View style={[styles.folderMenuPanel, { maxHeight: screenHeight * 0.8 }]} {...panResponder.panHandlers}>
            <View style={styles.folderMenuHandle} />
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              {folderMenuView === 'main' && (
                <>
                  <Text style={styles.folderMenuTitle}>Folder Actions</Text>

                  <Pressable style={styles.folderMenuActionRow} onPress={() => setFolderMenuView('rename')}>
                    <Feather name="edit-2" size={18} color="#1e2b26" />
                    <Text style={styles.folderMenuActionText}>Rename</Text>
                  </Pressable>

                  <Pressable style={styles.folderMenuActionRow} onPress={() => setFolderMenuView('color')}>
                    <Feather name="circle" size={18} color="#1e2b26" />
                    <Text style={styles.folderMenuActionText}>Change color</Text>
                    <View style={[styles.folderMenuColorPreview, { backgroundColor: folder.color }]} />
                  </Pressable>

                  <Pressable style={styles.folderMenuActionRow} onPress={handleTogglePin}>
                    <MaterialCommunityIcons name={folder.isPinned ? 'bookmark' : 'bookmark-outline'} size={18} color="#1e2b26" />
                    <Text style={styles.folderMenuActionText}>{folder.isPinned ? 'Unpin' : 'Pin'}</Text>
                    {folder.isPinned ? <Feather name="check" size={16} color="#1f5f4d" /> : null}
                  </Pressable>

                  <Pressable style={styles.folderMenuActionRow} onPress={() => setFolderMenuView('info')}>
                    <Feather name="info" size={18} color="#1e2b26" />
                    <Text style={styles.folderMenuActionText}>Folder info</Text>
                  </Pressable>

                  <Pressable style={styles.folderMenuActionRow} onPress={() => setFolderMenuView('view')}>
                    <Feather name="layout" size={18} color="#1e2b26" />
                    <Text style={styles.folderMenuActionText}>View</Text>
                    <Text style={{ fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: '#8f968f', textTransform: 'capitalize' }}>{noteViewMode}</Text>
                  </Pressable>

                  <Pressable style={styles.folderMenuActionRow} onPress={() => setFolderMenuView('move')}>
                    <Feather name="corner-up-right" size={18} color="#1e2b26" />
                    <Text style={styles.folderMenuActionText}>Move all notes to...</Text>
                  </Pressable>

                  <View style={styles.folderMenuDivider} />

                  <Pressable style={styles.folderMenuActionRow} onPress={() => { setDeleteConfirmInput(''); setFolderMenuView('delete'); }}>
                    <Feather name="trash-2" size={18} color="#b42318" />
                    <Text style={[styles.folderMenuActionText, { color: '#b42318' }]}>Delete folder</Text>
                  </Pressable>
                </>
              )}

              {folderMenuView === 'rename' && (
                <>
                  <Text style={styles.folderMenuTitle}>Rename folder</Text>
                  <TextInput
                    value={renameText}
                    onChangeText={setRenameText}
                    style={styles.folderMenuInput}
                    placeholder="Folder name"
                    placeholderTextColor="#a7a7a1"
                  />
                  <View style={styles.folderMenuActionRow}>
                    <Pressable onPress={() => setFolderMenuView('main')}>
                      <Text style={styles.folderMenuCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable style={styles.folderMenuSaveButton} onPress={handleRenameFolder}>
                      <Text style={styles.folderMenuSaveText}>Save</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {folderMenuView === 'color' && (
                <>
                  <Text style={styles.folderMenuTitle}>Change color</Text>
                  <View style={styles.folderMenuColorGrid}>
                    {FOLDER_COLORS.map((color) => (
                      <Pressable
                        key={color}
                        style={[
                          styles.folderMenuColorSwatch,
                          { backgroundColor: color },
                          selectedColor === color && styles.folderMenuColorSwatchSelected,
                        ]}
                        onPress={() => handleChangeColor(color)}
                      />
                    ))}
                  </View>
                  <Pressable style={styles.folderMenuBackAction} onPress={() => setFolderMenuView('main')}>
                    <Text style={styles.folderMenuBackText}>Back</Text>
                  </Pressable>
                </>
              )}

              {folderMenuView === 'info' && (
                <>
                  <Text style={styles.folderMenuTitle}>Folder info</Text>
                  <View style={styles.folderMenuInfoRow}>
                    <Text style={styles.folderMenuInfoLabel}>Name</Text>
                    <Text style={styles.folderMenuInfoValue}>{folder.title}</Text>
                  </View>
                  <View style={styles.folderMenuInfoRow}>
                    <Text style={styles.folderMenuInfoLabel}>Subject</Text>
                    <Text style={styles.folderMenuInfoValue}>{subject?.title || '—'}</Text>
                  </View>
                  <View style={styles.folderMenuInfoRow}>
                    <Text style={styles.folderMenuInfoLabel}>Notes</Text>
                    <Text style={styles.folderMenuInfoValue}>{notes.length}</Text>
                  </View>
                  <View style={styles.folderMenuInfoRow}>
                    <Text style={styles.folderMenuInfoLabel}>Created</Text>
                    <Text style={styles.folderMenuInfoValue}>
                      {new Date(folder.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <View style={styles.folderMenuInfoRow}>
                    <Text style={styles.folderMenuInfoLabel}>Color</Text>
                    <View style={[styles.folderMenuInfoColorDot, { backgroundColor: folder.color }]} />
                  </View>
                  <Pressable style={styles.folderMenuBackAction} onPress={() => setFolderMenuView('main')}>
                    <Text style={styles.folderMenuBackText}>Back</Text>
                  </Pressable>
                </>
              )}

              {folderMenuView === 'move' && (
                <>
                  <Text style={styles.folderMenuTitle}>Move all notes to...</Text>
                  <Pressable
                    style={styles.folderMenuActionRow}
                    onPress={() => handleMoveNotes(null)}
                  >
                    <Feather name="inbox" size={18} color="#8f968f" />
                    <Text style={styles.folderMenuActionText}>Loose notes</Text>
                  </Pressable>
                  {allSubjectFolders
                    .filter((f) => f.id !== folder.id)
                    .map((f) => (
                      <Pressable
                        key={f.id}
                        style={styles.folderMenuActionRow}
                        onPress={() => handleMoveNotes(f.id)}
                      >
                        <Feather name="folder" size={18} color="#8f968f" />
                        <Text style={styles.folderMenuActionText}>{f.title}</Text>
                      </Pressable>
                    ))}
                  <Pressable style={styles.folderMenuBackAction} onPress={() => setFolderMenuView('main')}>
                    <Text style={styles.folderMenuBackText}>Back</Text>
                  </Pressable>
                </>
              )}

              {folderMenuView === 'view' && (
                <>
                  <Text style={styles.folderMenuTitle}>View mode</Text>
                  <View style={styles.folderMenuNote}>
                    <Feather name="info" size={14} color="#8f968f" />
                    <Text style={styles.folderMenuNoteText}>Applies to all folders</Text>
                  </View>
                  {(['list', 'card', 'grid'] as const).map((mode) => (
                    <Pressable
                      key={mode}
                      style={styles.folderMenuActionRow}
                      onPress={() => switchViewMode(mode)}
                    >
                      <Feather name={mode === 'list' ? 'align-left' : mode === 'card' ? 'credit-card' : 'grid'} size={18} color="#1e2b26" />
                      <Text style={styles.folderMenuActionText}>{mode === 'list' ? 'List' : mode === 'card' ? 'Card' : 'Grid'}</Text>
                      {noteViewMode === mode ? <Feather name="check" size={16} color="#1f5f4d" /> : null}
                    </Pressable>
                  ))}
                  <Pressable style={styles.folderMenuBackAction} onPress={() => setFolderMenuView('main')}>
                    <Text style={styles.folderMenuBackText}>Back</Text>
                  </Pressable>
                </>
              )}

              {folderMenuView === 'delete' && (
                <>
                  <Text style={styles.folderMenuTitle}>Delete folder?</Text>
                  <Text style={styles.folderMenuDeleteBody}>
                    This action cannot be undone. The folder and all of its notes will be permanently deleted.
                  </Text>
                  <TextInput
                    style={styles.folderMenuDeleteInput}
                    placeholder='Type "DELETE THIS FOLDER" to confirm'
                    placeholderTextColor="#8f968f"
                    value={deleteConfirmInput}
                    onChangeText={setDeleteConfirmInput}
                    autoCapitalize="characters"
                    autoFocus
                  />
                  <Pressable
                    style={[styles.folderMenuDeleteButton, deleteConfirmInput !== 'DELETE THIS FOLDER' && styles.folderMenuDeleteButtonDisabled]}
                    onPress={handleDeleteFolder}
                    disabled={deleteConfirmInput !== 'DELETE THIS FOLDER'}
                  >
                    <Text style={styles.folderMenuDeleteButtonText}>Delete</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f7f2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerLabel: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 17,
    color: '#1e2b26',
    letterSpacing: -0.3,
  },
  headerActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchDock: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addNoteButton: {
    width: 64,
    height: 64,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLgDark,
  },
  searchPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 26,
    height: 64,
    paddingHorizontal: 20,
    gap: 12,
    ...shadowLgDark,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    paddingVertical: 0,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 14,
    paddingBottom: 20,
  },
  scrollContentEmpty: {
    flexGrow: 1,
  },
  noteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#1e2b26',
    flex: 1,
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
  noteCardPinnedIcon: {
    marginLeft: 'auto',
  },
  noteCardDateText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#8f968f',
  },
  sectionHeader: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#8f968f',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingLeft: 8,
    paddingBottom: 6,
  },
  sectionHeaderOthers: {
    paddingTop: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 17,
    color: '#1e2b26',
  },
  emptyBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#6b746f',
    textAlign: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#efede8',
  },
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  listRowTitle: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#1e2b26',
    flex: 1,
  },
  listRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listRowDate: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#8f968f',
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  gridColumn: {
    gap: 12,
  },
  gridCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    maxHeight: 220,
  },
  gridCardTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#1e2b26',
    flex: 1,
  },
  gridCardPreview: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    lineHeight: 17,
    color: '#5f6661',
  },
  gridCardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  gridCardDate: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 11,
    color: '#8f968f',
  },
  folderMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 7, 0.3)',
    zIndex: 99,
  },
  folderMenuPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  folderMenuPanel: {
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
  folderMenuHandle: {
    width: 68,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e3e0d8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  folderMenuTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 24,
    color: '#111111',
    letterSpacing: -0.4,
    marginBottom: 20,
  },
  folderMenuActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  folderMenuActionText: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: '#1e2b26',
  },
  folderMenuColorPreview: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  folderMenuNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#eef2ee',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    marginTop: -10,
  },
  folderMenuNoteText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#5f6661',
    flex: 1,
  },
  folderMenuDivider: {
    height: 1,
    backgroundColor: '#e8e6de',
    marginVertical: 4,
  },
  folderMenuInput: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 17,
    color: '#111111',
    borderBottomWidth: 2,
    borderBottomColor: '#2d4d43',
    paddingVertical: 10,
    marginBottom: 24,
  },
  folderMenuCancelText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#9aa09a',
    paddingHorizontal: 8,
  },
  folderMenuSaveButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c2f2a',
  },
  folderMenuSaveText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  folderMenuColorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  folderMenuColorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  folderMenuColorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#111111',
  },
  folderMenuBackAction: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  folderMenuBackText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#2d4d43',
  },
  folderMenuInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#efede8',
  },
  folderMenuInfoLabel: {
    width: 80,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: '#8f968f',
  },
  folderMenuInfoValue: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: '#1e2b26',
  },
  folderMenuInfoColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  folderMenuDeleteBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#5f6661',
    marginBottom: 24,
  },
  folderMenuDeleteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  folderMenuDeleteInput: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#1e2b26',
    backgroundColor: '#f5f5f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  folderMenuDeleteButton: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b42318',
  },
  folderMenuDeleteButtonDisabled: {
    opacity: 0.35,
  },
  folderMenuDeleteButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#ffffff',
  },
});
