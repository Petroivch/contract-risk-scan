import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import type { HistoryItem } from '../api/types';
import { RoleBadge } from '../components/RoleBadge';
import { StatusChip } from '../components/StatusChip';
import { ScreenShell } from '../components/layout/ScreenShell';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const statusToneMap = {
  queued: 'brand',
  processing: 'warning',
  completed: 'success',
  failed: 'danger',
} as const;

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

  const stats = useMemo(() => {
    const queued = items.filter((item) => item.status === 'queued').length;
    const ready = items.filter((item) => item.status === 'completed').length;
    return { queued, ready, total: items.length };
  }, [items]);

  const formatDate = useCallback(
    (value: string): string => {
      const parsedDate = new Date(value);
      if (Number.isNaN(parsedDate.getTime())) {
        return value;
      }

      return parsedDate.toLocaleString(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    },
    [language],
  );

  return (
    <ScreenShell title={t('history.title')} scroll>
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryKicker}>{t('history.summaryKicker')}</Text>
            <Text style={styles.summaryTitle}>{t('history.summaryTitle')}</Text>
            <Text style={styles.summaryText}>{t('history.summaryText')}</Text>
          </View>
          <StatusChip label={`${stats.total}`} tone="brand" />
        </View>

        <View style={styles.summaryStatsRow}>
          <View style={styles.summaryStatCard}>
            <Text style={styles.summaryStatLabel}>{t('history.readyCountLabel')}</Text>
            <Text style={styles.summaryStatValue}>{stats.ready}</Text>
          </View>
          <View style={styles.summaryStatCard}>
            <Text style={styles.summaryStatLabel}>{t('history.queuedCountLabel')}</Text>
            <Text style={styles.summaryStatValue}>{stats.queued}</Text>
          </View>
        </View>
      </View>

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
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.fileName} numberOfLines={2}>
                {item.fileName}
              </Text>
              <Text style={styles.meta}>{t('history.updatedAt', { value: formatDate(item.updatedAt) })}</Text>
            </View>
            <StatusChip label={t(`status.${item.status}`)} tone={statusToneMap[item.status]} />
          </View>

          <View style={styles.metaRow}>
            <RoleBadge role={item.selectedRole} />
            <StatusChip
              label={item.status === 'completed' ? t('history.cachedLabel') : t('history.pendingLabel')}
              tone={item.status === 'completed' ? 'success' : item.status === 'queued' ? 'brand' : 'neutral'}
            />
          </View>

          <Text style={styles.meta}>{t('history.idLabel', { value: item.analysisId })}</Text>
        </Pressable>
      ))}
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.raised,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  summaryCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  summaryKicker: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  summaryTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryStatCard: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  summaryStatLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryStatValue: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
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
    borderRadius: radius.xl,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  cardHeaderCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  fileName: {
    color: colors.textPrimary,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
});
