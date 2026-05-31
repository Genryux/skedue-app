import type { SQLiteDatabase } from 'expo-sqlite';

type Migration = {
  version: number;
  up: (db: SQLiteDatabase) => Promise<void>;
};

export const migrations: Migration[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );
        CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          code TEXT,
          instructor TEXT,
          section TEXT,
          days TEXT,
          startTime TEXT,
          endTime TEXT,
          location TEXT,
          createdAt INTEGER NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE subjects ADD COLUMN term TEXT;
      `);
    },
  },
  {
    version: 3,
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          subjectId TEXT NOT NULL,
          title TEXT NOT NULL,
          color TEXT NOT NULL,
          createdAt INTEGER NOT NULL,
          FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    version: 4,
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          subjectId TEXT NOT NULL,
          folderId TEXT,
          title TEXT NOT NULL,
          contentHtml TEXT NOT NULL,
          contentText TEXT NOT NULL,
          isPinned INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE,
          FOREIGN KEY(folderId) REFERENCES folders(id) ON DELETE SET NULL
        );
      `);
    },
  },
  {
    version: 5,
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE folders ADD COLUMN isPinned INTEGER NOT NULL DEFAULT 0;
      `);
    },
  },
  {
    version: 6,
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE subjects ADD COLUMN isArchived INTEGER NOT NULL DEFAULT 0;
      `);
    },
  },
];
