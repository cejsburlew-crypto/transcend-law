// Affiliate Program Routes
// RESTful API endpoints for affiliate management

import { Router, Request, Response, NextFunction } from 'express';
import * as affiliateService from '../services/affiliateService';
import { authenticate } from '../middleware/auth';
import { validateInput } from '../middleware/validation';
import { rateLimitAffiliate } from '../middleware/rateLimiting';
import { queryParam, routeParam } from '../src/utils/httpParams';

// NOTE: `req.user!` assertions below are sound - this router applies
// authentication middleware, so a handler cannot run without an authenticated
// user. TypeScript cannot see that guarantee across the middleware boundary.

const router = Router();

// Apply authentication and rate limiting to all affiliate routes
router.use(authenticate);
router.use(rateLimitAffiliate);

// ============================================
// AFFILIATE PROFILE ENDPOINTS
// ============================================

/**
 * POST /api/v1/affiliate/signup
 * Register new affiliate
 */
router.post('/signup', validateInput({
  companyName: 'string',
  email: 'email',
  taxId: 'string?'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyName, email, taxId } = req.body;
    const profile = await affiliateService.registerAffiliate(
      req.user!.id,
      email,
      companyName,
      taxId
    );

    res.status(201).json({
      success: true,
      data: profile,
      message: 'Affiliate registration successful. Pending approval.'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/affiliate/profile
 * Get current affiliate profile
 */
router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Find affiliate by user ID
    const affiliates = await affiliateService.listAffiliates(
      { /* no filters */ },
      1,
      0
    );

    const profile = affiliates.find(a => a.userId === req.user!.id);

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate profile not found'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/affiliate/profile
 * Update affiliate profile
 */
router.put('/profile', validateInput({
  companyName: 'string?',
  paymentMethod: 'string?',
  monthlyRevenueCap: 'number?'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyName, paymentMethod, monthlyRevenueCap } = req.body;

    // Get current affiliate
    const affiliates = await affiliateService.listAffiliates({}, 1, 0);
    const affiliate = affiliates.find(a => a.userId === req.user!.id);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate profile not found'
      });
    }

    const updated = await affiliateService.updateAffiliateProfile(
      affiliate.id,
      {
        companyName: companyName || affiliate.companyName,
        paymentMethod: paymentMethod as any,
        monthlyRevenueCap
      }
    );

    res.json({
      success: true,
      data: updated,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TRACKING LINKS ENDPOINTS
// ============================================

/**
 * POST /api/v1/affiliate/links
 * Create tracking link
 */
router.post('/links', validateInput({
  campaignName: 'string',
  metadata: 'object?'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaignName, metadata } = req.body;

    // Get current affiliate
    const affiliates = await affiliateService.listAffiliates({}, 1, 0);
    const affiliate = affiliates.find(a => a.userId === req.user!.id);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate profile not found'
      });
    }

    const link = await affiliateService.createTrackingLink(
      affiliate.id,
      campaignName,
      metadata
    );

    res.status(201).json({
      success: true,
      data: link,
      message: 'Tracking link created successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/affiliate/links
 * List affiliate's tracking links
 */
router.get('/links', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get current affiliate
    const affiliates = await affiliateService.listAffiliates({}, 1, 0);
    const affiliate = affiliates.find(a => a.userId === req.user!.id);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate profile not found'
      });
    }

    const links = await affiliateService.listTrackingLinks(affiliate.id);

    res.json({
      success: true,
      data: links,
      count: links.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/affiliate/links/:linkId/disable
 * Disable tracking link
 */
router.put('/links/:linkId/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const linkId = routeParam(req.params.linkId);

    await affiliateService.disableTrackingLink(linkId);

    res.json({
      success: true,
      message: 'Tracking link disabled'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/affiliate/track-click
 * Track click on affiliate link (public endpoint)
 */
router.post('/track-click', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    const clientIp = req.ip || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Tracking code required'
      });
    }

    // Get tracking link
    const link = await affiliateService.getTrackingLink(code);

    if (!link) {
      return res.status(404).json({
        success: false,
        message: 'Invalid tracking link'
      });
    }

    // Record click
    await affiliateService.recordLinkClick(code, clientIp, userAgent);

    // Get affiliate profile
    const affiliate = await affiliateService.getAffiliateProfile(link.affiliateId);

    res.json({
      success: true,
      redirect: link.url,
      affiliate: {
        id: affiliate.id,
        tier: affiliate.tier
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// COMMISSIONS ENDPOINTS
// ============================================

/**
 * GET /api/v1/affiliate/commissions
 * Get affiliate's commissions
 */
router.get('/commissions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = queryParam(req.query.status);
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

    // Get current affiliate
    const affiliates = await affiliateService.listAffiliates({}, 1, 0);
    const affiliate = affiliates.find(a => a.userId === req.user!.id);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate profile not found'
      });
    }

    const commissions = await affiliateService.getAffiliateCommissions(
      affiliate.id,
      status as string | undefined,
      limit
    );

    res.json({
      success: true,
      data: commissions,
      count: commissions.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/affiliate/record-commission
 * Record new commission (admin endpoint)
 */
router.post('/record-commission', validateInput({
  affiliateId: 'uuid',
  type: 'string',
  amount: 'number',
  serviceType: 'string?',
  clientId: 'uuid?',
  referralSource: 'string?'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Only admins can record commissions
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const { affiliateId, type, amount, serviceType, clientId, referralSource } = req.body;

    const commission = await affiliateService.recordCommission(
      affiliateId,
      type as any,
      amount,
      {
        serviceType,
        clientId,
        referralSource
      }
    );

    res.status(201).json({
      success: true,
      data: commission,
      message: 'Commission recorded successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// STATS ENDPOINTS
// ============================================

/**
 * GET /api/v1/affiliate/stats
 * Get affiliate performance statistics
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get current affiliate
    const affiliates = await affiliateService.listAffiliates({}, 1, 0);
    const affiliate = affiliates.find(a => a.userId === req.user!.id);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate profile not found'
      });
    }

    const stats = await affiliateService.getAffiliateStats(affiliate.id);
    const summary = await affiliateService.getAffiliateSummary(affiliate.id);

    res.json({
      success: true,
      data: {
        ...stats,
        ...summary
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/affiliate/analytics
 * Get platform-wide affiliate analytics (admin)
 */
router.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const analytics = await affiliateService.getPlatformAffiliateAnalytics();

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PAYOUTS ENDPOINTS
// ============================================

/**
 * POST /api/v1/affiliate/payouts
 * Request payout
 */
router.post('/payouts', validateInput({
  minimumThreshold: 'number?'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const minimumThreshold = req.body.minimumThreshold || 100;

    // Get current affiliate
    const affiliates = await affiliateService.listAffiliates({}, 1, 0);
    const affiliate = affiliates.find(a => a.userId === req.user!.id);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate profile not found'
      });
    }

    const payout = await affiliateService.createPayout(affiliate.id, minimumThreshold);

    if (!payout) {
      return res.status(400).json({
        success: false,
        message: `Minimum payout threshold of $${minimumThreshold} not met`
      });
    }

    res.status(201).json({
      success: true,
      data: payout,
      message: 'Payout request submitted'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/affiliate/payouts
 * Get payout history
 */
router.get('/payouts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);

    // Get current affiliate
    const affiliates = await affiliateService.listAffiliates({}, 1, 0);
    const affiliate = affiliates.find(a => a.userId === req.user!.id);

    if (!affiliate) {
      return res.status(404).json({
        success: false,
        message: 'Affiliate profile not found'
      });
    }

    const [payouts, summary] = await Promise.all([
      affiliateService.getPayoutHistory(affiliate.id, limit),
      affiliateService.getAffiliateSummary(affiliate.id)
    ]);

    res.json({
      success: true,
      data: {
        payouts,
        pending: summary.pendingPayout
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/affiliate/process-payouts
 * Process pending payouts (admin/cron)
 */
router.post('/process-payouts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify admin or cron secret
    const cronSecret = req.headers['x-cron-secret'];

    if (req.user!.role !== 'admin' && cronSecret !== process.env.CRON_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const processed = await affiliateService.processPendingPayouts();

    res.json({
      success: true,
      data: {
        processedCount: processed.length,
        payouts: processed
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MARKETING MATERIALS ENDPOINTS
// ============================================

/**
 * GET /api/v1/affiliate/marketing-materials
 * Get marketing materials
 */
router.get('/marketing-materials', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = queryParam(req.query.type);

    // Get current affiliate
    const affiliates = await affiliateService.listAffiliates({}, 1, 0);
    const affiliate = affiliates.find(a => a.userId === req.user!.id);

    const materials = await affiliateService.getMarketingMaterials(
      type as string | undefined,
      affiliate?.id
    );

    res.json({
      success: true,
      data: materials,
      count: materials.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/affiliate/marketing-materials
 * Create marketing material (admin)
 */
router.post('/marketing-materials', validateInput({
  type: 'string',
  title: 'string',
  content: 'string',
  downloadUrl: 'string?'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const { type, title, content, downloadUrl } = req.body;

    const material = await affiliateService.createMarketingMaterial(
      type as any,
      title,
      content,
      undefined,
      downloadUrl
    );

    res.status(201).json({
      success: true,
      data: material,
      message: 'Marketing material created'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// FRAUD DETECTION ENDPOINTS
// ============================================

/**
 * GET /api/v1/affiliate/fraud-analysis/:affiliateId
 * Analyze affiliate for fraud (admin)
 */
router.get('/fraud-analysis/:affiliateId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const affiliateId = routeParam(req.params.affiliateId);

    const indicators = await affiliateService.analyzeClickPatterns(affiliateId);

    res.json({
      success: true,
      data: {
        indicators,
        count: indicators.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/affiliate/fraud-resolution
 * Resolve fraud flag (admin)
 */
router.post('/fraud-resolution', validateInput({
  affiliateId: 'uuid',
  indicatorType: 'string',
  approved: 'boolean'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const { affiliateId, indicatorType, approved } = req.body;

    await affiliateService.resolveFraudFlag(affiliateId, indicatorType, approved);

    res.json({
      success: true,
      message: approved ? 'Affiliate approved' : 'Fraud flag maintained'
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * GET /api/v1/affiliate/admin/list
 * List all affiliates (admin)
 */
router.get('/admin/list', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const status = queryParam(req.query.status); const tier = queryParam(req.query.tier); const minFraud = queryParam(req.query.minFraud);
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const affiliates = await affiliateService.listAffiliates(
      {
        status: status as string | undefined,
        tier: tier as string | undefined,
        minFraudScore: minFraud ? parseInt(minFraud as string) : undefined
      },
      limit,
      offset
    );

    res.json({
      success: true,
      data: affiliates,
      count: affiliates.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/affiliate/admin/approve
 * Approve affiliate (admin)
 */
router.post('/admin/approve', validateInput({
  affiliateId: 'uuid',
  tier: 'string',
  commissionRate: 'number'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const { affiliateId, tier, commissionRate } = req.body;

    const approved = await affiliateService.approveAffiliate(affiliateId, tier, commissionRate);

    res.json({
      success: true,
      data: approved,
      message: 'Affiliate approved successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/affiliate/admin/suspend
 * Suspend affiliate (admin)
 */
router.post('/admin/suspend', validateInput({
  affiliateId: 'uuid',
  reason: 'string'
}), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const { affiliateId, reason } = req.body;

    await affiliateService.suspendAffiliate(affiliateId, reason);

    res.json({
      success: true,
      message: 'Affiliate suspended'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
