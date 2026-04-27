import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';
import { analyzeContractLocally } from '../analysis/localContractAnalyzer';

import { prepareRequestContext } from './client';
import type {
  AnalysisLifecycleStatus,
  AnalysisReport,
  AnalysisStatus,
  ContractRiskScannerApi,
  RequestMeta,
  UploadContractRequest,
} from './types';

interface StoredAnalysis {
  analysisId: string;
  fileName: string;
  selectedRole: string;
  status: AnalysisLifecycleStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
  language: SupportedLanguage;
  stage?: AnalysisStatus['stage'];
  report?: AnalysisReport;
  errorMessage?: string;
}

interface StubClientConfig {
  getLanguage?: () => SupportedLanguage;
}

let currentAnalysis: StoredAnalysis | null = null;
const processingTasks = new Map<string, Promise<void>>();
const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const queuedPhaseMs = 900;
const processingPhaseMs = 5200;
const completedRetentionMs = 60_000;
const failedRetentionMs = 15_000;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = (): string => new Date().toISOString();
const getCurrentAnalysis = (analysisId: string): StoredAnalysis | null =>
  currentAnalysis?.analysisId === analysisId ? currentAnalysis : null;

const clearStoredAnalysis = (analysisId: string): void => {
  const timer = cleanupTimers.get(analysisId);
  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(analysisId);
  }

  if (currentAnalysis?.analysisId === analysisId) {
    currentAnalysis = null;
  }
  processingTasks.delete(analysisId);
};

export const clearStubRuntimeCache = async (): Promise<void> => {
  if (currentAnalysis) {
    clearStoredAnalysis(currentAnalysis.analysisId);
  }

  cleanupTimers.forEach((timer) => clearTimeout(timer));
  cleanupTimers.clear();
  processingTasks.clear();
};

const scheduleCleanup = (analysisId: string, delayMs: number): void => {
  const existingTimer = cleanupTimers.get(analysisId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  cleanupTimers.set(
    analysisId,
    setTimeout(() => {
      clearStoredAnalysis(analysisId);
    }, delayMs),
  );
};

const resolveStatus = (entity: StoredAnalysis): AnalysisLifecycleStatus => {
  return entity.status;
};

const progressByStatus = (
  status: AnalysisLifecycleStatus,
  stage?: AnalysisStatus['stage'],
  createdAt?: string,
  completedAt?: string,
): number => {
  if (status === 'failed') return 0;
  if (status === 'completed') return 100;
  if (stage === 'queued') return 8;
  if (stage === 'extracting') return 32;
  if (stage === 'analyzing') return 68;
  if (stage === 'finalizing') return 88;
  if (!createdAt || !completedAt) return status === 'queued' ? 8 : 48;

  const created = new Date(createdAt).getTime();
  const completed = new Date(completedAt).getTime();
  const now = Date.now();
  const total = Math.max(completed - created, 1);
  const elapsed = Math.max(now - created, 0);
  const percent = Math.min(elapsed / total, 1);

  if (percent < 0.35) {
    return Math.max(12, Math.round(percent * 100));
  }

  return Math.max(38, Math.min(92, Math.round(percent * 100)));
};

const toStatus = (entity: StoredAnalysis): AnalysisStatus => {
  const status = resolveStatus(entity);
  const stage = status === 'queued' || status === 'processing' ? entity.stage : undefined;
  return {
    analysisId: entity.analysisId,
    selectedRole: entity.selectedRole,
    status,
    progress: progressByStatus(status, stage, entity.createdAt, entity.completedAt),
    stage,
    updatedAt: status === 'completed' ? entity.completedAt : entity.updatedAt,
    errorMessage: entity.errorMessage,
  };
};

const scheduleLocalAnalysis = (
  entity: StoredAnalysis,
  payload: UploadContractRequest,
  language: SupportedLanguage,
): void => {
  if (processingTasks.has(entity.analysisId)) {
    return;
  }

  const task = (async (): Promise<void> => {
    try {
      await delay(Math.min(queuedPhaseMs, 240));

      entity.status = 'processing';
      entity.stage = 'extracting';
      entity.updatedAt = nowIso();
      entity.completedAt = new Date(Date.now() + processingPhaseMs).toISOString();

      await delay(80);
      entity.stage = 'analyzing';
      entity.updatedAt = nowIso();
      const report = await analyzeContractLocally(payload, language);
      const completedAt = nowIso();

      entity.stage = 'finalizing';
      entity.report = {
        ...report,
        analysisId: entity.analysisId,
      };
      entity.status = 'completed';
      entity.stage = undefined;
      entity.updatedAt = completedAt;
      entity.completedAt = completedAt;
      scheduleCleanup(entity.analysisId, completedRetentionMs);
    } catch (error) {
      const failedAt = nowIso();
      entity.status = 'failed';
      entity.updatedAt = failedAt;
      entity.completedAt = failedAt;
      entity.errorMessage = error instanceof Error ? error.message : 'Local analysis failed.';
      scheduleCleanup(entity.analysisId, failedRetentionMs);
    } finally {
      processingTasks.delete(entity.analysisId);
    }
  })();

  processingTasks.set(entity.analysisId, task);
};

export const createStubApiClient = (config: StubClientConfig = {}): ContractRiskScannerApi => ({
  async uploadContract(
    payload: UploadContractRequest,
    meta?: RequestMeta,
  ): Promise<{ analysisId: string; status: AnalysisStatus }> {
    await delay(160);
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const language = payload.language ?? requestContext.language ?? defaultLanguage;

    await clearStubRuntimeCache();

    const analysisId = `analysis_${Date.now()}`;
    const now = nowIso();

    const entity: StoredAnalysis = {
      analysisId,
      fileName: payload.fileName,
      selectedRole: payload.selectedRole,
      status: 'queued',
      stage: 'queued',
      createdAt: now,
      updatedAt: now,
      completedAt: new Date(Date.now() + processingPhaseMs).toISOString(),
      language,
    };

    currentAnalysis = entity;
    scheduleLocalAnalysis(entity, payload, language);
    return { analysisId, status: toStatus(entity) };
  },

  async getAnalysisStatus(analysisId: string, meta?: RequestMeta): Promise<AnalysisStatus> {
    await delay(250);
    prepareRequestContext(meta, config.getLanguage);

    const entity = getCurrentAnalysis(analysisId);
    if (!entity) {
      throw new Error(`Analysis ${analysisId} is not available in the current session.`);
    }

    return toStatus(entity);
  },

  async getReport(
    input: { analysisId: string; selectedRole?: string },
    meta?: RequestMeta,
  ): Promise<AnalysisReport> {
    await delay(180);
    prepareRequestContext(meta, config.getLanguage);

    const entity = getCurrentAnalysis(input.analysisId);
    if (!entity) {
      throw new Error(`Report ${input.analysisId} is not available in the current session.`);
    }

    if (entity.status !== 'completed' || !entity.report) {
      throw new Error(`Report ${input.analysisId} is not ready yet.`);
    }

    const report = {
      ...entity.report,
      analysisId: input.analysisId,
      selectedRole: input.selectedRole ?? entity.selectedRole,
      generatedAt: entity.completedAt,
    };

    clearStoredAnalysis(input.analysisId);

    return report;
  },
});
