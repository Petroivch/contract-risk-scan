import type { PropsWithChildren} from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';

import { appConfig } from '../config/appConfig';
import { featureFlags } from '../config/featureFlags';
import { SQLiteLocalCache } from '../data/local/sqlite/SQLiteLocalCache';
import { useAppLanguage } from '../i18n/LanguageProvider';
import { createApiClient } from './client';
import { createLocalFirstAdapter } from './localFirstAdapter';
import { createStubApiClient } from './stubs';
import type { ContractRiskScannerApi } from './types';

const ApiClientContext = createContext<ContractRiskScannerApi | null>(null);

export const ApiClientProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const { language } = useAppLanguage();

  const localCache = useMemo(() => new SQLiteLocalCache(), []);

  useEffect(() => {
    if (featureFlags.localFirstCache && featureFlags.sqliteCache) {
      localCache.initialize().catch(() => {
        // Keep UI alive even if local cache init fails.
      });
    }
  }, [localCache]);

  const remoteClient = useMemo(
    () =>
      createApiClient({
        baseUrl: appConfig.api.baseUrl,
        timeoutMs: appConfig.api.timeoutMs,
        transport: appConfig.api.transport as 'stub' | 'http',
        getLanguage: () => language,
      }),
    [language],
  );

  const fallbackClient = useMemo(
    () =>
      createStubApiClient({
        getLanguage: () => language,
      }),
    [language],
  );

  const client = useMemo(() => {
    if (!featureFlags.localFirstCache) {
      return remoteClient;
    }

    return createLocalFirstAdapter(remoteClient, fallbackClient, localCache, {
      enableLocalFirst: true,
    });
  }, [fallbackClient, localCache, remoteClient]);

  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
};

export const useApiClient = (): ContractRiskScannerApi => {
  const context = useContext(ApiClientContext);
  if (!context) {
    throw new Error('useApiClient must be used inside ApiClientProvider.');
  }
  return context;
};
