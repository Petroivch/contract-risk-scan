import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { HistoryItem } from '../api/types';
import { RoleBadge } from '../components/RoleBadge';
import { ScreenShell } from '../components/layout/ScreenShell';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export const HistoryScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const api = useApiClient();
  const [items, setItems] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    const history = await api.listHistory({ language });
    setItems(history);
  }, [api, language]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScreenShell title={t('history.title')} scroll>
      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton} onPress={load}>
          <Text style={styles.secondaryButtonText}>{t('history.refreshHistory')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.secondaryButtonText}>{t('settings.title')}</Text>
        </Pressable>
      </View>

      {items.length === 0 ? <Text style={styles.emptyText}>{t('history.empty')}</Text> : null}

      {items.map((item) => (
        <Pressable
          key={item.analysisId}
          style={styles.card}
          onPress={() =>
            navigation.navigate('Report', {
              analysisId: item.analysisId,
              selectedRole: item.selectedRole,
            })
          }
        >
          <Text style={styles.fileName}>{item.fileName}</Text>
          <RoleBadge role={item.selectedRole} />
          <Text style={styles.meta}>{t('history.status', { value: t(`status.${item.status}`) })}</Text>
          <Text style={styles.meta}>{t('history.createdAt', { value: item.createdAt })}</Text>
        </Pressable>
      ))}
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.accentStrong,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.bodySm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  card: {
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  fileName: {
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
});
