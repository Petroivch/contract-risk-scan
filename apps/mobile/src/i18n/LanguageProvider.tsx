import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PropsWithChildren} from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { appConfig } from '../config/appConfig';
import { i18n } from './index';
import type { SupportedLanguage } from './types';
import { defaultLanguage, isSupportedLanguage } from './types';

const LANGUAGE_STORAGE_KEY = appConfig.localStorage.languagePreferenceKey;

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => Promise<void>;
  isLanguageReady: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [language, setLanguageState] = useState<SupportedLanguage>(defaultLanguage);
  const [isLanguageReady, setLanguageReady] = useState(false);

  useEffect(() => {
    const bootstrap = async (): Promise<void> => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        const nextLanguage = stored && isSupportedLanguage(stored) ? stored : defaultLanguage;
        await i18n.changeLanguage(nextLanguage);
        setLanguageState(nextLanguage);
      } finally {
        setLanguageReady(true);
      }
    };

    bootstrap();
  }, []);

  const setLanguage = async (nextLanguage: SupportedLanguage): Promise<void> => {
    await i18n.changeLanguage(nextLanguage);
    setLanguageState(nextLanguage);
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      isLanguageReady,
    }),
    [language, isLanguageReady],
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export const useAppLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useAppLanguage must be used within LanguageProvider.');
  }
  return context;
};
