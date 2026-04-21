import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DisputedClause } from '../../api/types';
import { StatusChip } from '../StatusChip';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface DisputedCardProps {
  item: DisputedClause;
}

export const DisputedCard = ({ item }: DisputedCardProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.headlineRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>{t('report.disputedCardLabel')}</Text>
          <Text style={styles.title}>{t('report.clause', { value: item.clauseRef })}</Text>
        </View>
        <StatusChip label={t('report.disputedTone')} tone="warning" />
      </View>

      <Text style={styles.description}>{item.whyDisputed}</Text>

      <View style={styles.rewriteBox}>
        <Text style={styles.rewriteLabel}>{t('report.rewriteLabel')}</Text>
        <Text style={styles.rewrite}>{item.suggestedRewrite}</Text>
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
    borderLeftColor: colors.warning,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
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
  description: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  rewriteBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  rewriteLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewrite: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
});
