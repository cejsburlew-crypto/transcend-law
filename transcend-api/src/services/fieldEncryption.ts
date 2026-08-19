// Application-level field encryption for privileged content.
//
// Attorney-client communications are encrypted before they reach Postgres, so a
// database dump, snapshot, or replica leak yields ciphertext rather than
// readable client confidences. This is what puts us inside the encryption safe
// harbours in Cal. Civ. Code § 1798.82, Tex. Bus. & Com. Code § 521.053 and
// Fla. Stat. § 501.171 — each defines a reportable breach in terms of
// *unencrypted* personal information.
//
// AES-256-GCM: authenticated, so tampering is detected rather than silently
// decrypted. Same algorithm already used by keyRotationService.
//
// Stored format:  v1:<iv>:<authTag>:<ciphertext>   (all hex)
// The version prefix lets us re-key later without guessing at old rows.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard
const KEY_LENGTH = 32; // 256-bit
const VERSION = 'v1';

let warnedMissingKey = false;

/**
 * Field encryption key, distinct from ENCRYPTION_MASTER_KEY so that rotating
 * one does not force re-encryption of the other.
 *
 * Generate:  openssl rand -hex 32
 * In production this should come from KMS/Vault, not a plain env var.
 */
const getKey = (): Buffer | null => {
  const raw = process.env.FIELD_ENCRYPTION_KEY || process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    if (!warnedMissingKey) {
      console.error(
        '[security] FIELD_ENCRYPTION_KEY is not set - privileged content will be stored in PLAINTEXT. ' +
          'Generate one with: openssl rand -hex 32'
      );
      warnedMissingKey = true;
    }
    return null;
  }

  const key = Buffer.from(raw, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`FIELD_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (64 hex chars), got ${key.length}`);
  }
  return key;
};

export const isEncryptionConfigured = (): boolean => Boolean(getKey());

/** True when the value is already in our envelope format. */
export const isEncrypted = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.startsWith(`${VERSION}:`);

/**
 * Encrypt a field value. Returns the value unchanged if no key is configured,
 * so an unconfigured deployment degrades to today's behaviour rather than
 * losing messages - the startup error above is the signal to fix it.
 */
export const encryptField = (plaintext: string): string => {
  const key = getKey();
  if (!key || plaintext === '') return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${VERSION}:${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
};

/**
 * Decrypt a field value. Values written before encryption was enabled are
 * returned as-is, so reads keep working during a rolling backfill.
 */
export const decryptField = (stored: string | null | undefined): string => {
  if (!stored) return '';
  if (!isEncrypted(stored)) return stored; // legacy plaintext row

  const key = getKey();
  if (!key) {
    throw new Error('Cannot decrypt: FIELD_ENCRYPTION_KEY is not configured');
  }

  const [, ivHex, tagHex, dataHex] = stored.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Malformed encrypted field');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};

/**
 * Deterministic blind index for equality lookups on encrypted content.
 *
 * A plain SHA-256 of a short message is brute-forceable by an attacker with the
 * database, so we key the digest with a server-side secret. Without the key the
 * index reveals only that two rows share the same text.
 */
export const blindIndex = (value: string): string => {
  const key = getKey();
  const secret = key ?? Buffer.alloc(KEY_LENGTH); // stable fallback when unconfigured
  return crypto.createHmac('sha256', secret).update(value, 'utf8').digest('hex');
};
