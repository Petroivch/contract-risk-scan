import { appConfig } from '../config/appConfig';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { createStubApiClient } from './stubs';
import type {
  AnalysisReport,
  AnalysisStatus,
  ContractRiskScannerApi,
  DisputedClause,
  RequestContext,
  RequestMeta,
  RiskItem,
  UploadContractRequest,
} from './types';

export interface ApiClientConfig {
  baseUrl?: string;
  transport?: 'local' | 'stub' | 'http';
  getLanguage?: () => SupportedLanguage;
  timeoutMs?: number;
}

export class ApiClientNotImplementedError extends Error {
  constructor(
    message = 'Remote upload is disabled. Use local transport for on-device analysis.',
  ) {
    super(message);
    this.name = 'ApiClientNotImplementedError';
  }
}

class ApiClientHttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiClientHttpError';
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

const withTimeout = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

const ensureBaseUrl = (baseUrl?: string): string => {
  const normalized = (baseUrl ?? '').trim();
  if (!normalized) {
    throw new ApiClientHttpError('API_BASE_URL is required for HTTP transport.');
  }

  return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

const normalizeStatus = (value: unknown): AnalysisStatus['status'] => {
  return value === 'queued' || value === 'processing' || value === 'completed' || value === 'failed'
    ? value
    : 'queued';
};

const normalizeSeverity = (value: unknown): RiskItem['severity'] => {
  return value === 'high' || value === 'critical' ? 'high' : value === 'medium' ? 'medium' : 'low';
};

const joinUrl = (baseUrl: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseUrl).toString();

const readResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message?: unknown }).message)
        : response.statusText;
    throw new ApiClientHttpError(message, response.status);
  }

  return payload;
};

const mapRemoteStatus = (payload: {
  analysisId?: string;
  contractId?: string;
  status?: unknown;
  progress?: number;
  selectedRole?: string;
  role?: string;
  updatedAt?: string;
  uploadedAt?: string;
  errorMessage?: string;
}): AnalysisStatus => ({
  analysisId: payload.analysisId ?? payload.contractId ?? '',
  status: normalizeStatus(payload.status),
  progress:
    typeof payload.progress === 'number'
      ? payload.progress
      : normalizeStatus(payload.status) === 'completed'
        ? 100
        : 0,
  selectedRole: payload.selectedRole ?? payload.role ?? '',
  updatedAt: payload.updatedAt ?? payload.uploadedAt ?? new Date().toISOString(),
  errorMessage: payload.errorMessage,
});

const mapRemoteRisk = (risk: {
  id?: string;
  riskId?: string;
  clauseRef?: string;
  clauseRefs?: string[];
  title?: string;
  severity?: unknown;
  description?: string;
  roleImpact?: string;
  recommendation?: string;
}): RiskItem => ({
  id: risk.id ?? risk.riskId ?? `risk-${Date.now()}`,
  clauseRef: risk.clauseRef ?? 'overview',
  clauseRefs: risk.clauseRefs,
  title: risk.title ?? 'Risk',
  severity: normalizeSeverity(risk.severity),
  description: risk.description ?? risk.roleImpact ?? '',
  recommendation: risk.recommendation ?? '',
});

const mapRemoteDisputedClause = (item: {
  id?: string;
  clauseRef?: string;
  clauseText?: string;
  fragment?: string;
  whyDisputed?: string;
  issue?: string;
  suggestedRewrite?: string;
  recommendation?: string;
}): DisputedClause => ({
  id: item.id ?? `disputed-${Date.now()}`,
  clauseRef: item.clauseRef ?? 'overview',
  clauseText: item.clauseText ?? item.fragment,
  whyDisputed: item.whyDisputed ?? item.issue ?? '',
  suggestedRewrite: item.suggestedRewrite ?? item.recommendation ?? '',
});

const mapRemoteReport = (payload: {
  analysisId?: string;
  contractId?: string;
  selectedRole?: string;
  roleFocus?: string;
  summary?: AnalysisReport['summary'];
  risks?: Parameters<typeof mapRemoteRisk>[0][];
  disputedClauses?: Parameters<typeof mapRemoteDisputedClause>[0][];
  generatedAt?: string;
}): AnalysisReport => ({
  analysisId: payload.analysisId ?? payload.contractId ?? '',
  selectedRole: payload.selectedRole ?? payload.roleFocus ?? '',
  summary: payload.summary ?? {
    title: 'Contract analysis',
    contractType: 'General contract',
    shortDescription: '',
    obligationsForSelectedRole: [],
  },
  risks: (payload.risks ?? []).map(mapRemoteRisk),
  disputedClauses: (payload.disputedClauses ?? []).map(mapRemoteDisputedClause),
  generatedAt: payload.generatedAt ?? new Date().toISOString(),
});

// HTTP transport stays disabled at the factory, but the mapper is kept close to the API shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createHttpApiClient = (config: ApiClientConfig): ContractRiskScannerApi => {
  const baseUrl = ensureBaseUrl(config.baseUrl);
  const timeoutMs = config.timeoutMs ?? appConfig.api.timeoutMs;

  const requestJson = async <T>(
    path: string,
    init: RequestInit,
    meta?: RequestMeta,
  ): Promise<T> => {
    const requestContext = prepareRequestContext(meta, config.getLanguage);
    return withTimeout(async (signal) => {
      const response = await fetch(joinUrl(baseUrl, path), {
        ...init,
        signal,
        headers: {
          Accept: 'application/json',
          ...requestContext.headers,
          ...(init.headers ?? {}),
        },
      });

      return readResponse<T>(response);
    }, timeoutMs);
  };

  return {
    uploadContract: async (payload: UploadContractRequest, meta?: RequestMeta) => {
      const requestContext = prepareRequestContext(meta, config.getLanguage);
      const formData = new FormData();
      formData.append('role', payload.selectedRole);
      formData.append('locale', payload.language ?? requestContext.language);
      formData.append('language', payload.language ?? requestContext.language);

      if (!payload.localFileUri) {
        throw new ApiClientHttpError('localFileUri is required for HTTP upload.');
      }

      formData.append('file', {
        uri: payload.localFileUri,
        name: payload.fileName,
        type: payload.mimeType,
      } as unknown as Blob);

      const response = await requestJson<Parameters<typeof mapRemoteStatus>[0]>(
        'contracts/upload',
        {
          method: 'POST',
          body: formData,
          headers: requestContext.headers,
        },
        meta,
      );
      const status = mapRemoteStatus(response);

      return {
        analysisId: status.analysisId,
        status,
      };
    },

    getAnalysisStatus: async (analysisId: string, meta?: RequestMeta) => {
      return mapRemoteStatus(
        await requestJson<Parameters<typeof mapRemoteStatus>[0]>(
          `contracts/${analysisId}/status`,
          { method: 'GET' },
          meta,
        ),
      );
    },

    getReport: async (input, meta?: RequestMeta) => {
      return mapRemoteReport(
        await requestJson<Parameters<typeof mapRemoteReport>[0]>(
          `contracts/${input.analysisId}/report`,
          { method: 'GET' },
          meta,
        ),
      );
    },
  };
};

export const createApiClient = (config: ApiClientConfig = {}): ContractRiskScannerApi => {
  const transport = (config.transport ?? appConfig.api.transport) as 'local' | 'stub' | 'http';

  if (transport === 'local' || transport === 'stub') {
    return createStubApiClient({ getLanguage: config.getLanguage });
  }

  if (transport === 'http') {
    throw new ApiClientNotImplementedError();
  }

  throw new ApiClientNotImplementedError(`Unsupported API transport: ${transport}`);
};
