import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme/tokens';

type StatusChipTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'soft';

interface StatusChipProps {
  label: string;
  tone?: StatusChipTone;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const toneStyles: Record<StatusChipTone, { backgroundColor: string; borderColor: string; color: string }> = {
  neutral: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.divider,
    color: colors.textSecondary,
  },
  brand: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.border,
    color: colors.accentStrong,
  },
  success: {
    backgroundColor: '#E2F6EE',
    borderColor: '#B8E6D0',
    color: colors.success,
  },
  warning: {
    backgroundColor: '#FFF1D9',
    borderColor: '#FFD89B',
    color: colors.warning,
  },
  danger: {
    backgroundColor: '#FBE3E3',
    borderColor: '#F0B9B9',
    color: colors.danger,
  },
  soft: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.textSecondary,
  },
};

export const StatusChip = ({ label, tone = 'neutral', style, textStyle }: StatusChipProps): JSX.Element => {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.container, { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }, style]}>
      <Text style={[styles.text, { color: palette.color }, textStyle]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  text: {
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
  },
});
