// Translation Service - Dynamic multi-language support
// Uses caching + translation API for any language

interface TranslationCache {
  [language: string]: {
    [key: string]: string;
  };
}

const translationCache: TranslationCache = {};

// Supported languages with country codes
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
];

// Translate text using Google Translate API (backend should handle this)
export const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  // Check cache first
  if (translationCache[targetLanguage]?.[text]) {
    return translationCache[targetLanguage][text];
  }

  try {
    // Call backend endpoint that uses Google Translate API
    const response = await fetch('/api/v2/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });

    if (!response.ok) throw new Error('Translation failed');

    const { translatedText } = await response.json();

    // Cache the result
    if (!translationCache[targetLanguage]) {
      translationCache[targetLanguage] = {};
    }
    translationCache[targetLanguage][text] = translatedText;

    return translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // Fallback to original text
  }
};

// Batch translate multiple texts
export const translateBatch = async (
  texts: string[],
  targetLanguage: string
): Promise<{ [key: string]: string }> => {
  const uncached = texts.filter(
    text => !translationCache[targetLanguage]?.[text]
  );

  if (uncached.length === 0) {
    // All cached
    return texts.reduce(
      (acc, text) => ({
        ...acc,
        [text]: translationCache[targetLanguage][text],
      }),
      {}
    );
  }

  try {
    const response = await fetch('/api/v2/translate/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: uncached, targetLanguage }),
    });

    if (!response.ok) throw new Error('Batch translation failed');

    const { translations } = await response.json();

    // Cache results
    if (!translationCache[targetLanguage]) {
      translationCache[targetLanguage] = {};
    }
    Object.assign(translationCache[targetLanguage], translations);

    // Return all (cached + new)
    return texts.reduce(
      (acc, text) => ({
        ...acc,
        [text]: translationCache[targetLanguage][text] || text,
      }),
      {}
    );
  } catch (error) {
    console.error('Batch translation error:', error);
    return texts.reduce((acc, text) => ({ ...acc, [text]: text }), {});
  }
};

// Get language name from code
export const getLanguageName = (code: string): string => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang?.name || code.toUpperCase();
};

// Get language flag from code
export const getLanguageFlag = (code: string): string => {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  return lang?.flag || '🌐';
};

// Check if language is RTL (right-to-left)
export const isRTLLanguage = (code: string): boolean => {
  return ['ar', 'he', 'fa', 'ur'].includes(code);
};

export default {
  translateText,
  translateBatch,
  getLanguageName,
  getLanguageFlag,
  isRTLLanguage,
  SUPPORTED_LANGUAGES,
};
