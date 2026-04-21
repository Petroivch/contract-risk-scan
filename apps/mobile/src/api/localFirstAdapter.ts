import type {
  AnalyzeContractRequest,
  AnalysisStatus,
  ContractRiskScannerApi,
  HistoryItem,
  QueuedUploadItem,
  RequestMeta,
  SignInRequest,
  UploadContractRequest,
  UploadContractResponse,
} from './types';
import type { LocalCacheStore } from '../data/local/types';

interface LocalFirstAdapterConfig {
  enableLocalFirst: boolean;
}

const shouldUseFallback = (enabled: boolean): boolean => enabled;
const nowIso = (): string => new Date().toISOString();
const buildQueuedId = (prefix: string): string => `${prefix}_${Date.now()}`;

const buildHistoryItemFromUpload = (response: UploadContractResponse): HistoryItem => ({
  contractId: response.contractId,
  analysisId: response.analysisId,
  role: response.selectedRole,
  selectedRole: response.selectedRole,
  locale: response.locale,
  status: response.status,
  pipelineStatus: response.pipelineStatus,
  originalFileName: response.originalFileName,
  fileName: response.originalFileName,
  uploadedAt: response.uploadedAt,
  createdAt: response.uploadedAt,
  updatedAt: response.uploadedAt,
});

const buildHistoryItemFromStatus = (status: AnalysisStatus, previous?: HistoryItem): HistoryItem => ({
  contractId: status.contractId,
  analysisId: status.analysisId,
  role: status.selectedRole,
  selectedRole: status.selectedRole,
  locale: status.locale,
  status: status.status,
  pipelineStatus: status.pipelineStatus,
  originalFileName: previous?.originalFileName ?? previous?.fileName ?? 'contract.pdf',
  fileName: previous?.fileName ?? previous?.originalFileName ?? 'contract.pdf',
  uploadedAt: previous?.uploadedAt ?? status.updatedAt,
  createdAt: previous?.createdAt ?? status.updatedAt,
  updatedAt: status.updatedAt,
});

const buildQueuedUpload = (
  response: UploadContractResponse,
  payload: UploadContractRequest,
  meta?: RequestMeta,
): QueuedUploadItem => ({
  contractId: response.contractId,
  analysisId: response.analysisId,
  fileName: payload.fileName,
  mimeType: payload.mimeType,
  selectedRole: payload.selectedRole,
  localFileUri: payload.localFileUri ?? '',
  contractLabel: payload.contractLabel,
  counterpartyRole: payload.counterpartyRole,
  language: meta?.language ?? payload.language ?? 'ru',
  createdAt: response.uploadedAt,
  updatedAt: response.uploadedAt,
});

const buildQueuedUploadResponse = (
  payload: UploadContractRequest,
  meta?: RequestMeta,
): UploadContractResponse => {
  const timestamp = nowIso();
  return {
    contractId: buildQueuedId('queued_ctr'),
    analysisId: buildQueuedId('queued_ana'),
    status: 'queued',
    pipelineStatus: 'queued',
    locale: meta?.language ?? payload.language ?? 'ru',
    selectedRole: payload.selectedRole,
    progress: 10,
    originalFileName: payload.fileName,
    uploadedAt: timestamp,
  };
};

const persistStatusArtifacts = async (
  localCache: LocalCacheStore,
  status: AnalysisStatus,
  previous?: HistoryItem,
): Promise<void> => {
  await localCache.saveStatus(status);
  await localCache.upsertHistoryItem(buildHistoryItemFromStatus(status, previous));
};

export const createLocalFirstAdapter = (
  remoteClient: ContractRiskScannerApi,
  fallbackClient: ContractRiskScannerApi,
  localCache: LocalCacheStore,
  config: LocalFirstAdapterConfig,
): ContractRiskScannerApi => {
  return {
    signIn: async (payload: SignInRequest, meta?: RequestMeta) => {
      try {
        return await remoteClient.signIn(payload, meta);
      } catch {
        return fallbackClient.signIn(payload, meta);
      }
    },

    uploadContract: async (payload: UploadContractRequest, meta?: RequestMeta) => {
      try {
        const response = await remoteClient.uploadContract(payload, meta);

        if (config.enableLocalFirst) {
          const status: AnalysisStatus = {
            contractId: response.contractId,
            analysisId: response.analysisId,
            status: response.status,
            pipelineStatus: response.pipelineStatus,
            locale: response.locale,
            progress: response.progress,
            selectedRole: response.selectedRole,
            allowedTransitions: ['queued', 'preprocessing', 'analyzing', 'report_ready', 'failed'],
            updatedAt: response.uploadedAt,
          };

          await localCache.saveStatus(status);
          await localCache.upsertHistoryItem(buildHistoryItemFromUpload(response));
          await localCache.saveQueuedUpload(buildQueuedUpload(response, payload, meta));
        }

        return response;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          const fallbackResponse = buildQueuedUploadResponse(payload, meta);
          await localCache.saveQueuedUpload(buildQueuedUpload(fallbackResponse, payload, meta));
          await localCache.upsertHistoryItem(buildHistoryItemFromUpload(fallbackResponse));
          await localCache.saveStatus({
            contractId: fallbackResponse.contractId,
            analysisId: fallbackResponse.analysisId,
            status: fallbackResponse.status,
            pipelineStatus: fallbackResponse.pipelineStatus,
            locale: fallbackResponse.locale,
            progress: fallbackResponse.progress,
            selectedRole: fallbackResponse.selectedRole,
            allowedTransitions: ['queued', 'preprocessing', 'analyzing', 'report_ready', 'failed'],
            updatedAt: fallbackResponse.uploadedAt,
          });
          return fallbackResponse;
        }

        throw error;
      }
    },

    analyzeContract: async (payload: AnalyzeContractRequest, meta?: RequestMeta) => {
      try {
        const response = await remoteClient.analyzeContract(payload, meta);

        if (config.enableLocalFirst) {
          const previousHistory = (await localCache.getHistory()).find((item) => item.analysisId === response.analysisId);
          await persistStatusArtifacts(localCache, {
            contractId: response.contractId,
            analysisId: response.analysisId,
            status: response.status,
            pipelineStatus: response.pipelineStatus,
            locale: response.locale,
            progress: response.progress,
            selectedRole: response.selectedRole,
            allowedTransitions: ['preprocessing', 'analyzing', 'report_ready', 'failed'],
            updatedAt: nowIso(),
          }, previousHistory);
        }

        return response;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          const fallbackResponse = await fallbackClient.analyzeContract(payload, meta);
          const previousHistory = (await localCache.getHistory()).find((item) => item.analysisId === fallbackResponse.analysisId);
          await persistStatusArtifacts(localCache, {
            contractId: fallbackResponse.contractId,
            analysisId: fallbackResponse.analysisId,
            status: fallbackResponse.status,
            pipelineStatus: fallbackResponse.pipelineStatus,
            locale: fallbackResponse.locale,
            progress: fallbackResponse.progress,
            selectedRole: fallbackResponse.selectedRole,
            allowedTransitions: ['preprocessing', 'analyzing', 'report_ready', 'failed'],
            updatedAt: nowIso(),
          }, previousHistory);
          return fallbackResponse;
        }

        throw error;
      }
    },

    getAnalysisStatus: async (input, meta?: RequestMeta) => {
      try {
        const status = await remoteClient.getAnalysisStatus(input, meta);

        if (config.enableLocalFirst) {
          const previousHistory = (await localCache.getHistory()).find((item) => item.analysisId === status.analysisId);
          await persistStatusArtifacts(localCache, status, previousHistory);
        }

        return status;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          try {
            const fallbackStatus = await fallbackClient.getAnalysisStatus(input, meta);
            const previousHistory = (await localCache.getHistory()).find((item) => item.analysisId === fallbackStatus.analysisId);
            await persistStatusArtifacts(localCache, fallbackStatus, previousHistory);
            return fallbackStatus;
          } catch {
            if (input.analysisId) {
              const cached = await localCache.getStatus(input.analysisId);
              if (cached) {
                return cached;
              }
            }
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
          try {
            const fallbackReport = await fallbackClient.getReport(input, meta);
            await localCache.saveReport(fallbackReport);
            return fallbackReport;
          } catch {
            if (input.analysisId) {
              const cached = await localCache.getReport(input.analysisId);
              if (cached) {
                return cached;
              }
            }
          }
        }

        throw error;
      }
    },

    listHistory: async (meta?: RequestMeta) => {
      try {
        const history = await remoteClient.listHistory(meta);

        if (config.enableLocalFirst) {
          await localCache.replaceHistory(history);
        }

        return history;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          const fallbackHistory = await fallbackClient.listHistory(meta);
          if (fallbackHistory.length > 0) {
            await localCache.replaceHistory(fallbackHistory);
            return fallbackHistory;
          }

          return localCache.getHistory();
        }

        throw error;
      }
    },
  };
};
