/**
 * Encryption contract for privileged content.
 *
 * These properties are what put attorney-client communications and case
 * documents inside the encryption safe harbours in Cal. Civ. Code § 1798.82,
 * Tex. Bus. & Com. Code § 521.053 and Fla. Stat. § 501.171 (and, for PHI, the
 * HHS breach safe harbour). A regression here is a compliance regression, not
 * just a bug - so they are asserted rather than assumed.
 */

import crypto from 'crypto';

const KEY = crypto.randomBytes(32).toString('hex');

describe('field encryption (messages, filenames, translations)', () => {
  let mod: typeof import('../services/fieldEncryption');

  beforeAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = KEY;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../services/fieldEncryption');
  });

  const privileged =
    'Client states the settlement offer of $1.2M is unacceptable. Privileged & confidential. 不要翻译 / Đường Lê Lợi';

  it('is configured when a key is present', () => {
    expect(mod.isEncryptionConfigured()).toBe(true);
  });

  it('does not leave plaintext in the ciphertext', () => {
    const ct = mod.encryptField(privileged);
    expect(ct).not.toContain('settlement');
    expect(ct).not.toContain('1.2M');
    expect(ct).not.toContain('不要翻译');
  });

  it('uses a versioned envelope', () => {
    const ct = mod.encryptField(privileged);
    expect(mod.isEncrypted(ct)).toBe(true);
    expect(ct.startsWith('v1:')).toBe(true);
  });

  it('round-trips exactly, including mixed scripts', () => {
    expect(mod.decryptField(mod.encryptField(privileged))).toBe(privileged);
  });

  it('uses a fresh IV per encryption', () => {
    expect(mod.encryptField(privileged)).not.toBe(mod.encryptField(privileged));
  });

  it('passes through legacy plaintext rows during a rolling backfill', () => {
    expect(mod.decryptField('old unencrypted message')).toBe('old unencrypted message');
  });

  it('detects tampering', () => {
    const parts = mod.encryptField(privileged).split(':');
    const flipped = parts[3].slice(0, -2) + (parts[3].slice(-2) === 'ff' ? 'ee' : 'ff');
    expect(() => mod.decryptField(`${parts[0]}:${parts[1]}:${parts[2]}:${flipped}`)).toThrow();
  });

  describe('blind index', () => {
    it('is deterministic so it can be looked up', () => {
      expect(mod.blindIndex(privileged)).toBe(mod.blindIndex(privileged));
    });

    it('differs for different text', () => {
      expect(mod.blindIndex(privileged)).not.toBe(mod.blindIndex(privileged + '.'));
    });

    it('is keyed, not a bare SHA-256 (which would be brute-forceable)', () => {
      const bare = crypto.createHash('sha256').update(privileged, 'utf8').digest('hex');
      expect(mod.blindIndex(privileged)).not.toBe(bare);
    });
  });
});

describe('document envelope encryption (case documents, PHI)', () => {
  let mod: typeof import('../services/documentEncryption');

  beforeAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = KEY;
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../services/documentEncryption');
  });

  // Stands in for a medical record in a personal-injury matter.
  const pdf = Buffer.concat([
    Buffer.from('%PDF-1.7\n'),
    Buffer.from('PATIENT: Jane Doe  DOB 1984-03-02  Dx: lumbar strain'),
    crypto.randomBytes(4096),
  ]);

  it('writes an identifiable envelope header', () => {
    expect(mod.isDocumentEncrypted(mod.encryptDocument(pdf))).toBe(true);
  });

  it('does not expose the file type', () => {
    expect(mod.encryptDocument(pdf).subarray(0, 64).includes(Buffer.from('%PDF'))).toBe(false);
  });

  it('does not leave PHI in the ciphertext', () => {
    expect(mod.encryptDocument(pdf).indexOf(Buffer.from('PATIENT: Jane Doe'))).toBe(-1);
  });

  it('round-trips byte-exact', () => {
    expect(mod.decryptDocument(mod.encryptDocument(pdf)).equals(pdf)).toBe(true);
  });

  it('uses a distinct data key per document', () => {
    expect(mod.encryptDocument(pdf).equals(mod.encryptDocument(pdf))).toBe(false);
  });

  it('passes through legacy unencrypted objects', () => {
    expect(mod.decryptDocument(pdf).equals(pdf)).toBe(true);
  });

  it('detects tampering with the body', () => {
    const enc = mod.encryptDocument(pdf);
    const t = Buffer.from(enc);
    t[enc.length - 1] ^= 0xff;
    expect(() => mod.decryptDocument(t)).toThrow();
  });

  it('detects tampering with the wrapped data key', () => {
    const enc = mod.encryptDocument(pdf);
    const w = Buffer.from(enc);
    w[40] ^= 0xff;
    expect(() => mod.decryptDocument(w)).toThrow();
  });

  it('cannot be decrypted with a different master key', () => {
    const enc = mod.encryptDocument(pdf);
    process.env.FIELD_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const other: typeof import('../services/documentEncryption') = require('../services/documentEncryption');
    expect(() => other.decryptDocument(enc)).toThrow();
    process.env.FIELD_ENCRYPTION_KEY = KEY;
  });

  it('adds only a fixed-size header', () => {
    // magic(6) + wrapIv(12) + wrapTag(16) + wrappedKey(32) + dataIv(12) + dataTag(16)
    expect(mod.encryptDocument(pdf).length - pdf.length).toBe(94);
  });
});
