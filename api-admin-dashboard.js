// TRANSCEND LAW - ADMIN DASHBOARD API (Core Endpoints)

const express = require('express');
const router = express.Router();
const pool = require('./db');

// Dashboard snapshot - live metrics
router.get('/api/admin/dashboard', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM admin_dashboard_snapshot;
    `);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Manage professional - approve/suspend/remove
router.post('/api/admin/professional/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action_type, reason, admin_id } = req.body;

    await pool.query(
      `INSERT INTO professional_management_actions (
        professional_id, action_type, reason, admin_id, action_date
      ) VALUES ($1, $2, $3, $4, NOW())`,
      [id, action_type, reason, admin_id]
    );

    if (action_type === 'SUSPEND') {
      await pool.query(`UPDATE professional_profiles SET status = $1 WHERE professional_id = $2`,
        ['SUSPENDED', id]);
    }

    res.json({ success: true, action_type });
  } catch (error) {
    res.status(500).json({ error: 'Action failed' });
  }
});

// Create support ticket
router.post('/api/admin/support-ticket', async (req, res) => {
  try {
    const { requester_id, requester_type, issue_category, subject, description } = req.body;
    const ticket_id = `TKT-${Date.now()}`;

    await pool.query(
      `INSERT INTO support_tickets (
        ticket_id, requester_id, requester_type, issue_category, subject, description
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [ticket_id, requester_id, requester_type, issue_category, subject, description]
    );

    res.status(201).json({ success: true, ticket_id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// Get open tickets
router.get('/api/admin/tickets/open', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS')
       ORDER BY priority DESC LIMIT 50`
    );
    res.json({ tickets: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Assign ticket
router.post('/api/admin/ticket/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_id } = req.body;

    await pool.query(
      `UPDATE support_tickets SET assigned_to = $1, status = $2 WHERE ticket_id = $3`,
      [admin_id, 'IN_PROGRESS', id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// Resolve ticket
router.post('/api/admin/ticket/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `UPDATE support_tickets SET status = $1, resolved_at = NOW() WHERE ticket_id = $2`,
      ['RESOLVED', id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve ticket' });
  }
});

// Log audit entry
router.post('/api/admin/audit-log', async (req, res) => {
  try {
    const { admin_id, action_type, entity_type, entity_id, changes_made } = req.body;

    await pool.query(
      `INSERT INTO audit_logs (admin_id, action_type, entity_type, entity_id, changes_made)
       VALUES ($1, $2, $3, $4, $5)`,
      [admin_id, action_type, entity_type, entity_id, changes_made]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log' });
  }
});

// Get referral queue
router.get('/api/admin/referral-queue', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM referral_queue WHERE status IN ('MATCHED', 'PENDING')
       ORDER BY created_at ASC LIMIT 100`
    );
    res.json({ queue: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// Get operational alerts
router.get('/api/admin/alerts', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM operational_alerts WHERE status = 'ACTIVE'
       ORDER BY severity DESC, created_at DESC LIMIT 50`
    );
    res.json({ alerts: result.rows, count: result.rows.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Acknowledge alert
router.post('/api/admin/alert/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_id } = req.body;

    await pool.query(
      `UPDATE operational_alerts SET acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = NOW()
       WHERE id = $2`,
      [admin_id, id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to acknowledge' });
  }
});

module.exports = router;
