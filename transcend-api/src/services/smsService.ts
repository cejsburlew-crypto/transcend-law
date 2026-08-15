// SMS Service - Sends SMS via Twilio or similar provider
// ERROR FIX 2.3: Implements SMS integration for OTP delivery

import { Twilio } from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let twilioClient: Twilio | null = null;

// Initialize Twilio client
function getTwilioClient(): Twilio {
  if (!twilioClient && accountSid && authToken) {
    twilioClient = new Twilio(accountSid, authToken);
  }
  return twilioClient as Twilio;
}

/**
 * Send SMS message via Twilio
 * @param phoneNumber - Phone number to send to (E.164 format)
 * @param message - Message content
 */
export async function sendSMS(phoneNumber: string, message: string): Promise<{ success: boolean; sid?: string; reason?: string }> {
  try {
    if (!accountSid || !authToken || !fromPhoneNumber) {
      console.warn('Twilio credentials not configured. SMS sending disabled.');
      return {
        success: false,
        reason: 'SMS service not configured'
      };
    }

    const client = getTwilioClient();

    const result = await client.messages.create({
      to: phoneNumber,
      from: fromPhoneNumber,
      body: message,
    });

    return {
      success: true,
      sid: result.sid,
    };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Failed to send SMS'
    };
  }
}

/**
 * Verify SMS was received (for testing)
 */
export async function verifySMSDelivery(sid: string): Promise<{ success: boolean; status?: string }> {
  try {
    if (!accountSid || !authToken) {
      return { success: false };
    }

    const client = getTwilioClient();
    const message = await client.messages(sid).fetch();

    return {
      success: true,
      status: message.status
    };
  } catch (error) {
    console.error('Failed to verify SMS delivery:', error);
    return { success: false };
  }
}

export default {
  sendSMS,
  verifySMSDelivery,
};
