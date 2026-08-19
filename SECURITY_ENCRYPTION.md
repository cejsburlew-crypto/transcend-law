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
| Client↔attorney messages (`messages.content`) | AES-256-GCM | Encrypted on write, decrypted only for a verified participant |
| P2P message bodies (`p2p_messages.content`) | AES-256-GCM | Encrypted on write, decrypted in `mapMessageRow` |
| Uploaded documents (S3 object bodies) | AES-256-GCM envelope, per-document data key | Client-side, **before** upload. SSE stays on underneath |
| Document filenames (`case_documents.file_name`) | AES-256-GCM | Also removed from the S3 key |
| Cached translations (`translation_cache.translated_text`) | AES-256-GCM | Translation of privileged text is privileged |
| Translation source text | **Not stored** | Deliberately dropped rather than duplicated |
| Translation lookup key | Keyed HMAC-SHA256 | Blind index, not a reversible or brute-forceable digest |
| App ↔ database traffic | TLS | `DB_SSL`, verified when `DB_SSL_CA` is set |
| S3 objects (server side) | SSE-KMS when `AWS_KMS_KEY_ID` set, else SSE-S3 | Defence in depth under the envelope |
| Encryption keys themselves | AES-256-GCM under master key | Existing `keyRotationService` |

## Document encryption scheme

Per document: a random 256-bit data key encrypts the body (AES-256-GCM), then
that key is wrapped under the master key and travels in a 94-byte header:

```
"TLENC1" | wrapIv(12) | wrapTag(16) | wrappedKey(32) | dataIv(12) | dataTag(16) | ciphertext
```

A per-document data key means one compromised document does not expose the rest,
and the master key can be rotated by rewrapping data keys without rewriting file
bodies. Verified: PDF magic bytes and PHI strings absent from ciphertext,
byte-exact round trip, unique key per document, tamper detection on both the body
and the wrapped key, and a wrong master key cannot decrypt.

### Presigned URLs bypass this

`getSignedUrl` streams the raw S3 object, so a presigned **GET** returns
ciphertext and a presigned **PUT** stores plaintext. Both paths now log a
`[security]` warning. All document reads must go through `downloadCaseDocument`
and all writes through `uploadCaseDocument`.

## Known trade-off: message search

Encrypting message bodies makes server-side full-text search impossible — a GIN
index over ciphertext matches nothing. Migration 009 therefore drops
`idx_p2p_messages_content_fts`. **If any feature relied on searching message
text, it is now broken and needs a keyed blind index over extracted terms
instead.** This was a deliberate choice: searchable plaintext privileged content
is the exposure we were removing.

## Authorisation fixes shipped alongside

Encryption is worthless if the wrong person can ask for the plaintext. Three
access-control holes were closed in the same pass:

- **`downloadCaseDocument` had no ACL at all** — the code said "For now, any
  authenticated user can download". Any logged-in user could pull any case
  document, including medical records. Access is now limited to the case's client
  and attorneys with an active offer (`quoted`/`accepted`/`retained`).
- **`/api/v2/messages` was mounted without auth middleware.** `req.user` was
  always undefined so every handler 401'd — fail-closed, but non-functional.
  `authMiddleware` is now applied at the router level.
- **P2P routes imported `authenticate` but never applied it.** Same failure mode,
  same fix.

Both message endpoints also authorise per conversation, and return **404 rather
than 403** for a non-participant so the endpoint cannot be used to enumerate
which conversation ids exist.

## Still open

- **Key rotation for field encryption.** The `v1:` / `TLENC1` envelopes support
  re-keying, but no rotation job exists for these columns or for rewrapping
  document data keys.
- **Legacy documents remain plaintext in S3.** `client_encrypted = FALSE` rows
  download fine but are not covered by the safe harbours until re-uploaded. There
  is no S3 re-encryption backfill yet — it needs a get/encrypt/put pass per
  object.
- **`translated_content` JSONB columns** on `messages` and `cases` are unused by
  this code. If anything starts writing translations there they must be
  encrypted, or the column dropped in favour of `translation_cache`.
- **Rate limiting is per-process.** `MessageRateLimiter` replaced a hard `redis`
  dependency that was never installed; with N API instances the effective limit
  is N × 100/hour. Fine as abuse prevention, not a security boundary.
