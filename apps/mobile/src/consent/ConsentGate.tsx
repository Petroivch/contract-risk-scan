import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { appConfig } from '../config/appConfig';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

const CONSENT_ACCEPTED_VALUE = 'accepted';

export const ConsentGate = ({ children }: PropsWithChildren): JSX.Element => {
  const { t } = useTranslation();
  const [isReady, setReady] = useState(false);
  const [isAccepted, setAccepted] = useState(false);
  const [isDeclined, setDeclined] = useState(false);

  useEffect(() => {
    const loadConsent = async (): Promise<void> => {
      try {
        const stored = await AsyncStorage.getItem(appConfig.localStorage.policyConsentKey);
        setAccepted(stored === CONSENT_ACCEPTED_VALUE);
      } finally {
        setReady(true);
      }
    };

    void loadConsent();
  }, []);

  const acceptPolicy = async (): Promise<void> => {
    await AsyncStorage.setItem(appConfig.localStorage.policyConsentKey, CONSENT_ACCEPTED_VALUE);
    setDeclined(false);
    setAccepted(true);
  };

  if (!isReady) {
    return (
      <View style={styles.centeredRoot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (isAccepted) {
    return <>{children}</>;
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.kicker}>{t('consent.kicker')}</Text>
          <Text style={styles.title}>{t('consent.title')}</Text>
          <Text style={styles.body}>{t('consent.body')}</Text>
          <View style={styles.ruleList}>
            <Text style={styles.ruleItem}>{t('consent.ruleLegal')}</Text>
            <Text style={styles.ruleItem}>{t('consent.ruleData')}</Text>
            <Text style={styles.ruleItem}>{t('consent.ruleAccuracy')}</Text>
            <Text style={styles.ruleItem}>{t('consent.ruleResponsibility')}</Text>
          </View>
          {isDeclined ? <Text style={styles.blockedText}>{t('consent.declined')}</Text> : null}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable style={styles.acceptButton} onPress={() => void acceptPolicy()}>
            <Text style={styles.acceptButtonText}>{t('consent.accept')}</Text>
          </Pressable>
          <Pressable style={styles.declineButton} onPress={() => setDeclined(true)}>
            <Text style={styles.declineButtonText}>{t('consent.decline')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
    padding: spacing.md,
  },
  centeredRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.canvas,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow.raised,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
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
    fontSize: typography.size.title,
    lineHeight: typography.lineHeight.title,
    fontWeight: typography.weight.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  ruleList: {
    gap: spacing.xs,
  },
  ruleItem: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  blockedText: {
    color: colors.danger,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
  actions: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  acceptButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  acceptButtonText: {
    color: colors.textOnAccent,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  declineButton: {
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  declineButtonText: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.semibold,
  },
});
