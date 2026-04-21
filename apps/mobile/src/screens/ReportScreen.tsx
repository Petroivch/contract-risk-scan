import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { AnalysisReport } from '../api/types';
import { RoleBadge } from '../components/RoleBadge';
import { DisputedCard } from '../components/cards/DisputedCard';
import { RiskCard } from '../components/cards/RiskCard';
import { ScreenShell } from '../components/layout/ScreenShell';
import { ActionButton } from '../components/ui/ActionButton';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;
type ReportTab = 'summary' | 'risks' | 'disputed';

export const ReportScreen = ({ navigation, route }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const api = useApiClient();

  const { contractId, analysisId, selectedRole } = route.params;
  const [activeTab, setActiveTab] = useState<ReportTab>('risks');
  const [report, setReport] = useState<AnalysisReport | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const nextReport = await api.getReport({ contractId, analysisId, selectedRole }, { language });
      setReport(nextReport);
    };

    load();
  }, [analysisId, api, contractId, language, selectedRole]);

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'risks', label: t('report.tabs.risks') },
    { id: 'disputed', label: t('report.tabs.disputed') },
    { id: 'summary', label: t('report.tabs.summary') },
  ];

  const riskCountLabel = useMemo(() => t('report.riskCount', { value: report?.risks.length ?? 0 }), [report?.risks.length, t]);

  return (
    <ScreenShell title={t('report.title')} subtitle={t('report.analysisId', { analysisId: report?.analysisId ?? analysisId ?? contractId })} scroll>
      <Panel
        eyebrow={t('report.summaryStripEyebrow')}
        title={report?.summary.title ?? t('common.loading')}
        description={report?.summary.shortDescription ?? t('report.loadingDescription')}
        rightSlot={<StatusChip label={riskCountLabel} tone="warning" />}
      >
        <View style={styles.summaryStripMeta}>
          <RoleBadge role={report?.selectedRole ?? selectedRole ?? ''} size="compact" />
          <StatusChip label={report?.summary.contractType ?? t('common.loading')} tone="neutral" />
        </View>
        {report?.summaryText ? <Text style={styles.summaryText}>{report.summaryText}</Text> : null}
      </Panel>

      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <ActionButton
            key={tab.id}
            label={tab.label}
            onPress={() => setActiveTab(tab.id)}
            variant={activeTab === tab.id ? 'primary' : 'ghost'}
            style={styles.tabButton}
          />
        ))}
      </View>

      {activeTab === 'risks'
        ? (report?.risks ?? []).map((risk) => <RiskCard key={risk.id} item={risk} />)
        : null}

      {activeTab === 'disputed'
        ? (report?.disputedClauses ?? []).map((clause) => <DisputedCard key={clause.id} item={clause} />)
        : null}

      {activeTab === 'summary' ? (
        <Panel title={t('report.summaryTabTitle')} description={t('report.summaryTabDescription')}>
          <Text style={styles.summaryLead}>{report?.summary.shortDescription ?? ''}</Text>
          <Text style={styles.sectionTitle}>{t('report.obligationsTitle')}</Text>
          {(report?.summary.obligationsForSelectedRole ?? []).map((item) => (
            <Text key={item} style={styles.bulletItem}>
              • {item}
            </Text>
          ))}
          {(report?.obligations ?? []).map((item) => (
            <Text key={`${item.subject}-${item.action}`} style={styles.bulletItem}>
              • {item.subject}: {item.action} ({item.dueCondition})
            </Text>
          ))}
        </Panel>
      ) : null}

      <View style={styles.actionRow}>
        <ActionButton label={t('common.openHistory')} onPress={() => navigation.navigate('History')} variant="secondary" style={styles.actionFlex} />
        <ActionButton label={t('common.backToUpload')} onPress={() => navigation.navigate('UploadWithRole')} variant="ghost" style={styles.actionFlex} />
      </View>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  summaryStripMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    minHeight: 46,
  },
  summaryLead: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  bulletItem: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
});
