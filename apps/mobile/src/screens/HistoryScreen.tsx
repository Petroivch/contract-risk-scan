import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { HistoryItem } from '../api/types';
import { RoleBadge } from '../components/RoleBadge';
import { ScreenShell } from '../components/layout/ScreenShell';
import { ActionButton } from '../components/ui/ActionButton';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const formatTimestamp = (value: string, language: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

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

  const emptyState = useMemo(
    () => (
      <Panel title={t('history.emptyTitle')} description={t('history.empty')}>
        <ActionButton label={t('history.openUpload')} onPress={() => navigation.navigate('UploadWithRole')} />
      </Panel>
    ),
    [navigation, t],
  );

  return (
    <ScreenShell title={t('history.title')} subtitle={t('history.subtitle')} scroll>
      <View style={styles.actionRow}>
        <ActionButton label={t('history.refreshHistory')} onPress={load} variant="secondary" style={styles.actionFlex} />
        <ActionButton label={t('common.openSettings')} onPress={() => navigation.navigate('Settings')} variant="ghost" style={styles.actionFlex} />
      </View>

      {items.length === 0 ? emptyState : null}

      {items.map((item) => {
        const tone = item.status === 'completed' ? 'success' : item.status === 'failed' ? 'danger' : item.status === 'processing' ? 'info' : 'warning';

        return (
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
            <View style={styles.cardTopRow}>
              <Text style={styles.fileName}>{item.fileName}</Text>
              <StatusChip label={t(`status.${item.status}`)} tone={tone} />
            </View>
            <View style={styles.metaRow}>
              <RoleBadge role={item.selectedRole} size="inline" />
              <Text style={styles.meta}>{formatTimestamp(item.createdAt, language)}</Text>
            </View>
            <Text style={styles.metaSecondary}>{t('history.openReportHint')}</Text>
          </Pressable>
        );
      })}
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
  card: {
    borderRadius: radius.xl,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  fileName: {
    flex: 1,
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
  metaSecondary: {
    color: colors.textMuted,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
});
