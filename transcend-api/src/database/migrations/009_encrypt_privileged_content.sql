-- Encrypt privileged content at rest
--
-- Attorney-client message bodies and their translations were stored as
-- plaintext. Both are privileged; a database dump exposed them directly.
-- Application-level AES-256-GCM (see src/services/fieldEncryption.ts) now
-- encrypts them before they reach Postgres, which is what brings us inside the
-- encryption safe harbours in Cal. Civ. Code § 1798.82, Tex. Bus. & Com. Code
-- § 521.053 and Fla. Stat. § 501.171.
--
-- Columns stay TEXT: the envelope is "v1:<iv>:<tag>:<ciphertext>" hex. Existing
-- plaintext rows keep working (decryptField passes non-envelope values through)
-- so this can be deployed before the backfill runs.

-- ---------------------------------------------------------------------------
-- 1. p2p_messages
-- ---------------------------------------------------------------------------

-- The full-text index cannot function over ciphertext: a GIN index on encrypted
-- content would leak nothing useful and match nothing. Dropping it disables
-- server-side message search, which is the deliberate cost of encrypting the
-- bodies. Reintroduce search via a keyed blind index on extracted terms if it
-- is needed.
-- p2p_messages is created by database/schema-p2p-messaging.sql, which is applied
-- separately from the main schema. Guard the whole block so this migration is
-- safe on a database where the p2p schema has not been loaded.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'p2p_messages') THEN

    -- A GIN index over ciphertext matches nothing; dropping it disables
    -- server-side message search, the deliberate cost of encrypting bodies.
    EXECUTE 'DROP INDEX IF EXISTS idx_p2p_messages_content_fts';

    EXECUTE $c$COMMENT ON COLUMN p2p_messages.content IS
      'PRIVILEGED. AES-256-GCM envelope (v1:iv:tag:ciphertext) written by fieldEncryption.ts. Never query or log directly.'$c$;
  ELSE
    RAISE NOTICE 'p2p_messages not present; skipping (apply database/schema-p2p-messaging.sql first if p2p messaging is in use)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. translation_cache
-- ---------------------------------------------------------------------------
-- A translation of a privileged message is equally privileged. The original
-- source text is dropped entirely rather than encrypted: it is a second copy of
-- content we already store in p2p_messages, and translations can be regenerated
-- on demand if the engine is upgraded.

ALTER TABLE translation_cache DROP COLUMN IF EXISTS source_text;

-- source_hash was an unkeyed SHA-256 - brute-forceable for short messages by
-- anyone holding the database. Replaced by a keyed HMAC blind index.
-- Guarded so this migration is idempotent and safe on a fresh database where
-- 008 already created the column under its new name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'translation_cache' AND column_name = 'source_hash'
  ) THEN
    ALTER TABLE translation_cache RENAME COLUMN source_hash TO source_lookup;
  END IF;
END $$;

COMMENT ON COLUMN translation_cache.source_lookup IS
  'Keyed HMAC-SHA256 blind index of the source text (fieldEncryption.blindIndex). Not reversible without FIELD_ENCRYPTION_KEY.';

COMMENT ON COLUMN translation_cache.translated_text IS
  'PRIVILEGED. AES-256-GCM envelope written by fieldEncryption.ts.';

-- Existing rows were written with an unkeyed hash and plaintext translations;
-- they can no longer be located by the new blind index. Clear them so they are
-- re-translated in-house on next view rather than lingering as plaintext.
DELETE FROM translation_cache;
