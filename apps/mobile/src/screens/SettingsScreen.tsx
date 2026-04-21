import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenShell } from '../components/layout/ScreenShell';
import { appConfig } from '../config/appConfig';
import { featureFlags } from '../config/featureFlags';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();

  return (
    <ScreenShell title={t('settings.title')} subtitle={t('settings.subtitle')} scroll>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.localFirstTitle')}</Text>
        <Text style={styles.cardText}>{t('settings.localFirstEnabled', { value: String(featureFlags.localFirstCache) })}</Text>
        <Text style={styles.cardText}>{t('settings.sqliteEnabled', { value: String(featureFlags.sqliteCache) })}</Text>
        <Text style={styles.cardText}>{t('settings.fileCacheEnabled', { value: String(featureFlags.fileCache) })}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('settings.releaseBudgetTitle')}</Text>
        <Text style={styles.cardText}>
          {t('settings.totalBudget', { value: appConfig.limits.totalReleaseBudgetMb })}
        </Text>
        <Text style={styles.cardText}>
          {t('settings.mobileBudgetShare', { value: appConfig.limits.mobileBudgetShareMb })}
        </Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('History')}>
        <Text style={styles.primaryButtonText}>{t('common.openHistory')}</Text>
      </Pressable>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
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
