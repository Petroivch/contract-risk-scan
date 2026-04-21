import type { SupportedLanguage } from '../i18n/types';

export type AnalysisLifecycleStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type PipelineStatus = 'uploaded' | 'queued' | 'preprocessing' | 'analyzing' | 'report_ready' | 'failed';

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
  counterpartyRole?: string;
  contractLabel?: string;
  localFileUri?: string;
  rawText?: string;
  language?: SupportedLanguage;
}

export interface UploadContractResponse {
  contractId: string;
  analysisId: string;
  status: AnalysisLifecycleStatus;
  pipelineStatus: PipelineStatus;
  locale: SupportedLanguage;
  selectedRole: string;
  progress: number;
  originalFileName: string;
  uploadedAt: string;
}

export interface AnalyzeContractRequest {
  contractId: string;
  analysisId?: string;
  selectedRole: string;
  focusNotes?: string;
}

export interface AnalyzeContractResponse {
  contractId: string;
  analysisId: string;
  status: AnalysisLifecycleStatus;
  pipelineStatus: PipelineStatus;
  locale: SupportedLanguage;
  selectedRole: string;
  progress: number;
  message: string;
}

export interface AnalysisStatusRequest {
  contractId: string;
  analysisId?: string;
}

export interface AnalysisStatus {
  contractId: string;
  analysisId: string;
  status: AnalysisLifecycleStatus;
  pipelineStatus: PipelineStatus;
  locale: SupportedLanguage;
  progress: number;
  selectedRole: string;
  allowedTransitions: PipelineStatus[];
  updatedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface RiskItem {
  id: string;
  severity: 'low' | 'medium' | 'high';
  clauseRef: string;
  title: string;
  description: string;
  roleImpact?: string;
  recommendation: string;
}

export interface DisputedClause {
  id: string;
  clauseRef: string;
  fragment?: string;
  issue?: string;
  recommendation?: string;
  whyDisputed: string;
  suggestedRewrite: string;
}

export interface ContractSummary {
  title: string;
  contractType: string;
  shortDescription: string;
  obligationsForSelectedRole: string[];
}

export interface ContractObligation {
  subject: string;
  action: string;
  dueCondition: string;
}

export interface AnalysisReport {
  contractId: string;
  analysisId: string;
  locale: SupportedLanguage;
  roleFocus?: string;
  selectedRole: string;
  summary: ContractSummary;
  summaryText?: string;
  obligations: ContractObligation[];
  risks: RiskItem[];
  disputedClauses: DisputedClause[];
  generatedAt: string;
  generationNotes?: string | null;
}

export interface ReportRequest {
  contractId: string;
  analysisId?: string;
  selectedRole?: string;
}

export interface HistoryItem {
  contractId: string;
  analysisId: string;
  role: string;
  selectedRole: string;
  locale: SupportedLanguage;
  status: AnalysisLifecycleStatus;
  pipelineStatus: PipelineStatus;
  originalFileName: string;
  fileName: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueuedUploadItem {
  contractId: string;
  analysisId: string;
  fileName: string;
  mimeType: string;
  selectedRole: string;
  localFileUri: string;
  contractLabel?: string;
  counterpartyRole?: string;
  language: SupportedLanguage;
  createdAt: string;
  updatedAt: string;
}

export interface ContractRiskScannerApi {
  signIn(payload: SignInRequest, meta?: RequestMeta): Promise<UserSession>;
  uploadContract(payload: UploadContractRequest, meta?: RequestMeta): Promise<UploadContractResponse>;
  analyzeContract(payload: AnalyzeContractRequest, meta?: RequestMeta): Promise<AnalyzeContractResponse>;
  getAnalysisStatus(input: AnalysisStatusRequest, meta?: RequestMeta): Promise<AnalysisStatus>;
  getReport(input: ReportRequest, meta?: RequestMeta): Promise<AnalysisReport>;
  listHistory(meta?: RequestMeta): Promise<HistoryItem[]>;
}
