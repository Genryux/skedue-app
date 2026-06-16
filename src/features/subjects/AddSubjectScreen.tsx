import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { getSubjects, type SubjectRecord } from '../../data/local/db';
import { findTimeConflicts } from './conflictUtils';
import { shadowLg } from '../../ui/tokens/shadows';
import { springModalSlide, useDragToClose } from '../../ui/tokens/animations';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type AddSubjectScreenProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (subjectData: {
    title: string;
    code?: string;
    instructor?: string;
    term?: string;
    days: string[];
    startTime: string;
    endTime: string;
    location?: string;
  }) => void;
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
const DEFAULT_SELECTED_DAYS = new Set(['Mo', 'We', 'Fr']);

export default function AddSubjectScreen({ visible, onClose, onSave }: AddSubjectScreenProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const termPickerSlideAnim = useRef(new Animated.Value(0)).current;
  const termPickerOpacityAnim = useRef(new Animated.Value(0)).current;

  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [term, setTerm] = useState('');
  const [showTermPicker, setShowTermPicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set(DEFAULT_SELECTED_DAYS));

  const [existingSubjects, setExistingSubjects] = useState<SubjectRecord[]>([]);

  const [startDate, setStartDate] = useState(new Date(2026, 0, 1, 9, 0));
  const [endDate, setEndDate] = useState(new Date(2026, 0, 1, 10, 30));

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [location, setLocation] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const formatTime = (date: Date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${strMinutes} ${ampm}`;
  };

  const isSaveDisabled = useMemo(() => title.trim().length === 0, [title]);

  useEffect(() => {
    getSubjects().then((subjects) => setExistingSubjects(subjects.filter((s) => !s.isArchived))).catch(console.warn);
  }, []);

  const conflicts = useMemo(() => {
    return findTimeConflicts(
      {
        days: Array.from(selectedDays),
        startTime: formatTime(startDate),
        endTime: formatTime(endDate),
      },
      existingSubjects
    );
  }, [selectedDays, startDate, endDate, existingSubjects]);

  const hasConflict = conflicts.length > 0;

  const panelMaxHeight = keyboardHeight > 0
    ? SCREEN_HEIGHT - keyboardHeight - 16 - 20
    : SCREEN_HEIGHT * 0.9;

  const openTermPicker = () => {
    setShowTermPicker(true);
    termPickerSlideAnim.setValue(0);
    termPickerOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(termPickerOpacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(termPickerSlideAnim, { toValue: 1, ...springModalSlide }),
    ]).start();
  };

  useEffect(() => {
    if (visible) {
      setCode('');
      setTitle('');
      setInstructor('');
      setTerm('');
      setSelectedDays(new Set(DEFAULT_SELECTED_DAYS));
      setStartDate(new Date(2026, 0, 1, 9, 0));
      setEndDate(new Date(2026, 0, 1, 10, 30));
      setLocation('');
      setShowTermPicker(false);
      setShowStartPicker(false);
      setShowEndPicker(false);
      termPickerSlideAnim.setValue(0);
      termPickerOpacityAnim.setValue(0);
      slideAnim.setValue(0);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 1, ...springModalSlide }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  }, [opacityAnim, slideAnim, onClose]);

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

  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showTermPicker) {
        closeTermPicker();
        return true;
      }
      close();
      return true;
    });
    return () => handler.remove();
  }, [visible, showTermPicker, close, closeTermPicker]);

  const snapOpen = useCallback(() => {
    Animated.spring(slideAnim, { toValue: 1, ...springModalSlide }).start();
  }, [slideAnim]);

  const closeViaDrag = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  }, [opacityAnim, slideAnim, onClose]);

  const { panResponder, scrollYRef } = useDragToClose(slideAnim, snapOpen, closeViaDrag);

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

  const handleToggleDay = (day: string) => {
    setSelectedDays((prev) => {
      const updated = new Set(prev);
      if (updated.has(day)) {
        updated.delete(day);
      } else {
        updated.add(day);
      }
      return updated;
    });
  };

  const onStartTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const onEndTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  const handleSave = () => {
    onSave({
      title: title.trim(),
      code: code.trim() || undefined,
      instructor: instructor.trim() || undefined,
      term: term || undefined,
      days: Array.from(selectedDays),
      startTime: formatTime(startDate),
      endTime: formatTime(endDate),
      location: location.trim() || undefined,
    });
  };

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
      </Animated.View>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />

      <Animated.View
        pointerEvents="box-none"
        style={[styles.panelWrapper, {
          bottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [SCREEN_HEIGHT, 0],
            }),
          }],
        }]}
      >
        <View style={[styles.panel, { maxHeight: panelMaxHeight }]} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: 8 }}
            onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
            <Text style={styles.panelTitle}>New Subject</Text>

            <View style={styles.card}>
              <View style={styles.row}>
                <Feather name="hash" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="Subject Code (e.g., CS101)"
                  placeholderTextColor="#91948f"
                  style={styles.input}
                />
              </View>
              <View style={styles.separator} />
              <View style={styles.row}>
                <Feather name="book-open" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Subject Title"
                  placeholderTextColor="#91948f"
                  style={styles.input}
                />
              </View>
              <View style={styles.separator} />
              <View style={styles.row}>
                <Feather name="user" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <TextInput
                  value={instructor}
                  onChangeText={setInstructor}
                  placeholder="Instructor (Optional)"
                  placeholderTextColor="#91948f"
                  style={styles.input}
                />
              </View>
              <View style={styles.separator} />
              <Pressable style={styles.row} onPress={openTermPicker}>
                <Feather name="calendar" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <Text style={[styles.input, !term && { color: '#91948f' }]}>
                  {term || 'Academic Period'}
                </Text>
                <Feather name="chevron-right" size={18} color="#9aa09a" />
              </Pressable>
            </View>

            <View style={[styles.card, { marginTop: 16 }]}>
              <View style={styles.daysContainer}>
                <Text style={styles.rowLabel}>Days</Text>
                <View style={styles.daysRow}>
                  {DAYS.map((day) => {
                    const isSelected = selectedDays.has(day.value);
                    return (
                      <Pressable
                        key={day.value}
                        onPress={() => handleToggleDay(day.value)}
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
              <View style={styles.separator} />
              <View style={styles.row}>
                <Feather name="clock" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <Text style={styles.input}>Schedule</Text>
                <Pressable style={styles.chip} onPress={() => setShowStartPicker(true)}>
                  <Text style={styles.chipText}>{formatTime(startDate)}</Text>
                </Pressable>
                <Text style={styles.chipSeparator}>-</Text>
                <Pressable style={styles.chip} onPress={() => setShowEndPicker(true)}>
                  <Text style={styles.chipText}>{formatTime(endDate)}</Text>
                </Pressable>
              </View>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onStartTimeChange}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="time"
                is24Hour={false}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onEndTimeChange}
              />
            )}

            <View style={[styles.card, { marginTop: 16 }]}>
              <View style={styles.row}>
                <Feather name="map-pin" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <TextInput
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Room, Building, or Online"
                  placeholderTextColor="#91948f"
                  style={styles.input}
                />
              </View>
            </View>

            {hasConflict && (
              <View style={styles.conflictWarning}>
                <Feather name="alert-triangle" size={20} color="#991b1b" />
                <Text style={styles.conflictWarningBody}>
                  Conflicts with{' '}
                  <Text style={styles.conflictSubjectName}>
                    {conflicts[0].subject.title}
                  </Text>
                  {conflicts[0].subjectStartTime && conflicts[0].subjectEndTime
                    ? ` (${conflicts[0].subjectStartTime} - ${conflicts[0].subjectEndTime})`
                    : ''}
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <Pressable onPress={close}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, isSaveDisabled && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaveDisabled}
              >
                <Text style={styles.saveText}>Save Subject</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Animated.View>

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
            <View style={styles.subPanel} {...termPickerPanResponder.panHandlers}>
              <View style={styles.handle} />
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ paddingBottom: 8 }}
                onScroll={(e) => { termPickerScrollYRef.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                <Text style={styles.subModalTitle}>Academic Period</Text>
                <View style={styles.card}>
                  {[
                    '1st Semester',
                    '2nd Semester',
                    'Summer / Midyear',
                    '1st Quarter',
                    '2nd Quarter',
                    '3rd Quarter',
                    '4th Quarter'
                  ].map((option, index) => (
                    <View key={option}>
                      {index > 0 && <View style={styles.separator} />}
                      <Pressable
                        style={[styles.row, term === option && { backgroundColor: '#eef2ec' }]}
                        onPress={() => {
                          setTerm(option);
                          closeTermPicker();
                        }}
                      >
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Feather name="calendar" size={16} color="#5c6762" />
                          <Text style={[styles.subModalOptionText, term === option && { fontFamily: 'Manrope_700Bold' }]}>{option}</Text>
                        </View>
                        {term === option && <Feather name="check" size={20} color="#0f2a24" />}
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable style={styles.subModalBackRow} onPress={closeTermPicker}>
                  <Text style={styles.subModalBackText}>Back</Text>
                </Pressable>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  panel: {
    backgroundColor: '#f8f7f2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: SCREEN_HEIGHT * 0.9,
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
  panelTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
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
  rowLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#1e2b26',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0ed',
  },
  input: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
    paddingVertical: 14,
  },
  daysContainer: {
    padding: 16,
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
  chip: {
    backgroundColor: '#f0eee9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#0f2a24',
  },
  chipSeparator: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#9aa09a',
    marginHorizontal: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  cancelText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#9aa09a',
    paddingHorizontal: 8,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#0f2a24',
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLg,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: '#ffffff',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
  },
  conflictWarning: {
    marginTop: 24,
    marginHorizontal: 4,
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
  subModalTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#101413',
    letterSpacing: -0.3,
    marginBottom: 16,
    textAlign: 'center',
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
