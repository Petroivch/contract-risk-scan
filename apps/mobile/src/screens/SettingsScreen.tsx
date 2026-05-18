import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { clearStubRuntimeCache } from '../services/api/stubs';
import { ScreenShell } from '../components/layout/ScreenShell';
import { useConsent } from '../consent/ConsentGate';
import { getTransportNotice } from '../consent/transportNotice';
import { localFileCache } from '../repository/local/LocalFileCache';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const DetailRow = ({ label, value }: { label: string; value: string }): JSX.Element => {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};

export const SettingsScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { consentRecord, consentVersion, currentTransport, withdrawConsent } = useConsent();
  const [isClearing, setIsClearing] = useState(false);
  const currentTransportNotice = getTransportNotice(t, currentTransport);
  const recordedTransportNotice = consentRecord
    ? getTransportNotice(t, consentRecord.transport)
    : null;

  const clearLocalData = async (): Promise<void> => {
    setIsClearing(true);
    try {
      await Promise.all([clearStubRuntimeCache(), localFileCache.clearAll()]);
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

  const confirmWithdrawConsent = (): void => {
    Alert.alert(t('settings.withdrawConsentTitle'), t('settings.withdrawConsentMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.withdrawConsentAction'),
        style: 'destructive',
        onPress: () => {
          void withdrawConsent();
        },
      },
    ]);
  };

  return (
    <ScreenShell title={t('settings.title')} subtitle={t('settings.subtitle')} scroll>
      <View style={styles.card}>
        <Text style={styles.kicker}>{t('privacy.noticeKicker')}</Text>
        <Text style={styles.title}>{t('privacy.noticeTitle')}</Text>
        <Text style={styles.body}>{t('privacy.noticeText')}</Text>
        <Text style={styles.sectionTitle}>{t('privacy.transportTitle')}</Text>
        <Text style={styles.transportLabel}>{currentTransportNotice.label}</Text>
        <Text style={styles.body}>{currentTransportNotice.body}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>{t('settings.consentTitle')}</Text>
        <Text style={styles.title}>{t('settings.consentRecordTitle')}</Text>
        <Text style={styles.body}>{t('settings.consentRecordText')}</Text>

        <View style={styles.detailList}>
          <DetailRow
            label={t('settings.consentStatusLabel')}
            value={
              consentRecord ? t('settings.consentStatusActive') : t('settings.consentStatusNone')
            }
          />
          <DetailRow
            label={t('settings.consentVersionLabel')}
            value={consentRecord?.version ?? t('settings.consentStatusNone')}
          />
          <DetailRow
            label={t('settings.consentTransportLabel')}
            value={recordedTransportNotice?.label ?? t('settings.consentStatusNone')}
          />
          <DetailRow
            label={t('settings.consentLocaleLabel')}
            value={consentRecord?.locale ?? t('settings.consentStatusNone')}
          />
          <DetailRow
            label={t('settings.consentAcceptedAtLabel')}
            value={consentRecord?.acceptedAt ?? t('settings.consentStatusNone')}
          />
        </View>

        <Text style={styles.helperText}>
          {t('settings.currentRequirementHint', {
            version: consentVersion,
            transport: currentTransportNotice.label,
          })}
        </Text>
        <Text style={styles.helperText}>{t('settings.withdrawConsentHint')}</Text>
        <Pressable style={styles.withdrawButton} onPress={confirmWithdrawConsent}>
          <Text style={styles.withdrawButtonText}>{t('settings.withdrawConsent')}</Text>
        </Pressable>
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
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.bold,
  },
  transportLabel: {
    color: colors.accentStrong,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailList: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  detailRow: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
  },
  detailValue: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
  helperText: {
    color: colors.textMuted,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  dangerButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
  },
  withdrawButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.surfaceElevated,
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
  withdrawButtonText: {
    color: colors.danger,
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



