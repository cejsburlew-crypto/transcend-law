// Language Context - Dynamic multi-language support
// Supports 16+ languages with automatic translation API

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import translations, { FALLBACK_LOCALE } from '../translations/index';
import { translateText, isRTLLanguage, SUPPORTED_LANGUAGES } from '../services/translationService';

export type Language = string; // Any language code

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
  translate: (text: string) => Promise<string>;
  isRTL: boolean;
  availableLanguages: Array<{ code: string; name: string; flag: string }>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('selectedLanguage') || 'en';
    return saved;
  });

  const [isRTL, setIsRTL] = useState(isRTLLanguage(language));

  useEffect(() => {
    localStorage.setItem('selectedLanguage', language);
    setIsRTL(isRTLLanguage(language));
    document.documentElement.dir = isRTLLanguage(language) ? 'rtl' : 'ltr';
  }, [language]);

  const setLanguage = useCallback((newLanguage: Language) => {
    setLanguageState(newLanguage);
  }, []);

  // Static translation. Resolves the key in the active locale, then falls back
  // to English, then to the key itself. Params are interpolated as {name}.
  //
  // NOTE: this translates UI chrome only. User-entered values, uploaded files,
  // and provider records must be rendered directly, never passed through t().
  const t = (key: string, params?: Record<string, string>): string => {
    const lookup = (locale: string): unknown => {
      let value: any = (translations as any)[locale];
      for (const k of key.split('.')) {
        if (value == null) return undefined;
        value = value[k];
      }
      return value;
    };

    let value = lookup(language);

    if (typeof value !== 'string' && language !== FALLBACK_LOCALE) {
      value = lookup(FALLBACK_LOCALE);
      if (typeof value === 'string') {
        console.warn(`Missing ${language} translation for "${key}" - using ${FALLBACK_LOCALE}`);
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Missing translation: ${key}`);
      return key;
    }

    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.split(`{${k}}`).join(v),
        value
      );
    }

    return value;
  };

  // Dynamic translation for any text/language
  const translate = useCallback(
    async (text: string): Promise<string> => {
      if (language === 'en' || !text) {
        return text;
      }
      return await translateText(text, language);
    },
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        translate,
        isRTL,
        availableLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
