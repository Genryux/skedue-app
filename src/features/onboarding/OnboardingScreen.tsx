import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';

type OnboardingScreenProps = {
  onAddSubjectPress: () => void;
};

export default function OnboardingScreen({ onAddSubjectPress }: OnboardingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Ready to organize your{`\n`}semester?</Text>
        <Text style={styles.subtitle}>Let's set up your academic hub for success.</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Build Your Foundation</Text>
          <Text style={styles.infoBody}>
            In Skedue, everything revolves around your Subjects. Start by creating your first class to unlock
            schedules, tasks, and notes.
          </Text>
        </View>
        <Text style={styles.sectionKicker}>COMING UP ONCE YOU SET UP</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoTile}>
            <Feather name="calendar" size={18} color="#7a847f" style={styles.infoTileIcon} />
            <Text style={styles.infoTileText}>Today's Schedule</Text>
          </View>
          <View style={styles.infoTile}>
            <Feather name="check-square" size={18} color="#7a847f" style={styles.infoTileIcon} />
            <Text style={styles.infoTileText}>Task</Text>
          </View>
          <View style={styles.infoTile}>
            <Feather name="file-text" size={18} color="#7a847f" style={styles.infoTileIcon} />
            <Text style={styles.infoTileText}>Notes</Text>
          </View>
          <View style={styles.infoTile}>
            <Feather name="grid" size={18} color="#7a847f" style={styles.infoTileIcon} />
            <Text style={styles.infoTileText}>Explore Timetable</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomArea}>
        <Pressable style={styles.addSubjectButton} onPress={onAddSubjectPress}>
          <View style={styles.addSubjectIcon}>
            <Feather name="plus" size={18} color="#ecf2ee" />
          </View>
          <Text style={styles.addSubjectText}>Add subject</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0,
  },
  content: {
    flex: 1,
    paddingTop: 24,
  },
  title: {
    color: '#1e2b26',
    fontFamily: 'Manrope_700Bold',
    fontSize: 30,
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: {
    color: '#56615a',
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#16312b',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#0f1a16',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  infoTitle: {
    color: '#e8f0ea',
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
    lineHeight: 24,
    marginBottom: 8,
  },
  infoBody: {
    color: '#c9d4cf',
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionKicker: {
    color: '#a4afa9',
    fontFamily: 'Manrope_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 12,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  infoTile: {
    width: '47%',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d9d6d0',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f5f0',
  },
  infoTileIcon: {
    marginBottom: 8,
  },
  infoTileText: {
    color: '#7a847f',
    fontFamily: 'Manrope_400Regular',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  bottomArea: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  addSubjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16312b',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
    width: '100%',
    justifyContent: 'center',
    minHeight: 56,
  },
  addSubjectIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1f3a33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubjectText: {
    color: '#ecf2ee',
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
    lineHeight: 18,
  },
});
