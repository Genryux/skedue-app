import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import OnboardingScreen from '../src/features/onboarding/OnboardingScreen';
import NotificationPermissionModal from '../src/features/onboarding/NotificationPermissionModal';
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
import { useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { configureTaskReminderNotifications } from '../src/services/taskReminders';

const META_KEYS = {
  hasOnboarded: 'hasOnboarded',
  notificationPromptShown: 'notification_prompt_shown',
} as const;

export default function IndexScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [subjects, setSubjects] = useState<SubjectRecord[]>([]);
  const [onboardingStep, setOnboardingStep] = useState<'home' | 'add-subject'>('home');
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 is onboarding, 1 is add subject
  const dashboardFadeAnim = useRef(new Animated.Value(0)).current; // 0 is onboarding, 1 is dashboard
  const [isTransitioningToDashboard, setIsTransitioningToDashboard] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  const showOnboarding = !hasOnboarded;
  const hasCheckedPrompt = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const loadState = async () => {
      try {
        configureTaskReminderNotifications();
        await initDb();

        const [onboardedValue, storedSubjects] = await Promise.all([
          getMetaValue(META_KEYS.hasOnboarded),
          getSubjects(),
        ]);

        if (!isMounted) {
          return;
        }

        const onboarded = onboardedValue === 'true';
        setHasOnboarded(onboarded);
        setSubjects(storedSubjects);

        // If already onboarded, the dashboard should be fully visible immediately
        if (onboarded) {
          dashboardFadeAnim.setValue(1);
        }
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

  useEffect(() => {
    if (hasOnboarded && !isTransitioningToDashboard && !hasCheckedPrompt.current) {
      hasCheckedPrompt.current = true;
      const checkPrompt = async () => {
        const shown = await getMetaValue(META_KEYS.notificationPromptShown);
        if (shown !== 'true') {
          setTimeout(() => setShowNotificationPrompt(true), 600);
        }
      };
      checkPrompt();
    }
  }, [hasOnboarded, isTransitioningToDashboard]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'task_reminder' && data?.taskId) {
        // Notification tapped — just log for now.
        // Navigation to the specific subject/task can be added later.
        console.log('Notification tapped for task:', data.taskId);
      }
    });
    return () => sub.remove();
  }, []);

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
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleCancelAddSubject = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 350,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setOnboardingStep('home');
      }
    });
  };

  const handleSkip = async () => {
    try {
      setIsTransitioningToDashboard(true);
      
      Animated.timing(dashboardFadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(async ({ finished }) => {
        if (finished) {
          setHasOnboarded(true);
          await setMetaValue(META_KEYS.hasOnboarded, 'true');
          setIsTransitioningToDashboard(false);
        }
      });
    } catch (error) {
      console.warn('Failed to skip onboarding', error);
      setIsTransitioningToDashboard(false);
    }
  };

  const handleSaveSubject = async (subjectData: {
    title: string;
    code?: string;
    instructor?: string;
    term?: string;
    days: string[];
    startTime: string;
    endTime: string;
    location?: string;
  }) => {
    try {
      const savedSubject = await insertSubject({ ...subjectData, isArchived: false, isPinned: false });

      setIsTransitioningToDashboard(true);
      
      Animated.timing(dashboardFadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(async ({ finished }) => {
        if (finished) {
          setHasOnboarded(true);
          setSubjects((prev) => [...prev, savedSubject]);
          setOnboardingStep('home');
          await setMetaValue(META_KEYS.hasOnboarded, 'true');
          setIsTransitioningToDashboard(false);
        }
      });
    } catch (error) {
      console.warn('Failed to save subject', error);
      setIsTransitioningToDashboard(false);
    }
  };

  const handleDismissNotificationPrompt = async () => {
    setShowNotificationPrompt(false);
    await setMetaValue(META_KEYS.notificationPromptShown, 'true');
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        {showOnboarding || isTransitioningToDashboard ? (
          <Animated.View 
            style={[
              styles.onboardingContainer,
              {
                opacity: dashboardFadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [{
                  scale: dashboardFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.05],
                  })
                }]
              }
            ]}
          >
            <View style={styles.onboardingContainer}>
              <Animated.View 
                style={[
                  styles.screenWrapper, 
                  { 
                    opacity: slideAnim.interpolate({
                      inputRange: [0, 0.5],
                      outputRange: [1, 0],
                    }),
                    transform: [{
                      scale: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0.92],
                      })
                    }]
                  }
                ]}
              >
                <OnboardingScreen 
                  onAddSubjectPress={handleStartAddSubject} 
                  onSkipPress={handleSkip} 
                />
              </Animated.View>
              
              <Animated.View 
                style={[
                  styles.screenWrapper, 
                  StyleSheet.absoluteFill,
                  { 
                    transform: [{
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1000, 0], 
                      })
                    }]
                  }
                ]}
                pointerEvents={onboardingStep === 'add-subject' ? 'auto' : 'none'}
              >
                <AddSubjectScreen onBack={handleCancelAddSubject} onSave={handleSaveSubject} />
              </Animated.View>
            </View>
          </Animated.View>
        ) : null}

        {!showOnboarding || isTransitioningToDashboard ? (
          <Animated.View 
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: dashboardFadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
                transform: [{
                  scale: dashboardFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  })
                }]
              }
            ]}
            pointerEvents={!showOnboarding ? 'auto' : 'none'}
          >
            <MainScreen />
          </Animated.View>
        ) : null}
        {showNotificationPrompt ? (
          <NotificationPermissionModal onDismiss={handleDismissNotificationPrompt} />
        ) : null}
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
  onboardingContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  screenWrapper: {
    flex: 1,
  },
});
