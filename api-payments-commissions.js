// TRANSCEND LAW - PAYMENTS & COMMISSIONS API (OPTION 1)
// Complete payment processing, commission calculation, settlements, and payouts

const express = require('express');
const router = express.Router();
const pool = require('./db');
const stripe = require('stripe')(process.env.STRIPE_API_KEY);

// Commission rates by profession (percent of service amount)
const COMMISSION_RATES = {
  'ATTORNEY': 15,
  'PARALEGAL': 12,
  'COURT_REPORTER': 18,
  'EXPERT_WITNESS': 20,
  'PROCESS_SERVER': 10,
  'MEDIATOR': 16,
  'BAIL_BONDSMAN': 12,
  'TITLE_AGENT': 8,
  'LEGAL_CONSULTANT': 14,
  'DOCUMENT_PREPARER': 5,
  'FORENSIC_ACCOUNTANT': 18,
  'BACKGROUND_CHECK': 7,
  'SKIP_TRACER': 12,
  'INSURANCE_ADJUSTER': 10,
  'NOTARY': 5,
  'PRIVATE_INVESTIGATOR': 14
};

const PLATFORM_FEE_PERCENT = 1;  // 1% platform fee on all transactions

// ============================================================================
// 1. CREATE TRANSACTION & AUTO-CALCULATE COMMISSION
// ============================================================================

router.post('/api/payments/transaction', async (req, res) => {
  try {
    const {
      client_id, professional_id, profession_type, service_description,
      service_amount, hours_billed, hourly_rate
    } = req.body;

    const transaction_id = `TXN-${Date.now()}`;
    const commission_percentage = COMMISSION_RATES[profession_type] || 10;
    const commission_amount = (service_amount * commission_percentage) / 100;
    const platform_fee = (service_amount * PLATFORM_FEE_PERCENT) / 100;

    const result = await pool.query(
      `INSERT INTO transactions (
        transaction_id, client_id, professional_id, profession_type,
        service_description, service_amount, hours_billed, hourly_rate,
        commission_percentage, commission_amount, platform_fee
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;`,
      [
        transaction_id, client_id, professional_id, profession_type,
        service_description, service_amount, hours_billed, hourly_rate,
        commission_percentage, commission_amount, platform_fee
      ]
    );

    // Log commission earned
    await pool.query(
      `INSERT INTO commissions (professional_id, transaction_id, commission_amount, status)
       VALUES ($1, $2, $3, 'EARNED');`,
      [professional_id, result.rows[0].id, commission_amount]
    );

    res.status(201).json({
      success: true,
      transaction: result.rows[0],
      commission_calculated: {
        percentage: commission_percentage,
        amount: commission_amount
      }
    });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// ============================================================================
// 2. GET PROFESSIONAL'S EARNED COMMISSIONS
// ============================================================================

router.get('/api/payments/commissions/:professional_id', async (req, res) => {
  try {
    const { professional_id } = req.params;

    const result = await pool.query(
      `SELECT
        COUNT(*) as total_commissions,
        SUM(commission_amount) as total_earned,
        COUNT(CASE WHEN status = 'EARNED' THEN 1 END) as pending_commissions,
        SUM(CASE WHEN status = 'EARNED' THEN commission_amount ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_commissions,
        SUM(CASE WHEN status = 'SETTLED' THEN commission_amount ELSE 0 END) as settled_amount
       FROM commissions WHERE professional_id = $1;`,
      [professional_id]
    );

    res.json({
      professional_id,
      earnings: result.rows[0]
    });
  } catch (error) {
    console.error('Commission fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

// ============================================================================
// 3. CREATE MONTHLY SETTLEMENT
// ============================================================================

router.post('/api/payments/settlement/:professional_id', async (req, res) => {
  try {
    const { professional_id } = req.params;
    const settlement_period = new Date().toISOString().slice(0, 7);  // YYYY-MM
    const settlement_id = `SETL-${Date.now()}`;

    // Aggregate earned commissions for the month
    const result = await pool.query(
      `SELECT
        SUM(commission_amount) as total_commissions,
        COUNT(*) as transaction_count
       FROM commissions
       WHERE professional_id = $1 AND status = 'EARNED'
         AND DATE_TRUNC('month', earned_at) = DATE_TRUNC('month', CURRENT_DATE);`,
      [professional_id]
    );

    const total_commissions = result.rows[0]?.total_commissions || 0;
    const transaction_count = result.rows[0]?.transaction_count || 0;

    // Create settlement record
    const settlementResult = await pool.query(
      `INSERT INTO settlements (
        settlement_id, professional_id, settlement_period,
        total_commissions, total_transactions, net_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
      RETURNING *;`,
      [settlement_id, professional_id, settlement_period, total_commissions, transaction_count, total_commissions]
    );

    // Mark commissions as settled
    await pool.query(
      `UPDATE commissions SET status = 'PENDING_SETTLEMENT'
       WHERE professional_id = $1 AND status = 'EARNED'
         AND DATE_TRUNC('month', earned_at) = DATE_TRUNC('month', CURRENT_DATE);`,
      [professional_id]
    );

    res.status(201).json({
      success: true,
      settlement: settlementResult.rows[0]
    });
  } catch (error) {
    console.error('Settlement error:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  }
});

// ============================================================================
// 4. PROCESS PAYMENT & QUEUE PAYOUT
// ============================================================================

router.post('/api/payments/process', async (req, res) => {
  try {
    const { settlement_id, stripe_token } = req.body;

    const settlementResult = await pool.query(
      `SELECT * FROM settlements WHERE id = $1;`,
      [settlement_id]
    );

    const settlement = settlementResult.rows[0];
    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    // Charge client via Stripe
    const charge = await stripe.charges.create({
      amount: Math.round(settlement.net_amount * 100),  // Convert to cents
      currency: 'usd',
      source: stripe_token,
      description: `Settlement ${settlement.settlement_id}`
    });

    // Update settlement status
    await pool.query(
      `UPDATE settlements SET status = 'APPROVED' WHERE id = $1;`,
      [settlement_id]
    );

    res.json({
      success: true,
      charge_id: charge.id,
      amount_charged: settlement.net_amount,
      settlement_id: settlement.settlement_id
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// ============================================================================
// 5. EXECUTE PAYOUT TO PROFESSIONAL
// ============================================================================

router.post('/api/payments/payout/:settlement_id', async (req, res) => {
  try {
    const { settlement_id } = req.params;

    const settlementResult = await pool.query(
      `SELECT * FROM settlements WHERE id = $1;`,
      [settlement_id]
    );

    const settlement = settlementResult.rows[0];

    // Get professional bank account
    const bankResult = await pool.query(
      `SELECT * FROM professional_bank_accounts WHERE professional_id = $1;`,
      [settlement.professional_id]
    );

    const bank = bankResult.rows[0];
    if (!bank) {
      return res.status(400).json({ error: 'Bank account not verified' });
    }

    // Create payout record
    const payout_id = `PAYOUT-${Date.now()}`;
    const payoutResult = await pool.query(
      `INSERT INTO payouts (payout_id, professional_id, settlement_id, payout_amount, status)
       VALUES ($1, $2, $3, $4, 'INITIATED')
       RETURNING *;`,
      [payout_id, settlement.professional_id, settlement_id, settlement.net_amount]
    );

    // Queue for ACH payout (would integrate with payment processor)
    // stripe.payouts.create({...})

    res.json({
      success: true,
      payout: payoutResult.rows[0],
      status: 'PAYOUT_INITIATED'
    });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({ error: 'Failed to process payout' });
  }
});

// ============================================================================
// 6. GENERATE INVOICE
// ============================================================================

router.post('/api/payments/invoice/:settlement_id', async (req, res) => {
  try {
    const { settlement_id } = req.params;

    const settlementResult = await pool.query(
      `SELECT * FROM settlements WHERE id = $1;`,
      [settlement_id]
    );

    const settlement = settlementResult.rows[0];
    const invoice_id = `INV-${Date.now()}`;

    const invoiceResult = await pool.query(
      `INSERT INTO invoices (
        invoice_id, professional_id, settlement_id,
        invoice_number, invoice_date, due_date,
        total_amount, final_amount
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', $5, $6)
      RETURNING *;`,
      [invoice_id, settlement.professional_id, settlement_id, invoice_id, settlement.net_amount, settlement.net_amount]
    );

    res.status(201).json({
      success: true,
      invoice: invoiceResult.rows[0]
    });
  } catch (error) {
    console.error('Invoice error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// ============================================================================
// 7. FILE COMMISSION DISPUTE
// ============================================================================

router.post('/api/payments/dispute', async (req, res) => {
  try {
    const { professional_id, settlement_id, reason, disputed_amount } = req.body;
    const dispute_id = `DISPUTE-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO commission_disputes (
        dispute_id, professional_id, settlement_id, reason, disputed_amount, status
      ) VALUES ($1, $2, $3, $4, $5, 'FILED')
      RETURNING *;`,
      [dispute_id, professional_id, settlement_id, reason, disputed_amount]
    );

    res.status(201).json({
      success: true,
      dispute: result.rows[0],
      message: 'Dispute filed. Admin review in progress.'
    });
  } catch (error) {
    console.error('Dispute filing error:', error);
    res.status(500).json({ error: 'Failed to file dispute' });
  }
});

// ============================================================================
// 8. GET PAYMENT HISTORY
// ============================================================================

router.get('/api/payments/history/:professional_id', async (req, res) => {
  try {
    const { professional_id } = req.params;

    const transactionsResult = await pool.query(
      `SELECT * FROM transactions WHERE professional_id = $1 ORDER BY created_at DESC LIMIT 50;`,
      [professional_id]
    );

    const settlementsResult = await pool.query(
      `SELECT * FROM settlements WHERE professional_id = $1 ORDER BY created_at DESC LIMIT 24;`,
      [professional_id]
    );

    const payoutsResult = await pool.query(
      `SELECT * FROM payouts WHERE professional_id = $1 ORDER BY initiated_at DESC LIMIT 24;`,
      [professional_id]
    );

    res.json({
      transactions: transactionsResult.rows,
      settlements: settlementsResult.rows,
      payouts: payoutsResult.rows
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// ============================================================================
// 9. GET COMMISSION RATES
// ============================================================================

router.get('/api/payments/commission-rates/:profession_type', async (req, res) => {
  try {
    const { profession_type } = req.params;
    const rate = COMMISSION_RATES[profession_type] || 10;

    res.json({
      profession_type,
      commission_percentage: rate,
      platform_fee_percent: PLATFORM_FEE_PERCENT,
      example_calculation: {
        service_amount: 1000,
        commission: (1000 * rate) / 100,
        platform_fee: (1000 * PLATFORM_FEE_PERCENT) / 100,
        net_to_professional: 1000 - ((1000 * rate) / 100)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// ============================================================================
// 10. REVENUE ANALYTICS
// ============================================================================

router.get('/api/payments/analytics/revenue', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as transactions,
        SUM(service_amount) as gross_volume,
        SUM(commission_amount) as commissions_owed,
        SUM(platform_fee) as platform_revenue,
        ROUND(SUM(platform_fee)::numeric, 2) as platform_earnings
      FROM transactions
      WHERE status = 'COMPLETED'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
      LIMIT 30;
    `);

    res.json({
      daily_revenue: result.rows,
      current_month: result.rows[0]
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
