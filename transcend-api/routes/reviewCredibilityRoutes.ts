// Review Credibility API Routes
// RESTful endpoints for review submission, analysis, and admin management

import { Router, Request, Response } from 'express';
import {
  submitReviewForAnalysis,
  analyzeReviewCredibility,
  calculateProviderReputation,
  addToAdminReviewQueue,
  getAdminReviewQueue,
  resolveAdminReview,
  trackReviewTrend,
  filterOutFakeReviews,
  getReviewCredibilityTrends,
} from '../services/reviewCredibility';
import { authenticateToken, requireRole } from '../middleware/auth';
import { auditLog } from '../services/auditLogger';
import { queryParam, routeParam } from '../src/utils/httpParams';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * GET /api/reviews/:reviewId/credibility
 * Get credibility analysis for a specific review
 */
router.get('/api/reviews/:reviewId/credibility', authenticateToken, async (req: Request, res: Response) => {
  try {
    const reviewId = routeParam(req.params.reviewId);

    // Get review credibility data
    const result = await (global.db || {}).query?.(
      `SELECT * FROM review_credibility_scores WHERE review_id = $1`,
      [reviewId]
    );

    if (!result?.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Review credibility data not found' });
    }

    const row = result.rows[0];

    // Audit log
    await auditLog({
      userId: req.user?.id,
      action: 'VIEW_REVIEW_CREDIBILITY',
      resourceId: reviewId,
      resourceType: 'review_credibility',
      details: { reviewed_by: req.user?.id },
    });

    res.json({
      reviewId: row.review_id,
      providerId: row.provider_id,
      overallScore: row.overall_score,
      scoreComponents: row.score_components,
      flags: row.flags,
      isLikelyFake: row.is_likely_fake,
      recommendedAction: row.recommended_action,
      aiTextProbability: row.ai_text_probability,
      createdAt: row.created_at,
      analyzedAt: row.analyzed_at,
    });
  } catch (error) {
    console.error('Failed to get review credibility:', error);
    res.status(500).json({ error: 'Failed to retrieve review credibility data' });
  }
});

/**
 * GET /api/providers/:providerId/reputation
 * Get provider reputation summary
 */
router.get('/api/providers/:providerId/reputation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const providerId = routeParam(req.params.providerId);

    const reputation = await calculateProviderReputation(providerId);

    // Audit log
    await auditLog({
      userId: req.user?.id,
      action: 'VIEW_PROVIDER_REPUTATION',
      resourceId: providerId,
      resourceType: 'provider_reputation',
    });

    res.json(reputation);
  } catch (error) {
    console.error('Failed to get provider reputation:', error);
    res.status(500).json({ error: 'Failed to retrieve provider reputation' });
  }
});

/**
 * GET /api/providers/:providerId/review-trends
 * Get review trends for a provider (last 30 days)
 */
router.get('/api/providers/:providerId/review-trends', authenticateToken, async (req: Request, res: Response) => {
  try {
    const providerId = routeParam(req.params.providerId);
    const days = queryParam(req.query.days);

    const trends = await getReviewCredibilityTrends(providerId, parseInt(days as string));

    // Audit log
    await auditLog({
      userId: req.user?.id,
      action: 'VIEW_REVIEW_TRENDS',
      resourceId: providerId,
      resourceType: 'review_trends',
      details: { days: parseInt(days as string) },
    });

    res.json(trends);
  } catch (error) {
    console.error('Failed to get review trends:', error);
    res.status(500).json({ error: 'Failed to retrieve review trends' });
  }
});

// ============================================
// REVIEW SUBMISSION ROUTES
// ============================================

/**
 * POST /api/reviews/submit
 * Submit a new review for credibility analysis
 */
router.post('/api/reviews/submit', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { providerId, rating, title, content, serviceType, caseId } = req.body;

    // Validation
    if (!providerId || !rating || !title || !content || !serviceType) {
      return res.status(400).json({
        error: 'Missing required fields: providerId, rating, title, content, serviceType',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (content.length < 10) {
      return res.status(400).json({ error: 'Review content must be at least 10 characters' });
    }

    // Submit review for analysis
    const { reviewId, credibilityScore } = await submitReviewForAnalysis(
      providerId,
      req.user?.id,
      rating,
      title,
      content,
      serviceType,
      req.user?.isVerified || false,
      caseId
    );

    // Audit log
    await auditLog({
      userId: req.user?.id,
      action: 'CREATE_REVIEW',
      resourceId: reviewId,
      resourceType: 'review',
      details: {
        providerId,
        rating,
        serviceType,
        credibilityScore: credibilityScore.overallScore,
      },
    });

    res.status(201).json({
      success: true,
      reviewId,
      credibilityScore,
      message: 'Review submitted for analysis',
    });
  } catch (error) {
    console.error('Failed to submit review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

/**
 * POST /api/reviews/:reviewId/reanalyze
 * Trigger re-analysis of an existing review (admin only)
 */
router.post(
  '/api/reviews/:reviewId/reanalyze',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const reviewId = routeParam(req.params.reviewId);

      // Get review details
      const reviewResult = await (global.db || {}).query?.(
        `SELECT * FROM reviews WHERE id = $1`,
        [reviewId]
      );

      if (!reviewResult?.rows || reviewResult.rows.length === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }

      const review = reviewResult.rows[0];

      // Re-analyze
      const credibilityScore = await analyzeReviewCredibility(
        reviewId,
        review.provider_id,
        review.user_id,
        review.rating,
        review.content,
        review.is_verified_user
      );

      // Audit log
      await auditLog({
        userId: req.user?.id,
        action: 'REANALYZE_REVIEW',
        resourceId: reviewId,
        resourceType: 'review',
        details: { newScore: credibilityScore.overallScore },
      });

      res.json({
        success: true,
        reviewId,
        credibilityScore,
      });
    } catch (error) {
      console.error('Failed to re-analyze review:', error);
      res.status(500).json({ error: 'Failed to re-analyze review' });
    }
  }
);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * GET /api/admin/review-queue
 * Get admin review queue with optional filtering
 */
router.get('/api/admin/review-queue', authenticateToken, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const status = queryParam(req.query.status); const priority = queryParam(req.query.priority); const limit = queryParam(req.query.limit);

    const queue = await getAdminReviewQueue(
      status as string,
      priority !== 'all' ? (priority as string) : undefined,
      parseInt(limit as string)
    );

    // Audit log
    await auditLog({
      userId: req.user?.id,
      action: 'VIEW_REVIEW_QUEUE',
      resourceType: 'admin_review_queue',
      details: { status, priority, itemCount: queue.length },
    });

    res.json(queue);
  } catch (error) {
    console.error('Failed to get review queue:', error);
    res.status(500).json({ error: 'Failed to retrieve review queue' });
  }
});

/**
 * POST /api/admin/review-queue/:queueId/resolve
 * Resolve a review in the admin queue
 */
router.post(
  '/api/admin/review-queue/:queueId/resolve',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const queueId = routeParam(req.params.queueId);
      const { action, resolution } = req.body;

      if (!['approved', 'rejected', 'modified', 'escalated'].includes(action)) {
        return res.status(400).json({
          error: 'Invalid action. Must be one of: approved, rejected, modified, escalated',
        });
      }

      await resolveAdminReview(queueId, req.user?.id, action, resolution || '');

      // Audit log
      await auditLog({
        userId: req.user?.id,
        action: 'RESOLVE_REVIEW_QUEUE_ITEM',
        resourceId: queueId,
        resourceType: 'admin_review_queue',
        details: { action, resolution },
      });

      res.json({
        success: true,
        message: `Review queue item resolved with action: ${action}`,
      });
    } catch (error) {
      console.error('Failed to resolve review queue item:', error);
      res.status(500).json({ error: 'Failed to resolve review queue item' });
    }
  }
);

/**
 * POST /api/admin/reviews/:reviewId/flag
 * Manually flag a review to admin queue
 */
router.post(
  '/api/admin/reviews/:reviewId/flag',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const reviewId = routeParam(req.params.reviewId);
      const { reason, priority = 'medium' } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Reason is required' });
      }

      // Get review to find provider
      const reviewResult = await (global.db || {}).query?.(
        `SELECT provider_id FROM reviews WHERE id = $1`,
        [reviewId]
      );

      if (!reviewResult?.rows || reviewResult.rows.length === 0) {
        return res.status(404).json({ error: 'Review not found' });
      }

      const providerId = reviewResult.rows[0].provider_id;

      await addToAdminReviewQueue(reviewId, providerId, reason, priority);

      // Audit log
      await auditLog({
        userId: req.user?.id,
        action: 'FLAG_REVIEW_FOR_ADMIN',
        resourceId: reviewId,
        resourceType: 'review',
        details: { reason, priority },
      });

      res.json({
        success: true,
        message: 'Review flagged for manual review',
      });
    } catch (error) {
      console.error('Failed to flag review:', error);
      res.status(500).json({ error: 'Failed to flag review' });
    }
  }
);

/**
 * POST /api/admin/providers/:providerId/filter-fake-reviews
 * Filter out and reject fake reviews for a provider
 */
router.post(
  '/api/admin/providers/:providerId/filter-fake-reviews',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const providerId = routeParam(req.params.providerId);

      const count = await filterOutFakeReviews(providerId);

      // Audit log
      await auditLog({
        userId: req.user?.id,
        action: 'FILTER_FAKE_REVIEWS',
        resourceId: providerId,
        resourceType: 'provider',
        details: { reviewsFiltered: count },
      });

      res.json({
        success: true,
        message: `${count} fake reviews filtered and rejected`,
        reviewsFiltered: count,
      });
    } catch (error) {
      console.error('Failed to filter fake reviews:', error);
      res.status(500).json({ error: 'Failed to filter fake reviews' });
    }
  }
);

/**
 * POST /api/admin/providers/:providerId/recalculate-reputation
 * Recalculate provider reputation score
 */
router.post(
  '/api/admin/providers/:providerId/recalculate-reputation',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const providerId = routeParam(req.params.providerId);

      const reputation = await calculateProviderReputation(providerId);

      // Audit log
      await auditLog({
        userId: req.user?.id,
        action: 'RECALCULATE_PROVIDER_REPUTATION',
        resourceId: providerId,
        resourceType: 'provider_reputation',
        details: {
          credibilityScore: reputation.credibilityScore,
          trustScore: reputation.trustScore,
          riskLevel: reputation.riskLevel,
        },
      });

      res.json({
        success: true,
        reputation,
      });
    } catch (error) {
      console.error('Failed to recalculate reputation:', error);
      res.status(500).json({ error: 'Failed to recalculate provider reputation' });
    }
  }
);

/**
 * GET /api/admin/providers/:providerId/review-trends
 * Get detailed review trends for admin analytics
 */
router.get(
  '/api/admin/providers/:providerId/review-trends',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const providerId = routeParam(req.params.providerId);
      const days = queryParam(req.query.days);

      const trends = await getReviewCredibilityTrends(providerId, parseInt(days as string));

      // Audit log
      await auditLog({
        userId: req.user?.id,
        action: 'VIEW_PROVIDER_TRENDS',
        resourceId: providerId,
        resourceType: 'review_trends',
        details: { days: parseInt(days as string) },
      });

      res.json(trends);
    } catch (error) {
      console.error('Failed to get review trends:', error);
      res.status(500).json({ error: 'Failed to retrieve review trends' });
    }
  }
);

/**
 * GET /api/admin/analytics/suspicious-reviews
 * Get all suspicious reviews across platform
 */
router.get(
  '/api/admin/analytics/suspicious-reviews',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const limit = queryParam(req.query.limit); const offset = queryParam(req.query.offset);

      const result = await (global.db || {}).query?.(
        `SELECT * FROM suspicious_reviews_view LIMIT $1 OFFSET $2`,
        [parseInt(limit as string), parseInt(offset as string)]
      );

      // Audit log
      await auditLog({
        userId: req.user?.id,
        action: 'VIEW_SUSPICIOUS_REVIEWS',
        resourceType: 'review',
        details: { limit, offset, count: result?.rows?.length || 0 },
      });

      res.json(result?.rows || []);
    } catch (error) {
      console.error('Failed to get suspicious reviews:', error);
      res.status(500).json({ error: 'Failed to retrieve suspicious reviews' });
    }
  }
);

/**
 * GET /api/admin/analytics/provider-health
 * Get provider health overview
 */
router.get(
  '/api/admin/analytics/provider-health',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const result = await (global.db || {}).query?.(`SELECT * FROM provider_health_view`);

      // Audit log
      await auditLog({
        userId: req.user?.id,
        action: 'VIEW_PROVIDER_HEALTH',
        resourceType: 'provider_reputation',
        details: { providerCount: result?.rows?.length || 0 },
      });

      res.json(result?.rows || []);
    } catch (error) {
      console.error('Failed to get provider health:', error);
      res.status(500).json({ error: 'Failed to retrieve provider health' });
    }
  }
);

/**
 * GET /api/admin/analytics/queue-status
 * Get admin queue status summary
 */
router.get(
  '/api/admin/analytics/queue-status',
  authenticateToken,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const result = await (global.db || {}).query?.(`SELECT * FROM admin_queue_status_view`);

      res.json(result?.rows || []);
    } catch (error) {
      console.error('Failed to get queue status:', error);
      res.status(500).json({ error: 'Failed to retrieve queue status' });
    }
  }
);

// ============================================
// ERROR HANDLING
// ============================================

router.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Review credibility route error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default router;
