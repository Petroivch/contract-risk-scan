import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../../theme/tokens';

interface StatusChipProps {
  label: string;
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
}

const toneStyles = {
  neutral: { backgroundColor: colors.surfaceElevated, textColor: colors.textSecondary, dot: colors.textMuted },
  info: { backgroundColor: '#E6EEF3', textColor: colors.info, dot: colors.info },
  success: { backgroundColor: '#E5F3ED', textColor: colors.success, dot: colors.success },
  warning: { backgroundColor: '#F8EEDC', textColor: colors.warning, dot: colors.warning },
  danger: { backgroundColor: '#F8E7E4', textColor: colors.danger, dot: colors.danger },
} as const;

export const StatusChip = ({ label, tone = 'neutral' }: StatusChipProps): JSX.Element => {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.container, { backgroundColor: palette.backgroundColor }]}>
      <View style={[styles.dot, { backgroundColor: palette.dot }]} />
      <Text style={[styles.label, { color: palette.textColor }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  label: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
  },
});
