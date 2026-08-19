// Envelope encryption for uploaded documents.
//
// Case documents include medical records in personal-injury matters, which
// implicates HIPAA on top of attorney-client privilege. S3 server-side
// encryption alone means AWS holds the keys and a bucket misconfiguration
// exposes plaintext, so document bytes are encrypted client-side BEFORE upload:
// what lands in S3 is ciphertext only we can open. SSE stays enabled on top.
//
// Envelope scheme (per document):
//   1. random 256-bit data key encrypts the file with AES-256-GCM
//   2. the data key is wrapped with the master key (also AES-256-GCM)
//   3. wrapped key + nonces + tags travel in a header prepended to the ciphertext
//
// A per-document data key means compromising one document does not compromise
// the rest, and the master key can be rotated by rewrapping data keys without
// re-encrypting file bodies.
//
// Layout:
//   magic "TLENC1" | wrapIv(12) | wrapTag(16) | wrappedKey(32) | dataIv(12) | dataTag(16) | ciphertext
//
// HIPAA reference: encryption at rest per NIST SP 800-111; the HHS breach safe
// harbour applies to properly encrypted PHI.

import crypto from 'crypto';

const MAGIC = Buffer.from('TLENC1');
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const HEADER_LENGTH =
  MAGIC.length + IV_LENGTH + TAG_LENGTH + KEY_LENGTH + IV_LENGTH + TAG_LENGTH;

const getMasterKey = (): Buffer | null => {
  const raw = process.env.FIELD_ENCRYPTION_KEY || process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) return null;

  const key = Buffer.from(raw, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`FIELD_ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (64 hex chars)`);
  }
  return key;
};

export const isDocumentEncryptionConfigured = (): boolean => Boolean(getMasterKey());

/** True when the buffer carries our envelope header. */
export const isDocumentEncrypted = (buffer: Buffer): boolean =>
  buffer.length >= HEADER_LENGTH && buffer.subarray(0, MAGIC.length).equals(MAGIC);

/**
 * Encrypt a document for storage.
 *
 * Throws when no key is configured: unlike a message field, silently storing a
 * plaintext medical record is not an acceptable degradation.
 */
export const encryptDocument = (plaintext: Buffer): Buffer => {
  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error(
      'Cannot encrypt document: FIELD_ENCRYPTION_KEY is not configured. ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  // 1. Per-document data key.
  const dataKey = crypto.randomBytes(KEY_LENGTH);
  const dataIv = crypto.randomBytes(IV_LENGTH);
  const dataCipher = crypto.createCipheriv(ALGORITHM, dataKey, dataIv);
  const ciphertext = Buffer.concat([dataCipher.update(plaintext), dataCipher.final()]);
  const dataTag = dataCipher.getAuthTag();

  // 2. Wrap the data key under the master key.
  const wrapIv = crypto.randomBytes(IV_LENGTH);
  const wrapCipher = crypto.createCipheriv(ALGORITHM, masterKey, wrapIv);
  const wrappedKey = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();

  // Data key must not linger in memory any longer than necessary.
  dataKey.fill(0);

  return Buffer.concat([MAGIC, wrapIv, wrapTag, wrappedKey, dataIv, dataTag, ciphertext]);
};

/**
 * Decrypt a stored document. Buffers without our header are returned unchanged
 * so documents uploaded before encryption was enabled remain downloadable.
 */
export const decryptDocument = (stored: Buffer): Buffer => {
  if (!isDocumentEncrypted(stored)) return stored; // legacy plaintext object

  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error('Cannot decrypt document: FIELD_ENCRYPTION_KEY is not configured');
  }

  let offset = MAGIC.length;
  const read = (length: number) => {
    const slice = stored.subarray(offset, offset + length);
    offset += length;
    return slice;
  };

  const wrapIv = read(IV_LENGTH);
  const wrapTag = read(TAG_LENGTH);
  const wrappedKey = read(KEY_LENGTH);
  const dataIv = read(IV_LENGTH);
  const dataTag = read(TAG_LENGTH);
  const ciphertext = stored.subarray(offset);

  const unwrap = crypto.createDecipheriv(ALGORITHM, masterKey, wrapIv);
  unwrap.setAuthTag(wrapTag);
  const dataKey = Buffer.concat([unwrap.update(wrappedKey), unwrap.final()]);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, dataKey, dataIv);
    decipher.setAuthTag(dataTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } finally {
    dataKey.fill(0);
  }
};
