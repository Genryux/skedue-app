import { getFolderBgColor } from '../../src/features/subjects/SubjectDetailScreen';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Keyboard,
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
  findRecentMatchingNote,
  getFolderById,
  getNotesByFolderId,
  getSubjectById,
  insertNote,
  updateNote,
  type FolderRecord,
  type NoteRecord,
  type SubjectRecord,
} from '../../src/data/local/db';
import { shadowLg, shadowLgDark } from '../../src/ui/tokens/shadows';

const NoteEditorScreen = require('../../src/features/subjects/NoteEditorScreen').default as React.ComponentType<{
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

  const saveInFlightRef = useRef<Promise<NoteRecord> | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const load = async () => {
      const f = await getFolderById(id);
      if (!mounted) return;
      setFolder(f);

      if (f) {
        const [s, n] = await Promise.all([
          getSubjectById(f.subjectId),
          getNotesByFolderId(f.id),
        ]);
        if (!mounted) return;
        setSubject(s);
        setNotes(n);
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

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isNoteEditorOpen) return false;
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [isNoteEditorOpen, router]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.contentText.toLowerCase().includes(q)
    );
  }, [notes, searchQuery]);

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

  if (!folder) return null;

  if (isNoteEditorOpen) {
    return (
      <NoteEditorScreen
        subjectId={folder.subjectId}
        subjectTitle={subject?.title || 'Subject'}
        note={selectedNote}
        folderOptions={[]}
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

  return (
    <View style={[styles.container, { backgroundColor: screenBg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
          <Feather name="chevron-left" size={22} color="#1e2b26" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel} numberOfLines={1}>
            {subjectLabel}: {folder.title}
          </Text>
        </View>
        <Pressable style={styles.headerActionButton} hitSlop={8}>
          <Feather name="more-horizontal" size={22} color="#1e2b26" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, filteredNotes.length === 0 && styles.scrollContentEmpty]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
        ) : (
          filteredNotes.map((note) => (
            <Pressable
              key={note.id}
              style={styles.noteCard}
              onPress={() => handleOpenNote(note)}
            >
              <View style={styles.noteCardTopRow}>
                <Text style={styles.noteCardTitle} numberOfLines={1}>
                  {note.title || 'Untitled note'}
                </Text>
                {note.isPinned ? <Feather name="star" size={14} color="#9A6700" /> : null}
              </View>
              <Text style={styles.noteCardPreview} numberOfLines={2}>
                {note.contentText || 'Tap to start your first draft.'}
              </Text>
              <View style={styles.noteCardDateRow}>
                <Feather name="clock" size={12} color="#8f968f" />
                <Text style={styles.noteCardDateText}>{dateStr(note.updatedAt)}</Text>
              </View>
            </Pressable>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[styles.searchDock, { bottom: keyboardHeight > 0 ? keyboardHeight + 32 : 20 }]}>
        <View style={[styles.searchPill, { backgroundColor: dockBg, flex: 1 }]}>
          <Feather name="search" size={16} color={lightDock ? '#2a332e' : '#eef6f1'} />
          <TextInput
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
      </View>
    </View>
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLg,
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLg,
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
    paddingHorizontal: 20,
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
});
