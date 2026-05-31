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
  await db.runAsync('DELETE FROM folders WHERE id = ?', [folderId]);
};

export const moveNotesToFolder = async (sourceFolderId: string, targetFolderId: string | null): Promise<void> => {
  const db = await getDb();
  await db.runAsync('UPDATE notes SET folderId = ? WHERE folderId = ?', [targetFolderId, sourceFolderId]);
};

const parseBoolean = (value: number | null | undefined) => value === 1;

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
      SET folderId = ?, title = ?, contentHtml = ?, contentText = ?, isPinned = ?, updatedAt = ?
      WHERE id = ?
    `,
    [
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
