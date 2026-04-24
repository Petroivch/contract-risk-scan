import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { AnalysisReport } from '../api/types';
import { DisputedCard } from '../components/cards/DisputedCard';
import { RiskCard } from '../components/cards/RiskCard';
import { RoleBadge } from '../components/RoleBadge';
import { StatusChip } from '../components/StatusChip';
import { ScreenShell } from '../components/layout/ScreenShell';
import { ReportDetailModal, type ReportDetailSection } from '../components/report/ReportDetailModal';
import { splitStructuredText } from '../components/report/reportText';
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
  const [activeTab, setActiveTab] = useState<ReportTab>('risks');
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [summaryDetail, setSummaryDetail] = useState<{
    title: string;
    subtitle?: string;
    sections: ReportDetailSection[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      setIsLoading(true);
      setLoadFailed(false);

      try {
        const nextReport = await api.getReport({ analysisId, selectedRole }, { language });
        if (!cancelled) {
          setReport(nextReport);
        }
      } catch {
        if (!cancelled) {
          setReport(null);
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [analysisId, api, language, selectedRole]);

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'summary', label: t('report.tabs.summary') },
    { id: 'risks', label: t('report.tabs.risks') },
    { id: 'disputed', label: t('report.tabs.disputed') },
  ];

  const sortedRisks = useMemo(() => {
    return [...(report?.risks ?? [])].sort((left, right) => {
      if (riskRank[left.severity] !== riskRank[right.severity]) {
        return riskRank[left.severity] - riskRank[right.severity];
      }

      return (right.occurrences ?? 1) - (left.occurrences ?? 1);
    });
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
  const summaryRole = report?.selectedRole ?? selectedRole ?? '';

  const summaryOverviewItems = useMemo(() => splitStructuredText(report?.summary.shortDescription ?? '', 6), [report?.summary.shortDescription]);
  const summaryObligationItems = useMemo(
    () => (report?.summary.obligationsForSelectedRole ?? []).flatMap((item) => splitStructuredText(item, 3)),
    [report?.summary.obligationsForSelectedRole],
  );

  const loadStateCopy = useMemo(() => {
    switch (language) {
      case 'ru':
        return {
          loadingTitle: 'Готовим отчет',
          loadingText: 'Подтягиваем результат анализа и собираем карточки риска.',
          errorTitle: 'Отчет пока недоступен',
          errorText: 'Не удалось загрузить сохраненный результат анализа. Повторите запуск анализа для этого договора.',
        };
      case 'it':
        return {
          loadingTitle: 'Preparazione del report',
          loadingText: 'Stiamo caricando il risultato dell analisi e compilando le schede di rischio.',
          errorTitle: 'Report non disponibile',
          errorText: 'Non e stato possibile caricare il risultato salvato. Ripetere l analisi per questo contratto.',
        };
      case 'fr':
        return {
          loadingTitle: 'Preparation du rapport',
          loadingText: 'Nous chargeons le resultat de l analyse et compilons les fiches de risque.',
          errorTitle: 'Rapport indisponible',
          errorText: 'Impossible de charger le resultat enregistre. Relancez l analyse pour ce contrat.',
        };
      case 'en':
      default:
        return {
          loadingTitle: 'Preparing the report',
          loadingText: 'Loading the analysis result and building the risk cards.',
          errorTitle: 'Report unavailable',
          errorText: 'The saved analysis result could not be loaded. Run the analysis again for this contract.',
        };
    }
  }, [language]);

  const renderHighlightedSummaryText = (value: string): JSX.Element => {
    if (!value || !summaryRole || !value.includes(summaryRole)) {
      return <Text style={styles.summaryText}>{value}</Text>;
    }

    const parts = value.split(summaryRole);
    return (
      <Text style={styles.summaryText}>
        {parts.map((part, index) => (
          <Fragment key={`${part}-${index}`}>
            {part}
            {index < parts.length - 1 ? <Text style={styles.summaryRoleStrong}>{summaryRole}</Text> : null}
          </Fragment>
        ))}
      </Text>
    );
  };

  const openSummaryDetail = (title: string, items: string[], subtitle?: string): void => {
    setSummaryDetail({
      title,
      subtitle,
      sections: [{ title, items }],
    });
  };

  const renderLoadState = (): JSX.Element => (
    <View style={styles.loadStateCard}>
      <Text style={styles.loadStateTitle}>{isLoading ? loadStateCopy.loadingTitle : loadStateCopy.errorTitle}</Text>
      <Text style={styles.loadStateText}>{isLoading ? loadStateCopy.loadingText : loadStateCopy.errorText}</Text>
    </View>
  );

  const renderSummaryTab = (): JSX.Element => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentBody}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionNote}>
        <Text style={styles.sectionTitle}>{t('report.tabs.summary')}</Text>
        <Text style={styles.sectionIntro}>{t('report.summaryIntro')}</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('report.sections.summaryOverview')}</Text>
        <ScrollView
          style={styles.innerSectionScroll}
          contentContainerStyle={styles.innerSectionContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {summaryOverviewItems.map((item, index) => (
            <View key={`overview-${index}`} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletItem}>{item}</Text>
            </View>
          ))}
        </ScrollView>
        <Pressable
          style={styles.detailsButton}
          onPress={() => openSummaryDetail(t('report.sections.summaryOverview'), summaryOverviewItems, report?.summary.contractType)}
        >
          <Text style={styles.detailsButtonText}>{t('common.details')}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>{t('report.obligationsTitle')}</Text>
        <ScrollView
          style={styles.innerSectionScroll}
          contentContainerStyle={styles.innerSectionContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {summaryObligationItems.map((item, index) => (
            <View key={`obligation-${index}`} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletItem}>{item}</Text>
            </View>
          ))}
        </ScrollView>
        <Pressable
          style={styles.detailsButton}
          onPress={() => openSummaryDetail(t('report.obligationsTitle'), summaryObligationItems, report?.selectedRole)}
        >
          <Text style={styles.detailsButtonText}>{t('common.details')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );

  const renderRisksTab = (): JSX.Element => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentBody}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionNote}>
        <Text style={styles.sectionTitle}>{t('report.risksTitle')}</Text>
        <Text style={styles.sectionIntro}>{t('report.risksIntro')}</Text>
      </View>
      {sortedRisks.length === 0 ? <Text style={styles.emptyState}>{t('report.risksEmpty')}</Text> : null}
      {sortedRisks.map((risk) => (
        <RiskCard key={risk.id} item={risk} />
      ))}
    </ScrollView>
  );

  const renderDisputedTab = (): JSX.Element => (
    <ScrollView
      style={styles.tabContent}
      contentContainerStyle={styles.tabContentBody}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionNote}>
        <Text style={styles.sectionTitle}>{t('report.disputedTitle')}</Text>
        <Text style={styles.sectionIntro}>{t('report.disputedIntro')}</Text>
      </View>
      {report?.disputedClauses.length === 0 ? <Text style={styles.emptyState}>{t('report.disputedEmpty')}</Text> : null}
      {report?.disputedClauses.map((clause) => (
        <DisputedCard key={clause.id} item={clause} />
      ))}
    </ScrollView>
  );

  if (isLoading || loadFailed || !report) {
    return (
      <ScreenShell title={t('report.title')} subtitle={t('report.analysisId', { analysisId })} fillBody>
        {renderLoadState()}
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title={t('report.title')} subtitle={t('report.analysisId', { analysisId })} fillBody>
      <View style={styles.screenContent}>
        <View style={styles.summaryStrip}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryKicker}>{t('report.summaryKicker')}</Text>
              <Text style={styles.summaryTitle}>{report.summary.title}</Text>
              {renderHighlightedSummaryText(report.summary.shortDescription)}
            </View>
            <StatusChip label={t('report.summaryTone')} tone="brand" style={styles.summaryToneChip} />
          </View>

          <View style={styles.summaryMetaRow}>
            <StatusChip label={report.summary.contractType || t('report.contractTypeFallback')} tone="soft" />
            <StatusChip label={t('report.generatedAtLabel', { value: generatedAtLabel })} tone="neutral" />
          </View>

          <RoleBadge role={report.selectedRole} />
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

        <View style={styles.tabPane}>
          {activeTab === 'summary' ? renderSummaryTab() : null}
          {activeTab === 'risks' ? renderRisksTab() : null}
          {activeTab === 'disputed' ? renderDisputedTab() : null}
        </View>
      </View>

      <ReportDetailModal
        visible={summaryDetail !== null}
        title={summaryDetail?.title ?? ''}
        subtitle={summaryDetail?.subtitle}
        sections={summaryDetail?.sections ?? []}
        onClose={() => setSummaryDetail(null)}
      />
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    gap: spacing.md,
  },
  loadStateCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  loadStateTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  loadStateText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
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
  summaryRoleStrong: {
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
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
  tabPane: {
    flex: 1,
    minHeight: 0,
  },
  tabContent: {
    flex: 1,
  },
  tabContentBody: {
    gap: spacing.md,
    paddingBottom: spacing.md,
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
  innerSectionScroll: {
    maxHeight: 260,
  },
  innerSectionContent: {
    gap: spacing.sm,
    paddingRight: spacing.xxs,
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
  detailsButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detailsButtonText: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    fontWeight: typography.weight.semibold,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
