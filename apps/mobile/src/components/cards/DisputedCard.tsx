import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DisputedClause } from '../../api/types';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface DisputedCardProps {
  item: DisputedClause;
}

export const DisputedCard = ({ item }: DisputedCardProps): JSX.Element => {
  const { t } = useTranslation();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t('report.clause', { value: item.clauseRef })}</Text>
      <Text style={styles.description}>{item.whyDisputed}</Text>
      <View style={styles.rewriteBox}>
        <Text style={styles.rewrite}>{t('report.rewrite', { text: item.suggestedRewrite })}</Text>
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
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
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
  },
  rewrite: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
});
