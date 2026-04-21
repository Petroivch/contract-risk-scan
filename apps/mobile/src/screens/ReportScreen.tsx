import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { AnalysisReport } from '../api/types';
import { DisputedCard } from '../components/cards/DisputedCard';
import { RiskCard } from '../components/cards/RiskCard';
import { RoleBadge } from '../components/RoleBadge';
import { ScreenShell } from '../components/layout/ScreenShell';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Report'>;
type ReportTab = 'summary' | 'risks' | 'disputed';

export const ReportScreen = ({ navigation, route }: Props): JSX.Element => {
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

  return (
    <ScreenShell title={t('report.title')} subtitle={t('report.analysisId', { analysisId })} scroll>
      <RoleBadge role={report?.selectedRole ?? selectedRole ?? ''} />

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
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{report?.summary.title ?? t('common.loading')}</Text>
          <Text style={styles.summaryText}>{report?.summary.shortDescription ?? ''}</Text>
          <Text style={styles.sectionTitle}>{t('report.obligationsTitle')}</Text>
          {(report?.summary.obligationsForSelectedRole ?? []).map((item) => (
            <Text key={item} style={styles.bulletItem}>
              • {item}
            </Text>
          ))}
        </View>
      ) : null}

      {activeTab === 'risks'
        ? (report?.risks ?? []).map((risk) => <RiskCard key={risk.id} item={risk} />)
        : null}

      {activeTab === 'disputed'
        ? (report?.disputedClauses ?? []).map((clause) => <DisputedCard key={clause.id} item={clause} />)
        : null}

      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('History')}>
        <Text style={styles.secondaryButtonText}>{t('common.openHistory')}</Text>
      </Pressable>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
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
    minHeight: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  summaryCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
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
});

