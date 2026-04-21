import { appConfig } from '../config/appConfig';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { createStubApiClient } from './stubs';
import type { ContractRiskScannerApi, RequestContext, RequestMeta } from './types';

export interface ApiClientConfig {
  baseUrl?: string;
  transport?: 'local' | 'stub' | 'http';
  getLanguage?: () => SupportedLanguage;
  timeoutMs?: number;
}

export class ApiClientNotImplementedError extends Error {
  constructor(message = 'HTTP transport is not implemented yet. Use local transport for offline mobile runs.') {
    super(message);
    this.name = 'ApiClientNotImplementedError';
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

export const createApiClient = (config: ApiClientConfig = {}): ContractRiskScannerApi => {
  const transport = (config.transport ?? appConfig.api.transport) as 'local' | 'stub' | 'http';

  if (transport === 'local' || transport === 'stub') {
    return createStubApiClient({ getLanguage: config.getLanguage });
  }

  throw new ApiClientNotImplementedError();
};
