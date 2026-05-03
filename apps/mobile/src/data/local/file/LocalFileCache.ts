import * as FileSystem from 'expo-file-system';

import { appConfig } from '../../../config/appConfig';

const sanitizeFileName = (fileName: string): string => {
  const normalized = fileName.trim().replace(/[^A-Za-z0-9._-]+/g, '-');
  return normalized.length > 0 ? normalized : 'upload.bin';
};

const normalizeDirectoryUri = (uri: string): string => (uri.endsWith('/') ? uri : `${uri}/`);

const getCacheRoot = (): string => {
  const cacheDirectory = FileSystem.cacheDirectory ?? '';
  if (!cacheDirectory) {
    return '';
  }

  return normalizeDirectoryUri(`${cacheDirectory}${appConfig.localStorage.fileCacheDir}`);
};

const isDocumentPickerUri = (uri: string): boolean => /documentpicker|document-picker|expo-document-picker/i.test(uri);

export interface StagedUploadFile {
  uri: string;
  shouldRelease: boolean;
}

export class LocalFileCache {
  public getRootPath = (): string => getCacheRoot();

  private ensureRoot = async (): Promise<string> => {
    const rootPath = this.getRootPath();
    if (!rootPath) {
      return '';
    }

    await FileSystem.makeDirectoryAsync(rootPath, { intermediates: true });
    return rootPath;
  };

  public stageUploadFile = async (
    sourceUri: string | undefined,
    fileName: string,
  ): Promise<StagedUploadFile | undefined> => {
    if (!sourceUri) {
      return undefined;
    }

    const rootPath = await this.ensureRoot();
    if (!rootPath) {
      return { uri: sourceUri, shouldRelease: false };
    }

    const stagedUri = `${rootPath}${Date.now()}-${sanitizeFileName(fileName)}`;

    try {
      await FileSystem.copyAsync({ from: sourceUri, to: stagedUri });
      return { uri: stagedUri, shouldRelease: true };
    } catch {
      return { uri: sourceUri, shouldRelease: false };
    }
  };

  public releaseFile = async (uri?: string): Promise<void> => {
    if (!uri) {
      return;
    }

    const rootPath = this.getRootPath();
    const releasable = (rootPath && uri.startsWith(rootPath)) || isDocumentPickerUri(uri);
    if (!releasable) {
      return;
    }

    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  };

  public clearAll = async (): Promise<void> => {
    const targets = [
      this.getRootPath(),
      `${FileSystem.cacheDirectory ?? ''}DocumentPicker/`,
      `${FileSystem.cacheDirectory ?? ''}documentpicker/`,
    ].filter((value): value is string => value.length > 0);

    await Promise.all(
      targets.map(async (target) => {
        const info = await FileSystem.getInfoAsync(target);
        if (info.exists) {
          await FileSystem.deleteAsync(target, { idempotent: true });
        }
      }),
    );

    await this.ensureRoot();
  };
}

export const localFileCache = new LocalFileCache();
