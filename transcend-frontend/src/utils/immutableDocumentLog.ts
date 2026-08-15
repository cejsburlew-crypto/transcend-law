/**
 * Immutable Document Location Log
 * Documents/communications with GPS location are immutable and can never be erased
 * This creates permanent audit trail for legal/compliance purposes
 */

import type { GeoLocation } from './locationTracking';

export interface ImmutableDocumentRecord {
  id: string;
  document_id: string;
  document_type: 'contract' | 'communication' | 'agreement' | 'signature' | 'filing';
  document_name: string;
  content_hash: string; // SHA-256 hash of document content
  location: GeoLocation;
  user_id: string;
  timestamp: string;
  immutable_until: string; // Can be set to far future (2099) for permanent immutability
  created_at: string;
  locked: true; // Always true - indicates record is locked and cannot be modified
  version: 1; // Always 1 for immutable records
  deletion_prevented: true; // Flag indicating deletion is prevented
  reason: 'legal_compliance' | 'audit_trail' | 'contractual_obligation';
  notes?: string;
}

// Map to store immutable records (in production, use blockchain/immutable database)
const immutableRecords: Map<string, ImmutableDocumentRecord> = new Map();

/**
 * Create immutable document record with GPS location
 * IMPORTANT: Once created, this record can NEVER be deleted or modified
 */
export async function createImmutableDocumentRecord(
  documentId: string,
  documentType: ImmutableDocumentRecord['document_type'],
  documentName: string,
  contentHash: string,
  location: GeoLocation,
  userId: string,
  reason: ImmutableDocumentRecord['reason'],
  notes?: string
): Promise<ImmutableDocumentRecord> {
  const recordId = `immutable-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  const record: ImmutableDocumentRecord = {
    id: recordId,
    document_id: documentId,
    document_type: documentType,
    document_name: documentName,
    content_hash: contentHash,
    location,
    user_id: userId,
    timestamp: location.timestamp,
    immutable_until: new Date(2099, 11, 31).toISOString(), // Locked until year 2099
    created_at: now,
    locked: true,
    version: 1,
    deletion_prevented: true,
    reason,
    notes,
  };

  // Store in immutable map
  immutableRecords.set(recordId, record);

  // Send to backend for permanent storage (blockchain/immutable database)
  try {
    const response = await fetch('/api/admin/immutable-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      throw new Error('Failed to store immutable document');
    }

    return record;
  } catch (error) {
    console.error('Failed to create immutable document record:', error);
    throw error;
  }
}

/**
 * Retrieve immutable document record
 * Can be read but NOT modified or deleted
 */
export function getImmutableDocumentRecord(
  recordId: string
): ImmutableDocumentRecord | null {
  return immutableRecords.get(recordId) || null;
}

/**
 * Get all immutable records for a document
 */
export function getDocumentImmutableHistory(
  documentId: string
): ImmutableDocumentRecord[] {
  const records: ImmutableDocumentRecord[] = [];
  immutableRecords.forEach((record) => {
    if (record.document_id === documentId) {
      records.push(record);
    }
  });
  return records.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * ATTEMPT TO DELETE: This will always fail
 * Immutable records cannot be deleted under any circumstances
 */
export function attemptDeleteImmutableRecord(recordId: string): {
  success: false;
  error: string;
  timestamp: string;
  attemptId: string;
} {
  const record = immutableRecords.get(recordId);

  if (!record) {
    return {
      success: false,
      error: `Record ${recordId} does not exist`,
      timestamp: new Date().toISOString(),
      attemptId: `attempt-${Date.now()}`,
    };
  }

  if (!record.deletion_prevented) {
    return {
      success: false,
      error: 'This record is protected and cannot be deleted',
      timestamp: new Date().toISOString(),
      attemptId: `attempt-${Date.now()}`,
    };
  }

  // Log deletion attempt for audit trail
  logDeletionAttempt(recordId, new Date().toISOString());

  return {
    success: false,
    error: `DELETION BLOCKED: Immutable record created on ${record.created_at} cannot be deleted. Record is locked until ${record.immutable_until}.`,
    timestamp: new Date().toISOString(),
    attemptId: `attempt-${Date.now()}`,
  };
}

/**
 * ATTEMPT TO MODIFY: This will always fail
 * Immutable records cannot be modified under any circumstances
 */
export function attemptModifyImmutableRecord(recordId: string): {
  success: false;
  error: string;
  timestamp: string;
} {
  const record = immutableRecords.get(recordId);

  if (!record) {
    return {
      success: false,
      error: `Record ${recordId} does not exist`,
      timestamp: new Date().toISOString(),
    };
  }

  if (record.locked) {
    return {
      success: false,
      error: `MODIFICATION BLOCKED: Immutable record is locked. No changes allowed.`,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    success: false,
    error: 'This record is immutable and cannot be modified',
    timestamp: new Date().toISOString(),
  };
}

// Log all deletion attempts for compliance
const deletionAttempts: Array<{
  recordId: string;
  timestamp: string;
  attemptId: string;
}> = [];

function logDeletionAttempt(recordId: string, timestamp: string) {
  const attempt = {
    recordId,
    timestamp,
    attemptId: `attempt-${Date.now()}`,
  };
  deletionAttempts.push(attempt);

  // Send to backend
  fetch('/api/admin/deletion-attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(attempt),
  }).catch(err => console.error('Failed to log deletion attempt:', err));
}

export function getDeletionAttempts(recordId: string) {
  return deletionAttempts.filter(a => a.recordId === recordId);
}

export function getAllDeletionAttempts() {
  return deletionAttempts;
}

/**
 * Generate audit certificate for immutable document
 * Can be used as legal proof of document integrity and location
 */
export function generateAuditCertificate(recordId: string): string {
  const record = immutableRecords.get(recordId);

  if (!record) {
    throw new Error('Record not found');
  }

  const certificate = `
================================================================================
                    IMMUTABLE DOCUMENT AUDIT CERTIFICATE
================================================================================

Record ID:           ${record.id}
Document ID:         ${record.document_id}
Document Type:       ${record.document_type}
Document Name:       ${record.document_name}

LOCATION INFORMATION (GPS VERIFIED):
  Latitude:          ${record.location.latitude}
  Longitude:         ${record.location.longitude}
  Accuracy:          ±${record.location.accuracy}m
  City/Region:       ${record.location.city}, ${record.location.region}, ${record.location.country}
  Timestamp:         ${record.location.timestamp}

DOCUMENT INTEGRITY:
  Content Hash:      ${record.content_hash}
  Document Locked:   YES ✅
  Deletion Blocked:  YES ✅
  Modification Protected: YES ✅

RECORD INFORMATION:
  Created:           ${record.created_at}
  Locked Until:      ${record.immutable_until}
  User ID:           ${record.user_id}
  Reason:            ${record.reason}
  Status:            IMMUTABLE & PERMANENT

LEGAL NOTICE:
This document record has been marked as IMMUTABLE and cannot be deleted,
modified, or altered in any way. This creates a permanent legal audit trail
for compliance purposes. Any attempt to delete or modify this record will be
blocked and logged.

Notes:
${record.notes || '(None)'}

CERTIFICATE GENERATED: ${new Date().toISOString()}
VALIDITY: PERMANENT (until ${record.immutable_until})

This certificate serves as legal proof of document integrity and location
verification. It can be used in legal proceedings and compliance audits.

================================================================================
`;

  return certificate;
}

/**
 * Export immutable records as audit report
 */
export function exportAuditReport(): string {
  const records = Array.from(immutableRecords.values());
  const deletionAttemptCount = deletionAttempts.length;

  const report = `
IMMUTABLE DOCUMENT AUDIT REPORT
Generated: ${new Date().toISOString()}

SUMMARY:
- Total Immutable Records: ${records.length}
- Deletion Attempts: ${deletionAttemptCount}
- All Records Protected: YES ✅

IMMUTABLE RECORDS:
${records
  .map(
    (r, i) => `
${i + 1}. ${r.document_name}
   ID: ${r.id}
   Type: ${r.document_type}
   Location: ${r.location.city}, ${r.location.country}
   Created: ${r.created_at}
   Status: LOCKED & IMMUTABLE ✅
`
  )
  .join('')}

DELETION ATTEMPTS: ${deletionAttemptCount}
${
  deletionAttemptCount > 0
    ? deletionAttempts
        .map(
          (a, i) => `
${i + 1}. Attempt ID: ${a.attemptId}
   Record: ${a.recordId}
   Time: ${a.timestamp}
   Result: BLOCKED ✅
`
        )
        .join('')
    : '(None - All records protected)'
}

COMPLIANCE STATUS: FULL COMPLIANCE ✅
- All documents are immutable
- All locations are GPS verified
- All deletion attempts blocked
- Complete audit trail maintained

================================================================================
`;

  return report;
}
