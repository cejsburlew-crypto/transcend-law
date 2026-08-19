// Static UI translations for the four supported locales.
//
// RULE: this file holds INTERFACE CHROME ONLY — labels, buttons, headings,
// placeholders, messages. User-entered values, uploaded files, and provider
// records are rendered verbatim and are never routed through here.
//
// en is the canonical key set; every other locale mirrors its shape and falls
// back to en for any key it is missing.

import en from './en';
import es from './es';
import zh from './zh';
import vi from './vi';

export const LOCALES = ['en', 'es', 'zh', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];

export const FALLBACK_LOCALE: Locale = 'en';

const translations: Record<string, any> = { en, es, zh, vi };

export default translations;
