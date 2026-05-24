import { Feather } from '@expo/vector-icons';
import { EnrichedTextInput, type EnrichedTextInputInstance } from 'react-native-enriched';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DynamicIslandToast from '../../ui/DynamicIslandToast';
import { shadowLg, shadowLgDark } from '../../ui/tokens/shadows';
import type { NoteRecord } from '../../data/local/db';

type FolderOption = {
  id: string;
  title: string;
  color: string;
};

type NoteEditorDraft = {
  subjectId: string;
  folderId: string | null;
  title: string;
  contentHtml: string;
  contentText: string;
  isPinned: boolean;
};

type NoteEditorScreenProps = {
  subjectId: string;
  subjectTitle: string;
  note: NoteRecord | null;
  folderOptions: FolderOption[];
  onClose: () => void;
  onSave: (noteId: string | null, draft: NoteEditorDraft) => Promise<NoteRecord | null | void> | NoteRecord | null | void;
};

type FormattingAction =
  | 'toggleBold'
  | 'toggleItalic'
  | 'toggleUnderline'
  | 'toggleStrikeThrough'
  | 'toggleInlineCode'
  | 'toggleH1'
  | 'toggleH2'
  | 'toggleBlockQuote'
  | 'toggleOrderedList'
  | 'toggleUnorderedList'
  | 'toggleCheckboxList';

type NoteSnapshot = {
  html: string;
  text: string;
};

const BLOCK_ACTIONS = [
  { key: 'text', label: 'Text', icon: 'type', action: null },
  { key: 'h1', label: 'Heading 1', icon: 'heading', action: 'toggleH1' as const },
  { key: 'h2', label: 'Heading 2', icon: 'heading', action: 'toggleH2' as const },
  { key: 'quote', label: 'Quote', icon: 'message-circle', action: 'toggleBlockQuote' as const },
  { key: 'bullets', label: 'Bulleted', icon: 'list', action: 'toggleUnorderedList' as const },
  { key: 'numbers', label: 'Numbered', icon: 'hash', action: 'toggleOrderedList' as const },
  { key: 'checklist', label: 'Checklist', icon: 'check-square', action: 'toggleCheckboxList' as const },
  { key: 'code', label: 'Code', icon: 'code', action: 'toggleInlineCode' as const },
] as const;

const INLINE_ACTIONS = [
  { key: 'bold', label: 'B', action: 'toggleBold' as const },
  { key: 'italic', label: 'I', action: 'toggleItalic' as const },
  { key: 'underline', label: 'U', action: 'toggleUnderline' as const },
  { key: 'strikethrough', label: 'S', action: 'toggleStrikeThrough' as const },
] as const;

const stripHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Wraps the inner text of checked checklist items in <s>…</s> so they render
 * with a strikethrough. Unchecked items are left untouched.
 */
const applyChecklistStrikethrough = (html: string): string => {
  // Checked items: <li data-checked="true">…</li>
  // We inject <s> around everything between the opening and closing tags
  // while preserving any nested <p> tags the editor emits.
  return html.replace(
    /(<li[^>]*data-checked="true"[^>]*>)(.*?)(<\/li>)/gs,
    (_, open, inner, close) => {
      // Avoid double-wrapping if already has <s>
      if (inner.includes('<s>')) return _ ;
      return `${open}<s>${inner}</s>${close}`;
    }
  ).replace(
    // Remove stray <s> from unchecked items
    /(<li[^>]*data-checked="false"[^>]*>)<s>(.*?)<\/s>(<\/li>)/gs,
    (_, open, inner, close) => `${open}${inner}${close}`
  );
};

const countWords = (value: string) => {
  const words = value.trim().match(/\b[\w'-]+\b/g);
  return words?.length ?? 0;
};

const formatDateLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  const hour = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `Last edited today at ${displayHour}:${minutes} ${suffix}`;
};

export default function NoteEditorScreen({ subjectId, subjectTitle, note, folderOptions, onClose, onSave }: NoteEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const editorRef = useRef<EnrichedTextInputInstance>(null);
  const historyRef = useRef<{ entries: NoteSnapshot[]; index: number }>({ entries: [], index: -1 });
  const isApplyingHistoryRef = useRef(false);

  const [savedNoteId, setSavedNoteId] = useState<string | null>(note?.id ?? null);
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentText, setContentText] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [styleState, setStyleState] = useState<Record<string, { isActive: boolean; isBlocking: boolean; isConflicting: boolean }>>({});
  const [showToast, setShowToast] = useState(false);

  const draftStateRef = useRef({ savedNoteId, title, contentHtml, contentText, folderId, isPinned, subjectId: note?.subjectId ?? subjectId });
  draftStateRef.current = { savedNoteId, title, contentHtml, contentText, folderId, isPinned, subjectId: note?.subjectId ?? subjectId };

  const initialTitle = note?.title ?? '';
  const initialHtml = note?.contentHtml ?? '';
  const initialText = note?.contentText ?? '';
  const initialFolder = note?.folderId ?? null;

  const lastSavedStateRef = useRef({ title: initialTitle, contentHtml: initialHtml, folderId: initialFolder, isPinned: note?.isPinned ?? false });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setIsDirty(
      title.trim() !== lastSavedStateRef.current.title.trim() ||
      contentHtml.trim() !== lastSavedStateRef.current.contentHtml.trim() ||
      folderId !== lastSavedStateRef.current.folderId ||
      isPinned !== lastSavedStateRef.current.isPinned
    );
  }, [title, contentHtml, folderId, isPinned]);

  useEffect(() => {
    setSavedNoteId(note?.id ?? null);
    setTitle(initialTitle);
    setContentHtml(initialHtml);
    setContentText(initialText);
    setFolderId(initialFolder);
    setIsPinned(note?.isPinned ?? false);
    setIsSaving(false);
    setIsBlockMenuOpen(false);
    setIsFolderMenuOpen(false);
    setIsMoreMenuOpen(false);
    setStyleState({});
    historyRef.current = { entries: [{ html: initialHtml, text: initialText }], index: 0 };
  }, [initialFolder, initialHtml, initialText, initialTitle, note?.id, note?.isPinned]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => {
      backSubscription.remove();
      void persistNote(true);
    };
  }, []);

  const folderLabel = useMemo(() => {
    if (!folderId) {
      return subjectTitle;
    }

    return folderOptions.find((folder) => folder.id === folderId)?.title ?? subjectTitle;
  }, [folderId, folderOptions, subjectTitle]);

  const displayMeta = useMemo(() => {
    const wordCount = countWords(stripHtml(contentHtml));

    if (note) {
      return { updatedLabel: formatDateLabel(note.updatedAt), wordCount };
    }

    return { updatedLabel: 'New note', wordCount };
  }, [contentHtml, note]);

  const canUndo = historyRef.current.index > 0;
  const canRedo = historyRef.current.index < historyRef.current.entries.length - 1;

  const pushHistorySnapshot = (html: string, text: string) => {
    if (isApplyingHistoryRef.current) {
      return;
    }

    const currentEntry = historyRef.current.entries[historyRef.current.index];
    if (currentEntry && currentEntry.html === html && currentEntry.text === text) {
      return;
    }

    if (historyRef.current.index === 0) {
      const firstEntry = historyRef.current.entries[0];
      if (!firstEntry.text.trim() && !text.trim()) {
        historyRef.current.entries[0] = { html, text };
        return;
      }
    }

    const nextEntries = historyRef.current.entries.slice(0, historyRef.current.index + 1);
    nextEntries.push({ html, text });
    historyRef.current = { entries: nextEntries, index: nextEntries.length - 1 };
  };

  const applyHistorySnapshot = (index: number) => {
    const snapshot = historyRef.current.entries[index];
    if (!snapshot) {
      return;
    }

    isApplyingHistoryRef.current = true;
    historyRef.current = { entries: historyRef.current.entries, index };
    setContentHtml(snapshot.html);
    setContentText(snapshot.text);
    editorRef.current?.setValue(snapshot.html || snapshot.text);

    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  };

  const handleUndo = () => {
    if (!canUndo) {
      return;
    }

    applyHistorySnapshot(historyRef.current.index - 1);
  };

  const handleRedo = () => {
    if (!canRedo) {
      return;
    }

    applyHistorySnapshot(historyRef.current.index + 1);
  };

  const applyFormatting = (action: FormattingAction) => {
    const input = editorRef.current;
    if (!input) {
      return;
    }

    switch (action) {
      case 'toggleBold':
        input.toggleBold();
        break;
      case 'toggleItalic':
        input.toggleItalic();
        break;
      case 'toggleUnderline':
        input.toggleUnderline();
        break;
      case 'toggleStrikeThrough':
        input.toggleStrikeThrough();
        break;
      case 'toggleInlineCode':
        input.toggleInlineCode();
        break;
      case 'toggleH1':
        input.toggleH1();
        break;
      case 'toggleH2':
        input.toggleH2();
        break;
      case 'toggleBlockQuote':
        input.toggleBlockQuote();
        break;
      case 'toggleOrderedList':
        input.toggleOrderedList();
        break;
      case 'toggleUnorderedList':
        input.toggleUnorderedList();
        break;
      case 'toggleCheckboxList':
        input.toggleCheckboxList(false);
        break;
    }
  };

  const handleBlockAction = (action: FormattingAction | null) => {
    if (action) {
      applyFormatting(action);
    }
    setIsBlockMenuOpen(false);
  };

  const handleFolderSelect = (selectedFolderId: string | null) => {
    setFolderId(selectedFolderId);
    setIsFolderMenuOpen(false);
  };

  const togglePinned = () => {
    setIsPinned((prev) => !prev);
    setIsMoreMenuOpen(false);
  };

  const persistNote = async (isUnmounting = false) => {
    const state = draftStateRef.current;

    // Prevent saving purely empty note strings
    if (!state.title.trim() && (!state.contentText.trim() || state.contentHtml === '<p></p>')) {
      return;
    }

    const draft: NoteEditorDraft = {
      subjectId: state.subjectId,
      folderId: state.folderId,
      title: state.title.trim(),
      contentHtml: state.contentHtml.trim() || '<p></p>',
      contentText: state.contentText.trim() || state.title.trim(),
      isPinned: state.isPinned,
    };

    if (!isUnmounting) {
      setIsSaving(true);
    }

    try {
      const saved = await onSave(state.savedNoteId, draft);
      if (saved && typeof saved === 'object' && 'id' in saved && typeof saved.id === 'string') {
        state.savedNoteId = saved.id;
        
        lastSavedStateRef.current = {
          title: state.title,
          contentHtml: state.contentHtml,
          folderId: state.folderId,
          isPinned: state.isPinned,
        };

        if (!isUnmounting) {
          setSavedNoteId(saved.id);
          setIsDirty(false);
          setShowToast(true);
        }
      }
    } finally {
      if (!isUnmounting) {
        setIsSaving(false);
      }
    }
  };

  return (
    <View style={styles.rootWrapper}>
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.headerIconButton} onPress={onClose} hitSlop={8}>
            <Feather name="arrow-left" size={26} color="#111111" />
          </Pressable>

          <View style={styles.headerCenterControls}>
            <Pressable style={[styles.historyButton, !canUndo && styles.historyButtonDisabled]} onPress={handleUndo} disabled={!canUndo} hitSlop={8}>
              <Feather name="corner-down-left" size={18} color={canUndo ? '#111111' : '#b3b0a7'} />
            </Pressable>
            <Pressable style={[styles.historyButton, !canRedo && styles.historyButtonDisabled]} onPress={handleRedo} disabled={!canRedo} hitSlop={8}>
              <Feather name="corner-down-right" size={18} color={canRedo ? '#111111' : '#b3b0a7'} />
            </Pressable>
          </View>

          <Pressable style={styles.headerIconButton} onPress={() => setIsMoreMenuOpen(true)} hitSlop={8}>
            <Feather name="more-horizontal" size={24} color="#111111" />
          </Pressable>
        </View>

        <View style={styles.divider} />

        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 180 + keyboardHeight + insets.bottom }]} keyboardShouldPersistTaps="handled">
          <View style={styles.breadcrumbRow}>
            <View style={styles.breadcrumbTextWrap}>
              <Text style={styles.breadcrumbSubject} numberOfLines={1}>{subjectTitle}</Text>
              <Feather name="chevron-right" size={15} color="#8a9088" />
              <Text style={styles.breadcrumbFolder} numberOfLines={1}>{folderId ? folderLabel : 'Loose notes'}</Text>
            </View>

            <Pressable style={styles.folderDropdownButton} onPress={() => setIsFolderMenuOpen((current) => !current)} hitSlop={8}>
              <Feather name="chevron-down" size={18} color="#2d4d43" />
            </Pressable>
          </View>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Note title"
            placeholderTextColor="#a7a7a1"
            autoCapitalize="sentences"
            style={styles.titleInput}
            multiline
          />

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{displayMeta.updatedLabel}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{displayMeta.wordCount} words</Text>
          </View>

          <View style={styles.bodyWrap}>
            <EnrichedTextInput
              key={savedNoteId ?? 'new-note'}
              ref={editorRef}
              defaultValue={initialHtml}
              placeholder="Start writing your note..."
              placeholderTextColor="#10141366"
              autoCapitalize="sentences"
              scrollEnabled={false}
              onChangeText={(event) => setContentText(event.nativeEvent.value)}
              onChangeHtml={(event) => {
                const rawValue = event.nativeEvent.value;
                const value = applyChecklistStrikethrough(rawValue);
                const strippedValue = stripHtml(value);
                setContentHtml(value);
                setContentText(strippedValue);
                pushHistorySnapshot(value, strippedValue);
              }}
              onChangeState={(event) => setStyleState(event.nativeEvent)}
              style={styles.bodyInput}
              htmlStyle={styles.bodyHtmlStyle}
              returnKeyType="default"
              submitBehavior="newline"
            />
          </View>
        </ScrollView>

        <View style={[styles.toolbarDock, { bottom: keyboardHeight > 0 ? keyboardHeight : 0 }]}>
          {isBlockMenuOpen ? (
            <View style={styles.blockMenuCard}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.blockMenuRow}>
                {BLOCK_ACTIONS.map((item) => (
                  <Pressable key={item.key} style={styles.blockMenuButton} onPress={() => handleBlockAction(item.action)}>
                    <View style={styles.blockMenuIconWrap}>
                      {item.key === 'h1' || item.key === 'h2' ? (
                        <Text style={styles.blockMenuIconText}>{item.key.toUpperCase()}</Text>
                      ) : (
                        <Feather name={item.icon as any} size={17} color="#1f3b34" />
                      )}
                    </View>
                    <Text style={styles.blockMenuButtonText}>{item.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.toolbarDivider} />
          <View style={styles.toolbarRow}>
            <Pressable style={styles.plusButton} onPress={() => setIsBlockMenuOpen((current) => !current)}>
              <Feather name="plus" size={22} color="#111111" />
            </Pressable>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inlineActionRow}>
              {INLINE_ACTIONS.map((item) => {
                const active = Boolean(styleState[item.key]?.isActive);

                return (
                  <ToolbarButton
                    key={item.key}
                    label={item.label}
                    active={active}
                    onPress={() => applyFormatting(item.action)}
                    italic={item.key === 'italic'}
                    underline={item.key === 'underline'}
                    strike={item.key === 'strikethrough'}
                  />
                );
              })}
            </ScrollView>

            {/* Save button: only visible when there is content AND unsaved changes */}
            {(isDirty && (title.trim().length > 0 || contentText.trim().length > 0)) ? (
              <Pressable
                style={[styles.saveDockButton, isSaving && styles.saveDockButtonDisabled]}
                onPress={() => !isSaving && void persistNote()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Feather name="loader" size={24} color="#111111" />
                ) : (
                  <Feather name="check" size={24} color="#1f5f4d" />
                )}
              </Pressable>
            ) : null}
          </View>
        </View>

        {isFolderMenuOpen ? (
          <View style={styles.menuOverlay} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsFolderMenuOpen(false)} />
            <View style={styles.folderMenuSheet}>
              <FolderRow label={subjectTitle} active={folderId === null} onPress={() => handleFolderSelect(null)} />
              {folderOptions.map((folder) => (
                <FolderRow
                  key={folder.id}
                  label={folder.title}
                  active={folder.id === folderId}
                  onPress={() => handleFolderSelect(folder.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {isMoreMenuOpen ? (
          <View style={styles.menuOverlay} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsMoreMenuOpen(false)} />
            <View style={styles.menuSheet}>
              <Pressable style={styles.menuRow} onPress={togglePinned}>
                <Text style={styles.menuRowLabel}>{isPinned ? 'Unpin note' : 'Pin note'}</Text>
              </Pressable>
              <Pressable style={styles.menuRow} onPress={() => { setIsMoreMenuOpen(false); void persistNote(); }}>
                <Text style={styles.menuRowLabel}>{isSaving ? 'Saving…' : 'Save note'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

      </View>
    </SafeAreaView>

    {/* Toast lives outside SafeAreaView so it can float at the true top of the screen */}
    {showToast ? (
      <DynamicIslandToast
        visible={showToast}
        message="Note saved successfully"
        onHide={() => setShowToast(false)}
      />
    ) : null}
    </View>
  );
}

const ToolbarButton = ({
  label,
  active,
  onPress,
  italic,
  underline,
  strike,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}) => (
  <Pressable style={[styles.toolbarButton, active && styles.toolbarButtonActive]} onPress={onPress}>
    <Text
      style={[
        styles.toolbarButtonLabel,
        italic && styles.toolbarButtonLabelItalic,
        underline && styles.toolbarButtonLabelUnderline,
        strike && styles.toolbarButtonLabelStrike,
        active && styles.toolbarButtonLabelActive,
      ]}
    >
      {label}
    </Text>
  </Pressable>
);

const FolderRow = ({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable style={[styles.folderMenuRow, active && styles.folderMenuRowActive]} onPress={onPress}>
    <View style={[styles.folderMenuDot, active && styles.folderMenuDotActive]} />
    <Text style={styles.folderMenuText}>{label}</Text>
    {active ? <Feather name="check" size={16} color="#1f3b34" /> : null}
  </Pressable>
);

const styles = StyleSheet.create({
  rootWrapper: {
    flex: 1,
    backgroundColor: '#f8f7f2',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f7f2',
  },
  screen: {
    flex: 1,
    backgroundColor: '#f8f7f2',
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerCenterControls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1efe8',
  },
  historyButtonDisabled: {
    opacity: 0.45,
  },
  divider: {
    height: 1,
    backgroundColor: '#d9d6ce',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  breadcrumbTextWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breadcrumbSubject: {
    maxWidth: '40%',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 13,
    color: '#66706b',
  },
  breadcrumbFolder: {
    flexShrink: 1,
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#22433a',
  },
  folderDropdownButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ed',
    marginLeft: 10,
  },
  titleInput: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 34,
    lineHeight: 40,
    color: '#111111',
    letterSpacing: -1.1,
    paddingVertical: 0,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  metaText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#6e726d',
  },
  metaDot: {
    marginHorizontal: 10,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#6e726d',
  },
  bodyWrap: {
    marginBottom: 24,
  },
  bodyInput: {
    minHeight: 330,
    paddingVertical: 0,
    fontFamily: 'Manrope_500Medium',
    fontSize: 17,
    lineHeight: 28,
    color: '#111111',
  },
  bodyHtmlStyle: {
    p: {
      fontFamily: 'Manrope_500Medium',
      fontSize: 17,
      lineHeight: 28,
      color: '#111111',
    },
    h1: {
      fontFamily: 'Manrope_800ExtraBold',
      fontSize: 28,
      lineHeight: 34,
      color: '#111111',
      marginTop: 16,
      marginBottom: 8,
    },
    h2: {
      fontFamily: 'Manrope_700Bold',
      fontSize: 21,
      lineHeight: 28,
      color: '#111111',
      marginTop: 18,
      marginBottom: 8,
    },
    h3: {
      fontFamily: 'Manrope_700Bold',
      fontSize: 18,
      lineHeight: 24,
      color: '#111111',
    },
    ul: {
      gapWidth: 10,
      marginLeft: 20,
      bulletColor: '#111111',
    },
    ol: {
      gapWidth: 10,
      marginLeft: 20,
      markerColor: '#111111',
    },
    ulCheckbox: {
      boxSize: 14,
      gapWidth: 8,
      marginLeft: 20,
      boxColor: '#111111',
    },
    code: {
      backgroundColor: '#eceae3',
      color: '#111111',
    },
    codeblock: {
      backgroundColor: '#eceae3',
      borderRadius: 18,
      color: '#111111',
    },
    blockquote: {
      borderColor: '#d1d7d0',
      borderWidth: 1,
      color: '#111111',
    },
    a: {
      color: '#1f5f4d',
      textDecorationLine: 'underline',
    },
  },
  toolbarDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#f8f7f2',
    paddingTop: 8,
    paddingBottom: 10,
  },
  toolbarDivider: {
    height: 1,
    backgroundColor: '#ddd8cf',
    marginBottom: 10,
  },
  toolbarRow: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  plusButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  inlineActionRow: {
    gap: 8,
    alignItems: 'center',
    paddingRight: 10,
  },
  saveDockButton: {
    marginLeft: 'auto',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDockButtonDisabled: {
    opacity: 0.5,
  },
  toolbarButton: {
    minWidth: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  toolbarButtonActive: {
    backgroundColor: '#e8ebe5',
  },
  toolbarButtonLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 17,
    color: '#111111',
  },
  toolbarButtonLabelItalic: {
    fontStyle: 'italic',
  },
  toolbarButtonLabelUnderline: {
    textDecorationLine: 'underline',
  },
  toolbarButtonLabelStrike: {
    textDecorationLine: 'line-through',
  },
  toolbarButtonLabelActive: {
    color: '#111111',
  },
  blockMenuCard: {
    paddingBottom: 10,
  },
  blockMenuRow: {
    paddingHorizontal: 12,
    gap: 10,
  },
  blockMenuButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1efe8',
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  blockMenuIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockMenuIconText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    color: '#1f3b34',
  },
  blockMenuButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#111111',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  folderMenuSheet: {
    position: 'absolute',
    top: 128,
    right: 14,
    width: 240,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 8,
    ...shadowLgDark,
  },
  folderMenuRow: {
    minHeight: 44,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  folderMenuRowActive: {
    backgroundColor: '#edf2ef',
  },
  folderMenuDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#c3cac5',
  },
  folderMenuDotActive: {
    backgroundColor: '#2d4d43',
  },
  folderMenuText: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
    color: '#111111',
  },
  menuSheet: {
    position: 'absolute',
    right: 14,
    top: 68,
    width: 220,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 8,
    ...shadowLgDark,
  },
  menuRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  menuRowLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#111111',
  },
});