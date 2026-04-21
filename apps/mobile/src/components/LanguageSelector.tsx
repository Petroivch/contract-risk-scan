import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppLanguage } from '../i18n/LanguageProvider';
import type { SupportedLanguage} from '../i18n/types';
import { supportedLanguages } from '../i18n/types';
import { colors, spacing } from '../theme/tokens';

export const LanguageSelector = (): JSX.Element => {
  const { t } = useTranslation();
  const { language, setLanguage } = useAppLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const chooseLanguage = async (nextLanguage: SupportedLanguage): Promise<void> => {
    await setLanguage(nextLanguage);
    setIsOpen(false);
  };

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t('language.label')}</Text>
      <Pressable style={styles.trigger} onPress={() => setIsOpen(true)}>
        <Text style={styles.triggerText}>{t(`language.${language}`)}</Text>
      </Pressable>

      <Modal transparent visible={isOpen} animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('language.choose')}</Text>
            {supportedLanguages.map((item) => (
              <TouchableOpacity key={item} style={styles.option} onPress={() => chooseLanguage(item)}>
                <Text style={[styles.optionText, item === language && styles.optionTextActive]}>
                  {t(`language.${item}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    alignSelf: 'flex-end',
    width: 150,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'right',
  },
  trigger: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  triggerText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,12,19,0.35)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.xs,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  option: {
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
});
