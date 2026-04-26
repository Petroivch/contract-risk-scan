import * as FileSystem from 'expo-file-system';

import { appConfig } from '../../../config/appConfig';

const documentRoot = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${appConfig.localStorage.fileCacheDir}/`
  : null;
const cacheRoot = FileSystem.cacheDirectory
  ? `${FileSystem.cacheDirectory}${appConfig.localStorage.fileCacheDir}/`
  : null;
const extensionPattern = /\.[A-Za-z0-9]{1,12}$/;

const getActiveRoot = (): string => {
  const root = documentRoot ?? cacheRoot;
  if (!root) {
    throw new Error('No app-private file storage directory is available.');
  }

  return root;
};

const ensureDirectory = async (root: string): Promise<void> => {
  const directoryInfo = await FileSystem.getInfoAsync(root);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  }
};

const resolveSafeExtension = (fileName?: string): string => {
  const match = fileName?.match(extensionPattern);
  return match ? match[0].toLowerCase() : '';
};

export class LocalFileCache {
  public getRootPath = (): string => documentRoot ?? cacheRoot ?? '';

  public cacheFile = async (analysisId: string, sourceUri: string, fileName?: string): Promise<string> => {
    const activeRoot = getActiveRoot();
    await ensureDirectory(activeRoot);

    const target = `${activeRoot}${analysisId}-${Date.now()}${resolveSafeExtension(fileName)}`;
    await FileSystem.copyAsync({
      from: sourceUri,
      to: target,
    });

    return target;
  };

  public clearAll = async (): Promise<void> => {
    for (const root of [documentRoot, cacheRoot]) {
      if (!root) {
        continue;
      }

      const directoryInfo = await FileSystem.getInfoAsync(root);
      if (directoryInfo.exists) {
        await FileSystem.deleteAsync(root, { idempotent: true });
      }
    }

    await ensureDirectory(getActiveRoot());
  };
}
