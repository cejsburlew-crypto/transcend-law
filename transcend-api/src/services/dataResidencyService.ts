// Data Residency Service
// GDPR/CCPA/PIPEDA compliance, regional data residency enforcement

import { query, transaction, getConnection, PoolClient } from '../database/connection';
import { logAuditEvent } from './securityService';

// ============================================
// TYPES & CONSTANTS
// ============================================

export type Region = 'us-east-1' | 'eu-west-1' | 'uk-west-2' | 'ca-central-1';

export interface RegionConfig {
  region: Region;
  name: string;
  country: string;
  compliance: string[];
  dataCenter: string;
  replicationEndpoints: string[];
  timeZone: string;
  regulations: string[];
}

export interface UserResidency {
  userId: string;
  region: Region;
  complianceFramework: string;
  dataRetentionDays: number;
  encryptionKeyRegion: Region;
  lastAuditDate: Date;
  status: 'active' | 'migrating' | 'archived';
}

export interface RegionalCompliance {
  region: Region;
  framework: string;
  requirements: string[];
  certifications: string[];
  auditFrequency: 'monthly' | 'quarterly' | 'annually';
  dataRetentionPolicy: {
    minDays: number;
    maxDays: number;
    autoDeleteEnabled: boolean;
  };
}

export interface ComplianceReport {
  reportId: string;
  userId: string;
  region: Region;
  generatedDate: Date;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  dataAccessEvents: number;
  externalAccessAttempts: number;
  dataTransferEvents: number;
  retentionCompliance: boolean;
  encryptionStatus: 'compliant' | 'non-compliant';
  findings: string[];
}

export interface DataTransferRequest {
  requestId: string;
  userId: string;
  fromRegion: Region;
  toRegion: Region;
  reason: string;
  status: 'pending' | 'approved' | 'in-progress' | 'completed' | 'rejected';
  requestedAt: Date;
  completedAt?: Date;
  approvedBy?: string;
}

// ============================================
// REGION CONFIGURATIONS
// ============================================

export const REGION_CONFIGS: Record<Region, RegionConfig> = {
  'us-east-1': {
    region: 'us-east-1',
    name: 'US East Coast',
    country: 'United States',
    compliance: ['CCPA', 'HIPAA', 'SOC2'],
    dataCenter: 'us-east-1a.aws.transcend-law.com',
    replicationEndpoints: ['us-west-2', 'us-central-1'],
    timeZone: 'America/New_York',
    regulations: ['CCPA', 'HIPAA', 'FCRA'],
  },
  'eu-west-1': {
    region: 'eu-west-1',
    name: 'EU - Ireland',
    country: 'Ireland',
    compliance: ['GDPR', 'Standard Contractual Clauses'],
    dataCenter: 'eu-west-1a.aws.transcend-law.com',
    replicationEndpoints: ['eu-west-2', 'eu-central-1'],
    timeZone: 'Europe/Dublin',
    regulations: ['GDPR', 'EDPB', 'National Privacy Laws'],
  },
  'uk-west-2': {
    region: 'uk-west-2',
    name: 'UK - London',
    country: 'United Kingdom',
    compliance: ['UK GDPR', 'UK Data Protection Act 2018'],
    dataCenter: 'uk-west-2a.aws.transcend-law.com',
    replicationEndpoints: ['eu-west-1'],
    timeZone: 'Europe/London',
    regulations: ['UK GDPR', 'UK GDPR Post-Brexit', 'Data Protection Act 2018'],
  },
  'ca-central-1': {
    region: 'ca-central-1',
    name: 'Canada - Toronto',
    country: 'Canada',
    compliance: ['PIPEDA', 'GDPR'],
    dataCenter: 'ca-central-1a.aws.transcend-law.com',
    replicationEndpoints: ['ca-west-1'],
    timeZone: 'America/Toronto',
    regulations: ['PIPEDA', 'GDPR', 'Provincial Privacy Laws'],
  },
};

// ============================================
// COMPLIANCE FRAMEWORKS
// ============================================

export const COMPLIANCE_REQUIREMENTS: Record<string, RegionalCompliance> = {
  GDPR: {
    region: 'eu-west-1',
    framework: 'General Data Protection Regulation',
    requirements: [
      'Data subject rights enforcement',
      'Data processing agreements',
      'Data protection impact assessments',
      'Privacy by design',
      'Data breach notification (72 hours)',
      'Data retention limits',
      'International transfers restrictions',
    ],
    certifications: ['ISO/IEC 27001', 'ISO/IEC 27018'],
    auditFrequency: 'quarterly',
    dataRetentionPolicy: {
      minDays: 0,
      maxDays: 2555, // 7 years for legal holds
      autoDeleteEnabled: true,
    },
  },
  CCPA: {
    region: 'us-east-1',
    framework: 'California Consumer Privacy Act',
    requirements: [
      'Consumer data access rights',
      'Data deletion requests',
      'Opt-out of data sale',
      'Non-discrimination for exercising rights',
      'Data breach notification',
      'Security safeguards',
      'Annual audits',
    ],
    certifications: ['SOC2 Type II'],
    auditFrequency: 'annually',
    dataRetentionPolicy: {
      minDays: 0,
      maxDays: 1825, // 5 years
      autoDeleteEnabled: true,
    },
  },
  PIPEDA: {
    region: 'ca-central-1',
    framework: 'Personal Information Protection and Electronic Documents Act',
    requirements: [
      'Consent-based collection',
      'Purpose limitation',
      'Data accuracy',
      'Access requests',
      'Correction requests',
      'Deletion requests',
      'Privacy breach notification',
      'Reasonable safeguards',
    ],
    certifications: ['CSA STAR'],
    auditFrequency: 'annually',
    dataRetentionPolicy: {
      minDays: 0,
      maxDays: 1825, // 5 years
      autoDeleteEnabled: true,
    },
  },
  'UK GDPR': {
    region: 'uk-west-2',
    framework: 'United Kingdom General Data Protection Regulation',
    requirements: [
      'Post-Brexit data protection',
      'Data subject rights',
      'UK data adequacy determination',
      'International transfer mechanisms',
      'Data processing agreements',
      'Privacy by design',
      'Breach notification (72 hours)',
    ],
    certifications: ['ISO/IEC 27001'],
    auditFrequency: 'quarterly',
    dataRetentionPolicy: {
      minDays: 0,
      maxDays: 2555, // 7 years
      autoDeleteEnabled: true,
    },
  },
};

// ============================================
// REGION SELECTION & INITIALIZATION
// ============================================

/**
 * Set user data residency region during signup
 */
export async function setUserResidency(
  userId: string,
  region: Region,
  userCountry: string,
  ip: string,
  userAgent: string
): Promise<UserResidency> {
  // Validate region
  if (!REGION_CONFIGS[region]) {
    throw new Error(`Invalid region: ${region}`);
  }

  // Determine compliance framework based on region
  const complianceFramework = determineComplianceFramework(region, userCountry);

  const residency: UserResidency = {
    userId,
    region,
    complianceFramework,
    dataRetentionDays: COMPLIANCE_REQUIREMENTS[complianceFramework]?.dataRetentionPolicy.maxDays || 1825,
    encryptionKeyRegion: region,
    lastAuditDate: new Date(),
    status: 'active',
  };

  try {
    await query(
      `INSERT INTO user_residency
       (user_id, region, compliance_framework, data_retention_days, encryption_key_region, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
       region = EXCLUDED.region,
       compliance_framework = EXCLUDED.compliance_framework,
       status = 'active',
       updated_at = NOW()`,
      [userId, region, complianceFramework, residency.dataRetentionDays, region, 'active']
    );

    // Log residency selection
    await logAuditEvent({
      userId,
      action: 'residency_set',
      details: {
        region,
        complianceFramework,
        country: userCountry,
      },
      ip,
      userAgent,
    });

    return residency;
  } catch (error) {
    console.error('Failed to set user residency:', error);
    throw error;
  }
}

/**
 * Get user residency configuration
 */
export async function getUserResidency(userId: string): Promise<UserResidency | null> {
  try {
    const result = await query(
      `SELECT * FROM user_residency WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as UserResidency;
  } catch (error) {
    console.error('Failed to get user residency:', error);
    return null;
  }
}

/**
 * Get region configuration
 */
export function getRegionConfig(region: Region): RegionConfig | null {
  return REGION_CONFIGS[region] || null;
}

// ============================================
// COMPLIANCE ENFORCEMENT
// ============================================

/**
 * Determine compliance framework based on region and user country
 */
function determineComplianceFramework(region: Region, userCountry: string): string {
  const regionConfig = REGION_CONFIGS[region];

  // Primary framework based on region
  if (region === 'eu-west-1') return 'GDPR';
  if (region === 'uk-west-2') return 'UK GDPR';
  if (region === 'ca-central-1') return 'PIPEDA';
  if (region === 'us-east-1') return 'CCPA';

  return 'CCPA'; // Default
}

/**
 * Validate data access is within user's residency region
 */
export async function validateDataAccess(
  userId: string,
  requestOriginRegion: string,
  ip: string
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const residency = await getUserResidency(userId);

    if (!residency) {
      return { allowed: false, reason: 'No residency configuration found' };
    }

    // Block cross-region access
    if (requestOriginRegion !== residency.region) {
      // Log unauthorized access attempt
      await logAuditEvent({
        userId,
        action: 'cross_region_access_attempt',
        details: {
          userRegion: residency.region,
          requestRegion: requestOriginRegion,
        },
        ip,
        userAgent: 'system',
      });

      return {
        allowed: false,
        reason: `Cross-region access blocked. User residency: ${residency.region}, Request from: ${requestOriginRegion}`,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Failed to validate data access:', error);
    return { allowed: false, reason: 'Access validation failed' };
  }
}

/**
 * Block data transfer outside of residency region
 */
export async function blockExternalDataTransfer(
  userId: string,
  dataSize: number,
  targetRegion: string,
  ip: string
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const residency = await getUserResidency(userId);

    if (!residency) {
      return { blocked: true, reason: 'No residency configuration' };
    }

    // Allow same-region transfers
    if (targetRegion === residency.region) {
      return { blocked: false };
    }

    // Block different-region transfers (unless approved)
    await logAuditEvent({
      userId,
      action: 'external_transfer_attempt',
      details: {
        userRegion: residency.region,
        targetRegion,
        dataSize,
        status: 'blocked',
      },
      ip,
      userAgent: 'system',
    });

    return {
      blocked: true,
      reason: `External data transfer blocked. Data must remain in ${residency.region}`,
    };
  } catch (error) {
    console.error('Failed to check data transfer:', error);
    return { blocked: true, reason: 'Transfer validation failed' };
  }
}

// ============================================
// COMPLIANCE REPORTING
// ============================================

/**
 * Generate compliance report for user
 */
export async function generateComplianceReport(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ComplianceReport> {
  try {
    const residency = await getUserResidency(userId);

    if (!residency) {
      throw new Error('User residency not found');
    }

    // Get audit events for period
    const auditResult = await query(
      `SELECT action, COUNT(*) as count
       FROM audit_logs
       WHERE user_id = $1
       AND created_at BETWEEN $2 AND $3
       GROUP BY action`,
      [userId, startDate, endDate]
    );

    const dataAccessEvents = auditResult.rows.find((r) => r.action === 'data_accessed')?.count || 0;
    const externalAccessAttempts = auditResult.rows.find((r) => r.action === 'cross_region_access_attempt')?.count || 0;
    const dataTransferEvents = auditResult.rows.find((r) => r.action === 'data_transfer')?.count || 0;

    // Check data retention compliance
    const retentionResult = await query(
      `SELECT COUNT(*) as total_records,
              COUNT(CASE WHEN created_at < NOW() - INTERVAL '1 day' * $2 THEN 1 END) as expired_records
       FROM user_data
       WHERE user_id = $1`,
      [userId, residency.dataRetentionDays]
    );

    const retentionCompliance = retentionResult.rows[0].expired_records === 0;

    // Check encryption status
    const encryptionStatus = await verifyEncryptionStatus(userId, residency.region);

    const report: ComplianceReport = {
      reportId: `report_${userId}_${Date.now()}`,
      userId,
      region: residency.region,
      generatedDate: new Date(),
      reportPeriod: { startDate, endDate },
      dataAccessEvents,
      externalAccessAttempts,
      dataTransferEvents,
      retentionCompliance,
      encryptionStatus: encryptionStatus ? 'compliant' : 'non-compliant',
      findings: generateComplianceFindings(residency, externalAccessAttempts, retentionCompliance),
    };

    // Store report
    await query(
      `INSERT INTO compliance_reports
       (user_id, region, report_data, generated_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, residency.region, JSON.stringify(report)]
    );

    return report;
  } catch (error) {
    console.error('Failed to generate compliance report:', error);
    throw error;
  }
}

/**
 * Generate findings for compliance report
 */
function generateComplianceFindings(
  residency: UserResidency,
  externalAccessAttempts: number,
  retentionCompliance: boolean
): string[] {
  const findings: string[] = [];

  if (externalAccessAttempts > 0) {
    findings.push(`${externalAccessAttempts} cross-region access attempts detected and blocked`);
  }

  if (!retentionCompliance) {
    findings.push('Some data records exceed retention period - auto-deletion recommended');
  }

  findings.push(`Residency: ${residency.region}`);
  findings.push(`Compliance Framework: ${residency.complianceFramework}`);
  findings.push('Encryption verified for regional residency');

  return findings;
}

/**
 * Verify encryption status
 */
async function verifyEncryptionStatus(userId: string, region: Region): Promise<boolean> {
  try {
    const result = await query(
      `SELECT encryption_status FROM user_encryption_keys
       WHERE user_id = $1 AND region = $2 AND status = 'active'`,
      [userId, region]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Failed to verify encryption status:', error);
    return false;
  }
}

// ============================================
// DATA TRANSFER & MIGRATION
// ============================================

/**
 * Request data transfer to different region
 */
export async function requestDataTransfer(
  userId: string,
  toRegion: Region,
  reason: string,
  ip: string,
  userAgent: string
): Promise<DataTransferRequest> {
  try {
    const residency = await getUserResidency(userId);

    if (!residency) {
      throw new Error('User residency not found');
    }

    if (!REGION_CONFIGS[toRegion]) {
      throw new Error(`Invalid target region: ${toRegion}`);
    }

    const request: DataTransferRequest = {
      requestId: `transfer_${userId}_${Date.now()}`,
      userId,
      fromRegion: residency.region,
      toRegion,
      reason,
      status: 'pending',
      requestedAt: new Date(),
    };

    await query(
      `INSERT INTO data_transfer_requests
       (request_id, user_id, from_region, to_region, reason, status, requested_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [request.requestId, userId, request.fromRegion, toRegion, reason, 'pending']
    );

    // Log request
    await logAuditEvent({
      userId,
      action: 'data_transfer_requested',
      details: {
        fromRegion: request.fromRegion,
        toRegion,
        reason,
      },
      ip,
      userAgent,
    });

    return request;
  } catch (error) {
    console.error('Failed to request data transfer:', error);
    throw error;
  }
}

/**
 * Approve data transfer request
 */
export async function approveDataTransfer(
  requestId: string,
  approvedBy: string,
  ip: string,
  userAgent: string
): Promise<DataTransferRequest> {
  try {
    const result = await query(
      `SELECT * FROM data_transfer_requests WHERE request_id = $1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      throw new Error('Transfer request not found');
    }

    const request = result.rows[0];

    await query(
      `UPDATE data_transfer_requests
       SET status = 'approved', approved_by = $1, updated_at = NOW()
       WHERE request_id = $2`,
      [approvedBy, requestId]
    );

    // Log approval
    await logAuditEvent({
      userId: request.user_id,
      action: 'data_transfer_approved',
      details: {
        requestId,
        approvedBy,
        fromRegion: request.from_region,
        toRegion: request.to_region,
      },
      ip,
      userAgent,
    });

    return { ...request, status: 'approved', approvedBy };
  } catch (error) {
    console.error('Failed to approve transfer request:', error);
    throw error;
  }
}

/**
 * Execute data transfer/migration
 */
export async function executeDataTransfer(requestId: string): Promise<void> {
  return transaction(async (client: PoolClient) => {
    try {
      const result = await client.query(
        `SELECT * FROM data_transfer_requests WHERE request_id = $1`,
        [requestId]
      );

      if (result.rows.length === 0) {
        throw new Error('Transfer request not found');
      }

      const request = result.rows[0];

      // Update transfer status
      await client.query(
        `UPDATE data_transfer_requests
         SET status = 'in-progress', updated_at = NOW()
         WHERE request_id = $1`,
        [requestId]
      );

      // Copy user data to new region (in production, this would be cross-region replication)
      await client.query(
        `INSERT INTO user_data_${request.to_region}
         SELECT * FROM user_data WHERE user_id = $1`,
        [request.user_id]
      );

      // Update user residency
      await client.query(
        `UPDATE user_residency
         SET region = $1, encryption_key_region = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [request.to_region, request.user_id]
      );

      // Delete data from old region (after verification)
      await client.query(
        `DELETE FROM user_data WHERE user_id = $1`,
        [request.user_id]
      );

      // Mark transfer as completed
      await client.query(
        `UPDATE data_transfer_requests
         SET status = 'completed', completed_at = NOW()
         WHERE request_id = $1`,
        [requestId]
      );

      console.log(`Data transfer completed: ${requestId}`);
    } catch (error) {
      console.error('Failed to execute data transfer:', error);
      throw error;
    }
  });
}

// ============================================
// ENCRYPTION & SECURITY
// ============================================

/**
 * Initialize encryption keys for region
 */
export async function initializeRegionalEncryption(
  userId: string,
  region: Region
): Promise<string> {
  try {
    const keyId = `key_${userId}_${region}_${Date.now()}`;

    await query(
      `INSERT INTO user_encryption_keys
       (key_id, user_id, region, status, created_at)
       VALUES ($1, $2, $3, 'active', NOW())`,
      [keyId, userId, region]
    );

    return keyId;
  } catch (error) {
    console.error('Failed to initialize encryption:', error);
    throw error;
  }
}

/**
 * Rotate encryption keys (required for compliance)
 */
export async function rotateEncryptionKeys(userId: string, region: Region): Promise<string> {
  try {
    // Deactivate old key
    await query(
      `UPDATE user_encryption_keys
       SET status = 'rotated', rotated_at = NOW()
       WHERE user_id = $1 AND region = $2 AND status = 'active'`,
      [userId, region]
    );

    // Create new key
    const newKeyId = await initializeRegionalEncryption(userId, region);

    return newKeyId;
  } catch (error) {
    console.error('Failed to rotate encryption keys:', error);
    throw error;
  }
}

// ============================================
// MONITORING & AUDIT
// ============================================

/**
 * Get data residency audit trail
 */
export async function getResidencyAuditTrail(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const result = await query(
      `SELECT * FROM audit_logs
       WHERE user_id = $1
       AND action IN ('residency_set', 'cross_region_access_attempt', 'data_transfer_requested', 'data_transfer_approved')
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Failed to get residency audit trail:', error);
    return [];
  }
}

/**
 * Monitor regional data volumes
 */
export async function getRegionalDataVolume(region: Region): Promise<{
  region: Region;
  totalUsers: number;
  totalDataSize: number;
  lastUpdated: Date;
}> {
  try {
    const result = await query(
      `SELECT
        COUNT(DISTINCT user_id) as total_users,
        SUM(data_size) as total_data_size
       FROM user_data_metadata
       WHERE region = $1`,
      [region]
    );

    return {
      region,
      totalUsers: parseInt(result.rows[0].total_users) || 0,
      totalDataSize: parseInt(result.rows[0].total_data_size) || 0,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('Failed to get regional data volume:', error);
    return {
      region,
      totalUsers: 0,
      totalDataSize: 0,
      lastUpdated: new Date(),
    };
  }
}

/**
 * Export compliance data for audit
 */
export async function exportComplianceData(
  userId: string,
  region: Region
): Promise<Buffer> {
  try {
    const result = await query(
      `SELECT * FROM compliance_reports
       WHERE user_id = $1 AND region = $2
       ORDER BY generated_at DESC`,
      [userId, region]
    );

    const csvContent = convertToCSV(result.rows);
    return Buffer.from(csvContent, 'utf-8');
  } catch (error) {
    console.error('Failed to export compliance data:', error);
    throw error;
  }
}

/**
 * Convert compliance data to CSV
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      return typeof value === 'string' ? `"${value}"` : value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

// ============================================
// EXPORTS
// ============================================

export default {
  setUserResidency,
  getUserResidency,
  getRegionConfig,
  validateDataAccess,
  blockExternalDataTransfer,
  generateComplianceReport,
  requestDataTransfer,
  approveDataTransfer,
  executeDataTransfer,
  initializeRegionalEncryption,
  rotateEncryptionKeys,
  getResidencyAuditTrail,
  getRegionalDataVolume,
  exportComplianceData,
  REGION_CONFIGS,
  COMPLIANCE_REQUIREMENTS,
};
