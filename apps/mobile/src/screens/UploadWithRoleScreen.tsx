import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import { EditableRoleDropdown } from '../components/EditableRoleDropdown';
import { RoleBadge } from '../components/RoleBadge';
import { ScreenShell } from '../components/layout/ScreenShell';
import { appConfig } from '../config/appConfig';
import { LocalFileCache } from '../data/local/file/LocalFileCache';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'UploadWithRole'>;

interface SelectedFileState {
  fileName: string;
  mimeType: string;
  localFileUri?: string;
}

export const UploadWithRoleScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const api = useApiClient();

  const presetRoles = useMemo(
    () => appConfig.roles.presetTranslationKeys.map((translationKey) => t(translationKey)),
    [t],
  );
  const fileCache = useMemo(() => new LocalFileCache(), []);

  const [selectedRole, setSelectedRole] = useState(presetRoles[0] ?? '');
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const chooseFile = async (): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: false,
      type: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
      ],
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset) {
      return;
    }

    const cacheId = `upload_${Date.now()}`;
    const cachedUri = asset.uri ? await fileCache.cacheFile(cacheId, asset.uri) : undefined;

    setSelectedFile({
      fileName: asset.name ?? appConfig.demo.stubContractFileName,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      localFileUri: cachedUri,
    });
  };

  const startAnalysis = async (): Promise<void> => {
    if (!selectedFile || !selectedRole) {
      return;
    }

    setSubmitting(true);
    try {
      const { analysisId } = await api.uploadContract(
        {
          fileName: selectedFile.fileName,
          mimeType: selectedFile.mimeType,
          localFileUri: selectedFile.localFileUri,
          selectedRole,
          language,
        },
        { language },
      );

      navigation.navigate('AnalysisStatus', {
        analysisId,
        selectedRole,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title={t('upload.title')} subtitle={t('upload.subtitle')}>
      <View style={styles.sectionCard}>
        <RoleBadge role={selectedRole} />
        <EditableRoleDropdown
          value={selectedRole}
          presets={presetRoles}
          onChange={setSelectedRole}
          label={t('upload.roleLabel')}
          placeholder={t('upload.selectRole')}
          customPlaceholder={t('upload.customRolePlaceholder')}
          modalTitle={t('upload.choosePresetOrCustom')}
          customOptionLabel={t('upload.customRole')}
        />
      </View>

      <Pressable style={styles.fileButton} onPress={chooseFile}>
        <Text style={styles.fileButtonText}>
          {selectedFile ? t('upload.selectedFile', { fileName: selectedFile.fileName }) : t('upload.selectFile')}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.primaryButton, (!selectedFile || !selectedRole || submitting) && styles.disabled]}
        onPress={startAnalysis}
        disabled={!selectedFile || !selectedRole || submitting}
      >
        <Text style={styles.primaryButtonText}>
          {submitting ? t('upload.submitting') : t('upload.startAnalysis')}
        </Text>
      </Pressable>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  fileButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    ...shadow.card,
  },
  fileButtonText: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.raised,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.textOnAccent,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
});
