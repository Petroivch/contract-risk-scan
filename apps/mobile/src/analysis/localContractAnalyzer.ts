import type { AnalysisReport, UploadContractRequest } from '../api/types';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { buildAnalysisArtifacts } from './contractAnalysis';
import { extractContractText } from './fileTextExtraction';

const normalizeLanguage = (language?: SupportedLanguage): SupportedLanguage => language ?? defaultLanguage;

export const analyzeContractLocally = async (
  payload: UploadContractRequest,
  languageInput?: SupportedLanguage,
): Promise<AnalysisReport> => {
  const language = normalizeLanguage(languageInput ?? payload.language);
  const { text, warnings } = await extractContractText(payload, language);
  const artifacts = buildAnalysisArtifacts({
    text,
    fileName: payload.fileName,
    selectedRole: payload.selectedRole,
    language,
    warnings,
  });

  return {
    analysisId: `analysis_${Date.now()}`,
    selectedRole: payload.selectedRole,
    generatedAt: new Date().toISOString(),
    summary: artifacts.summary,
    risks: artifacts.risks,
    disputedClauses: artifacts.disputedClauses,
  };
};
