// Sanctions Screening Routes
// OFAC/EU/UN/UK Compliance Endpoints

import { Router, Request, Response } from 'express';
import {
  screenAgainstSanctions,
  getUserScreeningHistory,
  getScreeningResult,
  reviewScreening,
  getPendingReviews,
  getSanctionsUpdateStatus,
  performDailyUpdate,
  getSanctionsAuditTrail,
  SanctionsCheckPayload,
} from '../services/sanctionsService';
import { authenticateToken } from '../middleware/auth';
import { query } from '../database/connection';

const router = Router();

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Check if user is admin for review endpoints
 */
async function isAdmin(req: Request, res: Response, next: Function): Promise<void> {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user has admin role
    const result = await query(
      `SELECT role FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============================================
// SCREENING ENDPOINTS
// ============================================

/**
 * POST /sanctions/screen
 * Screen user/entity against sanctions lists
 * Used during account creation and payment processing
 */
router.post('/screen', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, email, phone, address, dateOfBirth, passportNumber, taxId, companyName, checkType } = req.body;
    const userId = (req as any).user?.userId;

    // Validate required fields
    if (!firstName || !lastName || !checkType) {
      res.status(400).json({
        error: 'Missing required fields: firstName, lastName, checkType',
      });
      return;
    }

    if (!['account_creation', 'payment_processing', 'manual_review'].includes(checkType)) {
      res.status(400).json({
        error: 'Invalid checkType. Must be: account_creation, payment_processing, or manual_review',
      });
      return;
    }

    // Create screening payload
    const payload: SanctionsCheckPayload = {
      userId,
      firstName,
      lastName,
      email,
      phone,
      address,
      dateOfBirth,
      passportNumber,
      taxId,
      companyName,
      checkType,
    };

    // Perform screening
    const result = await screenAgainstSanctions(payload);

    // Log the request
    console.log(`Sanctions screening completed for user ${userId}`, {
      status: result.status,
      riskScore: result.riskScore,
      matchesCount: result.matches.length,
    });

    res.status(200).json({
      success: true,
      screening: result,
    });
  } catch (error: any) {
    console.error('Screening error:', error);
    res.status(500).json({
      error: 'Screening failed',
      message: error.message,
    });
  }
});

/**
 * GET /sanctions/screening/:screeningId
 * Get specific screening result
 */
router.get('/screening/:screeningId', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { screeningId } = req.params;
    const userId = (req as any).user?.userId;

    const result = await getScreeningResult(screeningId);

    if (!result) {
      res.status(404).json({ error: 'Screening not found' });
      return;
    }

    // Check authorization - user can only view their own screenings
    if (result.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.status(200).json({
      success: true,
      screening: result,
    });
  } catch (error: any) {
    console.error('Get screening error:', error);
    res.status(500).json({
      error: 'Failed to fetch screening',
      message: error.message,
    });
  }
});

/**
 * GET /sanctions/user/history
 * Get user's screening history
 */
router.get('/user/history', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    const history = await getUserScreeningHistory(userId, limit);

    res.status(200).json({
      success: true,
      count: history.length,
      screenings: history,
    });
  } catch (error: any) {
    console.error('History fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch history',
      message: error.message,
    });
  }
});

// ============================================
// ADMIN REVIEW ENDPOINTS
// ============================================

/**
 * GET /sanctions/admin/pending-reviews
 * Get screenings pending manual review (admin only)
 */
router.get('/admin/pending-reviews', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const pendingReviews = await getPendingReviews(limit);

    res.status(200).json({
      success: true,
      count: pendingReviews.length,
      screenings: pendingReviews,
    });
  } catch (error: any) {
    console.error('Pending reviews fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch pending reviews',
      message: error.message,
    });
  }
});

/**
 * POST /sanctions/admin/review/:screeningId
 * Submit manual review for a screening (admin only)
 */
router.post('/admin/review/:screeningId', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { screeningId } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewedBy = (req as any).user?.userId;

    // Validate input
    if (!status || !reviewNotes) {
      res.status(400).json({
        error: 'Missing required fields: status, reviewNotes',
      });
      return;
    }

    if (!['clear', 'potential_match', 'confirmed_match', 'blocked', 'manual_review'].includes(status)) {
      res.status(400).json({
        error: 'Invalid status. Must be: clear, potential_match, confirmed_match, blocked, or manual_review',
      });
      return;
    }

    // Submit review
    const updatedScreening = await reviewScreening(screeningId, reviewedBy, status, reviewNotes);

    if (!updatedScreening) {
      res.status(404).json({ error: 'Screening not found' });
      return;
    }

    console.log(`Screening ${screeningId} reviewed by ${reviewedBy}`, {
      newStatus: status,
    });

    res.status(200).json({
      success: true,
      screening: updatedScreening,
      message: `Screening status updated to ${status}`,
    });
  } catch (error: any) {
    console.error('Review submission error:', error);
    res.status(500).json({
      error: 'Failed to submit review',
      message: error.message,
    });
  }
});

// ============================================
// ADMIN STATISTICS & MONITORING
// ============================================

/**
 * GET /sanctions/admin/statistics
 * Get sanctions screening statistics (admin only)
 */
router.get('/admin/statistics', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT
        COUNT(DISTINCT user_id) as total_screened_users,
        COUNT(*) as total_screenings,
        COUNT(CASE WHEN status = 'clear' THEN 1 END) as clear_screenings,
        COUNT(CASE WHEN status = 'potential_match' THEN 1 END) as potential_match_count,
        COUNT(CASE WHEN status = 'confirmed_match' THEN 1 END) as confirmed_match_count,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_screenings,
        COUNT(CASE WHEN status = 'manual_review' THEN 1 END) as pending_reviews,
        COUNT(CASE WHEN auto_blocked = true THEN 1 END) as auto_blocked_count,
        ROUND(AVG(risk_score)::numeric, 2) as average_risk_score,
        MAX(risk_score) as highest_risk_score,
        MIN(risk_score) as lowest_risk_score,
        DATE(CURRENT_TIMESTAMP) as report_date
      FROM sanctions_screenings
      WHERE deleted_at IS NULL`
    );

    res.status(200).json({
      success: true,
      statistics: result.rows[0],
    });
  } catch (error: any) {
    console.error('Statistics fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message,
    });
  }
});

/**
 * GET /sanctions/admin/update-status
 * Get status of sanctions list updates (admin only)
 */
router.get('/admin/update-status', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updateStatus = await getSanctionsUpdateStatus();

    res.status(200).json({
      success: true,
      updates: updateStatus,
    });
  } catch (error: any) {
    console.error('Update status fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch update status',
      message: error.message,
    });
  }
});

/**
 * POST /sanctions/admin/force-update
 * Force immediate sanctions list update (admin only)
 */
router.post('/admin/force-update', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Forcing sanctions list update...');

    // Perform update asynchronously
    performDailyUpdate().catch((error) => {
      console.error('Daily update failed:', error);
    });

    res.status(202).json({
      success: true,
      message: 'Update job initiated',
      note: 'Update is running in the background. Check update-status endpoint for progress.',
    });
  } catch (error: any) {
    console.error('Force update error:', error);
    res.status(500).json({
      error: 'Failed to initiate update',
      message: error.message,
    });
  }
});

// ============================================
// AUDIT LOG ENDPOINTS
// ============================================

/**
 * GET /sanctions/admin/audit-log
 * Get sanctions activity audit log (admin only)
 */
router.get('/admin/audit-log', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    const auditLog = await getSanctionsAuditTrail(userId, limit);

    res.status(200).json({
      success: true,
      count: auditLog.length,
      logs: auditLog,
    });
  } catch (error: any) {
    console.error('Audit log fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch audit log',
      message: error.message,
    });
  }
});

// ============================================
// BLOCKED USERS ENDPOINTS
// ============================================

/**
 * GET /sanctions/admin/blocked-users
 * Get list of sanctioned/blocked users (admin only)
 */
router.get('/admin/blocked-users', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

    const result = await query(
      `SELECT
        sbu.id,
        sbu.user_id,
        u.email,
        u.first_name,
        u.last_name,
        sbu.reason,
        sbu.blocked_at,
        sbu.appeal_submitted_at,
        sbu.appeal_reason,
        ss.risk_score,
        ss.status as screening_status
      FROM sanctions_blocked_users sbu
      JOIN users u ON sbu.user_id = u.id
      JOIN sanctions_screenings ss ON sbu.blocking_screening_id = ss.id
      WHERE sbu.unblocked_at IS NULL
      ORDER BY sbu.blocked_at DESC
      LIMIT $1`,
      [limit]
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      blockedUsers: result.rows,
    });
  } catch (error: any) {
    console.error('Blocked users fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch blocked users',
      message: error.message,
    });
  }
});

/**
 * POST /sanctions/admin/unblock-user/:userId
 * Unblock a sanctioned user (admin only)
 */
router.post('/admin/unblock-user/:userId', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const unblockBy = (req as any).user?.userId;

    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    const result = await query(
      `UPDATE sanctions_blocked_users
       SET unblocked_at = NOW(), unblocked_by = $1, unblock_reason = $2
       WHERE user_id = $3 AND unblocked_at IS NULL
       RETURNING *`,
      [unblockBy, reason, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Blocked user not found' });
      return;
    }

    // Update user record
    await query(
      `UPDATE users SET sanctions_blocked = false WHERE id = $1`,
      [userId]
    );

    // Log the action
    await query(
      `INSERT INTO sanctions_audit_log
       (user_id, action, reviewed_by)
       VALUES ($1, $2, $3)`,
      ['UNBLOCK', unblockBy, userId]
    );

    console.log(`User ${userId} unblocked by ${unblockBy}`);

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
      blockedUser: result.rows[0],
    });
  } catch (error: any) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      error: 'Failed to unblock user',
      message: error.message,
    });
  }
});

// ============================================
// APPEALS ENDPOINTS
// ============================================

/**
 * POST /sanctions/appeal
 * Submit appeal for blocked user
 */
router.post('/appeal', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { reason, supportingDocuments } = req.body;

    if (!reason) {
      res.status(400).json({ error: 'reason is required' });
      return;
    }

    // Find blocked user record
    const blockedResult = await query(
      `SELECT id FROM sanctions_blocked_users WHERE user_id = $1 AND unblocked_at IS NULL`,
      [userId]
    );

    if (blockedResult.rows.length === 0) {
      res.status(400).json({ error: 'User is not currently blocked' });
      return;
    }

    // Create appeal
    const appealResult = await query(
      `INSERT INTO sanctions_appeals
       (user_id, blocked_user_id, reason, supporting_documents, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, blockedResult.rows[0].id, reason, JSON.stringify(supportingDocuments || []), 'pending']
    );

    console.log(`Appeal submitted by user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Appeal submitted successfully',
      appeal: appealResult.rows[0],
    });
  } catch (error: any) {
    console.error('Appeal submission error:', error);
    res.status(500).json({
      error: 'Failed to submit appeal',
      message: error.message,
    });
  }
});

/**
 * GET /sanctions/appeal/status
 * Get user's appeal status
 */
router.get('/appeal/status', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const result = await query(
      `SELECT * FROM sanctions_appeals
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No appeal found' });
      return;
    }

    res.status(200).json({
      success: true,
      appeal: result.rows[0],
    });
  } catch (error: any) {
    console.error('Appeal status fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch appeal status',
      message: error.message,
    });
  }
});

/**
 * GET /sanctions/admin/appeals
 * Get all pending appeals (admin only)
 */
router.get('/admin/appeals', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT
        sa.id,
        sa.user_id,
        u.email,
        u.first_name,
        u.last_name,
        sa.reason,
        sa.status,
        sa.created_at,
        sa.review_notes
      FROM sanctions_appeals sa
      JOIN users u ON sa.user_id = u.id
      WHERE sa.status = 'pending'
      ORDER BY sa.created_at ASC`
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      appeals: result.rows,
    });
  } catch (error: any) {
    console.error('Appeals fetch error:', error);
    res.status(500).json({
      error: 'Failed to fetch appeals',
      message: error.message,
    });
  }
});

/**
 * POST /sanctions/admin/appeal/review/:appealId
 * Review and decide on appeal (admin only)
 */
router.post('/admin/appeal/review/:appealId', authenticateToken, isAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { appealId } = req.params;
    const { status, reviewNotes } = req.body;
    const reviewerId = (req as any).user?.userId;

    if (!['approved', 'rejected', 'under_review'].includes(status)) {
      res.status(400).json({
        error: 'Invalid status. Must be: approved, rejected, or under_review',
      });
      return;
    }

    const result = await query(
      `UPDATE sanctions_appeals
       SET status = $1, reviewer_id = $2, review_notes = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, reviewerId, reviewNotes, appealId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Appeal not found' });
      return;
    }

    // If approved, unblock the user
    if (status === 'approved') {
      const appealRow = result.rows[0];
      await query(
        `UPDATE sanctions_blocked_users
         SET unblocked_at = NOW(), unblocked_by = $1, unblock_reason = $2
         WHERE id = $3`,
        [reviewerId, 'Appeal approved', appealRow.blocked_user_id]
      );

      await query(
        `UPDATE users SET sanctions_blocked = false WHERE id = $1`,
        [appealRow.user_id]
      );
    }

    console.log(`Appeal ${appealId} reviewed with status: ${status}`);

    res.status(200).json({
      success: true,
      message: `Appeal ${status}`,
      appeal: result.rows[0],
    });
  } catch (error: any) {
    console.error('Appeal review error:', error);
    res.status(500).json({
      error: 'Failed to review appeal',
      message: error.message,
    });
  }
});

export default router;
