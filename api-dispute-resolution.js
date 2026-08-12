// TRANSCEND LAW - DISPUTE & RESOLUTION API
// Handle referral quality issues, disputes, and professional accountability

const express = require('express');
const router = express.Router();
const pool = require('./db');

// ============================================================================
// 1. SUBMIT REFERRAL QUALITY RATING
// ============================================================================

router.post('/api/disputes/rate-referral', async (req, res) => {
  try {
    const {
      transaction_id,
      rater_id,
      rater_type,
      professional_id,
      quality_score,
      timeliness_score,
      professionalism_score,
      result_quality_score,
      review_text
    } = req.body;

    const result = await pool.query(
      `INSERT INTO referral_quality_ratings (
        transaction_id, rater_id, rater_type, professional_id,
        quality_score, timeliness_score, professionalism_score,
        result_quality_score, review_text, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id;`,
      [
        transaction_id, rater_id, rater_type, professional_id,
        quality_score, timeliness_score, professionalism_score,
        result_quality_score, review_text, 'SUBMITTED'
      ]
    );

    // Auto-flag if any score is < 2
    if ([quality_score, timeliness_score, professionalism_score, result_quality_score].some(s => s < 2)) {
      await pool.query(
        `INSERT INTO performance_alerts (
          professional_id, profession_type, alert_type, severity,
          description, metric_value, action_required
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [professional_id, req.body.profession_type, 'MULTIPLE_POOR_REVIEWS', 'WARNING',
         `Low quality rating received: ${review_text}`, 1, 'INVESTIGATE']
      );
    }

    res.json({
      success: true,
      rating_id: result.rows[0].id,
      message: 'Rating submitted. Thank you for your feedback.'
    });
  } catch (error) {
    console.error('Rating error:', error);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// ============================================================================
// 2. FILE A DISPUTE
// ============================================================================

router.post('/api/disputes/file', async (req, res) => {
  try {
    const {
      transaction_id,
      complainant_id,
      complainant_type,
      respondent_id,
      respondent_type,
      issue_category,
      issue_description,
      severity_level,
      evidence_urls
    } = req.body;

    const dispute_id = `DISPUTE-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO disputes (
        dispute_id, transaction_id, complainant_id, complainant_type,
        respondent_id, respondent_type, issue_category, issue_description,
        severity_level, evidence_urls, evidence_count, status, filed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING dispute_id;`,
      [
        dispute_id, transaction_id, complainant_id, complainant_type,
        respondent_id, respondent_type, issue_category, issue_description,
        severity_level, JSON.stringify(evidence_urls || []),
        (evidence_urls || []).length, 'OPEN'
      ]
    );

    res.status(201).json({
      success: true,
      dispute_id: result.rows[0].dispute_id,
      status: 'OPEN',
      message: 'Dispute filed. We will contact the respondent within 24 hours.'
    });
  } catch (error) {
    console.error('Dispute filing error:', error);
    res.status(500).json({ error: 'Failed to file dispute' });
  }
});

// ============================================================================
// 3. GET DISPUTE DETAILS
// ============================================================================

router.get('/api/disputes/:dispute_id', async (req, res) => {
  try {
    const { dispute_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM disputes WHERE dispute_id = $1;`,
      [dispute_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = result.rows[0];

    // Get responses
    const responsesResult = await pool.query(
      `SELECT * FROM dispute_responses WHERE dispute_id = (
        SELECT id FROM disputes WHERE dispute_id = $1
      );`,
      [dispute_id]
    );

    res.json({
      dispute: dispute,
      responses: responsesResult.rows
    });
  } catch (error) {
    console.error('Dispute fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

// ============================================================================
// 4. SUBMIT DISPUTE RESPONSE
// ============================================================================

router.post('/api/disputes/:dispute_id/respond', async (req, res) => {
  try {
    const { dispute_id } = req.params;
    const { respondent_id, response_text, response_evidence } = req.body;

    // Get dispute ID from dispute_id string
    const disputeResult = await pool.query(
      `SELECT id FROM disputes WHERE dispute_id = $1;`,
      [dispute_id]
    );

    if (disputeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const disputeDbId = disputeResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO dispute_responses (
        dispute_id, respondent_id, response_text, response_evidence, status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id;`,
      [
        disputeDbId, respondent_id, response_text,
        JSON.stringify(response_evidence || []), 'SUBMITTED'
      ]
    );

    // Update dispute status
    await pool.query(
      `UPDATE disputes SET status = $1, first_response_at = NOW()
       WHERE dispute_id = $2;`,
      ['AWAITING_RESOLUTION', dispute_id]
    );

    res.json({
      success: true,
      response_id: result.rows[0].id,
      message: 'Response submitted. Admin will review both sides.'
    });
  } catch (error) {
    console.error('Response submission error:', error);
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

// ============================================================================
// 5. RESOLVE DISPUTE (Admin)
// ============================================================================

router.post('/api/disputes/:dispute_id/resolve', async (req, res) => {
  try {
    const { dispute_id } = req.params;
    const { resolution_type, refund_amount, resolution_notes } = req.body;

    const daysToResolve = Math.floor(
      (Date.now() - new Date(Date.now()).getTime()) / (1000 * 60 * 60 * 24)
    );

    const result = await pool.query(
      `UPDATE disputes
       SET status = $1, resolution_type = $2, refund_amount = $3,
           resolution_notes = $4, resolved_at = NOW(), days_to_resolve = $5
       WHERE dispute_id = $6
       RETURNING *;`,
      ['RESOLVED', resolution_type, refund_amount, resolution_notes, daysToResolve, dispute_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = result.rows[0];

    // Process refund if applicable
    if (refund_amount > 0) {
      await pool.query(
        `INSERT INTO refunds (
          refund_id, dispute_id, transaction_id, original_amount,
          refund_amount, reason, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `REFUND-${Date.now()}`,
          dispute.id,
          dispute.transaction_id,
          0, // original amount from transaction
          refund_amount,
          resolution_type,
          'PENDING'
        ]
      );
    }

    res.json({
      success: true,
      dispute_id,
      resolution_type,
      refund_amount,
      message: `Dispute resolved. ${refund_amount > 0 ? 'Refund processing.' : 'No refund issued.'}`
    });
  } catch (error) {
    console.error('Resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// ============================================================================
// 6. GET PROFESSIONAL ACCOUNTABILITY
// ============================================================================

router.get('/api/disputes/accountability/:professional_id', async (req, res) => {
  try {
    const { professional_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM professional_accountability WHERE professional_id = $1;`,
      [professional_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        professional_id,
        total_referrals: 0,
        total_disputes: 0,
        dispute_rate: 0,
        accountability_status: 'NEW'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Accountability fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch accountability' });
  }
});

// ============================================================================
// 7. ESCALATE DISPUTE
// ============================================================================

router.post('/api/disputes/:dispute_id/escalate', async (req, res) => {
  try {
    const { dispute_id } = req.params;
    const { escalation_reason, escalation_level } = req.body;

    // Get dispute
    const disputeResult = await pool.query(
      `SELECT id FROM disputes WHERE dispute_id = $1;`,
      [dispute_id]
    );

    if (disputeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const disputeDbId = disputeResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO dispute_escalations (
        dispute_id, escalation_reason, escalation_level, status
      ) VALUES ($1, $2, $3, $4)
      RETURNING id;`,
      [disputeDbId, escalation_reason, escalation_level, 'PENDING']
    );

    // Update dispute status
    await pool.query(
      `UPDATE disputes SET status = $1 WHERE dispute_id = $2;`,
      ['ESCALATED', dispute_id]
    );

    res.json({
      success: true,
      escalation_id: result.rows[0].id,
      message: 'Dispute escalated to senior team for review.'
    });
  } catch (error) {
    console.error('Escalation error:', error);
    res.status(500).json({ error: 'Failed to escalate dispute' });
  }
});

// ============================================================================
// 8. GET OPEN DISPUTES (Admin)
// ============================================================================

router.get('/api/disputes/status/open', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        d.dispute_id, d.status, d.issue_category, d.severity_level,
        d.complainant_type, d.respondent_id, d.filed_at,
        EXTRACT(DAY FROM NOW() - d.filed_at)::INT as days_open
       FROM disputes d
       WHERE d.status IN ('OPEN', 'UNDER_REVIEW', 'AWAITING_RESPONSE')
       ORDER BY d.severity_level DESC, d.filed_at ASC
       LIMIT 50;`
    );

    res.json({
      open_disputes: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Open disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch open disputes' });
  }
});

// ============================================================================
// 9. GET PROFESSIONAL ALERTS
// ============================================================================

router.get('/api/disputes/alerts/:professional_id', async (req, res) => {
  try {
    const { professional_id } = req.params;

    const result = await pool.query(
      `SELECT * FROM performance_alerts
       WHERE professional_id = $1 AND status = 'ACTIVE'
       ORDER BY severity DESC, created_at DESC;`,
      [professional_id]
    );

    res.json({
      professional_id,
      active_alerts: result.rows,
      alert_count: result.rows.length
    });
  } catch (error) {
    console.error('Alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// ============================================================================
// 10. DISPUTE ANALYTICS
// ============================================================================

router.get('/api/disputes/analytics/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_disputes,
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_count,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved_count,
        COUNT(CASE WHEN status = 'ESCALATED' THEN 1 END) as escalated_count,
        ROUND(AVG(days_to_resolve)::NUMERIC, 1) as avg_resolution_days,
        SUM(CASE WHEN refund_amount > 0 THEN refund_amount ELSE 0 END) as total_refunds
      FROM disputes;
    `);

    res.json({
      summary: result.rows[0],
      health: result.rows[0].open_count < 100 ? 'HEALTHY' : 'NEEDS_ATTENTION'
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;
