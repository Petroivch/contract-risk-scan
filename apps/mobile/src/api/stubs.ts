import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { prepareRequestContext } from './client';
import type {
  AnalysisLifecycleStatus,
  AnalysisReport,
  AnalysisStatus,
  ContractRiskScannerApi,
  HistoryItem,
  RequestMeta,
  SignInRequest,
  UploadContractRequest,
  UserSession,
} from './types';

interface StoredAnalysis {
  analysisId: string;
  fileName: string;
  selectedRole: string;
  statusIndex: number;
  createdAt: string;
  updatedAt: string;
  language: SupportedLanguage;
}

interface StubClientConfig {
  getLanguage?: () => SupportedLanguage;
}

const lifecycle: AnalysisLifecycleStatus[] = ['queued', 'processing', 'processing', 'completed'];
const storage = new Map<string, StoredAnalysis>();

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const nowIso = (): string => new Date().toISOString();

const progressByStatus = (status: AnalysisLifecycleStatus): number => {
  if (status === 'queued') return 10;
  if (status === 'processing') return 65;
  if (status === 'completed') return 100;
  return 0;
};

const buildSummaryByRole = (role: string): string[] => [
  `Verify payment and acceptance timeline obligations for role: ${role}.`,
  `Check unilateral penalty clauses that directly impact role: ${role}.`,
  `Review early termination rights and notice windows for role: ${role}.`,
];

const buildReport = (analysisId: string, selectedRole: string): AnalysisReport => ({
  analysisId,
  selectedRole,
  generatedAt: nowIso(),
  summary: {
    title: 'Contract abstract for selected role',
    contractType: 'Service Agreement',
    shortDescription:
      'The contract describes service delivery scope, payment conditions, acceptance criteria, and liability boundaries between parties.',
    obligationsForSelectedRole: buildSummaryByRole(selectedRole),
  },
  risks: [
    {
      id: `${analysisId}-risk-1`,
      severity: 'high',
      clauseRef: 'Section 7.2',
      title: 'Unlimited liability exposure',
      description: 'Liability cap is missing for indirect losses.',
      recommendation: 'Add aggregate liability cap tied to contract value.',
    },
    {
      id: `${analysisId}-risk-2`,
      severity: 'medium',
      clauseRef: 'Section 4.1',
      title: 'Payment delay risk',
      description: 'No explicit payment due date with penalties for delays.',
      recommendation: 'Define due date and late payment interest.',
    },
  ],
  disputedClauses: [
    {
      id: `${analysisId}-dc-1`,
      clauseRef: 'Section 9.4',
      whyDisputed: 'Termination rights are asymmetrical between parties.',
      suggestedRewrite: 'Grant both parties equal right to terminate for convenience with 30 days notice.',
    },
    {
      id: `${analysisId}-dc-2`,
      clauseRef: 'Section 3.3',
      whyDisputed: 'Acceptance criteria are vague and open to subjective interpretation.',
      suggestedRewrite: 'Add objective measurable acceptance metrics and review timeline.',
    },
  ],
});

const toStatus = (entity: StoredAnalysis): AnalysisStatus => {
  const status = lifecycle[Math.min(entity.statusIndex, lifecycle.length - 1)];
  return {
    analysisId: entity.analysisId,
    selectedRole: entity.selectedRole,
    status,
    progress: progressByStatus(status),
    updatedAt: entity.updatedAt,
  };
};

const toHistory = (entity: StoredAnalysis): HistoryItem => {
  const status = lifecycle[Math.min(entity.statusIndex, lifecycle.length - 1)];
  return {
    analysisId: entity.analysisId,
    fileName: entity.fileName,
    selectedRole: entity.selectedRole,
    status,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
};

export const createStubApiClient = (config: StubClientConfig = {}): ContractRiskScannerApi => ({
  async signIn(payload: SignInRequest, meta?: RequestMeta): Promise<UserSession> {
    await delay(250);
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const requestLanguage = payload.language ?? requestContext.language ?? defaultLanguage;

    return {
      accessToken: `stub-access-token-${requestLanguage}`,
      refreshToken: `stub-refresh-token-${requestLanguage}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: 'stub-user-1',
        email: payload.email,
        displayName: 'Mobile Tester',
      },
    };
  },

  async uploadContract(
    payload: UploadContractRequest,
    meta?: RequestMeta,
  ): Promise<{ analysisId: string; status: AnalysisStatus }> {
    await delay(300);
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const language = payload.language ?? requestContext.language ?? defaultLanguage;

    const analysisId = `analysis_${Date.now()}`;
    const now = nowIso();

    const entity: StoredAnalysis = {
      analysisId,
      fileName: payload.fileName,
      selectedRole: payload.selectedRole,
      statusIndex: 0,
      createdAt: now,
      updatedAt: now,
      language,
    };

    storage.set(analysisId, entity);
    return { analysisId, status: toStatus(entity) };
  },

  async getAnalysisStatus(analysisId: string, meta?: RequestMeta): Promise<AnalysisStatus> {
    await delay(400);
    prepareRequestContext(meta, config.getLanguage);

    const entity = storage.get(analysisId);
    if (!entity) {
      return {
        analysisId,
        selectedRole: 'Unknown',
        status: 'failed',
        progress: 0,
        updatedAt: nowIso(),
      };
    }

    if (entity.statusIndex < lifecycle.length - 1) {
      entity.statusIndex += 1;
      entity.updatedAt = nowIso();
      storage.set(entity.analysisId, entity);
    }

    return toStatus(entity);
  },

  async getReport(input: { analysisId: string; selectedRole?: string }, meta?: RequestMeta): Promise<AnalysisReport> {
    await delay(450);
    const requestContext = prepareRequestContext(meta, config.getLanguage);

    const entity = storage.get(input.analysisId);
    const role = input.selectedRole ?? entity?.selectedRole ?? 'Contractor';
    const language = requestContext.language;

    void language;
    return buildReport(input.analysisId, role);
  },

  async listHistory(meta?: RequestMeta): Promise<HistoryItem[]> {
    await delay(200);
    prepareRequestContext(meta, config.getLanguage);
    return [...storage.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((entry) => toHistory(entry));
  },
});
