// Churn Prediction & Win-Back Campaign Routes
// API endpoints for churn management

import { Router, Request, Response } from 'express';
import ChurnPredictionService from '../services/churnPrediction';
import { authenticateUser, authorizeAdmin } from '../middleware/auth';

const router = Router();

// ============================================
// CHURN PREDICTION ENDPOINTS
// ============================================

/**
 * GET /api/churn/prediction/current
 * Get churn prediction for current authenticated user
 */
router.get('/prediction/current', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const prediction = await ChurnPredictionService.predictChurnForUser(userId);

    if (!prediction) {
      return res.status(404).json({ error: 'No prediction available' });
    }

    res.json(prediction);
  } catch (error) {
    console.error('Error fetching churn prediction:', error);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

/**
 * GET /api/churn/prediction/:userId
 * Get churn prediction for specific user (admin only)
 */
router.get('/prediction/:userId', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const prediction = await ChurnPredictionService.predictChurnForUser(userId);

    if (!prediction) {
      return res.status(404).json({ error: 'No prediction available for this user' });
    }

    res.json(prediction);
  } catch (error) {
    console.error('Error fetching churn prediction:', error);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

/**
 * POST /api/churn/predict-all
 * Predict churn for all active users (admin only, async task)
 */
router.post('/predict-all', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    // Start async task
    ChurnPredictionService.predictChurnForAllUsers()
      .then((predictions) => {
        console.log(`Churn predictions completed for ${predictions.length} users`);
      })
      .catch((error) => {
        console.error('Error predicting churn:', error);
      });

    res.json({
      message: 'Churn prediction job started',
      status: 'processing',
    });
  } catch (error) {
    console.error('Error starting churn prediction:', error);
    res.status(500).json({ error: 'Failed to start prediction job' });
  }
});

// ============================================
// AT-RISK USERS ENDPOINTS
// ============================================

/**
 * GET /api/churn/at-risk-users
 * Get list of users at risk of churning (admin only)
 */
router.get('/at-risk-users', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const minChurnProbability = parseFloat(req.query.minChurn as string) || 0.5;
    const limit = parseInt(req.query.limit as string) || 100;

    const atRiskUsers = await ChurnPredictionService.getAtRiskUsers(minChurnProbability, limit);

    res.json(atRiskUsers);
  } catch (error) {
    console.error('Error fetching at-risk users:', error);
    res.status(500).json({ error: 'Failed to fetch at-risk users' });
  }
});

/**
 * GET /api/churn/at-risk-users/:segment
 * Get at-risk users by risk segment (admin only)
 */
router.get('/at-risk-users/:segment', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { segment } = req.params;
    const validSegments = ['low', 'medium', 'high', 'critical'];

    if (!validSegments.includes(segment)) {
      return res.status(400).json({ error: 'Invalid risk segment' });
    }

    const limit = parseInt(req.query.limit as string) || 50;

    const atRiskUsers = await ChurnPredictionService.getAtRiskUsers(0, 1000);
    const filtered = atRiskUsers.filter((u) => u.riskSegment === segment).slice(0, limit);

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching at-risk users by segment:', error);
    res.status(500).json({ error: 'Failed to fetch at-risk users' });
  }
});

// ============================================
// WIN-BACK CAMPAIGNS ENDPOINTS
// ============================================

/**
 * POST /api/churn/create-campaign
 * Create win-back campaign for a user
 */
router.post('/create-campaign', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, discountPercentage = 10, prioritySupportDays = 30 } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const prediction = await ChurnPredictionService.predictChurnForUser(userId);
    if (!prediction) {
      return res.status(404).json({ error: 'User not found or not eligible' });
    }

    const campaign = await ChurnPredictionService.createWinBackCampaign(
      userId,
      prediction,
      discountPercentage,
      prioritySupportDays
    );

    if (!campaign) {
      return res.status(500).json({ error: 'Failed to create campaign' });
    }

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

/**
 * POST /api/churn/send-winback-email
 * Send win-back email for campaign
 */
router.post('/send-winback-email', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { campaignId, userId } = req.body;

    if (!campaignId || !userId) {
      return res.status(400).json({ error: 'campaignId and userId are required' });
    }

    const prediction = await ChurnPredictionService.predictChurnForUser(userId);
    if (!prediction) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get campaign from database
    const { query } = require('../database/connection');
    const campaignResult = await query(
      'SELECT * FROM win_back_campaigns WHERE id = $1',
      [campaignId]
    );

    if (!campaignResult.rows?.length) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaignRow = campaignResult.rows[0];
    const campaign = {
      id: campaignRow.id,
      userId: campaignRow.user_id,
      email: campaignRow.email,
      churnProbability: parseFloat(campaignRow.churn_probability),
      riskSegment: campaignRow.risk_segment,
      campaignStatus: campaignRow.campaign_status,
      campaignStartDate: new Date(campaignRow.campaign_start_date),
      discountPercentage: campaignRow.discount_percentage,
      discountExpiryDays: campaignRow.discount_expiry_days,
      prioritySupportEnabled: campaignRow.priority_support_enabled,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      createdAt: new Date(campaignRow.created_at),
      updatedAt: new Date(campaignRow.updated_at),
    };

    const sent = await ChurnPredictionService.sendWinBackEmail(campaign, prediction);

    if (!sent) {
      return res.status(500).json({ error: 'Failed to send email' });
    }

    res.json({ message: 'Email sent successfully', campaignId });
  } catch (error) {
    console.error('Error sending win-back email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * GET /api/churn/winback-offer/:userId
 * Get active win-back offer for user
 */
router.get('/winback-offer/:userId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Check if request user matches userId or is admin
    if (req.user?.id !== userId && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { query } = require('../database/connection');
    const result = await query(
      `
      SELECT
        id as campaign_id,
        discount_percentage,
        discount_expiry_days,
        priority_support_enabled,
        campaign_end_date
      FROM win_back_campaigns
      WHERE user_id = $1
      AND campaign_status IN ('email_sent', 'offer_accepted')
      AND (campaign_end_date IS NULL OR campaign_end_date > NOW())
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    if (!result.rows?.length) {
      return res.status(404).json({ error: 'No active offer' });
    }

    const offer = result.rows[0];
    res.json({
      campaignId: offer.campaign_id,
      discountPercentage: offer.discount_percentage,
      discountExpiryDays: offer.discount_expiry_days,
      prioritySupportEnabled: offer.priority_support_enabled,
      offerExpiry: new Date(Date.now() + offer.discount_expiry_days * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Error fetching win-back offer:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

/**
 * POST /api/churn/accept-offer
 * Mark win-back offer as accepted
 */
router.post('/accept-offer', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { campaignId, userId } = req.body;

    // Check if request user matches userId
    if (req.user?.id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await ChurnPredictionService.markOfferAccepted(campaignId);

    res.json({ message: 'Offer accepted', campaignId });
  } catch (error) {
    console.error('Error accepting offer:', error);
    res.status(500).json({ error: 'Failed to accept offer' });
  }
});

// ============================================
// TRACKING ENDPOINTS
// ============================================

/**
 * POST /api/churn/track-event
 * Track churn-related events
 */
router.post('/track-event', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { eventType, userId } = req.body;

    // Check if request user matches userId or is admin
    if (req.user?.id !== userId && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { query } = require('../database/connection');

    await query(
      `
      INSERT INTO churn_events (user_id, event_type, event_metadata)
      VALUES ($1, $2, $3)
      `,
      [userId, eventType, JSON.stringify(req.body.metadata || {})]
    );

    // Update retention status if user is being retained
    if (eventType === 'user_retained') {
      await ChurnPredictionService.markUserRetained(userId);
    }

    res.json({ message: 'Event tracked' });
  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

/**
 * POST /api/churn/track-open/:token
 * Track email opens (pixel tracking)
 */
router.post('/track-open/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Decode token to get campaign ID
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [campaignId] = decoded.split(':');

    await ChurnPredictionService.trackEmailOpen(campaignId);

    // Return 1x1 tracking pixel
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(
      Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    );
  } catch (error) {
    console.error('Error tracking email open:', error);
    res.status(200).send('');
  }
});

/**
 * POST /api/churn/track-click/:token
 * Track email clicks
 */
router.post('/track-click/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [campaignId] = decoded.split(':');

    await ChurnPredictionService.trackCampaignClick(campaignId);

    res.json({ message: 'Click tracked' });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

/**
 * GET /api/churn/analytics
 * Get churn analytics dashboard data (admin only)
 */
router.get('/analytics', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const analytics = await ChurnPredictionService.getChurnAnalytics();

    if (!analytics) {
      return res.status(500).json({ error: 'Failed to fetch analytics' });
    }

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/churn/analytics/campaigns
 * Get campaign performance metrics (admin only)
 */
router.get('/analytics/campaigns', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const { query } = require('../database/connection');

    const result = await query(
      `
      SELECT
        campaign_id,
        user_id,
        email,
        risk_segment,
        campaign_status,
        discount_percentage,
        priority_support_enabled,
        impressions,
        clicks,
        conversions,
        click_through_rate,
        conversion_rate,
        email_opened,
        campaign_duration_days,
        original_churn_probability
      FROM campaign_performance_metrics
      ORDER BY campaign_duration_days DESC
      LIMIT 100
      `
    );

    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({ error: 'Failed to fetch campaign analytics' });
  }
});

// ============================================
// AUTOMATED CAMPAIGNS ENDPOINT
// ============================================

/**
 * POST /api/churn/run-campaigns
 * Run automated win-back campaigns (admin only)
 */
router.post('/run-campaigns', authenticateUser, authorizeAdmin, async (req: Request, res: Response) => {
  try {
    const result = await ChurnPredictionService.runAutomatedChurnCampaigns();

    res.json({
      message: 'Campaigns executed',
      campaignsCreated: result.campaignsCreated,
      emailsSent: result.emailsSent,
    });
  } catch (error) {
    console.error('Error running campaigns:', error);
    res.status(500).json({ error: 'Failed to run campaigns' });
  }
});

export default router;
