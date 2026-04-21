import type { AnalysisReport, AnalysisStatus, HistoryItem, QueuedUploadItem } from '../../api/types';

export interface LocalCacheStore {
  initialize(): Promise<void>;
  saveStatus(status: AnalysisStatus): Promise<void>;
  getStatus(analysisId: string): Promise<AnalysisStatus | null>;
  saveReport(report: AnalysisReport): Promise<void>;
  getReport(analysisId: string): Promise<AnalysisReport | null>;
  upsertHistoryItem(item: HistoryItem): Promise<void>;
  replaceHistory(items: HistoryItem[]): Promise<void>;
  getHistory(): Promise<HistoryItem[]>;
  saveQueuedUpload(item: QueuedUploadItem): Promise<void>;
  getQueuedUpload(analysisId: string): Promise<QueuedUploadItem | null>;
}
