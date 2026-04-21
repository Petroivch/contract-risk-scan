import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { AnalysisStatus as AnalysisStatusType } from '../api/types';
import { RoleBadge } from '../components/RoleBadge';
import { ScreenShell } from '../components/layout/ScreenShell';
import { appConfig } from '../config/appConfig';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AnalysisStatus'>;

export const AnalysisStatusScreen = ({ navigation, route }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const api = useApiClient();
  const { analysisId, selectedRole } = route.params;
  const [status, setStatus] = useState<AnalysisStatusType | null>(null);

  const refreshStatus = useCallback(async () => {
    const nextStatus = await api.getAnalysisStatus(analysisId, { language });
    setStatus(nextStatus);
  }, [analysisId, api, language]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (status?.status === 'completed' || status?.status === 'failed') {
      return;
    }

    const timer = setInterval(() => {
      refreshStatus();
    }, appConfig.api.statusPollIntervalMs);

    return () => clearInterval(timer);
  }, [refreshStatus, status?.status]);

  const openReport = (): void => {
    navigation.navigate('Report', {
      analysisId,
      selectedRole,
    });
  };

  return (
    <ScreenShell title={t('analysis.title')} subtitle={t('analysis.analysisId', { analysisId })}>
      <View style={styles.statusCard}>
        <RoleBadge role={selectedRole} />
        <Text style={styles.statusLabel}>{t('analysis.status')}</Text>
        <Text style={styles.statusValue}>{t(`status.${status?.status ?? 'queued'}`)}</Text>
        <Text style={styles.statusProgress}>{t('analysis.progress', { progress: status?.progress ?? 0 })}</Text>
      </View>

      <Pressable style={styles.secondaryButton} onPress={refreshStatus}>
        <Text style={styles.secondaryButtonText}>{t('analysis.refreshNow')}</Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, status?.status !== 'completed' && styles.disabled]}
        onPress={openReport}
        disabled={status?.status !== 'completed'}
      >
        <Text style={styles.primaryButtonText}>{t('analysis.openReport')}</Text>
      </Pressable>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  statusLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusValue: {
    color: colors.textPrimary,
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.bold,
  },
  statusProgress: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.raised,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.accentStrong,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.textOnAccent,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
  },
});
