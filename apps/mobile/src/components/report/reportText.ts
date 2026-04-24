import type { TFunction } from 'i18next';

import type { SupportedLanguage } from '../../i18n/types';
import { collapseWhitespace, uniqueStrings } from '../../analysis/textNormalization';

const splitPattern = /(?<=[.!?])\s+|[\n;]+/u;

const evidencePrefixes: Record<SupportedLanguage, string[]> = {
  ru: ['выявлено в пункте', 'выявлено в', 'обнаружено в пункте'],
  en: ['detected in clause', 'detected in'],
  it: ['rilevato nella clausola', 'rilevato in'],
  fr: ['detecte dans la clause', 'detecte dans'],
};

const sanitizeReportText = (value: string): string => {
  return collapseWhitespace(value)
    .replace(/(^|[\s(])(?:Р['’`]|Р’|Р)\s+договоре/giu, '$1В договоре')
    .replace(/(^|[\s(])(?:р['’`]|р’|р)\s+договоре/gu, '$1в договоре')
    .trim();
};

const normalizePoint = (value: string): string => {
  return sanitizeReportText(value)
    .replace(/^[•*-]\s*/u, '')
    .replace(/^\d+(?:\.\d+)*[.)]\s*/u, '')
    .trim();
};

export const splitStructuredText = (value: string, maxItems = 8): string[] => {
  const normalized = sanitizeReportText(value);
  if (!normalized) {
    return [];
  }

  const items = uniqueStrings(
    normalized
      .split(splitPattern)
      .map((item) => normalizePoint(item))
      .filter(Boolean),
  );

  return items.slice(0, maxItems);
};

export const splitInlineEvidence = (
  value: string,
  language: SupportedLanguage,
): { primaryText: string; evidenceItems: string[] } => {
  const normalized = sanitizeReportText(value);
  if (!normalized) {
    return { primaryText: '', evidenceItems: [] };
  }

  const prefixes = evidencePrefixes[language] ?? evidencePrefixes.ru;
  const lowerCased = normalized.toLowerCase();
  const cutIndex = prefixes.reduce<number>((current, prefix) => {
    const foundIndex = lowerCased.indexOf(prefix);
    if (foundIndex === -1) {
      return current;
    }

    return current === -1 ? foundIndex : Math.min(current, foundIndex);
  }, -1);

  if (cutIndex === -1) {
    return { primaryText: normalized, evidenceItems: [] };
  }

  const primaryText = normalizePoint(normalized.slice(0, cutIndex));
  const evidenceText = normalizePoint(normalized.slice(cutIndex));

  return {
    primaryText,
    evidenceItems: evidenceText ? [evidenceText] : [],
  };
};

export const buildClauseItems = (
  clauseRefs: string[] | undefined,
  fallbackRef: string,
  t: TFunction,
): string[] => {
  const refs = clauseRefs && clauseRefs.length > 0 ? clauseRefs : [fallbackRef];
  return uniqueStrings(refs.map((ref) => t('report.clause', { value: ref })));
};
