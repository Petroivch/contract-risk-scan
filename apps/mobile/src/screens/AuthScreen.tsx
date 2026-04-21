import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import { ScreenShell } from '../components/layout/ScreenShell';
import { ActionButton } from '../components/ui/ActionButton';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import { appConfig } from '../config/appConfig';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

export const AuthScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const api = useApiClient();

  const [email, setEmail] = useState(appConfig.demo.email);
  const [password, setPassword] = useState(appConfig.demo.password);
  const [loading, setLoading] = useState(false);

  const signIn = async (): Promise<void> => {
    try {
      setLoading(true);
      await api.signIn({ email, password, language }, { language });
      navigation.replace('UploadWithRole');
    } catch {
      Alert.alert(t('auth.signInFailedTitle'), t('auth.signInFailedMessage'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell title={t('auth.title')} subtitle={t('auth.subtitle')} scroll>
      <Panel
        eyebrow={t('auth.heroEyebrow')}
        title={t('auth.heroTitle')}
        description={t('auth.heroDescription')}
        rightSlot={<StatusChip label={t('auth.demoMode')} tone="info" />}
      >
        <View style={styles.featureRow}>
          <StatusChip label={t('auth.localFirstChip')} tone="success" />
          <StatusChip label={t('auth.languageChip')} tone="neutral" />
        </View>
      </Panel>

      <Panel title={t('auth.formTitle')} description={t('auth.formDescription')}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.emailLabel')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t('auth.emailPlaceholder')}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('auth.passwordLabel')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t('auth.passwordPlaceholder')}
            secureTextEntry
            style={styles.input}
          />
        </View>

        <ActionButton label={loading ? t('auth.signingIn') : t('common.continue')} onPress={signIn} disabled={loading} />
      </Panel>

      <Panel title={t('auth.privacyTitle')} description={t('auth.privacyDescription')}>
        <Text style={styles.helperText}>{t('auth.privacyBody')}</Text>
      </Panel>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fieldGroup: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    minHeight: 54,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    ...shadow.card,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
});
