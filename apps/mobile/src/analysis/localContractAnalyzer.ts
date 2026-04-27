import type { AnalysisReport, UploadContractRequest } from '../api/types';
import type { SupportedLanguage } from '../i18n/types';
import { defaultLanguage, isSupportedLanguage } from '../i18n/types';

import { buildAnalysisArtifacts } from './contractAnalysis';
import { extractContractText } from './fileTextExtraction';

const normalizeLanguage = (language?: SupportedLanguage | string): SupportedLanguage =>
  language && isSupportedLanguage(language) ? language : defaultLanguage;

const unexpectedExtractionWarnings: Record<SupportedLanguage, string> = {
  ru: 'Не удалось полностью разобрать файл локально. Отчет сформирован по доступному тексту и служебным признакам документа.',
  en: 'The file could not be fully parsed locally. The report was built from available text and document signals.',
  it: 'Non e stato possibile analizzare completamente il file localmente. Il report usa il testo e i segnali disponibili.',
  fr: 'Le fichier n a pas pu etre analyse completement en local. Le rapport utilise le texte et les signaux disponibles.',
};

const unexpectedAnalysisWarnings: Record<SupportedLanguage, string> = {
  ru: 'Локальный анализатор столкнулся с ошибкой при поиске рисков. Отчет сформирован в безопасном режиме и требует ручной проверки.',
  en: 'The local analyzer hit an error while searching for risks. The report was generated in safe mode and needs manual review.',
  it: 'L analizzatore locale ha incontrato un errore nella ricerca dei rischi. Il report e stato generato in modalita sicura e richiede revisione manuale.',
  fr: 'L analyseur local a rencontre une erreur lors de la recherche des risques. Le rapport a ete genere en mode sur et necessite une revue manuelle.',
};

const buildSafeFallbackReport = (
  analysisId: string,
  payload: UploadContractRequest,
  language: SupportedLanguage,
  warnings: string[],
  error?: unknown,
): AnalysisReport => {
  const warning = unexpectedAnalysisWarnings[language] ?? unexpectedAnalysisWarnings.ru;
  const errorDetails =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : error
        ? String(error)
        : '';
  const diagnostic = errorDetails
    ? language === 'ru'
      ? `Диагностика: ${errorDetails}`
      : `Diagnostic: ${errorDetails}`
    : '';
  const details = [warning, diagnostic, ...warnings].filter(Boolean).join(' ');

  return {
    analysisId,
    selectedRole: payload.selectedRole,
    generatedAt: new Date().toISOString(),
    summary: {
      title:
        language === 'ru'
          ? `Анализ договора: ${payload.fileName}`
          : `Contract analysis: ${payload.fileName}`,
      contractType: language === 'ru' ? 'Договор общего типа' : 'General contract',
      shortDescription: details,
      obligationsForSelectedRole: [details],
      roleFound: false,
    },
    risks: [
      {
        id: 'risk-1',
        groupId: 'analysis-safe-mode',
        severity: 'medium',
        clauseRef: 'overview',
        clauseRefs: ['overview'],
        occurrences: Math.max(warnings.length, 1),
        title: language === 'ru' ? 'Требуется ручная проверка' : 'Manual review required',
        description: details,
        recommendation:
          language === 'ru'
            ? 'Проверьте договор вручную или повторите анализ после сохранения файла в DOCX, TXT или текстовый PDF.'
            : 'Review the contract manually or retry after saving it as DOCX, TXT, or a text-based PDF.',
      },
    ],
    disputedClauses: [],
  };
};

export const analyzeContractLocally = async (
  payload: UploadContractRequest,
  languageInput?: SupportedLanguage,
): Promise<AnalysisReport> => {
  const language = normalizeLanguage(languageInput ?? payload.language);
  const analysisId = `analysis_${Date.now()}`;
  let extractedText = '';
  let extractionWarnings: string[] = [];

  try {
    const extracted = await extractContractText(payload, language);
    extractedText = extracted.text;
    extractionWarnings = extracted.warnings;
  } catch {
    extractionWarnings = [
      unexpectedExtractionWarnings[language] ?? unexpectedExtractionWarnings.ru,
    ];
  }

  let artifacts: ReturnType<typeof buildAnalysisArtifacts>;

  try {
    artifacts = buildAnalysisArtifacts({
      text: extractedText,
      fileName: payload.fileName,
      selectedRole: payload.selectedRole,
      language,
      warnings: extractionWarnings,
    });
  } catch (error) {
    console.warn('Local contract analysis failed', error);
    return buildSafeFallbackReport(analysisId, payload, language, extractionWarnings, error);
  }

  return {
    analysisId,
    selectedRole: payload.selectedRole,
    generatedAt: new Date().toISOString(),
    summary: artifacts.summary,
    risks: artifacts.risks,
    disputedClauses: artifacts.disputedClauses,
  };
};
