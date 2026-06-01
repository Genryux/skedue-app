import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getSubjects, type SubjectRecord } from '../../data/local/db';
import { formatTimeDisplay } from '../../utils/timeUtils';
import { findTimeConflicts } from './conflictUtils';
import { shadowLg } from '../../ui/tokens/shadows';

type AddSubjectScreenProps = {
  onBack: () => void;
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

export default function AddSubjectScreen({ onBack, onSave }: AddSubjectScreenProps) {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [term, setTerm] = useState('');
  const [showTermPicker, setShowTermPicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set(DEFAULT_SELECTED_DAYS));
  
  // For conflict detection
  const [existingSubjects, setExistingSubjects] = useState<SubjectRecord[]>([]);

  // Internal date objects for the picker
  const [startDate, setStartDate] = useState(new Date(2026, 0, 1, 9, 0));
  const [endDate, setEndDate] = useState(new Date(2026, 0, 1, 10, 30));
  
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [location, setLocation] = useState('');

  const formatTimeDisplay = (date: Date) => {
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
    getSubjects().then(setExistingSubjects).catch(console.warn);
  }, []);

  const conflicts = useMemo(() => {
    return findTimeConflicts(
      {
        days: Array.from(selectedDays),
        startTime: formatTimeDisplay(startDate),
        endTime: formatTimeDisplay(endDate),
      },
      existingSubjects
    );
  }, [selectedDays, startDate, endDate, existingSubjects]);

  const hasConflict = conflicts.length > 0;

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
      startTime: formatTimeDisplay(startDate),
      endTime: formatTimeDisplay(endDate),
      location: location.trim() || undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.header}>
        <Pressable style={styles.headerIcon} onPress={onBack}>
          <Feather name="chevron-left" size={28} color="#1e2b26" />
        </Pressable>
        <Text style={styles.headerTitle}>New Subject</Text>
        <View style={styles.headerIconSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>BASIC INFORMATION</Text>
        <View style={styles.group}>
          <View style={styles.row}>
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
            <TextInput
              value={instructor}
              onChangeText={setInstructor}
              placeholder="Instructor (Optional)"
              placeholderTextColor="#91948f"
              style={styles.input}
            />
          </View>
          <View style={styles.separator} />
          <Pressable style={styles.row} onPress={() => setShowTermPicker(true)}>
            <Text style={[styles.input, !term && { color: '#91948f' }]}>
              {term || 'Academic Period (Optional)'}
            </Text>
            <Feather name="chevron-right" size={20} color="#9aa09a" />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>SCHEDULE</Text>
        <View style={styles.group}>
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
          
          <View style={styles.timeGroupRow}>
            <Pressable style={styles.timeAction} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.timeActionLabel}>Start Time</Text>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{formatTimeDisplay(startDate)}</Text>
              </View>
            </Pressable>
            <View style={styles.verticalSeparator} />
            <Pressable style={styles.timeAction} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.timeActionLabel}>End Time</Text>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>{formatTimeDisplay(endDate)}</Text>
              </View>
            </Pressable>
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
        </View>

        <Text style={styles.sectionTitle}>LOCATION</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Feather name="map-pin" size={16} color="#1e2b26" style={{ marginRight: 10 }} />
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
              Conflicts with <Text style={styles.conflictSubjectName}>{conflicts[0].title}</Text>
            </Text>
          </View>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={onBack}>
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

      <Modal
        visible={showTermPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTermPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTermPicker(false)}>
          <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Academic Period</Text>
              <Pressable onPress={() => setShowTermPicker(false)} style={styles.modalCloseButton}>
                <Text style={styles.modalCloseText}>Done</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.modalOptionsContainer} showsVerticalScrollIndicator={false}>
              {[
                '1st Semester',
                '2nd Semester',
                'Summer / Midyear',
                '1st Quarter',
                '2nd Quarter',
                '3rd Quarter',
                '4th Quarter'
              ].map((option) => (
                <Pressable
                  key={option}
                  style={[styles.modalOption, term === option && styles.modalOptionSelected]}
                  onPress={() => {
                    setTerm(option);
                    setShowTermPicker(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, term === option && styles.modalOptionTextSelected]}>{option}</Text>
                  {term === option && <Feather name="check" size={20} color="#0f2a24" />}
                </Pressable>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f6',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowLg,
  },
  headerIconSpacer: {
    width: 44,
  },
  headerTitle: {
    color: '#1e2b26',
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 18,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#9aa09a',
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 24,
    letterSpacing: 0.5,
  },
  group: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    ...shadowLg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 60,
  },
  rowLabel: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 15,
    color: '#1e2b26',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0ed',
    marginLeft: 16,
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0ed',
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
    backgroundColor: '#e4e1db',
    shadowOpacity: 0,
    elevation: 0,
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
  conflictWarningHeader: {
    // Icon container
  },
  conflictWarningTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
    color: '#991b1b',
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 12,
    maxHeight: '75%',
    ...shadowLg,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },
  modalHandle: {
    width: 36,
    height: 5,
    backgroundColor: '#e4e1db',
    borderRadius: 3,
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: 'Manrope_800ExtraBold',
    fontSize: 19,
    color: '#1e2b26',
  },
  modalCloseButton: {
    position: 'absolute',
    right: 24,
    top: 14,
  },
  modalCloseText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#0f2a24',
  },
  modalOptionsContainer: {
    paddingHorizontal: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#f9f9f6',
  },
  modalOptionSelected: {
    backgroundColor: '#eef2ec',
    borderWidth: 1,
    borderColor: '#0f2a24',
  },
  modalOptionText: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 16,
    color: '#2a332e',
  },
  modalOptionTextSelected: {
    color: '#0f2a24',
    fontFamily: 'Manrope_700Bold',
  },
});
