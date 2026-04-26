import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RiskItem } from '../../api/types';
import { useAppLanguage } from '../../i18n/LanguageProvider';
import type { RootStackParamList } from '../../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';
import { StatusChip } from '../StatusChip';
import { buildClauseItems, buildPreviewItems, splitInlineEvidence, splitStructuredText } from '../report/reportText';

interface RiskCardProps {
  item: RiskItem;
}

const severityToneMap = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
} as const;

export const RiskCard = ({ item }: RiskCardProps): JSX.Element => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useTranslation();
  const { language } = useAppLanguage();

  const occurrences = item.occurrences ?? 1;
  const clauseLabel =
    item.clauseRefs && item.clauseRefs.length > 1
      ? t('report.clauses', { value: item.clauseRef })
      : t('report.clause', { value: item.clauseRef });

  const { primaryText, evidenceItems: inlineEvidenceItems } = useMemo(
    () => splitInlineEvidence(item.description, language),
    [item.description, language],
  );

  const clauseItems = useMemo(() => buildClauseItems(item.clauseRefs, item.clauseRef, t), [item.clauseRef, item.clauseRefs, t]);
  const detailFindingItems = useMemo(
    () =>
      [
        ...splitStructuredText(primaryText || item.description, 8),
        ...splitStructuredText(inlineEvidenceItems.join(' '), 6),
        ...(item.evidence ?? []).flatMap((entry) => splitStructuredText(entry, 8)),
      ],
    [inlineEvidenceItems, item.description, item.evidence, primaryText],
  );
  const previewFindingItems = useMemo(() => buildPreviewItems(detailFindingItems, 3, 220), [detailFindingItems]);
  const detailRecommendationItems = useMemo(() => splitStructuredText(item.recommendation, 8), [item.recommendation]);
  const previewRecommendationItems = useMemo(
    () => buildPreviewItems(detailRecommendationItems, 2, 220),
    [detailRecommendationItems],
  );

  const detailSections = useMemo(
    () => [
      { title: t('report.sections.whereFound'), items: clauseItems },
      { title: t('report.sections.riskPoints'), items: detailFindingItems },
      { title: t('report.sections.recommendationSteps'), items: detailRecommendationItems },
    ],
    [clauseItems, detailFindingItems, detailRecommendationItems, t],
  );

  return (
    <View style={[styles.card, styles[`severity_${item.severity}`]]}>
      <View style={styles.headlineRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>{t('report.riskCardLabel')}</Text>
          <Text style={styles.title}>{item.title}</Text>
        </View>
        <StatusChip label={t(`severity.${item.severity}`)} tone={severityToneMap[item.severity]} />
      </View>

      <Text style={styles.meta}>{clauseLabel}</Text>
      {occurrences > 1 ? <Text style={styles.meta}>{t('report.riskOccurrences', { count: occurrences })}</Text> : null}

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentScrollBody}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>{t('report.sections.whereFound')}</Text>
          {clauseItems.map((value, index) => (
            <Text key={`clause-${index}`} style={styles.listItem}>
              - {value}
            </Text>
          ))}
        </View>

        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>{t('report.sections.riskPoints')}</Text>
          {previewFindingItems.map((value, index) => (
            <Text key={`finding-${index}`} style={styles.listItem}>
              - {value}
            </Text>
          ))}
        </View>

        <View style={styles.recommendationBox}>
          <Text style={styles.recommendationLabel}>{t('report.sections.recommendationSteps')}</Text>
          {previewRecommendationItems.map((value, index) => (
            <Text key={`recommendation-${index}`} style={styles.recommendation}>
              - {value}
            </Text>
          ))}
        </View>
      </ScrollView>

      <Pressable
        style={styles.detailsButton}
        onPress={() =>
          navigation.navigate('ReportItemDetail', {
            title: item.title,
            subtitle: clauseLabel,
            sections: detailSections,
          })
        }
      >
        <Text style={styles.detailsButtonText}>{t('common.details')}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  severity_low: {
    borderLeftColor: colors.success,
  },
  severity_medium: {
    borderLeftColor: colors.warning,
  },
  severity_high: {
    borderLeftColor: colors.danger,
  },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xxs,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  meta: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.medium,
  },
  contentScroll: {
    maxHeight: 240,
  },
  contentScrollBody: {
    gap: spacing.sm,
    paddingRight: spacing.xxs,
  },
  sectionBox: {
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.bold,
  },
  listItem: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  recommendationBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  recommendationLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recommendation: {
    color: colors.textPrimary,
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
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
});

