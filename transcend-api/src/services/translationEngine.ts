// Self-hosted translation engine client.
//
// PRIVILEGE RULE: privileged client communications must never leave Transcend
// Law's own infrastructure. This module therefore talks ONLY to a translation
// engine we run ourselves (LibreTranslate / Argos, or any LibreTranslate-
// compatible service) at TRANSLATION_ENGINE_URL.
//
// There is deliberately no code path to DeepL, Google, OpenAI, or any other
// hosted translation service. If the self-hosted engine is unreachable, the
// caller is told translation is unavailable and the original text is shown —
// we degrade rather than leak.

const PUBLIC_TRANSLATION_HOSTS = [
  'translate.googleapis.com',
  'translation.googleapis.com',
  'api.deepl.com',
  'api-free.deepl.com',
  'api.openai.com',
  'api.anthropic.com',
  'api.cognitive.microsofttranslator.com',
  'libretranslate.com',
  'translate.argosopentech.com',
];

export type EngineStatus = 'ok' | 'not_configured' | 'blocked' | 'unreachable';

export interface EngineResult {
  translatedText: string;
  translated: boolean;
  status: EngineStatus;
  engine: string;
  detectedSourceLanguage?: string;
}

/**
 * Validates that the configured engine is one we host.
 *
 * A misconfigured URL is the one realistic way privileged text could escape, so
 * a known public translation SaaS hostname is refused outright rather than
 * trusted. Set TRANSLATION_ALLOW_ANY_HOST=true only for a self-hosted instance
 * that happens to sit on a public domain you control.
 */
export const resolveEngineUrl = (): { url: string | null; status: EngineStatus; reason?: string } => {
  const raw = process.env.TRANSLATION_ENGINE_URL;
  if (!raw) return { url: null, status: 'not_configured' };

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { url: null, status: 'blocked', reason: `TRANSLATION_ENGINE_URL is not a valid URL: ${raw}` };
  }

  const host = parsed.hostname.toLowerCase();

  if (PUBLIC_TRANSLATION_HOSTS.includes(host)) {
    return {
      url: null,
      status: 'blocked',
      reason:
        `Refusing to send content to ${host}: it is a third-party translation service. ` +
        `Point TRANSLATION_ENGINE_URL at your own self-hosted engine.`,
    };
  }

  if (process.env.TRANSLATION_ALLOW_ANY_HOST === 'true') {
    return { url: parsed.origin, status: 'ok' };
  }

  const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const isPrivate =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    // Docker/Kubernetes service names have no dots.
    !host.includes('.');

  if (!isLoopback && !isPrivate) {
    return {
      url: null,
      status: 'blocked',
      reason:
        `Refusing to send content to ${host}: it is not a private/self-hosted address. ` +
        `Set TRANSLATION_ALLOW_ANY_HOST=true if this really is your own instance.`,
    };
  }

  return { url: parsed.origin, status: 'ok' };
};

const ENGINE_NAME = process.env.TRANSLATION_ENGINE_NAME || 'self-hosted';
const TIMEOUT_MS = parseInt(process.env.TRANSLATION_TIMEOUT_MS || '8000', 10);

/**
 * Translate one string using our own engine.
 *
 * `translated: false` means the text came back unchanged because the engine is
 * missing, blocked, or down — never because we silently guessed.
 */
export const translateInHouse = async (
  text: string,
  targetLanguage: string,
  sourceLanguage = 'auto'
): Promise<EngineResult> => {
  const untranslated = (status: EngineStatus): EngineResult => ({
    translatedText: text,
    translated: false,
    status,
    engine: ENGINE_NAME,
  });

  const { url, status, reason } = resolveEngineUrl();

  if (!url) {
    if (status === 'blocked') console.error(`[translation] ${reason}`);
    else console.warn('[translation] TRANSLATION_ENGINE_URL is not set; showing original text.');
    return untranslated(status);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${url}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        q: text,
        source: sourceLanguage,
        target: targetLanguage,
        format: 'text',
        ...(process.env.TRANSLATION_ENGINE_API_KEY
          ? { api_key: process.env.TRANSLATION_ENGINE_API_KEY }
          : {}),
      }),
    });

    if (!response.ok) throw new Error(`engine responded ${response.status}`);

    const data: any = await response.json();
    const translatedText = data?.translatedText;

    if (typeof translatedText !== 'string' || translatedText.length === 0) {
      throw new Error('engine returned no translation');
    }

    return {
      translatedText,
      translated: true,
      status: 'ok',
      engine: ENGINE_NAME,
      detectedSourceLanguage: data?.detectedLanguage?.language,
    };
  } catch (error) {
    console.error('[translation] self-hosted engine unreachable:', (error as Error).message);
    return untranslated('unreachable');
  } finally {
    clearTimeout(timer);
  }
};
