import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import type { TaskRecord } from '../data/local/db';

const TASK_REMINDER_PREFIX = 'task-reminder-';
const ANDROID_CHANNEL_ID = 'task-reminders';

let handlerConfigured = false;

export type ScheduleTaskReminderResult =
  | { scheduled: true; fireAt: number }
  | { scheduled: false; reason: 'none' | 'past' | 'permission_denied' | 'unsupported' | 'error' };

export const configureTaskReminderNotifications = () => {
  if (handlerConfigured || Platform.OS === 'web') {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  handlerConfigured = true;
};

export const ensureTaskReminderPermissions = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return false;
  }

  configureTaskReminderNotifications();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

const ensureAndroidChannel = async () => {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Task reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1c2f2a',
  });
};

export const openExactAlarmSettings = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return false;
  }

  const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : Number.parseInt(String(Platform.Version), 10);
  if (!apiLevel || apiLevel < 31) {
    return false;
  }

  const packageName = Constants.expoConfig?.android?.package ?? Constants.manifest?.android?.package ?? null;

  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, {
      data: `package:${packageName}`,
    });
    return true;
  } catch (error) {
    try {
      if (packageName) {
        await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
          data: `package:${packageName}`,
        });
      } else {
        await Linking.openSettings();
      }
      return true;
    } catch (fallbackError) {
      console.warn('Failed to open app settings for exact alarms', fallbackError);
      return false;
    }
  }
};

export const getTaskReminderFireAt = (dueAt: number | null | undefined, reminderMinutes: number | null | undefined): number | null => {
  if (!dueAt || reminderMinutes === null || reminderMinutes === undefined) {
    return null;
  }

  return dueAt - reminderMinutes * 60 * 1000;
};

export const cancelTaskReminder = async (taskId: string) => {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(`${TASK_REMINDER_PREFIX}${taskId}`);
  } catch (error) {
    console.warn('Failed to cancel task reminder', error);
  }
};

export const scheduleTaskReminder = async (
  task: Pick<TaskRecord, 'id' | 'title' | 'description' | 'nextOccurrenceDate' | 'reminderMinutes'>,
  subjectLabel?: string
): Promise<ScheduleTaskReminderResult> => {
  if (Platform.OS === 'web') {
    return { scheduled: false, reason: 'unsupported' };
  }

  const fireAt = getTaskReminderFireAt(task.nextOccurrenceDate, task.reminderMinutes);
  if (fireAt === null) {
    return { scheduled: false, reason: 'none' };
  }

  if (fireAt <= Date.now()) {
    return { scheduled: false, reason: 'past' };
  }

  const granted = await ensureTaskReminderPermissions();
  if (!granted) {
    return { scheduled: false, reason: 'permission_denied' };
  }

  try {
    await ensureAndroidChannel();
    await cancelTaskReminder(task.id);

    const dueLabel = new Date(task.nextOccurrenceDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const body = task.description?.trim()
      ? task.description.trim()
      : subjectLabel
        ? `${subjectLabel} · due ${dueLabel}`
        : `Due ${dueLabel}`;

    await Notifications.scheduleNotificationAsync({
      identifier: `${TASK_REMINDER_PREFIX}${task.id}`,
      content: {
        title: task.title,
        body,
        data: { taskId: task.id, type: 'task_reminder' },
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
      },
    });

    return { scheduled: true, fireAt };
  } catch (error) {
    console.warn('Failed to schedule task reminder', error);
    return { scheduled: false, reason: 'error' };
  }
};

export const reconcileTaskReminders = async (
  tasks: Array<Pick<TaskRecord, 'id' | 'title' | 'description' | 'nextOccurrenceDate' | 'reminderMinutes'>>,
  subjectLabel?: string,
) => {
  for (const task of tasks) {
    if (task.reminderMinutes === null || task.reminderMinutes === undefined) {
      continue;
    }
    try {
      await scheduleTaskReminder(task, subjectLabel);
    } catch {
      // Silently skip — individual failures shouldn't block the rest
    }
  }
};
