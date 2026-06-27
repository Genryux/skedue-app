import { Feather, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { shadowLg } from '../../ui/tokens/shadows';
import { useTheme } from '../../ui/theme/ThemeContext';

export type FormattedSubject = {
  id: string;
  code: string;
  title: string;
  instructor: string;
  days: string[];
  time: string;
  location: string;
  term: string;
  isArchived: boolean;
  isPinned: boolean;
  tasksCount: number;
  notesCount: number;
};


type SubjectsScreenProps = {
  subjects: FormattedSubject[];
  onPressSubject: (subject: FormattedSubject) => void;
  onFilterPress?: () => void;
  onBulkAddPress?: () => void;
  onTogglePin?: (subjectId: string, isPinned: boolean) => void;
  hasActiveFilter?: boolean;
};

export default function SubjectsScreen({ subjects, onPressSubject, onFilterPress, onBulkAddPress, onTogglePin, hasActiveFilter }: SubjectsScreenProps) {
  const { isDark } = useTheme();
  return (
    <>
      <View style={styles.titleBlockSubjects}>
        <Text style={[styles.title, isDark && styles.titleDark]}>My Subjects</Text>
        <View style={styles.titleActions}>
          {onBulkAddPress && (
            <Pressable style={[styles.filterButton, isDark && styles.filterButtonDark]} onPress={onBulkAddPress}>
              <MaterialCommunityIcons name="book-plus-outline" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
            </Pressable>
          )}
          <Pressable style={[styles.filterButton, isDark && styles.filterButtonDark]} onPress={onFilterPress}>
          {hasActiveFilter ? (
            <MaterialCommunityIcons name="filter-variant" size={16} color="#4d7e6a" />
          ) : (
            <Feather name="filter" size={16} color={isDark ? '#d7e4dd' : '#1e2b26'} />
          )}
        </Pressable>
        </View>
      </View>
      <View style={styles.subjectsSection}>
        {subjects.length === 0 ? (
          <View style={[styles.subjectEmptyCard, isDark && styles.subjectEmptyCardDark]}>
            <View style={[styles.subjectEmptyIcon, isDark && styles.subjectEmptyIconDark]}>
              <Feather name="book" size={18} color={isDark ? '#d7e4dd' : '#1e2b26'} />
            </View>
            <Text style={[styles.subjectEmptyTitle, isDark && styles.subjectEmptyTitleDark]}>No subjects yet</Text>
            <Text style={[styles.subjectEmptyBody, isDark && styles.subjectEmptyBodyDark]}>
              Add a subject to organize your classes, schedules, and tasks.
            </Text>
          </View>
        ) : (
          subjects.map((subject) => (
            <Pressable 
              key={subject.id} 
              style={[styles.subjectCard, isDark && styles.subjectCardDark]}
              onPress={() => onPressSubject(subject)}
            >
              <View style={styles.subjectHeader}>
                <View style={styles.subjectCodePill}>
                  <Text style={styles.subjectCodeText}>{subject.code}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={isDark ? '#6e7b74' : '#6b746f'} />
              </View>
              <Text style={[styles.subjectTitle, isDark && styles.subjectTitleDark]}>{subject.title}</Text>
              <Text style={[styles.subjectInstructor, isDark && styles.subjectInstructorDark]}>
                {subject.instructor || 'No instructor assigned'}
              </Text>

              <View style={[styles.metaDivider, isDark && styles.metaDividerDark]} />

              <View style={styles.subjectMetaRow}>
                <View style={styles.subjectMetaRowLeft}>
                  <View style={styles.subjectMetaItem}>
                    <Feather name="check-square" size={14} color={isDark ? '#6e7b74' : '#5c6762'} />
                    <Text style={[styles.subjectMetaText, isDark && styles.subjectMetaTextDark]}>{subject.tasksCount} Tasks</Text>
                  </View>
                  <View style={styles.subjectMetaItem}>
                    <Feather name="file-text" size={14} color={isDark ? '#6e7b74' : '#5c6762'} />
                    <Text style={[styles.subjectMetaText, isDark && styles.subjectMetaTextDark]}>{subject.notesCount} Notes</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.pinButton}
                  onPress={(e) => { e.stopPropagation(); onTogglePin?.(subject.id, !subject.isPinned); }}
                  hitSlop={8}
                >
                  <MaterialIcons
                    name={subject.isPinned ? "bookmark" : "bookmark-border"}
                    size={20}
                    color={subject.isPinned ? '#eab308' : isDark ? '#4a5a52' : '#cbc8c1'}
                  />
                </Pressable>
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
    fontSize: 22,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fcfbfa',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f2f1ee',
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
  pinButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -2,
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
  metaDivider: {
    height: 1,
    backgroundColor: '#eeeae1',
    marginBottom: 16,
  },
  subjectMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectMetaRowLeft: {
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
  titleDark: { color: '#d7e4dd' },
  filterButtonDark: { backgroundColor: '#0f201b', borderColor: '#2a3d36' },
  subjectCardDark: { backgroundColor: '#0f201b' },
  subjectTitleDark: { color: '#d7e4dd' },
  subjectInstructorDark: { color: '#8f9b95' },
  metaDividerDark: { backgroundColor: '#2a3d36' },
  subjectMetaTextDark: { color: '#8f9b95' },
  subjectEmptyCardDark: { backgroundColor: '#0f201b' },
  subjectEmptyIconDark: { backgroundColor: '#2a3d36', borderColor: 'rgba(255,255,255,0.04)' },
  subjectEmptyTitleDark: { color: '#d7e4dd' },
  subjectEmptyBodyDark: { color: '#8f9b95' },
});
