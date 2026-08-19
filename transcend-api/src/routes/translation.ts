// Translation API — in-house only
//
// Translates UI-adjacent content and message bodies for DISPLAY using an engine
// Transcend Law runs itself, and stores the result in Transcend Law's own
// database. Privileged client communications never leave our infrastructure:
// there is no code path from here to any third-party translation service.
//
// Callers must treat the response as display copy. Stored records, uploads, and
// anything the user typed keep their original wording as the source of truth.

import { Router, Request, Response } from 'express';
import { translateInHouse, resolveEngineUrl } from '../services/translationEngine';
import { getStoredTranslation, storeTranslation } from '../services/translationStore';

const router = Router();

const MAX_TEXT_LENGTH = parseInt(process.env.TRANSLATION_MAX_CHARS || '5000', 10);
const MAX_BATCH_SIZE = parseInt(process.env.TRANSLATION_MAX_BATCH || '50', 10);

interface ResolvedTranslation {
  translatedText: string;
  translated: boolean;
  source: 'store' | 'engine' | 'none';
  reason?: string;
}

/**
 * Resolve one translation: in-house store first, then our own engine.
 * Returns the original text with `translated: false` when unavailable.
 */
const resolveTranslation = async (
  text: string,
  targetLanguage: string
): Promise<ResolvedTranslation> => {
  const stored = await getStoredTranslation(text, targetLanguage);
  if (stored) {
    return { translatedText: stored.translatedText, translated: true, source: 'store' };
  }

  const result = await translateInHouse(text, targetLanguage);

  if (!result.translated) {
    return {
      translatedText: text,
      translated: false,
      source: 'none',
      reason: result.status,
    };
  }

  await storeTranslation(
    text,
    targetLanguage,
    result.translatedText,
    result.engine,
    result.detectedSourceLanguage
  );

  return { translatedText: result.translatedText, translated: true, source: 'engine' };
};

/**
 * GET /api/v2/translate/status
 * Whether in-house translation is live. Reports no credentials.
 */
router.get('/status', (_req: Request, res: Response) => {
  const { url, status, reason } = resolveEngineUrl();
  return res.json({
    available: status === 'ok',
    status,
    selfHosted: true,
    thirdPartyProviders: 'disabled',
    engineConfigured: Boolean(url),
    ...(reason ? { reason } : {}),
  });
});

/**
 * POST /api/v2/translate
 * Translate a single string for display.
 */
router.post('/translate', async (req: Request, res: Response) => {
  try {
    const { text, targetLanguage } = req.body;

    if (typeof text !== 'string' || !text || typeof targetLanguage !== 'string' || !targetLanguage) {
      return res.status(400).json({ error: 'Missing text or targetLanguage' });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({ error: `text exceeds ${MAX_TEXT_LENGTH} characters` });
    }

    if (targetLanguage === 'en') {
      return res.json({ translatedText: text, translated: false, source: 'none' });
    }

    const resolved = await resolveTranslation(text, targetLanguage);
    return res.json(resolved);
  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({ error: 'Translation failed' });
  }
});

/**
 * POST /api/v2/translate/batch
 * Translate several strings in one round trip. Keyed by the ORIGINAL text so
 * callers map results back without index drift.
 */
router.post('/translate/batch', async (req: Request, res: Response) => {
  try {
    const { texts, targetLanguage } = req.body;

    if (!Array.isArray(texts) || typeof targetLanguage !== 'string' || !targetLanguage) {
      return res.status(400).json({ error: 'Missing texts array or targetLanguage' });
    }

    if (texts.length > MAX_BATCH_SIZE) {
      return res.status(413).json({ error: `batch exceeds ${MAX_BATCH_SIZE} items` });
    }

    const unique = [...new Set(texts.filter((t: unknown): t is string => typeof t === 'string' && !!t))];

    if (targetLanguage === 'en') {
      return res.json({
        translations: Object.fromEntries(unique.map(t => [t, t])),
        translated: false,
      });
    }

    const resolved = await Promise.all(
      unique.map(async text => [text, await resolveTranslation(text, targetLanguage)] as const)
    );

    return res.json({
      translations: Object.fromEntries(resolved.map(([text, r]) => [text, r.translatedText])),
      translated: resolved.some(([, r]) => r.translated),
      untranslated: resolved.filter(([, r]) => !r.translated).map(([text]) => text),
    });
  } catch (error) {
    console.error('Batch translation error:', error);
    return res.status(500).json({ error: 'Batch translation failed' });
  }
});

export default router;
