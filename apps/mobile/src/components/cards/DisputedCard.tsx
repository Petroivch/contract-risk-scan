import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { DisputedClause } from '../../api/types';
import { useAppLanguage } from '../../i18n/LanguageProvider';
import { colors, radius, shadow, spacing, typography } from '../../theme/tokens';
import { StatusChip } from '../StatusChip';
import { ReportDetailModal, type ReportDetailSection } from '../report/ReportDetailModal';
import { splitInlineEvidence, splitStructuredText } from '../report/reportText';

interface DisputedCardProps {
  item: DisputedClause;
}

export const DisputedCard = ({ item }: DisputedCardProps): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { primaryText, evidenceItems } = useMemo(() => splitInlineEvidence(item.whyDisputed, language), [item.whyDisputed, language]);
  const disputedItems = useMemo(
    () => [...splitStructuredText(primaryText || item.whyDisputed, 4), ...splitStructuredText(evidenceItems.join(' '), 2)],
    [evidenceItems, item.whyDisputed, primaryText],
  );
  const fragmentItems = useMemo(() => splitStructuredText(item.clauseText ?? '', 4), [item.clauseText]);
  const rewriteItems = useMemo(() => splitStructuredText(item.suggestedRewrite, 4), [item.suggestedRewrite]);

  const detailSections: ReportDetailSection[] = useMemo(
    () => [
      { title: t('report.sections.whereFound'), items: [t('report.clause', { value: item.clauseRef })] },
      { title: t('report.sections.disputedPoints'), items: disputedItems },
      { title: t('report.sections.contractFragment'), items: fragmentItems },
      { title: t('report.sections.rewriteSteps'), items: rewriteItems },
    ],
    [disputedItems, fragmentItems, item.clauseRef, rewriteItems, t],
  );

  return (
    <View style={styles.card}>
      <View style={styles.headlineRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>{t('report.disputedCardLabel')}</Text>
          <Text style={styles.title}>{t('report.clause', { value: item.clauseRef })}</Text>
        </View>
        <StatusChip label={t('report.disputedTone')} tone="warning" />
      </View>

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentScrollBody}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionBox}>
          <Text style={styles.sectionLabel}>{t('report.sections.disputedPoints')}</Text>
          {disputedItems.map((value, index) => (
            <Text key={`disputed-${index}`} style={styles.listItem}>
              • {value}
            </Text>
          ))}
        </View>

        {fragmentItems.length > 0 ? (
          <View style={styles.sectionBox}>
            <Text style={styles.sectionLabel}>{t('report.sections.contractFragment')}</Text>
            {fragmentItems.map((value, index) => (
              <Text key={`fragment-${index}`} style={styles.listItem}>
                • {value}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.rewriteBox}>
          <Text style={styles.rewriteLabel}>{t('report.sections.rewriteSteps')}</Text>
          {rewriteItems.map((value, index) => (
            <Text key={`rewrite-${index}`} style={styles.rewrite}>
              • {value}
            </Text>
          ))}
        </View>
      </ScrollView>

      <Pressable style={styles.detailsButton} onPress={() => setIsDetailOpen(true)}>
        <Text style={styles.detailsButtonText}>{t('common.details')}</Text>
      </Pressable>

      <ReportDetailModal
        visible={isDetailOpen}
        title={t('report.clause', { value: item.clauseRef })}
        sections={detailSections}
        onClose={() => setIsDetailOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 6,
    borderLeftColor: colors.warning,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  headlineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xxs,
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
  contentScroll: {
    maxHeight: 240,
  },
  contentScrollBody: {
    gap: spacing.sm,
    paddingRight: spacing.xxs,
  },
  sectionBox: {
    gap: spacing.xs,
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.bold,
  },
  listItem: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  rewriteBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  rewriteLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rewrite: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  detailsButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detailsButtonText: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.semibold,
  },
});
