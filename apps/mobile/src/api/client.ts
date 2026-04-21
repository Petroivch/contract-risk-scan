import { appConfig } from '../config/appConfig';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { createStubApiClient } from './stubs';
import type {
  AnalysisReport,
  AnalysisStatus,
  AnalyzeContractRequest,
  AnalyzeContractResponse,
  ContractRiskScannerApi,
  HistoryItem,
  RequestContext,
  RequestMeta,
  SignInRequest,
  UploadContractRequest,
  UploadContractResponse,
  UserSession,
} from './types';

export interface ApiClientConfig {
  baseUrl?: string;
  transport?: 'stub' | 'http';
  getLanguage?: () => SupportedLanguage;
  timeoutMs?: number;
}

export class ApiClientNotImplementedError extends Error {
  constructor(message = 'HTTP transport is not implemented yet. Use stub transport for Stage 1.') {
    super(message);
    this.name = 'ApiClientNotImplementedError';
  }
}

export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.payload = payload;
  }
}

const resolveLanguage = (
  metaLanguage: SupportedLanguage | undefined,
  fallback?: () => SupportedLanguage,
): SupportedLanguage => {
  return metaLanguage ?? fallback?.() ?? defaultLanguage;
};

export const prepareRequestContext = (
  meta: RequestMeta | undefined,
  fallbackLanguage?: () => SupportedLanguage,
): RequestContext => {
  const language = resolveLanguage(meta?.language, fallbackLanguage);

  return {
    language,
    headers: {
      'Accept-Language': language,
      'X-Client-Language': language,
      ...(meta?.headers ?? {}),
    },
  };
};

const joinUrl = (baseUrl: string, path: string): string => {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const createTimeoutSignal = (timeoutMs: number): AbortSignal => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
};

const normalizeHistory = (payload: { items?: HistoryItem[] } | HistoryItem[]): HistoryItem[] => {
  return Array.isArray(payload) ? payload : payload.items ?? [];
};

const createHttpApiClient = (config: ApiClientConfig): ContractRiskScannerApi => {
  const baseUrl = config.baseUrl ?? appConfig.api.baseUrl;
  const timeoutMs = config.timeoutMs ?? appConfig.api.timeoutMs;

  const requestJson = async <T>(path: string, init: RequestInit, meta?: RequestMeta): Promise<T> => {
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    const response = await fetch(joinUrl(baseUrl, path), {
      ...init,
      headers: {
        ...requestContext.headers,
        ...(init.headers ?? {}),
      },
      signal: createTimeoutSignal(timeoutMs),
    });

    const responseText = await response.text();
    const payload = responseText ? JSON.parse(responseText) : null;

    if (!response.ok) {
      const message = isPlainObject(payload) && typeof payload.message === 'string' ? payload.message : 'API request failed.';
      throw new ApiRequestError(response.status, message, payload);
    }

    return payload as T;
  };

  const appendFile = (formData: FormData, payload: UploadContractRequest): void => {
    if (payload.localFileUri) {
      formData.append('file', {
        uri: payload.localFileUri,
        name: payload.fileName,
        type: payload.mimeType,
      } as unknown as Blob);
      return;
    }

    if (payload.rawText) {
      const blob = new Blob([payload.rawText], { type: payload.mimeType || 'text/plain' });
      formData.append('file', blob, payload.fileName);
      return;
    }

    throw new Error('Upload requires either localFileUri or rawText.');
  };

  return {
    async signIn(payload: SignInRequest, meta?: RequestMeta): Promise<UserSession> {
      void meta;
      return createStubApiClient({ getLanguage: config.getLanguage }).signIn(payload);
    },

    async uploadContract(payload: UploadContractRequest, meta?: RequestMeta): Promise<UploadContractResponse> {
      const requestContext = prepareRequestContext(meta, config.getLanguage);
      const formData = new FormData();
      formData.append('role', payload.selectedRole);
      formData.append('locale', payload.language ?? requestContext.language);
      if (payload.counterpartyRole) {
        formData.append('counterpartyRole', payload.counterpartyRole);
      }
      if (payload.contractLabel) {
        formData.append('contractLabel', payload.contractLabel);
      }
      appendFile(formData, payload);

      return requestJson<UploadContractResponse>('contracts/upload', {
        method: 'POST',
        body: formData,
      }, meta);
    },

    async analyzeContract(payload: AnalyzeContractRequest, meta?: RequestMeta): Promise<AnalyzeContractResponse> {
      const requestContext = prepareRequestContext(meta, config.getLanguage);
      return requestJson<AnalyzeContractResponse>(`contracts/${payload.contractId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locale: requestContext.language,
          focusNotes: payload.focusNotes,
        }),
      }, meta);
    },

    async getAnalysisStatus(input, meta?: RequestMeta): Promise<AnalysisStatus> {
      return requestJson<AnalysisStatus>(`contracts/${input.contractId}/status`, {
        method: 'GET',
      }, meta);
    },

    async getReport(input, meta?: RequestMeta): Promise<AnalysisReport> {
      return requestJson<AnalysisReport>(`contracts/${input.contractId}/report`, {
        method: 'GET',
      }, meta);
    },

    async listHistory(meta?: RequestMeta): Promise<HistoryItem[]> {
      const response = await requestJson<{ items?: HistoryItem[] } | HistoryItem[]>('contracts/history', {
        method: 'GET',
      }, meta);
      return normalizeHistory(response);
    },
  };
};

export const createApiClient = (config: ApiClientConfig = {}): ContractRiskScannerApi => {
  const transport = (config.transport ?? appConfig.api.transport) as 'stub' | 'http';

  if (transport === 'stub') {
    return createStubApiClient({ getLanguage: config.getLanguage });
  }

  if (transport === 'http') {
    return createHttpApiClient(config);
  }

  throw new ApiClientNotImplementedError();
};
