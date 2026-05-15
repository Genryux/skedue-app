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
  createdAt: number;
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
  createdAt: number;
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
  const rows = await db.getAllAsync<SubjectRow>('SELECT * FROM subjects ORDER BY createdAt ASC');

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
    createdAt: row.createdAt,
  }));
};

export const insertSubject = async (
  subject: Omit<SubjectRecord, 'id' | 'createdAt'>
): Promise<SubjectRecord> => {
  const db = await getDb();
  const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const createdAt = Date.now();
  const days = subject.days ? JSON.stringify(subject.days) : null;

  await db.runAsync(
    'INSERT INTO subjects (id, title, code, instructor, term, days, startTime, endTime, location, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
    createdAt,
  };
};
