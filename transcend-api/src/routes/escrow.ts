// Escrow Payment Routes
// Handles escrow holding, release, disputes, and reconciliation

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../middleware/adminMiddleware';
import * as escrowService from '../services/escrowService';

const router = Router();

// ============================================
// ESCROW ACCOUNT ENDPOINTS
// ============================================

/**
 * POST /api/v2/escrow/account/initialize
 * Initialize escrow account (admin only)
 */
router.post(
  '/account/initialize',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const account = await escrowService.initializeEscrowAccount();
      return res.status(201).json({
        success: true,
        account,
      });
    } catch (error: any) {
      console.error('Error initializing escrow account:', error);
      return res.status(500).json({
        error: error.message || 'Failed to initialize escrow account',
      });
    }
  }
);

/**
 * GET /api/v2/escrow/account/balance
 * Get escrow account balance
 */
router.get(
  '/account/balance',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const balance = await escrowService.getEscrowAccountBalance();
      return res.json({
        balance,
        currency: 'USD',
      });
    } catch (error: any) {
      console.error('Error getting escrow balance:', error);
      return res.status(500).json({
        error: error.message || 'Failed to get escrow balance',
      });
    }
  }
);

// ============================================
// ESCROW HOLD ENDPOINTS
// ============================================

/**
 * POST /api/v2/escrow/holds
 * Create a new escrow hold
 */
router.post('/holds', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      caseId,
      clientId,
      providerId,
      amount,
      holdPeriodDays = 30,
      feePercentage = 2.5,
      whoPaysFee = 'platform',
    } = req.body;

    // Validate required fields
    if (!caseId || !clientId || !providerId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields: caseId, clientId, providerId, amount',
      });
    }

    // Only authenticated users can create escrow holds
    const escrowHold = await escrowService.createEscrowHold(
      caseId,
      clientId,
      providerId,
      amount,
      holdPeriodDays,
      feePercentage,
      whoPaysFee
    );

    return res.status(201).json({
      success: true,
      escrowHold,
      clientSecret: escrowHold.paymentIntentId,
    });
  } catch (error: any) {
    console.error('Error creating escrow hold:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create escrow hold',
    });
  }
});

/**
 * GET /api/v2/escrow/holds/:id
 * Get escrow hold details
 */
router.get('/holds/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const escrowHold = await escrowService.getEscrowHold(req.params.id);

    if (!escrowHold) {
      return res.status(404).json({
        error: 'Escrow hold not found',
      });
    }

    return res.json({
      escrowHold,
    });
  } catch (error: any) {
    console.error('Error getting escrow hold:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get escrow hold',
    });
  }
});

/**
 * GET /api/v2/escrow/case/:caseId
 * Get escrow holds for a case
 */
router.get('/case/:caseId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const escrowHolds = await escrowService.getEscrowHoldsByCase(req.params.caseId);
    const disputes = [];

    // Get disputes for all holds
    for (const hold of escrowHolds) {
      const dispute = await escrowService.getDispute(hold.id);
      if (dispute) disputes.push(dispute);
    }

    return res.json({
      escrowHold: escrowHolds.length > 0 ? escrowHolds[0] : null,
      escrowHolds,
      disputes,
    });
  } catch (error: any) {
    console.error('Error getting case escrow holds:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get escrow holds',
    });
  }
});

/**
 * GET /api/v2/escrow/user/:userId
 * Get escrow holds for a user (as client or provider)
 */
router.get('/user/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { type = 'client' } = req.query;
    const userType = (type === 'provider' ? 'provider' : 'client') as 'client' | 'provider';

    const escrowHolds = await escrowService.getEscrowHoldsByUser(req.params.userId, userType);

    return res.json({
      escrowHolds,
      count: escrowHolds.length,
    });
  } catch (error: any) {
    console.error('Error getting user escrow holds:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get escrow holds',
    });
  }
});

// ============================================
// ESCROW RELEASE ENDPOINTS
// ============================================

/**
 * POST /api/v2/escrow/:id/approve
 * Approve escrow release
 */
router.post('/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const escrowHoldId = req.params.id;

    if (!userId) {
      return res.status(400).json({
        error: 'User ID required',
      });
    }

    await escrowService.approveEscrowRelease(escrowHoldId, userId);

    return res.json({
      success: true,
      message: 'Escrow release approved',
    });
  } catch (error: any) {
    console.error('Error approving escrow release:', error);
    return res.status(500).json({
      error: error.message || 'Failed to approve escrow release',
    });
  }
});

/**
 * POST /api/v2/escrow/:id/release
 * Release escrow funds (admin only)
 */
router.post(
  '/:id/release',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      const escrowHoldId = req.params.id;
      const releasedBy = req.userId;

      if (!reason) {
        return res.status(400).json({
          error: 'Release reason required',
        });
      }

      const escrowHold = await escrowService.releaseEscrowFunds(
        escrowHoldId,
        reason,
        releasedBy
      );

      return res.json({
        success: true,
        message: 'Escrow funds released',
        escrowHold,
      });
    } catch (error: any) {
      console.error('Error releasing escrow funds:', error);
      return res.status(500).json({
        error: error.message || 'Failed to release escrow funds',
      });
    }
  }
);

/**
 * POST /api/v2/escrow/process-auto-releases
 * Process automatic escrow releases (scheduled job)
 */
router.post(
  '/process-auto-releases',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const count = await escrowService.processAutomaticEscrowReleases();

      return res.json({
        success: true,
        message: `Processed ${count} automatic escrow releases`,
        count,
      });
    } catch (error: any) {
      console.error('Error processing automatic releases:', error);
      return res.status(500).json({
        error: error.message || 'Failed to process automatic releases',
      });
    }
  }
);

// ============================================
// ESCROW REFUND ENDPOINTS
// ============================================

/**
 * POST /api/v2/escrow/:id/refund
 * Refund escrow hold (admin only)
 */
router.post(
  '/:id/refund',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { reason } = req.body;
      const escrowHoldId = req.params.id;
      const refundedBy = req.userId;

      if (!reason) {
        return res.status(400).json({
          error: 'Refund reason required',
        });
      }

      const escrowHold = await escrowService.refundEscrowHold(
        escrowHoldId,
        reason,
        refundedBy
      );

      return res.json({
        success: true,
        message: 'Escrow hold refunded',
        escrowHold,
      });
    } catch (error: any) {
      console.error('Error refunding escrow hold:', error);
      return res.status(500).json({
        error: error.message || 'Failed to refund escrow hold',
      });
    }
  }
);

// ============================================
// DISPUTE ENDPOINTS
// ============================================

/**
 * POST /api/v2/escrow/:id/dispute
 * Open a dispute on escrow hold
 */
router.post('/:id/dispute', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { reason, initiatedBy } = req.body;
    const escrowHoldId = req.params.id;

    if (!reason || !initiatedBy) {
      return res.status(400).json({
        error: 'Reason and initiatedBy required',
      });
    }

    const dispute = await escrowService.openDispute(escrowHoldId, initiatedBy, reason);

    return res.status(201).json({
      success: true,
      dispute,
    });
  } catch (error: any) {
    console.error('Error opening dispute:', error);
    return res.status(500).json({
      error: error.message || 'Failed to open dispute',
    });
  }
});

/**
 * GET /api/v2/escrow/dispute/:disputeId
 * Get dispute details
 */
router.get('/dispute/:disputeId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const dispute = await escrowService.getDispute(req.params.disputeId);

    if (!dispute) {
      return res.status(404).json({
        error: 'Dispute not found',
      });
    }

    return res.json({
      dispute,
    });
  } catch (error: any) {
    console.error('Error getting dispute:', error);
    return res.status(500).json({
      error: error.message || 'Failed to get dispute',
    });
  }
});

/**
 * POST /api/v2/escrow/dispute/:disputeId/resolve
 * Resolve a dispute (admin only)
 */
router.post(
  '/dispute/:disputeId/resolve',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { resolution, resolution_action } = req.body;
      const disputeId = req.params.disputeId;
      const resolvedBy = req.userId;

      if (!resolution || !resolution_action) {
        return res.status(400).json({
          error: 'Resolution and resolution_action required',
        });
      }

      if (!['release', 'refund'].includes(resolution_action)) {
        return res.status(400).json({
          error: 'Invalid resolution_action. Must be "release" or "refund"',
        });
      }

      const dispute = await escrowService.resolveDispute(
        disputeId,
        resolution,
        resolution_action as 'release' | 'refund',
        resolvedBy
      );

      return res.json({
        success: true,
        message: 'Dispute resolved',
        dispute,
      });
    } catch (error: any) {
      console.error('Error resolving dispute:', error);
      return res.status(500).json({
        error: error.message || 'Failed to resolve dispute',
      });
    }
  }
);

// ============================================
// RECONCILIATION ENDPOINTS
// ============================================

/**
 * POST /api/v2/escrow/reconcile
 * Reconcile escrow accounts (admin only)
 */
router.post(
  '/reconcile',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const reconciliation = await escrowService.reconcileEscrowAccounts();

      return res.json({
        success: true,
        reconciliation,
      });
    } catch (error: any) {
      console.error('Error reconciling escrow accounts:', error);
      return res.status(500).json({
        error: error.message || 'Failed to reconcile escrow accounts',
      });
    }
  }
);

/**
 * GET /api/v2/escrow/reconciliations
 * Get reconciliation history (admin only)
 */
router.get(
  '/reconciliations',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { days = 30 } = req.query;
      const reconciliations = await escrowService.getReconciliationHistory(
        parseInt(days as string) || 30
      );

      return res.json({
        reconciliations,
        count: reconciliations.length,
      });
    } catch (error: any) {
      console.error('Error getting reconciliation history:', error);
      return res.status(500).json({
        error: error.message || 'Failed to get reconciliation history',
      });
    }
  }
);

// ============================================
// STATISTICS ENDPOINTS
// ============================================

/**
 * GET /api/v2/escrow/stats
 * Get escrow statistics (admin only)
 */
router.get(
  '/stats',
  authMiddleware,
  adminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const balance = await escrowService.getEscrowAccountBalance();
      const reconciliations = await escrowService.getReconciliationHistory(30);

      const totalHeld = reconciliations.reduce((sum, r) => sum + r.totalHeld, 0);
      const totalReleased = reconciliations.reduce((sum, r) => sum + r.totalReleased, 0);
      const totalRefunded = reconciliations.reduce((sum, r) => sum + r.totalRefunded, 0);
      const totalDisputed = reconciliations.reduce((sum, r) => sum + r.totalDisputed, 0);
      const platformFees = reconciliations.reduce((sum, r) => sum + r.platformFeeCollected, 0);

      return res.json({
        escrowStats: {
          currentBalance: balance,
          totalHeld,
          totalReleased,
          totalRefunded,
          totalDisputed,
          platformFeeCollected: platformFees,
          period: '30 days',
        },
      });
    } catch (error: any) {
      console.error('Error getting escrow statistics:', error);
      return res.status(500).json({
        error: error.message || 'Failed to get escrow statistics',
      });
    }
  }
);

export default router;
