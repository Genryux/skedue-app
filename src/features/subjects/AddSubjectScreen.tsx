import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type AddSubjectScreenProps = {
  onBack: () => void;
  onSave: (subjectData: {
    title: string;
    code?: string;
    instructor?: string;
    section?: string;
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
  const [section, setSection] = useState('');
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set(DEFAULT_SELECTED_DAYS));
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('10:30 AM');
  const [location, setLocation] = useState('');

  const isSaveDisabled = useMemo(() => title.trim().length === 0, [title]);

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

  const handleSave = () => {
    onSave({
      title: title.trim(),
      code: code.trim() || undefined,
      instructor: instructor.trim() || undefined,
      section: section.trim() || undefined,
      days: Array.from(selectedDays),
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      location: location.trim() || undefined,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <View style={styles.header}>
        <Pressable style={styles.headerIcon} onPress={onBack}>
          <Feather name="arrow-left" size={22} color="#1e2b26" />
        </Pressable>
        <Text style={styles.headerTitle}>New Subject</Text>
        <View style={styles.headerIconSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="Subject Code (e.g., CS101)"
              placeholderTextColor="#91948f"
              style={styles.input}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor="#91948f"
              style={styles.input}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={instructor}
              onChangeText={setInstructor}
              placeholder="Instructor (Optional)"
              placeholderTextColor="#91948f"
              style={styles.input}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              value={section}
              onChangeText={setSection}
              placeholder="Section"
              placeholderTextColor="#91948f"
              style={styles.input}
            />
            <Feather name="info" size={18} color="#9aa09a" />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderIcon}>
              <Feather name="calendar" size={18} color="#1b2f2a" />
            </View>
            <Text style={styles.cardHeaderTitle}>Schedule</Text>
          </View>

          <Text style={styles.sectionLabel}>Days</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day) => {
              const isSelected = selectedDays.has(day.value);

              return (
                <Pressable
                  key={day.value}
                  onPress={() => handleToggleDay(day.value)}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                >
                  <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>{day.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Time</Text>
          <View style={styles.timeRow}>
            <View style={styles.timeCard}>
              <Text style={styles.timeLabel}>START</Text>
              <View style={styles.timeValueRow}>
                <TextInput value={startTime} onChangeText={setStartTime} style={styles.timeInput} />
                <Feather name="clock" size={16} color="#1e2b26" />
              </View>
            </View>
            <View style={styles.timeCard}>
              <Text style={styles.timeLabel}>END</Text>
              <View style={styles.timeValueRow}>
                <TextInput value={endTime} onChangeText={setEndTime} style={styles.timeInput} />
                <Feather name="clock" size={16} color="#1e2b26" />
              </View>
            </View>
          </View>

          <View style={styles.locationInputRow}>
            <Feather name="map-pin" size={18} color="#1e2b26" />
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Location (Optional)"
              placeholderTextColor="#91948f"
              style={styles.locationInput}
            />
          </View>
        </View>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconSpacer: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    color: '#1e2b26',
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
  },
  scrollContent: {
    paddingBottom: 20,
    gap: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
  },
  inputRow: {
    backgroundColor: '#f6f4ef',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: '#2a332e',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  cardHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#eef2ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
  },
  sectionLabel: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#4d5852',
    marginBottom: 10,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayChip: {
    width: 42,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#d9d6d0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  dayChipSelected: {
    backgroundColor: '#bfe4c9',
    borderColor: '#bfe4c9',
  },
  dayChipText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#6d756f',
  },
  dayChipTextSelected: {
    color: '#1b2f2a',
  },
  divider: {
    height: 1,
    backgroundColor: '#e4e1db',
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#f6f4ef',
    borderRadius: 16,
    padding: 14,
  },
  timeLabel: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#4d5852',
    letterSpacing: 1,
    marginBottom: 6,
  },
  timeValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInput: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#1e2b26',
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 88,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f4ef',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  locationInput: {
    flex: 1,
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    color: '#2a332e',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  cancelText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    color: '#1e2b26',
  },
  saveButton: {
    backgroundColor: '#0f2a24',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#f2f6f3',
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
  },
});
