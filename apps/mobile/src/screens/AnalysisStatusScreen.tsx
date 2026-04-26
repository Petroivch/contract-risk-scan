import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { AnalysisStatus as AnalysisStatusType } from '../api/types';
import { RoleBadge } from '../components/RoleBadge';
import { StatusChip } from '../components/StatusChip';
import { ScreenShell } from '../components/layout/ScreenShell';
import { appConfig } from '../config/appConfig';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AnalysisStatus'>;

type StepState = 'done' | 'active' | 'pending' | 'error';

interface TimelineStep {
  title: string;
  detail: string;
  state: StepState;
}

const statusToneMap = {
  queued: 'brand',
  processing: 'warning',
  completed: 'success',
  failed: 'danger',
} as const;

const stepStateToneMap: Record<StepState, 'brand' | 'success' | 'warning' | 'danger' | 'neutral'> =
  {
    done: 'success',
    active: 'brand',
    pending: 'neutral',
    error: 'danger',
  };

const stageLabels: Record<NonNullable<AnalysisStatusType['stage']>, Record<string, string>> = {
  queued: {
    ru: 'Ожидает локальной обработки',
    it: 'In attesa dell elaborazione locale',
    fr: 'En attente du traitement local',
    en: 'Waiting for local processing',
  },
  extracting: {
    ru: 'Извлекаем текст из файла',
    it: 'Estrazione del testo dal file',
    fr: 'Extraction du texte du fichier',
    en: 'Extracting text from the file',
  },
  analyzing: {
    ru: 'Ищем условия и риски',
    it: 'Ricerca di clausole e rischi',
    fr: 'Recherche des clauses et risques',
    en: 'Finding clauses and risks',
  },
  finalizing: {
    ru: 'Собираем отчет',
    it: 'Preparazione del report',
    fr: 'Preparation du rapport',
    en: 'Preparing the report',
  },
};

const getStageLabel = (
  stage: AnalysisStatusType['stage'],
  language: string,
): string | null => {
  if (!stage) {
    return null;
  }

  const labels = stageLabels[stage];
  return labels[language] ?? labels.en;
};

export const AnalysisStatusScreen = ({ navigation, route }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const api = useApiClient();
  const { analysisId, selectedRole } = route.params;
  const [status, setStatus] = useState<AnalysisStatusType | null>(null);
  const [reportPrefetchFailed, setReportPrefetchFailed] = useState(false);
  const didNavigateToReport = useRef(false);

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

  useEffect(() => {
    if (status?.status !== 'completed' || didNavigateToReport.current) {
      return;
    }

    let cancelled = false;

    const openReadyReport = async (): Promise<void> => {
      try {
        await api.getReport({ analysisId, selectedRole }, { language });
        if (cancelled) {
          return;
        }

        didNavigateToReport.current = true;
        navigation.replace('Report', {
          analysisId,
          selectedRole,
        });
      } catch {
        if (!cancelled) {
          setReportPrefetchFailed(true);
          setTimeout(
            () => {
              if (!cancelled) {
                void openReadyReport();
              }
            },
            Math.min(appConfig.api.statusPollIntervalMs, 1500),
          );
        }
      }
    };

    void openReadyReport();

    return () => {
      cancelled = true;
    };
  }, [analysisId, api, language, navigation, selectedRole, status?.status]);

  const updatedAtLabel = useMemo(() => {
    if (!status?.updatedAt) {
      return '—';
    }

    const parsedDate = new Date(status.updatedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return status.updatedAt;
    }

    return parsedDate.toLocaleString(language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [language, status?.updatedAt]);

  const stageLabel = useMemo(
    () => getStageLabel(status?.stage, language),
    [language, status?.stage],
  );
  const progress = Math.max(0, Math.min(status?.progress ?? 0, 100));

  const timeline = useMemo<TimelineStep[]>(() => {
    const activeStatus = status?.status ?? 'queued';

    if (activeStatus === 'failed') {
      return [
        {
          title: t('analysis.timelineAccepted'),
          detail: t('analysis.stepStateCompleted'),
          state: 'done',
        },
        {
          title: t('analysis.timelineProcessing'),
          detail: t('analysis.stepStateFailed'),
          state: 'error',
        },
        {
          title: t('analysis.timelineReady'),
          detail: t('analysis.stepStatePending'),
          state: 'pending',
        },
      ];
    }

    if (activeStatus === 'completed') {
      return [
        {
          title: t('analysis.timelineAccepted'),
          detail: t('analysis.stepStateCompleted'),
          state: 'done',
        },
        {
          title: t('analysis.timelineProcessing'),
          detail: t('analysis.stepStateCompleted'),
          state: 'done',
        },
        {
          title: t('analysis.timelineReady'),
          detail: t('analysis.stepStateCompleted'),
          state: 'done',
        },
      ];
    }

    if (activeStatus === 'processing') {
      return [
        {
          title: t('analysis.timelineAccepted'),
          detail: t('analysis.stepStateCompleted'),
          state: 'done',
        },
        {
          title: t('analysis.timelineProcessing'),
          detail: t('analysis.stepStateProcessing'),
          state: 'active',
        },
        {
          title: t('analysis.timelineReady'),
          detail: t('analysis.stepStatePending'),
          state: 'pending',
        },
      ];
    }

    return [
      {
        title: t('analysis.timelineAccepted'),
        detail: t('analysis.stepStateQueued'),
        state: 'active',
      },
      {
        title: t('analysis.timelineProcessing'),
        detail: t('analysis.stepStatePending'),
        state: 'pending',
      },
      {
        title: t('analysis.timelineReady'),
        detail: t('analysis.stepStatePending'),
        state: 'pending',
      },
    ];
  }, [status?.status, t]);

  return (
    <ScreenShell
      title={t('analysis.title')}
      subtitle={t('analysis.analysisId', { analysisId })}
      scroll
    >
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>{t('analysis.panelKicker')}</Text>
            <Text style={styles.heroTitle}>{t('analysis.panelTitle')}</Text>
            <Text style={styles.heroSubtitle}>{t('analysis.panelSubtitle')}</Text>
          </View>
          <StatusChip
            label={t(`status.${status?.status ?? 'queued'}`)}
            tone={statusToneMap[status?.status ?? 'queued']}
          />
        </View>

        <View style={styles.metricRow}>
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>{t('analysis.progressLabel')}</Text>
            <Text style={styles.metricValue}>{`${progress}%`}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            {stageLabel ? <Text style={styles.stageLabel}>{stageLabel}</Text> : null}
          </View>
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>{t('analysis.updatedAtLabel')}</Text>
            <Text style={styles.metricValue}>{updatedAtLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('analysis.timelineTitle')}</Text>
          <RoleBadge role={selectedRole} />
        </View>

        <View style={styles.timeline}>
          {timeline.map((step, index) => (
            <View key={step.title} style={styles.timelineRow}>
              <View style={styles.timelineMarkerColumn}>
                <View style={[styles.timelineDot, styles[`timelineDot_${step.state}`]]} />
                {index < timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>

              <View style={styles.timelineContent}>
                <View style={styles.timelineContentHeader}>
                  <Text style={styles.timelineTitle}>{step.title}</Text>
                  <StatusChip label={step.detail} tone={stepStateToneMap[step.state]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
      {reportPrefetchFailed ? (
        <View style={styles.inlineNotice}>
          <Text style={styles.inlineNoticeText}>
            {language === 'ru'
              ? 'Не удалось подготовить отчет с первого раза. Пробуем восстановить данные автоматически.'
              : language === 'it'
                ? 'Non e stato possibile preparare subito il report. Proviamo a ripristinare i dati automaticamente.'
                : language === 'fr'
                  ? 'Le rapport n a pas pu etre prepare du premier coup. Nous tentons de restaurer les donnees automatiquement.'
                  : 'The report could not be prepared on the first attempt. We are trying to restore the data automatically.'}
          </Text>
        </View>
      ) : null}
      {status?.status === 'failed' && status.errorMessage ? (
        <View style={styles.inlineNotice}>
          <Text style={styles.inlineNoticeText}>{status.errorMessage}</Text>
        </View>
      ) : null}
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.raised,
  },
  heroHeader: {
    flexDirection: 'column',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  heroKicker: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricBlock: {
    flex: 1,
    minWidth: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  stageLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
  },
  statusCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
    flex: 1,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timelineMarkerColumn: {
    alignItems: 'center',
    width: 18,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  timelineDot_done: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  timelineDot_active: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  timelineDot_pending: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  timelineDot_error: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.divider,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.xxs,
  },
  timelineContentHeader: {
    gap: spacing.xs,
  },
  timelineTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.semibold,
  },
  inlineNotice: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    ...shadow.card,
  },
  inlineNoticeText: {
    color: colors.textSecondary,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
});
