# Encryption of privileged content

Attorney-client communications are encrypted in transit and at rest. This is a
professional-responsibility requirement (ABA Model Rule 1.6(c); Cal. Rules of
Prof. Conduct 1.6 and Bus. & Prof. Code § 6068(e)(1); Tex. Disciplinary R. 1.05;
R. Reg. Fla. Bar 4-1.6(e)) and materially reduces statutory exposure, because
all three states define a reportable breach in terms of **unencrypted** personal
information:

- Cal. Civ. Code § 1798.82 — and § 1798.150, a private right of action with
  statutory damages of $100–$750 per consumer per incident for breaches of
  nonencrypted personal information.
- Tex. Bus. & Com. Code § 521.053
- Fla. Stat. § 501.171

This is engineering documentation, not legal advice — confirm the specifics with
counsel and your malpractice carrier.

## Required configuration

```bash
# 32-byte hex key. In production this belongs in KMS/Vault, not a plain env var.
FIELD_ENCRYPTION_KEY=$(openssl rand -hex 32)

# App-to-database TLS. Auto-enabled for any non-loopback DB_HOST.
DB_SSL=true
DB_SSL_CA=<PEM of your database CA>
```

Then apply the migrations and backfill:

```bash
psql "$DATABASE_URL" -f transcend-api/src/database/migrations/008_translation_cache.sql
psql "$DATABASE_URL" -f transcend-api/src/database/migrations/009_encrypt_privileged_content.sql
cd transcend-api && npx tsx src/scripts/backfillMessageEncryption.ts --apply
```

**If `FIELD_ENCRYPTION_KEY` is unset the app logs a `[security]` error and stores
content in plaintext** rather than dropping messages. Treat that log line as a
production incident.

**Losing the key means losing the data.** AES-256-GCM is not recoverable without
it. Back it up in your KMS with the same rigour as database backups.

## What is encrypted

| Data | At rest | Notes |
|---|---|---|
| P2P message bodies (`p2p_messages.content`) | AES-256-GCM | Encrypted on write, decrypted in `mapMessageRow` |
| Cached translations (`translation_cache.translated_text`) | AES-256-GCM | Translation of privileged text is privileged |
| Translation source text | **Not stored** | Deliberately dropped rather than duplicated |
| Translation lookup key | Keyed HMAC-SHA256 | Blind index, not a reversible or brute-forceable digest |
| App ↔ database traffic | TLS | `DB_SSL`, verified when `DB_SSL_CA` is set |
| Encryption keys themselves | AES-256-GCM under master key | Existing `keyRotationService` |

## Known trade-off: message search

Encrypting message bodies makes server-side full-text search impossible — a GIN
index over ciphertext matches nothing. Migration 009 therefore drops
`idx_p2p_messages_content_fts`. **If any feature relied on searching message
text, it is now broken and needs a keyed blind index over extracted terms
instead.** This was a deliberate choice: searchable plaintext privileged content
is the exposure we were removing.

## Still open

- **Uploaded documents** are not covered here. Medical records in personal-injury
  matters implicate HIPAA, where the breach safe harbour requires NIST-grade
  encryption (SP 800-111 at rest, SP 800-52 in transit). Object storage should
  use SSE-KMS at minimum.
- **`src/routes/messages.ts` does not persist anything** (`// TODO: Save to
  database`). Client↔attorney messages are not stored yet; when that lands it
  must use `encryptField`/`decryptField` like `p2pMessaging.ts` does.
- **Key rotation for field encryption.** The `v1:` envelope prefix supports
  re-keying, but no rotation job exists for these columns yet.
