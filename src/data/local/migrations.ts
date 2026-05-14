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
];
