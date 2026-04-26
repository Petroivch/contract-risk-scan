import type { SupportedLanguage } from '../i18n/types';

export type AnalysisLifecycleStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface RequestMeta {
  language?: SupportedLanguage;
  headers?: Record<string, string>;
}

export interface RequestContext {
  language: SupportedLanguage;
  headers: Record<string, string>;
}

export interface UploadContractRequest {
  fileName: string;
  mimeType: string;
  selectedRole: string;
  localFileUri?: string;
  rawText?: string;
  language?: SupportedLanguage;
}

export interface AnalysisStatus {
  analysisId: string;
  status: AnalysisLifecycleStatus;
  progress: number;
  stage?: 'queued' | 'extracting' | 'analyzing' | 'finalizing';
  selectedRole: string;
  updatedAt: string;
  errorMessage?: string;
}

export interface RiskItem {
  id: string;
  severity: 'low' | 'medium' | 'high';
  clauseRef: string;
  clauseRefs?: string[];
  occurrences?: number;
  evidence?: string[];
  groupId?: string;
  title: string;
  description: string;
  recommendation: string;
}

export interface DisputedClause {
  id: string;
  clauseRef: string;
  clauseText?: string;
  whyDisputed: string;
  suggestedRewrite: string;
}

export interface ContractSummary {
  title: string;
  contractType: string;
  shortDescription: string;
  obligationsForSelectedRole: string[];
  roleFound?: boolean;
}

export interface AnalysisReport {
  analysisId: string;
  selectedRole: string;
  summary: ContractSummary;
  risks: RiskItem[];
  disputedClauses: DisputedClause[];
  generatedAt: string;
}

export interface HistoryItem {
  analysisId: string;
  fileName: string;
  selectedRole: string;
  status: AnalysisLifecycleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface QueuedUploadItem {
  analysisId: string;
  fileName: string;
  mimeType: string;
  selectedRole: string;
  localFileUri: string;
  language: SupportedLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface ContractRiskScannerApi {
  uploadContract(
    payload: UploadContractRequest,
    meta?: RequestMeta,
  ): Promise<{ analysisId: string; status: AnalysisStatus }>;
  getAnalysisStatus(analysisId: string, meta?: RequestMeta): Promise<AnalysisStatus>;
  getReport(
    input: { analysisId: string; selectedRole?: string },
    meta?: RequestMeta,
  ): Promise<AnalysisReport>;
  listHistory(meta?: RequestMeta): Promise<HistoryItem[]>;
}
