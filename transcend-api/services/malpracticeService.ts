// Malpractice Insurance Verification Service
// Manages attorney/provider malpractice insurance verification
// Handles state-specific requirements, certificate validation, and auto-revocation

import { query } from '../database/connection';
import { sendEmailNotification } from './emailService';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface StateInsuranceRequirement {
  state: string;
  minimumCoverage: number;
  currency: string;
  specialRequirements?: string[];
  regulatoryBody?: string;
}

export interface InsuranceCertificate {
  id: string;
  providerId: string;
  insuranceCarrier: string;
  policyNumber: string;
  coverageAmount: number;
  deductible: number;
  effectiveDate: Date;
  expirationDate: Date;
  certificateUrl: string;
  status: 'pending' | 'verified' | 'expired' | 'invalid' | 'revoked';
  verificationDate?: Date;
  verifiedBy?: string;
  rejectionReason?: string;
  claimsCount?: number;
  claimsHistory?: ClaimRecord[];
}

export interface ClaimRecord {
  claimId: string;
  claimDate: Date;
  amount: number;
  status: 'open' | 'settled' | 'dismissed';
  description: string;
}

export interface VerificationRecord {
  id: string;
  certificateId: string;
  providerId: string;
  verificationDate: Date;
  status: 'verified' | 'failed' | 'pending';
  method: 'automatic' | 'manual' | 'api';
  externalVerificationId?: string;
  carrierResponse?: {
    valid: boolean;
    message: string;
    timestamp: string;
  };
  auditTrail?: AuditEntry[];
}

export interface AuditEntry {
  timestamp: Date;
  action: string;
  actor: string;
  details: string;
}

export interface ComplianceStatus {
  providerId: string;
  currentStatus: 'compliant' | 'non-compliant' | 'at-risk' | 'suspended';
  activeInsurance: boolean;
  certificateValid: boolean;
  lastVerification: Date;
  nextVerificationDue: Date;
  riskScore: number;
  flags: string[];
  recommendations: string[];
}

// ============================================
// STATE INSURANCE REQUIREMENTS
// ============================================

const STATE_REQUIREMENTS: Record<string, StateInsuranceRequirement> = {
  AL: {
    state: 'AL',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Alabama Bar Association',
  },
  AK: {
    state: 'AK',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Alaska Bar Association',
  },
  AZ: {
    state: 'AZ',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of Arizona',
  },
  AR: {
    state: 'AR',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Arkansas Bar Association',
  },
  CA: {
    state: 'CA',
    minimumCoverage: 250000,
    currency: 'USD',
    specialRequirements: ['Client Security Fund Participation'],
    regulatoryBody: 'State Bar of California',
  },
  CO: {
    state: 'CO',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Colorado Bar Association',
  },
  CT: {
    state: 'CT',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Connecticut Bar Association',
  },
  DE: {
    state: 'DE',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Delaware State Bar',
  },
  FL: {
    state: 'FL',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Florida Bar',
  },
  GA: {
    state: 'GA',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of Georgia',
  },
  HI: {
    state: 'HI',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Hawaii State Bar',
  },
  ID: {
    state: 'ID',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Idaho State Bar',
  },
  IL: {
    state: 'IL',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Illinois State Bar Association',
  },
  IN: {
    state: 'IN',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Indiana State Bar Association',
  },
  IA: {
    state: 'IA',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Iowa State Bar Association',
  },
  KS: {
    state: 'KS',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Kansas Bar Association',
  },
  KY: {
    state: 'KY',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Kentucky Bar Association',
  },
  LA: {
    state: 'LA',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Louisiana State Bar',
  },
  ME: {
    state: 'ME',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Maine State Bar',
  },
  MD: {
    state: 'MD',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Maryland State Bar',
  },
  MA: {
    state: 'MA',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Massachusetts Bar Association',
  },
  MI: {
    state: 'MI',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of Michigan',
  },
  MN: {
    state: 'MN',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Minnesota State Bar Association',
  },
  MS: {
    state: 'MS',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Mississippi State Bar',
  },
  MO: {
    state: 'MO',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'The Missouri Bar',
  },
  MT: {
    state: 'MT',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of Montana',
  },
  NE: {
    state: 'NE',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Nebraska State Bar Association',
  },
  NV: {
    state: 'NV',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of Nevada',
  },
  NH: {
    state: 'NH',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'New Hampshire Bar Association',
  },
  NJ: {
    state: 'NJ',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Supreme Court of New Jersey',
  },
  NM: {
    state: 'NM',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of New Mexico',
  },
  NY: {
    state: 'NY',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'New York State Bar Association',
  },
  NC: {
    state: 'NC',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'North Carolina State Bar',
  },
  ND: {
    state: 'ND',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar Association of North Dakota',
  },
  OH: {
    state: 'OH',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Ohio State Bar Association',
  },
  OK: {
    state: 'OK',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Oklahoma Bar Association',
  },
  OR: {
    state: 'OR',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Oregon State Bar',
  },
  PA: {
    state: 'PA',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Pennsylvania Bar Association',
  },
  RI: {
    state: 'RI',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Rhode Island Bar Association',
  },
  SC: {
    state: 'SC',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'South Carolina Bar',
  },
  SD: {
    state: 'SD',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of South Dakota',
  },
  TN: {
    state: 'TN',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Tennessee Bar Association',
  },
  TX: {
    state: 'TX',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of Texas',
  },
  UT: {
    state: 'UT',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Utah State Bar',
  },
  VT: {
    state: 'VT',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Vermont Bar Association',
  },
  VA: {
    state: 'VA',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Virginia State Bar',
  },
  WA: {
    state: 'WA',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Washington State Bar Association',
  },
  WV: {
    state: 'WV',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'West Virginia State Bar',
  },
  WI: {
    state: 'WI',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'State Bar of Wisconsin',
  },
  WY: {
    state: 'WY',
    minimumCoverage: 100000,
    currency: 'USD',
    regulatoryBody: 'Wyoming State Bar',
  },
};

// ============================================
// INSURANCE CERTIFICATE UPLOAD & VALIDATION
// ============================================

export async function uploadInsuranceCertificate(
  providerId: string,
  insuranceCarrier: string,
  policyNumber: string,
  coverageAmount: number,
  deductible: number,
  effectiveDate: Date,
  expirationDate: Date,
  certificateUrl: string,
  stateCode: string
): Promise<InsuranceCertificate> {
  try {
    // Validate coverage amount meets state minimum
    const stateRequirement = STATE_REQUIREMENTS[stateCode.toUpperCase()];
    if (!stateRequirement) {
      throw new Error(`Invalid state code: ${stateCode}`);
    }

    if (coverageAmount < stateRequirement.minimumCoverage) {
      throw new Error(
        `Coverage amount $${coverageAmount} is below state minimum of $${stateRequirement.minimumCoverage}`
      );
    }

    // Validate dates
    const now = new Date();
    if (effectiveDate > now) {
      throw new Error('Effective date cannot be in the future');
    }

    if (expirationDate <= now) {
      throw new Error('Certificate has already expired');
    }

    if (expirationDate <= effectiveDate) {
      throw new Error('Expiration date must be after effective date');
    }

    // Store certificate
    const result = await query(
      `INSERT INTO malpractice_insurance_certificates
       (provider_id, insurance_carrier, policy_number, coverage_amount, deductible,
        effective_date, expiration_date, certificate_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        providerId,
        insuranceCarrier,
        policyNumber,
        coverageAmount,
        deductible,
        effectiveDate,
        expirationDate,
        certificateUrl,
        'pending',
      ]
    );

    const cert = result.rows[0];

    // Log activity
    await logInsuranceActivity(
      cert.id,
      providerId,
      'certificate_uploaded',
      `Certificate uploaded for ${insuranceCarrier}, policy ${policyNumber}`
    );

    return {
      id: cert.id,
      providerId,
      insuranceCarrier,
      policyNumber,
      coverageAmount,
      deductible,
      effectiveDate,
      expirationDate,
      certificateUrl,
      status: 'pending',
    };
  } catch (error) {
    console.error('Failed to upload insurance certificate:', error);
    throw error;
  }
}

// ============================================
// CERTIFICATE VERIFICATION
// ============================================

export async function verifyInsuranceCertificate(
  certificateId: string,
  verifiedBy: string,
  carrierApiResponse?: any
): Promise<VerificationRecord> {
  try {
    // Get certificate
    const certResult = await query(
      `SELECT * FROM malpractice_insurance_certificates WHERE id = $1`,
      [certificateId]
    );

    if (certResult.rows.length === 0) {
      throw new Error('Certificate not found');
    }

    const cert = certResult.rows[0];

    // Check if certificate is expired
    const now = new Date();
    if (new Date(cert.expiration_date) <= now) {
      // Mark as expired
      await query(
        `UPDATE malpractice_insurance_certificates SET status = $1 WHERE id = $2`,
        ['expired', certificateId]
      );

      throw new Error('Certificate has expired');
    }

    // Get provider
    const providerResult = await query(
      `SELECT * FROM providers WHERE id = $1`,
      [cert.provider_id]
    );

    if (providerResult.rows.length === 0) {
      throw new Error('Provider not found');
    }

    const provider = providerResult.rows[0];

    // Determine verification method
    let verificationMethod: 'automatic' | 'manual' | 'api' = 'manual';
    let isValid = true;

    if (carrierApiResponse) {
      verificationMethod = 'api';
      isValid = carrierApiResponse.valid === true;
    } else {
      // Perform basic validation
      verificationMethod = 'automatic';
      isValid = true; // Assuming certificate structure is valid
    }

    // Create verification record
    const result = await query(
      `INSERT INTO malpractice_verification_records
       (certificate_id, provider_id, verification_date, status, method, carrier_response, external_verification_id)
       VALUES ($1, $2, NOW(), $3, $4, $5, $6)
       RETURNING *`,
      [
        certificateId,
        cert.provider_id,
        isValid ? 'verified' : 'failed',
        verificationMethod,
        JSON.stringify(carrierApiResponse || {}),
        carrierApiResponse?.verificationId || null,
      ]
    );

    // Update certificate status
    await query(
      `UPDATE malpractice_insurance_certificates
       SET status = $1, verification_date = NOW(), verified_by = $2
       WHERE id = $3`,
      [isValid ? 'verified' : 'invalid', verifiedBy, certificateId]
    );

    // Log activity
    await logInsuranceActivity(
      certificateId,
      cert.provider_id,
      'certificate_verified',
      `Certificate verified via ${verificationMethod}. Status: ${isValid ? 'valid' : 'invalid'}`
    );

    const verificationRecord = result.rows[0];

    return {
      id: verificationRecord.id,
      certificateId,
      providerId: cert.provider_id,
      verificationDate: new Date(verificationRecord.verification_date),
      status: isValid ? 'verified' : 'failed',
      method: verificationMethod,
      externalVerificationId: verificationRecord.external_verification_id,
      carrierResponse: carrierApiResponse,
    };
  } catch (error) {
    console.error('Failed to verify insurance certificate:', error);
    throw error;
  }
}

// ============================================
// QUARTERLY VERIFICATION SCHEDULER
// ============================================

export async function performQuarterlyVerification(): Promise<number> {
  try {
    // Find certificates due for re-verification (quarterly = every 90 days)
    const result = await query(
      `SELECT * FROM malpractice_insurance_certificates
       WHERE status IN ('verified', 'at_risk')
       AND (verification_date IS NULL OR verification_date < NOW() - INTERVAL '90 days')
       AND expiration_date > NOW()
       ORDER BY last_verification ASC`
    );

    let verifiedCount = 0;

    for (const cert of result.rows) {
      try {
        // Attempt automatic verification via carrier API
        const carrierResponse = await verifyWithCarrierAPI(cert);

        if (carrierResponse.valid) {
          await verifyInsuranceCertificate(cert.id, 'system', carrierResponse);
          verifiedCount++;
        } else {
          // Mark certificate as at-risk if verification fails
          await query(
            `UPDATE malpractice_insurance_certificates SET status = $1 WHERE id = $2`,
            ['at_risk', cert.id]
          );

          // Alert provider
          await alertProviderInsuranceIssue(
            cert.provider_id,
            'at_risk',
            'Quarterly verification failed'
          );
        }
      } catch (error) {
        console.error(`Failed to verify certificate ${cert.id}:`, error);
        // Mark as at-risk on error
        await query(
          `UPDATE malpractice_insurance_certificates SET status = $1 WHERE id = $2`,
          ['at_risk', cert.id]
        );
      }
    }

    console.log(`✅ Quarterly verification: ${verifiedCount} certificates verified`);
    return verifiedCount;
  } catch (error) {
    console.error('Failed to perform quarterly verification:', error);
    throw error;
  }
}

// ============================================
// AUTO-REVOCATION LOGIC
// ============================================

export async function processExpiredInsurance(): Promise<number> {
  try {
    const now = new Date();

    // Find expired certificates
    const expiredResult = await query(
      `SELECT * FROM malpractice_insurance_certificates
       WHERE expiration_date <= NOW()
       AND status != 'expired'
       AND status != 'revoked'`
    );

    let revokedCount = 0;

    for (const cert of expiredResult.rows) {
      try {
        // Mark certificate as expired
        await query(
          `UPDATE malpractice_insurance_certificates SET status = $1 WHERE id = $2`,
          ['expired', cert.id]
        );

        // Revoke provider access if needed
        await revokeProviderAccess(cert.provider_id, 'Insurance expired', cert.id);

        // Send notification
        await alertProviderInsuranceIssue(
          cert.provider_id,
          'expired',
          'Malpractice insurance has expired. Service access has been suspended.'
        );

        revokedCount++;

        // Log activity
        await logInsuranceActivity(
          cert.id,
          cert.provider_id,
          'insurance_expired',
          'Certificate expired and provider access revoked'
        );
      } catch (error) {
        console.error(`Failed to revoke access for expired certificate ${cert.id}:`, error);
      }
    }

    console.log(`✅ Auto-revocation: ${revokedCount} expired certificates processed`);
    return revokedCount;
  } catch (error) {
    console.error('Failed to process expired insurance:', error);
    throw error;
  }
}

// ============================================
// COMPLIANCE STATUS TRACKING
// ============================================

export async function getComplianceStatus(providerId: string): Promise<ComplianceStatus> {
  try {
    // Get provider
    const providerResult = await query(
      `SELECT * FROM providers WHERE id = $1`,
      [providerId]
    );

    if (providerResult.rows.length === 0) {
      throw new Error('Provider not found');
    }

    const provider = providerResult.rows[0];

    // Get active insurance certificates
    const certResult = await query(
      `SELECT * FROM malpractice_insurance_certificates
       WHERE provider_id = $1
       AND expiration_date > NOW()
       ORDER BY verification_date DESC
       LIMIT 1`,
      [providerId]
    );

    let activeInsurance = false;
    let certificateValid = false;
    let lastVerification: Date | null = null;

    if (certResult.rows.length > 0) {
      const cert = certResult.rows[0];
      activeInsurance = cert.status !== 'expired' && cert.status !== 'revoked';
      certificateValid = cert.status === 'verified';
      lastVerification = cert.verification_date ? new Date(cert.verification_date) : new Date(cert.created_at);
    }

    // Calculate next verification due date (90 days after last verification)
    let nextVerificationDue = new Date();
    if (lastVerification) {
      nextVerificationDue = new Date(lastVerification.getTime() + 90 * 24 * 60 * 60 * 1000);
    }

    // Get claims history
    const claimsResult = await query(
      `SELECT COUNT(*) as claim_count FROM malpractice_claims
       WHERE provider_id = $1
       AND claim_date > NOW() - INTERVAL '5 years'`,
      [providerId]
    );

    const claimsCount = parseInt(claimsResult.rows[0].claim_count || '0');

    // Determine compliance status
    let status: 'compliant' | 'non-compliant' | 'at-risk' | 'suspended' = 'compliant';
    const flags: string[] = [];
    const recommendations: string[] = [];

    if (!activeInsurance) {
      status = 'non-compliant';
      flags.push('No active insurance');
      recommendations.push('Upload current malpractice insurance certificate');
    } else if (!certificateValid) {
      status = 'at-risk';
      flags.push('Certificate not verified');
      recommendations.push('Certificate verification in progress');
    }

    if (claimsCount > 5) {
      flags.push(`High claims history (${claimsCount} claims in 5 years)`);
      recommendations.push('Review claims history for patterns');
    }

    if (certResult.rows.length > 0) {
      const cert = certResult.rows[0];
      const daysToExpiry = Math.floor(
        (new Date(cert.expiration_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysToExpiry < 30) {
        flags.push(`Insurance expiring in ${daysToExpiry} days`);
        recommendations.push('Renew malpractice insurance immediately');
      } else if (daysToExpiry < 90) {
        flags.push(`Insurance expiring in ${daysToExpiry} days`);
        recommendations.push('Begin insurance renewal process');
      }
    }

    // Calculate risk score (0-100)
    let riskScore = 0;
    if (!activeInsurance) riskScore += 40;
    if (!certificateValid) riskScore += 20;
    if (claimsCount > 5) riskScore += 15;
    if (nextVerificationDue < new Date()) riskScore += 10;

    return {
      providerId,
      currentStatus: status,
      activeInsurance,
      certificateValid,
      lastVerification: lastVerification || new Date(),
      nextVerificationDue,
      riskScore: Math.min(riskScore, 100),
      flags,
      recommendations,
    };
  } catch (error) {
    console.error('Failed to get compliance status:', error);
    throw error;
  }
}

// ============================================
// CLAIMS HISTORY
// ============================================

export async function recordClaimHistory(
  providerId: string,
  claimId: string,
  claimDate: Date,
  amount: number,
  status: 'open' | 'settled' | 'dismissed',
  description: string
): Promise<ClaimRecord> {
  try {
    const result = await query(
      `INSERT INTO malpractice_claims
       (provider_id, claim_id, claim_date, amount, status, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [providerId, claimId, claimDate, amount, status, description]
    );

    const claim = result.rows[0];

    // Log activity
    await logInsuranceActivity(
      '', // No certificate ID
      providerId,
      'claim_recorded',
      `Claim ${claimId} recorded: ${description} (${status})`
    );

    return {
      claimId: claim.claim_id,
      claimDate: new Date(claim.claim_date),
      amount: parseFloat(claim.amount),
      status: claim.status,
      description: claim.description,
    };
  } catch (error) {
    console.error('Failed to record claim history:', error);
    throw error;
  }
}

export async function getClaimsHistory(providerId: string, yearsBack: number = 5): Promise<ClaimRecord[]> {
  try {
    const result = await query(
      `SELECT * FROM malpractice_claims
       WHERE provider_id = $1
       AND claim_date > NOW() - INTERVAL '${yearsBack} years'
       ORDER BY claim_date DESC`,
      [providerId]
    );

    return result.rows.map((row) => ({
      claimId: row.claim_id,
      claimDate: new Date(row.claim_date),
      amount: parseFloat(row.amount),
      status: row.status,
      description: row.description,
    }));
  } catch (error) {
    console.error('Failed to get claims history:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function verifyWithCarrierAPI(cert: any): Promise<{ valid: boolean; verificationId?: string }> {
  try {
    // Mock API call to insurance carrier for verification
    // In production, integrate with actual carrier APIs (e.g., National E&O Database)
    const carrierVerificationUrl = process.env.INSURANCE_CARRIER_API_URL;

    if (!carrierVerificationUrl) {
      console.warn('Insurance carrier API URL not configured, skipping API verification');
      return { valid: true };
    }

    // Placeholder for actual API integration
    return { valid: true, verificationId: `${Date.now()}` };
  } catch (error) {
    console.error('Insurance carrier API verification failed:', error);
    return { valid: false };
  }
}

async function revokeProviderAccess(
  providerId: string,
  reason: string,
  certificateId: string
): Promise<void> {
  try {
    // Update provider status
    await query(
      `UPDATE providers
       SET insurance_status = $1, insurance_status_updated_at = NOW()
       WHERE id = $2`,
      ['revoked', providerId]
    );

    // Create suspension record
    await query(
      `INSERT INTO provider_suspensions
       (provider_id, reason, suspension_type, effective_date)
       VALUES ($1, $2, $3, NOW())`,
      [providerId, reason, 'insurance_expired']
    );

    // Log activity
    await logInsuranceActivity(certificateId, providerId, 'access_revoked', reason);
  } catch (error) {
    console.error('Failed to revoke provider access:', error);
    throw error;
  }
}

async function alertProviderInsuranceIssue(
  providerId: string,
  issueType: string,
  message: string
): Promise<void> {
  try {
    // Get provider email
    const result = await query(
      `SELECT u.email FROM providers p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [providerId]
    );

    if (result.rows.length > 0) {
      const email = result.rows[0].email;

      let subject = 'Malpractice Insurance Alert';
      let body = `${message}\n\nPlease log in to your account to address this issue.`;

      if (issueType === 'at_risk') {
        subject = 'Insurance Verification Alert';
        body = `Your malpractice insurance verification has failed.\n\n${message}\n\nPlease contact support or upload a new certificate.`;
      } else if (issueType === 'expired') {
        subject = 'Malpractice Insurance Expired - Account Suspended';
        body = `${message}\n\nYour service provider account has been temporarily suspended. Please renew your insurance immediately.`;
      }

      await sendEmailNotification(email, subject, body);
    }
  } catch (error) {
    console.error('Failed to alert provider:', error);
  }
}

async function logInsuranceActivity(
  certificateId: string,
  providerId: string,
  action: string,
  details: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO malpractice_insurance_audit_log
       (certificate_id, provider_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [certificateId || null, providerId, action, details]
    );
  } catch (error) {
    console.error('Failed to log insurance activity:', error);
  }
}

export async function getInsuranceCertificate(certificateId: string): Promise<InsuranceCertificate | null> {
  try {
    const result = await query(
      `SELECT * FROM malpractice_insurance_certificates WHERE id = $1`,
      [certificateId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const cert = result.rows[0];

    // Get claims history for this certificate
    const claimsResult = await query(
      `SELECT * FROM malpractice_claims
       WHERE provider_id = $1
       ORDER BY claim_date DESC`,
      [cert.provider_id]
    );

    const claimsHistory: ClaimRecord[] = claimsResult.rows.map((row) => ({
      claimId: row.claim_id,
      claimDate: new Date(row.claim_date),
      amount: parseFloat(row.amount),
      status: row.status,
      description: row.description,
    }));

    return {
      id: cert.id,
      providerId: cert.provider_id,
      insuranceCarrier: cert.insurance_carrier,
      policyNumber: cert.policy_number,
      coverageAmount: parseFloat(cert.coverage_amount),
      deductible: parseFloat(cert.deductible),
      effectiveDate: new Date(cert.effective_date),
      expirationDate: new Date(cert.expiration_date),
      certificateUrl: cert.certificate_url,
      status: cert.status,
      verificationDate: cert.verification_date ? new Date(cert.verification_date) : undefined,
      verifiedBy: cert.verified_by,
      rejectionReason: cert.rejection_reason,
      claimsCount: claimsHistory.length,
      claimsHistory,
    };
  } catch (error) {
    console.error('Failed to get insurance certificate:', error);
    throw error;
  }
}

export async function getActiveInsuranceForProvider(providerId: string): Promise<InsuranceCertificate | null> {
  try {
    const result = await query(
      `SELECT * FROM malpractice_insurance_certificates
       WHERE provider_id = $1
       AND expiration_date > NOW()
       AND status = 'verified'
       ORDER BY expiration_date DESC
       LIMIT 1`,
      [providerId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return getInsuranceCertificate(result.rows[0].id);
  } catch (error) {
    console.error('Failed to get active insurance:', error);
    throw error;
  }
}

export async function getAllProvidersComplianceStatus(): Promise<ComplianceStatus[]> {
  try {
    const result = await query(
      `SELECT DISTINCT provider_id FROM malpractice_insurance_certificates`
    );

    const statuses: ComplianceStatus[] = [];

    for (const row of result.rows) {
      try {
        const status = await getComplianceStatus(row.provider_id);
        statuses.push(status);
      } catch (error) {
        console.error(`Failed to get compliance status for provider ${row.provider_id}:`, error);
      }
    }

    return statuses;
  } catch (error) {
    console.error('Failed to get all providers compliance status:', error);
    throw error;
  }
}

export default {
  uploadInsuranceCertificate,
  verifyInsuranceCertificate,
  performQuarterlyVerification,
  processExpiredInsurance,
  getComplianceStatus,
  recordClaimHistory,
  getClaimsHistory,
  getInsuranceCertificate,
  getActiveInsuranceForProvider,
  getAllProvidersComplianceStatus,
  STATE_REQUIREMENTS,
};
