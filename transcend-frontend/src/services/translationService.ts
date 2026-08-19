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

export interface TranslationOutcome {
  /** Text to display. Equals the input when translation was unavailable. */
  text: string;
  /** True only when a provider actually returned a translation. */
  translated: boolean;
}

/**
 * Is in-house translation live? Reports engine availability only, never config.
 */
export const getTranslationStatus = async (): Promise<{ available: boolean; status: string }> => {
  try {
    const response = await fetch('/api/v2/translate/status');
    if (!response.ok) return { available: false, status: 'unreachable' };
    const data = await response.json();
    return { available: !!data.available, status: data.status ?? 'unknown' };
  } catch {
    return { available: false, status: 'unreachable' };
  }
};

/**
 * Translate a single string for DISPLAY.
 *
 * Callers must keep the original text as the source of truth and render this
 * result alongside it - never overwrite stored content with the return value.
 * `translated: false` means the text came back unchanged (our self-hosted
 * engine is not configured or is down), so the UI can say so honestly instead
 * of implying the reader is looking at a translation.
 *
 * Translation is performed by an engine Transcend Law runs itself and cached in
 * our own database - content is never sent to a third-party service.
 */
export const translateTextDetailed = async (
  text: string,
  targetLanguage: string
): Promise<TranslationOutcome> => {
  if (!text.trim()) return { text, translated: false };

  if (translationCache[targetLanguage]?.[text]) {
    return { text: translationCache[targetLanguage][text], translated: true };
  }

  try {
    const response = await fetch('/api/v2/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });

    if (!response.ok) throw new Error(`Translation failed (${response.status})`);

    const { translatedText, translated } = await response.json();
    // Trust the server's flag: it distinguishes "translated in-house" from
    // "engine offline, original returned". Identical text can be a legitimate
    // translation (proper nouns, numbers), so never infer from equality alone.
    const didTranslate = translated === true;

    // Only cache genuine translations.
    if (didTranslate) {
      if (!translationCache[targetLanguage]) {
        translationCache[targetLanguage] = {};
      }
      translationCache[targetLanguage][text] = translatedText;
    }

    return { text: translatedText ?? text, translated: didTranslate };
  } catch (error) {
    console.error('Translation error:', error);
    return { text, translated: false }; // Fall back to the original wording
  }
};

// Back-compat wrapper: returns display text only.
export const translateText = async (text: string, targetLanguage: string): Promise<string> =>
  (await translateTextDetailed(text, targetLanguage)).text;

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
