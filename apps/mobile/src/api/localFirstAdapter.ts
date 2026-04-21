import type {
  ContractRiskScannerApi,
  HistoryItem,
  QueuedUploadItem,
  RequestMeta,
  UploadContractRequest,
} from './types';
import type { LocalCacheStore } from '../data/local/types';

interface LocalFirstAdapterConfig {
  enableLocalFirst: boolean;
}

const shouldUseFallback = (enabled: boolean): boolean => enabled;
const nowIso = (): string => new Date().toISOString();
const buildQueuedAnalysisId = (): string => `queued_${Date.now()}`;

const buildHistoryItem = (
  analysisId: string,
  payload: Pick<UploadContractRequest, 'fileName' | 'selectedRole'>,
  status: HistoryItem['status'],
): HistoryItem => {
  const timestamp = nowIso();

  return {
    analysisId,
    fileName: payload.fileName,
    selectedRole: payload.selectedRole,
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const buildQueuedUpload = (
  analysisId: string,
  payload: UploadContractRequest,
  meta?: RequestMeta,
): QueuedUploadItem => {
  const timestamp = nowIso();

  return {
    analysisId,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    selectedRole: payload.selectedRole,
    localFileUri: payload.localFileUri ?? '',
    language: meta?.language ?? payload.language ?? 'ru',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const createLocalFirstAdapter = (
  remoteClient: ContractRiskScannerApi,
  localCache: LocalCacheStore,
  config: LocalFirstAdapterConfig,
): ContractRiskScannerApi => {
  return {
    uploadContract: async (payload: UploadContractRequest, meta?: RequestMeta) => {
      try {
        const response = await remoteClient.uploadContract(payload, meta);

        if (config.enableLocalFirst) {
          await localCache.saveStatus(response.status);
          await localCache.upsertHistoryItem(buildHistoryItem(response.analysisId, payload, response.status.status));
        }

        return response;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst) && payload.localFileUri) {
          const analysisId = buildQueuedAnalysisId();
          const status = {
            analysisId,
            status: 'queued' as const,
            progress: 0,
            selectedRole: payload.selectedRole,
            updatedAt: nowIso(),
          };

          await localCache.saveQueuedUpload(buildQueuedUpload(analysisId, payload, meta));
          await localCache.saveStatus(status);
          await localCache.upsertHistoryItem(buildHistoryItem(analysisId, payload, 'queued'));

          return { analysisId, status };
        }

        throw error;
      }
    },

    getAnalysisStatus: async (analysisId: string, meta?: RequestMeta) => {
      try {
        const status = await remoteClient.getAnalysisStatus(analysisId, meta);

        if (config.enableLocalFirst) {
          await localCache.saveStatus(status);
          if (status.status === 'completed') {
            const report = await remoteClient.getReport({ analysisId, selectedRole: status.selectedRole }, meta);
            await localCache.saveReport(report);
          }
        }

        return status;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          const cached = await localCache.getStatus(analysisId);
          if (cached) {
            return cached;
          }
        }

        throw error;
      }
    },

    getReport: async (input, meta?: RequestMeta) => {
      try {
        const report = await remoteClient.getReport(input, meta);

        if (config.enableLocalFirst) {
          await localCache.saveReport(report);
        }

        return report;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          const cached = await localCache.getReport(input.analysisId);
          if (cached) {
            return cached;
          }
        }

        throw error;
      }
    },

    listHistory: async (meta?: RequestMeta) => {
      try {
        const history = await remoteClient.listHistory(meta);
        const cachedHistory = config.enableLocalFirst ? await localCache.getHistory() : [];

        if (config.enableLocalFirst) {
          if (history.length === 0 && cachedHistory.length > 0) {
            return cachedHistory;
          }

          await localCache.replaceHistory(history);
        }

        return history;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          return localCache.getHistory();
        }

        throw error;
      }
    },
  };
};
