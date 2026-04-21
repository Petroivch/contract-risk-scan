import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface PanelProps extends PropsWithChildren {
  eyebrow?: string;
  title?: string;
  description?: string;
  rightSlot?: ReactNode;
}

export const Panel = ({ eyebrow, title, description, rightSlot, children }: PanelProps): JSX.Element => {
  return (
    <View style={styles.card}>
      {eyebrow || title || description || rightSlot ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  rightSlot: {
    alignItems: 'flex-end',
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
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
});
