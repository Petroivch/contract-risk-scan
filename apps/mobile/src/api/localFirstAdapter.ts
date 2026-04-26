import type {
  ContractRiskScannerApi,
  HistoryItem,
  AnalysisReport,
  AnalysisStatus,
  QueuedUploadItem,
  RequestMeta,
  UploadContractRequest,
} from './types';
import type { LocalCacheStore } from '../data/local/types';
import { analyzeContractLocally } from '../analysis/localContractAnalyzer';
import { repairMojibakeText } from '../analysis/textNormalization';

interface LocalFirstAdapterConfig {
  enableLocalFirst: boolean;
}

const shouldUseFallback = (enabled: boolean): boolean => enabled;
const nowIso = (): string => new Date().toISOString();
const buildQueuedAnalysisId = (): string => `queued_${Date.now()}`;
const localFallbackTasks = new Map<string, Promise<void>>();
const localAnalysisTimeoutMs = 15 * 60 * 1000;
const localAnalysisTimeoutMessage = 'Local analysis timed out. Please retry the upload.';

const parseTimestampMs = (timestamp: string): number | null => {
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? null : value;
};

const isPendingStatus = (status: AnalysisStatus): boolean =>
  status.status === 'queued' || status.status === 'processing';

const isTimedOutPendingStatus = (status: AnalysisStatus): boolean => {
  if (!isPendingStatus(status)) {
    return false;
  }

  const updatedAtMs = parseTimestampMs(status.updatedAt);
  return updatedAtMs !== null && Date.now() - updatedAtMs > localAnalysisTimeoutMs;
};

const buildTimedOutStatus = (status: AnalysisStatus): AnalysisStatus => ({
  ...status,
  status: 'failed',
  progress: 0,
  stage: undefined,
  updatedAt: nowIso(),
  errorMessage: localAnalysisTimeoutMessage,
});

const buildCompletedStatus = (analysisId: string, selectedRole: string): AnalysisStatus => ({
  analysisId,
  status: 'completed',
  progress: 100,
  selectedRole,
  updatedAt: nowIso(),
});
const repairDeepReportText = <T>(value: T): T => {
  if (typeof value === 'string') {
    return repairMojibakeText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => repairDeepReportText(item)) as T;
  }

  if (value && typeof value === 'object') {
    const repaired: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      repaired[key] = repairDeepReportText(item);
    }
    return repaired as T;
  }

  return value;
};
const sanitizeReport = (report: AnalysisReport): AnalysisReport => repairDeepReportText(report);
const ignoreCacheError = async (operation: () => Promise<void>): Promise<void> => {
  try {
    await operation();
  } catch {
    // Local cache must not break the user-visible analysis flow.
  }
};

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const buildLocalStatus = (
  analysisId: string,
  selectedRole: string,
  status: AnalysisStatus['status'],
  progress: number,
  stage?: AnalysisStatus['stage'],
  errorMessage?: string,
): AnalysisStatus => ({
  analysisId,
  status,
  progress,
  stage,
  selectedRole,
  updatedAt: nowIso(),
  errorMessage,
});

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

const buildUploadPayloadFromQueue = (
  queuedUpload: QueuedUploadItem,
  overrides?: Partial<Pick<UploadContractRequest, 'selectedRole' | 'language'>>,
): UploadContractRequest => ({
  fileName: queuedUpload.fileName,
  mimeType: queuedUpload.mimeType,
  localFileUri: queuedUpload.localFileUri,
  selectedRole: overrides?.selectedRole ?? queuedUpload.selectedRole,
  language: overrides?.language ?? queuedUpload.language,
});

export const createLocalFirstAdapter = (
  remoteClient: ContractRiskScannerApi,
  localCache: LocalCacheStore,
  config: LocalFirstAdapterConfig,
): ContractRiskScannerApi => {
  const runCompletedLocalAnalysis = async (
    analysisId: string,
    payload: UploadContractRequest,
    meta?: RequestMeta,
  ): Promise<{ report: AnalysisReport; status: AnalysisStatus }> => {
    const report = sanitizeReport(await analyzeContractLocally(payload, meta?.language ?? payload.language));
    const completedReport: AnalysisReport = {
      ...report,
      analysisId,
      selectedRole: payload.selectedRole,
      generatedAt: nowIso(),
    };
    const status = buildCompletedStatus(analysisId, payload.selectedRole);

    await ignoreCacheError(() => localCache.saveQueuedUpload(buildQueuedUpload(analysisId, payload, meta)));
    await ignoreCacheError(() => localCache.saveReport(completedReport));
    await ignoreCacheError(() => localCache.saveStatus(status));
    await ignoreCacheError(() => localCache.upsertHistoryItem(buildHistoryItem(analysisId, payload, 'completed')));

    return { report: completedReport, status };
  };

  const getQueuedUploadSafely = async (analysisId: string): Promise<QueuedUploadItem | null> => {
    try {
      return await localCache.getQueuedUpload(analysisId);
    } catch {
      return null;
    }
  };

  const markLocalAnalysisTimedOut = async (
    status: AnalysisStatus,
    queuedUpload?: QueuedUploadItem | null,
  ): Promise<AnalysisStatus> => {
    const failedStatus = buildTimedOutStatus(status);
    await ignoreCacheError(() => localCache.saveStatus(failedStatus));

    if (queuedUpload) {
      await ignoreCacheError(() =>
        localCache.upsertHistoryItem(buildHistoryItem(status.analysisId, queuedUpload, 'failed')),
      );
    }

    return failedStatus;
  };

  const getCachedStatusWithTimeout = async (analysisId: string): Promise<AnalysisStatus | null> => {
    const cached = await localCache.getStatus(analysisId);
    if (!cached || !isTimedOutPendingStatus(cached)) {
      return cached;
    }

    return markLocalAnalysisTimedOut(cached, await getQueuedUploadSafely(analysisId));
  };

  const scheduleLocalFallbackAnalysis = (
    analysisId: string,
    payload: UploadContractRequest,
    meta?: RequestMeta,
  ): void => {
    if (localFallbackTasks.has(analysisId)) {
      return;
    }

    const task = (async (): Promise<void> => {
      try {
        await delay(80);
        await ignoreCacheError(() =>
          localCache.saveStatus(buildLocalStatus(analysisId, payload.selectedRole, 'processing', 24, 'extracting')),
        );

        await delay(40);
        await ignoreCacheError(() =>
          localCache.saveStatus(buildLocalStatus(analysisId, payload.selectedRole, 'processing', 62, 'analyzing')),
        );

        const { report } = await runCompletedLocalAnalysis(analysisId, payload, meta);

        await ignoreCacheError(() => localCache.saveReport(report));
        await ignoreCacheError(() =>
          localCache.saveStatus(buildLocalStatus(analysisId, payload.selectedRole, 'completed', 100)),
        );
        await ignoreCacheError(() =>
          localCache.upsertHistoryItem(buildHistoryItem(analysisId, payload, 'completed')),
        );
      } catch (error) {
        const failedStatus = buildLocalStatus(
          analysisId,
          payload.selectedRole,
          'failed',
          0,
          undefined,
          error instanceof Error ? error.message : 'Local analysis failed.',
        );
        await ignoreCacheError(() => localCache.saveStatus(failedStatus));
        await ignoreCacheError(() => localCache.upsertHistoryItem(buildHistoryItem(analysisId, payload, 'failed')));
      } finally {
        localFallbackTasks.delete(analysisId);
      }
    })();

    localFallbackTasks.set(analysisId, task);
  };

  let pendingRestorePromise: Promise<void> | null = null;
  const restorePendingLocalAnalyses = (): Promise<void> => {
    if (!config.enableLocalFirst) {
      return Promise.resolve();
    }

    if (!pendingRestorePromise) {
      pendingRestorePromise = (async (): Promise<void> => {
        const queuedUploads = await localCache.getQueuedUploads();

        for (const queuedUpload of queuedUploads) {
          const cachedStatus = await getCachedStatusWithTimeout(queuedUpload.analysisId);
          if (!cachedStatus || !isPendingStatus(cachedStatus)) {
            continue;
          }

          if (!queuedUpload.localFileUri) {
            continue;
          }

          scheduleLocalFallbackAnalysis(
            queuedUpload.analysisId,
            buildUploadPayloadFromQueue(queuedUpload),
            { language: queuedUpload.language },
          );
        }
      })().catch(() => {
        pendingRestorePromise = null;
        // Local recovery is best effort; foreground calls still fall back to cached status/report.
      });
    }

    return pendingRestorePromise;
  };

  void restorePendingLocalAnalyses();

  return {
    uploadContract: async (payload: UploadContractRequest, meta?: RequestMeta) => {
      await restorePendingLocalAnalyses();

      try {
        const response = await remoteClient.uploadContract(payload, meta);

        if (config.enableLocalFirst) {
          await ignoreCacheError(() => localCache.saveQueuedUpload(buildQueuedUpload(response.analysisId, payload, meta)));
          await ignoreCacheError(() => localCache.saveStatus(response.status));
          await ignoreCacheError(() =>
            localCache.upsertHistoryItem(buildHistoryItem(response.analysisId, payload, response.status.status)),
          );
          await ignoreCacheError(async () => {
            const eagerReport = sanitizeReport(
              await remoteClient.getReport(
                {
                  analysisId: response.analysisId,
                  selectedRole: payload.selectedRole,
                },
                meta,
              ),
            );
            await localCache.saveReport(eagerReport);
          });
        }

        return response;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst) && payload.localFileUri) {
          const analysisId = buildQueuedAnalysisId();
          const status = buildLocalStatus(analysisId, payload.selectedRole, 'queued', 8, 'queued');
          await ignoreCacheError(() => localCache.saveQueuedUpload(buildQueuedUpload(analysisId, payload, meta)));
          await ignoreCacheError(() => localCache.saveStatus(status));
          await ignoreCacheError(() => localCache.upsertHistoryItem(buildHistoryItem(analysisId, payload, 'queued')));
          scheduleLocalFallbackAnalysis(analysisId, payload, meta);
          return { analysisId, status };
        }

        throw error;
      }
    },

    getAnalysisStatus: async (analysisId: string, meta?: RequestMeta) => {
      await restorePendingLocalAnalyses();

      try {
        const status = await remoteClient.getAnalysisStatus(analysisId, meta);

        if (config.enableLocalFirst) {
          await ignoreCacheError(() => localCache.saveStatus(status));
          if (status.status === 'completed') {
            const report = sanitizeReport(
              await remoteClient.getReport({ analysisId, selectedRole: status.selectedRole }, meta),
            );
            await ignoreCacheError(() => localCache.saveReport(report));
          }
        }

        return status;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          const cached = await getCachedStatusWithTimeout(analysisId);
          if (cached) {
            if (isPendingStatus(cached)) {
              const queuedUpload = await getQueuedUploadSafely(analysisId);
              if (queuedUpload?.localFileUri) {
                scheduleLocalFallbackAnalysis(
                  analysisId,
                  buildUploadPayloadFromQueue(queuedUpload, {
                    language: meta?.language ?? queuedUpload.language,
                  }),
                  { ...meta, language: meta?.language ?? queuedUpload.language },
                );
              }
            }
            return cached;
          }
        }

        throw error;
      }
    },

    getReport: async (input, meta?: RequestMeta) => {
      await restorePendingLocalAnalyses();

      const queuedUpload = config.enableLocalFirst
        ? await (async (): Promise<QueuedUploadItem | null> => {
            try {
              return await localCache.getQueuedUpload(input.analysisId);
            } catch {
              return null;
            }
          })()
        : null;
      const requestedLanguage = meta?.language ?? queuedUpload?.language;
      const requestedRole = input.selectedRole ?? queuedUpload?.selectedRole;

      try {
        const report = sanitizeReport(await remoteClient.getReport(input, meta));

        if (config.enableLocalFirst) {
          await ignoreCacheError(() => localCache.saveReport(report));
        }

        if (
          queuedUpload &&
          ((requestedLanguage && requestedLanguage !== queuedUpload.language) ||
            (requestedRole && requestedRole !== queuedUpload.selectedRole))
        ) {
          const { report: regeneratedReport } = await runCompletedLocalAnalysis(
            input.analysisId,
            buildUploadPayloadFromQueue(queuedUpload, {
              selectedRole: requestedRole,
              language: requestedLanguage,
            }),
            { ...meta, language: requestedLanguage },
          );

          return regeneratedReport;
        }

        return report;
      } catch (error) {
        if (shouldUseFallback(config.enableLocalFirst)) {
          let cached: AnalysisReport | null = null;
          try {
            cached = await localCache.getReport(input.analysisId);
          } catch {
            cached = null;
          }

          if (cached) {
            return sanitizeReport(cached);
          }

          if (queuedUpload?.localFileUri) {
            const { report } = await runCompletedLocalAnalysis(
              input.analysisId,
              buildUploadPayloadFromQueue(queuedUpload, {
                selectedRole: requestedRole,
                language: requestedLanguage,
              }),
              { ...meta, language: requestedLanguage },
            );

            return report;
          }
        }

        throw error;
      }
    },

    listHistory: async (meta?: RequestMeta) => {
      await restorePendingLocalAnalyses();

      try {
        const history = await remoteClient.listHistory(meta);
        const cachedHistory = config.enableLocalFirst ? await localCache.getHistory() : [];

        if (config.enableLocalFirst) {
          if (history.length === 0 && cachedHistory.length > 0) {
            return cachedHistory;
          }

          await ignoreCacheError(() => localCache.replaceHistory(history));
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
