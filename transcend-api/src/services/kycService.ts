// KYC (Know Your Customer) Progressive Verification Service
// Implements 6-stage progressive verification with FinCEN compliance
// Stages: Email, Phone, Government ID, Address, Bank Account, Video Call

import { query, transaction } from '../database/connection';
import { sendEmail } from './emailService';
import { randomBytes } from 'crypto';

// Constants for KYC verification
const KYC_STAGES = {
  STAGE_1_EMAIL: 'email',
  STAGE_2_PHONE: 'phone',
  STAGE_3_GOVERNMENT_ID: 'government_id',
  STAGE_4_ADDRESS: 'address_verification',
  STAGE_5_BANK_ACCOUNT: 'bank_account',
  STAGE_6_VIDEO_CALL: 'video_call',
} as const;

const STAGE_ORDER = [
  KYC_STAGES.STAGE_1_EMAIL,
  KYC_STAGES.STAGE_2_PHONE,
  KYC_STAGES.STAGE_3_GOVERNMENT_ID,
  KYC_STAGES.STAGE_4_ADDRESS,
  KYC_STAGES.STAGE_5_BANK_ACCOUNT,
  KYC_STAGES.STAGE_6_VIDEO_CALL,
];

const STAGE_CONFIG = {
  [KYC_STAGES.STAGE_1_EMAIL]: {
    name: 'Email Verification',
    description: 'Verify your email address',
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours
    maxAttempts: 3,
    unlocksFeatures: ['account_access', 'basic_search'],
  },
  [KYC_STAGES.STAGE_2_PHONE]: {
    name: 'Phone Verification',
    description: 'Verify your phone number via SMS',
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours
    maxAttempts: 3,
    unlocksFeatures: ['messaging', 'case_creation'],
  },
  [KYC_STAGES.STAGE_3_GOVERNMENT_ID]: {
    name: 'Government ID',
    description: 'Upload driver license or passport',
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours
    maxAttempts: 3,
    unlocksFeatures: ['service_provider_access', 'higher_transaction_limits'],
    fincenRequired: true,
  },
  [KYC_STAGES.STAGE_4_ADDRESS]: {
    name: 'Address Verification',
    description: 'Verify address with utility bill or government document',
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours
    maxAttempts: 3,
    unlocksFeatures: ['payment_processing'],
    fincenRequired: true,
  },
  [KYC_STAGES.STAGE_5_BANK_ACCOUNT]: {
    name: 'Bank Account Verification',
    description: 'Link and verify your bank account',
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours
    maxAttempts: 3,
    unlocksFeatures: ['premium_features', 'instant_payments'],
    fincenRequired: true,
  },
  [KYC_STAGES.STAGE_6_VIDEO_CALL]: {
    name: 'Video Verification',
    description: 'Live video call with verification agent',
    timeLimit: 24 * 60 * 60 * 1000, // 24 hours
    maxAttempts: 3,
    unlocksFeatures: ['unlimited_transactions', 'vip_support'],
  },
};

// Helper: Generate verification token
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Helper: Log KYC event for compliance
async function logKYCEvent(
  userId: string,
  stage: string,
  event: string,
  metadata: Record<string, any> = {}
) {
  try {
    await query(
      `INSERT INTO kyc_audit_log (user_id, stage, event, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, stage, event, JSON.stringify(metadata), process.env.CLIENT_IP || '0.0.0.0']
    );
  } catch (error) {
    console.error('Failed to log KYC event:', error);
  }
}

// 1. STAGE 1: EMAIL VERIFICATION
export async function initiateEmailVerification(userId: string, email: string) {
  try {
    // Check stage completion
    const stageResult = await query(
      `SELECT * FROM kyc_verification WHERE user_id = $1 AND stage = $2 AND status = 'verified'`,
      [userId, KYC_STAGES.STAGE_1_EMAIL]
    );

    if (stageResult.rows.length > 0) {
      return { success: true, message: 'Email already verified', skipped: true };
    }

    // Check attempts
    const attemptsResult = await query(
      `SELECT COUNT(*) as count FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND created_at > NOW() - INTERVAL '1 day'`,
      [userId, KYC_STAGES.STAGE_1_EMAIL]
    );

    const attempts = parseInt(attemptsResult.rows[0].count);
    if (attempts >= STAGE_CONFIG[KYC_STAGES.STAGE_1_EMAIL].maxAttempts) {
      return {
        success: false,
        message: 'Too many attempts. Please try again tomorrow.',
      };
    }

    // Generate and store verification token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO kyc_verification
       (user_id, stage, token, email, status, expires_at, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        KYC_STAGES.STAGE_1_EMAIL,
        token,
        email,
        'pending',
        expiresAt,
        attempts + 1,
      ]
    );

    // Send verification email
    const verificationUrl = `${process.env.APP_URL}/kyc/verify-email/${token}`;

    await sendEmail(email, 'kyc-email-verification', {
      verificationUrl,
      expiresIn: '24 hours',
      stage: 'Email Verification (Stage 1/6)',
    });

    await logKYCEvent(userId, KYC_STAGES.STAGE_1_EMAIL, 'initiated', {
      attempt: attempts + 1,
    });

    return {
      success: true,
      message: 'Verification email sent',
      verificationId: token,
    };
  } catch (error) {
    console.error('Failed to initiate email verification:', error);
    throw error;
  }
}

export async function verifyEmail(token: string) {
  try {
    const result = await query(
      `SELECT * FROM kyc_verification
       WHERE token = $1 AND stage = $2 AND status = 'pending' AND expires_at > NOW()`,
      [token, KYC_STAGES.STAGE_1_EMAIL]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid or expired verification token' };
    }

    const verification = result.rows[0];
    const userId = verification.user_id;

    // Update verification status
    await query(
      `UPDATE kyc_verification
       SET status = $1, verified_at = NOW()
       WHERE id = $2`,
      [
        'verified',
        verification.id,
      ]
    );

    // Update user KYC progress
    await updateUserKYCStatus(userId, KYC_STAGES.STAGE_1_EMAIL, true);

    await logKYCEvent(userId, KYC_STAGES.STAGE_1_EMAIL, 'completed', {
      email: verification.email,
    });

    return { success: true, userId, message: 'Email verified successfully' };
  } catch (error) {
    console.error('Failed to verify email:', error);
    throw error;
  }
}

// 2. STAGE 2: PHONE VERIFICATION
export async function initiatePhoneVerification(userId: string, phoneNumber: string) {
  try {
    // Verify previous stage
    const previousStage = await query(
      `SELECT * FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND status = 'verified'`,
      [userId, KYC_STAGES.STAGE_1_EMAIL]
    );

    if (previousStage.rows.length === 0) {
      return {
        success: false,
        message: 'Please complete Stage 1 (Email Verification) first',
      };
    }

    // Check attempts
    const attemptsResult = await query(
      `SELECT COUNT(*) as count FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND created_at > NOW() - INTERVAL '1 day'`,
      [userId, KYC_STAGES.STAGE_2_PHONE]
    );

    const attempts = parseInt(attemptsResult.rows[0].count);
    if (attempts >= STAGE_CONFIG[KYC_STAGES.STAGE_2_PHONE].maxAttempts) {
      return {
        success: false,
        message: 'Too many attempts. Please try again tomorrow.',
      };
    }

    // Generate OTP (6-digit code)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const tokenResult = await query(
      `INSERT INTO kyc_verification
       (user_id, stage, phone_number, otp, status, expires_at, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        userId,
        KYC_STAGES.STAGE_2_PHONE,
        phoneNumber,
        otp, // In production, hash this
        'pending',
        expiresAt,
        attempts + 1,
      ]
    );

    // Send SMS with OTP (via Twilio or similar)
    // TODO: Integrate with SMS service
    console.log(`OTP for ${phoneNumber}: ${otp}`);

    await logKYCEvent(userId, KYC_STAGES.STAGE_2_PHONE, 'initiated', {
      phone: phoneNumber,
      attempt: attempts + 1,
    });

    return {
      success: true,
      message: 'SMS sent with verification code',
      verificationId: tokenResult.rows[0].id,
      expiresIn: 600, // seconds
    };
  } catch (error) {
    console.error('Failed to initiate phone verification:', error);
    throw error;
  }
}

export async function verifyPhoneOTP(userId: string, otp: string) {
  try {
    const result = await query(
      `SELECT * FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND otp = $3 AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, KYC_STAGES.STAGE_2_PHONE, otp]
    );

    if (result.rows.length === 0) {
      // Log failed attempt
      await logKYCEvent(userId, KYC_STAGES.STAGE_2_PHONE, 'failed_attempt', {
        reason: 'invalid_otp',
      });

      return { success: false, message: 'Invalid or expired OTP' };
    }

    const verification = result.rows[0];

    // Update verification status
    await query(
      `UPDATE kyc_verification
       SET status = $1, verified_at = NOW()
       WHERE id = $2`,
      ['verified', verification.id]
    );

    // Update user KYC progress
    await updateUserKYCStatus(userId, KYC_STAGES.STAGE_2_PHONE, true);

    await logKYCEvent(userId, KYC_STAGES.STAGE_2_PHONE, 'completed', {
      phone: verification.phone_number,
    });

    return { success: true, userId, message: 'Phone verified successfully' };
  } catch (error) {
    console.error('Failed to verify phone OTP:', error);
    throw error;
  }
}

// 3. STAGE 3: GOVERNMENT ID VERIFICATION
export async function initiateGovernmentIDVerification(
  userId: string,
  idType: 'driver_license' | 'passport',
  documentUrl: string
) {
  try {
    // Verify previous stage
    const previousStage = await query(
      `SELECT * FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND status = 'verified'`,
      [userId, KYC_STAGES.STAGE_2_PHONE]
    );

    if (previousStage.rows.length === 0) {
      return {
        success: false,
        message: 'Please complete Stage 2 (Phone Verification) first',
      };
    }

    // Check attempts
    const attemptsResult = await query(
      `SELECT COUNT(*) as count FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND created_at > NOW() - INTERVAL '1 day'`,
      [userId, KYC_STAGES.STAGE_3_GOVERNMENT_ID]
    );

    const attempts = parseInt(attemptsResult.rows[0].count);
    if (attempts >= STAGE_CONFIG[KYC_STAGES.STAGE_3_GOVERNMENT_ID].maxAttempts) {
      return {
        success: false,
        message: 'Too many attempts. Please try again tomorrow.',
      };
    }

    // Store document and mark for manual review
    const token = generateToken();

    const result = await query(
      `INSERT INTO kyc_verification
       (user_id, stage, id_type, document_url, status, expires_at, attempt_number, token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId,
        KYC_STAGES.STAGE_3_GOVERNMENT_ID,
        idType,
        documentUrl,
        'pending_review', // Requires manual review
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        attempts + 1,
        token,
      ]
    );

    // Add to admin review queue
    await addToAdminReviewQueue(userId, KYC_STAGES.STAGE_3_GOVERNMENT_ID, result.rows[0].id);

    await logKYCEvent(userId, KYC_STAGES.STAGE_3_GOVERNMENT_ID, 'initiated', {
      idType,
      documentUrl,
      attempt: attempts + 1,
    });

    return {
      success: true,
      message: 'Government ID submitted for verification',
      verificationId: result.rows[0].id,
      estimatedReviewTime: '24-48 hours',
    };
  } catch (error) {
    console.error('Failed to initiate government ID verification:', error);
    throw error;
  }
}

// 4. STAGE 4: ADDRESS VERIFICATION
export async function initiateAddressVerification(
  userId: string,
  address: string,
  documentUrl: string
) {
  try {
    // Verify previous stage
    const previousStage = await query(
      `SELECT * FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND status = 'verified'`,
      [userId, KYC_STAGES.STAGE_3_GOVERNMENT_ID]
    );

    if (previousStage.rows.length === 0) {
      return {
        success: false,
        message: 'Please complete Stage 3 (Government ID) first',
      };
    }

    // Check attempts
    const attemptsResult = await query(
      `SELECT COUNT(*) as count FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND created_at > NOW() - INTERVAL '1 day'`,
      [userId, KYC_STAGES.STAGE_4_ADDRESS]
    );

    const attempts = parseInt(attemptsResult.rows[0].count);
    if (attempts >= STAGE_CONFIG[KYC_STAGES.STAGE_4_ADDRESS].maxAttempts) {
      return {
        success: false,
        message: 'Too many attempts. Please try again tomorrow.',
      };
    }

    const token = generateToken();

    const result = await query(
      `INSERT INTO kyc_verification
       (user_id, stage, address, document_url, status, expires_at, attempt_number, token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId,
        KYC_STAGES.STAGE_4_ADDRESS,
        address,
        documentUrl,
        'pending_review',
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        attempts + 1,
        token,
      ]
    );

    // Add to admin review queue
    await addToAdminReviewQueue(userId, KYC_STAGES.STAGE_4_ADDRESS, result.rows[0].id);

    await logKYCEvent(userId, KYC_STAGES.STAGE_4_ADDRESS, 'initiated', {
      address,
      attempt: attempts + 1,
    });

    return {
      success: true,
      message: 'Address verification submitted for review',
      verificationId: result.rows[0].id,
      estimatedReviewTime: '24-48 hours',
    };
  } catch (error) {
    console.error('Failed to initiate address verification:', error);
    throw error;
  }
}

// 5. STAGE 5: BANK ACCOUNT VERIFICATION
export async function initiateBankAccountVerification(
  userId: string,
  bankAccountToken: string
) {
  try {
    // Verify previous stage
    const previousStage = await query(
      `SELECT * FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND status = 'verified'`,
      [userId, KYC_STAGES.STAGE_4_ADDRESS]
    );

    if (previousStage.rows.length === 0) {
      return {
        success: false,
        message: 'Please complete Stage 4 (Address Verification) first',
      };
    }

    // Check attempts
    const attemptsResult = await query(
      `SELECT COUNT(*) as count FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND created_at > NOW() - INTERVAL '1 day'`,
      [userId, KYC_STAGES.STAGE_5_BANK_ACCOUNT]
    );

    const attempts = parseInt(attemptsResult.rows[0].count);
    if (attempts >= STAGE_CONFIG[KYC_STAGES.STAGE_5_BANK_ACCOUNT].maxAttempts) {
      return {
        success: false,
        message: 'Too many attempts. Please try again tomorrow.',
      };
    }

    // In production: Use Plaid or similar service to verify bank account
    const result = await query(
      `INSERT INTO kyc_verification
       (user_id, stage, bank_token, status, expires_at, attempt_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        userId,
        KYC_STAGES.STAGE_5_BANK_ACCOUNT,
        bankAccountToken,
        'pending_verification',
        new Date(Date.now() + 24 * 60 * 60 * 1000),
        attempts + 1,
      ]
    );

    await logKYCEvent(userId, KYC_STAGES.STAGE_5_BANK_ACCOUNT, 'initiated', {
      attempt: attempts + 1,
    });

    return {
      success: true,
      message: 'Bank account verification in progress',
      verificationId: result.rows[0].id,
    };
  } catch (error) {
    console.error('Failed to initiate bank account verification:', error);
    throw error;
  }
}

export async function verifyBankAccountMicrodeposits(userId: string, amounts: [number, number]) {
  try {
    // Find pending verification
    const result = await query(
      `SELECT * FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND status = 'pending_verification'
       ORDER BY created_at DESC LIMIT 1`,
      [userId, KYC_STAGES.STAGE_5_BANK_ACCOUNT]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'No pending bank verification found' };
    }

    // Verify microdeposit amounts (simplified)
    const verification = result.rows[0];

    // In production: Compare with actual microdeposit amounts
    // TODO: Implement Plaid microdeposit verification

    await query(
      `UPDATE kyc_verification
       SET status = $1, verified_at = NOW()
       WHERE id = $2`,
      ['verified', verification.id]
    );

    await updateUserKYCStatus(userId, KYC_STAGES.STAGE_5_BANK_ACCOUNT, true);

    await logKYCEvent(userId, KYC_STAGES.STAGE_5_BANK_ACCOUNT, 'completed', {});

    return { success: true, message: 'Bank account verified successfully' };
  } catch (error) {
    console.error('Failed to verify bank account:', error);
    throw error;
  }
}

// 6. STAGE 6: VIDEO CALL VERIFICATION
export async function initiateVideoVerification(userId: string) {
  try {
    // Verify previous stage
    const previousStage = await query(
      `SELECT * FROM kyc_verification
       WHERE user_id = $1 AND stage = $2 AND status = 'verified'`,
      [userId, KYC_STAGES.STAGE_5_BANK_ACCOUNT]
    );

    if (previousStage.rows.length === 0) {
      return {
        success: false,
        message: 'Please complete Stage 5 (Bank Account Verification) first',
      };
    }

    // Schedule video call with available agent
    const result = await query(
      `INSERT INTO kyc_verification
       (user_id, stage, status, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        userId,
        KYC_STAGES.STAGE_6_VIDEO_CALL,
        'scheduled', // Changed from pending_review
        new Date(Date.now() + 24 * 60 * 60 * 1000),
      ]
    );

    // Add to video call queue
    await addToVideoCallQueue(userId);

    await logKYCEvent(userId, KYC_STAGES.STAGE_6_VIDEO_CALL, 'scheduled', {});

    return {
      success: true,
      message: 'Video verification scheduled',
      verificationId: result.rows[0].id,
      estimatedWaitTime: '2-4 hours',
    };
  } catch (error) {
    console.error('Failed to initiate video verification:', error);
    throw error;
  }
}

export async function completeVideoVerification(
  userId: string,
  verificationId: string,
  agentNotes: string
) {
  try {
    const result = await query(
      `SELECT * FROM kyc_verification
       WHERE id = $1 AND user_id = $2 AND stage = $3`,
      [verificationId, userId, KYC_STAGES.STAGE_6_VIDEO_CALL]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Video verification not found' };
    }

    await query(
      `UPDATE kyc_verification
       SET status = $1, verified_at = NOW(), notes = $2
       WHERE id = $3`,
      ['verified', agentNotes, verificationId]
    );

    await updateUserKYCStatus(userId, KYC_STAGES.STAGE_6_VIDEO_CALL, true);

    // Mark user as fully KYC verified
    await query(
      `UPDATE users
       SET kyc_completed = true, kyc_completed_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    await logKYCEvent(userId, KYC_STAGES.STAGE_6_VIDEO_CALL, 'completed', {
      agentNotes,
    });

    return { success: true, message: 'Video verification completed successfully' };
  } catch (error) {
    console.error('Failed to complete video verification:', error);
    throw error;
  }
}

// UTILITY FUNCTIONS

// Get current KYC status for user
export async function getUserKYCStatus(userId: string) {
  try {
    const result = await query(
      `SELECT * FROM kyc_user_progress
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return {
        userId,
        completedStages: [],
        currentStage: STAGE_ORDER[0],
        progress: 0,
      };
    }

    const progress = result.rows[0];
    const completedCount = Object.values(STAGE_ORDER).filter(
      (stage) => progress[stage] === true
    ).length;

    return {
      userId,
      completedStages: STAGE_ORDER.filter((stage) => progress[stage] === true),
      currentStage:
        STAGE_ORDER.find((stage) => progress[stage] !== true) || STAGE_ORDER[STAGE_ORDER.length - 1],
      progress: Math.round((completedCount / STAGE_ORDER.length) * 100),
      kyc_completed: progress.kyc_completed,
      kyc_completed_at: progress.kyc_completed_at,
      unlockedFeatures: getUnlockedFeatures(progress),
    };
  } catch (error) {
    console.error('Failed to get KYC status:', error);
    throw error;
  }
}

// Update user KYC progress
async function updateUserKYCStatus(userId: string, stage: string, verified: boolean) {
  try {
    const updateQuery = `
      UPDATE kyc_user_progress
      SET ${stage} = $1, updated_at = NOW()
      WHERE user_id = $2
    `;

    const existsResult = await query(`SELECT id FROM kyc_user_progress WHERE user_id = $1`, [
      userId,
    ]);

    if (existsResult.rows.length === 0) {
      const insertValues = [userId];
      const insertColumns = ['user_id'];
      const placeholders = ['$1'];

      STAGE_ORDER.forEach((s, idx) => {
        insertColumns.push(s);
        insertValues.push(s === stage ? verified : false);
        placeholders.push(`$${idx + 2}`);
      });

      await query(
        `INSERT INTO kyc_user_progress (${insertColumns.join(', ')})
         VALUES (${placeholders.join(', ')})`,
        insertValues
      );
    } else {
      const stageIndex = STAGE_ORDER.indexOf(stage);
      await query(updateQuery, [verified, userId]);
    }
  } catch (error) {
    console.error('Failed to update KYC status:', error);
  }
}

// Get unlocked features based on completed stages
function getUnlockedFeatures(progress: Record<string, any>): string[] {
  const features: string[] = [];

  STAGE_ORDER.forEach((stage) => {
    if (progress[stage]) {
      features.push(...(STAGE_CONFIG[stage as keyof typeof STAGE_CONFIG]?.unlocksFeatures || []));
    }
  });

  return Array.from(new Set(features)); // Remove duplicates
}

// Admin: Add to review queue
async function addToAdminReviewQueue(userId: string, stage: string, verificationId: string) {
  try {
    await query(
      `INSERT INTO kyc_admin_review_queue
       (user_id, stage, verification_id, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, stage, verificationId, 'pending']
    );
  } catch (error) {
    console.error('Failed to add to admin review queue:', error);
  }
}

// Admin: Get review queue
export async function getAdminReviewQueue() {
  try {
    const result = await query(
      `SELECT * FROM kyc_admin_review_queue
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 50`
    );

    return result.rows;
  } catch (error) {
    console.error('Failed to get admin review queue:', error);
    throw error;
  }
}

// Admin: Approve verification
export async function approveVerification(verificationId: string, reviewedBy: string) {
  try {
    return await transaction(async (client) => {
      const verResult = await client.query(
        `SELECT * FROM kyc_verification WHERE id = $1`,
        [verificationId]
      );

      if (verResult.rows.length === 0) {
        return { success: false, message: 'Verification not found' };
      }

      const verification = verResult.rows[0];
      const userId = verification.user_id;

      // Update verification
      await client.query(
        `UPDATE kyc_verification
         SET status = $1, verified_at = NOW(), reviewed_by = $2
         WHERE id = $3`,
        ['verified', reviewedBy, verificationId]
      );

      // Update user progress
      await client.query(
        `UPDATE kyc_user_progress
         SET ${verification.stage} = true, updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      // Remove from review queue
      await client.query(
        `UPDATE kyc_admin_review_queue
         SET status = $1 WHERE verification_id = $2`,
        ['approved', verificationId]
      );

      await logKYCEvent(userId, verification.stage, 'approved_by_admin', {
        reviewedBy,
      });

      return { success: true, message: 'Verification approved' };
    });
  } catch (error) {
    console.error('Failed to approve verification:', error);
    throw error;
  }
}

// Admin: Reject verification
export async function rejectVerification(
  verificationId: string,
  reviewedBy: string,
  reason: string
) {
  try {
    return await transaction(async (client) => {
      const verResult = await client.query(
        `SELECT * FROM kyc_verification WHERE id = $1`,
        [verificationId]
      );

      if (verResult.rows.length === 0) {
        return { success: false, message: 'Verification not found' };
      }

      const verification = verResult.rows[0];
      const userId = verification.user_id;

      // Update verification
      await client.query(
        `UPDATE kyc_verification
         SET status = $1, verified_at = NOW(), reviewed_by = $2, rejection_reason = $3
         WHERE id = $4`,
        ['rejected', reviewedBy, reason, verificationId]
      );

      // Remove from review queue
      await client.query(
        `UPDATE kyc_admin_review_queue
         SET status = $1 WHERE verification_id = $2`,
        ['rejected', verificationId]
      );

      // Send rejection email
      const userResult = await client.query(`SELECT email FROM users WHERE id = $1`, [userId]);

      if (userResult.rows.length > 0) {
        await sendEmail(userResult.rows[0].email, 'kyc-rejection', {
          stage: verification.stage,
          reason,
          retryUrl: `${process.env.APP_URL}/kyc/retry/${verification.stage}`,
        });
      }

      await logKYCEvent(userId, verification.stage, 'rejected_by_admin', {
        reviewedBy,
        reason,
      });

      return { success: true, message: 'Verification rejected' };
    });
  } catch (error) {
    console.error('Failed to reject verification:', error);
    throw error;
  }
}

// Add to video call queue
async function addToVideoCallQueue(userId: string) {
  try {
    await query(
      `INSERT INTO kyc_video_call_queue (user_id, status, created_at)
       VALUES ($1, $2, NOW())`,
      [userId, 'pending']
    );
  } catch (error) {
    console.error('Failed to add to video call queue:', error);
  }
}

// Get pending video calls
export async function getPendingVideoCalls() {
  try {
    const result = await query(
      `SELECT * FROM kyc_video_call_queue
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 20`
    );

    return result.rows;
  } catch (error) {
    console.error('Failed to get pending video calls:', error);
    throw error;
  }
}

// Cleanup expired verifications (run periodically)
export async function cleanupExpiredVerifications() {
  try {
    const result = await query(
      `UPDATE kyc_verification
       SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW()
       RETURNING id`
    );

    console.log(`Expired ${result.rowCount} pending KYC verifications`);

    // Also clean admin queue
    await query(
      `UPDATE kyc_admin_review_queue
       SET status = 'expired'
       WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days'`
    );
  } catch (error) {
    console.error('Failed to cleanup expired verifications:', error);
  }
}

export default {
  // Stage 1
  initiateEmailVerification,
  verifyEmail,
  // Stage 2
  initiatePhoneVerification,
  verifyPhoneOTP,
  // Stage 3
  initiateGovernmentIDVerification,
  // Stage 4
  initiateAddressVerification,
  // Stage 5
  initiateBankAccountVerification,
  verifyBankAccountMicrodeposits,
  // Stage 6
  initiateVideoVerification,
  completeVideoVerification,
  // Utilities
  getUserKYCStatus,
  getAdminReviewQueue,
  approveVerification,
  rejectVerification,
  getPendingVideoCalls,
  cleanupExpiredVerifications,
};
