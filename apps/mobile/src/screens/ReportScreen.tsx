import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { AnalysisReport } from '../api/types';
import { DisputedCard } from '../components/cards/DisputedCard';
import { RiskCard } from '../components/cards/RiskCard';
import { RoleBadge } from '../components/RoleBadge';
import { StatusChip } from '../components/StatusChip';
import { ScreenShell } from '../components/layout/ScreenShell';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;
type ReportTab = 'summary' | 'risks' | 'disputed';

const riskRank: Record<'low' | 'medium' | 'high', number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export const ReportScreen = ({ route }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const api = useApiClient();

  const { analysisId, selectedRole } = route.params;
  const [activeTab, setActiveTab] = useState<ReportTab>('summary');
  const [report, setReport] = useState<AnalysisReport | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const nextReport = await api.getReport({ analysisId, selectedRole }, { language });
      setReport(nextReport);
    };

    load();
  }, [analysisId, api, language, selectedRole]);

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'summary', label: t('report.tabs.summary') },
    { id: 'risks', label: t('report.tabs.risks') },
    { id: 'disputed', label: t('report.tabs.disputed') },
  ];

  const sortedRisks = useMemo(() => {
    return [...(report?.risks ?? [])].sort((left, right) => riskRank[left.severity] - riskRank[right.severity]);
  }, [report?.risks]);

  const generatedAtLabel = useMemo(() => {
    if (!report?.generatedAt) {
      return '—';
    }

    const parsedDate = new Date(report.generatedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return report.generatedAt;
    }

    return parsedDate.toLocaleString(language, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }, [language, report?.generatedAt]);

  const obligationsCount = report?.summary.obligationsForSelectedRole.length ?? 0;
  const risksCount = report?.risks.length ?? 0;
  const disputedCount = report?.disputedClauses.length ?? 0;

  return (
    <ScreenShell title={t('report.title')} subtitle={t('report.analysisId', { analysisId })} scroll>
      <View style={styles.summaryStrip}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryKicker}>{t('report.summaryKicker')}</Text>
            <Text style={styles.summaryTitle}>{report?.summary.title ?? t('common.loading')}</Text>
            <Text style={styles.summaryText}>{report?.summary.shortDescription ?? ''}</Text>
          </View>
          <StatusChip label={t('report.summaryTone')} tone="brand" style={styles.summaryToneChip} />
        </View>

        <View style={styles.summaryMetaRow}>
          <StatusChip label={report?.summary.contractType ?? t('report.contractTypeFallback')} tone="soft" />
          <StatusChip label={t('report.generatedAtLabel', { value: generatedAtLabel })} tone="neutral" />
        </View>

        <RoleBadge role={report?.selectedRole ?? selectedRole ?? ''} />
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('report.obligationsCountLabel')}</Text>
          <Text style={styles.statValue}>{obligationsCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('report.risksCountLabel')}</Text>
          <Text style={styles.statValue}>{risksCount}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('report.disputedCountLabel')}</Text>
          <Text style={styles.statValue}>{disputedCount}</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'summary' ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionIntro}>{t('report.summaryIntro')}</Text>
          <Text style={styles.sectionTitle}>{t('report.obligationsTitle')}</Text>
          {(report?.summary.obligationsForSelectedRole ?? []).map((item) => (
            <View key={item} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletItem}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {activeTab === 'risks' ? (
        <View style={styles.sectionStack}>
          <View style={styles.sectionNote}>
            <Text style={styles.sectionTitle}>{t('report.risksTitle')}</Text>
            <Text style={styles.sectionIntro}>{t('report.risksIntro')}</Text>
          </View>
          {sortedRisks.length === 0 ? <Text style={styles.emptyState}>{t('report.risksEmpty')}</Text> : null}
          {sortedRisks.map((risk) => (
            <RiskCard key={risk.id} item={risk} />
          ))}
        </View>
      ) : null}

      {activeTab === 'disputed' ? (
        <View style={styles.sectionStack}>
          <View style={styles.sectionNote}>
            <Text style={styles.sectionTitle}>{t('report.disputedTitle')}</Text>
            <Text style={styles.sectionIntro}>{t('report.disputedIntro')}</Text>
          </View>
          {(report?.disputedClauses ?? []).length === 0 ? <Text style={styles.emptyState}>{t('report.disputedEmpty')}</Text> : null}
          {(report?.disputedClauses ?? []).map((clause) => (
            <DisputedCard key={clause.id} item={clause} />
          ))}
        </View>
      ) : null}
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  summaryStrip: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.raised,
  },
  summaryHeader: {
    flexDirection: 'column',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  summaryCopy: {
    width: '100%',
    gap: spacing.xxs,
  },
  summaryToneChip: {
    maxWidth: '100%',
  },
  summaryKicker: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xxs,
    ...shadow.card,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    gap: spacing.xs,
    ...shadow.card,
  },
  tabItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  tabItemActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    fontWeight: typography.weight.semibold,
  },
  tabTextActive: {
    color: colors.textOnAccent,
  },
  sectionCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  sectionStack: {
    gap: spacing.md,
  },
  sectionNote: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.card,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  sectionIntro: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  bulletItem: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
