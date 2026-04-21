import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { AnalysisStatus as AnalysisStatusType } from '../api/types';
import { RoleBadge } from '../components/RoleBadge';
import { ScreenShell } from '../components/layout/ScreenShell';
import { ActionButton } from '../components/ui/ActionButton';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import { appConfig } from '../config/appConfig';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AnalysisStatus'>;
type TimelineState = 'done' | 'active' | 'pending' | 'failed';

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

  const timeline = useMemo(() => {
    const currentStatus = status?.status ?? 'queued';
    const base = [
      { key: 'received', label: t('analysis.stageReceived') },
      { key: 'extracting', label: t('analysis.stageExtracting') },
      { key: 'scanning', label: t('analysis.stageScanning') },
      { key: 'scoring', label: t('analysis.stageScoring') },
      { key: 'report', label: t('analysis.stageReport') },
    ];

    return base.map((item, index) => {
      let state: TimelineState = 'pending';

      if (currentStatus === 'queued') {
        state = index === 0 ? 'active' : 'pending';
      } else if (currentStatus === 'processing') {
        if (index < 2) {
          state = 'done';
        } else if (index === 2) {
          state = 'active';
        }
      } else if (currentStatus === 'completed') {
        state = 'done';
      } else if (currentStatus === 'failed') {
        if (index < 2) {
          state = 'done';
        } else if (index === 2) {
          state = 'failed';
        }
      }

      return { ...item, state };
    });
  }, [status?.status, t]);

  const openReport = (): void => {
    navigation.navigate('Report', {
      analysisId,
      selectedRole,
    });
  };

  const statusTone = status?.status === 'completed'
    ? 'success'
    : status?.status === 'failed'
      ? 'danger'
      : status?.status === 'processing'
        ? 'info'
        : 'warning';

  return (
    <ScreenShell title={t('analysis.title')} subtitle={t('analysis.analysisId', { analysisId })} scroll>
      <Panel
        eyebrow={t('analysis.timelineEyebrow')}
        title={t('analysis.timelineTitle')}
        description={t('analysis.timelineDescription')}
        rightSlot={<RoleBadge role={selectedRole} size="compact" />}
      >
        <View style={styles.statusSummaryRow}>
          <StatusChip label={t(`status.${status?.status ?? 'queued'}`)} tone={statusTone} />
          <StatusChip label={t('analysis.progress', { progress: status?.progress ?? 0 })} tone="neutral" />
        </View>

        <View style={styles.timelineList}>
          {timeline.map((item) => (
            <View key={item.key} style={styles.timelineRow}>
              <View
                style={[
                  styles.timelineMarker,
                  item.state === 'done' ? styles.timelineDone : null,
                  item.state === 'active' ? styles.timelineActive : null,
                  item.state === 'failed' ? styles.timelineFailed : null,
                ]}
              />
              <Text style={[styles.timelineText, item.state === 'active' ? styles.timelineTextActive : null]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.helperText}>
          {status?.status === 'completed'
            ? t('analysis.completedHint')
            : status?.status === 'failed'
              ? t('analysis.failedHint')
              : t('analysis.pollingHint')}
        </Text>
      </Panel>

      <View style={styles.actionStack}>
        <ActionButton label={t('analysis.refreshNow')} onPress={refreshStatus} variant="secondary" />
        <ActionButton label={t('analysis.openReport')} onPress={openReport} disabled={status?.status !== 'completed'} />
        <ActionButton label={t('common.openHistory')} onPress={() => navigation.navigate('History')} variant="ghost" />
      </View>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  statusSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timelineList: {
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  timelineMarker: {
    width: 14,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.divider,
  },
  timelineDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  timelineActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timelineFailed: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  timelineText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  timelineTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  actionStack: {
    gap: spacing.sm,
  },
});
