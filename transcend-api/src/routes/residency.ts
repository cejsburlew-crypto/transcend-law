// Data Residency Routes
// Region selection, compliance reporting, and data transfer management

import express, { Request, Response } from 'express';
import {
  setUserResidency,
  getUserResidency,
  getRegionConfig,
  validateDataAccess,
  blockExternalDataTransfer,
  generateComplianceReport,
  requestDataTransfer,
  approveDataTransfer,
  executeDataTransfer,
  initializeRegionalEncryption,
  rotateEncryptionKeys,
  getResidencyAuditTrail,
  getRegionalDataVolume,
  exportComplianceData,
  REGION_CONFIGS,
  COMPLIANCE_REQUIREMENTS,
  Region,
} from '../services/dataResidencyService';
import { authMiddleware } from '../middleware/authMiddleware';
import { logAuditEvent } from '../services/securityService';

const router = express.Router();

// ============================================
// RESIDENCY SELECTION
// ============================================

/**
 * GET /api/residency/regions
 * Get available regions for user selection
 */
router.get('/regions', (req: Request, res: Response) => {
  try {
    const regions = Object.values(REGION_CONFIGS).map((config) => ({
      region: config.region,
      name: config.name,
      country: config.country,
      compliance: config.compliance,
      regulations: config.regulations,
    }));

    res.json({
      success: true,
      regions,
      message: 'Available regions retrieved successfully',
    });
  } catch (error) {
    console.error('Error retrieving regions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve regions',
    });
  }
});

/**
 * POST /api/residency/select
 * User selects data residency region during signup
 * Body: { region: Region, country: string }
 */
router.post('/select', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { region, country } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!region || !country) {
      return res.status(400).json({
        success: false,
        message: 'Region and country are required',
      });
    }

    // Set user residency
    const residency = await setUserResidency(
      userId,
      region as Region,
      country,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown'
    );

    // Initialize encryption for region
    await initializeRegionalEncryption(userId, region as Region);

    res.json({
      success: true,
      residency,
      message: `Data residency set to ${region}`,
    });
  } catch (error) {
    console.error('Error setting residency:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set residency',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/residency/config
 * Get current user's residency configuration
 */
router.get('/config', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const residency = await getUserResidency(userId);

    if (!residency) {
      return res.status(404).json({
        success: false,
        message: 'User residency configuration not found',
      });
    }

    const regionConfig = getRegionConfig(residency.region);

    res.json({
      success: true,
      residency,
      regionConfig,
    });
  } catch (error) {
    console.error('Error getting residency config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve residency configuration',
    });
  }
});

// ============================================
// COMPLIANCE & REPORTING
// ============================================

/**
 * POST /api/residency/compliance-report
 * Generate compliance report for date range
 * Body: { startDate: string, endDate: string }
 */
router.post('/compliance-report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate and endDate are required',
      });
    }

    const report = await generateComplianceReport(
      userId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      report,
      message: 'Compliance report generated successfully',
    });
  } catch (error) {
    console.error('Error generating compliance report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate compliance report',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/residency/audit-trail
 * Get residency audit trail for current user
 */
router.get('/audit-trail', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const auditTrail = await getResidencyAuditTrail(userId, parseInt(limit as string));

    res.json({
      success: true,
      auditTrail,
      count: auditTrail.length,
    });
  } catch (error) {
    console.error('Error retrieving audit trail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit trail',
    });
  }
});

/**
 * GET /api/residency/export
 * Export compliance data as CSV
 */
router.get('/export', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const residency = await getUserResidency(userId);

    if (!residency) {
      return res.status(404).json({
        success: false,
        message: 'User residency not found',
      });
    }

    const csvBuffer = await exportComplianceData(userId, residency.region);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-export-${userId}.csv"`);
    res.send(csvBuffer);
  } catch (error) {
    console.error('Error exporting compliance data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export compliance data',
    });
  }
});

// ============================================
// DATA TRANSFER & MIGRATION
// ============================================

/**
 * POST /api/residency/transfer-request
 * Request data transfer to different region
 * Body: { toRegion: Region, reason: string }
 */
router.post('/transfer-request', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { toRegion, reason } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!toRegion || !reason) {
      return res.status(400).json({
        success: false,
        message: 'toRegion and reason are required',
      });
    }

    const transferRequest = await requestDataTransfer(
      userId,
      toRegion as Region,
      reason,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown'
    );

    res.json({
      success: true,
      transferRequest,
      message: 'Data transfer request submitted',
    });
  } catch (error) {
    console.error('Error requesting data transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request data transfer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/residency/transfer/approve/:requestId
 * Admin approves data transfer request
 * Requires admin privileges
 */
router.post('/transfer/approve/:requestId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user?.id;

    if (!adminId || req.user?.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required',
      });
    }

    const transfer = await approveDataTransfer(
      requestId,
      adminId,
      req.ip || 'unknown',
      req.get('user-agent') || 'unknown'
    );

    res.json({
      success: true,
      transfer,
      message: 'Data transfer request approved',
    });
  } catch (error) {
    console.error('Error approving transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve transfer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/residency/transfer/execute/:requestId
 * Execute approved data transfer
 * Requires admin privileges
 */
router.post('/transfer/execute/:requestId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user?.id;

    if (!adminId || req.user?.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required',
      });
    }

    await executeDataTransfer(requestId);

    res.json({
      success: true,
      message: 'Data transfer execution started',
      requestId,
    });
  } catch (error) {
    console.error('Error executing transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute transfer',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// ENCRYPTION KEY MANAGEMENT
// ============================================

/**
 * POST /api/residency/rotate-keys
 * Rotate encryption keys (required for compliance)
 */
router.post('/rotate-keys', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const residency = await getUserResidency(userId);

    if (!residency) {
      return res.status(404).json({
        success: false,
        message: 'User residency not found',
      });
    }

    const newKeyId = await rotateEncryptionKeys(userId, residency.region);

    await logAuditEvent({
      userId,
      action: 'encryption_keys_rotated',
      details: {
        region: residency.region,
        newKeyId,
      },
      ip: req.ip || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
    });

    res.json({
      success: true,
      newKeyId,
      message: 'Encryption keys rotated successfully',
    });
  } catch (error) {
    console.error('Error rotating encryption keys:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to rotate encryption keys',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// MONITORING & ANALYTICS
// ============================================

/**
 * GET /api/residency/volume/:region
 * Get data volume for specific region
 * Requires admin privileges
 */
router.get('/volume/:region', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { region } = req.params;

    if (req.user?.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required',
      });
    }

    const volume = await getRegionalDataVolume(region as Region);

    res.json({
      success: true,
      volume,
    });
  } catch (error) {
    console.error('Error retrieving regional volume:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve regional volume',
    });
  }
});

/**
 * GET /api/residency/compliance-frameworks
 * Get compliance framework details
 */
router.get('/compliance-frameworks', (req: Request, res: Response) => {
  try {
    const frameworks = Object.entries(COMPLIANCE_REQUIREMENTS).map(([name, config]) => ({
      name,
      framework: config.framework,
      region: config.region,
      requirements: config.requirements,
      certifications: config.certifications,
      auditFrequency: config.auditFrequency,
      dataRetentionPolicy: config.dataRetentionPolicy,
    }));

    res.json({
      success: true,
      frameworks,
    });
  } catch (error) {
    console.error('Error retrieving compliance frameworks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve compliance frameworks',
    });
  }
});

// ============================================
// MIDDLEWARE FOR CROSS-REGION ACCESS VALIDATION
// ============================================

/**
 * Validate that data access is from correct region
 */
export async function validateRegionalAccess(
  req: Request,
  res: Response,
  next: Function
) {
  try {
    const userId = req.user?.id;
    const requestRegion = req.get('X-Region') || process.env.AWS_REGION || 'us-east-1';

    if (!userId) {
      return next();
    }

    const result = await validateDataAccess(userId, requestRegion, req.ip || 'unknown');

    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        message: result.reason || 'Cross-region access denied',
      });
    }

    next();
  } catch (error) {
    console.error('Error validating regional access:', error);
    next();
  }
}

/**
 * Block external data transfer
 */
export async function checkDataTransferRestrictions(
  req: Request,
  res: Response,
  next: Function
) {
  try {
    const userId = req.user?.id;
    const targetRegion = req.get('X-Target-Region') || 'unknown';
    const dataSize = parseInt(req.get('X-Data-Size') || '0');

    if (!userId || dataSize === 0) {
      return next();
    }

    const result = await blockExternalDataTransfer(
      userId,
      dataSize,
      targetRegion,
      req.ip || 'unknown'
    );

    if (result.blocked) {
      return res.status(403).json({
        success: false,
        message: result.reason || 'External data transfer blocked',
      });
    }

    next();
  } catch (error) {
    console.error('Error checking transfer restrictions:', error);
    next();
  }
}

export default router;
