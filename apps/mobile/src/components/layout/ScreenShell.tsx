import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { LanguageSelector } from '../LanguageSelector';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface ScreenShellProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  scroll?: boolean;
}

const Header = ({ title, subtitle }: { title: string; subtitle?: string }): JSX.Element => {
  return (
    <View style={styles.headerCard}>
      <LanguageSelector />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

export const ScreenShell = ({ title, subtitle, scroll = false, children }: ScreenShellProps): JSX.Element => {
  return (
    <View style={styles.root}>
      <View style={styles.decorativeBlobA} />
      <View style={styles.decorativeBlobB} />

      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} style={styles.contentWrap}>
          <Header title={title} subtitle={subtitle} />
          <View style={styles.body}>{children}</View>
        </ScrollView>
      ) : (
        <View style={styles.contentWrap}>
          <Header title={title} subtitle={subtitle} />
          <View style={styles.body}>{children}</View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  decorativeBlobA: {
    position: 'absolute',
    top: -72,
    right: -44,
    width: 220,
    height: 220,
    borderRadius: radius.pill,
    backgroundColor: colors.decorativeA,
  },
  decorativeBlobB: {
    position: 'absolute',
    top: 86,
    left: -64,
    width: 180,
    height: 180,
    borderRadius: radius.pill,
    backgroundColor: colors.decorativeB,
  },
  contentWrap: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  headerCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadow.raised,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.hero,
    lineHeight: typography.lineHeight.hero,
    fontWeight: typography.weight.bold,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  body: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    gap: spacing.md,
  },
});
