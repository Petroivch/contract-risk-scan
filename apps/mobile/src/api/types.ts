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

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
}

export interface UserSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  user: UserProfile;
}

export interface SignInRequest {
  email: string;
  password: string;
  language?: SupportedLanguage;
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
  selectedRole: string;
  updatedAt: string;
}

export interface RiskItem {
  id: string;
  severity: 'low' | 'medium' | 'high';
  clauseRef: string;
  title: string;
  description: string;
  recommendation: string;
}

export interface DisputedClause {
  id: string;
  clauseRef: string;
  whyDisputed: string;
  suggestedRewrite: string;
}

export interface ContractSummary {
  title: string;
  contractType: string;
  shortDescription: string;
  obligationsForSelectedRole: string[];
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
  signIn(payload: SignInRequest, meta?: RequestMeta): Promise<UserSession>;
  uploadContract(
    payload: UploadContractRequest,
    meta?: RequestMeta,
  ): Promise<{ analysisId: string; status: AnalysisStatus }>;
  getAnalysisStatus(analysisId: string, meta?: RequestMeta): Promise<AnalysisStatus>;
  getReport(input: { analysisId: string; selectedRole?: string }, meta?: RequestMeta): Promise<AnalysisReport>;
  listHistory(meta?: RequestMeta): Promise<HistoryItem[]>;
}
