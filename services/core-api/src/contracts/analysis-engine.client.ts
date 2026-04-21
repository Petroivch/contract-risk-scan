import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYSIS_ENGINE_POLICY } from '../common/policies/analysis-engine.policy';
import { SupportedLocale } from '../common/i18n/supported-locale.enum';
import { AppConfig } from '../config/app-config.type';

export interface AnalyzeEnginePayload {
  contractId: string;
  documentName: string;
  role: string;
  counterpartyRole?: string;
  locale: SupportedLocale;
  focusNotes?: string;
  documentText?: string;
  documentBase64?: string;
  mimeType?: string;
}

type RemoteAnalysisStatus = 'queued' | 'processing' | 'completed' | 'failed';

interface RemoteRunResponse {
  job_id: string;
  status: RemoteAnalysisStatus;
}

interface RemoteStatusResponse {
  job_id: string;
  status: RemoteAnalysisStatus;
  error_message?: string | null;
}

export interface AnalysisEngineRiskItem {
  risk_id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  clause_id?: string | null;
  description: string;
  role_relevance: string;
  mitigation: string;
}

export interface AnalysisEngineDisputedClauseItem {
  clause_id: string;
  clause_excerpt: string;
  dispute_reason: string;
  possible_consequence: string;
  confidence: number;
}

export interface AnalysisEngineRoleFocusedSummary {
  role: string;
  overview: string;
  must_do: string[];
  should_review: string[];
  payment_terms: string[];
  deadlines: string[];
  penalties: string[];
}

export interface AnalysisEngineExecutionPlan {
  mode: string;
  offline_capable: boolean;
  network_required: boolean;
  policy_source: string;
  reason: string;
}

export interface AnalysisEngineOutput {
  language: string;
  locale: string;
  execution_plan: AnalysisEngineExecutionPlan;
  contract_brief: string;
  risks: AnalysisEngineRiskItem[];
  disputed_clauses: AnalysisEngineDisputedClauseItem[];
  role_focused_summary: AnalysisEngineRoleFocusedSummary;
}

interface RemoteResultResponse {
  job_id: string;
  status: RemoteAnalysisStatus;
  result?: AnalysisEngineOutput | null;
  error_message?: string | null;
}

export interface AnalysisEngineRunResult {
  jobId: string;
  status: RemoteAnalysisStatus;
}

export interface AnalysisEngineStatusResult {
  jobId: string;
  status: RemoteAnalysisStatus;
  errorMessage?: string | null;
}

export interface AnalysisEngineResult {
  jobId: string;
  status: RemoteAnalysisStatus;
  result?: AnalysisEngineOutput;
  errorMessage?: string | null;
}

export class AnalysisEngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisEngineUnavailableError';
  }
}

@Injectable()
export class AnalysisEngineClient {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async runAnalysis(payload: AnalyzeEnginePayload): Promise<AnalysisEngineRunResult> {
    this.assertEnabled();

    const response = await this.request<RemoteRunResponse>(
      ANALYSIS_ENGINE_POLICY.RUN_PATH,
      {
        method: 'POST',
        body: JSON.stringify({
          document_name: payload.documentName,
          role_context: {
            role: payload.role,
            counterparty_role: payload.counterpartyRole ?? null
          },
          document_text: payload.documentText,
          document_base64: payload.documentBase64,
          mime_type: payload.mimeType,
          language: payload.locale,
          locale: payload.locale
        })
      },
      payload.locale
    );

    return {
      jobId: response.job_id,
      status: response.status
    };
  }

  async getAnalysisStatus(
    jobId: string,
    locale: SupportedLocale
  ): Promise<AnalysisEngineStatusResult> {
    this.assertEnabled();

    const response = await this.request<RemoteStatusResponse>(
      ANALYSIS_ENGINE_POLICY.STATUS_PATH(jobId),
      {
        method: 'GET'
      },
      locale
    );

    return {
      jobId: response.job_id,
      status: response.status,
      errorMessage: response.error_message ?? null
    };
  }

  async getAnalysisResult(
    jobId: string,
    locale: SupportedLocale
  ): Promise<AnalysisEngineResult> {
    this.assertEnabled();

    const response = await this.request<RemoteResultResponse>(
      ANALYSIS_ENGINE_POLICY.RESULT_PATH(jobId),
      {
        method: 'GET'
      },
      locale
    );

    return {
      jobId: response.job_id,
      status: response.status,
      result: response.result ?? undefined,
      errorMessage: response.error_message ?? null
    };
  }

  private async request<T>(
    resourcePath: string,
    init: RequestInit,
    locale: SupportedLocale
  ): Promise<T> {
    const baseUrl = this.configService.get('analysisEngine.baseUrl', { infer: true });
    const url = new URL(resourcePath, this.ensureTrailingSlash(baseUrl)).toString();
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.configService.get('analysisEngine.requestTimeoutMs', { infer: true })
    );

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Accept-Language': locale,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init.headers ?? {})
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AnalysisEngineUnavailableError(
          `analysis-engine request failed (${response.status}): ${errorText || response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AnalysisEngineUnavailableError) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Unknown analysis-engine transport error';
      throw new AnalysisEngineUnavailableError(message);
    } finally {
      clearTimeout(timeout);
    }
  }

  private assertEnabled(): void {
    if (!this.configService.get('analysisEngine.enabled', { infer: true })) {
      throw new AnalysisEngineUnavailableError('analysis-engine integration is disabled');
    }
  }

  private ensureTrailingSlash(baseUrl: string): string {
    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }
}
