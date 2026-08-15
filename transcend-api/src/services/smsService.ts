// SMS Service
// Send SMS messages via Twilio or other SMS provider

import axios from 'axios';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// ============================================
// SMS SENDING
// ============================================

export async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.warn('Twilio credentials not configured. SMS not sent.');
      // In development, log the message instead
      console.log(`SMS to ${phoneNumber}: ${message}`);
      return true;
    }

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        From: TWILIO_PHONE_NUMBER,
        To: phoneNumber,
        Body: message,
      },
      {
        auth: {
          username: TWILIO_ACCOUNT_SID,
          password: TWILIO_AUTH_TOKEN,
        },
      }
    );

    return response.status === 201;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

export async function validatePhoneNumber(phoneNumber: string): Promise<boolean> {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials not configured. Phone validation skipped.');
      // Basic validation
      return /^\+?[1-9]\d{1,14}$/.test(phoneNumber);
    }

    const response = await axios.get(
      `https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(phoneNumber)}`,
      {
        auth: {
          username: TWILIO_ACCOUNT_SID,
          password: TWILIO_AUTH_TOKEN,
        },
      }
    );

    return response.status === 200;
  } catch (error) {
    console.error('Error validating phone number:', error);
    return false;
  }
}

export async function formatPhoneNumber(phoneNumber: string): Promise<string> {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      // Basic formatting for E.164 format
      const cleaned = phoneNumber.replace(/\D/g, '');
      if (cleaned.length === 10) {
        return `+1${cleaned}`;
      } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
      }
      return `+${cleaned}`;
    }

    const response = await axios.get(
      `https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(phoneNumber)}?CountryCode=US`,
      {
        auth: {
          username: TWILIO_ACCOUNT_SID,
          password: TWILIO_AUTH_TOKEN,
        },
      }
    );

    return response.data.phone_number;
  } catch (error) {
    console.error('Error formatting phone number:', error);
    // Fallback formatting
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    return `+${cleaned}`;
  }
}
