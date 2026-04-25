import type { AnalysisReport, UploadContractRequest } from '../api/types';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage } from '../i18n/types';

import { buildAnalysisArtifacts } from './contractAnalysis';
import { extractContractText } from './fileTextExtraction';

const normalizeLanguage = (language?: SupportedLanguage): SupportedLanguage => language ?? defaultLanguage;
const unexpectedExtractionWarnings: Record<SupportedLanguage, string> = {
  ru: 'Не удалось полностью разобрать файл локально. Отчет сформирован по доступному тексту и служебным признакам документа.',
  en: 'The file could not be fully parsed locally. The report was built from available text and document signals.',
  it: 'Non e stato possibile analizzare completamente il file localmente. Il report usa il testo e i segnali disponibili.',
  fr: 'Le fichier n a pas pu etre analyse completement en local. Le rapport utilise le texte et les signaux disponibles.',
};

export const analyzeContractLocally = async (
  payload: UploadContractRequest,
  languageInput?: SupportedLanguage,
): Promise<AnalysisReport> => {
  const language = normalizeLanguage(languageInput ?? payload.language);
  let extractedText = '';
  let extractionWarnings: string[] = [];

  try {
    const extracted = await extractContractText(payload, language);
    extractedText = extracted.text;
    extractionWarnings = extracted.warnings;
  } catch {
    extractionWarnings = [unexpectedExtractionWarnings[language] ?? unexpectedExtractionWarnings.ru];
  }

  const artifacts = buildAnalysisArtifacts({
    text: extractedText,
    fileName: payload.fileName,
    selectedRole: payload.selectedRole,
    language,
    warnings: extractionWarnings,
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
