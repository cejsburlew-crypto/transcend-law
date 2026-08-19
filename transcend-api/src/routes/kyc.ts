// KYC Verification Routes
// 6-stage progressive verification endpoints

import express, { Request, Response } from 'express';
import { authenticateToken, isAdmin } from '../middleware/auth';
import { kycRateLimit, detectSuspiciousActivity } from '../middleware/kycRateLimit';
import kycService from '../services/kycService';
import { routeParam } from '../utils/httpParams';

const router = express.Router();

// Apply suspicious activity detection to all KYC routes
router.use(detectSuspiciousActivity);

// ============================================
// STAGE 1: EMAIL VERIFICATION
// ============================================

// Initiate email verification (with rate limiting)
router.post('/email/initiate', authenticateToken, kycRateLimit('email'), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const result = await kycService.initiateEmailVerification(req.user?.id as string, email);
    res.json(result);
  } catch (error) {
    console.error('Error initiating email verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate email verification',
    });
  }
});

// Verify email token
router.post('/email/verify/:token', authenticateToken, async (req: Request, res: Response) => {
  try {
    const token = routeParam(req.params.token);

    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    // Only allow user to verify their own email
    const result = await kycService.verifyEmail(token, req.user?.id as string);
    res.json(result);
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify email',
    });
  }
});

// ============================================
// STAGE 2: PHONE VERIFICATION
// ============================================

// Initiate phone verification (with rate limiting)
router.post('/phone/initiate', authenticateToken, kycRateLimit('sms'), async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const result = await kycService.initiatePhoneVerification(
      req.user?.id as string,
      phoneNumber
    );
    res.json(result);
  } catch (error) {
    console.error('Error initiating phone verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate phone verification',
    });
  }
});

// Verify phone OTP
router.post('/phone/verify', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ success: false, message: 'OTP is required' });
    }

    const result = await kycService.verifyPhoneOTP(req.user?.id as string, otp);
    res.json(result);
  } catch (error) {
    console.error('Error verifying phone OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify phone OTP',
    });
  }
});

// ============================================
// STAGE 3: GOVERNMENT ID
// ============================================

// Initiate government ID verification
router.post('/government-id/initiate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { idType, documentUrl } = req.body;

    if (!idType || !documentUrl) {
      return res.status(400).json({
        success: false,
        message: 'ID type and document URL are required',
      });
    }

    if (!['driver_license', 'passport'].includes(idType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID type',
      });
    }

    const result = await kycService.initiateGovernmentIDVerification(
      req.user?.id as string,
      idType,
      documentUrl
    );
    res.json(result);
  } catch (error) {
    console.error('Error initiating government ID verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate government ID verification',
    });
  }
});

// ============================================
// STAGE 4: ADDRESS VERIFICATION
// ============================================

// Initiate address verification
router.post('/address/initiate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { address, documentUrl } = req.body;

    if (!address || !documentUrl) {
      return res.status(400).json({
        success: false,
        message: 'Address and document URL are required',
      });
    }

    const result = await kycService.initiateAddressVerification(
      req.user?.id as string,
      address,
      documentUrl
    );
    res.json(result);
  } catch (error) {
    console.error('Error initiating address verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate address verification',
    });
  }
});

// ============================================
// STAGE 5: BANK ACCOUNT
// ============================================

// Initiate bank account verification
router.post('/bank/initiate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bankAccountToken } = req.body;

    if (!bankAccountToken) {
      return res.status(400).json({
        success: false,
        message: 'Bank account token is required',
      });
    }

    const result = await kycService.initiateBankAccountVerification(
      req.user?.id as string,
      bankAccountToken
    );
    res.json(result);
  } catch (error) {
    console.error('Error initiating bank account verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate bank account verification',
    });
  }
});

// Verify bank account microdeposits
router.post(
  '/bank/verify-microdeposits',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { amounts } = req.body;

      if (!amounts || amounts.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Two microdeposit amounts are required',
        });
      }

      const result = await kycService.verifyBankAccountMicrodeposits(
        req.user?.id as string,
        amounts
      );
      res.json(result);
    } catch (error) {
      console.error('Error verifying bank account:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify bank account',
      });
    }
  }
);

// ============================================
// STAGE 6: VIDEO VERIFICATION
// ============================================

// Initiate video verification
router.post('/video/initiate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await kycService.initiateVideoVerification(req.user?.id as string);
    res.json(result);
  } catch (error) {
    console.error('Error initiating video verification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate video verification',
    });
  }
});

// Complete video verification (admin/agent only)
router.post(
  '/video/complete/:verificationId',
  authenticateToken,
  isAdmin,
  async (req: Request, res: Response) => {
    try {
      const verificationId = routeParam(req.params.verificationId);
      const { userId, agentNotes } = req.body;

      if (!userId || !agentNotes) {
        return res.status(400).json({
          success: false,
          message: 'User ID and agent notes are required',
        });
      }

      const result = await kycService.completeVideoVerification(userId, verificationId, agentNotes);
      res.json(result);
    } catch (error) {
      console.error('Error completing video verification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete video verification',
      });
    }
  }
);

// ============================================
// USER STATUS & PROGRESS
// ============================================

// Get user KYC status
router.get('/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const status = await kycService.getUserKYCStatus(req.user?.id as string);
    res.json(status);
  } catch (error) {
    console.error('Error getting KYC status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get KYC status',
    });
  }
});

// ============================================
// ADMIN ROUTES
// ============================================

// Get admin review queue
router.get('/admin/review-queue', authenticateToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const queue = await kycService.getAdminReviewQueue();
    res.json(queue);
  } catch (error) {
    console.error('Error getting review queue:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get review queue',
    });
  }
});

// Approve verification (admin)
router.post(
  '/admin/approve/:verificationId',
  authenticateToken,
  isAdmin,
  async (req: Request, res: Response) => {
    try {
      const verificationId = routeParam(req.params.verificationId);

      const result = await kycService.approveVerification(
        verificationId,
        req.user?.id as string
      );
      res.json(result);
    } catch (error) {
      console.error('Error approving verification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to approve verification',
      });
    }
  }
);

// Reject verification (admin)
router.post(
  '/admin/reject/:verificationId',
  authenticateToken,
  isAdmin,
  async (req: Request, res: Response) => {
    try {
      const verificationId = routeParam(req.params.verificationId);
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required',
        });
      }

      const result = await kycService.rejectVerification(
        verificationId,
        req.user?.id as string,
        reason
      );
      res.json(result);
    } catch (error) {
      console.error('Error rejecting verification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reject verification',
      });
    }
  }
);

// Get pending video calls (admin)
router.get(
  '/admin/video-calls',
  authenticateToken,
  isAdmin,
  async (req: Request, res: Response) => {
    try {
      const calls = await kycService.getPendingVideoCalls();
      res.json(calls);
    } catch (error) {
      console.error('Error getting pending video calls:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending video calls',
      });
    }
  }
);

// ============================================
// MAINTENANCE
// ============================================

// Cleanup expired verifications (scheduled job)
router.post('/maintenance/cleanup-expired', isAdmin, async (req: Request, res: Response) => {
  try {
    await kycService.cleanupExpiredVerifications();
    res.json({
      success: true,
      message: 'Expired verifications cleaned up',
    });
  } catch (error) {
    console.error('Error cleaning up expired verifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup expired verifications',
    });
  }
});

export default router;
