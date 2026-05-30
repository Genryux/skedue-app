import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { EnrichedTextInput, type EnrichedTextInputInstance } from 'react-native-enriched';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Share,
  Keyboard,
  Modal,
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
  defaultFolderId?: string | null;
  folderOptions: FolderOption[];
  onClose: (options?: { saved?: boolean; deleted?: boolean }) => void;
  onSave: (noteId: string | null, draft: NoteEditorDraft) => Promise<NoteRecord | null | void> | NoteRecord | null | void;
  onDelete: (noteId: string) => Promise<void> | void;
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
  ts: number;
};

const UI_TEXT_THROTTLE_MS = 160;
const HISTORY_SNAPSHOT_DEBOUNCE_MS = 320;
const HISTORY_SNAPSHOT_MAX_WAIT_MS = 1500;
const HISTORY_MAX_ENTRIES = 180;
const AUTOSAVE_IDLE_MS = 5000;

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

/**
 * Wraps the inner text of checked checklist items in <s>…</s> so they render
 * with a strikethrough. Unchecked items are left untouched.
 */
const applyChecklistStrikethrough = (html: string): string => {
  if (!html.includes('<li') || (!html.includes('checked') && !html.includes('data-checked="true"'))) {
    return html;
  }

  return html
    .replace(
      // Checked items can appear as either:
      // - <li checked>…</li>
      // - <li data-checked="true" ...>…</li>
      /(<li\b[^>]*\b(?:data-checked="true"|checked)\b[^>]*>)(.*?)(<\/li>)/gs,
      (full, open: string, inner: string, close: string) => {
        if (inner.includes('<s>')) return full;
        return `${open}<s>${inner}</s>${close}`;
      }
    )
    .replace(
      // Unchecked items: remove accidental <s> wrappers.
      /(<li\b[^>]*\bdata-checked="false"\b[^>]*>)\s*<s>(.*?)<\/s>\s*(<\/li>)/gs,
      (_full, open: string, inner: string, close: string) => `${open}${inner}${close}`
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

const isBlankEditorHtml = (value: string) => {
  const normalized = value
    .replace(/<!--.*?-->/gs, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<\/?(?:p|div|span|li|ul|ol|blockquote|h1|h2|h3|h4|h5|h6|section|article)\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  return normalized.length === 0;
};

const normalizeTextForCompare = (value: string) =>
  value
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\uFFFC]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trimEnd();

export default function NoteEditorScreen({ subjectId, subjectTitle, note, defaultFolderId, folderOptions, onClose, onSave, onDelete }: NoteEditorScreenProps) {
  const insets = useSafeAreaInsets();
  const editorRef = useRef<EnrichedTextInputInstance>(null);
  const historyRef = useRef<{ entries: NoteSnapshot[]; index: number }>({
    entries: [{ html: note?.contentHtml ?? '', text: note?.contentText ?? '', ts: Date.now() }],
    index: 0,
  });
  const isApplyingHistoryRef = useRef(false);

  const titleRef = useRef(note?.title ?? '');
  const contentHtmlRef = useRef(note?.contentHtml ?? '');
  const contentTextRef = useRef(note?.contentText ?? '');

  const [savedNoteId, setSavedNoteId] = useState<string | null>(() => note?.id ?? null);
  const [title, setTitle] = useState(() => note?.title ?? '');
  const [contentTextUi, setContentTextUi] = useState(() => note?.contentText ?? '');
  const [folderId, setFolderId] = useState<string | null>(() => note?.folderId ?? defaultFolderId ?? null);
  const [isPinned, setIsPinned] = useState(() => note?.isPinned ?? false);
  const isPinnedRef = useRef(isPinned);
  isPinnedRef.current = isPinned;
  const [isBlockMenuOpen, setIsBlockMenuOpen] = useState(false);
  const [isFolderMenuOpen, setIsFolderMenuOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [showBackSaveToast, setShowBackSaveToast] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inlineStyleState, setInlineStyleState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  });

  const [blockStyleState, setBlockStyleState] = useState({
    h1: false,
    h2: false,
    blockQuote: false,
    unorderedList: false,
    orderedList: false,
    checklist: false,
    inlineCode: false,
  });

  const savingInFlightRef = useRef(false);

  const isDirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);

  const hasBodyContentRef = useRef(Boolean((note?.contentText ?? '').trim().length));
  const [hasBodyContent, setHasBodyContent] = useState(hasBodyContentRef.current);

  const uiTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyMaxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyBurstActiveRef = useRef(false);
  const contentDirtySinceHistoryRef = useRef(false);
  const skipUnmountSaveRef = useRef(false);
  const savedOnBackRef = useRef(false);
  const isHydratingRef = useRef(true);
  const hydrationFrameRef = useRef<number | null>(null);
  const isInputFocusedRef = useRef(false);
  const hasUserEditedRef = useRef(false);
  const lastInputAtRef = useRef(0);
  const [historyVersion, setHistoryVersion] = useState(0);

  const pendingInlineStyleRef = useRef(inlineStyleState);
  const inlineStyleFrameRef = useRef<number | null>(null);

  const pendingBlockStyleRef = useRef(blockStyleState);
  const blockStyleFrameRef = useRef<number | null>(null);

  const lastSavedStateRef = useRef({
    title: note?.title ?? '',
    contentHtml: note?.contentHtml ?? '',
    folderId: note?.folderId ?? null,
    isPinned: note?.isPinned ?? false,
  });

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
    hydrationFrameRef.current = requestAnimationFrame(() => {
      isHydratingRef.current = false;
      hydrationFrameRef.current = null;
    });

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (savedOnBackRef.current) {
        skipUnmountSaveRef.current = true;
        onClose();
        return true;
      }

      if (savingInFlightRef.current) {
        skipUnmountSaveRef.current = true;
        onClose();
        return true;
      }

      const hasContent = titleRef.current.trim().length > 0 || contentTextRef.current.trim().length > 0;

      if (isDirtyRef.current && hasContent) {
        savedOnBackRef.current = true;
        void persistNote({ source: 'back' }).then(() => {
          setShowBackSaveToast(true);
        });
        return true;
      }

      skipUnmountSaveRef.current = true;
      onClose();
      return true;
    });

    return () => {
      if (hydrationFrameRef.current != null) {
        cancelAnimationFrame(hydrationFrameRef.current);
        hydrationFrameRef.current = null;
      }

      backSubscription.remove();
      if (uiTextTimerRef.current) {
        clearTimeout(uiTextTimerRef.current);
        uiTextTimerRef.current = null;
      }
      if (historyDebounceTimerRef.current) {
        clearTimeout(historyDebounceTimerRef.current);
        historyDebounceTimerRef.current = null;
      }
      if (historyMaxWaitTimerRef.current) {
        clearTimeout(historyMaxWaitTimerRef.current);
        historyMaxWaitTimerRef.current = null;
      }
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      if (skipUnmountSaveRef.current) {
        skipUnmountSaveRef.current = false;
        return;
      }

      if (!isDirtyRef.current) {
        return;
      }

      void persistNote({ isUnmounting: true, source: 'unmount' });
    };
  }, []);

  const folderLabel = useMemo(() => {
    if (!folderId) {
      return subjectTitle;
    }

    return folderOptions.find((folder) => folder.id === folderId)?.title ?? subjectTitle;
  }, [folderId, folderOptions, subjectTitle]);

  const displayMeta = useMemo(() => {
    const wordCount = countWords(contentTextUi);

    if (note) {
      return { updatedLabel: formatDateLabel(note.updatedAt), wordCount };
    }

    return { updatedLabel: 'New note', wordCount };
  }, [contentTextUi, note]);

  const { canUndo, canRedo } = useMemo(() => {
    const history = historyRef.current;
    return {
      canUndo: history.index > 0 || contentDirtySinceHistoryRef.current,
      canRedo: !contentDirtySinceHistoryRef.current && history.index < history.entries.length - 1,
    };
  }, [historyVersion]);

  const markDirty = () => {
    if (isDirtyRef.current) {
      return;
    }
    isDirtyRef.current = true;
    savedOnBackRef.current = false;
    setIsDirty(true);
  };

  const scheduleUiTextSync = () => {
    if (uiTextTimerRef.current) {
      return;
    }

    uiTextTimerRef.current = setTimeout(() => {
      uiTextTimerRef.current = null;
      setContentTextUi(contentTextRef.current);
    }, UI_TEXT_THROTTLE_MS);
  };

  const pushHistorySnapshot = (html: string, text: string) => {
    if (isApplyingHistoryRef.current) {
      return;
    }

    const history = historyRef.current;

    const currentEntry = history.entries[history.index];
    if (currentEntry && currentEntry.html === html && currentEntry.text === text) {
      return;
    }

    const now = Date.now();

    // If user has undone, drop the redo branch before recording a new snapshot.
    const baseEntries = history.entries.slice(0, history.index + 1);
    baseEntries.push({ html, text, ts: now });

    // Keep history bounded for long notes.
    if (baseEntries.length > HISTORY_MAX_ENTRIES) {
      const sliceStart = baseEntries.length - HISTORY_MAX_ENTRIES;
      const nextEntries = baseEntries.slice(sliceStart);
      historyRef.current = { entries: nextEntries, index: nextEntries.length - 1 };
    } else {
      historyRef.current = { entries: baseEntries, index: baseEntries.length - 1 };
    }

    contentDirtySinceHistoryRef.current = false;
    setHistoryVersion((v) => v + 1);
  };

  const markContentDirtyForHistory = () => {
    if (!contentDirtySinceHistoryRef.current) {
      contentDirtySinceHistoryRef.current = true;
      setHistoryVersion((v) => v + 1);
    }
  };

  const truncateRedoBranchIfNeeded = () => {
    const history = historyRef.current;
    if (history.index < history.entries.length - 1) {
      historyRef.current = {
        entries: history.entries.slice(0, history.index + 1),
        index: history.index,
      };
      setHistoryVersion((v) => v + 1);
    }
  };

  const flushPendingHistorySnapshot = () => {
    if (historyDebounceTimerRef.current) {
      clearTimeout(historyDebounceTimerRef.current);
      historyDebounceTimerRef.current = null;
    }
    if (historyMaxWaitTimerRef.current) {
      clearTimeout(historyMaxWaitTimerRef.current);
      historyMaxWaitTimerRef.current = null;
    }
    historyBurstActiveRef.current = false;

    if (!contentDirtySinceHistoryRef.current) {
      return;
    }

    pushHistorySnapshot(contentHtmlRef.current, contentTextRef.current);
  };

  const scheduleHistorySnapshot = () => {
    if (isApplyingHistoryRef.current) {
      return;
    }

    if (historyDebounceTimerRef.current) {
      clearTimeout(historyDebounceTimerRef.current);
    }

    historyDebounceTimerRef.current = setTimeout(() => {
      historyDebounceTimerRef.current = null;
      if (historyMaxWaitTimerRef.current) {
        clearTimeout(historyMaxWaitTimerRef.current);
        historyMaxWaitTimerRef.current = null;
      }
      historyBurstActiveRef.current = false;
      pushHistorySnapshot(contentHtmlRef.current, contentTextRef.current);
    }, HISTORY_SNAPSHOT_DEBOUNCE_MS);

    if (!historyBurstActiveRef.current) {
      historyBurstActiveRef.current = true;
      historyMaxWaitTimerRef.current = setTimeout(() => {
        historyMaxWaitTimerRef.current = null;
        if (historyDebounceTimerRef.current) {
          clearTimeout(historyDebounceTimerRef.current);
          historyDebounceTimerRef.current = null;
        }
        historyBurstActiveRef.current = false;
        pushHistorySnapshot(contentHtmlRef.current, contentTextRef.current);
      }, HISTORY_SNAPSHOT_MAX_WAIT_MS);
    }
  };

  const scheduleAutosave = () => {
    if (isHydratingRef.current) {
      return;
    }

    if (!isDirtyRef.current) {
      return;
    }

    if (savingInFlightRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistNote({ source: 'autosave' });
    }, AUTOSAVE_IDLE_MS);
  };

  const applyHistorySnapshot = (index: number) => {
    const snapshot = historyRef.current.entries[index];
    if (!snapshot) {
      return;
    }

    isApplyingHistoryRef.current = true;
    historyRef.current = { entries: historyRef.current.entries, index };
    contentHtmlRef.current = snapshot.html;
    contentTextRef.current = snapshot.text;
    contentDirtySinceHistoryRef.current = false;
    const nextHasBody = Boolean(snapshot.text.trim().length);
    if (nextHasBody !== hasBodyContentRef.current) {
      hasBodyContentRef.current = nextHasBody;
      setHasBodyContent(nextHasBody);
    }
    scheduleUiTextSync();
    editorRef.current?.setValue(snapshot.html || snapshot.text);
    markDirty();
    setHistoryVersion((v) => v + 1);

    setTimeout(() => {
      isApplyingHistoryRef.current = false;
    }, 0);
  };

  const requestClose = async () => {
    if (savingInFlightRef.current) {
      return;
    }

    const hasContent = titleRef.current.trim().length > 0 || contentTextRef.current.trim().length > 0;

    if (isDirtyRef.current && hasContent) {
      await persistNote({ source: 'back' });
      skipUnmountSaveRef.current = true;
      onClose({ saved: true });
      return;
    }

    onClose();
  };

  const handleUndo = () => {
    if (!canUndo) {
      return;
    }

    flushPendingHistorySnapshot();
    const nextIndex = historyRef.current.index - 1;
    if (nextIndex < 0) {
      return;
    }
    applyHistorySnapshot(nextIndex);
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

    // Formatting operations can change HTML without changing plain text.
    // Ensure we capture a snapshot + schedule autosave after the native transaction settles.
    hasUserEditedRef.current = true;
    truncateRedoBranchIfNeeded();
    markContentDirtyForHistory();
    markDirty();
    lastInputAtRef.current = Date.now();
    setTimeout(() => {
      scheduleHistorySnapshot();
      scheduleAutosave();
    }, 0);
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
    markDirty();
    scheduleAutosave();
  };

  const togglePinned = () => {
    const next = !isPinned;
    setIsPinned(next);
    isPinnedRef.current = next;
    setIsMoreMenuOpen(false);
    markDirty();
    scheduleAutosave();
  };

  const handleExportNote = async () => {
    setIsMoreMenuOpen(false);

    const titleText = title.trim();
    const bodyText = contentTextRef.current.trim();
    const exportText = [titleText, bodyText].filter(Boolean).join('\n\n');

    if (!exportText) {
      return;
    }

    await Share.share({ message: exportText });
  };

  const handleDeleteNote = () => {
    setIsMoreMenuOpen(false);

    const noteId = savedNoteId;
    if (!noteId) {
      skipUnmountSaveRef.current = true;
      onClose({ deleted: true });
      return;
    }

    setIsDeleteConfirmOpen(true);
  };

  const cancelDelete = () => {
    setIsDeleteConfirmOpen(false);
  };

  const confirmDelete = () => {
    const noteId = savedNoteId;
    if (!noteId) {
      setIsDeleteConfirmOpen(false);
      return;
    }

    setIsDeleteConfirmOpen(false);

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (historyDebounceTimerRef.current) {
      clearTimeout(historyDebounceTimerRef.current);
      historyDebounceTimerRef.current = null;
    }
    if (historyMaxWaitTimerRef.current) {
      clearTimeout(historyMaxWaitTimerRef.current);
      historyMaxWaitTimerRef.current = null;
    }

    skipUnmountSaveRef.current = true;
    isDirtyRef.current = false;
    setIsDirty(false);

    void (async () => {
      await onDelete(noteId);
      onClose({ deleted: true });
    })();
  };

  const persistNote = async ({
    isUnmounting = false,
    source = 'back',
  }: {
    isUnmounting?: boolean;
    source?: 'autosave' | 'unmount' | 'back';
  } = {}) => {
    if (savingInFlightRef.current) {
      return;
    }

    const titleTrim = titleRef.current.trim();
    const textTrim = contentTextRef.current.trim();

    if (!titleTrim && !textTrim) {
      return;
    }

    savingInFlightRef.current = true;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    try {
      const htmlFromNative = await editorRef.current?.getHTML().catch(() => null);
      const rawHtml = typeof htmlFromNative === 'string' ? htmlFromNative : contentHtmlRef.current;
      const contentHtml = applyChecklistStrikethrough(rawHtml.trim() || '<p></p>');

      const draft: NoteEditorDraft = {
        subjectId: note?.subjectId ?? subjectId,
        folderId,
        title: titleTrim,
        contentHtml,
        contentText: textTrim || titleTrim,
        isPinned: isPinnedRef.current,
      };

      const saved = await onSave(savedNoteId, draft);
      if (saved && typeof saved === 'object' && 'id' in saved && typeof saved.id === 'string') {
        setSavedNoteId(saved.id);
        contentHtmlRef.current = rawHtml;
        contentTextRef.current = textTrim || titleTrim;
        lastSavedStateRef.current = {
          title: titleTrim,
          contentHtml: rawHtml,
          folderId,
          isPinned: isPinnedRef.current,
        };

        hasUserEditedRef.current = false;
        contentDirtySinceHistoryRef.current = false;
        setHistoryVersion((v) => v + 1);

        isDirtyRef.current = false;
        setIsDirty(false);
      }
    } finally {
      savingInFlightRef.current = false;
    }
  };

  const handleTitleChange = (value: string) => {
    if (value === titleRef.current) {
      return;
    }

    titleRef.current = value;
    setTitle(value);
    markDirty();
    scheduleAutosave();
  };

  const handleChangeText = (value: string) => {
    if (isHydratingRef.current) {
      contentTextRef.current = value;
      return;
    }

    if (!hasUserEditedRef.current && !isInputFocusedRef.current) {
      contentTextRef.current = value;
      return;
    }

    if (value === contentTextRef.current) {
      return;
    }

    if (normalizeTextForCompare(value) === normalizeTextForCompare(contentTextRef.current)) {
      contentTextRef.current = value;
      return;
    }

    if (!value.trim() && !contentTextRef.current.trim() && isBlankEditorHtml(contentHtmlRef.current)) {
      return;
    }

    hasUserEditedRef.current = true;
    truncateRedoBranchIfNeeded();
    contentTextRef.current = value;
    lastInputAtRef.current = Date.now();

    const nextHasBody = Boolean(value.trim().length);
    if (nextHasBody !== hasBodyContentRef.current) {
      hasBodyContentRef.current = nextHasBody;
      setHasBodyContent(nextHasBody);
    }

    markContentDirtyForHistory();
    markDirty();
    scheduleUiTextSync();
    scheduleHistorySnapshot();
    scheduleAutosave();
  };

  const handleChangeHtml = (value: string) => {
    if (isHydratingRef.current) {
      contentHtmlRef.current = value;
      return;
    }

    if (!hasUserEditedRef.current && !isInputFocusedRef.current) {
      contentHtmlRef.current = value;
      return;
    }

    if (value === contentHtmlRef.current) {
      return;
    }

    if (!hasUserEditedRef.current) {
      contentHtmlRef.current = value;
      return;
    }

    if (!contentTextRef.current.trim() && isBlankEditorHtml(value) && isBlankEditorHtml(contentHtmlRef.current)) {
      contentHtmlRef.current = value;
      return;
    }

    truncateRedoBranchIfNeeded();
    // Keep HTML in a ref only; never set React state on each keystroke.
    contentHtmlRef.current = value;
    lastInputAtRef.current = Date.now();
    markContentDirtyForHistory();
    markDirty();
    scheduleHistorySnapshot();
    scheduleAutosave();
  };

  const handleChangeState = (nativeState: any) => {
    pendingInlineStyleRef.current = {
      bold: Boolean(nativeState.bold?.isActive),
      italic: Boolean(nativeState.italic?.isActive),
      underline: Boolean(nativeState.underline?.isActive),
      strikethrough: Boolean(nativeState.strikeThrough?.isActive),
    };

    pendingBlockStyleRef.current = {
      h1: Boolean(nativeState.h1?.isActive),
      h2: Boolean(nativeState.h2?.isActive),
      blockQuote: Boolean(nativeState.blockQuote?.isActive),
      unorderedList: Boolean(nativeState.unorderedList?.isActive),
      orderedList: Boolean(nativeState.orderedList?.isActive),
      checklist: Boolean(nativeState.checklist?.isActive),
      inlineCode: Boolean(nativeState.inlineCode?.isActive),
    };

    if (inlineStyleFrameRef.current != null) {
      return;
    }

    inlineStyleFrameRef.current = requestAnimationFrame(() => {
      inlineStyleFrameRef.current = null;
      const nextInline = pendingInlineStyleRef.current;
      const nextBlock = pendingBlockStyleRef.current;

      setInlineStyleState((prev) => {
        if (
          prev.bold === nextInline.bold &&
          prev.italic === nextInline.italic &&
          prev.underline === nextInline.underline &&
          prev.strikethrough === nextInline.strikethrough
        ) {
          return prev;
        }
        return nextInline;
      });

      setBlockStyleState((prev) => {
        if (
          prev.h1 === nextBlock.h1 &&
          prev.h2 === nextBlock.h2 &&
          prev.blockQuote === nextBlock.blockQuote &&
          prev.unorderedList === nextBlock.unorderedList &&
          prev.orderedList === nextBlock.orderedList &&
          prev.checklist === nextBlock.checklist &&
          prev.inlineCode === nextBlock.inlineCode
        ) {
          return prev;
        }
        return nextBlock;
      });
    });
  };

  return (
    <View style={styles.rootWrapper}>
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable style={styles.headerIconButton} onPress={() => void requestClose()} hitSlop={8}>
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
            onChangeText={handleTitleChange}
            placeholder="Note title"
            placeholderTextColor="#a7a7a1"
            autoCapitalize="sentences"
            style={styles.titleInput}
            multiline
          />

          <View style={styles.titleDivider} />

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{displayMeta.updatedLabel}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{displayMeta.wordCount} words</Text>
          </View>

          <View style={styles.bodyWrap}>
            <EnrichedTextInput
              ref={editorRef}
              defaultValue={note?.contentHtml ?? ''}
              placeholder="Start writing your note..."
              placeholderTextColor="#10141366"
              autoCapitalize="sentences"
              scrollEnabled={false}
              onFocus={() => {
                isInputFocusedRef.current = true;
              }}
              onBlur={() => {
                isInputFocusedRef.current = false;
              }}
              onKeyPress={() => {
                hasUserEditedRef.current = true;
              }}
              onChangeText={(event) => handleChangeText(event.nativeEvent.value)}
              onChangeHtml={(event) => handleChangeHtml(event.nativeEvent.value)}
              onChangeState={(event) => handleChangeState(event.nativeEvent)}
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
                {BLOCK_ACTIONS.map((item) => {
                  const active = item.key === 'h1' ? blockStyleState.h1
                    : item.key === 'h2' ? blockStyleState.h2
                    : item.key === 'quote' ? blockStyleState.blockQuote
                    : item.key === 'bullets' ? blockStyleState.unorderedList
                    : item.key === 'numbers' ? blockStyleState.orderedList
                    : item.key === 'checklist' ? blockStyleState.checklist
                    : item.key === 'code' ? blockStyleState.inlineCode
                    : false;

                  return (
                    <Pressable
                      key={item.key}
                      style={[styles.blockMenuButton, active && styles.blockMenuButtonActive]}
                      onPress={() => handleBlockAction(item.action)}
                    >
                      <View style={[styles.blockMenuIconWrap, active && styles.blockMenuIconWrapActive]}>
                        {item.key === 'h1' || item.key === 'h2' ? (
                          <Text style={[styles.blockMenuIconText, active && styles.blockMenuIconTextActive]}>{item.key.toUpperCase()}</Text>
                        ) : (
                          <Feather name={item.icon as any} size={17} color={active ? '#ffffff' : '#1f3b34'} />
                        )}
                      </View>
                      <Text style={[styles.blockMenuButtonText, active && styles.blockMenuButtonTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
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
                const active =
                  item.key === 'bold'
                    ? inlineStyleState.bold
                    : item.key === 'italic'
                      ? inlineStyleState.italic
                      : item.key === 'underline'
                        ? inlineStyleState.underline
                        : inlineStyleState.strikethrough;

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
          </View>
        </View>

        {isFolderMenuOpen ? (
          <View style={styles.menuOverlay} pointerEvents="box-none">
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsFolderMenuOpen(false)} />
            <View style={styles.folderMenuSheet}>
              {folderOptions.map((folder) => (
                <FolderRow
                  key={folder.id}
                  label={folder.title}
                  color={folder.color}
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
              <Pressable style={styles.menuActionRow} onPress={togglePinned}>
                <View style={[styles.menuActionIcon, isPinned && styles.menuActionIconActive]}>
                  <MaterialCommunityIcons name={isPinned ? 'bookmark' : 'bookmark-outline'} size={16} color={isPinned ? '#1f5f4d' : '#4d5a54'} />
                </View>
                <Text style={styles.menuActionLabel}>{isPinned ? 'Unpin' : 'Pin'}</Text>
              </Pressable>
              <Pressable style={styles.menuActionRow} onPress={() => void handleExportNote()}>
                <View style={styles.menuActionIcon}>
                  <Feather name="share-2" size={16} color="#4d5a54" />
                </View>
                <Text style={styles.menuActionLabel}>Export</Text>
              </Pressable>
              <Pressable style={styles.menuActionRow} onPress={handleDeleteNote}>
                <View style={styles.menuActionIcon}>
                  <Feather name="trash-2" size={16} color="#b42318" />
                </View>
                <Text style={[styles.menuActionLabel, styles.menuActionLabelDanger]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Modal
          visible={isDeleteConfirmOpen}
          transparent
          animationType="none"
          onRequestClose={cancelDelete}
        >
          <View style={styles.deleteConfirmOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={cancelDelete} />
            <View style={styles.deleteConfirmCard}>
              <Text style={styles.deleteConfirmTitle}>Delete note?</Text>
              <Text style={styles.deleteConfirmBody}>
                This will permanently remove the note from your device.
              </Text>

              <View style={styles.deleteConfirmActions}>
                <Pressable style={styles.deleteConfirmCancelButton} onPress={cancelDelete}>
                  <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.deleteConfirmDeleteButton} onPress={confirmDelete}>
                  <Text style={styles.deleteConfirmDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>

      {showBackSaveToast ? (
        <DynamicIslandToast
          visible={showBackSaveToast}
          message="Note saved"
          onHide={() => setShowBackSaveToast(false)}
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
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable style={[styles.folderMenuRow, active && styles.folderMenuRowActive]} onPress={onPress}>
    <Feather name={active ? 'folder' : 'folder'} size={18} color={active ? '#1f5f4d' : '#8f968f'} />
    <Text style={styles.folderMenuText}>{label}</Text>
    {active ? <Feather name="check" size={16} color="#1f5f4d" /> : null}
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
  titleDivider: {
    height: 1,
    backgroundColor: '#d9d6ce',
    marginTop: 0,
    marginBottom: 10,
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
  blockMenuButtonActive: {
    backgroundColor: '#1c2f2a',
  },
  blockMenuIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockMenuIconWrapActive: {
    backgroundColor: 'transparent',
  },
  blockMenuIconText: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 12,
    color: '#1f3b34',
  },
  blockMenuIconTextActive: {
    color: '#ffffff',
  },
  blockMenuButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#111111',
  },
  blockMenuButtonTextActive: {
    color: '#ffffff',
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
    ...shadowLg,
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
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 26,
    padding: 10,
    ...shadowLg,
  },
  menuActionRow: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f4f1',
  },
  menuActionIconActive: {
    backgroundColor: '#e6f2ed',
  },
  menuActionLabel: {
    flex: 1,
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#111111',
  },
  menuActionLabelDanger: {
    color: '#b42318',
  },
  deleteConfirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 18, 20, 0.28)',
    paddingHorizontal: 18,
  },
  deleteConfirmCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    ...shadowLg,
  },
  deleteConfirmTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 20,
    color: '#111111',
    letterSpacing: -0.4,
  },
  deleteConfirmBody: {
    marginTop: 8,
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#5f6661',
  },
  deleteConfirmActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  deleteConfirmCancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2ee',
  },
  deleteConfirmCancelText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#1f2b25',
  },
  deleteConfirmDeleteButton: {
    flex: 1,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b42318',
  },
  deleteConfirmDeleteText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#ffffff',
  },
});