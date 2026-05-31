import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shadowLg } from '../../ui/tokens/shadows';

export type FormattedSubject = {
  id: string;
  code: string;
  title: string;
  instructor: string;
  days: string[];
  time: string;
  location: string;
  term: string;
  tasksCount: number;
  notesCount: number;
};

const DAY_LABELS: Record<string, string> = {
  Mo: 'M', Tu: 'T', We: 'W', Th: 'T', Fr: 'F', Sa: 'S', Su: 'S',
  Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'T', Fri: 'F', Sat: 'S', Sun: 'S',
  Monday: 'M', Tuesday: 'T', Wednesday: 'W', Thursday: 'T', Friday: 'F', Saturday: 'S', Sunday: 'S'
};

type SubjectsScreenProps = {
  subjects: FormattedSubject[];
  onPressSubject: (subject: FormattedSubject) => void;
};

export default function SubjectsScreen({ subjects, onPressSubject }: SubjectsScreenProps) {
  return (
    <>
      <View style={styles.titleBlockSubjects}>
        <Text style={styles.title}>Your Subjects</Text>
        <Pressable style={styles.filterButton}>
          <Feather name="sliders" size={18} color="#1e2b26" />
        </Pressable>
      </View>
      <View style={styles.subjectsSection}>
        {subjects.length === 0 ? (
          <View style={styles.subjectEmptyCard}>
            <View style={styles.subjectEmptyIcon}>
              <Feather name="book" size={18} color="#1e2b26" />
            </View>
            <Text style={styles.subjectEmptyTitle}>No subjects yet</Text>
            <Text style={styles.subjectEmptyBody}>
              Add a subject to organize your classes, schedules, and tasks.
            </Text>
          </View>
        ) : (
          subjects.map((subject) => (
            <Pressable 
              key={subject.id} 
              style={styles.subjectCard}
              onPress={() => onPressSubject(subject)}
            >
              <View style={styles.subjectHeader}>
                <View style={styles.subjectCodePill}>
                  <Text style={styles.subjectCodeText}>{subject.code}</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#6b746f" />
              </View>
              <Text style={styles.subjectTitle}>{subject.title}</Text>
              <Text style={styles.subjectInstructor}>
                {subject.instructor || 'No instructor assigned'}
              </Text>

              <View style={styles.daysRow}>
                {subject.days.map((day, idx) => (
                  <View key={`${day}-${idx}`} style={styles.dayCircle}>
                    <Text style={styles.dayCircleText}>{DAY_LABELS[day] || day[0]}</Text>
                  </View>
                ))}
                {subject.days.length === 0 && (
                  <Text style={styles.noDaysText}>Schedule not set</Text>
                )}
              </View>

              <View style={styles.infoCardsRow}>
                <View style={styles.subjectInfoCard}>
                  <Feather name="clock" size={14} color="#3a5a4a" />
                  <Text style={styles.subjectInfoText} numberOfLines={1}>
                    {subject.time || 'TBA'}
                  </Text>
                </View>
                <View style={styles.subjectInfoCard}>
                  <Feather name="map-pin" size={14} color="#3a5a4a" />
                  <Text style={styles.subjectInfoText} numberOfLines={1}>
                    {subject.location || 'Location TBA'}
                  </Text>
                </View>
              </View>

              <View style={styles.metaDivider} />

              <View style={styles.subjectMetaRow}>
                <View style={styles.subjectMetaItem}>
                  <Feather name="check-square" size={14} color="#5c6762" />
                  <Text style={styles.subjectMetaText}>{subject.tasksCount} Tasks</Text>
                </View>
                <View style={styles.subjectMetaItem}>
                  <Feather name="file-text" size={14} color="#5c6762" />
                  <Text style={styles.subjectMetaText}>{subject.notesCount} Notes</Text>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  titleBlockSubjects: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#1e2b26',
    fontFamily: 'Manrope_700Bold',
    fontSize: 30,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e6e2dc',
  },
  subjectsSection: {
    gap: 18,
  },
  subjectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    ...shadowLg,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  subjectCodePill: {
    backgroundColor: '#2b4a3f',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  subjectCodeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  subjectTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    color: '#1e2b26',
    marginBottom: 4,
  },
  subjectInstructor: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#6b746f',
    marginBottom: 16,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e9f3ec',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c9ded1',
  },
  dayCircleText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 11,
    color: '#2b4a3f',
  },
  noDaysText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 12,
    color: '#6b746f',
    fontStyle: 'italic',
  },
  infoCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  subjectInfoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8f7f2',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#eeeae1',
  },
  subjectInfoText: {
    flex: 1,
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    color: '#2a332e',
  },
  metaDivider: {
    height: 1,
    backgroundColor: '#eeeae1',
    marginBottom: 16,
  },
  subjectMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  subjectMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectMetaText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#5c6762',
  },
  subjectEmptyCard: {
    backgroundColor: '#f3f2ee',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  subjectEmptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#efede8',
  },
  subjectEmptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 17,
    color: '#1e2b26',
    marginBottom: 8,
  },
  subjectEmptyBody: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#6b746f',
    textAlign: 'center',
  },
});
