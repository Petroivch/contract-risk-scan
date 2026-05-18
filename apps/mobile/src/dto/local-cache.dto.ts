export interface LocalCacheStore {
  initialize(): Promise<void>;
  clearAll(): Promise<void>;
}
