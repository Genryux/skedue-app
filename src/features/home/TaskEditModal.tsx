import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  BackHandler,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { updateTask, type TaskRecord, type SubjectRecord } from '../../data/local/db';
import { shadowLg } from '../../ui/tokens/shadows';
import { springModalSlide, useDragToClose } from '../../ui/tokens/animations';

const SCREEN_HEIGHT = Dimensions.get('window').height;

const DAYS = [
  { label: 'Su', value: 'Su' },
  { label: 'Mo', value: 'Mo' },
  { label: 'Tu', value: 'Tu' },
  { label: 'We', value: 'We' },
  { label: 'Th', value: 'Th' },
  { label: 'Fr', value: 'Fr' },
  { label: 'Sa', value: 'Sa' },
] as const;

type TaskEditModalProps = {
  visible: boolean;
  task: TaskRecord | null;
  subjectOptions?: Array<{ id: string; title: string; code: string }>;
  onClose: () => void;
  onSaved: (task: TaskRecord) => void;
  onError?: (message: string) => void;
};

type SubView = 'priority' | 'category' | 'reminder' | 'repeat' | 'repeatWeekly' | 'subject' | null;

export default function TaskEditModal({ visible, task, subjectOptions, onClose, onSaved, onError }: TaskEditModalProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const subSlideAnim = useRef(new Animated.Value(0)).current;
  const subOpacityAnim = useRef(new Animated.Value(0)).current;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'>('none');
  const [repeatDays, setRepeatDays] = useState<string[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  const [subView, setSubView] = useState<SubView>(null);
  const [repeatSubStep, setRepeatSubStep] = useState<'main' | 'weeklyDays' | 'dailySkip'>('main');
  const [skipWeekends, setSkipWeekends] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const panelMaxHeight = keyboardHeight > 0
    ? SCREEN_HEIGHT - keyboardHeight - 16 - 20
    : SCREEN_HEIGHT * 0.9;

  useEffect(() => {
    if (visible && task) {
      setTitle(task.title ?? '');
      setDescription(task.description ?? '');
      setDueDate(task.startDate ? new Date(task.startDate) : null);
      setRepeatType(task.repeatType as any);
      setRepeatDays(task.repeatDays ?? []);
      setReminderMinutes(task.reminderMinutes ?? null);
      setPriority(task.priority ?? null);
      setCategory(task.category ?? null);
      setSelectedSubjectId(task.subjectId);
      setSkipWeekends(false);
      slideAnim.setValue(0);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 1, ...springModalSlide }),
      ]).start();
    }
  }, [visible, task]);

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
        setSubView(null);
        setRepeatSubStep('main');
        setShowDatePicker(false);
        setShowTimePicker(false);
        onClose();
      }
    });
  }, [opacityAnim, slideAnim, onClose]);

  const openSubView = (view: SubView) => {
    setSubView(view);
    setRepeatSubStep('main');
    subSlideAnim.setValue(0);
    subOpacityAnim.setValue(0);
    Animated.parallel([
      Animated.timing(subOpacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(subSlideAnim, { toValue: 1, ...springModalSlide }),
    ]).start();
  };

  const closeSubView = useCallback(() => {
    Animated.parallel([
      Animated.timing(subOpacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(subSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setSubView(null);
        setRepeatSubStep('main');
      }
    });
  }, [subOpacityAnim, subSlideAnim]);

  useEffect(() => {
    if (!visible) return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (subView) {
        closeSubView();
        return true;
      }
      close();
      return true;
    });
    return () => handler.remove();
  }, [visible, subView, close, closeSubView]);

  const snapMainOpen = useCallback(() => {
    Animated.spring(slideAnim, { toValue: 1, ...springModalSlide }).start();
  }, [slideAnim]);

  const closeMainViaDrag = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setSubView(null);
        setRepeatSubStep('main');
        setShowDatePicker(false);
        setShowTimePicker(false);
        onClose();
      }
    });
  }, [opacityAnim, slideAnim, onClose]);

  const { panResponder: mainPanResponder, scrollYRef: mainScrollYRef } = useDragToClose(slideAnim, snapMainOpen, closeMainViaDrag);

  const snapSubOpen = useCallback(() => {
    Animated.spring(subSlideAnim, { toValue: 1, ...springModalSlide }).start();
  }, [subSlideAnim]);

  const { panResponder: subPanResponder, scrollYRef: subScrollYRef } = useDragToClose(subSlideAnim, snapSubOpen, closeSubView);

  const handleSave = async () => {
    const name = title.trim();
    if (!name || !task?.id) return;

    try {
      const effectiveRepeatDays =
        repeatType === 'daily' && skipWeekends
          ? ['mo', 'tu', 'we', 'th', 'fr']
          : repeatType === 'weekly' && repeatDays.length > 0
            ? repeatDays
            : null;

      await updateTask(task.id, {
        subjectId: selectedSubjectId !== task.subjectId ? selectedSubjectId : undefined,
        title: name,
        description: description.trim() || undefined,
        startDate: dueDate?.getTime(),
        dueAt: dueDate?.getTime(),
        repeatType,
        repeatInterval: task.repeatInterval ?? 1,
        repeatDays: effectiveRepeatDays,
        nextOccurrenceDate: dueDate?.getTime() ?? Date.now(),
        reminderMinutes: reminderMinutes ?? undefined,
        priority,
        category,
      });

      const saved: TaskRecord = {
        ...task,
        subjectId: selectedSubjectId,
        title: name,
        description: description.trim() || undefined,
        startDate: dueDate?.getTime(),
        dueAt: dueDate?.getTime(),
        repeatType,
        repeatInterval: task.repeatInterval ?? 1,
        repeatDays: effectiveRepeatDays ?? [],
        nextOccurrenceDate: dueDate?.getTime() ?? Date.now(),
        reminderMinutes: reminderMinutes ?? undefined,
        priority,
        category,
      };

      onSaved(saved);
      close();
    } catch (error) {
      console.warn('Failed to save task', error);
      onError?.('Failed to save task');
    }
  };

  const dueLabel = useMemo(() => {
    if (!dueDate) return 'Set date';
    return dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [dueDate]);

  const timeLabel = useMemo(() => {
    if (!dueDate) return 'Set time';
    return dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }, [dueDate]);

  const selectedSubjectLabel = useMemo(() => {
    if (!subjectOptions) return '';
    const found = subjectOptions.find((s) => s.id === selectedSubjectId);
    return found ? `${found.title}${found.code ? ` (${found.code})` : ''}` : 'Select subject';
  }, [selectedSubjectId, subjectOptions]);

  const priorityLabel = priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'None';
  const categoryLabel = category ?? 'None';

  const reminderLabel = reminderMinutes === null ? 'None'
    : reminderMinutes === 0 ? 'At due time'
    : reminderMinutes === 5 ? '5 mins before'
    : reminderMinutes === 15 ? '15 mins before'
    : reminderMinutes === 30 ? '30 mins before'
    : reminderMinutes === 60 ? '1 hour before'
    : reminderMinutes === 1440 ? '1 day before'
    : 'None';

  const repeatLabel = repeatType === 'none' ? 'None'
    : repeatType === 'daily' ? (skipWeekends ? 'Daily (weekdays)' : 'Daily')
    : repeatType === 'weekly' ? `Weekly${repeatDays.length > 0 ? ` (${repeatDays.map((d) => DAYS.find((x) => x.value === d)?.label || d).join(', ')})` : ''}`
    : repeatType === 'monthly' ? 'Monthly'
    : 'None';

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200 }]}>
      {/* Main backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
      </Animated.View>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />

      {/* Main panel */}
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
        <View style={[styles.panel, { maxHeight: panelMaxHeight }]} {...mainPanResponder.panHandlers}>
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
            <Text style={styles.panelTitle}>Edit Task</Text>

            {/* Title + Description */}
            <View style={styles.card}>
              <View style={styles.editInfoRow}>
                <Feather name="check-square" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Task Name"
                  placeholderTextColor="#91948f"
                  style={styles.editInfoInput}
                />
              </View>
              <View style={styles.separator} />
              <View style={[styles.editInfoRow, { minHeight: 88, alignItems: 'flex-start' }]}>
                <Feather name="align-left" size={16} color="#8f968f" style={{ marginRight: 10, marginTop: 16 }} />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Description (Optional)"
                  placeholderTextColor="#91948f"
                  style={styles.editInfoInput}
                  multiline
                />
              </View>
            </View>

            {/* Subject picker */}
            {subjectOptions && subjectOptions.length > 0 ? (
              <View style={[styles.card, { marginTop: 16 }]}>
                <Pressable style={styles.editInfoRow} onPress={() => openSubView('subject')}>
                  <Feather name="book-open" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                  <Text style={styles.editInfoInput}>Subject</Text>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.chipText, { flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">{selectedSubjectLabel}</Text>
                    <Feather name="chevron-right" size={18} color="#9aa09a" />
                  </View>
                </Pressable>
              </View>
            ) : null}

            {/* Due date / time */}
            <View style={[styles.card, { marginTop: 16 }]}>
              <View style={styles.editInfoRow}>
                <Pressable onPress={() => { if (!dueDate) setDueDate(new Date()); setShowDatePicker(true); }} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Feather name="calendar" size={16} color="#8f968f" style={{ marginRight: 8 }} />
                  <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 16, color: dueDate ? '#1e2b26' : '#b7bcb7' }}>
                    {dueLabel}
                  </Text>
                </Pressable>
                <Pressable onPress={() => { if (!dueDate) setDueDate(new Date()); setShowTimePicker(true); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Feather name="clock" size={16} color="#8f968f" style={{ marginRight: 8 }} />
                  <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 16, color: dueDate ? '#1e2b26' : '#b7bcb7' }}>
                    {timeLabel}
                  </Text>
                </Pressable>
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
            </View>

            {/* Priority / Category / Reminder / Repeat rows */}
            <View style={[styles.card, { marginTop: 16 }]}>
              <Pressable style={styles.editInfoRow} onPress={() => openSubView('priority')}>
                <Feather name="flag" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <Text style={styles.editInfoInput}>Priority</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {priority ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <MaterialIcons name="flag" size={14} color={priority === 'high' ? '#d1453b' : '#e88d3f'} />
                      <Text style={styles.chipText}>{priorityLabel}</Text>
                    </View>
                  ) : (
                    <Text style={styles.chipText}>None</Text>
                  )}
                  <Feather name="chevron-right" size={18} color="#9aa09a" />
                </View>
              </Pressable>
              <View style={styles.separator} />
              <Pressable style={styles.editInfoRow} onPress={() => openSubView('category')}>
                <Feather name="folder" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <Text style={styles.editInfoInput}>Category</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.chipText}>{categoryLabel}</Text>
                  <Feather name="chevron-right" size={18} color="#9aa09a" />
                </View>
              </Pressable>
              <View style={styles.separator} />
              <Pressable style={styles.editInfoRow} onPress={() => openSubView('reminder')}>
                <Feather name="bell" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <Text style={styles.editInfoInput}>Reminder</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.chipText}>{reminderLabel}</Text>
                  <Feather name="chevron-right" size={18} color="#9aa09a" />
                </View>
              </Pressable>
              <View style={styles.separator} />
              <Pressable style={styles.editInfoRow} onPress={() => openSubView('repeat')}>
                <Feather name="repeat" size={16} color="#8f968f" style={{ marginRight: 10 }} />
                <Text style={styles.editInfoInput}>Repeat</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.chipText}>{repeatLabel}</Text>
                  <Feather name="chevron-right" size={18} color="#9aa09a" />
                </View>
              </Pressable>
            </View>

            <View style={styles.editInfoActions}>
              <Pressable onPress={close}>
                <Text style={styles.editInfoCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editInfoSaveButton, !title.trim() && styles.editInfoSaveButtonDisabled]}
                onPress={() => void handleSave()}
                disabled={!title.trim()}
              >
                <Text style={styles.editInfoSaveText}>Save</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Animated.View>

      {/* Sub-modal backdrop + panel */}
      {subView ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 210 }]}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: subOpacityAnim }]}>
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
          </Animated.View>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSubView} />
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
                  {/* Subject picker */}
                  {subView === 'subject' && subjectOptions && (
                    <>
                      <Text style={styles.subModalTitle}>Subject</Text>
                      <View style={styles.card}>
                        {subjectOptions.map((s, i) => {
                          const selected = selectedSubjectId === s.id;
                          return (
                            <View key={s.id}>
                              {i > 0 && <View style={styles.separator} />}
                              <Pressable
                                style={[styles.editInfoRow, selected && { backgroundColor: '#eef2ec' }]}
                                onPress={() => { setSelectedSubjectId(s.id); closeSubView(); }}
                              >
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                  <Feather name="book-open" size={16} color="#5c6762" />
                                  <Text style={[styles.subModalOptionText, selected && { fontFamily: 'Manrope_700Bold' }]} numberOfLines={1} ellipsizeMode="tail">
                                    {s.title}{s.code ? ` (${s.code})` : ''}
                                  </Text>
                                </View>
                                {selected && <Feather name="check" size={20} color="#0f2a24" />}
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                      <Pressable style={styles.subModalBackRow} onPress={closeSubView}>
                        <Text style={styles.subModalBackText}>Back</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Priority */}
                  {subView === 'priority' && (
                    <>
                      <Text style={styles.subModalTitle}>Priority</Text>
                      <View style={styles.card}>
                        {[
                          { value: null, label: 'None', color: '#d4d8d4' },
                          { value: 'low', label: 'Low', color: '#e88d3f' },
                          { value: 'high', label: 'High', color: '#d1453b' },
                        ].map((opt, i) => {
                          const selected = priority === opt.value;
                          return (
                            <View key={String(opt.value)}>
                              {i > 0 && <View style={styles.separator} />}
                              <Pressable
                                style={[styles.editInfoRow, selected && { backgroundColor: '#eef2ec' }]}
                                onPress={() => { setPriority(opt.value); closeSubView(); }}
                              >
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                  <MaterialIcons name="flag" size={16} color={opt.color} />
                                  <Text style={[styles.subModalOptionText, selected && { fontFamily: 'Manrope_700Bold' }]}>{opt.label}</Text>
                                </View>
                                {selected && <Feather name="check" size={20} color="#0f2a24" />}
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                      <Pressable style={styles.subModalBackRow} onPress={closeSubView}>
                        <Text style={styles.subModalBackText}>Back</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Category */}
                  {subView === 'category' && (
                    <>
                      <Text style={styles.subModalTitle}>Category</Text>
                      <View style={styles.card}>
                        {(['Assignment', 'Quiz', 'Exam', 'Project', 'Meeting', 'Study session', 'Personal'] as const).map((cat, i) => {
                          const selected = category === cat;
                          return (
                            <View key={cat}>
                              {i > 0 && <View style={styles.separator} />}
                              <Pressable
                                style={[styles.editInfoRow, selected && { backgroundColor: '#eef2ec' }]}
                                onPress={() => { setCategory(selected ? null : cat); closeSubView(); }}
                              >
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                  <Feather name={cat === 'Assignment' ? 'file-text' : cat === 'Quiz' ? 'help-circle' : cat === 'Exam' ? 'edit-3' : cat === 'Project' ? 'briefcase' : cat === 'Meeting' ? 'users' : cat === 'Study session' ? 'book' : 'user'} size={16} color="#5c6762" />
                                  <Text style={[styles.subModalOptionText, selected && { fontFamily: 'Manrope_700Bold' }]}>{cat}</Text>
                                </View>
                                {selected && <Feather name="check" size={20} color="#0f2a24" />}
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                      <Pressable style={styles.subModalBackRow} onPress={closeSubView}>
                        <Text style={styles.subModalBackText}>Back</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Reminder */}
                  {subView === 'reminder' && (
                    <>
                      <Text style={styles.subModalTitle}>Reminder</Text>
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
                                style={[styles.editInfoRow, selected && { backgroundColor: '#eef2ec' }]}
                                onPress={disabled ? undefined : () => { setReminderMinutes(opt.mins); closeSubView(); }}
                              >
                                <Text style={[styles.subModalOptionText, selected && { fontFamily: 'Manrope_700Bold', flex: 1 }, disabled && { color: '#c9cdc9' }]}>{opt.label}</Text>
                                {selected && <Feather name="check" size={20} color="#0f2a24" />}
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                      {!dueDate && (
                        <Text style={{ fontFamily: 'Manrope_400Regular', fontSize: 13, color: '#8f968f', textAlign: 'center', marginTop: 10 }}>Set a date and time to enable reminders</Text>
                      )}
                      <Pressable style={styles.subModalBackRow} onPress={closeSubView}>
                        <Text style={styles.subModalBackText}>Back</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Repeat */}
                  {subView === 'repeat' && repeatSubStep === 'main' && (
                    <>
                      <Text style={styles.subModalTitle}>Repeat</Text>
                      <View style={styles.card}>
                        {([
                          { key: 'none', label: 'None' },
                          { key: 'daily', label: 'Daily' },
                          { key: 'weekly', label: 'Weekly' },
                          { key: 'monthly', label: 'Monthly' },
                        ] as const).map((opt, i) => {
                          const selected = repeatType === opt.key;
                          const isDisabled = opt.key !== 'none' && !dueDate;
                          return (
                            <View key={opt.key}>
                              {i > 0 && <View style={styles.separator} />}
                              <Pressable
                                style={[
                                  styles.editInfoRow,
                                  selected && { backgroundColor: '#eef2ec' },
                                  isDisabled && { opacity: 0.35 },
                                ]}
                                disabled={isDisabled}
                                onPress={() => {
                                  setRepeatType(opt.key as any);
                                  if (opt.key === 'weekly') {
                                    setRepeatSubStep('weeklyDays');
                                  } else if (opt.key === 'daily') {
                                    setRepeatSubStep('dailySkip');
                                  } else {
                                    closeSubView();
                                  }
                                }}
                              >
                                <Text style={[styles.subModalOptionText, selected && { fontFamily: 'Manrope_700Bold', flex: 1 }]}>{opt.label}</Text>
                                {selected && <Feather name="check" size={20} color="#0f2a24" />}
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                      {!dueDate && (
                        <Text style={styles.subModalHint}>Set a date and time to enable repeats</Text>
                      )}
                      <Pressable style={styles.subModalBackRow} onPress={closeSubView}>
                        <Text style={styles.subModalBackText}>Back</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Repeat: Weekly Days */}
                  {subView === 'repeat' && repeatSubStep === 'weeklyDays' && (
                    <>
                      <Text style={styles.subModalTitle}>Repeat Days</Text>
                      <View style={styles.subModalDaysContainer}>
                        {DAYS.map((d) => {
                          const selected = repeatDays.includes(d.value);
                          return (
                            <Pressable
                              key={d.value}
                              style={[styles.dayChip, selected && styles.dayChipSelected]}
                              onPress={() => {
                                setRepeatDays((prev) =>
                                  prev.includes(d.value) ? prev.filter((v) => v !== d.value) : [...prev, d.value]
                                );
                              }}
                            >
                              <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>{d.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <Pressable style={styles.subModalBackRow} onPress={() => setRepeatSubStep('main')}>
                        <Text style={styles.subModalBackText}>Back</Text>
                      </Pressable>
                    </>
                  )}

                  {/* Repeat: Daily Skip Weekends */}
                  {subView === 'repeat' && repeatSubStep === 'dailySkip' && (
                    <>
                      <Text style={styles.subModalTitle}>Daily Repeat</Text>
                      <View style={styles.card}>
                        <View style={styles.editInfoRow}>
                          <Pressable
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
                            onPress={() => setSkipWeekends((prev) => !prev)}
                          >
                            <View
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 6,
                                borderWidth: 2,
                                borderColor: skipWeekends ? '#0f2a24' : '#c9cdc9',
                                backgroundColor: skipWeekends ? '#0f2a24' : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {skipWeekends && <Feather name="check" size={14} color="#ffffff" />}
                            </View>
                            <Text style={{ fontFamily: 'Manrope_500Medium', fontSize: 16, color: '#1e2b26' }}>Skip weekends</Text>
                          </Pressable>
                        </View>
                      </View>
                      <Pressable style={styles.subModalBackRow} onPress={() => setRepeatSubStep('main')}>
                        <Text style={styles.subModalBackText}>Back</Text>
                      </Pressable>
                    </>
                  )}
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
  editInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 52,
  },
  editInfoInput: {
    flex: 1,
    fontFamily: 'Manrope_500Medium',
    fontSize: 16,
    color: '#1e2b26',
    paddingVertical: 14,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0ed',
  },
  chipText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 14,
    color: '#8f968f',
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
  // Sub-modal styles
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
  subModalBackRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  subModalBackText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#0f2a24',
  },
  subModalHint: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#8f968f',
    textAlign: 'center',
    marginTop: 12,
  },
  subModalDaysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0eee9',
  },
  dayChipSelected: {
    backgroundColor: '#0f2a24',
  },
  dayChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 13,
    color: '#4d5852',
  },
  dayChipTextSelected: {
    color: '#ffffff',
  },
});
