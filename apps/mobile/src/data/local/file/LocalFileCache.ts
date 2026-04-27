export class LocalFileCache {
  public getRootPath = (): string => '';

  // Mobile runtime stays memory-only; no app-managed document cache is created on disk.
  public clearAll = async (): Promise<void> => {};
}
