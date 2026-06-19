import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  BackHandler,
  Dimensions,
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
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../ui/theme/ThemeContext';
import { shadowLg } from '../../ui/tokens/shadows';
import { springModalSlide, useDragToClose } from '../../ui/tokens/animations';
import { insertSubjects } from '../../data/local/db';
import DynamicIslandToast from '../../ui/DynamicIslandToast';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const TERM_OPTIONS = [
  '1st Semester',
  '2nd Semester',
  'Summer / Midyear',
  '1st Quarter',
  '2nd Quarter',
  '3rd Quarter',
  '4th Quarter',
];

type SubjectEntry = {
  code: string;
  title: string;
  instructor: string;
};

export default function BulkAddSubjectsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const entryPositions = useRef<Record<number, number>>({});
  const keyboardHeightRef = useRef(0);

  const scrollToEntry = (index: number) => {
    const y = entryPositions.current[index];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 60), animated: true });
  };

  const termPickerSlideAnim = useRef(new Animated.Value(0)).current;
  const termPickerOpacityAnim = useRef(new Animated.Value(0)).current;

  const [entries, setEntries] = useState<SubjectEntry[]>([
    { code: '', title: '', instructor: '' },
  ]);
  const [term, setTerm] = useState('');
  const [showTermPicker, setShowTermPicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardHeightRef.current = e.endCoordinates.height;
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const openTermPicker = () => {
    setShowTermPicker(true);
    termPickerSlideAnim.setValue(0);
    termPickerOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(termPickerOpacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(termPickerSlideAnim, { toValue: 1, ...springModalSlide }),
    ]).start();
  };

  const closeTermPicker = useCallback(() => {
    Animated.parallel([
      Animated.timing(termPickerOpacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(termPickerSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowTermPicker(false);
      }
    });
  }, [termPickerOpacityAnim, termPickerSlideAnim]);

  const snapTermPickerOpen = useCallback(() => {
    Animated.spring(termPickerSlideAnim, { toValue: 1, ...springModalSlide }).start();
  }, [termPickerSlideAnim]);

  const closeTermPickerViaDrag = useCallback(() => {
    Animated.parallel([
      Animated.timing(termPickerOpacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(termPickerSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowTermPicker(false);
      }
    });
  }, [termPickerOpacityAnim, termPickerSlideAnim]);

  const { panResponder: termPickerPanResponder, scrollYRef: termPickerScrollYRef } = useDragToClose(
    termPickerSlideAnim,
    snapTermPickerOpen,
    closeTermPickerViaDrag
  );

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showTermPicker) {
        closeTermPicker();
        return true;
      }
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [showTermPicker, closeTermPicker, router]);

  const updateEntry = (index: number, field: keyof SubjectEntry, value: string) => {
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addEntry = () => {
    setEntries((prev) => [...prev, { code: '', title: '', instructor: '' }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
    delete entryPositions.current[index];
  };

  const validEntries = useMemo(() => entries.filter((e) => e.title.trim().length > 0), [entries]);
  const saveDisabled = validEntries.length === 0 || isSaving;

  const handleSave = async () => {
    if (validEntries.length === 0) {
      Alert.alert('No subjects', 'Please enter at least one subject title.');
      return;
    }

    setIsSaving(true);
    try {
      await insertSubjects(
        validEntries.map((e) => ({
          title: e.title.trim(),
          code: e.code.trim() || undefined,
          instructor: e.instructor.trim() || undefined,
          term: term || undefined,
          isArchived: false,
          isPinned: false,
        }))
      );
      setToastMessage(
        validEntries.length === 1
          ? `${validEntries[0].title} created successfully`
          : `${validEntries.length} subjects created successfully`
      );
      setToastVisible(true);
      setTimeout(() => router.back(), 1200);
    } catch (error) {
      console.warn('Failed to save subjects', error);
      Alert.alert('Error', 'Failed to save subjects. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark, { paddingTop: insets.top + 8 }]}>
        <Pressable style={[styles.backButton, isDark && styles.backButtonDark]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={isDark ? '#d7e4dd' : '#1e2b26'} />
        </Pressable>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>Bulk Add Subjects</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: keyboardHeight + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
      >
        <Text style={[styles.description, isDark && styles.descriptionDark]}>
          Add multiple subjects then configure their schedules later.
        </Text>

        <Pressable style={[styles.termCard, isDark && styles.termCardDark]} onPress={openTermPicker}>
          <Feather name="calendar" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
          <Text style={[styles.termText, !term && styles.termPlaceholder, isDark && styles.termTextDark]}>
            {term || 'Academic Period (Optional)'}
          </Text>
          <Feather name="chevron-right" size={18} color={isDark ? '#6e7b74' : '#9aa09a'} />
        </Pressable>

        {entries.map((entry, index) => (
          <View
            key={index}
            onLayout={(e) => { entryPositions.current[index] = e.nativeEvent.layout.y; }}
            style={[styles.entryCard, isDark && styles.entryCardDark]}
          >
            <View style={styles.entryHeader}>
              <Text style={[styles.entryLabel, isDark && styles.entryLabelDark]}>Subject {index + 1}</Text>
              {entries.length > 1 && (
                <Pressable onPress={() => removeEntry(index)} hitSlop={8}>
                  <Feather name="x" size={16} color={isDark ? '#e85555' : '#991b1b'} />
                </Pressable>
              )}
            </View>
            <View style={styles.inputRow}>
              <Feather name="hash" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
              <TextInput
                value={entry.code}
                onChangeText={(v) => updateEntry(index, 'code', v)}
                onFocus={() => scrollToEntry(index)}
                placeholder="Subject Code (e.g., CS101)"
                placeholderTextColor={isDark ? '#5a6b63' : '#91948f'}
                style={[styles.input, isDark && styles.inputDark]}
              />
            </View>
            <View style={[styles.separator, isDark && styles.separatorDark]} />
            <View style={styles.inputRow}>
              <Feather name="book-open" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
              <TextInput
                value={entry.title}
                onChangeText={(v) => updateEntry(index, 'title', v)}
                onFocus={() => scrollToEntry(index)}
                placeholder="Subject Title *"
                placeholderTextColor={isDark ? '#5a6b63' : '#91948f'}
                style={[styles.input, isDark && styles.inputDark]}
              />
            </View>
            <View style={[styles.separator, isDark && styles.separatorDark]} />
            <View style={styles.inputRow}>
              <Feather name="user" size={16} color={isDark ? '#6e7b74' : '#8f968f'} style={{ marginRight: 10 }} />
              <TextInput
                value={entry.instructor}
                onChangeText={(v) => updateEntry(index, 'instructor', v)}
                onFocus={() => scrollToEntry(index)}
                placeholder="Instructor (Optional)"
                placeholderTextColor={isDark ? '#5a6b63' : '#91948f'}
                style={[styles.input, isDark && styles.inputDark]}
              />
            </View>
          </View>
        ))}

        <Pressable style={[styles.addButton, isDark && styles.addButtonDark]} onPress={addEntry}>
          <Feather name="plus" size={16} color={isDark ? '#5da88b' : '#0f2a24'} />
          <Text style={[styles.addButtonText, isDark && styles.addButtonTextDark]}>Add another subject</Text>
        </Pressable>

        <Pressable
          style={[styles.saveButton, saveDisabled && styles.saveButtonDisabled, isDark && styles.saveButtonDark]}
          onPress={handleSave}
          disabled={saveDisabled}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : `Save ${validEntries.length} ${validEntries.length === 1 ? 'Subject' : 'Subjects'}`}
          </Text>
        </Pressable>
      </ScrollView>

      {showTermPicker && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 210 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: termPickerOpacityAnim }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeTermPicker} />
          <Animated.View
            pointerEvents="box-none"
            style={[styles.subPanelWrapper, {
              transform: [{
                translateY: termPickerSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SCREEN_HEIGHT, 0],
                }),
              }],
            }]}
          >
            <View style={[styles.subPanel, isDark && { backgroundColor: '#0a1613' }]} {...termPickerPanResponder.panHandlers}>
              <View style={[styles.handle, isDark && { backgroundColor: '#2a3d36' }]} />
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ paddingBottom: 8 }}
                onScroll={(e) => { termPickerScrollYRef.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                <Text style={[styles.subModalTitle, isDark && { color: '#d7e4dd' }]}>Academic Period</Text>
                <View style={[styles.card, isDark && { backgroundColor: '#0f201b' }]}>
                  {TERM_OPTIONS.map((option, index) => (
                    <View key={option}>
                      {index > 0 && <View style={[styles.separator, isDark && { backgroundColor: '#2a3d36' }]} />}
                      <Pressable
                        style={[styles.row, term === option && { backgroundColor: isDark ? '#1a2b25' : '#eef2ec' }]}
                        onPress={() => {
                          setTerm(option);
                          closeTermPicker();
                        }}
                      >
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Feather name="calendar" size={16} color={isDark ? '#6e7b74' : '#5c6762'} />
                          <Text style={[styles.subModalOptionText, term === option && { fontFamily: 'Manrope_700Bold' }, isDark && { color: '#d7e4dd' }]}>{option}</Text>
                        </View>
                        {term === option && <Feather name="check" size={20} color={isDark ? '#5da88b' : '#0f2a24'} />}
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.subModalBackRow} onPress={closeTermPicker}>
                  <Text style={[styles.subModalBackText, isDark && { color: '#6e7b74' }]}>Back</Text>
                </Pressable>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      )}

      <DynamicIslandToast
        visible={toastVisible}
        message={toastMessage}
        onHide={() => setToastVisible(false)}
        duration={3000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f7f2',
  },
  containerDark: {
    backgroundColor: '#0a1613',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#f8f7f2',
  },
  headerDark: {
    backgroundColor: '#0a1613',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fcfbfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f2f1ee',
  },
  backButtonDark: {
    backgroundColor: '#0f201b',
    borderColor: '#2a3d36',
  },
  headerTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
  },
  headerTitleDark: {
    color: '#d7e4dd',
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  bodyContent: {
    paddingTop: 8,
  },
  description: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#6b746f',
    marginBottom: 20,
    lineHeight: 20,
  },
  descriptionDark: {
    color: '#8f9b95',
  },
  termCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 16,
    ...shadowLg,
  },
  termCardDark: {
    backgroundColor: '#0f201b',
  },
  termText: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
  },
  termTextDark: {
    color: '#d7e4dd',
  },
  termPlaceholder: {
    color: '#91948f',
  },
  entryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...shadowLg,
  },
  entryCardDark: {
    backgroundColor: '#0f201b',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  entryLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#9aa09a',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  entryLabelDark: {
    color: '#5a6b63',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  input: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
    paddingVertical: 14,
  },
  inputDark: {
    color: '#d7e4dd',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0ed',
  },
  separatorDark: {
    backgroundColor: '#2a3d36',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    marginBottom: 24,
  },
  addButtonDark: {},
  addButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#0f2a24',
  },
  addButtonTextDark: {
    color: '#5da88b',
  },
  saveButton: {
    backgroundColor: '#0f2a24',
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLg,
  },
  saveButtonDark: {
    backgroundColor: '#1e5548',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
  },
  subPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  subPanel: {
    backgroundColor: '#f8f7f2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    ...shadowLg,
  },
  handle: {
    width: 68,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e3e0d8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  subModalTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#101413',
    letterSpacing: -0.3,
    marginBottom: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadowLg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  subModalOptionText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: '#2a332e',
  },
  subModalBackRow: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 2,
  },
  subModalBackText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#66706b',
  },
});
