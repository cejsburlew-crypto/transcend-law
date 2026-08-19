// Translation persistence — Transcend Law owned.
//
// Results from the self-hosted engine are stored in OUR database, so a given
// message is translated once and afterwards served entirely from in-house
// storage. Nothing about a privileged message is retained outside Transcend Law.
//
// If the database is unavailable, we fall back to a process-local cache so
// translation still works — it just does not survive a restart.

import { query } from '../database/connection';
import { encryptField, decryptField, blindIndex } from './fieldEncryption';

const memoryCache = new Map<string, string>();
let dbAvailable = true;

// Keyed HMAC, not a bare SHA-256: a plain digest of a short message is
// brute-forceable by anyone holding the database.
const lookupFor = (text: string) => blindIndex(text);
const memKey = (lookup: string, target: string) => `${lookup}:${target}`;

export interface StoredTranslation {
  translatedText: string;
  fromStore: true;
}

/** Look up a previously stored translation. */
export const getStoredTranslation = async (
  text: string,
  targetLanguage: string
): Promise<StoredTranslation | null> => {
  const lookup = lookupFor(text);

  const cached = memoryCache.get(memKey(lookup, targetLanguage));
  if (cached) return { translatedText: cached, fromStore: true };

  if (!dbAvailable) return null;

  try {
    const result = await query(
      `UPDATE translation_cache
          SET last_used_at = NOW(), use_count = use_count + 1
        WHERE source_lookup = $1 AND target_language = $2
        RETURNING translated_text`,
      [lookup, targetLanguage]
    );

    const row = result.rows[0];
    if (!row) return null;

    // A translation of a privileged message is equally privileged: stored
    // encrypted, decrypted only on the way to the reader.
    const translatedText = decryptField(row.translated_text);
    memoryCache.set(memKey(lookup, targetLanguage), translatedText);
    return { translatedText, fromStore: true };
  } catch (error) {
    dbAvailable = false;
    console.warn(
      '[translation] translation_cache unavailable, using in-memory cache only:',
      (error as Error).message
    );
    return null;
  }
};

/**
 * Persist a translation produced by our own engine.
 *
 * Only genuine translations should be passed here — storing a passthrough would
 * pin the original wording in place even after the engine comes online.
 */
export const storeTranslation = async (
  text: string,
  targetLanguage: string,
  translatedText: string,
  engine: string,
  sourceLanguage?: string
): Promise<void> => {
  const lookup = lookupFor(text);
  memoryCache.set(memKey(lookup, targetLanguage), translatedText);

  if (!dbAvailable) return;

  try {
    // Note: the source text itself is deliberately NOT stored - it is a second
    // copy of privileged content we already hold in p2p_messages.
    await query(
      `INSERT INTO translation_cache
         (source_lookup, source_language, target_language, translated_text, engine)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_lookup, target_language, engine)
       DO UPDATE SET translated_text = EXCLUDED.translated_text,
                     last_used_at    = NOW(),
                     use_count       = translation_cache.use_count + 1`,
      [lookup, sourceLanguage || null, targetLanguage, encryptField(translatedText), engine]
    );
  } catch (error) {
    dbAvailable = false;
    console.warn(
      '[translation] could not persist translation, keeping it in memory only:',
      (error as Error).message
    );
  }
};
