import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenShell } from '../components/layout/ScreenShell';
import { ActionButton } from '../components/ui/ActionButton';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
import { appConfig } from '../config/appConfig';
import { featureFlags } from '../config/featureFlags';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();

  return (
    <ScreenShell title={t('settings.title')} subtitle={t('settings.subtitle')} scroll>
      <Panel
        eyebrow={t('settings.languageEyebrow')}
        title={t('settings.languageTitle')}
        description={t('settings.languageDescription')}
        rightSlot={<StatusChip label={t(`language.${language}`)} tone="info" />}
      >
        <Text style={styles.bodyText}>{t('settings.languageHint')}</Text>
      </Panel>

      <Panel title={t('settings.localFirstTitle')} description={t('settings.localFirstDescription')}>
        <View style={styles.flagRow}>
          <StatusChip label={t('settings.localFirstEnabled', { value: String(featureFlags.localFirstCache) })} tone="success" />
          <StatusChip label={t('settings.sqliteEnabled', { value: String(featureFlags.sqliteCache) })} tone="neutral" />
          <StatusChip label={t('settings.fileCacheEnabled', { value: String(featureFlags.fileCache) })} tone="neutral" />
        </View>
      </Panel>

      <Panel title={t('settings.releaseBudgetTitle')} description={t('settings.releaseBudgetDescription')}>
        <Text style={styles.bodyText}>{t('settings.totalBudget', { value: appConfig.limits.totalReleaseBudgetMb })}</Text>
        <Text style={styles.bodyText}>{t('settings.mobileBudgetShare', { value: appConfig.limits.mobileBudgetShareMb })}</Text>
      </Panel>

      <View style={styles.actions}>
        <ActionButton label={t('common.openHistory')} onPress={() => navigation.navigate('History')} variant="secondary" style={styles.actionFlex} />
        <ActionButton label={t('common.backToUpload')} onPress={() => navigation.navigate('UploadWithRole')} variant="ghost" style={styles.actionFlex} />
      </View>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  flagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
});
