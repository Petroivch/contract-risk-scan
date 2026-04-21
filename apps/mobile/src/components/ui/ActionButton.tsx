import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const ActionButton = ({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: ActionButtonProps): JSX.Element => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' ? styles.primary : null,
        variant === 'secondary' ? styles.secondary : null,
        variant === 'ghost' ? styles.ghost : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          variant === 'primary' ? styles.primaryLabel : null,
          variant !== 'primary' ? styles.secondaryLabel : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primary: {
    backgroundColor: colors.accent,
    ...shadow.raised,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  ghost: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ translateY: 1 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  primaryLabel: {
    color: colors.textOnAccent,
  },
  secondaryLabel: {
    color: colors.accentStrong,
  },
});
