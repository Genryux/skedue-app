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
  {
    version: 7,
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE subjects ADD COLUMN isPinned INTEGER NOT NULL DEFAULT 0;
      `);
    },
  },
  {
    version: 8,
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          subjectId TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          dueAt INTEGER NOT NULL,
          repeat TEXT NOT NULL DEFAULT 'none',
          reminderMinutes INTEGER,
          isCompleted INTEGER NOT NULL DEFAULT 0,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
        );
      `);
    },
  },
  {
    version: 9,
    up: async (db) => {
      // 1. Create task_completions
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS task_completions (
          id TEXT PRIMARY KEY,
          taskId TEXT NOT NULL,
          occurrenceDate INTEGER NOT NULL,
          completedAt INTEGER NOT NULL,
          FOREIGN KEY(taskId) REFERENCES tasks(id) ON DELETE CASCADE
        );
      `);

      // 2. Add new columns to tasks
      await db.execAsync(`
        ALTER TABLE tasks ADD COLUMN repeatType TEXT NOT NULL DEFAULT 'none';
        ALTER TABLE tasks ADD COLUMN repeatInterval INTEGER;
        ALTER TABLE tasks ADD COLUMN repeatDays TEXT;
        ALTER TABLE tasks ADD COLUMN startDate INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE tasks ADD COLUMN endDate INTEGER;
        ALTER TABLE tasks ADD COLUMN nextOccurrenceDate INTEGER NOT NULL DEFAULT 0;
      `);

      // 3. Migrate data from old columns to new columns
      await db.execAsync(`
        UPDATE tasks SET 
          repeatType = repeat,
          startDate = dueAt,
          nextOccurrenceDate = dueAt;
      `);

      // 4. Mark existing completed tasks as completed by inserting into task_completions and setting nextOccurrenceDate to far future 
      // (or let's just let them be, their nextOccurrenceDate is already in the past, but we should create a completion record)
      await db.execAsync(`
        INSERT INTO task_completions (id, taskId, occurrenceDate, completedAt)
        SELECT id || '-migration', id, dueAt, updatedAt
        FROM tasks
        WHERE isCompleted = 1;
      `);
      
      // Update nextOccurrenceDate for completed non-repeating tasks so they don't show up as pending
      await db.execAsync(`
        UPDATE tasks 
        SET nextOccurrenceDate = 4102444800000 -- Year 2100, effectively "done" for non-repeating
        WHERE isCompleted = 1 AND repeatType = 'none';
      `);
    },
  },
  {
    version: 10,
    up: async (db) => {
      await db.execAsync(`
        ALTER TABLE tasks ADD COLUMN priority TEXT;
        ALTER TABLE tasks ADD COLUMN category TEXT;
      `);
    },
  },
];
