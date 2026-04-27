import type { LocalCacheStore } from '../types';

export class SQLiteLocalCache implements LocalCacheStore {
  // Mobile runtime stays memory-only; this class intentionally does not create a SQLite file.
  public initialize = async (): Promise<void> => {};

  public clearAll = async (): Promise<void> => {};
}
