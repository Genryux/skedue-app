import * as SQLite from 'expo-sqlite';
import { migrations } from './migrations';

type SubjectRow = {
  id: string;
  title: string;
  code: string | null;
  instructor: string | null;
  term: string | null;
  days: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  isArchived: number;
  isPinned: number;
  createdAt: number;
};

type FolderRow = {
  id: string;
  subjectId: string;
  title: string;
  color: string;
  isPinned: number;
  createdAt: number;
};

type NoteRow = {
  id: string;
  subjectId: string;
  folderId: string | null;
  title: string;
  contentHtml: string;
  contentText: string;
  isPinned: number;
  createdAt: number;
  updatedAt: number;
};

type TaskRow = {
  id: string;
  subjectId: string;
  title: string;
  description: string | null;
  dueAt: number | null;
  repeat: string; // DEPRECATED
  reminderMinutes: number | null;
  isCompleted: number; // DEPRECATED
  createdAt: number;
  updatedAt: number;
  repeatType: string;
  repeatInterval: number | null;
  repeatDays: string | null;
  startDate: number | null;
  endDate: number | null;
  nextOccurrenceDate: number;
  priority: string | null;
  category: string | null;
};

type TaskCompletionRow = {
  id: string;
  taskId: string;
  occurrenceDate: number;
  completedAt: number;
};

type TaskOccurrenceExceptionRow = {
  id: string;
  taskId: string;
  occurrenceDate: number;
  status: 'completed' | 'deleted';
  completedAt: number | null;
};

export type SubjectRecord = {
  id: string;
  title: string;
  code?: string | null;
  instructor?: string | null;
  term?: string | null;
  days?: string[];
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: number;
};

export type FolderRecord = {
  id: string;
  subjectId: string;
  title: string;
  color: string;
  isPinned: boolean;
  createdAt: number;
};

export type NoteRecord = {
  id: string;
  subjectId: string;
  folderId?: string | null;
  title: string;
  contentHtml: string;
  contentText: string;
  isPinned: boolean;
  createdAt: number;
  updatedAt: number;
};

export type TaskRecord = {
  id: string;
  subjectId: string;
  title: string;
  description?: string | null;
  dueAt?: number | null;
  reminderMinutes?: number | null;
  repeatType: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  repeatInterval?: number | null;
  repeatDays?: string[] | null;
  startDate?: number | null;
  endDate?: number | null;
  nextOccurrenceDate: number;
  priority?: string | null;
  category?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type TaskCompletionRecord = {
  id: string;
  taskId: string;
  occurrenceDate: number;
  completedAt: number;
};

export type TaskOccurrenceExceptionRecord = {
  id: string;
  taskId: string;
  occurrenceDate: number;
  status: 'completed' | 'deleted';
  completedAt: number | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getDb = async () => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('skedue.db');
  }

  return dbPromise;
};

export const initDb = async () => {
  const db = await getDb();

  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = OFF;');
  await db.execAsync('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL);');

  const current = await db.getFirstAsync<{ version: number | null }>(
    'SELECT MAX(version) as version FROM schema_migrations'
  );
  const currentVersion = current?.version ?? 0;

  const pending = migrations.filter((migration) => migration.version > currentVersion);

  for (const migration of pending) {
    await migration.up(db);
    await db.runAsync('INSERT INTO schema_migrations (version) VALUES (?)', [migration.version]);
  }

  // Repair data corrupted by a previous backup import bug
  // where JS arrays were inserted directly instead of JSON strings
  await db.execAsync("UPDATE tasks SET repeatDays = NULL WHERE repeatDays IS NOT NULL AND substr(repeatDays, 1, 1) != '['");
  await db.execAsync("UPDATE subjects SET days = NULL WHERE days IS NOT NULL AND substr(days, 1, 1) != '['");
};

export const getMetaValue = async (key: string) => {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_meta WHERE key = ?', [key]);
  return row?.value ?? null;
};

export const setMetaValue = async (key: string, value: string) => {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
};

const parseDays = (value: string | null) => {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const getSubjects = async (): Promise<SubjectRecord[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<SubjectRow>('SELECT * FROM subjects ORDER BY isPinned DESC, createdAt ASC');

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      code: row.code ?? undefined,
      instructor: row.instructor ?? undefined,
      term: row.term ?? undefined,
      days: parseDays(row.days),
      startTime: row.startTime ?? undefined,
      endTime: row.endTime ?? undefined,
      location: row.location ?? undefined,
      isArchived: parseBoolean(row.isArchived),
      isPinned: parseBoolean(row.isPinned),
      createdAt: row.createdAt,
    }));
};

export const insertSubject = async (
  subject: Omit<SubjectRecord, 'id' | 'createdAt'> & { isArchived?: boolean; isPinned?: boolean }
): Promise<SubjectRecord> => {
  const db = await getDb();
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const createdAt = Date.now();
  const days = subject.days ? JSON.stringify(subject.days) : null;

  await db.runAsync(
    'INSERT INTO subjects (id, title, code, instructor, term, days, startTime, endTime, location, isArchived, isPinned, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      subject.title,
      subject.code ?? null,
      subject.instructor ?? null,
      subject.term ?? null,
      days,
      subject.startTime ?? null,
      subject.endTime ?? null,
      subject.location ?? null,
      subject.isArchived ? 1 : 0,
      subject.isPinned ? 1 : 0,
      createdAt,
    ]
  );

  return {
    id,
    title: subject.title,
    code: subject.code ?? undefined,
    instructor: subject.instructor ?? undefined,
    term: subject.term ?? undefined,
    days: subject.days,
    startTime: subject.startTime ?? undefined,
    endTime: subject.endTime ?? undefined,
    location: subject.location ?? undefined,
    isArchived: subject.isArchived ?? false,
    isPinned: subject.isPinned ?? false,
    createdAt,
  };
};

export const updateSubject = async (
  subjectId: string,
  subject: Partial<Omit<SubjectRecord, 'id' | 'createdAt'>>
): Promise<void> => {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (subject.title !== undefined) {
    fields.push('title = ?');
    values.push(subject.title);
  }
  if (subject.code !== undefined) {
    fields.push('code = ?');
    values.push(subject.code ?? null);
  }
  if (subject.instructor !== undefined) {
    fields.push('instructor = ?');
    values.push(subject.instructor ?? null);
  }
  if (subject.term !== undefined) {
    fields.push('term = ?');
    values.push(subject.term ?? null);
  }
  if (subject.days !== undefined) {
    fields.push('days = ?');
    values.push(subject.days ? JSON.stringify(subject.days) : null);
  }
  if (subject.startTime !== undefined) {
    fields.push('startTime = ?');
    values.push(subject.startTime ?? null);
  }
  if (subject.endTime !== undefined) {
    fields.push('endTime = ?');
    values.push(subject.endTime ?? null);
  }
  if (subject.location !== undefined) {
    fields.push('location = ?');
    values.push(subject.location ?? null);
  }
  if (subject.isArchived !== undefined) {
    fields.push('isArchived = ?');
    values.push(subject.isArchived ? 1 : 0);
  }
  if (subject.isPinned !== undefined) {
    fields.push('isPinned = ?');
    values.push(subject.isPinned ? 1 : 0);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(subjectId);
  await db.runAsync(`UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`, values);
};

export const deleteSubject = async (subjectId: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync('DELETE FROM task_occurrence_exceptions WHERE taskId IN (SELECT id FROM tasks WHERE subjectId = ?)', [subjectId]);
  await db.runAsync('DELETE FROM task_completions WHERE taskId IN (SELECT id FROM tasks WHERE subjectId = ?)', [subjectId]);
  await db.runAsync('DELETE FROM tasks WHERE subjectId = ?', [subjectId]);
  await db.runAsync('DELETE FROM notes WHERE subjectId = ?', [subjectId]);
  await db.runAsync('DELETE FROM folders WHERE subjectId = ?', [subjectId]);
  await db.runAsync('DELETE FROM subjects WHERE id = ?', [subjectId]);
};

export const getFoldersBySubjectId = async (subjectId: string): Promise<FolderRecord[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<FolderRow>(
    'SELECT * FROM folders WHERE subjectId = ? ORDER BY isPinned DESC, createdAt ASC',
    [subjectId]
  );

  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    color: row.color,
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
  }));
};

export const getFolderById = async (folderId: string): Promise<FolderRecord | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<FolderRow>('SELECT * FROM folders WHERE id = ?', [folderId]);
  if (!row) return null;
  return {
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    color: row.color,
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
  };
};

export const getNotesByFolderId = async (folderId: string): Promise<NoteRecord[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<NoteRow>(
    `
      SELECT *
      FROM notes
      WHERE folderId = ?
      ORDER BY isPinned DESC, updatedAt DESC, createdAt DESC
    `,
    [folderId]
  );
  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subjectId,
    folderId: row.folderId,
    title: row.title,
    contentHtml: row.contentHtml,
    contentText: row.contentText,
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

export const getSubjectById = async (subjectId: string): Promise<SubjectRecord | null> => {
  const db = await getDb();
  const row = await db.getFirstAsync<SubjectRow>('SELECT * FROM subjects WHERE id = ?', [subjectId]);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    code: row.code ?? undefined,
    instructor: row.instructor ?? undefined,
    term: row.term ?? undefined,
    days: parseDays(row.days),
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    location: row.location ?? undefined,
    isArchived: parseBoolean(row.isArchived),
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
  };
};

export const insertFolder = async (folder: Omit<FolderRecord, 'id' | 'createdAt'>): Promise<FolderRecord> => {
  const db = await getDb();
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const createdAt = Date.now();

  await db.runAsync(
    'INSERT INTO folders (id, subjectId, title, color, isPinned, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [id, folder.subjectId, folder.title, folder.color, folder.isPinned ? 1 : 0, createdAt]
  );

  return {
    id,
    subjectId: folder.subjectId,
    title: folder.title,
    color: folder.color,
    isPinned: folder.isPinned,
    createdAt,
  };
};

export const updateFolder = async (
  folderId: string,
  updates: { title?: string; color?: string; isPinned?: boolean }
): Promise<FolderRecord> => {
  const db = await getDb();
  const sets: string[] = [];
  const params: any[] = [];

  if (updates.title !== undefined) {
    sets.push('title = ?');
    params.push(updates.title);
  }
  if (updates.color !== undefined) {
    sets.push('color = ?');
    params.push(updates.color);
  }
  if (updates.isPinned !== undefined) {
    sets.push('isPinned = ?');
    params.push(updates.isPinned ? 1 : 0);
  }

  if (sets.length === 0) {
    const existing = await getFolderById(folderId);
    if (!existing) throw new Error('Folder not found');
    return existing;
  }

  params.push(folderId);
  await db.runAsync(`UPDATE folders SET ${sets.join(', ')} WHERE id = ?`, params);

  const row = await db.getFirstAsync<FolderRow>('SELECT * FROM folders WHERE id = ?', [folderId]);
  if (!row) throw new Error('Folder not found after update');
  return {
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    color: row.color,
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
  };
};

export const deleteFolder = async (folderId: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE folderId = ?', [folderId]);
  await db.runAsync('DELETE FROM folders WHERE id = ?', [folderId]);
};

export const moveNotesToFolder = async (sourceFolderId: string, targetFolderId: string | null): Promise<void> => {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET folderId = ? WHERE folderId = ?', [targetFolderId, sourceFolderId]);
};

const parseBoolean = (value: number | null | undefined) => value === 1;

const safeParseJSONArray = (value: string | null): string[] | undefined => {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const getTasksBySubjectId = async (subjectId: string): Promise<TaskRecord[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<TaskRow>(
    `
      SELECT *
      FROM tasks
      WHERE subjectId = ?
      ORDER BY nextOccurrenceDate ASC, createdAt ASC
    `,
    [subjectId]
  );

  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    description: row.description ?? undefined,
    dueAt: row.dueAt ?? undefined,
    reminderMinutes: row.reminderMinutes ?? undefined,
    repeatType: row.repeatType as any,
    repeatInterval: row.repeatInterval ?? undefined,
    repeatDays: safeParseJSONArray(row.repeatDays),
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    nextOccurrenceDate: row.nextOccurrenceDate,
    priority: row.priority ?? undefined,
    category: row.category ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

export const getAllTasks = async (): Promise<TaskRecord[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<TaskRow>(
    `
      SELECT *
      FROM tasks
      ORDER BY nextOccurrenceDate ASC, createdAt ASC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subjectId,
    title: row.title,
    description: row.description ?? undefined,
    dueAt: row.dueAt ?? undefined,
    reminderMinutes: row.reminderMinutes ?? undefined,
    repeatType: row.repeatType as any,
    repeatInterval: row.repeatInterval ?? undefined,
    repeatDays: safeParseJSONArray(row.repeatDays),
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
    nextOccurrenceDate: row.nextOccurrenceDate,
    priority: row.priority ?? undefined,
    category: row.category ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

export const insertTask = async (
  task: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<TaskRecord> => {
  const db = await getDb();
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const createdAt = Date.now();
  const updatedAt = createdAt;

  await db.runAsync(
    `
      INSERT INTO tasks (
        id,
        subjectId,
        title,
        description,
        dueAt,
        reminderMinutes,
        repeatType,
        repeatInterval,
        repeatDays,
        startDate,
        endDate,
        nextOccurrenceDate,
        priority,
        category,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      task.subjectId,
      task.title,
      task.description ?? null,
      task.dueAt ?? null,
      task.reminderMinutes ?? null,
      task.repeatType,
      task.repeatInterval ?? null,
      task.repeatDays ? JSON.stringify(task.repeatDays) : null,
      task.startDate ?? null,
      task.endDate ?? null,
      task.nextOccurrenceDate,
      task.priority ?? null,
      task.category ?? null,
      createdAt,
      updatedAt,
    ]
  );

  return {
    id,
    ...task,
    createdAt,
    updatedAt,
  };
};

export const updateTask = async (
  taskId: string,
  updates: Partial<Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> => {
  const db = await getDb();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.subjectId !== undefined) {
    fields.push('subjectId = ?');
    values.push(updates.subjectId);
  }
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description ?? null);
  }
  if (updates.dueAt !== undefined) {
    fields.push('dueAt = ?');
    values.push(updates.dueAt);
  }
  if (updates.reminderMinutes !== undefined) {
    fields.push('reminderMinutes = ?');
    values.push(updates.reminderMinutes ?? null);
  }
  if (updates.repeatType !== undefined) {
    fields.push('repeatType = ?');
    values.push(updates.repeatType);
  }
  if (updates.repeatInterval !== undefined) {
    fields.push('repeatInterval = ?');
    values.push(updates.repeatInterval ?? null);
  }
  if (updates.repeatDays !== undefined) {
    fields.push('repeatDays = ?');
    values.push(updates.repeatDays ? JSON.stringify(updates.repeatDays) : null);
  }
  if (updates.startDate !== undefined) {
    fields.push('startDate = ?');
    values.push(updates.startDate);
  }
  if (updates.endDate !== undefined) {
    fields.push('endDate = ?');
    values.push(updates.endDate ?? null);
  }
  if (updates.nextOccurrenceDate !== undefined) {
    fields.push('nextOccurrenceDate = ?');
    values.push(updates.nextOccurrenceDate);
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?');
    values.push(updates.priority ?? null);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category ?? null);
  }

  if (fields.length === 0) return;

  fields.push('updatedAt = ?');
  values.push(Date.now());

  values.push(taskId);
  await db.runAsync(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
};

export const deleteTask = async (taskId: string): Promise<void> => {
  const db = await getDb();
  await db.runAsync('DELETE FROM task_occurrence_exceptions WHERE taskId = ?', [taskId]);
  await db.runAsync('DELETE FROM task_completions WHERE taskId = ?', [taskId]);
  await db.runAsync('DELETE FROM tasks WHERE id = ?', [taskId]);
};

export const setTaskOccurrenceException = async (
  taskId: string,
  occurrenceDate: number,
  status: 'completed' | 'deleted',
  completedAt?: number
): Promise<void> => {
  const db = await getDb();
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO task_occurrence_exceptions (id, taskId, occurrenceDate, status, completedAt) VALUES (?, ?, ?, ?, ?)`,
    [id, taskId, occurrenceDate, status, completedAt ?? null]
  );
};

export const getTaskOccurrenceExceptions = async (taskIds: string[]): Promise<TaskOccurrenceExceptionRecord[]> => {
  if (taskIds.length === 0) return [];
  const db = await getDb();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<TaskOccurrenceExceptionRow>(
    `SELECT * FROM task_occurrence_exceptions WHERE taskId IN (${placeholders})`,
    taskIds
  );
  return rows.map(r => ({
    id: r.id,
    taskId: r.taskId,
    occurrenceDate: r.occurrenceDate,
    status: r.status,
    completedAt: r.completedAt,
  }));
};

export const deleteTaskOccurrence = async (taskId: string, occurrenceDate: number): Promise<number> => {
  const db = await getDb();
  const exceptionId = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO task_occurrence_exceptions (id, taskId, occurrenceDate, status, completedAt) VALUES (?, ?, ?, ?, ?)`,
    [exceptionId, taskId, occurrenceDate, 'deleted', null]
  );
  const task = await db.getFirstAsync<TaskRow>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (task && task.repeatType !== 'none' && task.nextOccurrenceDate === occurrenceDate) {
    const next = await getNextOccurrenceDate(task, occurrenceDate);
    await db.runAsync(
      'UPDATE tasks SET nextOccurrenceDate = ?, updatedAt = ? WHERE id = ?',
      [next, Date.now(), taskId]
    );
    return next;
  }
  return task?.nextOccurrenceDate ?? 0;
};

export const completeTaskOccurrence = async (taskId: string, occurrenceDate: number, nextOccurrenceDate: number): Promise<void> => {
  const db = await getDb();
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  await db.runAsync(
    `INSERT OR REPLACE INTO task_occurrence_exceptions (id, taskId, occurrenceDate, status, completedAt) VALUES (?, ?, ?, ?, ?)`,
    [id, taskId, occurrenceDate, 'completed', Date.now()]
  );
  await db.runAsync(
    `UPDATE tasks SET nextOccurrenceDate = ?, updatedAt = ? WHERE id = ?`,
    [nextOccurrenceDate, Date.now(), taskId]
  );
};

export const getTaskCompletions = async (taskIds: string[]): Promise<TaskCompletionRecord[]> => {
  if (taskIds.length === 0) return [];
  const db = await getDb();
  const placeholders = taskIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<TaskOccurrenceExceptionRow>(
    `SELECT * FROM task_occurrence_exceptions WHERE taskId IN (${placeholders}) AND status = 'completed'`,
    taskIds
  );
  return rows.map(r => ({
    id: r.id,
    taskId: r.taskId,
    occurrenceDate: r.occurrenceDate,
    completedAt: r.completedAt ?? 0,
  }));
};

export const uncompleteTaskOccurrence = async (taskId: string): Promise<number> => {
  const db = await getDb();
  const lastCompletion = await db.getFirstAsync<TaskOccurrenceExceptionRow>(
    `SELECT * FROM task_occurrence_exceptions WHERE taskId = ? AND status = 'completed' ORDER BY completedAt DESC LIMIT 1`,
    [taskId]
  );
  if (!lastCompletion) return 0;
  const task = await db.getFirstAsync<TaskRow>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (!task) return 0;
  await db.runAsync('DELETE FROM task_occurrence_exceptions WHERE id = ?', [lastCompletion.id]);
  const remainingCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM task_occurrence_exceptions WHERE taskId = ? AND status = 'completed'`,
    [taskId]
  );
  let restoredDate: number;
  if (remainingCount && remainingCount.count === 0 && task.repeatType === 'none') {
    restoredDate = task.startDate ?? Date.now();
  } else {
    restoredDate = lastCompletion.occurrenceDate;
  }
  await db.runAsync(
    'UPDATE tasks SET nextOccurrenceDate = ?, updatedAt = ? WHERE id = ?',
    [restoredDate, Date.now(), taskId]
  );
  return restoredDate;
};

const getNextOccurrenceDate = async (task: TaskRow, afterDate: number): Promise<number> => {
  const { repeatType, repeatInterval, repeatDays, startDate, endDate } = task;
  if (repeatType === 'none' || !startDate) return 4102444800000;
  const baseDate = new Date(startDate);
  let next = new Date(baseDate);
  if (next.getTime() > afterDate) return next.getTime();
  const interval = Math.max(1, repeatInterval || 1);
  const selectedDays = repeatDays
    ? (JSON.parse(repeatDays) as string[])
        .map((day) => ({ su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 }[day.toLowerCase()]))
        .filter((day): day is number => day !== undefined)
        .sort()
    : [];

  while (next.getTime() <= afterDate) {
    if (repeatType === 'daily') {
      next.setDate(next.getDate() + interval);
      if (selectedDays.length > 0) {
        while (!selectedDays.includes(next.getDay())) {
          next.setDate(next.getDate() + 1);
        }
      }
    } else if (repeatType === 'weekly') {
      if (selectedDays.length > 0) {
        const currentDay = next.getDay();
        let nextDay = selectedDays.find((day) => day > currentDay);
        if (nextDay !== undefined) {
          next.setDate(next.getDate() + (nextDay - currentDay));
        } else {
          nextDay = selectedDays[0];
          next.setDate(next.getDate() + (7 - currentDay) + nextDay + (interval - 1) * 7);
        }
      } else {
        next.setDate(next.getDate() + 7 * interval);
      }
    } else if (repeatType === 'monthly') {
      next.setMonth(next.getMonth() + interval);
    } else if (repeatType === 'yearly') {
      next.setFullYear(next.getFullYear() + interval);
    } else break;
  }
  if (endDate && next.getTime() > endDate) return 4102444800000;
  return next.getTime();
};

export const getAllNotes = async (): Promise<NoteRecord[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<NoteRow>(
    'SELECT * FROM notes ORDER BY isPinned DESC, updatedAt DESC, createdAt DESC'
  );

  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subjectId,
    folderId: row.folderId,
    title: row.title,
    contentHtml: row.contentHtml,
    contentText: row.contentText,
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

export const getNotesBySubjectId = async (subjectId: string): Promise<NoteRecord[]> => {
  const db = await getDb();
  const rows = await db.getAllAsync<NoteRow>(
    `
      SELECT *
      FROM notes
      WHERE subjectId = ?
      ORDER BY isPinned DESC, updatedAt DESC, createdAt DESC
    `,
    [subjectId]
  );

  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subjectId,
    folderId: row.folderId,
    title: row.title,
    contentHtml: row.contentHtml,
    contentText: row.contentText,
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

export const insertNote = async (
  note: Omit<NoteRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<NoteRecord> => {
  const db = await getDb();
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const createdAt = Date.now();
  const updatedAt = createdAt;

  await db.runAsync(
    `
      INSERT INTO notes (
        id,
        subjectId,
        folderId,
        title,
        contentHtml,
        contentText,
        isPinned,
        createdAt,
        updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      note.subjectId,
      note.folderId ?? null,
      note.title,
      note.contentHtml,
      note.contentText,
      note.isPinned ? 1 : 0,
      createdAt,
      updatedAt,
    ]
  );

  return {
    id,
    subjectId: note.subjectId,
    folderId: note.folderId ?? null,
    title: note.title,
    contentHtml: note.contentHtml,
    contentText: note.contentText,
    isPinned: note.isPinned,
    createdAt,
    updatedAt,
  };
};

export const findRecentMatchingNote = async (
  note: Omit<NoteRecord, 'id' | 'createdAt' | 'updatedAt'>,
  windowMs = 5000
): Promise<NoteRecord | null> => {
  const db = await getDb();
  const since = Date.now() - windowMs;

  const row = await db.getFirstAsync<NoteRow>(
    `
      SELECT *
      FROM notes
      WHERE subjectId = ?
        AND (folderId = ? OR (folderId IS NULL AND ? IS NULL))
        AND title = ?
        AND contentHtml = ?
        AND contentText = ?
        AND isPinned = ?
        AND createdAt >= ?
      ORDER BY createdAt DESC
      LIMIT 1
    `,
    [
      note.subjectId,
      note.folderId ?? null,
      note.folderId ?? null,
      note.title,
      note.contentHtml,
      note.contentText,
      note.isPinned ? 1 : 0,
      since,
    ]
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    subjectId: row.subjectId,
    folderId: row.folderId,
    title: row.title,
    contentHtml: row.contentHtml,
    contentText: row.contentText,
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const updateNote = async (
  noteId: string,
  note: Omit<NoteRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<NoteRecord> => {
  const db = await getDb();
  const updatedAt = Date.now();

  await db.runAsync(
    `
      UPDATE notes
      SET subjectId = ?, folderId = ?, title = ?, contentHtml = ?, contentText = ?, isPinned = ?, updatedAt = ?
      WHERE id = ?
    `,
    [
      note.subjectId,
      note.folderId ?? null,
      note.title,
      note.contentHtml,
      note.contentText,
      note.isPinned ? 1 : 0,
      updatedAt,
      noteId,
    ]
  );

  const row = await db.getFirstAsync<NoteRow>('SELECT * FROM notes WHERE id = ?', [noteId]);

  if (!row) {
    throw new Error('Note not found after update');
  }

  return {
    id: row.id,
    subjectId: row.subjectId,
    folderId: row.folderId,
    title: row.title,
    contentHtml: row.contentHtml,
    contentText: row.contentText,
    isPinned: parseBoolean(row.isPinned),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const deleteNote = async (noteId: string) => {
  const db = await getDb();
  await db.runAsync('DELETE FROM notes WHERE id = ?', [noteId]);
};

export const getAllFolders = async (): Promise<FolderRow[]> => {
  const db = await getDb();
  return db.getAllAsync<FolderRow>('SELECT * FROM folders ORDER BY createdAt ASC');
};

export const getAllTaskOccurrenceExceptions = async (): Promise<TaskOccurrenceExceptionRow[]> => {
  const db = await getDb();
  return db.getAllAsync<TaskOccurrenceExceptionRow>('SELECT * FROM task_occurrence_exceptions');
};

export const getAllAppMeta = async (): Promise<Array<{ key: string; value: string }>> => {
  const db = await getDb();
  return db.getAllAsync<{ key: string; value: string }>('SELECT * FROM app_meta');
};

type BackupImportData = {
  appMeta: Array<{ key: string; value: string }>;
  subjects: any[];
  folders: any[];
  notes: any[];
  tasks: any[];
  taskOccurrenceExceptions: any[];
};

export const clearAndImportBackup = async (data: BackupImportData): Promise<void> => {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION');
  try {
    await db.execAsync('DELETE FROM task_occurrence_exceptions');
    await db.execAsync('DELETE FROM task_completions');
    await db.execAsync('DELETE FROM tasks');
    await db.execAsync('DELETE FROM notes');
    await db.execAsync('DELETE FROM folders');
    await db.execAsync('DELETE FROM subjects');
    await db.execAsync('DELETE FROM app_meta');

    for (const row of data.appMeta) {
      await db.runAsync('INSERT INTO app_meta (key, value) VALUES (?, ?)', [row.key, row.value]);
    }

    for (const row of data.subjects) {
      await db.runAsync(
        `INSERT INTO subjects (id, title, code, instructor, section, days, startTime, endTime, location, createdAt, term, isArchived, isPinned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.title, row.code ?? null, row.instructor ?? null, row.section ?? null, row.days ? JSON.stringify(row.days) : null, row.startTime ?? null, row.endTime ?? null, row.location ?? null, row.createdAt, row.term ?? null, row.isArchived ? 1 : 0, row.isPinned ? 1 : 0]
      );
    }

    for (const row of data.folders) {
      await db.runAsync(
        'INSERT INTO folders (id, subjectId, title, color, isPinned, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [row.id, row.subjectId, row.title, row.color, row.isPinned ? 1 : 0, row.createdAt]
      );
    }

    for (const row of data.notes) {
      await db.runAsync(
        `INSERT INTO notes (id, subjectId, folderId, title, contentHtml, contentText, isPinned, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.subjectId, row.folderId ?? null, row.title, row.contentHtml ?? '', row.contentText ?? '', row.isPinned ? 1 : 0, row.createdAt, row.updatedAt ?? row.createdAt]
      );
    }

    for (const row of data.tasks) {
      await db.runAsync(
        `INSERT INTO tasks (id, subjectId, title, description, dueAt, repeat, reminderMinutes, isCompleted, createdAt, updatedAt, repeatType, repeatInterval, repeatDays, startDate, endDate, nextOccurrenceDate, priority, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.subjectId, row.title, row.description ?? null, row.dueAt ?? null, row.repeat ?? 'none', row.reminderMinutes ?? null, row.isCompleted ? 1 : 0, row.createdAt, row.updatedAt ?? row.createdAt, row.repeatType ?? 'none', row.repeatInterval ?? null, row.repeatDays ? JSON.stringify(row.repeatDays) : null, row.startDate ?? null, row.endDate ?? null, row.nextOccurrenceDate, row.priority ?? null, row.category ?? null]
      );
    }

    for (const row of data.taskOccurrenceExceptions) {
      await db.runAsync(
        'INSERT INTO task_occurrence_exceptions (id, taskId, occurrenceDate, status, completedAt) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.taskId, row.occurrenceDate, row.status, row.completedAt ?? null]
      );
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
};

export const clearAllData = async (): Promise<void> => {
  const db = await getDb();
  await db.execAsync('DELETE FROM task_occurrence_exceptions');
  await db.execAsync('DELETE FROM task_completions');
  await db.execAsync('DELETE FROM tasks');
  await db.execAsync('DELETE FROM notes');
  await db.execAsync('DELETE FROM folders');
  await db.execAsync('DELETE FROM subjects');
  await db.execAsync('DELETE FROM app_meta');
};
