import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppLanguage } from '../i18n/LanguageProvider';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';
import {
  clearConsentRecord,
  type ConsentRecord,
  getConsentSnapshot,
  isCurrentConsentRecord,
  readConsentRecord,
  saveConsentRecord,
} from './consentStorage';
import { getTransportNotice } from './transportNotice';

interface ConsentContextValue {
  consentRecord: ConsentRecord | null;
  consentVersion: string;
  currentTransport: ConsentRecord['transport'];
  isConsentReady: boolean;
  hasAcceptedConsent: boolean;
  acceptConsent: () => Promise<void>;
  withdrawConsent: () => Promise<void>;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export const ConsentGate = ({ children }: PropsWithChildren): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const [isConsentReady, setConsentReady] = useState(false);
  const [consentRecord, setConsentRecord] = useState<ConsentRecord | null>(null);
  const [isDeclined, setDeclined] = useState(false);

  const consentSnapshot = getConsentSnapshot();
  const transportNotice = getTransportNotice(t, consentSnapshot.transport);
  const hasAcceptedConsent = isCurrentConsentRecord(consentRecord, consentSnapshot);

  useEffect(() => {
    const loadConsent = async (): Promise<void> => {
      try {
        setConsentRecord(await readConsentRecord());
      } finally {
        setConsentReady(true);
      }
    };

    void loadConsent();
  }, []);

  const acceptConsent = async (): Promise<void> => {
    const nextRecord = await saveConsentRecord({ locale: language });
    setDeclined(false);
    setConsentRecord(nextRecord);
  };

  const withdrawConsent = async (): Promise<void> => {
    await clearConsentRecord();
    setDeclined(false);
    setConsentRecord(null);
  };

  const contextValue = useMemo<ConsentContextValue>(
    () => ({
      consentRecord,
      consentVersion: consentSnapshot.version,
      currentTransport: consentSnapshot.transport,
      isConsentReady,
      hasAcceptedConsent,
      acceptConsent,
      withdrawConsent,
    }),
    [consentRecord, consentSnapshot.transport, consentSnapshot.version, hasAcceptedConsent, isConsentReady],
  );

  if (!isConsentReady) {
    return (
      <ConsentContext.Provider value={contextValue}>
        <View style={styles.centeredRoot}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </ConsentContext.Provider>
    );
  }

  if (hasAcceptedConsent) {
    return <ConsentContext.Provider value={contextValue}>{children}</ConsentContext.Provider>;
  }

  return (
    <ConsentContext.Provider value={contextValue}>
      <View style={styles.root}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.kicker}>{t('consent.kicker')}</Text>
            <Text style={styles.title}>{t('consent.title')}</Text>
            <Text style={styles.body}>{t('consent.body')}</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('legal.disclaimerTitle')}</Text>
              <Text style={styles.sectionBody}>{t('legal.disclaimerText')}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('privacy.noticeTitle')}</Text>
              <Text style={styles.sectionBody}>{t('privacy.noticeText')}</Text>
              <Text style={styles.sectionBody}>{t('consent.recordNotice')}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('privacy.transportTitle')}</Text>
              <Text style={styles.transportLabel}>{transportNotice.label}</Text>
              <Text style={styles.sectionBody}>{transportNotice.body}</Text>
            </View>

            <View style={styles.ruleList}>
              <Text style={styles.ruleItem}>{t('consent.ruleLegal')}</Text>
              <Text style={styles.ruleItem}>{t('consent.ruleData')}</Text>
              <Text style={styles.ruleItem}>{t('consent.ruleAccuracy')}</Text>
              <Text style={styles.ruleItem}>{t('consent.ruleResponsibility')}</Text>
            </View>

            {isDeclined ? <Text style={styles.blockedText}>{t('consent.declined')}</Text> : null}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable style={styles.acceptButton} onPress={() => void acceptConsent()}>
              <Text style={styles.acceptButtonText}>{t('consent.accept')}</Text>
            </Pressable>
            <Pressable style={styles.declineButton} onPress={() => setDeclined(true)}>
              <Text style={styles.declineButtonText}>{t('consent.decline')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ConsentContext.Provider>
  );
};

export const useConsent = (): ConsentContextValue => {
  const context = useContext(ConsentContext);
  if (!context) {
    throw new Error('useConsent must be used within ConsentGate.');
  }

  return context;
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
  section: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  sectionBody: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  transportLabel: {
    color: colors.accentStrong,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
