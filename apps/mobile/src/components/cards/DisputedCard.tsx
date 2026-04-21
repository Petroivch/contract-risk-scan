import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DisputedClause } from '../../api/types';
import { StatusChip } from '../ui/StatusChip';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface DisputedCardProps {
  item: DisputedClause;
}

export const DisputedCard = ({ item }: DisputedCardProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('report.clause', { value: item.clauseRef })}</Text>
        <StatusChip label={t('report.disputedBadge')} tone="warning" />
      </View>
      {item.fragment ? <Text style={styles.fragment}>{item.fragment}</Text> : null}
      {item.issue ? <Text style={styles.issue}>{item.issue}</Text> : null}
      <Text style={styles.description}>{item.whyDisputed}</Text>
      <View style={styles.rewriteBox}>
        <Text style={styles.rewrite}>{t('report.rewrite', { text: item.suggestedRewrite })}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  header: {
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
  description: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  fragment: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
  issue: {
    color: colors.textMuted,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  rewriteBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
  },
  rewrite: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
});
