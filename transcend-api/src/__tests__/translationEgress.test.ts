/**
 * Translation egress guard.
 *
 * Privileged client communications must never leave Transcend Law
 * infrastructure. There is deliberately no code path from the translation
 * service to DeepL, Google, OpenAI or any other hosted translator - and a
 * misconfigured TRANSLATION_ENGINE_URL is the one realistic way privileged text
 * could still escape. This test pins that guard.
 */

describe('translation engine egress guard', () => {
  const load = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../services/translationEngine') as typeof import('../services/translationEngine');
  };

  const original = process.env.TRANSLATION_ENGINE_URL;
  const originalAllow = process.env.TRANSLATION_ALLOW_ANY_HOST;

  afterEach(() => {
    if (original === undefined) delete process.env.TRANSLATION_ENGINE_URL;
    else process.env.TRANSLATION_ENGINE_URL = original;
    if (originalAllow === undefined) delete process.env.TRANSLATION_ALLOW_ANY_HOST;
    else process.env.TRANSLATION_ALLOW_ANY_HOST = originalAllow;
  });

  const expectStatus = (url: string | undefined, status: string) => {
    if (url === undefined) delete process.env.TRANSLATION_ENGINE_URL;
    else process.env.TRANSLATION_ENGINE_URL = url;
    expect(load().resolveEngineUrl().status).toBe(status);
  };

  it('is off when unconfigured', () => {
    expectStatus(undefined, 'not_configured');
  });

  it.each([
    ['loopback', 'http://127.0.0.1:5000'],
    ['localhost', 'http://localhost:5000'],
    ['docker service name', 'http://translation:5000'],
    ['private 10.x', 'http://10.0.3.9:5000'],
    ['cluster-internal', 'http://translate.svc.internal'],
  ])('allows self-hosted: %s', (_label, url) => {
    expectStatus(url, 'ok');
  });

  it.each([
    ['DeepL', 'https://api-free.deepl.com'],
    ['Google', 'https://translation.googleapis.com'],
    ['OpenAI', 'https://api.openai.com'],
    ['public LibreTranslate SaaS', 'https://libretranslate.com'],
    ['arbitrary public host', 'https://evil.example.com'],
  ])('refuses third-party/public host: %s', (_label, url) => {
    expectStatus(url, 'blocked');
  });

  it('never reports a third-party provider as available', () => {
    process.env.TRANSLATION_ENGINE_URL = 'https://api-free.deepl.com';
    const { resolveEngineUrl } = load();
    const { url, status } = resolveEngineUrl();
    expect(url).toBeNull();
    expect(status).toBe('blocked');
  });

  it('returns the original text, marked untranslated, when blocked', async () => {
    process.env.TRANSLATION_ENGINE_URL = 'https://api.openai.com';
    const { translateInHouse } = load();
    const result = await translateInHouse('Privileged content', 'es');
    expect(result.translated).toBe(false);
    expect(result.translatedText).toBe('Privileged content');
    expect(result.status).toBe('blocked');
  });
});
