import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      <View style={styles.headerTopRow}>
        <View style={styles.headerStamp}>
          <Text style={styles.headerStampText}>{t('common.appName')}</Text>
        </View>
        <LanguageSelector />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

export const ScreenShell = ({ title, subtitle, scroll = false, children }: ScreenShellProps): JSX.Element => {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, spacing.md);
  const bottomPadding = Math.max(insets.bottom, spacing.lg);

  return (
    <View style={styles.root}>
      <View style={styles.decorativeBlobA} />
      <View style={styles.decorativeBlobB} />
      <View style={styles.decorativeLine} />

      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: topPadding, paddingBottom: bottomPadding }]}
          style={styles.contentWrap}
          showsVerticalScrollIndicator={false}
        >
          <Header title={title} subtitle={subtitle} />
          <View style={styles.body}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.contentWrap, { paddingTop: topPadding, paddingBottom: bottomPadding }]}>
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
    top: -60,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: radius.pill,
    backgroundColor: colors.decorativeA,
  },
  decorativeBlobB: {
    position: 'absolute',
    top: 130,
    left: -70,
    width: 170,
    height: 170,
    borderRadius: radius.pill,
    backgroundColor: colors.decorativeB,
  },
  decorativeLine: {
    position: 'absolute',
    top: 148,
    right: 24,
    width: 110,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.12,
  },
  contentWrap: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  headerCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.raised,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerStamp: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  headerStampText: {
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
