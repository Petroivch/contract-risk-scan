import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { appConfig } from '../config/appConfig';
import { defaultLanguage } from './types';
import { en } from './resources/en';
import { fr } from './resources/fr';
import { it } from './resources/it';
import { ru } from './resources/ru';

const resources = {
  ru: { translation: ru },
  en: { translation: en },
  it: { translation: it },
  fr: { translation: fr },
} as const;

const resolvedDefaultLanguage = appConfig.i18n.defaultLanguage in resources ? appConfig.i18n.defaultLanguage : defaultLanguage;
const resolvedFallbackLanguage =
  appConfig.i18n.fallbackLanguage in resources ? appConfig.i18n.fallbackLanguage : defaultLanguage;

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: resolvedDefaultLanguage,
    fallbackLng: resolvedFallbackLanguage,
    compatibilityJSON: 'v3',
    returnNull: false,
    interpolation: {
      escapeValue: false,
    },
    resources,
  });
}

export { i18n };
