-- Encrypt uploaded case documents
--
-- Case documents include medical records in personal-injury matters, so they
-- carry attorney-client privilege AND (for PHI) HIPAA obligations. S3
-- server-side encryption alone leaves the keys with AWS; document bodies are now
-- encrypted client-side before upload (src/services/documentEncryption.ts) so
-- the stored object is ciphertext only we can open.
--
-- HIPAA: encryption at rest per NIST SP 800-111; the HHS breach safe harbour
-- applies to properly encrypted PHI.

-- Marks rows whose S3 object carries our envelope header. Legacy NULL/FALSE rows
-- download fine (decryptDocument passes non-envelope buffers through) but are
-- NOT covered by the safe harbours until re-uploaded.
ALTER TABLE case_documents
  ADD COLUMN IF NOT EXISTS client_encrypted BOOLEAN NOT NULL DEFAULT FALSE;

-- The filename is itself sensitive ("Smith_v_Jones_medical_records.pdf"), so it
-- is stored as an AES-256-GCM envelope and kept out of the S3 key entirely.
-- Widened from VARCHAR(255): ciphertext is longer than the plaintext it holds.
ALTER TABLE case_documents
  ALTER COLUMN file_name TYPE TEXT;

COMMENT ON COLUMN case_documents.file_name IS
  'PRIVILEGED. AES-256-GCM envelope (v1:iv:tag:ciphertext) written by fieldEncryption.ts.';

COMMENT ON COLUMN case_documents.client_encrypted IS
  'TRUE when the S3 object body is client-side encrypted (TLENC1 envelope). FALSE rows predate document encryption.';

-- Document access is authorised in downloadCaseDocument against case_offers;
-- this index keeps that check cheap.
CREATE INDEX IF NOT EXISTS idx_case_offers_case_attorney_status
  ON case_offers (case_id, attorney_id, status);
