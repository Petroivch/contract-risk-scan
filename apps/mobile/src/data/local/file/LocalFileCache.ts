import * as FileSystem from 'expo-file-system';

import { appConfig } from '../../../config/appConfig';

const safeCacheRoot = `${FileSystem.cacheDirectory ?? ''}${appConfig.localStorage.fileCacheDir}/`;
const extensionPattern = /\.[A-Za-z0-9]{1,12}$/;

const ensureDirectory = async (): Promise<void> => {
  const directoryInfo = await FileSystem.getInfoAsync(safeCacheRoot);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(safeCacheRoot, { intermediates: true });
  }
};

const resolveSafeExtension = (fileName?: string): string => {
  const match = fileName?.match(extensionPattern);
  return match ? match[0].toLowerCase() : '';
};

export class LocalFileCache {
  public getRootPath = (): string => safeCacheRoot;

  public cacheFile = async (analysisId: string, sourceUri: string, fileName?: string): Promise<string> => {
    await ensureDirectory();

    const target = `${safeCacheRoot}${analysisId}-${Date.now()}${resolveSafeExtension(fileName)}`;
    await FileSystem.copyAsync({
      from: sourceUri,
      to: target,
    });

    return target;
  };

  public clearAll = async (): Promise<void> => {
    const directoryInfo = await FileSystem.getInfoAsync(safeCacheRoot);
    if (directoryInfo.exists) {
      await FileSystem.deleteAsync(safeCacheRoot, { idempotent: true });
    }

    await ensureDirectory();
  };
}
