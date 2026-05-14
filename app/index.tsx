import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import OnboardingScreen from '../src/features/onboarding/OnboardingScreen';
import MainScreen from '../src/features/home/MainScreen';
import AddSubjectScreen from '../src/features/subjects/AddSubjectScreen';
import {
  getMetaValue,
  getSubjects,
  initDb,
  insertSubject,
  setMetaValue,
  type SubjectRecord,
} from '../src/data/local/db';

const META_KEYS = {
  hasOnboarded: 'hasOnboarded',
} as const;

export default function IndexScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [onboardingStep, setOnboardingStep] = useState<'home' | 'add-subject'>('home');

  const showOnboarding = !hasOnboarded || subjects.length === 0;

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      try {
        await initDb();

        const [onboardedValue, storedSubjects] = await Promise.all([
          getMetaValue(META_KEYS.hasOnboarded),
          getSubjects(),
        ]);

        if (!isMounted) {
          return;
        }

        setHasOnboarded(onboardedValue === 'true');
        setSubjects(storedSubjects);
      } catch (error) {
        console.warn('Failed to load app data', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!showOnboarding && onboardingStep !== 'home') {
      setOnboardingStep('home');
    }
  }, [onboardingStep, showOnboarding]);

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#16312b" />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const handleStartAddSubject = () => {
    setOnboardingStep('add-subject');
  };

  const handleCancelAddSubject = () => {
    setOnboardingStep('home');
  };

  const handleSaveSubject = async (subjectData: Omit<SubjectRecord, 'id' | 'createdAt'>) => {
    try {
      const savedSubject = await insertSubject(subjectData);

      setHasOnboarded(true);
      setSubjects((prev) => [...prev, savedSubject]);
      setOnboardingStep('home');

      await setMetaValue(META_KEYS.hasOnboarded, 'true');
    } catch (error) {
      console.warn('Failed to save subject', error);
    }
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {showOnboarding ? (
          onboardingStep === 'add-subject' ? (
            <AddSubjectScreen onBack={handleCancelAddSubject} onSave={handleSaveSubject} />
          ) : (
            <OnboardingScreen onAddSubjectPress={handleStartAddSubject} />
          )
        ) : (
          <MainScreen />
        )}
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f7f2',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
