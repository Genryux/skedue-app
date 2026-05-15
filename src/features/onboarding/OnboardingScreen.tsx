import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { shadowLg } from '../../ui/tokens/shadows';

type OnboardingScreenProps = {
  onAddSubjectPress: () => void;
  onSkipPress: () => void;
};

export default function OnboardingScreen({ onAddSubjectPress, onSkipPress }: OnboardingScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.heroSection}>
          <View style={styles.heroIconWrapper}>
            <LinearGradient colors={['#3d6657', '#2b4a3f']} style={styles.heroIconCircle}>
              <Feather name="book-open" size={32} color="#ffffff" />
            </LinearGradient>
          </View>
          <Text style={styles.title}>Ready to organize your{`\n`}semester?</Text>
          <Text style={styles.subtitle}>Let's set up your academic hub for success.</Text>
        </View>

        <LinearGradient colors={['#16312b', '#1f3a33']} style={styles.infoCard}>
          <View style={styles.infoCardHeader}>
            <Feather name="layers" size={20} color="#cfe8d8" />
            <Text style={styles.infoTitle}>Build Your Foundation</Text>
          </View>
          <Text style={styles.infoBody}>
            In Skedue, everything revolves around your Subjects. Start by creating your first class to unlock schedules, tasks, and notes.
          </Text>
        </LinearGradient>

        <Text style={styles.sectionKicker}>CORE FEATURES</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoTile}>
            <View style={[styles.tileIconCircle, { backgroundColor: '#eef2f0' }]}>
              <Feather name="calendar" size={18} color="#2b4a3f" />
            </View>
            <Text style={styles.infoTileText}>Today's Schedule</Text>
          </View>
          <View style={styles.infoTile}>
            <View style={[styles.tileIconCircle, { backgroundColor: '#fdf7f0' }]}>
              <Feather name="check-square" size={18} color="#946a3d" />
            </View>
            <Text style={styles.infoTileText}>Tasks & To-do's</Text>
          </View>
          <View style={styles.infoTile}>
            <View style={[styles.tileIconCircle, { backgroundColor: '#f0f4ff' }]}>
              <Feather name="file-text" size={18} color="#3d5a94" />
            </View>
            <Text style={styles.infoTileText}>Class Notes</Text>
          </View>
          <View style={styles.infoTile}>
            <View style={[styles.tileIconCircle, { backgroundColor: '#fdf0f7' }]}>
              <Feather name="grid" size={18} color="#943d6e" />
            </View>
            <Text style={styles.infoTileText}>Interactive Timetable</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomArea}>
        <View style={styles.buttonRow}>
          <Pressable style={styles.skipButton} onPress={onSkipPress}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          <Pressable style={styles.addSubjectButton} onPress={onAddSubjectPress}>
            <Text style={styles.addSubjectText}>Get Started</Text>
            <View style={styles.addSubjectIcon}>
              <Feather name="arrow-right" size={18} color="#ffffff" />
            </View>
          </Pressable>
        </View>
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
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroIconWrapper: {
    marginBottom: 20,
    ...shadowLg,
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#1e2b26',
    fontFamily: 'Manrope_700Bold',
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#56615a',
    fontFamily: 'Manrope_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  infoCard: {
    borderRadius: 24,
    padding: 22,
    ...shadowLg,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  infoTitle: {
    color: '#e8f0ea',
    fontFamily: 'Manrope_700Bold',
    fontSize: 18,
  },
  infoBody: {
    color: '#c9d4cf',
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 22,
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
  },
  infoTile: {
    width: '47%',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    ...shadowLg,
  },
  tileIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  infoTileText: {
    color: '#2a332e',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    textAlign: 'center',
  },
  bottomArea: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  skipButton: {
    paddingHorizontal: 24,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: '#6b746f',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
  },
  addSubjectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3d6657',
    borderRadius: 20,
    height: 58,
    paddingHorizontal: 20,
    gap: 12,
    justifyContent: 'center',
    shadowColor: '#3d6657',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  addSubjectIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubjectText: {
    color: '#ffffff',
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
