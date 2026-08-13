// TRANSCEND LAW - LawPay Payment Gateway Integration
// Handles inbound payments (client payments) and outbound payments (professional disbursements)

const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

const LAWPAY_API_KEY = process.env.LAWPAY_API_KEY || 'your_lawpay_api_key';
const LAWPAY_MERCHANT_ID = process.env.LAWPAY_MERCHANT_ID || 'your_merchant_id';
const LAWPAY_API_URL = 'https://api.lawpay.com/v2';
const WEBHOOK_SECRET = process.env.LAWPAY_WEBHOOK_SECRET || 'webhook_secret';

const lawpayService = {
  // ============================================================================
  // INBOUND PAYMENTS - Clients paying for case referrals
  // ============================================================================

  async createPaymentLink(paymentData) {
    const {
      caseId,
      amount,
      clientEmail,
      clientName,
      description,
      returnUrl
    } = paymentData;

    const payload = {
      merchant_id: LAWPAY_MERCHANT_ID,
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'USD',
      description: description || `TRANSCEND LAW - ${caseId}`,
      customer: {
        email: clientEmail,
        name: clientName
      },
      metadata: {
        case_id: caseId,
        platform: 'transcend_law',
        type: 'case_referral_payment'
      },
      return_url: returnUrl || 'https://transcend-law.com/payment/success',
      webhook_url: 'https://transcend-law.com/api/webhooks/lawpay'
    };

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.lawpay.com',
        path: '/v2/payment-links',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LAWPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`LawPay API Error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  },

  async getPaymentStatus(paymentId) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.lawpay.com',
        path: `/v2/payments/${paymentId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LAWPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`LawPay API Error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  },

  // ============================================================================
  // OUTBOUND PAYMENTS - Disbursing to professionals
  // ============================================================================

  async createDisbursement(disbursementData) {
    const {
      professionalId,
      professionalEmail,
      professionalName,
      amount,
      bankAccountToken,
      caseId,
      description
    } = disbursementData;

    const payload = {
      merchant_id: LAWPAY_MERCHANT_ID,
      recipient: {
        email: professionalEmail,
        name: professionalName,
        bank_account_token: bankAccountToken
      },
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'USD',
      description: description || `TRANSCEND LAW Disbursement - ${caseId}`,
      metadata: {
        professional_id: professionalId,
        case_id: caseId,
        platform: 'transcend_law',
        type: 'professional_payment'
      }
    };

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.lawpay.com',
        path: '/v2/disbursements',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LAWPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`LawPay API Error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  },

  async getDisbursementStatus(disbursementId) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.lawpay.com',
        path: `/v2/disbursements/${disbursementId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${LAWPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`LawPay API Error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.end();
    });
  },

  // ============================================================================
  // WEBHOOK VERIFICATION
  // ============================================================================

  verifyWebhookSignature(payload, signature) {
    const hash = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    return hash === signature;
  },

  // ============================================================================
  // REFUNDS
  // ============================================================================

  async refundPayment(paymentId, amount = null) {
    const payload = {
      payment_id: paymentId,
      amount: amount ? Math.round(amount * 100) : null,
      reason: 'TRANSCEND LAW refund request'
    };

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.lawpay.com',
        path: '/v2/refunds',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LAWPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`LawPay API Error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  },

  // ============================================================================
  // ACCOUNT VERIFICATION
  // ============================================================================

  async verifyBankAccount(bankAccountData) {
    const { accountNumber, routingNumber, accountHolder } = bankAccountData;

    const payload = {
      account_number: accountNumber,
      routing_number: routingNumber,
      account_holder: accountHolder,
      verification_type: 'micro_deposits' // or 'instant'
    };

    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.lawpay.com',
        path: '/v2/bank-accounts/verify',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LAWPAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`LawPay API Error: ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  }
};

module.exports = lawpayService;
