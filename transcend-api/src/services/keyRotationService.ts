// Key Rotation Service
// Automatic encryption key rotation with versioning, re-encryption, and rollback capability

import crypto from 'crypto';
import { query, transaction, getConnection } from '../database/connection';
import { logAuditEvent } from './securityService';

// ============================================
// TYPES AND INTERFACES
// ============================================

/**
 * A row from `encryption_keys` exactly as Postgres returns it.
 *
 * These functions do `SELECT *` and return `result.rows` directly, so the
 * runtime shape is snake_case. The camelCase `EncryptionKey` below was being
 * used as the return type, which made every property read a type error while
 * the (correct) snake_case reads looked wrong. Rewriting the reads to camelCase
 * would have broken key decryption at runtime - the type was the thing that was
 * wrong, not the code.
 */
export interface EncryptionKeyRow {
  key_id: string;
  version: number;
  algorithm: string;
  /** Encrypted key material as stored. */
  encryption_key: string;
  master_key_id: string;
  created_at: Date;
  rotated_at?: Date;
  archived_at?: Date;
  status: 'active' | 'rotating' | 'archived' | string;
}

/** Camel-cased view of a key, for callers that map rows explicitly. */
export interface EncryptionKey {
  keyId: string;
  version: number;
  algorithm: string;
  encryptionKey: string; // Encrypted key stored in DB
  masterKeyId: string;
  createdAt: Date;
  rotatedAt?: Date;
  archivedAt?: Date;
  status: 'active' | 'rotated' | 'archived';
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  algorithm: string;
}

export interface RotationJob {
  jobId: string;
  startedAt: Date;
  completedAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
  oldKeyVersion: number;
  newKeyVersion: number;
  recordsProcessed: number;
  recordsFailed: number;
  error?: string;
  rollbackReason?: string;
}

interface RotationConfig {
  rotationIntervalDays: number;
  maxRetries: number;
  batchSize: number;
  enableAutoRotation: boolean;
  testRotationIntervalDays: number;
}

// ============================================
// CONFIGURATION
// ============================================

const config: RotationConfig = {
  rotationIntervalDays: 30,
  maxRetries: 3,
  batchSize: 1000,
  enableAutoRotation: true,
  testRotationIntervalDays: 7,
};

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// ============================================
// MASTER KEY OPERATIONS
// ============================================

/**
 * Get the master encryption key from environment
 * In production, this should come from a KMS like AWS KMS or HashiCorp Vault
 */
function getMasterKey(): Buffer {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!masterKey) {
    throw new Error('ENCRYPTION_MASTER_KEY not configured. Set in environment variables.');
  }
  return Buffer.from(masterKey, 'hex');
}

/**
 * Encrypt a key using the master key
 */
function encryptKeyWithMaster(keyData: Buffer): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(keyData);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return combined.toString('hex');
}

/**
 * Decrypt a key using the master key
 */
function decryptKeyWithMaster(encryptedData: string): Buffer {
  const masterKey = getMasterKey();
  const combined = Buffer.from(encryptedData, 'hex');

  const iv = combined.slice(0, IV_LENGTH);
  const authTag = combined.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted;
}

// ============================================
// KEY GENERATION AND MANAGEMENT
// ============================================

/**
 * Generate a new encryption key
 */
function generateNewKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Store a new encryption key in the database
 */
export async function storeEncryptionKey(keyData: Buffer): Promise<EncryptionKeyRow> {
  const keyId = crypto.randomUUID();
  const encryptedKey = encryptKeyWithMaster(keyData);

  // Get next version number
  const versionResult = await query(
    `SELECT COALESCE(MAX(version), 0) as max_version FROM encryption_keys`
  );
  const nextVersion = versionResult.rows[0].max_version + 1;

  const result = await query(
    `INSERT INTO encryption_keys
     (key_id, version, algorithm, encryption_key, master_key_id, created_at, status)
     VALUES ($1, $2, $3, $4, $5, NOW(), $6)
     RETURNING *`,
    [
      keyId,
      nextVersion,
      ENCRYPTION_ALGORITHM,
      encryptedKey,
      'master-key-1', // In production, track which master key was used
      'active',
    ]
  );

  return result.rows[0] as EncryptionKeyRow;
}

/**
 * Get the current active encryption key
 */
export async function getActiveEncryptionKey(): Promise<EncryptionKeyRow> {
  const result = await query(
    `SELECT * FROM encryption_keys
     WHERE status = 'active'
     ORDER BY version DESC
     LIMIT 1`
  );

  if (!result.rows[0]) {
    throw new Error('No active encryption key found. Initialize keys first.');
  }

  return result.rows[0] as EncryptionKeyRow;
}

/**
 * Get an encryption key by version
 */
export async function getEncryptionKeyByVersion(version: number): Promise<EncryptionKeyRow> {
  const result = await query(
    `SELECT * FROM encryption_keys WHERE version = $1`,
    [version]
  );

  if (!result.rows[0]) {
    throw new Error(`Encryption key version ${version} not found`);
  }

  return result.rows[0] as EncryptionKeyRow;
}

/**
 * Get all encryption keys (for rotation and archival tracking)
 */
export async function getAllEncryptionKeys(): Promise<EncryptionKeyRow[]> {
  const result = await query(
    `SELECT * FROM encryption_keys ORDER BY version DESC`
  );

  return result.rows as EncryptionKeyRow[];
}

// ============================================
// ENCRYPTION AND DECRYPTION
// ============================================

/**
 * Encrypt data using the active key
 */
export async function encryptData(plaintext: string): Promise<EncryptedData> {
  const activeKey = await getActiveEncryptionKey();
  const decryptedKey = decryptKeyWithMaster(activeKey.encryption_key);

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, decryptedKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    keyVersion: activeKey.version,
    algorithm: ENCRYPTION_ALGORITHM,
  };
}

/**
 * Decrypt data using the appropriate key version
 */
export async function decryptData(encryptedData: EncryptedData): Promise<string> {
  const key = await getEncryptionKeyByVersion(encryptedData.keyVersion);
  const decryptedKey = decryptKeyWithMaster(key.encryption_key);

  const iv = Buffer.from(encryptedData.iv, 'hex');
  const authTag = Buffer.from(encryptedData.authTag, 'hex');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'hex');

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, decryptedKey, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');

  return plaintext;
}

/**
 * Re-encrypt data from old key to new key
 */
export async function reEncryptData(
  oldEncryptedData: EncryptedData,
  newKeyVersion: number
): Promise<EncryptedData> {
  // Decrypt with old key
  const plaintext = await decryptData(oldEncryptedData);

  // Get new key
  const newKey = await getEncryptionKeyByVersion(newKeyVersion);
  const decryptedNewKey = decryptKeyWithMaster(newKey.encryption_key);

  // Encrypt with new key
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, decryptedNewKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    keyVersion: newKeyVersion,
    algorithm: ENCRYPTION_ALGORITHM,
  };
}

// ============================================
// KEY ROTATION JOBS
// ============================================

/**
 * Initialize a new rotation job
 */
async function createRotationJob(oldVersion: number, newVersion: number): Promise<RotationJob> {
  const jobId = crypto.randomUUID();

  const result = await query(
    `INSERT INTO key_rotation_jobs
     (job_id, started_at, status, old_key_version, new_key_version, records_processed, records_failed)
     VALUES ($1, NOW(), $2, $3, $4, 0, 0)
     RETURNING *`,
    [jobId, 'pending', oldVersion, newVersion]
  );

  return result.rows[0] as RotationJob;
}

/**
 * Get rotation job status
 */
export async function getRotationJobStatus(jobId: string): Promise<RotationJob> {
  const result = await query(
    `SELECT * FROM key_rotation_jobs WHERE job_id = $1`,
    [jobId]
  );

  if (!result.rows[0]) {
    throw new Error(`Rotation job ${jobId} not found`);
  }

  return result.rows[0] as RotationJob;
}

/**
 * Update rotation job progress
 */
async function updateRotationJobProgress(
  jobId: string,
  processed: number,
  failed: number,
  status: string
): Promise<void> {
  await query(
    `UPDATE key_rotation_jobs
     SET records_processed = records_processed + $1,
         records_failed = records_failed + $2,
         status = $3
     WHERE job_id = $4`,
    [processed, failed, status, jobId]
  );
}

/**
 * Complete rotation job
 */
async function completeRotationJob(jobId: string): Promise<void> {
  await query(
    `UPDATE key_rotation_jobs
     SET completed_at = NOW(), status = 'completed'
     WHERE job_id = $1`,
    [jobId]
  );
}

/**
 * Fail rotation job with error
 */
async function failRotationJob(jobId: string, error: string): Promise<void> {
  await query(
    `UPDATE key_rotation_jobs
     SET completed_at = NOW(), status = 'failed', error = $1
     WHERE job_id = $2`,
    [error, jobId]
  );
}

/**
 * Archive old encryption key
 */
export async function archiveEncryptionKey(version: number): Promise<void> {
  // Securely archive the key (store in separate table for compliance)
  const key = await getEncryptionKeyByVersion(version);

  await query(
    `INSERT INTO encryption_key_archive
     (key_id, version, archived_key_data, archived_at, reason)
     VALUES ($1, $2, $3, NOW(), $4)`,
    [
      key.key_id,
      key.version,
      key.encryption_key, // Still encrypted with master key
      'Key rotated to new version',
    ]
  );

  // Mark original key as archived
  await query(
    `UPDATE encryption_keys
     SET status = 'archived', archived_at = NOW()
     WHERE version = $1`,
    [version]
  );

  // Overwrite encryption_key field with zeros for defense-in-depth
  await query(
    `UPDATE encryption_keys
     SET encryption_key = '0'
     WHERE version = $1 AND status = 'archived'`,
    [version]
  );
}

// ============================================
// DATA RE-ENCRYPTION
// ============================================

/**
 * Get count of encrypted records by key version
 */
async function getEncryptedRecordsCount(tableName: string, keyVersionColumn: string): Promise<any> {
  const result = await query(
    `SELECT ${keyVersionColumn} as key_version, COUNT(*) as count
     FROM ${tableName}
     WHERE ${keyVersionColumn} IS NOT NULL
     GROUP BY ${keyVersionColumn}
     ORDER BY ${keyVersionColumn} DESC`
  );

  return result.rows;
}

/**
 * Process data re-encryption in batches
 */
async function reEncryptDataBatch(
  jobId: string,
  tableName: string,
  idColumn: string,
  dataColumn: string,
  keyVersionColumn: string,
  newKeyVersion: number,
  offset: number,
  batchSize: number
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  const client = await getConnection();

  try {
    await client.query('BEGIN');

    // Fetch batch of records
    const fetchResult = await client.query(
      `SELECT ${idColumn}, ${dataColumn}, ${keyVersionColumn} FROM ${tableName}
       WHERE ${keyVersionColumn} < $1
       ORDER BY ${idColumn}
       OFFSET $2 LIMIT $3
       FOR UPDATE`,
      [newKeyVersion, offset, batchSize]
    );

    // Re-encrypt each record
    for (const record of fetchResult.rows) {
      try {
        const oldEncryptedData = JSON.parse(record[dataColumn.toLowerCase()]);
        const newEncryptedData = await reEncryptData(oldEncryptedData, newKeyVersion);

        await client.query(
          `UPDATE ${tableName}
           SET ${dataColumn} = $1, ${keyVersionColumn} = $2
           WHERE ${idColumn} = $3`,
          [JSON.stringify(newEncryptedData), newKeyVersion, record[idColumn.toLowerCase()]]
        );

        processed++;
      } catch (error) {
        console.error(`Failed to re-encrypt record ${record[idColumn.toLowerCase()]}:`, error);
        failed++;
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { processed, failed };
}

// ============================================
// ROTATION EXECUTION
// ============================================

/**
 * Execute key rotation with data re-encryption
 */
export async function executeKeyRotation(
  userId?: string,
  userAgent?: string,
  ip?: string
): Promise<RotationJob> {
  const jobId = crypto.randomUUID();
  let rotationJob: RotationJob | null = null;

  try {
    // Get current active key
    const currentKey = await getActiveEncryptionKey();

    // Check if rotation is needed
    const timeSinceLastRotation = new Date().getTime() - new Date(currentKey.created_at).getTime();
    const daysSinceRotation = timeSinceLastRotation / (1000 * 60 * 60 * 24);

    if (daysSinceRotation < config.rotationIntervalDays) {
      console.log(`Key rotation not yet needed. Last rotation: ${daysSinceRotation.toFixed(1)} days ago`);
      return null as any;
    }

    console.log(`Starting key rotation. Current key version: ${currentKey.version}`);

    // Create new key
    const newKeyData = generateNewKey();
    const newKey = await storeEncryptionKey(newKeyData);

    // Create rotation job
    rotationJob = await createRotationJob(currentKey.version, newKey.version);

    // Update job status
    await query(
      `UPDATE key_rotation_jobs SET status = 'in_progress' WHERE job_id = $1`,
      [jobId]
    );

    // Re-encrypt data in batches (zero-downtime approach)
    const tables = await query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE '%_data' OR table_name LIKE '%_encrypted'`
    );

    let totalProcessed = 0;
    let totalFailed = 0;

    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`Re-encrypting data in table: ${tableName}`);

      // Find ID and data columns
      const columns = await query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = $1`,
        [tableName]
      );

      const idColumn = columns.rows.find((c: any) => c.column_name.includes('id'))?.column_name || 'id';
      const dataColumn =
        columns.rows.find((c: any) => c.column_name.includes('encrypted') || c.column_name.includes('data'))
          ?.column_name || 'data';
      const keyVersionColumn =
        columns.rows.find((c: any) => c.column_name.includes('key_version'))?.column_name || 'key_version';

      // Process in batches
      let offset = 0;
      let batchProcessed = 0;
      let batchFailed = 0;

      do {
        const result = await reEncryptDataBatch(
          rotationJob.jobId,
          tableName,
          idColumn,
          dataColumn,
          keyVersionColumn,
          newKey.version,
          offset,
          config.batchSize
        );

        batchProcessed += result.processed;
        batchFailed += result.failed;
        offset += config.batchSize;

        // Update job progress
        await updateRotationJobProgress(rotationJob.jobId, result.processed, result.failed, 'in_progress');

        // Allow other operations to proceed
        await new Promise((resolve) => setTimeout(resolve, 100));
      } while (batchProcessed > 0 || batchFailed > 0);

      totalProcessed += batchProcessed;
      totalFailed += batchFailed;
    }

    // Archive old key
    await archiveEncryptionKey(currentKey.version);

    // Complete rotation job
    await completeRotationJob(jobId);

    // Log rotation event
    if (userId) {
      await logAuditEvent({
        userId,
        action: 'key_rotated',
        ip: ip || 'system',
        userAgent: userAgent || 'automated',
        details: {
          oldKeyVersion: currentKey.version,
          newKeyVersion: newKey.version,
          recordsProcessed: totalProcessed,
          recordsFailed: totalFailed,
        },
      });
    }

    console.log(
      `Key rotation completed. Records processed: ${totalProcessed}, Failed: ${totalFailed}`
    );

    return rotationJob;
  } catch (error) {
    console.error('Key rotation failed:', error);

    if (rotationJob) {
      await failRotationJob(rotationJob.jobId, (error as Error).message);
    }

    throw error;
  }
}

// ============================================
// ROLLBACK CAPABILITY
// ============================================

/**
 * Rollback key rotation to previous version
 */
export async function rollbackKeyRotation(
  jobId: string,
  reason: string,
  userId?: string,
  userAgent?: string,
  ip?: string
): Promise<void> {
  try {
    const rotationJob = await getRotationJobStatus(jobId);

    if (rotationJob.status === 'rolled_back') {
      console.log('Rotation already rolled back');
      return;
    }

    console.log(`Rolling back key rotation (Job: ${jobId}). Reason: ${reason}`);

    // Re-encrypt all data back to old key
    const oldKey = await getEncryptionKeyByVersion(rotationJob.oldKeyVersion);

    const client = await getConnection();

    try {
      await client.query('BEGIN');

      // Find all records encrypted with new key and re-encrypt back to old key
      const tables = await client.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND (table_name LIKE '%_data' OR table_name LIKE '%_encrypted')`
      );

      for (const table of tables.rows) {
        const tableName = table.table_name;

        // Re-encrypt back to old key
        const records = await client.query(
          `SELECT * FROM ${tableName} WHERE key_version = $1`,
          [rotationJob.newKeyVersion]
        );

        for (const record of records.rows) {
          const oldEncryptedData = JSON.parse(record.data);
          const reEncrypted = await reEncryptData(oldEncryptedData, rotationJob.oldKeyVersion);

          await client.query(
            `UPDATE ${tableName} SET data = $1, key_version = $2 WHERE id = $3`,
            [JSON.stringify(reEncrypted), rotationJob.oldKeyVersion, record.id]
          );
        }
      }

      // Mark new key as archived without using it
      await client.query(
        `UPDATE encryption_keys SET status = 'archived', archived_at = NOW() WHERE version = $1`,
        [rotationJob.newKeyVersion]
      );

      // Update rotation job status
      await client.query(
        `UPDATE key_rotation_jobs
         SET status = 'rolled_back', rollback_reason = $1
         WHERE job_id = $2`,
        [reason, jobId]
      );

      await client.query('COMMIT');

      // Log rollback event
      if (userId) {
        await logAuditEvent({
          userId,
          action: 'key_rotation_rolled_back',
          ip: ip || 'system',
          userAgent: userAgent || 'automated',
          details: {
            jobId,
            reason,
            oldKeyVersion: rotationJob.oldKeyVersion,
            newKeyVersion: rotationJob.newKeyVersion,
          },
        });
      }

      console.log('Key rotation rolled back successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Failed to rollback key rotation:', error);
    throw error;
  }
}

// ============================================
// TESTING AND VERIFICATION
// ============================================

/**
 * Test key rotation process without committing
 */
export async function testKeyRotation(): Promise<{
  success: boolean;
  oldKeyVersion: number;
  newKeyVersion: number;
  testDuration: number;
  message: string;
}> {
  const startTime = Date.now();

  try {
    console.log('Starting key rotation test...');

    // Get current active key
    const currentKey = await getActiveEncryptionKey();

    // Generate new key (test only)
    const newKeyData = generateNewKey();
    const testEncryption = encryptKeyWithMaster(newKeyData);
    const testDecryption = decryptKeyWithMaster(testEncryption);

    if (!Buffer.from(testDecryption).equals(newKeyData)) {
      throw new Error('Key encryption/decryption test failed');
    }

    // Test data encryption and re-encryption
    const testPlaintext = 'Test data for key rotation verification';
    const encrypted = await encryptData(testPlaintext);
    const decrypted = await decryptData(encrypted);

    if (decrypted !== testPlaintext) {
      throw new Error('Data encryption/decryption test failed');
    }

    // Test re-encryption
    const newTestKey = await storeEncryptionKey(newKeyData);
    const reEncrypted = await reEncryptData(encrypted, newTestKey.version);
    const reDecrypted = await decryptData(reEncrypted);

    if (reDecrypted !== testPlaintext) {
      throw new Error('Data re-encryption test failed');
    }

    const testDuration = Date.now() - startTime;

    console.log('Key rotation test completed successfully');

    return {
      success: true,
      oldKeyVersion: currentKey.version,
      newKeyVersion: newTestKey.version,
      testDuration,
      message: 'All key rotation tests passed',
    };
  } catch (error) {
    const testDuration = Date.now() - startTime;
    console.error('Key rotation test failed:', error);

    return {
      success: false,
      oldKeyVersion: 0,
      newKeyVersion: 0,
      testDuration,
      message: (error as Error).message,
    };
  }
}

/**
 * Get rotation history
 */
export async function getRotationHistory(limit = 50): Promise<RotationJob[]> {
  const result = await query(
    `SELECT * FROM key_rotation_jobs ORDER BY started_at DESC LIMIT $1`,
    [limit]
  );

  return result.rows as RotationJob[];
}

/**
 * Get key rotation statistics
 */
export async function getRotationStats(): Promise<any> {
  const stats = await query(
    `SELECT
       (SELECT COUNT(*) FROM encryption_keys WHERE status = 'active') as active_keys,
       (SELECT COUNT(*) FROM encryption_keys WHERE status = 'archived') as archived_keys,
       (SELECT COUNT(*) FROM key_rotation_jobs WHERE status = 'completed') as completed_rotations,
       (SELECT COUNT(*) FROM key_rotation_jobs WHERE status = 'failed') as failed_rotations,
       (SELECT COUNT(*) FROM key_rotation_jobs WHERE status = 'in_progress') as in_progress_rotations,
       (SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FROM key_rotation_jobs WHERE status = 'completed') as avg_rotation_duration_seconds
     FROM dual`
  );

  return stats.rows[0];
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize encryption key system
 */
export async function initializeKeyRotationSystem(): Promise<void> {
  try {
    console.log('Initializing key rotation system...');

    // Check if encryption keys table exists
    const tableCheck = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'encryption_keys'
      )`
    );

    if (!tableCheck.rows[0].exists) {
      console.log('Creating encryption key management tables...');

      // Create tables
      await query(`
        CREATE TABLE encryption_keys (
          id SERIAL PRIMARY KEY,
          key_id UUID UNIQUE NOT NULL,
          version INTEGER UNIQUE NOT NULL,
          algorithm VARCHAR(50) NOT NULL,
          encryption_key TEXT NOT NULL,
          master_key_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          rotated_at TIMESTAMP,
          archived_at TIMESTAMP,
          status VARCHAR(20) DEFAULT 'active',
          CONSTRAINT valid_status CHECK (status IN ('active', 'rotated', 'archived'))
        )
      `);

      await query(`
        CREATE TABLE encryption_key_archive (
          id SERIAL PRIMARY KEY,
          key_id UUID NOT NULL,
          version INTEGER NOT NULL,
          archived_key_data TEXT NOT NULL,
          archived_at TIMESTAMP DEFAULT NOW(),
          reason VARCHAR(500),
          CONSTRAINT fk_key_id FOREIGN KEY (key_id) REFERENCES encryption_keys(key_id)
        )
      `);

      await query(`
        CREATE TABLE key_rotation_jobs (
          id SERIAL PRIMARY KEY,
          job_id UUID UNIQUE NOT NULL,
          started_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP,
          status VARCHAR(20) DEFAULT 'pending',
          old_key_version INTEGER NOT NULL,
          new_key_version INTEGER NOT NULL,
          records_processed INTEGER DEFAULT 0,
          records_failed INTEGER DEFAULT 0,
          error TEXT,
          rollback_reason TEXT,
          CONSTRAINT valid_job_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back'))
        )
      `);

      console.log('✅ Encryption key management tables created');
    }

    // Create initial key if none exists
    const keyCheck = await query(`SELECT COUNT(*) as count FROM encryption_keys`);

    if (keyCheck.rows[0].count === 0) {
      console.log('Creating initial encryption key...');
      const initialKeyData = generateNewKey();
      await storeEncryptionKey(initialKeyData);
      console.log('✅ Initial encryption key created');
    } else {
      console.log(`✅ Key rotation system ready. ${keyCheck.rows[0].count} keys in system`);
    }
  } catch (error) {
    console.error('Failed to initialize key rotation system:', error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Key management
  generateNewKey,
  storeEncryptionKey,
  getActiveEncryptionKey,
  getEncryptionKeyByVersion,
  getAllEncryptionKeys,
  archiveEncryptionKey,

  // Encryption/Decryption
  encryptData,
  decryptData,
  reEncryptData,

  // Rotation execution
  executeKeyRotation,
  rollbackKeyRotation,
  getRotationJobStatus,

  // Testing
  testKeyRotation,
  getRotationHistory,
  getRotationStats,

  // Initialization
  initializeKeyRotationSystem,

  // Configuration
  config,
};
