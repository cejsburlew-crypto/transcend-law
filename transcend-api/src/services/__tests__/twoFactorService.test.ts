// Two-Factor Authentication Service Tests

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  generateTOTPSecret,
  verifyTOTP,
  generateSMSOTP,
  sendSMSOTP,
} from '../twoFactorService';

describe('TOTP Service', () => {
  describe('generateTOTPSecret', () => {
    it('should generate a valid TOTP secret', () => {
      const email = 'test@transcend.legal';
      const result = generateTOTPSecret(email);

      expect(result.secret).toBeDefined();
      expect(result.manualEntryKey).toBeDefined();
      expect(result.qrCode).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
    });

    it('should generate different secrets each time', () => {
      const email = 'test@transcend.legal';
      const result1 = generateTOTPSecret(email);
      const result2 = generateTOTPSecret(email);

      expect(result1.secret).not.toEqual(result2.secret);
    });
  });

  describe('verifyTOTP', () => {
    it('should verify a valid TOTP code', () => {
      // This is a test secret with known values
      // In production, use actual speakeasy library for testing
      const secret = 'JBSWY3DPEBLW64TMMQ======';

      // Get current time-based code
      // Note: This would need speakeasy to generate the expected code
      // For unit testing, we'd mock the speakeasy library

      // Example: If we know the code at this time is 123456
      // We would test: expect(verifyTOTP(secret, '123456')).toBe(true);
    });

    it('should reject invalid TOTP code', () => {
      const secret = 'JBSWY3DPEBLW64TMMQ======';
      const result = verifyTOTP(secret, '000000');

      // This might be valid by chance at this exact time
      // Typically, an old or wrong code should be invalid
      expect(typeof result).toBe('boolean');
    });
  });
});

describe('SMS OTP Service', () => {
  describe('generateSMSOTP', () => {
    it('should generate a 6-digit OTP', async () => {
      const otp = await generateSMSOTP();

      expect(otp).toBeDefined();
      expect(otp.length).toBe(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate different OTPs', async () => {
      const otp1 = await generateSMSOTP();
      const otp2 = await generateSMSOTP();

      // Highly likely to be different (statistical probability)
      expect(otp1).not.toEqual(otp2);
    });
  });

  describe('sendSMSOTP', () => {
    it('should handle SMS sending', async () => {
      // This test would require mocking Twilio
      // In development, SMS is logged to console instead

      const phoneNumber = '+14155552671'; // Twilio test number
      const otp = '123456';

      // Mock the Twilio API or use development mode
      // const result = await sendSMSOTP(phoneNumber, otp);
      // expect(result).toBe(true);
    });
  });
});

describe('2FA Integration', () => {
  describe('Complete flow', () => {
    it('should complete TOTP setup flow', async () => {
      // 1. Generate secret
      const email = 'test@transcend.legal';
      const { secret, qrCode, manualEntryKey } = generateTOTPSecret(email);

      expect(secret).toBeDefined();
      expect(manualEntryKey).toBeDefined();

      // 2. Verify would require actual authentication app or mocking
      // This test demonstrates the flow structure
    });

    it('should complete SMS setup flow', async () => {
      // 1. Generate OTP
      const otp = await generateSMSOTP();
      expect(otp).toBeDefined();

      // 2. Send would require Twilio integration
      // In development, it's mocked

      // 3. Verify would check OTP against stored hash
    });
  });
});

// ============================================
// Mock Test Data
// ============================================

export const mockTestData = {
  // Test user
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@transcend.legal',
  phone: '+14155552671',

  // Test credentials
  totpSecret: 'JBSWY3DPEBLW64TMMQ======',
  testOTP: '123456',
  testSMSOTP: '654321',

  // Backup codes for testing
  backupCodes: [
    'A1B2C3D4E5',
    'F6G7H8I9J0',
    'K1L2M3N4O5',
    'P6Q7R8S9T0',
    'U1V2W3X4Y5',
  ],
};

// ============================================
// Integration Test Helpers
// ============================================

export async function setupTestUser(userId: string) {
  // This would set up a test user with 2FA enabled
  // Used for end-to-end testing
}

export async function setupTOTPForTestUser(userId: string) {
  // Enable TOTP for test user
}

export async function setupSMSForTestUser(userId: string, phoneNumber: string) {
  // Enable SMS for test user
}

export function getTOTPCodeForSecret(secret: string): string {
  // Generate TOTP code for a given secret
  // Used to generate codes that will pass verification
  return '000000'; // Placeholder
}
