import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import { EditableRoleDropdown } from '../components/EditableRoleDropdown';
import { RoleBadge } from '../components/RoleBadge';
import { ScreenShell } from '../components/layout/ScreenShell';
import { ActionButton } from '../components/ui/ActionButton';
import { Panel } from '../components/ui/Panel';
import { StatusChip } from '../components/ui/StatusChip';
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
      const uploaded = await api.uploadContract(
        {
          fileName: selectedFile.fileName,
          mimeType: selectedFile.mimeType,
          localFileUri: selectedFile.localFileUri,
          selectedRole,
          contractLabel: selectedFile.fileName,
          language,
        },
        { language },
      );

      const analyzed = await api.analyzeContract(
        {
          contractId: uploaded.contractId,
          analysisId: uploaded.analysisId,
          selectedRole,
        },
        { language },
      );

      navigation.navigate('AnalysisStatus', {
        contractId: analyzed.contractId,
        analysisId: analyzed.analysisId,
        selectedRole,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenShell title={t('upload.title')} subtitle={t('upload.subtitle')} scroll>
      <Panel
        eyebrow={t('upload.roleEyebrow')}
        title={t('upload.rolePanelTitle')}
        description={t('upload.rolePanelDescription')}
        rightSlot={<RoleBadge role={selectedRole} size="compact" />}
      >
        <View style={styles.chipRow}>
          <StatusChip label={t('upload.localFirstChip')} tone="success" />
          <StatusChip label={t('upload.languageChip', { value: t(`language.${language}`) })} tone="neutral" />
        </View>
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
      </Panel>

      <Panel eyebrow={t('upload.fileEyebrow')} title={t('upload.fileTitle')} description={t('upload.fileDescription')}>
        <Pressable style={styles.fileSurface} onPress={chooseFile}>
          <Text style={styles.fileSurfaceTitle}>{selectedFile ? selectedFile.fileName : t('upload.selectFile')}</Text>
          <Text style={styles.fileSurfaceMeta}>{t('upload.fileFormats')}</Text>
          <Text style={styles.fileSurfaceMeta}>{t('upload.localFirstHint')}</Text>
        </Pressable>

        {selectedFile ? (
          <View style={styles.fileMetaBox}>
            <Text style={styles.fileMetaLabel}>{t('upload.selectedFileLabel')}</Text>
            <Text style={styles.fileMetaValue}>{selectedFile.fileName}</Text>
            <Text style={styles.fileMetaHint}>{selectedFile.mimeType}</Text>
          </View>
        ) : null}
      </Panel>

      <Panel title={t('upload.privacyTitle')} description={t('upload.privacyDescription')}>
        <View style={styles.actionStack}>
          <ActionButton
            label={submitting ? t('upload.submitting') : t('upload.startAnalysis')}
            onPress={startAnalysis}
            disabled={!selectedFile || !selectedRole || submitting}
          />
          <View style={styles.secondaryActionsRow}>
            <ActionButton
              label={t('common.openHistory')}
              onPress={() => navigation.navigate('History')}
              variant="secondary"
              style={styles.actionFlex}
            />
            <ActionButton
              label={t('common.openSettings')}
              onPress={() => navigation.navigate('Settings')}
              variant="ghost"
              style={styles.actionFlex}
            />
          </View>
        </View>
      </Panel>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fileSurface: {
    minHeight: 148,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.lg,
    justifyContent: 'space-between',
    ...shadow.card,
  },
  fileSurfaceTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  fileSurfaceMeta: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  fileMetaBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.xs,
  },
  fileMetaLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fileMetaValue: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  fileMetaHint: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  actionStack: {
    gap: spacing.sm,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionFlex: {
    flex: 1,
  },
});
