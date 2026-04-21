import { appConfig } from './appConfig';

export const featureFlags = {
  localFirstCache: appConfig.featureFlags.enableLocalFirstCache,
  sqliteCache: appConfig.featureFlags.enableSQLiteCache,
  fileCache: appConfig.featureFlags.enableFileCache,
} as const;
