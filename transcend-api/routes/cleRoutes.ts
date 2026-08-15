// CLE Tracking API Routes
// Endpoints for managing CLE credits, compliance, and deadlines

import express from 'express';
import {
  recordCLECredit,
  getCLECredits,
  getCLECompliance,
  updateCLEComplianceStatus,
  createOrUpdateCLEDeadline,
  generateComplianceReport,
  exportForBarApplication,
  STATE_CLE_REQUIREMENTS,
  registerCLEProvider,
  getCLEProvider,
} from '../services/cleService';
import { authenticateToken, authorize } from '../middleware/auth';

const router = express.Router();

// ============================================
// CLE CREDIT ENDPOINTS
// ============================================

/**
 * POST /api/v2/cle/:attorneyId/credit
 * Record a new CLE credit for an attorney
 * Required roles: attorney (own credits), admin
 */
router.post(
  '/:attorneyId/credit',
  authenticateToken,
  authorize(['attorney', 'admin']),
  async (req, res) => {
    try {
      const { attorneyId } = req.params;
      const {
        courseName,
        courseDescription,
        creditType,
        hoursEarned,
        state,
        providerId,
        certificateUrl,
        completionDate,
      } = req.body;

      // Validate authorization
      if (req.user.role === 'attorney' && req.user.id !== attorneyId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Validate required fields
      if (!courseName || !creditType || !hoursEarned || !state || !providerId) {
        return res.status(400).json({
          error: 'Missing required fields: courseName, creditType, hoursEarned, state, providerId',
        });
      }

      const credit = await recordCLECredit(
        attorneyId,
        providerId,
        courseName,
        courseDescription,
        creditType,
        hoursEarned,
        state,
        new Date(completionDate),
        certificateUrl
      );

      res.status(201).json({
        success: true,
        message: 'CLE credit recorded successfully',
        data: credit,
      });
    } catch (error) {
      console.error('Error recording CLE credit:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to record CLE credit',
      });
    }
  }
);

/**
 * GET /api/v2/cle/:attorneyId
 * Get CLE data for an attorney (credits, compliance, deadline)
 */
router.get('/:attorneyId', authenticateToken, async (req, res) => {
  try {
    const { attorneyId } = req.params;
    const { state = 'CA', year = new Date().getFullYear() } = req.query;

    // Validate authorization
    if (req.user.role === 'attorney' && req.user.id !== attorneyId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const credits = await getCLECredits(attorneyId, state as string, parseInt(year as string));
    const compliance = await getCLECompliance(
      attorneyId,
      state as string,
      parseInt(year as string)
    );

    res.json({
      success: true,
      data: {
        credits,
        compliance,
        state,
        year,
      },
    });
  } catch (error) {
    console.error('Error fetching CLE data:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch CLE data',
    });
  }
});

/**
 * GET /api/v2/cle/:attorneyId/credits
 * Get all CLE credits for an attorney (with optional filtering)
 */
router.get('/:attorneyId/credits', authenticateToken, async (req, res) => {
  try {
    const { attorneyId } = req.params;
    const { state, year } = req.query;

    // Validate authorization
    if (req.user.role === 'attorney' && req.user.id !== attorneyId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const credits = await getCLECredits(
      attorneyId,
      state as string | undefined,
      year ? parseInt(year as string) : undefined
    );

    res.json({
      success: true,
      count: credits.length,
      data: credits,
    });
  } catch (error) {
    console.error('Error fetching CLE credits:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch credits',
    });
  }
});

// ============================================
// COMPLIANCE ENDPOINTS
// ============================================

/**
 * GET /api/v2/cle/:attorneyId/compliance
 * Get compliance status for a specific state/year
 */
router.get('/:attorneyId/compliance', authenticateToken, async (req, res) => {
  try {
    const { attorneyId } = req.params;
    const { state = 'CA', year = new Date().getFullYear() } = req.query;

    // Validate authorization
    if (req.user.role === 'attorney' && req.user.id !== attorneyId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const compliance = await getCLECompliance(
      attorneyId,
      state as string,
      parseInt(year as string)
    );

    if (!compliance) {
      return res.status(404).json({
        error: 'No compliance record found for this period',
      });
    }

    res.json({
      success: true,
      data: compliance,
    });
  } catch (error) {
    console.error('Error fetching compliance:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch compliance',
    });
  }
});

/**
 * POST /api/v2/cle/:attorneyId/compliance/update
 * Manually update compliance status
 * Requires admin role
 */
router.post(
  '/:attorneyId/compliance/update',
  authenticateToken,
  authorize(['admin']),
  async (req, res) => {
    try {
      const { attorneyId } = req.params;
      const { state = 'CA', year = new Date().getFullYear() } = req.body;

      const compliance = await updateCLEComplianceStatus(attorneyId, state, year);

      res.json({
        success: true,
        message: 'Compliance status updated',
        data: compliance,
      });
    } catch (error) {
      console.error('Error updating compliance:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to update compliance',
      });
    }
  }
);

// ============================================
// DEADLINE ENDPOINTS
// ============================================

/**
 * POST /api/v2/cle/:attorneyId/deadline
 * Create or update a CLE deadline
 * Requires admin role
 */
router.post(
  '/:attorneyId/deadline',
  authenticateToken,
  authorize(['admin']),
  async (req, res) => {
    try {
      const { attorneyId } = req.params;
      const { state = 'CA', year } = req.body;

      const deadline = await createOrUpdateCLEDeadline(attorneyId, state, year);

      res.status(201).json({
        success: true,
        message: 'Deadline created/updated successfully',
        data: deadline,
      });
    } catch (error) {
      console.error('Error creating deadline:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create deadline',
      });
    }
  }
);

/**
 * GET /api/v2/cle/states/requirements
 * Get CLE requirements for all supported states
 */
router.get('/states/requirements', (req, res) => {
  try {
    res.json({
      success: true,
      data: STATE_CLE_REQUIREMENTS,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch state requirements',
    });
  }
});

/**
 * GET /api/v2/cle/states/requirements/:state
 * Get CLE requirements for a specific state
 */
router.get('/states/requirements/:state', (req, res) => {
  try {
    const { state } = req.params;
    const requirements = STATE_CLE_REQUIREMENTS[state.toUpperCase()];

    if (!requirements) {
      return res.status(404).json({
        error: `CLE requirements not found for state: ${state}`,
      });
    }

    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch state requirements',
    });
  }
});

// ============================================
// REPORTING & EXPORT ENDPOINTS
// ============================================

/**
 * GET /api/v2/cle/:attorneyId/report
 * Generate compliance report
 */
router.get('/:attorneyId/report', authenticateToken, async (req, res) => {
  try {
    const { attorneyId } = req.params;
    const { state = 'CA', year = new Date().getFullYear() } = req.query;

    // Validate authorization
    if (req.user.role === 'attorney' && req.user.id !== attorneyId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const report = await generateComplianceReport(
      attorneyId,
      state as string,
      parseInt(year as string)
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate report',
    });
  }
});

/**
 * GET /api/v2/cle/:attorneyId/export
 * Export compliance report in various formats
 */
router.get('/:attorneyId/export', authenticateToken, async (req, res) => {
  try {
    const { attorneyId } = req.params;
    const { state = 'CA', year = new Date().getFullYear(), format = 'pdf' } = req.query;

    // Validate authorization
    if (req.user.role === 'attorney' && req.user.id !== attorneyId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Validate format
    if (!['pdf', 'csv', 'json'].includes(format as string)) {
      return res.status(400).json({
        error: 'Invalid format. Supported formats: pdf, csv, json',
      });
    }

    const exportData = await exportForBarApplication(
      attorneyId,
      state as string,
      parseInt(year as string),
      format as 'pdf' | 'csv' | 'json'
    );

    // Set appropriate content type
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      json: 'application/json',
    };

    res.setHeader('Content-Type', contentTypes[format as string] || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cle-report-${state}-${year}.${format}"`
    );

    res.send(exportData);
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to export report',
    });
  }
});

// ============================================
// PROVIDER ENDPOINTS
// ============================================

/**
 * POST /api/v2/cle/providers
 * Register a new CLE provider
 * Requires admin role
 */
router.post(
  '/providers',
  authenticateToken,
  authorize(['admin']),
  async (req, res) => {
    try {
      const {
        providerName,
        providerType,
        statesApproved,
        approvalNumber,
        apiIntegration,
      } = req.body;

      if (!providerName || !providerType) {
        return res.status(400).json({
          error: 'Missing required fields: providerName, providerType',
        });
      }

      const provider = await registerCLEProvider(
        providerName,
        providerType,
        statesApproved || [],
        approvalNumber,
        apiIntegration || false
      );

      res.status(201).json({
        success: true,
        message: 'CLE provider registered successfully',
        data: provider,
      });
    } catch (error) {
      console.error('Error registering provider:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to register provider',
      });
    }
  }
);

/**
 * GET /api/v2/cle/providers/:providerId
 * Get CLE provider details
 */
router.get('/providers/:providerId', authenticateToken, async (req, res) => {
  try {
    const { providerId } = req.params;

    const provider = await getCLEProvider(providerId);

    if (!provider) {
      return res.status(404).json({
        error: 'CLE provider not found',
      });
    }

    res.json({
      success: true,
      data: provider,
    });
  } catch (error) {
    console.error('Error fetching provider:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch provider',
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/v2/cle/health
 * Health check for CLE service
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'CLE Tracking Service',
    timestamp: new Date().toISOString(),
  });
});

export default router;
