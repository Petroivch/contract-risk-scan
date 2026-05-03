import type { PropsWithChildren} from 'react';
import { createContext, useContext, useMemo } from 'react';

import { appConfig } from '../config/appConfig';
import { useAppLanguage } from '../i18n/LanguageProvider';
import { createApiClient } from './client';
import type { ContractRiskScannerApi } from './types';

const ApiClientContext = createContext<ContractRiskScannerApi | null>(null);

export const ApiClientProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const { language } = useAppLanguage();
  const effectiveTransport =
    appConfig.api.transport === 'http' && appConfig.api.baseUrl.trim().length === 0
      ? 'local'
      : appConfig.api.transport;

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: appConfig.api.baseUrl,
        timeoutMs: appConfig.api.timeoutMs,
        transport: effectiveTransport as 'local' | 'stub' | 'http',
        getLanguage: () => language,
      }),
    [effectiveTransport, language],
  );

  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
};

export const useApiClient = (): ContractRiskScannerApi => {
  const context = useContext(ApiClientContext);
  if (!context) {
    throw new Error('useApiClient must be used inside ApiClientProvider.');
  }
  return context;
};
