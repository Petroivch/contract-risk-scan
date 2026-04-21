import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

interface RoleBadgeProps {
  role: string;
  size?: 'compact' | 'medium' | 'inline';
}

const sizeStyles = {
  compact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
  },
  medium: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  inline: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
  },
} as const;

export const RoleBadge = ({ role, size = 'medium' }: RoleBadgeProps): JSX.Element => {
  const variant = sizeStyles[size];

  return (
    <View style={[styles.container, { paddingHorizontal: variant.paddingHorizontal, paddingVertical: variant.paddingVertical }]}>
      <View style={styles.dot} />
      <Text style={[styles.text, { fontSize: variant.fontSize, lineHeight: variant.lineHeight }]} numberOfLines={1}>
        {role}
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
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '100%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  text: {
    color: colors.accentStrong,
    fontWeight: typography.weight.semibold,
    maxWidth: '100%',
  },
});
