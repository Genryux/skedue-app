import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Platform,
  TextInput,
  Dimensions,
  Keyboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { insertTask, type TaskRecord } from '../../data/local/db';
import { shadowLg } from '../../ui/tokens/shadows';
import { springModalSlide, useDragToClose } from '../../ui/tokens/animations';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type CreateTaskModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (task: TaskRecord) => void;
  onError?: (message: string) => void;
};

export default function CreateTaskModal({ visible, onClose, onCreated, onError }: CreateTaskModalProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const subSlideAnim = useRef(new Animated.Value(0)).current;
  const subOpacityAnim = useRef(new Animated.Value(0)).current;

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [showReminder, setShowReminder] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDueDate(null);
      setReminderMinutes(null);
      setShowReminder(false);
      setKeyboardHeight(0);
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
        setShowReminder(false);
        setShowDatePicker(false);
        setShowTimePicker(false);
        onClose();
      }
    });
  }, [opacityAnim, slideAnim, onClose]);

  const snapMainOpen = useCallback(() => {
    Animated.spring(slideAnim, { toValue: 1, ...springModalSlide }).start();
  }, [slideAnim]);

  const closeMainViaDrag = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowReminder(false);
        setShowDatePicker(false);
        setShowTimePicker(false);
        onClose();
      }
    });
  }, [opacityAnim, slideAnim, onClose]);

  const { panResponder: mainPanResponder, scrollYRef: mainScrollYRef } = useDragToClose(slideAnim, snapMainOpen, closeMainViaDrag);

  const openReminder = () => {
    setShowReminder(true);
    setShowDatePicker(false);
    setShowTimePicker(false);
    subSlideAnim.setValue(0);
    subOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(subOpacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(subSlideAnim, { toValue: 1, ...springModalSlide }),
    ]).start();
  };

  const closeReminder = useCallback(() => {
    Animated.parallel([
      Animated.timing(subOpacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(subSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowReminder(false);
        setShowDatePicker(false);
        setShowTimePicker(false);
      }
    });
  }, [subOpacityAnim, subSlideAnim]);

  const snapSubOpen = useCallback(() => {
    Animated.spring(subSlideAnim, { toValue: 1, ...springModalSlide }).start();
  }, [subSlideAnim]);

  const { panResponder: subPanResponder, scrollYRef: subScrollYRef } = useDragToClose(subSlideAnim, snapSubOpen, closeReminder);

  const handleCreate = async () => {
    const name = title.trim();
    if (!name) return;

    try {
      const now = Date.now();
      const task = await insertTask({
        subjectId: '',
        title: name,
        description: null,
        dueAt: dueDate?.getTime() ?? null,
        reminderMinutes,
        repeatType: 'none',
        repeatInterval: null,
        repeatDays: null,
        startDate: dueDate?.getTime() ?? null,
        endDate: null,
        nextOccurrenceDate: dueDate?.getTime() ?? now,
        priority: null,
        category: null,
      });

      onCreated(task);
      close();
    } catch (error) {
      console.warn('Failed to create task', error);
      onError?.('Failed to create task');
    }
  };

  const formattedDate = dueDate
    ? dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const formattedTime = dueDate
    ? dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  const reminderSuffix = reminderMinutes === null ? null
    : reminderMinutes === 0 ? 'At due time'
    : reminderMinutes === 5 ? '5 mins before'
    : reminderMinutes === 15 ? '15 mins before'
    : reminderMinutes === 30 ? '30 mins before'
    : reminderMinutes === 60 ? '1 hour before'
    : reminderMinutes === 1440 ? '1 day before'
    : null;

  const reminderDisplayText = reminderMinutes === null
    ? 'Set reminder'
    : formattedDate && formattedTime
      ? `${formattedDate} - ${formattedTime} (${reminderSuffix})`
      : reminderSuffix!;

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
        <View style={styles.panel} {...mainPanResponder.panHandlers}>
          <View style={styles.handle} />
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
            contentContainerStyle={{ paddingBottom: 8 }}
            onScroll={(e) => { mainScrollYRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
            <Text style={styles.panelTitle}>Add Task</Text>

            <View style={styles.card}>
              <View style={styles.titleInputRow}>
                <Feather name="check-square" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Task name"
                  placeholderTextColor="#91948f"
                  style={styles.titleInput}
                  autoFocus
                />
              </View>
            </View>

            <Pressable style={styles.reminderButton} onPress={openReminder}>
              <Feather name="bell" size={16} color="#8f968f" style={{ marginRight: 10 }} />
              <Text
                style={[styles.reminderButtonText, reminderMinutes !== null && { color: '#1e2b26' }]}
                numberOfLines={1}
              >
                {reminderDisplayText}
              </Text>
            </Pressable>

            <View style={styles.editInfoActions}>
              <Pressable onPress={close}>
                <Text style={styles.editInfoCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editInfoSaveButton, !title.trim() && styles.editInfoSaveButtonDisabled]}
                onPress={() => void handleCreate()}
                disabled={!title.trim()}
              >
                <Text style={styles.editInfoSaveText}>Create</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      {showReminder ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 210 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: subOpacityAnim }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeReminder} />
          <Animated.View
            pointerEvents="box-none"
            style={[styles.subPanelWrapper, {
              transform: [{
                translateY: subSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [SCREEN_HEIGHT, 0],
                }),
              }],
            }]}
          >
            <View style={styles.subPanel} {...subPanResponder.panHandlers}>
              <View style={styles.handle} />
              <ScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ paddingBottom: 8 }}
                onScroll={(e) => { subScrollYRef.current = e.nativeEvent.contentOffset.y; }}
                scrollEventThrottle={16}
              >
                <Text style={styles.subModalTitle}>Set Reminder</Text>

                <View style={[styles.card, { marginBottom: 16 }]}>
                  <View style={styles.dateTimeRow}>
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                      onPress={() => {
                        if (!dueDate) setDueDate(new Date());
                        setShowDatePicker(true);
                      }}
                    >
                      <Feather name="calendar" size={16} color="#8f968f" style={{ marginRight: 8 }} />
                      <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 16, color: dueDate ? '#1e2b26' : '#b7bcb7' }}>
                        {formattedDate ?? 'Set date'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => {
                        if (!dueDate) setDueDate(new Date());
                        setShowTimePicker(true);
                      }}
                    >
                      <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 16, color: dueDate ? '#1e2b26' : '#b7bcb7', marginRight: 4 }}>
                        {formattedTime ?? 'Set time'}
                      </Text>
                      <Feather name="clock" size={16} color="#8f968f" />
                    </Pressable>
                  </View>
                </View>

                {showDatePicker && dueDate ? (
                  <DateTimePicker
                    value={dueDate}
                    mode="date"
                    onChange={(event: DateTimePickerEvent, selected) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (!selected) return;
                      const next = new Date(dueDate);
                      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                      setDueDate(next);
                    }}
                  />
                ) : null}
                {showTimePicker && dueDate ? (
                  <DateTimePicker
                    value={dueDate}
                    mode="time"
                    is24Hour={false}
                    onChange={(event: DateTimePickerEvent, selected) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (!selected) return;
                      const next = new Date(dueDate);
                      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                      setDueDate(next);
                    }}
                  />
                ) : null}

                <View style={styles.card}>
                  {([
                    { mins: null, label: 'None' },
                    { mins: 0, label: 'At due time' },
                    { mins: 5, label: '5 mins before' },
                    { mins: 15, label: '15 mins before' },
                    { mins: 30, label: '30 mins before' },
                    { mins: 60, label: '1 hour before' },
                    { mins: 1440, label: '1 day before' },
                  ] as const).map((opt, i) => {
                    const selected = reminderMinutes === opt.mins;
                    const disabled = opt.mins !== null && !dueDate;
                    return (
                      <View key={String(opt.mins)}>
                        {i > 0 && <View style={styles.separator} />}
                        <Pressable
                          style={[styles.compactRow, selected && { backgroundColor: '#eef2ec' }]}
                          onPress={disabled ? undefined : () => { setReminderMinutes(opt.mins); closeReminder(); }}
                        >
                          <Text style={[styles.compactRowText, selected && { fontFamily: 'Manrope_700Bold' }, disabled && { color: '#c9cdc9' }]}>{opt.label}</Text>
                          {selected && <Feather name="check" size={20} color="#0f2a24" />}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
                {!dueDate && (
                  <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: '#8f968f', textAlign: 'center', marginTop: 10 }}>Set a date and time to enable reminders</Text>
                )}

                <Pressable style={styles.subModalBackRow} onPress={closeReminder}>
                  <Text style={styles.subModalBackText}>Back</Text>
                </Pressable>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
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
  titleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 58,
  },
  titleInput: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
    paddingVertical: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0ed',
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    minHeight: 52,
    marginTop: 16,
    ...shadowLg,
  },
  reminderButtonText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#b7bcb7',
    flex: 1,
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
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
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
    maxHeight: SCREEN_HEIGHT * 0.7,
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
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 48,
  },
  compactRowText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
    flex: 1,
  },
  subModalBackRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  subModalBackText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#0f2a24',
  },
});
