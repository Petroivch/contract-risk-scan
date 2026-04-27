import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { clearStubRuntimeCache } from '../api/stubs';
import { ScreenShell } from '../components/layout/ScreenShell';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();
  const [isClearing, setIsClearing] = useState(false);

  const clearLocalData = async (): Promise<void> => {
    setIsClearing(true);
    try {
      await clearStubRuntimeCache();
      Alert.alert(t('settings.clearSuccessTitle'), t('settings.clearSuccessMessage'));
    } catch {
      Alert.alert(t('settings.clearFailedTitle'), t('settings.clearFailedMessage'));
    } finally {
      setIsClearing(false);
    }
  };

  const confirmClearLocalData = (): void => {
    Alert.alert(t('settings.clearConfirmTitle'), t('settings.clearConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.clearConfirmAction'),
        style: 'destructive',
        onPress: () => {
          void clearLocalData();
        },
      },
    ]);
  };

  return (
    <ScreenShell title={t('settings.title')} subtitle={t('settings.subtitle')} scroll>
      <View style={styles.card}>
        <Text style={styles.kicker}>{t('privacy.noticeKicker')}</Text>
        <Text style={styles.title}>{t('privacy.storageTitle')}</Text>
        <Text style={styles.body}>{t('privacy.storageText')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>{t('legal.noticeKicker')}</Text>
        <Text style={styles.title}>{t('legal.disclaimerTitle')}</Text>
        <Text style={styles.body}>{t('legal.disclaimerText')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>{t('settings.localFirstTitle')}</Text>
        <Text style={styles.title}>{t('settings.storageControlTitle')}</Text>
        <Text style={styles.body}>{t('settings.storageControlText')}</Text>
        <Pressable
          style={[styles.dangerButton, isClearing && styles.disabled]}
          onPress={confirmClearLocalData}
          disabled={isClearing}
        >
          <Text style={styles.dangerButtonText}>
            {isClearing ? t('settings.clearInProgress') : t('settings.clearLocalData')}
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>{t('common.back')}</Text>
      </Pressable>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
    ...shadow.card,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
  },
  disabled: {
    opacity: 0.55,
  },
  dangerButtonText: {
    color: colors.textOnAccent,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  backButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  backButtonText: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.semibold,
  },
});
