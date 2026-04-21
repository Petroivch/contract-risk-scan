import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenShell } from '../components/layout/ScreenShell';
import { appConfig } from '../config/appConfig';
import { featureFlags } from '../config/featureFlags';
import { useAppLanguage } from '../i18n/LanguageProvider';
import { supportedLanguages } from '../i18n/types';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language, setLanguage } = useAppLanguage();

  return (
    <ScreenShell title={t('settings.title')} subtitle={t('settings.subtitle')} scroll>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.languageTitle')}</Text>
        <Text style={styles.cardText}>{t('settings.languageSubtitle')}</Text>

        <View style={styles.languageList}>
          {supportedLanguages.map((item) => {
            const active = item === language;
            return (
              <Pressable key={item} style={[styles.languageRow, active && styles.languageRowActive]} onPress={() => setLanguage(item)}>
                <View style={styles.languageCopy}>
                  <Text style={styles.languageLabel}>{t(`language.${item}`)}</Text>
                  <Text style={styles.languageMeta}>{active ? t('settings.languageActive') : t('settings.languageInactive')}</Text>
                </View>
                <View style={[styles.languageDot, active && styles.languageDotActive]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.localFirstTitle')}</Text>
        <Text style={styles.cardText}>{t('settings.localFirstEnabled', { value: String(featureFlags.localFirstCache) })}</Text>
        <Text style={styles.cardText}>{t('settings.sqliteEnabled', { value: String(featureFlags.sqliteCache) })}</Text>
        <Text style={styles.cardText}>{t('settings.fileCacheEnabled', { value: String(featureFlags.fileCache) })}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.releaseBudgetTitle')}</Text>
        <Text style={styles.cardText}>{t('settings.totalBudget', { value: appConfig.limits.totalReleaseBudgetMb })}</Text>
        <Text style={styles.cardText}>{t('settings.mobileBudgetShare', { value: appConfig.limits.mobileBudgetShareMb })}</Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('History')}>
        <Text style={styles.primaryButtonText}>{t('common.openHistory')}</Text>
      </Pressable>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  cardText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  languageList: {
    gap: spacing.sm,
  },
  languageRow: {
    minHeight: 58,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  languageRowActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  languageCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  languageLabel: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.semibold,
  },
  languageMeta: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
  },
  languageDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  languageDotActive: {
    backgroundColor: colors.accent,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.raised,
  },
  primaryButtonText: {
    color: colors.textOnAccent,
    fontSize: typography.size.body,
    fontWeight: typography.weight.bold,
  },
});
