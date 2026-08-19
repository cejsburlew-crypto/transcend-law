# Translation — in-house only

Message bodies and UI copy are translated for the reader by an engine **we run
ourselves**. Privileged client communications never leave Transcend Law
infrastructure, and every translation is cached in our own Postgres database.

There is no code path to DeepL, Google, OpenAI, or any other hosted translation
service. `transcend-api/src/services/translationEngine.ts` will refuse to send
text to a known public translation host, and by default refuses any host that is
not loopback or a private address.

## Setup

1. **Start the engine** (LibreTranslate, Apache-2.0, bound to loopback):

   ```bash
   docker compose -f docker-compose.translation.yml up -d
   ```

   First boot downloads the `en,es,zh,vi` models. After that it runs offline.

2. **Apply the cache migration:**

   ```bash
   psql "$DATABASE_URL" -f transcend-api/src/database/migrations/008_translation_cache.sql
   ```

3. **Point the API at it** in `transcend-api/.env`:

   ```
   TRANSLATION_ENGINE_URL=http://127.0.0.1:5000
   ```

4. **Confirm it is live:**

   ```bash
   curl -s localhost:3000/api/v2/translate/status
   ```

   Expect `{"available":true,"status":"ok","selfHosted":true,"thirdPartyProviders":"disabled"}`.

## Encryption at rest

Cached translations are privileged: a translation of a privileged message is
equally privileged. So the cache stores

- a **keyed HMAC blind index** of the source text, not the text itself and not a
  bare SHA-256 (a plain digest of a short message is brute-forceable by anyone
  holding the database), and
- the translation **AES-256-GCM encrypted** via
  `transcend-api/src/services/fieldEncryption.ts`.

The source text is never persisted. Set the key before first use:

```
FIELD_ENCRYPTION_KEY=<openssl rand -hex 32>
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `TRANSLATION_ENGINE_URL` | *(unset)* | Base URL of our self-hosted engine. Unset = translation off. |
| `TRANSLATION_ENGINE_API_KEY` | *(unset)* | Only if the engine requires one. |
| `TRANSLATION_ENGINE_NAME` | `self-hosted` | Recorded on each cached row. |
| `TRANSLATION_TIMEOUT_MS` | `8000` | Per-request timeout. |
| `TRANSLATION_MAX_CHARS` | `5000` | Rejects oversized single requests. |
| `TRANSLATION_MAX_BATCH` | `50` | Caps batch size. |
| `TRANSLATION_ALLOW_ANY_HOST` | `false` | Only if your own engine sits on a public domain you control. |
| `FIELD_ENCRYPTION_KEY` | *(unset)* | 32-byte hex key encrypting cached translations and message bodies. **Required.** |

## Behaviour when the engine is down

Translation degrades, it does not fail: the reader sees the message in its
original language with a notice saying translation is unavailable. Nothing is
queued to an external service, and unsuccessful attempts are never cached.

## What is and is not translated

| | Translated |
|---|---|
| UI text (labels, buttons, headings) | Yes — static, from `src/translations/` |
| Message bodies, as shown to the reader | Yes — display only, original always recoverable via "Show original" |
| What the user types and sends | **No** — stored and delivered verbatim |
| Uploaded documents, file names | **No** |
| Provider records, names, phone numbers | **No** |
| Case descriptions and form values as stored | **No** |
