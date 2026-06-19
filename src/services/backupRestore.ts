import { File, Paths, Directory } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import {
  getSubjects,
  getAllNotes,
  getAllTasks,
  getAllFolders,
  getAllTaskOccurrenceExceptions,
  getAllAppMeta,
  clearAndImportBackup,
} from '../data/local/db';

const BACKUP_VERSION = 1;

type BackupData = {
  version: number;
  exportedAt: number;
  appVersion: string;
  data: {
    appMeta: Array<{ key: string; value: string }>;
    subjects: any[];
    folders: any[];
    notes: any[];
    tasks: any[];
    taskOccurrenceExceptions: any[];
  };
};

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const exportBackup = async (): Promise<void> => {
  const [subjects, notes, tasks, folders, taskOccurrenceExceptions, appMeta] = await Promise.all([
    getSubjects(),
    getAllNotes(),
    getAllTasks(),
    getAllFolders(),
    getAllTaskOccurrenceExceptions(),
    getAllAppMeta(),
  ]);

  const backup: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    appVersion: '1.0.0',
    data: {
      appMeta,
      subjects,
      folders,
      notes,
      tasks,
      taskOccurrenceExceptions,
    },
  };

  const json = JSON.stringify(backup, null, 2);
  const filename = `skedue-backup-${formatDate(new Date())}.json`;

  const dir = await (Directory as any).pickDirectoryAsync();
  if (!dir) return;
  const file = dir.createFile(filename, 'application/json');
  file.write(json);
};

export const importBackup = async (): Promise<{ success: boolean; message: string }> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return { success: false, message: 'Import cancelled' };
  }

  const fileUri = result.assets[0].uri;

  let json: string;
  try {
    const file = new File(fileUri);
    json = await file.text();
  } catch (e) {
    console.warn('Backup restore: failed to read file:', fileUri, e);
    return { success: false, message: `Could not read the file: ${e instanceof Error ? e.message : 'Unknown error'}` };
  }

  let backup: any;
  try {
    backup = JSON.parse(json);
  } catch (e) {
    console.warn('Backup restore: JSON parse failed. First 200 chars:', json?.slice(0, 200));
    console.warn('Backup restore: raw length:', json?.length);
    return { success: false, message: 'Invalid JSON file' };
  }

  if (backup.version !== BACKUP_VERSION) {
    return { success: false, message: `Unsupported backup version ${backup.version}. Expected version ${BACKUP_VERSION}.` };
  }

  if (!backup.data || typeof backup.data !== 'object') {
    return { success: false, message: 'Invalid backup format: missing data field' };
  }

  try {
    await clearAndImportBackup({
      appMeta: backup.data.appMeta ?? [],
      subjects: backup.data.subjects ?? [],
      folders: backup.data.folders ?? [],
      notes: backup.data.notes ?? [],
      tasks: backup.data.tasks ?? [],
      taskOccurrenceExceptions: backup.data.taskOccurrenceExceptions ?? [],
    });
  } catch (error) {
    return { success: false, message: `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }

  return { success: true, message: 'Backup restored successfully' };
};
