import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import { ScreenShell } from '../components/layout/ScreenShell';
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
    <ScreenShell title={t('auth.title')} subtitle={t('auth.subtitle')}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth.emailPlaceholder')}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth.passwordPlaceholder')}
        secureTextEntry
        style={styles.input}
      />

      <Pressable style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={signIn}>
        <Text style={styles.primaryButtonText}>{loading ? t('auth.signingIn') : t('common.continue')}</Text>
      </Pressable>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    ...shadow.card,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.raised,
  },
  primaryButtonDisabled: {
    opacity: 0.8,
  },
  primaryButtonText: {
    color: colors.textOnAccent,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
});
