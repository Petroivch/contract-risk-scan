import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { LanguageSelector } from '../LanguageSelector';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';

interface ScreenShellProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  scroll?: boolean;
}

const Header = ({ title, subtitle }: { title: string; subtitle?: string }): JSX.Element => {
  const { t } = useTranslation();

  return (
    <View style={styles.headerCard}>
      <Text style={styles.brandLabel}>{t('common.appName')}</Text>
      <LanguageSelector />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

export const ScreenShell = ({ title, subtitle, scroll = false, children }: ScreenShellProps): JSX.Element => {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
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
    </SafeAreaView>
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
    paddingBottom: spacing.xxl,
  },
  headerCard: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.raised,
  },
  brandLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
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
    paddingBottom: spacing.lg,
  },
});
