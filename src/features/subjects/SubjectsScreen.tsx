import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type FormattedSubject = {
  id: string;
  code: string;
  title: string;
  instructor: string;
  days: string;
  time: string;
  location: string;
  tasksCount: number;
  notesCount: number;
};

type SubjectsScreenProps = {
  subjects: FormattedSubject[];
};

export default function SubjectsScreen({ subjects }: SubjectsScreenProps) {
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
            <View key={subject.id} style={styles.subjectCard}>
              <View style={styles.subjectHeader}>
                <View style={styles.subjectCodePill}>
                  <Text style={styles.subjectCodeText}>{subject.code}</Text>
                </View>
                <Feather name="more-horizontal" size={18} color="#6b746f" />
              </View>
              <Text style={styles.subjectTitle}>{subject.title}</Text>
              <Text style={styles.subjectInstructor}>{subject.instructor}</Text>

              <View style={styles.subjectInfoCard}>
                <Feather name="clock" size={14} color="#1e2b26" />
                <Text style={styles.subjectInfoText}>{`${subject.days} - ${subject.time}`}</Text>
              </View>
              <View style={styles.subjectInfoCard}>
                <Feather name="map-pin" size={14} color="#1e2b26" />
                <Text style={styles.subjectInfoText}>{subject.location}</Text>
              </View>

              <View style={styles.subjectMetaRow}>
                <View style={styles.subjectMetaItem}>
                  <Feather name="check-square" size={14} color="#1e2b26" />
                  <Text style={styles.subjectMetaText}>{subject.tasksCount} Tasks</Text>
                </View>
                <View style={styles.subjectMetaItem}>
                  <Feather name="file-text" size={14} color="#1e2b26" />
                  <Text style={styles.subjectMetaText}>{subject.notesCount} Notes</Text>
                </View>
              </View>
            </View>
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
    borderRadius: 22,
    padding: 18,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  subjectCodePill: {
    backgroundColor: '#cfe8d8',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  subjectCodeText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#1e2b26',
  },
  subjectTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    color: '#1e2b26',
    marginBottom: 4,
  },
  subjectInstructor: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#6b746f',
    marginBottom: 12,
  },
  subjectInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f4f1ec',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  subjectInfoText: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#2a332e',
  },
  subjectMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 6,
  },
  subjectMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subjectMetaText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    color: '#1e2b26',
  },
  subjectEmptyCard: {
    backgroundColor: '#f9f6f1',
    borderRadius: 22,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
  },
  subjectEmptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dceee6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectEmptyTitle: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#1e2b26',
  },
  subjectEmptyBody: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    color: '#6b746f',
    textAlign: 'center',
  },
});
