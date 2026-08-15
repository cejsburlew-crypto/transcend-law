// Signup Integration with Data Residency
// Step-by-step guide for integrating data residency into signup flow

import { setUserResidency, initializeRegionalEncryption, getRegionConfig } from '../services/dataResidencyService';
import { generateAccessToken, hashPassword } from '../services/authService';
import { query } from '../database/connection';
import { sendEmail } from '../services/emailService';

/**
 * Complete signup flow with data residency selection
 *
 * Steps:
 * 1. Collect user information
 * 2. Show region selection
 * 3. User selects region based on location
 * 4. Create user account
 * 5. Set data residency
 * 6. Initialize encryption keys
 * 7. Send compliance information email
 * 8. Return auth tokens
 */

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  country: string;
  region: 'us-east-1' | 'eu-west-1' | 'uk-west-2' | 'ca-central-1';
  userType: 'client' | 'attorney' | 'firm';
}

export interface SignupResponse {
  success: boolean;
  userId: string;
  accessToken: string;
  refreshToken: string;
  residency: {
    region: string;
    complianceFramework: string;
    dataRetentionDays: number;
  };
  complianceInfo: {
    requirements: string[];
    certifications: string[];
    auditFrequency: string;
  };
}

/**
 * Complete signup process with residency
 */
export async function signupWithResidency(
  signupData: SignupRequest,
  ipAddress: string,
  userAgent: string
): Promise<SignupResponse> {
  try {
    // ========================================
    // Step 1: Validate inputs
    // ========================================

    if (!signupData.email || !signupData.password || !signupData.region) {
      throw new Error('Missing required fields');
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [signupData.email]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User already exists');
    }

    // ========================================
    // Step 2: Create user account
    // ========================================

    const hashedPassword = await hashPassword(signupData.password);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const userCreation = await query(
      `INSERT INTO users
       (id, email, password_hash, first_name, last_name, user_type, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
       RETURNING id, email`,
      [userId, signupData.email, hashedPassword, signupData.firstName, signupData.lastName, signupData.userType]
    );

    if (userCreation.rows.length === 0) {
      throw new Error('Failed to create user');
    }

    const createdUser = userCreation.rows[0];
    console.log(`Created user: ${createdUser.id}`);

    // ========================================
    // Step 3: Set data residency
    // ========================================

    const residency = await setUserResidency(
      createdUser.id,
      signupData.region,
      signupData.country,
      ipAddress,
      userAgent
    );

    console.log(`Set residency: ${createdUser.id} -> ${signupData.region}`);

    // ========================================
    // Step 4: Initialize encryption
    // ========================================

    const encryptionKeyId = await initializeRegionalEncryption(createdUser.id, signupData.region);

    console.log(`Initialized encryption: ${encryptionKeyId}`);

    // ========================================
    // Step 5: Generate tokens
    // ========================================

    const accessToken = generateAccessToken({
      userId: createdUser.id,
      email: createdUser.email,
      userType: signupData.userType,
    });

    // In production, store refresh token in database
    const refreshToken = `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '7 days')`,
      [createdUser.id, refreshToken]
    );

    // ========================================
    // Step 6: Get compliance information
    // ========================================

    const regionConfig = getRegionConfig(signupData.region);
    if (!regionConfig) {
      throw new Error('Invalid region configuration');
    }

    // ========================================
    // Step 7: Send compliance welcome email
    // ========================================

    await sendComplianceWelcomeEmail(
      createdUser.email,
      {
        firstName: signupData.firstName,
        region: signupData.region,
        country: signupData.country,
        compliance: residency.complianceFramework,
      }
    );

    console.log(`Sent welcome email to: ${createdUser.email}`);

    // ========================================
    // Step 8: Send compliance information email
    // ========================================

    await sendComplianceDetailsEmail(
      createdUser.email,
      {
        framework: residency.complianceFramework,
        region: signupData.region,
        requirements: regionConfig.regulations,
        certifications: regionConfig.compliance,
      }
    );

    // ========================================
    // Step 9: Log signup event
    // ========================================

    await logSignupEvent(createdUser.id, signupData, ipAddress);

    // ========================================
    // Return response
    // ========================================

    return {
      success: true,
      userId: createdUser.id,
      accessToken,
      refreshToken,
      residency: {
        region: signupData.region,
        complianceFramework: residency.complianceFramework,
        dataRetentionDays: residency.dataRetentionDays,
      },
      complianceInfo: {
        requirements: regionConfig.regulations,
        certifications: regionConfig.compliance,
        auditFrequency: getAuditFrequency(residency.complianceFramework),
      },
    };
  } catch (error) {
    console.error('Signup with residency failed:', error);
    throw error;
  }
}

/**
 * Send compliance welcome email
 */
async function sendComplianceWelcomeEmail(
  email: string,
  data: {
    firstName: string;
    region: string;
    country: string;
    compliance: string;
  }
) {
  const emailTemplate = `
    <h1>Welcome to Transcend Law, ${data.firstName}!</h1>

    <p>Your account has been created with data residency in <strong>${data.region}</strong> (${data.country}).</p>

    <h2>Your Data Protection</h2>
    <p>All your data is protected under <strong>${data.compliance}</strong> regulations and will remain in the ${data.region} region.</p>

    <h2>What This Means</h2>
    <ul>
      <li>Your personal data is encrypted at rest and in transit</li>
      <li>You have full data subject rights</li>
      <li>Regular compliance audits are conducted</li>
      <li>Data retention policies are automatically enforced</li>
    </ul>

    <h2>Next Steps</h2>
    <p><a href="https://transcend-law.com/dashboard">Go to Dashboard</a></p>

    <p>If you have questions about your data privacy, contact us at privacy@transcend-law.com</p>
  `;

  await sendEmail(email, 'compliance-welcome', { html: emailTemplate });
}

/**
 * Send detailed compliance information email
 */
async function sendComplianceDetailsEmail(
  email: string,
  data: {
    framework: string;
    region: string;
    requirements: string[];
    certifications: string[];
  }
) {
  const requirementsList = data.requirements.map((r) => `<li>${r}</li>`).join('');
  const certificationsList = data.certifications.map((c) => `<li>${c}</li>`).join('');

  const emailTemplate = `
    <h1>Your Data Protection Framework</h1>

    <h2>${data.framework}</h2>
    <p>Region: ${data.region}</p>

    <h2>Your Rights</h2>
    <ul>${requirementsList}</ul>

    <h2>Our Certifications</h2>
    <ul>${certificationsList}</ul>

    <h2>Compliance Documents</h2>
    <ul>
      <li><a href="https://transcend-law.com/privacy-policy">Privacy Policy</a></li>
      <li><a href="https://transcend-law.com/terms-of-service">Terms of Service</a></li>
      <li><a href="https://transcend-law.com/data-processing-agreement">Data Processing Agreement</a></li>
      <li><a href="https://transcend-law.com/compliance-report">Compliance Report</a></li>
    </ul>
  `;

  await sendEmail(email, 'compliance-details', { html: emailTemplate });
}

/**
 * Log signup event for audit trail
 */
async function logSignupEvent(
  userId: string,
  signupData: SignupRequest,
  ipAddress: string
) {
  await query(
    `INSERT INTO audit_logs
     (user_id, action, details, ip, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [
      userId,
      'user_signup_with_residency',
      JSON.stringify({
        email: signupData.email,
        region: signupData.region,
        country: signupData.country,
        userType: signupData.userType,
      }),
      ipAddress,
    ]
  );
}

/**
 * Get audit frequency for compliance framework
 */
function getAuditFrequency(framework: string): string {
  const auditMap: Record<string, string> = {
    'GDPR': 'Quarterly',
    'CCPA': 'Annually',
    'PIPEDA': 'Annually',
    'UK GDPR': 'Quarterly',
  };

  return auditMap[framework] || 'Annually';
}

/**
 * Frontend region selection helper
 * Returns info to display to user during signup
 */
export interface RegionSelectionInfo {
  region: string;
  name: string;
  country: string;
  compliance: string[];
  dataLocation: string;
  userRights: string[];
  privacyOfficer: string;
}

export function getRegionSelectionInfo(): RegionSelectionInfo[] {
  return [
    {
      region: 'us-east-1',
      name: 'United States (Virginia)',
      country: 'United States',
      compliance: ['CCPA', 'HIPAA', 'SOC2 Type II'],
      dataLocation: 'AWS US East 1 Data Center',
      userRights: [
        'Access your personal data',
        'Request data deletion',
        'Opt-out of data sales',
        'Non-discrimination for exercising rights',
      ],
      privacyOfficer: 'privacy-us@transcend-law.com',
    },
    {
      region: 'eu-west-1',
      name: 'European Union (Ireland)',
      country: 'Ireland',
      compliance: ['GDPR', 'ISO/IEC 27001', 'Standard Contractual Clauses'],
      dataLocation: 'AWS EU West 1 Data Center',
      userRights: [
        'Right to access your data',
        'Right to rectification',
        'Right to erasure ("right to be forgotten")',
        'Right to restrict processing',
        'Right to data portability',
        'Right to object',
        'Rights related to automated decision-making',
      ],
      privacyOfficer: 'privacy-eu@transcend-law.com',
    },
    {
      region: 'uk-west-2',
      name: 'United Kingdom (London)',
      country: 'United Kingdom',
      compliance: ['UK GDPR', 'UK Data Protection Act 2018', 'ISO/IEC 27001'],
      dataLocation: 'AWS UK West 2 Data Center',
      userRights: [
        'Right to access your data',
        'Right to rectification',
        'Right to erasure',
        'Right to restrict processing',
        'Right to data portability',
        'Right to object',
      ],
      privacyOfficer: 'privacy-uk@transcend-law.com',
    },
    {
      region: 'ca-central-1',
      name: 'Canada (Toronto)',
      country: 'Canada',
      compliance: ['PIPEDA', 'CSA STAR', 'GDPR'],
      dataLocation: 'AWS Canada Central Data Center',
      userRights: [
        'Right to access your personal information',
        'Right to request corrections',
        'Right to request deletion',
        'Right to know about information practices',
      ],
      privacyOfficer: 'privacy-ca@transcend-law.com',
    },
  ];
}

/**
 * Recommended region selection based on user location
 */
export function recommendRegionByLocation(country: string): string {
  const regionMap: Record<string, string> = {
    // EU Countries
    'Germany': 'eu-west-1',
    'France': 'eu-west-1',
    'Italy': 'eu-west-1',
    'Spain': 'eu-west-1',
    'Netherlands': 'eu-west-1',
    'Belgium': 'eu-west-1',
    'Luxembourg': 'eu-west-1',
    'Austria': 'eu-west-1',
    'Ireland': 'eu-west-1',
    'Denmark': 'eu-west-1',
    'Finland': 'eu-west-1',
    'Sweden': 'eu-west-1',
    'Poland': 'eu-west-1',
    'Czech Republic': 'eu-west-1',
    'Portugal': 'eu-west-1',
    'Greece': 'eu-west-1',

    // UK
    'United Kingdom': 'uk-west-2',
    'England': 'uk-west-2',
    'Scotland': 'uk-west-2',
    'Wales': 'uk-west-2',
    'Northern Ireland': 'uk-west-2',

    // Canada
    'Canada': 'ca-central-1',

    // USA (Default)
    'United States': 'us-east-1',
    'USA': 'us-east-1',
    'California': 'us-east-1',
    'New York': 'us-east-1',
  };

  return regionMap[country] || 'us-east-1'; // Default to US
}

export default {
  signupWithResidency,
  getRegionSelectionInfo,
  recommendRegionByLocation,
};
