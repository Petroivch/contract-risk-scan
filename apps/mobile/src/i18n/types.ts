import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from '../config/static';

export const supportedLanguages = SUPPORTED_LANGUAGES;

export type SupportedLanguage = (typeof supportedLanguages)[number];

export const defaultLanguage: SupportedLanguage = DEFAULT_LANGUAGE;

export const isSupportedLanguage = (value: string): value is SupportedLanguage => {
  return supportedLanguages.includes(value as SupportedLanguage);
};
