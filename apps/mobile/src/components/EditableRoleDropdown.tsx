import { useMemo, useState } from 'react';
import type {
  StyleProp,
  ViewStyle} from 'react-native';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { colors, spacing } from '../theme/tokens';

interface EditableRoleDropdownProps {
  value: string;
  presets: string[];
  onChange: (nextValue: string) => void;
  label: string;
  placeholder: string;
  customPlaceholder: string;
  modalTitle: string;
  customOptionLabel: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const EditableRoleDropdown = ({
  value,
  presets,
  onChange,
  label,
  placeholder,
  customPlaceholder,
  modalTitle,
  customOptionLabel,
  containerStyle,
}: EditableRoleDropdownProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCustom, setIsCustom] = useState(!presets.includes(value));

  const visibleValue = useMemo(() => {
    if (!value) {
      return placeholder;
    }
    return value;
  }, [placeholder, value]);

  const selectPreset = (preset: string): void => {
    setIsCustom(false);
    onChange(preset);
    setIsOpen(false);
  };

  const switchToCustom = (): void => {
    setIsCustom(true);
    if (!value) {
      onChange('');
    }
    setIsOpen(false);
  };

  return (
    <View style={[styles.root, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={() => setIsOpen(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>{visibleValue}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      {isCustom ? (
        <TextInput
          placeholder={customPlaceholder}
          value={value}
          onChangeText={onChange}
          style={styles.customInput}
          autoCapitalize="sentences"
        />
      ) : null}

      <Modal transparent visible={isOpen} animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            {presets.map((preset) => (
              <TouchableOpacity key={preset} style={styles.option} onPress={() => selectPreset(preset)}>
                <Text style={styles.optionText}>{preset}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.customOption} onPress={switchToCustom}>
              <Text style={styles.customOptionText}>{customOptionLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { width: '100%' },
  label: {
    marginBottom: spacing.xs,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  trigger: {
    minHeight: 46,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    color: colors.textPrimary,
    fontSize: 15,
    flex: 1,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  customInput: {
    marginTop: spacing.sm,
    minHeight: 46,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontSize: 15,
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
    paddingHorizontal: spacing.xs,
    borderRadius: 8,
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: 15,
  },
  customOption: {
    marginTop: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  customOptionText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
});
