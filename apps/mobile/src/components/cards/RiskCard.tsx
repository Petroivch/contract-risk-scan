import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RiskItem } from '../../api/types';
import { StatusChip } from '../StatusChip';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface RiskCardProps {
  item: RiskItem;
}

const severityToneMap = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
} as const;

export const RiskCard = ({ item }: RiskCardProps): JSX.Element => {
  const { t } = useTranslation();
  const occurrences = item.occurrences ?? 1;
  const clauseLabel =
    item.clauseRefs && item.clauseRefs.length > 1
      ? t('report.clauses', { value: item.clauseRef })
      : t('report.clause', { value: item.clauseRef });

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
      <Text style={styles.description}>{item.description}</Text>

      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationLabel}>{t('report.recommendationLabel')}</Text>
        <Text style={styles.recommendation}>{item.recommendation}</Text>
      </View>
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
  description: {
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
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
});
