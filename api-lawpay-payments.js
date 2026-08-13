// TRANSCEND LAW - LawPay Payment API Routes
// Handles payment initiation, status checks, and webhooks

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const lawpayService = require('./services/lawpay-service');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// ============================================================================
// INBOUND PAYMENTS - Client pays for case referral
// ============================================================================

router.post('/api/payments/create-payment-link', async (req, res) => {
  try {
    const { caseId, amount, clientEmail, clientName, description } = req.body;

    if (!caseId || !amount || !clientEmail || !clientName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create payment link with LawPay
    const paymentLink = await lawpayService.createPaymentLink({
      caseId,
      amount,
      clientEmail,
      clientName,
      description: description || `Case Referral Payment - ${caseId}`,
      returnUrl: `https://transcend-law.com/payment/success/${caseId}`
    });

    // Store in database
    const query = `
      INSERT INTO transactions (case_id, amount, commission, status, payment_id, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, payment_id, status;
    `;

    const commission = amount * 0.15; // 15% platform commission
    const result = await pool.query(query, [
      caseId,
      amount,
      commission,
      'pending',
      paymentLink.id
    ]);

    res.json({
      success: true,
      paymentLink: paymentLink.url,
      paymentId: paymentLink.id,
      amount,
      commission,
      status: 'pending'
    });
  } catch (error) {
    console.error('[PAYMENT] Error creating payment link:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/payments/:paymentId/status', async (req, res) => {
  try {
    const { paymentId } = req.params;

    // Get payment status from LawPay
    const paymentStatus = await lawpayService.getPaymentStatus(paymentId);

    // Update database
    if (paymentStatus.status === 'completed') {
      const query = `
        UPDATE transactions
        SET status = 'completed', updated_at = NOW()
        WHERE payment_id = $1
        RETURNING *;
      `;
      await pool.query(query, [paymentId]);
    }

    res.json({
      success: true,
      paymentId,
      status: paymentStatus.status,
      amount: paymentStatus.amount / 100, // Convert from cents
      timestamp: paymentStatus.timestamp
    });
  } catch (error) {
    console.error('[PAYMENT] Error fetching payment status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// OUTBOUND PAYMENTS - Pay professionals for completed work
// ============================================================================

router.post('/api/payments/disbursement', async (req, res) => {
  try {
    const { professionalId, amount, caseId, description } = req.body;
    const user = req.user;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }

    if (!professionalId || !amount || !caseId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get professional bank account info
    const proQuery = `
      SELECT email, name, bank_account_token
      FROM professionals
      WHERE id = $1;
    `;

    const proResult = await pool.query(proQuery, [professionalId]);
    if (proResult.rows.length === 0) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    const professional = proResult.rows[0];

    // Create disbursement with LawPay
    const disbursement = await lawpayService.createDisbursement({
      professionalId,
      professionalEmail: professional.email,
      professionalName: professional.name,
      amount,
      bankAccountToken: professional.bank_account_token,
      caseId,
      description
    });

    // Store in database
    const query = `
      INSERT INTO payment_schedules
        (professional_id, amount, case_id, status, disbursement_id, scheduled_date, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, disbursement_id, status;
    `;

    const result = await pool.query(query, [
      professionalId,
      amount,
      caseId,
      'pending',
      disbursement.id
    ]);

    console.log(`[PAYMENT] Disbursement created: ${disbursement.id} for professional ${professionalId}`);

    res.json({
      success: true,
      disbursementId: disbursement.id,
      professional: professional.name,
      amount,
      status: 'pending',
      message: 'Disbursement initiated successfully'
    });
  } catch (error) {
    console.error('[PAYMENT] Error creating disbursement:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/payments/disbursement/:disbursementId/status', async (req, res) => {
  try {
    const { disbursementId } = req.params;

    // Get status from LawPay
    const status = await lawpayService.getDisbursementStatus(disbursementId);

    // Update database
    if (status.status === 'completed') {
      const query = `
        UPDATE payment_schedules
        SET status = 'completed', paid_date = NOW(), updated_at = NOW()
        WHERE disbursement_id = $1
        RETURNING *;
      `;
      await pool.query(query, [disbursementId]);
    }

    res.json({
      success: true,
      disbursementId,
      status: status.status,
      amount: status.amount / 100,
      timestamp: status.timestamp
    });
  } catch (error) {
    console.error('[PAYMENT] Error fetching disbursement status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// WEBHOOK - LawPay sends payment updates
// ============================================================================

router.post('/api/webhooks/lawpay', async (req, res) => {
  try {
    const signature = req.headers['x-lawpay-signature'];

    // Verify webhook signature
    if (!lawpayService.verifyWebhookSignature(req.body, signature)) {
      console.error('[WEBHOOK] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event_type, data } = req.body;

    console.log(`[WEBHOOK] LawPay event: ${event_type}`);

    switch (event_type) {
      case 'payment.completed':
        await handlePaymentCompleted(data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      case 'disbursement.completed':
        await handleDisbursementCompleted(data);
        break;
      case 'disbursement.failed':
        await handleDisbursementFailed(data);
        break;
      default:
        console.log(`[WEBHOOK] Unknown event type: ${event_type}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[WEBHOOK] Error processing webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

async function handlePaymentCompleted(data) {
  const query = `
    UPDATE transactions
    SET status = 'completed', updated_at = NOW()
    WHERE payment_id = $1;
  `;
  await pool.query(query, [data.payment_id]);
  console.log(`[PAYMENT] Payment completed: ${data.payment_id}`);
}

async function handlePaymentFailed(data) {
  const query = `
    UPDATE transactions
    SET status = 'failed', updated_at = NOW()
    WHERE payment_id = $1;
  `;
  await pool.query(query, [data.payment_id]);
  console.error(`[PAYMENT] Payment failed: ${data.payment_id}`);
}

async function handleDisbursementCompleted(data) {
  const query = `
    UPDATE payment_schedules
    SET status = 'completed', paid_date = NOW(), updated_at = NOW()
    WHERE disbursement_id = $1;
  `;
  await pool.query(query, [data.disbursement_id]);
  console.log(`[PAYMENT] Disbursement completed: ${data.disbursement_id}`);
}

async function handleDisbursementFailed(data) {
  const query = `
    UPDATE payment_schedules
    SET status = 'failed', updated_at = NOW()
    WHERE disbursement_id = $1;
  `;
  await pool.query(query, [data.disbursement_id]);
  console.error(`[PAYMENT] Disbursement failed: ${data.disbursement_id}`);
}

// ============================================================================
// REFUNDS
// ============================================================================

router.post('/api/payments/:paymentId/refund', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body;
    const user = req.user;

    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }

    // Process refund with LawPay
    const refund = await lawpayService.refundPayment(paymentId, amount);

    // Update database
    const query = `
      UPDATE transactions
      SET status = 'refunded', updated_at = NOW()
      WHERE payment_id = $1;
    `;
    await pool.query(query, [paymentId]);

    console.log(`[PAYMENT] Refund processed: ${refund.id}`);

    res.json({
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100,
      status: 'completed'
    });
  } catch (error) {
    console.error('[PAYMENT] Error processing refund:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
