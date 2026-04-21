export interface SqliteMigration {
  id: number;
  name: string;
  statements: string[];
}

export const LOCAL_CACHE_MIGRATIONS: SqliteMigration[] = [
  {
    id: 1,
    name: 'init-cache-tables',
    statements: [
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS analysis_status_cache (
        analysis_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS analysis_report_cache (
        analysis_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS analysis_history_cache (
        analysis_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
    ],
  },
  {
    id: 2,
    name: 'indexes-and-pragmas',
    statements: [
      'CREATE INDEX IF NOT EXISTS idx_status_updated_at ON analysis_status_cache(updated_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_report_updated_at ON analysis_report_cache(updated_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_history_updated_at ON analysis_history_cache(updated_at DESC);',
      'PRAGMA journal_mode = WAL;',
      'PRAGMA synchronous = NORMAL;',
      'PRAGMA foreign_keys = ON;',
    ],
  },
  {
    id: 3,
    name: 'upload-queue',
    statements: [
      `CREATE TABLE IF NOT EXISTS analysis_upload_queue (
        analysis_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      'CREATE INDEX IF NOT EXISTS idx_upload_queue_updated_at ON analysis_upload_queue(updated_at DESC);',
    ],
  },
];
