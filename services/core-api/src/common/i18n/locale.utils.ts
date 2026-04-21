import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  SupportedLocale
} from './supported-locale.enum';

export function normalizeLocale(input?: string | null): SupportedLocale {
  if (!input) {
    return DEFAULT_LOCALE;
  }

  const candidate = input.trim().toLowerCase();
  return SUPPORTED_LOCALES.includes(candidate as SupportedLocale)
    ? (candidate as SupportedLocale)
    : DEFAULT_LOCALE;
}