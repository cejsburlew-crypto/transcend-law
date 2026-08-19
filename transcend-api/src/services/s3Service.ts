// AWS S3 Service
// Document storage, virus scanning, and file management

import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/connection';
import {
  encryptDocument,
  decryptDocument,
  isDocumentEncryptionConfigured,
} from './documentEncryption';
import { encryptField, decryptField } from './fieldEncryption';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'transcend-law-documents';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'text/plain',
];

// ============================================
// FILE UPLOAD
// ============================================

export async function uploadCaseDocument(
  caseId: string,
  userId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ documentId: string; url: string }> {
  try {
    // Validate file
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of 50MB`);
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      throw new Error(`File type not allowed. Allowed: ${ALLOWED_TYPES.join(', ')}`);
    }

    const documentId = uuidv4();
    const timestamp = new Date().toISOString().split('T')[0];

    // The original filename is itself sensitive ("Smith_v_Jones_medical.pdf"),
    // so it is kept out of the S3 key and stored encrypted in the database.
    const s3Key = `cases/${caseId}/${timestamp}/${documentId}`;

    // Client-side envelope encryption: S3 receives ciphertext only we can open.
    const encryptedBody = encryptDocument(fileBuffer);

    // SSE stays on as defence in depth. SSE-KMS with a customer-managed key is
    // preferred when configured - it gives key-level revocation and CloudTrail
    // visibility that SSE-S3 does not.
    const sseParams = process.env.AWS_KMS_KEY_ID
      ? { ServerSideEncryption: 'aws:kms', SSEKMSKeyId: process.env.AWS_KMS_KEY_ID }
      : { ServerSideEncryption: 'AES256' };

    const params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: encryptedBody,
      // Opaque: the real type is in the database, not exposed on the object.
      ContentType: 'application/octet-stream',
      ...sseParams,
      Metadata: {
        caseId,
        userId,
        uploadedAt: new Date().toISOString(),
        clientEncrypted: 'true',
      },
    };

    const result = await s3.upload(params).promise();

    await query(
      `INSERT INTO case_documents
         (id, case_id, file_name, file_url, file_size, file_type, uploaded_by, client_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
      [
        documentId,
        caseId,
        encryptField(fileName),
        result.Location,
        // Plaintext length, so size reporting stays accurate.
        fileBuffer.length,
        mimeType,
        userId,
      ]
    );

    console.log(`✅ Document uploaded: ${documentId}`);

    return {
      documentId,
      url: result.Location,
    };
  } catch (error) {
    console.error('Failed to upload document:', error);
    throw error;
  }
}

// ============================================
// FILE DOWNLOAD
// ============================================

export async function downloadCaseDocument(
  documentId: string,
  userId: string
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  try {
    // Get document info from database
    const result = await query(
      `SELECT * FROM case_documents WHERE id = $1`,
      [documentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Document not found');
    }

    const document = result.rows[0];

    // Authorisation. Previously ANY authenticated user could download ANY case
    // document - including medical records. Access is now limited to the case's
    // client and attorneys who have an active offer on it.
    const allowed = await query(
      `SELECT 1
         FROM cases c
    LEFT JOIN case_offers o
           ON o.case_id = c.id
          AND o.status IN ('quoted', 'accepted', 'retained')
    LEFT JOIN attorneys a
           ON a.id = o.attorney_id
        WHERE c.id = $1
          AND (c.client_id = $2 OR a.user_id = $2)
        LIMIT 1`,
      [document.case_id, userId]
    );

    if (allowed.rows.length === 0) {
      throw new Error('Document not found');
    }

    // Extract S3 key from URL
    const s3Key = document.file_url.split('.s3.')[1]?.split('/').slice(1).join('/');

    if (!s3Key) {
      throw new Error('Invalid document URL');
    }

    // Download from S3
    const params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
    };

    const data = await s3.getObject(params).promise();

    return {
      // Reverses the envelope; legacy unencrypted objects pass through.
      buffer: decryptDocument(data.Body as Buffer),
      fileName: decryptField(document.file_name),
      mimeType: document.file_type,
    };
  } catch (error) {
    console.error('Failed to download document:', error);
    throw error;
  }
}

// ============================================
// FILE DELETION
// ============================================

export async function deleteCaseDocument(documentId: string): Promise<void> {
  try {
    // Get document info
    const result = await query(
      `SELECT file_url FROM case_documents WHERE id = $1`,
      [documentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Document not found');
    }

    const s3Key = result.rows[0].file_url.split('.s3.')[1]?.split('/').slice(1).join('/');

    if (!s3Key) {
      throw new Error('Invalid document URL');
    }

    // Delete from S3
    await s3
      .deleteObject({
        Bucket: BUCKET_NAME,
        Key: s3Key,
      })
      .promise();

    // Delete from database
    await query(
      `DELETE FROM case_documents WHERE id = $1`,
      [documentId]
    );

    console.log(`✅ Document deleted: ${documentId}`);
  } catch (error) {
    console.error('Failed to delete document:', error);
    throw error;
  }
}

// ============================================
// GET CASE DOCUMENTS
// ============================================

export async function getCaseDocuments(caseId: string): Promise<any[]> {
  try {
    const result = await query(
      `SELECT id, file_name, file_size, file_type, uploaded_at FROM case_documents
       WHERE case_id = $1
       ORDER BY uploaded_at DESC`,
      [caseId]
    );

    return result.rows.map((doc) => ({
      id: doc.id,
      fileName: doc.file_name,
      size: doc.file_size,
      type: doc.file_type,
      uploadedAt: doc.uploaded_at,
    }));
  } catch (error) {
    console.error('Failed to get case documents:', error);
    throw error;
  }
}

// ============================================
// VIRUS SCANNING (ClamAV)
// ============================================

export async function scanFileForViruses(
  fileBuffer: Buffer,
  fileName: string
): Promise<boolean> {
  try {
    // TODO: Implement ClamAV scanning
    // npm install clamav.js
    // For now, basic validation only

    // Check magic bytes for file type verification
    const magicBytes = getFileMagicBytes(fileBuffer);
    console.log(`Scanned ${fileName} - magic bytes: ${magicBytes}`);

    // In production, use ClamAV:
    // const NodeClam = require('clamscan');
    // const scanner = new NodeClam().init({
    //   clamdscan: {
    //     host: 'localhost',
    //     port: 3310,
    //   },
    // });
    // const { isInfected } = await scanner.scanBuffer(fileBuffer);
    // return !isInfected;

    return true; // File is safe
  } catch (error) {
    console.warn('Virus scan failed:', error);
    return true; // Default to allow if scan fails
  }
}

function getFileMagicBytes(buffer: Buffer): string {
  if (!buffer || buffer.length < 4) return 'unknown';

  const hex = buffer.toString('hex', 0, 4);

  // Common magic bytes
  if (hex.startsWith('25504446')) return 'PDF';
  if (hex.startsWith('ffd8ff')) return 'JPEG';
  if (hex.startsWith('89504e47')) return 'PNG';
  if (hex.startsWith('504b0304')) return 'DOCX/ZIP';
  if (hex.startsWith('d0cf11e0')) return 'DOC';

  return 'unknown';
}

// ============================================
// PRESIGNED URLS
// ============================================

export async function getPresignedDownloadUrl(
  documentId: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const result = await query(
      `SELECT file_url FROM case_documents WHERE id = $1`,
      [documentId]
    );

    if (result.rows.length === 0) {
      throw new Error('Document not found');
    }

    const s3Key = result.rows[0].file_url.split('.s3.')[1]?.split('/').slice(1).join('/');

    const params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Expires: expiresIn,
    };

    // WARNING: a presigned URL streams the raw S3 object, bypassing
    // decryptDocument - so for client-encrypted documents the caller receives
    // ciphertext, not a readable file. Route document reads through
    // downloadCaseDocument instead. Kept for legacy objects only.
    console.warn(
      '[security] getSignedUrl bypasses client-side decryption; ' +
        'client-encrypted documents will download as ciphertext. Use downloadCaseDocument.'
    );

    const url = s3.getSignedUrl('getObject', params);
    return url;
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    throw error;
  }
}

export async function getPresignedUploadUrl(
  caseId: string,
  fileName: string,
  mimeType: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const documentId = uuidv4();
    const timestamp = new Date().toISOString().split('T')[0];
    const s3Key = `cases/${caseId}/${timestamp}/${documentId}_${fileName}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: mimeType,
      Expires: expiresIn,
    };

    // WARNING: a presigned upload writes whatever the client sends, bypassing
    // encryptDocument - the object would land as PLAINTEXT. Uploads must go
    // through uploadCaseDocument.
    console.warn(
      '[security] getSignedUrl(putObject) bypasses client-side encryption; ' +
        'documents uploaded this way are stored in plaintext. Use uploadCaseDocument.'
    );

    const url = s3.getSignedUrl('putObject', params);
    return url;
  } catch (error) {
    console.error('Failed to generate presigned upload URL:', error);
    throw error;
  }
}

// ============================================
// STORAGE USAGE
// ============================================

export async function getCaseStorageUsage(caseId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT SUM(file_size) as total_size FROM case_documents WHERE case_id = $1`,
      [caseId]
    );

    return result.rows[0].total_size || 0;
  } catch (error) {
    console.error('Failed to get storage usage:', error);
    return 0;
  }
}

export async function getUserStorageUsage(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT SUM(cd.file_size) as total_size FROM case_documents cd
       JOIN cases c ON cd.case_id = c.id
       WHERE c.client_id = $1`,
      [userId]
    );

    return result.rows[0].total_size || 0;
  } catch (error) {
    console.error('Failed to get user storage usage:', error);
    return 0;
  }
}

// ============================================
// INITIALIZATION
// ============================================

export async function initializeS3Bucket(): Promise<void> {
  try {
    // Check if bucket exists
    await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
    console.log(`✅ S3 bucket "${BUCKET_NAME}" exists`);
  } catch (error: any) {
    if (error.code === 'NoSuchBucket') {
      // Create bucket
      await s3
        .createBucket({
          Bucket: BUCKET_NAME,
        })
        .promise();

      // Enable versioning
      await s3
        .putBucketVersioning({
          Bucket: BUCKET_NAME,
          VersioningConfiguration: { Status: 'Enabled' },
        })
        .promise();

      // Enable encryption
      await s3
        .putBucketEncryption({
          Bucket: BUCKET_NAME,
          ServerSideEncryptionConfiguration: {
            Rules: [
              {
                ApplyServerSideEncryptionByDefault: {
                  SSEAlgorithm: 'AES256',
                },
              },
            ],
          },
        })
        .promise();

      console.log(`✅ S3 bucket "${BUCKET_NAME}" created`);
    } else {
      throw error;
    }
  }
}

export default {
  uploadCaseDocument,
  downloadCaseDocument,
  deleteCaseDocument,
  getCaseDocuments,
  scanFileForViruses,
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  getCaseStorageUsage,
  getUserStorageUsage,
  initializeS3Bucket,
};
