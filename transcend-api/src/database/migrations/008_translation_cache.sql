-- Translation cache — Transcend Law owned storage
--
-- Every translation the platform ever shows a reader is persisted HERE, inside
-- our own database, on the same trust boundary as the messages themselves.
-- Privileged content is translated by a self-hosted engine and the result is
-- kept in-house; nothing is ever handed to a third-party translation service.
--
-- The source text is NEVER stored: it is a second copy of privileged content we
-- already hold. Rows are keyed by a keyed HMAC blind index of the source, and
-- the translation itself is stored AES-256-GCM encrypted (fieldEncryption.ts),
-- because a translation of a privileged message is equally privileged.

CREATE TABLE IF NOT EXISTS translation_cache (
  id              BIGSERIAL PRIMARY KEY,
  -- Keyed HMAC-SHA256 of the source text. Not reversible without the key.
  source_lookup   CHAR(64)     NOT NULL,
  source_language VARCHAR(12),
  target_language VARCHAR(12)  NOT NULL,
  -- AES-256-GCM envelope: v1:<iv>:<tag>:<ciphertext>
  translated_text TEXT         NOT NULL,
  -- Which in-house engine produced this. Never a third-party service name.
  engine          VARCHAR(64)  NOT NULL DEFAULT 'self-hosted',
  engine_version  VARCHAR(64),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  use_count       INTEGER      NOT NULL DEFAULT 1,

  CONSTRAINT translation_cache_unique UNIQUE (source_lookup, target_language, engine)
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_lookup
  ON translation_cache (source_lookup, target_language);

CREATE INDEX IF NOT EXISTS idx_translation_cache_last_used
  ON translation_cache (last_used_at);

COMMENT ON TABLE translation_cache IS
  'In-house translation results. Populated only by a self-hosted engine; no third-party translation service may write here.';
