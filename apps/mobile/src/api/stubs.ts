import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';
import { analyzeContractLocally } from '../analysis/localContractAnalyzer';

import { prepareRequestContext } from './client';
import type {
  AnalysisLifecycleStatus,
  AnalysisReport,
  AnalysisStatus,
  ContractRiskScannerApi,
  HistoryItem,
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
  report: AnalysisReport;
}

interface StubClientConfig {
  getLanguage?: () => SupportedLanguage;
}

const storage = new Map<string, StoredAnalysis>();
const queuedPhaseMs = 900;
const processingPhaseMs = 2200;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = (): string => new Date().toISOString();

const resolveStatus = (entity: StoredAnalysis): AnalysisLifecycleStatus => {
  if (entity.status === 'failed') {
    return 'failed';
  }

  const created = new Date(entity.createdAt).getTime();
  const now = Date.now();

  if (now - created < queuedPhaseMs) {
    return 'queued';
  }

  if (now - created < processingPhaseMs) {
    return 'processing';
  }

  return 'completed';
};

const progressByStatus = (status: AnalysisLifecycleStatus, createdAt?: string, completedAt?: string): number => {
  if (status === 'failed') return 0;
  if (status === 'completed') return 100;
  if (!createdAt || !completedAt) return status === 'queued' ? 14 : 72;

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
  return {
    analysisId: entity.analysisId,
    selectedRole: entity.selectedRole,
    status,
    progress: progressByStatus(status, entity.createdAt, entity.completedAt),
    updatedAt: status === 'completed' ? entity.completedAt : entity.updatedAt,
  };
};

const toHistory = (entity: StoredAnalysis): HistoryItem => {
  const status = resolveStatus(entity);
  return {
    analysisId: entity.analysisId,
    fileName: entity.fileName,
    selectedRole: entity.selectedRole,
    status,
    createdAt: entity.createdAt,
    updatedAt: status === 'completed' ? entity.completedAt : entity.updatedAt,
  };
};

export const createStubApiClient = (config: StubClientConfig = {}): ContractRiskScannerApi => ({
  async uploadContract(
    payload: UploadContractRequest,
    meta?: RequestMeta,
  ): Promise<{ analysisId: string; status: AnalysisStatus }> {
    await delay(160);
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const language = payload.language ?? requestContext.language ?? defaultLanguage;

    const analysisId = `analysis_${Date.now()}`;
    const now = nowIso();
    const report = await analyzeContractLocally(payload, language);

    const entity: StoredAnalysis = {
      analysisId,
      fileName: payload.fileName,
      selectedRole: payload.selectedRole,
      status: 'processing',
      createdAt: now,
      updatedAt: now,
      completedAt: new Date(Date.now() + processingPhaseMs).toISOString(),
      language,
      report: {
        ...report,
        analysisId,
      },
    };

    storage.set(analysisId, entity);
    return { analysisId, status: toStatus(entity) };
  },

  async getAnalysisStatus(analysisId: string, meta?: RequestMeta): Promise<AnalysisStatus> {
    await delay(250);
    prepareRequestContext(meta, config.getLanguage);

    const entity = storage.get(analysisId);
    if (!entity) {
      throw new Error(`Analysis ${analysisId} was not found in local runtime cache.`);
    }

    return toStatus(entity);
  },

  async getReport(input: { analysisId: string; selectedRole?: string }, meta?: RequestMeta): Promise<AnalysisReport> {
    await delay(180);
    prepareRequestContext(meta, config.getLanguage);

    const entity = storage.get(input.analysisId);
    if (!entity) {
      throw new Error(`Report ${input.analysisId} was not found in local runtime cache.`);
    }

    return {
      ...entity.report,
      analysisId: input.analysisId,
      selectedRole: input.selectedRole ?? entity.selectedRole,
      generatedAt: entity.completedAt,
    };
  },

  async listHistory(meta?: RequestMeta): Promise<HistoryItem[]> {
    await delay(120);
    prepareRequestContext(meta, config.getLanguage);
    return [...storage.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((entry) => toHistory(entry));
  },
});
