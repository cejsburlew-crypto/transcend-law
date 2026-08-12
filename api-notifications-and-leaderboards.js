// TRANSCEND LAW - NOTIFICATIONS & LEADERBOARDS API (Final Options)

const express = require('express');
const router = express.Router();
const pool = require('./db');

// ============================================================================
// OPTION 6: NOTIFICATIONS API
// ============================================================================

// Get notifications for professional
router.get('/api/notifications/:professional_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE professional_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.professional_id]
    );
    res.json({ notifications: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Mark notification as read
router.post('/api/notifications/:id/read', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET status = $1, read_at = NOW() WHERE notification_id = $2`,
      ['READ', req.params.id]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Send notification
router.post('/api/notifications/send', async (req, res) => {
  try {
    const { professional_id, type, title, message } = req.body;
    const notification_id = `NOTIF-${Date.now()}`;

    await pool.query(
      `INSERT INTO notifications (notification_id, professional_id, type, title, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [notification_id, professional_id, type, title, message]
    );

    res.status(201).json({ success: true, notification_id });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get notification preferences
router.get('/api/notifications/preferences/:professional_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notification_preferences WHERE professional_id = $1`,
      [req.params.professional_id]
    );
    res.json(result.rows[0] || { professional_id: req.params.professional_id });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Update preferences
router.post('/api/notifications/preferences/:professional_id', async (req, res) => {
  try {
    const { professional_id } = req.params;
    const { email_referrals, email_payments, sms_alerts, digest_frequency } = req.body;

    await pool.query(
      `INSERT INTO notification_preferences (professional_id, email_referrals, email_payments, sms_alerts, digest_frequency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (professional_id) DO UPDATE SET email_referrals = $2, email_payments = $3, sms_alerts = $4, digest_frequency = $5`,
      [professional_id, email_referrals, email_payments, sms_alerts, digest_frequency]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// ============================================================================
// OPTION 7: LEADERBOARDS & GAMIFICATION API
// ============================================================================

// Get monthly earnings leaderboard
router.get('/api/leaderboard/earnings/monthly', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM monthly_earnings_leaderboard LIMIT 100`
    );
    res.json({ leaderboard: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get state leaderboard
router.get('/api/leaderboard/state/:state', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM top_professionals_by_state WHERE state = $1 ORDER BY rank_state`,
      [req.params.state]
    );
    res.json({ leaderboard: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get professional rank
router.get('/api/leaderboard/rank/:professional_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rank_nationwide, rank_state, rank_profession, monthly_earnings
       FROM professional_leaderboard WHERE professional_id = $1`,
      [req.params.professional_id]
    );
    res.json(result.rows[0] || { rank: 'unranked' });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get achievements
router.get('/api/achievements/:professional_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM professional_achievements WHERE professional_id = $1 ORDER BY earned_at DESC`,
      [req.params.professional_id]
    );
    res.json({ achievements: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Award achievement
router.post('/api/achievements/award', async (req, res) => {
  try {
    const { professional_id, achievement_type, achievement_name } = req.body;

    await pool.query(
      `INSERT INTO professional_achievements (professional_id, achievement_type, achievement_name, earned_at)
       VALUES ($1, $2, $3, NOW())`,
      [professional_id, achievement_type, achievement_name]
    );

    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Get XP status
router.get('/api/xp/:professional_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT total_xp, level, xp_to_next_level, weekly_xp, monthly_xp
       FROM professional_xp_system WHERE professional_id = $1`,
      [req.params.professional_id]
    );
    res.json(result.rows[0] || { total_xp: 0, level: 1 });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

// Add XP
router.post('/api/xp/add', async (req, res) => {
  try {
    const { professional_id, activity_type, xp_earned } = req.body;

    await pool.query(
      `INSERT INTO xp_activities (professional_id, activity_type, xp_earned) VALUES ($1, $2, $3)`,
      [professional_id, activity_type, xp_earned]
    );

    await pool.query(
      `UPDATE professional_xp_system SET total_xp = total_xp + $1, monthly_xp = monthly_xp + $1
       WHERE professional_id = $2`,
      [xp_earned, professional_id]
    );

    res.json({ success: true, xp_added: xp_earned });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
