import * as DocumentPicker from 'expo-document-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useApiClient } from '../api/ApiClientProvider';
import { EditableRoleDropdown } from '../components/EditableRoleDropdown';
import { RoleBadge } from '../components/RoleBadge';
import { StatusChip } from '../components/StatusChip';
import { ScreenShell } from '../components/layout/ScreenShell';
import { appConfig } from '../config/appConfig';
import { useConsent } from '../consent/ConsentGate';
import { getTransportNotice } from '../consent/transportNotice';
import { useAppLanguage } from '../i18n/LanguageProvider';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, shadow, spacing, typography } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'UploadWithRole'>;

interface SelectedFileState {
  fileName: string;
  mimeType: string;
  fileSizeBytes?: number;
  localFileUri?: string;
}

const SUPPORTED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;

const isSupportedDocument = (mimeType: string, fileName?: string): boolean => {
  const normalizedMimeType = mimeType.toLowerCase();
  const normalizedFileName = (fileName ?? '').toLowerCase();

  return (
    normalizedMimeType === 'application/pdf' ||
    normalizedFileName.endsWith('.pdf') ||
    normalizedMimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalizedFileName.endsWith('.docx') ||
    normalizedMimeType === 'text/plain' ||
    normalizedFileName.endsWith('.txt')
  );
};

const formatFileType = (mimeType: string, fileName?: string): string => {
  const normalizedMimeType = mimeType.toLowerCase();
  const normalizedFileName = (fileName ?? '').toLowerCase();

  if (normalizedMimeType === 'application/pdf' || normalizedFileName.endsWith('.pdf')) {
    return 'PDF';
  }
  if (
    normalizedMimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    normalizedFileName.endsWith('.docx')
  ) {
    return 'DOCX';
  }
  if (normalizedMimeType === 'text/plain' || normalizedFileName.endsWith('.txt')) {
    return 'TXT';
  }

  return mimeType.split('/').pop()?.toUpperCase() || 'FILE';
};

const formatFileSize = (sizeInBytes?: number): string => {
  if (!sizeInBytes || sizeInBytes <= 0) {
    return '-';
  }

  const sizeInMb = sizeInBytes / (1024 * 1024);
  if (sizeInMb < 1) {
    return `${Math.max(1, Math.round(sizeInBytes / 1024))} KB`;
  }

  return `${sizeInMb.toFixed(sizeInMb >= 10 ? 0 : 1)} MB`;
};

const AcknowledgementRow = ({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}): JSX.Element => {
  return (
    <Pressable
      style={[styles.acknowledgementRow, selected && styles.acknowledgementRowSelected]}
      onPress={onPress}
    >
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected ? <View style={styles.checkboxIndicator} /> : null}
      </View>
      <Text style={styles.acknowledgementText}>{label}</Text>
    </Pressable>
  );
};

export const UploadWithRoleScreen = ({ navigation }: Props): JSX.Element => {
  const { t } = useTranslation();
  const { language } = useAppLanguage();
  const { currentTransport } = useConsent();
  const api = useApiClient();

  const presetRoles = useMemo(
    () => appConfig.roles.presetTranslationKeys.map((translationKey) => t(translationKey)),
    [t],
  );

  const [selectedRole, setSelectedRole] = useState(presetRoles[0] ?? '');
  const [selectedFile, setSelectedFile] = useState<SelectedFileState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasAuthorityAcknowledgement, setAuthorityAcknowledgement] = useState(false);
  const [hasMinimizationAcknowledgement, setMinimizationAcknowledgement] = useState(false);

  const requiresHttpAcknowledgement = currentTransport === 'http';
  const transportNotice = getTransportNotice(t, currentTransport);
  const fileStepSubtitle =
    currentTransport === 'http'
      ? t('upload.fileStepSubtitleHttp')
      : currentTransport === 'stub'
        ? t('upload.fileStepSubtitleStub')
        : t('upload.fileStepSubtitleLocal');
  const httpAcknowledgementComplete =
    !requiresHttpAcknowledgement || (hasAuthorityAcknowledgement && hasMinimizationAcknowledgement);
  const canStartAnalysis =
    Boolean(selectedFile) && Boolean(selectedRole) && !submitting && httpAcknowledgementComplete;

  const chooseFile = async (): Promise<void> => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
      type: [...SUPPORTED_DOCUMENT_MIME_TYPES],
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset) {
      return;
    }

    const maxFileSizeBytes = appConfig.limits.maxUploadFileMb * 1024 * 1024;
    if (asset.size && asset.size > maxFileSizeBytes) {
      Alert.alert(t('upload.startFailedTitle'), t('upload.fileTooLargeMessage'));
      return;
    }

    const mimeType = asset.mimeType ?? 'application/octet-stream';
    const fileName = asset.name ?? appConfig.defaults.stubContractFileName;
    if (!isSupportedDocument(mimeType, fileName)) {
      Alert.alert(t('upload.unsupportedFormatTitle'), t('upload.unsupportedFormatMessage'));
      return;
    }

    setSelectedFile({
      fileName,
      mimeType,
      fileSizeBytes: asset.size,
      localFileUri: asset.uri,
    });
  };

  const startAnalysis = async (): Promise<void> => {
    if (!selectedFile || !selectedRole || !httpAcknowledgementComplete) {
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
    } catch {
      Alert.alert(t('upload.startFailedTitle'), t('upload.startFailedMessage'));
    } finally {
      setSubmitting(false);
    }
  };

  const fileType = selectedFile
    ? formatFileType(selectedFile.mimeType, selectedFile.fileName)
    : '-';
  const fileSize = selectedFile ? formatFileSize(selectedFile.fileSizeBytes) : '-';

  return (
    <ScreenShell title={t('upload.title')} subtitle={t('upload.subtitle')} scroll>
      <View style={styles.noticeCard}>
        <View style={styles.noticeBlock}>
          <Text style={styles.noticeKicker}>{t('privacy.noticeKicker')}</Text>
          <Text style={styles.noticeTitle}>{t('privacy.noticeTitle')}</Text>
          <Text style={styles.noticeText}>{t('legal.disclaimerText')}</Text>
          <Text style={styles.noticeText}>{t('privacy.noticeText')}</Text>
          <Text style={styles.noticeTransportLabel}>{transportNotice.label}</Text>
          <Text style={styles.noticeText}>{transportNotice.body}</Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.secondaryButtonText}>{t('settings.openSettings')}</Text>
        </Pressable>
      </View>

      <View style={styles.roleCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardKicker}>{t('upload.roleStepKicker')}</Text>
            <Text style={styles.cardTitle}>{t('upload.roleStepTitle')}</Text>
            <Text style={styles.cardSubtitle}>{t('upload.roleStepSubtitle')}</Text>
          </View>
          <StatusChip label={t('upload.roleSelectionChip')} tone="brand" />
        </View>

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

      <View style={styles.heroCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardKicker}>{t('upload.fileStepKicker')}</Text>
            <Text style={styles.cardTitle}>{t('upload.fileStepTitle')}</Text>
            <Text style={styles.cardSubtitle}>{fileStepSubtitle}</Text>
          </View>
          <StatusChip
            label={selectedFile ? t('upload.readyToAnalyze') : t('upload.selectFile')}
            tone={selectedFile ? 'success' : 'brand'}
          />
        </View>

        <Pressable style={styles.filePanel} onPress={chooseFile}>
          <View style={styles.filePanelTopRow}>
            <View style={styles.filePanelMain}>
              <Text style={styles.fileLabel}>{t('upload.fileLabel')}</Text>
              <Text style={styles.fileName} numberOfLines={2}>
                {selectedFile ? selectedFile.fileName : t('upload.filePlaceholder')}
              </Text>
            </View>
            <StatusChip
              label={selectedFile ? fileType : t('upload.fileTypeFallback')}
              tone={selectedFile ? 'soft' : 'neutral'}
            />
          </View>

          <View style={styles.fileMetaGrid}>
            <View style={styles.fileMetaBlock}>
              <Text style={styles.fileMetaLabel}>{t('upload.fileTypeLabel')}</Text>
              <Text style={styles.fileMetaValue}>{fileType}</Text>
            </View>
            <View style={styles.fileMetaBlock}>
              <Text style={styles.fileMetaLabel}>{t('upload.fileSizeLabel')}</Text>
              <Text style={styles.fileMetaValue}>{fileSize}</Text>
            </View>
          </View>

          <Text style={styles.fileHint}>
            {selectedFile ? t('upload.pickAnotherFile') : t('upload.fileTapHint')}
          </Text>
          <Text style={styles.fileSupportHint}>{t('upload.supportedFormatsHint')}</Text>
        </Pressable>
      </View>

      {requiresHttpAcknowledgement ? (
        <View style={styles.httpCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardCopy}>
              <Text style={styles.cardKicker}>{t('upload.httpReviewKicker')}</Text>
              <Text style={styles.cardTitle}>{t('upload.httpReviewTitle')}</Text>
              <Text style={styles.cardSubtitle}>{t('upload.httpReviewSubtitle')}</Text>
            </View>
            <StatusChip
              label={
                httpAcknowledgementComplete
                  ? t('upload.httpReviewComplete')
                  : t('upload.httpReviewPending')
              }
              tone={httpAcknowledgementComplete ? 'success' : 'neutral'}
            />
          </View>

          <Text style={styles.httpTransportLabel}>{transportNotice.label}</Text>
          <Text style={styles.httpBody}>{transportNotice.body}</Text>

          <AcknowledgementRow
            selected={hasAuthorityAcknowledgement}
            label={t('upload.httpAuthorityAcknowledgement')}
            onPress={() => setAuthorityAcknowledgement((current) => !current)}
          />
          <AcknowledgementRow
            selected={hasMinimizationAcknowledgement}
            label={t('upload.httpMinimizationAcknowledgement')}
            onPress={() => setMinimizationAcknowledgement((current) => !current)}
          />

          <Text style={styles.httpHint}>{t('upload.httpRequiredHint')}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryButton, !canStartAnalysis && styles.disabled]}
        onPress={startAnalysis}
        disabled={!canStartAnalysis}
      >
        <Text style={styles.primaryButtonText}>
          {submitting ? t('upload.submitting') : t('common.startAnalysis')}
        </Text>
      </Pressable>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.raised,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  cardKicker: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.subtitle,
    lineHeight: typography.lineHeight.subtitle,
    fontWeight: typography.weight.bold,
  },
  cardSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  filePanel: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.sm,
  },
  filePanelTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  filePanelMain: {
    flex: 1,
    gap: spacing.xxs,
  },
  fileLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fileName: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.semibold,
  },
  fileMetaGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fileMetaBlock: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.sm,
    gap: spacing.xxs,
  },
  fileMetaLabel: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
  },
  fileMetaValue: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.bold,
  },
  fileHint: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  fileSupportHint: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
  },
  roleCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    ...shadow.raised,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: colors.textOnAccent,
    fontWeight: typography.weight.bold,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
  },
  noticeCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  noticeBlock: {
    gap: spacing.xxs,
  },
  noticeKicker: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noticeTitle: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
    lineHeight: typography.lineHeight.body,
    fontWeight: typography.weight.bold,
  },
  noticeText: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  noticeTransportLabel: {
    color: colors.accentStrong,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    fontWeight: typography.weight.semibold,
  },
  httpCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  httpTransportLabel: {
    color: colors.accentStrong,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  httpBody: {
    color: colors.textSecondary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
  },
  acknowledgementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  acknowledgementRowSelected: {
    borderColor: colors.accent,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  checkboxIndicator: {
    width: 10,
    height: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  acknowledgementText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.size.bodySm,
    lineHeight: typography.lineHeight.bodySm,
    fontWeight: typography.weight.medium,
  },
  httpHint: {
    color: colors.warning,
    fontSize: typography.size.caption,
    lineHeight: typography.lineHeight.caption,
    fontWeight: typography.weight.semibold,
  },
});
