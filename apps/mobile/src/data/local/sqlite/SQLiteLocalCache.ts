import * as SQLite from 'expo-sqlite';

import { appConfig } from '../../../config/appConfig';
import type { AnalysisReport, AnalysisStatus, HistoryItem, QueuedUploadItem } from '../../../api/types';
import type { LocalCacheStore } from '../types';
import { LOCAL_CACHE_MIGRATIONS } from './migrations';

interface MigrationRow {
  id: number;
}

interface PayloadRow {
  payload: string;
}

const nowIso = (): string => new Date().toISOString();

const parseJson = <T>(payload: string | null | undefined): T | null => {
  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
};

export class SQLiteLocalCache implements LocalCacheStore {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private initialized = false;

  private getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
    if (!this.databasePromise) {
      this.databasePromise = SQLite.openDatabaseAsync(appConfig.localStorage.sqliteDbName);
    }

    return this.databasePromise;
  };

  public initialize = async (): Promise<void> => {
    if (this.initialized) {
      return;
    }

    const database = await this.getDatabase();
    await database.execAsync(
      'CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
    );

    const appliedRows = await database.getAllAsync<MigrationRow>('SELECT id FROM schema_migrations;');
    const applied = new Set(appliedRows.map((row) => row.id));

    for (const migration of LOCAL_CACHE_MIGRATIONS) {
      if (applied.has(migration.id)) {
        continue;
      }

      await database.execAsync('BEGIN TRANSACTION;');
      try {
        for (const statement of migration.statements) {
          await database.execAsync(statement);
        }

        await database.runAsync(
          'INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?);',
          migration.id,
          migration.name,
          nowIso(),
        );

        await database.execAsync('COMMIT;');
      } catch (error) {
        await database.execAsync('ROLLBACK;');
        throw error;
      }
    }

    this.initialized = true;
  };

  public saveStatus = async (status: AnalysisStatus): Promise<void> => {
    await this.initialize();
    const database = await this.getDatabase();

    await database.runAsync(
      'INSERT OR REPLACE INTO analysis_status_cache (analysis_id, payload, updated_at) VALUES (?, ?, ?);',
      status.analysisId,
      JSON.stringify(status),
      nowIso(),
    );
  };

  public getStatus = async (analysisId: string): Promise<AnalysisStatus | null> => {
    await this.initialize();
    const database = await this.getDatabase();

    const row = await database.getFirstAsync<PayloadRow>(
      'SELECT payload FROM analysis_status_cache WHERE analysis_id = ? LIMIT 1;',
      analysisId,
    );

    return parseJson<AnalysisStatus>(row?.payload);
  };

  public saveReport = async (report: AnalysisReport): Promise<void> => {
    await this.initialize();
    const database = await this.getDatabase();

    await database.runAsync(
      'INSERT OR REPLACE INTO analysis_report_cache (analysis_id, payload, updated_at) VALUES (?, ?, ?);',
      report.analysisId,
      JSON.stringify(report),
      nowIso(),
    );
  };

  public getReport = async (analysisId: string): Promise<AnalysisReport | null> => {
    await this.initialize();
    const database = await this.getDatabase();

    const row = await database.getFirstAsync<PayloadRow>(
      'SELECT payload FROM analysis_report_cache WHERE analysis_id = ? LIMIT 1;',
      analysisId,
    );

    return parseJson<AnalysisReport>(row?.payload);
  };

  public replaceHistory = async (items: HistoryItem[]): Promise<void> => {
    await this.initialize();
    const database = await this.getDatabase();

    await database.execAsync('BEGIN TRANSACTION;');
    try {
      await database.execAsync('DELETE FROM analysis_history_cache;');

      for (const item of items) {
        await database.runAsync(
          'INSERT OR REPLACE INTO analysis_history_cache (analysis_id, payload, updated_at) VALUES (?, ?, ?);',
          item.analysisId,
          JSON.stringify(item),
          nowIso(),
        );
      }

      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;');
      throw error;
    }
  };

  public getHistory = async (): Promise<HistoryItem[]> => {
    await this.initialize();
    const database = await this.getDatabase();

    const rows = await database.getAllAsync<PayloadRow>(
      'SELECT payload FROM analysis_history_cache ORDER BY updated_at DESC;',
    );

    return rows
      .map((row) => parseJson<HistoryItem>(row.payload))
      .filter((item): item is HistoryItem => Boolean(item));
  };

  public upsertHistoryItem = async (item: HistoryItem): Promise<void> => {
    await this.initialize();
    const database = await this.getDatabase();

    await database.runAsync(
      'INSERT OR REPLACE INTO analysis_history_cache (analysis_id, payload, updated_at) VALUES (?, ?, ?);',
      item.analysisId,
      JSON.stringify(item),
      nowIso(),
    );
  };

  public saveQueuedUpload = async (item: QueuedUploadItem): Promise<void> => {
    await this.initialize();
    const database = await this.getDatabase();

    await database.runAsync(
      'INSERT OR REPLACE INTO analysis_upload_queue (analysis_id, payload, updated_at) VALUES (?, ?, ?);',
      item.analysisId,
      JSON.stringify(item),
      nowIso(),
    );
  };

  public getQueuedUpload = async (analysisId: string): Promise<QueuedUploadItem | null> => {
    await this.initialize();
    const database = await this.getDatabase();

    const row = await database.getFirstAsync<PayloadRow>(
      'SELECT payload FROM analysis_upload_queue WHERE analysis_id = ? LIMIT 1;',
      analysisId,
    );

    return parseJson<QueuedUploadItem>(row?.payload);
  };

  public getQueuedUploads = async (): Promise<QueuedUploadItem[]> => {
    await this.initialize();
    const database = await this.getDatabase();

    const rows = await database.getAllAsync<PayloadRow>(
      'SELECT payload FROM analysis_upload_queue ORDER BY updated_at ASC;',
    );

    return rows
      .map((row) => parseJson<QueuedUploadItem>(row.payload))
      .filter((item): item is QueuedUploadItem => Boolean(item));
  };

  public clearAll = async (): Promise<void> => {
    await this.initialize();
    const database = await this.getDatabase();

    await database.execAsync('BEGIN TRANSACTION;');
    try {
      await database.execAsync('DELETE FROM analysis_status_cache;');
      await database.execAsync('DELETE FROM analysis_report_cache;');
      await database.execAsync('DELETE FROM analysis_history_cache;');
      await database.execAsync('DELETE FROM analysis_upload_queue;');
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;');
      throw error;
    }
  };
}
