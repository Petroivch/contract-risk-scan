import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RiskItem } from '../../api/types';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface RiskCardProps {
  item: RiskItem;
}

const severityColorMap = {
  low: colors.success,
  medium: colors.warning,
  high: colors.danger,
} as const;

export const RiskCard = ({ item }: RiskCardProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.headlineRow}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={[styles.severityBadge, { backgroundColor: `${severityColorMap[item.severity]}20` }]}>
          <Text style={[styles.severityText, { color: severityColorMap[item.severity] }]}>
            {t(`severity.${item.severity}`)}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>{t('report.clause', { value: item.clauseRef })}</Text>
      <Text style={styles.description}>{item.description}</Text>
      <Text style={styles.recommendation}>{t('report.recommendation', { text: item.recommendation })}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.card,
  },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  severityBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  severityText: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
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
  recommendation: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
});
