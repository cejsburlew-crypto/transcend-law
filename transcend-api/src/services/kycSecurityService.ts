// KYC Security Service - Handles encryption, hashing, and validation
import { hash, compare } from 'bcryptjs';
import { query } from '../database/connection';

// Constants
const SALT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const SMS_RATE_LIMIT_MINUTES = 1;
const EMAIL_RATE_LIMIT_MINUTES = 1;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ERROR FIX 1.2: Email Format Validation
 * Validates email format before processing
 */
export function validateEmailFormat(email: string): boolean {
  if (!email || email.trim().length === 0) {
    return false;
  }
  return EMAIL_REGEX.test(email.toLowerCase());
}

/**
 * ERROR FIX 2.1: Hash OTP with bcrypt instead of plaintext storage
 * Hashes OTP for secure storage in database
 */
export async function hashOTP(otp: string): Promise<string> {
  return hash(otp, SALT_ROUNDS);
}

/**
 * Verify OTP by comparing with hashed version
 */
export async function verifyOTP(plainOTP: string, hashedOTP: string): Promise<boolean> {
  return compare(plainOTP, hashedOTP);
}

/**
 * ERROR FIX 3.2: ID Expiration Validation
 * Validates government ID expiration date
 */
export function validateIDExpiration(expiryDate: string): { valid: boolean; reason?: string } {
  try {
    const expiry = new Date(expiryDate);
    const now = new Date();

    if (isNaN(expiry.getTime())) {
      return { valid: false, reason: 'Invalid date format' };
    }

    if (expiry < now) {
      return { valid: false, reason: 'ID has expired' };
    }

    // Warn if expiring within 6 months
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

    if (expiry < sixMonthsFromNow) {
      return { valid: true, reason: 'ID expiring soon - will need renewal' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'Error validating expiration date' };
  }
}

/**
 * ERROR FIX 4.1: USPS Address Validation
 * Validates address format against USPS standards
 */
export async function validateUSPSAddress(address: string): Promise<{ valid: boolean; standardizedAddress?: string; reason?: string }> {
  try {
    if (!address || address.trim().length < 10) {
      return { valid: false, reason: 'Address too short (minimum 10 characters)' };
    }

    // Check for required address components (street, city, state, zip)
    const addressParts = address.split(',').map(part => part.trim());

    if (addressParts.length < 2) {
      return { valid: false, reason: 'Address must include street, city, state, and ZIP code' };
    }

    // Validate ZIP code format (5 or 5+4 digits)
    const zipMatch = address.match(/\d{5}(-\d{4})?/);
    if (!zipMatch) {
      return { valid: false, reason: 'Valid ZIP code required (format: XXXXX or XXXXX-XXXX)' };
    }

    // In production, call USPS API or similar service
    // For now, validate format
    const hasStreet = /\d+\s+[a-zA-Z]/i.test(address);
    const hasState = /[A-Z]{2}/i.test(address);

    if (!hasStreet || !hasState) {
      return { valid: false, reason: 'Address must include street number and state abbreviation' };
    }

    return {
      valid: true,
      standardizedAddress: address.toUpperCase()
    };
  } catch (error) {
    return { valid: false, reason: 'Error validating address' };
  }
}

/**
 * ERROR FIX 4.2: Document Type Validation
 * Validates document type for address verification
 */
export function validateAddressDocumentType(documentType: string): boolean {
  const validTypes = ['utility_bill', 'bank_statement', 'government_document', 'lease_agreement', 'mortgage_statement'];
  return validTypes.includes(documentType.toLowerCase());
}

/**
 * ERROR FIX 5.2 & 5.3: Plaid Integration Wrapper
 * In production, integrate with Plaid API for bank account verification
 */
export async function validatePlaidToken(publicToken: string, userId: string): Promise<{ valid: boolean; accountData?: any; reason?: string }> {
  try {
    // TODO: Implement Plaid exchange_public_token call
    // In production:
    // 1. Exchange public_token for access_token
    // 2. Get account info from Plaid
    // 3. Verify account ownership via microdeposits
    // 4. Store access_token securely in encrypted format

    // Validation placeholder
    if (!publicToken || publicToken.trim().length === 0) {
      return { valid: false, reason: 'Bank token is required' };
    }

    return {
      valid: true,
      accountData: {
        status: 'pending',
        verificationMethod: 'microdeposits',
        estimatedWaitTime: '5-7 business days'
      }
    };
  } catch (error) {
    return { valid: false, reason: 'Error validating bank account token' };
  }
}

/**
 * ERROR FIX 5.1: Microdeposit Amount Verification
 * Validates microdeposit amounts match expected values
 */
export async function verifyMicrodepositAmounts(
  userId: string,
  submittedAmounts: [number, number]
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Retrieve stored microdeposit amounts from database
    const result = await query(
      `SELECT microdeposit_amounts FROM kyc_verification
       WHERE user_id = $1 AND stage = 'bank_account' AND status = 'pending_verification'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { valid: false, reason: 'No pending bank verification found' };
    }

    const storedAmounts = result.rows[0].microdeposit_amounts as [number, number];

    if (!storedAmounts || storedAmounts.length !== 2) {
      return { valid: false, reason: 'Microdeposits not yet received' };
    }

    // Sort both arrays for comparison
    const submitted = submittedAmounts.sort((a, b) => a - b);
    const stored = storedAmounts.sort((a, b) => a - b);

    // Allow small variance due to rounding
    const tolerance = 0.01;
    const matches = submitted.every((amount, idx) =>
      Math.abs(amount - stored[idx]) < tolerance
    );

    if (!matches) {
      return { valid: false, reason: 'Amounts do not match. Please try again.' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: 'Error verifying microdeposit amounts' };
  }
}

/**
 * ERROR FIX 7: Rate Limiting Check
 * Prevents abuse by limiting requests per IP/user
 */
export async function checkRateLimit(
  userId: string,
  limitType: 'email' | 'sms',
  maxAttempts: number = 3,
  timeWindowMinutes: number = 60
): Promise<{ allowed: boolean; reason?: string; retriesRemaining?: number }> {
  try {
    const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

    const result = await query(
      `SELECT COUNT(*) as count FROM kyc_audit_log
       WHERE user_id = $1
       AND event = $2
       AND created_at > $3`,
      [userId, `initiated_${limitType}`, timeWindow]
    );

    const attempts = parseInt(result.rows[0].count);
    const retriesRemaining = Math.max(0, maxAttempts - attempts);

    if (attempts >= maxAttempts) {
      return {
        allowed: false,
        reason: `Too many ${limitType} attempts. Please try again in ${timeWindowMinutes} minutes.`,
        retriesRemaining: 0
      };
    }

    return {
      allowed: true,
      retriesRemaining
    };
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // Fail open - allow request but log error
    return { allowed: true };
  }
}

/**
 * ERROR FIX 6.2: Agent Assignment
 * Assigns available KYC verification agent to video call
 */
export async function assignAgentForVideoCall(userId: string): Promise<{ agentId?: string; reason?: string }> {
  try {
    // Find available agents (admins with least assigned calls)
    const result = await query(
      `SELECT u.id, COUNT(vcq.id) as call_count
       FROM users u
       LEFT JOIN kyc_video_call_queue vcq ON u.id = vcq.assigned_agent_id
       AND vcq.status IN ('pending', 'scheduled', 'in_progress')
       WHERE u.role = 'admin' AND u.is_active = true
       GROUP BY u.id
       ORDER BY call_count ASC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return { reason: 'No available agents at this time' };
    }

    return { agentId: result.rows[0].id };
  } catch (error) {
    console.error('Error assigning agent:', error);
    return { reason: 'Error assigning agent' };
  }
}

/**
 * ERROR FIX 6.3: Proof of Video Call
 * Records proof that video call actually occurred
 */
export async function recordVideoCallProof(
  verificationId: string,
  proof: {
    startTime: Date;
    endTime: Date;
    duration: number;
    recordingUrl?: string;
    agentId: string;
    livelinessCheckPassed: boolean;
    facialRecognitionMatch: boolean;
  }
): Promise<{ success: boolean; reason?: string }> {
  try {
    if (proof.duration < 60) {
      return { success: false, reason: 'Video call must be at least 1 minute' };
    }

    if (!proof.livelinessCheckPassed) {
      return { success: false, reason: 'Liveness check failed - user must be present' };
    }

    if (!proof.facialRecognitionMatch) {
      return { success: false, reason: 'Facial recognition did not match government ID' };
    }

    // Store proof in database
    await query(
      `UPDATE kyc_verification
       SET video_call_proof = $1
       WHERE id = $2`,
      [JSON.stringify(proof), verificationId]
    );

    return { success: true };
  } catch (error) {
    console.error('Error recording video proof:', error);
    return { success: false, reason: 'Error recording call proof' };
  }
}

/**
 * ERROR FIX 3.1: OCR and ID Extraction
 * In production, integrate with AWS Textract, Google Vision, or similar
 */
export async function extractIDData(documentUrl: string): Promise<{
  success: boolean;
  data?: {
    fullName: string;
    dateOfBirth: string;
    idNumber: string;
    issueDate: string;
    expiryDate: string;
    idType: string;
    address: string;
  };
  reason?: string;
}> {
  try {
    // Placeholder for OCR implementation
    // In production: use AWS Textract or Google Vision API
    // Returns: { fullName, dateOfBirth, idNumber, issueDate, expiryDate, etc. }

    if (!documentUrl) {
      return { success: false, reason: 'Document URL required' };
    }

    // TODO: Implement OCR service integration
    return {
      success: false,
      reason: 'OCR integration pending - use manual review for now'
    };
  } catch (error) {
    return { success: false, reason: 'Error extracting ID data' };
  }
}

export default {
  validateEmailFormat,
  hashOTP,
  verifyOTP,
  validateIDExpiration,
  validateUSPSAddress,
  validateAddressDocumentType,
  validatePlaidToken,
  verifyMicrodepositAmounts,
  checkRateLimit,
  assignAgentForVideoCall,
  recordVideoCallProof,
  extractIDData,
};
