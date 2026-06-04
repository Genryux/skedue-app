import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View, Animated } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { shadowLg } from '../../ui/tokens/shadows';
import {
  ensureTaskReminderPermissions,
  openExactAlarmSettings,
} from '../../services/taskReminders';

type Props = {
  onDismiss: () => void;
};

export default function NotificationPermissionModal({ onDismiss }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [notificationAllowed, setNotificationAllowed] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAllowNotifications = async () => {
    const granted = await ensureTaskReminderPermissions();
    if (granted) {
      setNotificationAllowed(true);
    }
  };

  const handleOpenAlarms = async () => {
    await openExactAlarmSettings();
    onDismiss();
  };

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.card}>
        <View style={styles.iconWrapper}>
          <Feather name="bell" size={28} color="#16312b" />
        </View>
        <Text style={styles.title}>Stay on Track with Notifications</Text>
        <Text style={styles.body}>
          Enable notifications and alarms & reminders to receive task reminders on time.
          {'\n\n'}
          <Text style={styles.notice}>Notice:</Text> Not enabling these settings may cause
          several seconds of delay in notification arrival.
        </Text>
        <View style={styles.buttonsWrapper}>
          <Pressable
            style={[styles.primaryButton, notificationAllowed && styles.primaryButtonDisabled]}
            onPress={handleAllowNotifications}
            disabled={notificationAllowed}
          >
            <Feather name={notificationAllowed ? 'check' : 'bell'} size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>
              {notificationAllowed ? 'Notifications Allowed' : 'Allow Notifications'}
            </Text>
          </Pressable>
          {Platform.OS === 'android' && Number(Platform.Version) >= 31 ? (
            <Pressable style={styles.secondaryButton} onPress={handleOpenAlarms}>
              <Feather name="clock" size={18} color="#16312b" />
              <Text style={styles.secondaryButtonText}>Open Alarms & Reminders</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.dismissButton} onPress={onDismiss}>
          <Text style={styles.dismissText}>Maybe Later</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: '#f8f7f2',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 28,
    marginHorizontal: 18,
    alignItems: 'center',
    ...shadowLg,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#e8f0ea',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#1e2b26',
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    color: '#56615a',
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  notice: {
    fontFamily: 'Manrope_700Bold',
  },
  buttonsWrapper: {
    width: '100%',
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3d6657',
    borderRadius: 18,
    height: 52,
    gap: 10,
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: {
    backgroundColor: '#7a9b8e',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef2f0',
    borderRadius: 18,
    height: 52,
    gap: 10,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: '#16312b',
    fontFamily: 'Manrope_700Bold',
    fontSize: 15,
  },
  dismissButton: {
    marginTop: 20,
    paddingVertical: 8,
  },
  dismissText: {
    color: '#6b746f',
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 14,
  },
});
