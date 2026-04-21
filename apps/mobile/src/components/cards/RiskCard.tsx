import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { RiskItem } from '../../api/types';
import { StatusChip } from '../ui/StatusChip';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface RiskCardProps {
  item: RiskItem;
}

const severityToneMap = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
} as const;

const confidenceWidthMap = {
  low: '42%',
  medium: '71%',
  high: '92%',
} as const;

export const RiskCard = ({ item }: RiskCardProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={[styles.rail, item.severity === 'high' ? styles.railHigh : item.severity === 'medium' ? styles.railMedium : styles.railLow]} />
      <View style={styles.content}>
        <View style={styles.headlineRow}>
          <Text style={styles.title}>{item.title}</Text>
          <StatusChip label={t(`severity.${item.severity}`)} tone={severityToneMap[item.severity]} />
        </View>
        <Text style={styles.meta}>{t('report.clause', { value: item.clauseRef })}</Text>
        <Text style={styles.description}>{item.description}</Text>
        <View style={styles.recommendationBox}>
          <Text style={styles.recommendation}>{t('report.recommendation', { text: item.recommendation })}</Text>
        </View>
        <View style={styles.confidenceTrack}>
          <View style={[styles.confidenceFill, { width: confidenceWidthMap[item.severity] }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  rail: {
    width: 8,
  },
  railLow: {
    backgroundColor: colors.success,
  },
  railMedium: {
    backgroundColor: colors.warning,
  },
  railHigh: {
    backgroundColor: colors.danger,
  },
  content: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.xs,
  },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
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
  },
  recommendation: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
  confidenceTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.divider,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
});
