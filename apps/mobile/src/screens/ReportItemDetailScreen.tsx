import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenShell } from '../components/layout/ScreenShell';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ReportItemDetail'>;

export const ReportItemDetailScreen = ({ navigation, route }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { title, subtitle, sections } = route.params;
  const visibleSections = sections.filter((section) => section.items.length > 0);

  return (
    <ScreenShell title={title} subtitle={subtitle} scroll>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <Text style={styles.backButtonText}>{t('common.back')}</Text>
      </Pressable>

      {visibleSections.map((section) => (
        <View key={section.title} style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionList}>
            {section.items.map((item, index) => (
              <View key={`${section.title}-${index}`} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    ...shadow.card,
  },
  backButtonText: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
  sectionCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  sectionList: {
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 8,
    height: 8,
    marginTop: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  bulletText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
});
