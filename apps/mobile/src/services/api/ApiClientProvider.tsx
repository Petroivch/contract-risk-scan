import type { PropsWithChildren } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { appConfig } from '../../config/appConfig';
import { useAppLanguage } from '../../i18n/LanguageProvider';
import { colors, spacing, typography } from '../../theme/tokens';
import { createApiClient } from './client';
import type { ContractRiskScannerApi } from '../../dto/api.dto';

const ApiClientContext = createContext<ContractRiskScannerApi | null>(null);

export const ApiClientProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const { language } = useAppLanguage();
  const effectiveTransport = appConfig.api.effectiveTransport;

  const client = useMemo(
    () =>
      createApiClient({
        baseUrl: appConfig.api.baseUrl,
        timeoutMs: appConfig.api.timeoutMs,
        transport: effectiveTransport,
        getLanguage: () => language,
      }),
    [effectiveTransport, language],
  );

  if (appConfig.api.configurationError) {
    return (
      <View style={styles.configurationErrorRoot}>
        <Text style={styles.configurationErrorTitle}>Runtime configuration error</Text>
        <Text style={styles.configurationErrorText}>{appConfig.api.configurationError}</Text>
      </View>
    );
  }

  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
};

export const useApiClient = (): ContractRiskScannerApi => {
  const context = useContext(ApiClientContext);
  if (!context) {
    throw new Error('useApiClient must be used inside ApiClientProvider.');
  }
  return context;
};

const styles = StyleSheet.create({
  configurationErrorRoot: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  configurationErrorTitle: {
    color: colors.danger,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  configurationErrorText: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
});

