// routes/notary-eservice.js - Complete Online Notary Service API

const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ============================================================================
// CLIENT ENDPOINTS - Initiate & Complete Notary Service
// ============================================================================

// 1. CLIENT: Create notary service request
router.post('/requests', auth, async (req, res) => {
  try {
    const { documentType, details, estimatedSheets } = req.body;
    const clientId = req.user.id;

    const result = await db.query(
      `INSERT INTO notary_requests
       (client_id, document_type, details, estimated_sheets, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, status, created_at`,
      [clientId, documentType, JSON.stringify(details), estimatedSheets, 'pending_notary_review']
    );

    const requestId = result.rows[0].id;

    // Notify available notaries
    await notifyNotariesOfRequest(requestId, documentType);

    res.json({
      requestId,
      status: 'pending_notary_review',
      message: 'Request created. Waiting for notary to review and set price.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. CLIENT: Get request details
router.get('/requests/:requestId', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT nr.*, nq.notary_fee, nq.service_fee, (nq.notary_fee + nq.service_fee) as total_price
       FROM notary_requests nr
       LEFT JOIN notary_quotes nq ON nr.id = nq.request_id
       WHERE nr.id = $1 AND nr.client_id = $2`,
      [req.params.requestId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. CLIENT: Confirm price and proceed
router.post('/requests/:requestId/confirm-price', auth, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE notary_requests
       SET status = $1, client_confirmed_at = NOW()
       WHERE id = $2 AND client_id = $3
       RETURNING *`,
      ['ready_for_session', req.params.requestId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ message: 'Proceeding to notarization.', status: 'ready_for_session' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CLIENT: Start notarization session
router.post('/requests/:requestId/start-session', auth, async (req, res) => {
  try {
    // Get notary assigned
    const requestData = await db.query(
      'SELECT assigned_notary_id FROM notary_requests WHERE id = $1',
      [req.params.requestId]
    );

    const videoLink = `https://transcend-law.com/notary/session/${req.params.requestId}`;

    await db.query(
      `UPDATE notary_requests
       SET status = $1, video_link = $2, session_started_at = NOW()
       WHERE id = $3`,
      ['in_progress', videoLink, req.params.requestId]
    );

    res.json({
      videoLink,
      message: 'Session started. Notary will join shortly.',
      requestId: req.params.requestId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. CLIENT: Complete notarization and proceed to payment
router.post('/requests/:requestId/complete', auth, async (req, res) => {
  try {
    const { actualSheets } = req.body;

    // Get quote to calculate final amount
    const quoteData = await db.query(
      'SELECT * FROM notary_quotes WHERE request_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.params.requestId]
    );

    if (quoteData.rows.length === 0) {
      return res.status(400).json({ error: 'No quote found for this request' });
    }

    const quote = quoteData.rows[0];
    const baseCost = quote.notary_fee + quote.service_fee;

    // Calculate extra sheets fee ($2.50 per extra sheet)
    const estimatedSheets = (await db.query(
      'SELECT estimated_sheets FROM notary_requests WHERE id = $1',
      [req.params.requestId]
    )).rows[0].estimated_sheets;

    const extraSheets = Math.max(0, actualSheets - estimatedSheets);
    const extraSheetFee = extraSheets * 2.50;
    const finalTotal = baseCost + extraSheetFee;

    // Update request
    await db.query(
      `UPDATE notary_requests
       SET status = $1, actual_sheets = $2, sheet_fee = $3, final_amount = $4, session_ended_at = NOW()
       WHERE id = $5`,
      ['awaiting_payment', actualSheets, extraSheetFee, finalTotal, req.params.requestId]
    );

    res.json({
      requestId: req.params.requestId,
      breakdown: {
        notaryFee: quote.notary_fee,
        serviceFee: quote.service_fee,
        extraSheetFee: extraSheetFee,
        total: finalTotal
      },
      paymentRequired: true
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// PAYMENT ENDPOINTS
// ============================================================================

// 6. Process payment
router.post('/requests/:requestId/process-payment', auth, async (req, res) => {
  try {
    const { paymentToken } = req.body;

    const requestData = await db.query(
      'SELECT * FROM notary_requests WHERE id = $1 AND client_id = $2',
      [req.params.requestId, req.user.id]
    );

    if (requestData.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestData.rows[0];
    const amount = request.final_amount;

    // TODO: Process with Stripe/payment provider
    // For now, just record the payment
    const paymentResult = await db.query(
      `INSERT INTO payment_records
       (request_id, client_id, amount, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [req.params.requestId, req.user.id, amount, 'completed']
    );

    // Update request status to paid
    await db.query(
      `UPDATE notary_requests
       SET status = $1, payment_id = $2
       WHERE id = $3`,
      ['paid', paymentResult.rows[0].id, req.params.requestId]
    );

    res.json({
      success: true,
      amount: amount,
      message: 'Payment successful. Ready to download.',
      paymentId: paymentResult.rows[0].id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Download notarized document (requires payment)
router.get('/requests/:requestId/download', auth, async (req, res) => {
  try {
    const requestData = await db.query(
      `SELECT * FROM notary_requests
       WHERE id = $1 AND client_id = $2 AND status = $3`,
      [req.params.requestId, req.user.id, 'paid']
    );

    if (requestData.rows.length === 0) {
      return res.status(402).json({ error: 'Payment required to download' });
    }

    // Return file download (S3, local storage, etc.)
    // For now, just return success
    res.json({
      downloadUrl: `/api/notary/requests/${req.params.requestId}/file`,
      message: 'Download starting...'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// NOTARY ENDPOINTS
// ============================================================================

// 8. NOTARY: Get pending requests
router.get('/notary/pending-requests', auth, async (req, res) => {
  try {
    const notaryId = req.user.id;

    const result = await db.query(
      `SELECT nr.* FROM notary_requests nr
       JOIN notary_specialties ns ON nr.document_type = ns.specialty
       WHERE ns.notary_id = $1 AND nr.status = 'pending_notary_review'
       ORDER BY nr.created_at DESC`,
      [notaryId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. NOTARY: Submit price quote for request
router.post('/requests/:requestId/submit-quote', auth, async (req, res) => {
  try {
    const { notaryFee } = req.body;
    const notaryId = req.user.id;

    // Calculate service fee (25% of notary fee)
    const serviceFee = Math.round(notaryFee * 0.25 * 100) / 100;
    const totalAmount = notaryFee + serviceFee;

    // Save quote
    const result = await db.query(
      `INSERT INTO notary_quotes
       (request_id, notary_id, notary_fee, service_fee, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [req.params.requestId, notaryId, notaryFee, serviceFee, 'pending_client_approval']
    );

    // Update request
    await db.query(
      `UPDATE notary_requests
       SET status = $1, assigned_notary_id = $2
       WHERE id = $3`,
      ['awaiting_client_confirmation', notaryId, req.params.requestId]
    );

    res.json({
      quoteId: result.rows[0].id,
      breakdown: {
        notaryFee: notaryFee,
        serviceFee: serviceFee,
        total: totalAmount
      },
      message: 'Quote submitted. Waiting for client approval.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. NOTARY: Confirm sheet count during session
router.post('/requests/:requestId/confirm-sheets', auth, async (req, res) => {
  try {
    const { sheetCount } = req.body;

    await db.query(
      `UPDATE notary_requests
       SET confirmed_sheets = $1
       WHERE id = $2`,
      [sheetCount, req.params.requestId]
    );

    res.json({
      message: 'Sheet count confirmed',
      sheetsConfirmed: sheetCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function notifyNotariesOfRequest(requestId, documentType) {
  // Find notaries with this specialty
  try {
    const notaries = await db.query(
      `SELECT n.id FROM notaries n
       JOIN notary_specialties ns ON n.id = ns.notary_id
       WHERE ns.specialty = $1 AND n.status = 'active'`,
      [documentType]
    );

    // Create notification for each notary
    for (const notary of notaries.rows) {
      await db.query(
        `INSERT INTO notifications (notary_id, request_id, type, title, description, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [notary.id, requestId, 'new_enotary_request', 'New eNotary Request', `New ${documentType} request needs pricing`, ]
      );
    }
  } catch (err) {
    console.error('Error notifying notaries:', err);
  }
}

module.exports = router;
