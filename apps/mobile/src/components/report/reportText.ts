import type { TFunction } from 'i18next';

import type { SupportedLanguage } from '../../i18n/types';
import { collapseWhitespace, uniqueStrings } from '../../analysis/textNormalization';

const sentenceBoundaryPattern = /([.!?])\s+/gu;
const previewBoundaryPattern = /[.!?;:]\s*/gu;

const evidencePrefixes: Record<SupportedLanguage, string[]> = {
  ru: ['выявлено в пункте', 'выявлено в', 'обнаружено в пункте'],
  en: ['detected in clause', 'detected in'],
  it: ['rilevato nella clausola', 'rilevato in'],
  fr: ['detecte dans la clause', 'detecte dans'],
};

const sanitizeReportText = (value: string): string => {
  return collapseWhitespace(value)
    .replace(/(^|[\s(])(?:Р['’`]|P['’`])\s+договоре/giu, '$1В договоре')
    .replace(/(^|[\s(])(?:р['’`]|p['’`])\s+договоре/gu, '$1в договоре')
    .replace(/TXT-[^\p{L}\p{N}]*файл/giu, 'TXT-файл')
    .trim();
};

const normalizePoint = (value: string): string => {
  return sanitizeReportText(value)
    .replace(/^[•▪‣◦*\-]\s*/u, '')
    .replace(/^\d+(?:\.\d+)*[.)]\s*/u, '')
    .trim();
};

const splitReportPoints = (value: string): string[] => {
  return value.replace(sentenceBoundaryPattern, '$1\n').split(/[\n;]+/u);
};

export const splitStructuredText = (value: string, maxItems = 8): string[] => {
  const normalized = sanitizeReportText(value);
  if (!normalized) {
    return [];
  }

  const items = uniqueStrings(
    splitReportPoints(normalized)
      .map((item) => normalizePoint(item))
      .filter(Boolean),
  );

  return items.slice(0, maxItems);
};

const trimPreviewText = (value: string, maxChars: number): string => {
  const normalized = normalizePoint(value);
  if (!normalized || normalized.length <= maxChars) {
    return normalized;
  }

  let cutIndex = -1;
  for (const match of normalized.matchAll(previewBoundaryPattern)) {
    const nextIndex = match.index + match[0].length;
    if (nextIndex >= Math.min(80, maxChars) && nextIndex <= maxChars) {
      cutIndex = nextIndex;
    }
  }

  if (cutIndex > 0) {
    return normalized.slice(0, cutIndex).trim();
  }

  const softLimit = normalized.lastIndexOf(' ', maxChars - 3);
  const fallbackIndex = softLimit >= Math.min(80, maxChars / 2) ? softLimit : maxChars - 3;
  return `${normalized.slice(0, fallbackIndex).trim()}...`;
};

export const buildPreviewItems = (
  items: string[],
  maxItems = 3,
  maxChars = 220,
): string[] => {
  return uniqueStrings(
    items
      .map((item) => trimPreviewText(item, maxChars))
      .filter(Boolean),
  ).slice(0, maxItems);
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
  return uniqueStrings(
    refs
      .filter((ref) => ref !== 'overview' && ref !== 'system')
      .map((ref) => t('report.clause', { value: ref })),
  );
};
