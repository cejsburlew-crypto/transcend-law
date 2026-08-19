/**
 * Conflict of Interest Checker API Routes
 */

import { Router, Request, Response } from 'express';
import ConflictCheckerService from '../services/conflictChecker';
import { auditLogger } from '../services/auditLogger';
import { authenticate, requireRole } from '../middleware/auth';
import { queryParam, routeParam } from '../src/utils/httpParams';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// ============================================
// CONFLICT CHECK ENDPOINTS
// ============================================

/**
 * Check attorney-client conflict
 * GET /api/conflicts/check/:attorneyId/:clientId
 */
router.get('/check/:attorneyId/:clientId', async (req: Request, res: Response) => {
  try {
    const attorneyId = routeParam(req.params.attorneyId); const clientId = routeParam(req.params.clientId);
    const userId = req.user?.id;

    // Check if match is already blocked
    const conflictDetails = await ConflictCheckerService.getConflictDetails(
      attorneyId,
      clientId
    );

    if (conflictDetails) {
      return res.json(conflictDetails);
    }

    res.status(404).json({ message: 'No conflict found' });
  } catch (error) {
    console.error('Error checking conflict:', error);
    res.status(500).json({ error: 'Failed to check conflict' });
  }
});

/**
 * Perform full conflict check
 * POST /api/conflicts/perform-check
 */
router.post('/perform-check', async (req: Request, res: Response) => {
  try {
    const { attorneyId, clientId } = req.body;
    const userId = req.user?.id;

    if (!attorneyId || !clientId) {
      return res.status(400).json({
        error: 'attorneyId and clientId are required',
      });
    }

    const result = await ConflictCheckerService.checkAttorneyClientMatch(
      attorneyId,
      clientId,
      userId
    );

    res.json(result);
  } catch (error) {
    console.error('Error performing conflict check:', error);
    res.status(500).json({ error: 'Failed to perform conflict check' });
  }
});

/**
 * Check if match is blocked
 * GET /api/conflicts/is-blocked/:attorneyId/:clientId
 */
router.get('/is-blocked/:attorneyId/:clientId', async (req: Request, res: Response) => {
  try {
    const attorneyId = routeParam(req.params.attorneyId); const clientId = routeParam(req.params.clientId);

    const isBlocked = await ConflictCheckerService.isMatchBlocked(attorneyId, clientId);

    res.json({ blocked: isBlocked });
  } catch (error) {
    console.error('Error checking if match is blocked:', error);
    res.status(500).json({ error: 'Failed to check block status' });
  }
});

/**
 * Get conflict summary for attorney
 * GET /api/conflicts/summary/:attorneyId
 */
router.get('/summary/:attorneyId', async (req: Request, res: Response) => {
  try {
    const attorneyId = routeParam(req.params.attorneyId);

    const summary = await ConflictCheckerService.getConflictSummary(attorneyId);

    res.json(summary);
  } catch (error) {
    console.error('Error getting conflict summary:', error);
    res.status(500).json({ error: 'Failed to get conflict summary' });
  }
});

// ============================================
// CONFLICT DATA MANAGEMENT
// ============================================

/**
 * Add opposing counsel
 * POST /api/conflicts/opposing-counsel
 */
router.post(
  '/opposing-counsel',
  requireRole(['admin', 'compliance']),
  async (req: Request, res: Response) => {
    try {
      const opposingCounsel = req.body;

      const id = await ConflictCheckerService.addOpposingCounsel(opposingCounsel);

      res.status(201).json({
        id,
        message: 'Opposing counsel record created',
      });
    } catch (error) {
      console.error('Error adding opposing counsel:', error);
      res.status(500).json({ error: 'Failed to add opposing counsel' });
    }
  }
);

/**
 * Add family connection
 * POST /api/conflicts/family-connection
 */
router.post(
  '/family-connection',
  requireRole(['admin', 'compliance']),
  async (req: Request, res: Response) => {
    try {
      const connection = req.body;

      const id = await ConflictCheckerService.addFamilyConnection(connection);

      res.status(201).json({
        id,
        message: 'Family connection record created',
      });
    } catch (error) {
      console.error('Error adding family connection:', error);
      res.status(500).json({ error: 'Failed to add family connection' });
    }
  }
);

/**
 * Add disqualifying relationship
 * POST /api/conflicts/disqualifying-relationship
 */
router.post(
  '/disqualifying-relationship',
  requireRole(['admin', 'compliance']),
  async (req: Request, res: Response) => {
    try {
      const relationship = req.body;

      const id = await ConflictCheckerService.addDisqualifyingRelationship(relationship);

      res.status(201).json({
        id,
        message: 'Disqualifying relationship record created',
      });
    } catch (error) {
      console.error('Error adding disqualifying relationship:', error);
      res.status(500).json({ error: 'Failed to add disqualifying relationship' });
    }
  }
);

// ============================================
// APPEAL ENDPOINTS
// ============================================

/**
 * Submit conflict appeal
 * POST /api/conflicts/:conflictMatchId/appeal
 */
router.post('/appeal/:conflictMatchId', async (req: Request, res: Response) => {
  try {
    const conflictMatchId = routeParam(req.params.conflictMatchId);
    const { reason, documents, additionalInfo } = req.body;
    const userId = req.user?.id;

    if (!reason) {
      return res.status(400).json({
        error: 'Appeal reason is required',
      });
    }

    const appealId = await ConflictCheckerService.submitConflictAppeal(
      conflictMatchId,
      req.user?.attorneyId || userId,
      reason,
      documents,
      userId
    );

    res.status(201).json({
      appealId,
      message: 'Appeal submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting appeal:', error);
    res.status(500).json({ error: 'Failed to submit appeal' });
  }
});

/**
 * Get pending appeals
 * GET /api/conflicts/appeals/pending
 */
router.get(
  '/appeals/pending',
  requireRole(['admin', 'compliance']),
  async (req: Request, res: Response) => {
    try {
      const appeals = await ConflictCheckerService.getPendingAppeals();

      res.json(appeals);
    } catch (error) {
      console.error('Error getting pending appeals:', error);
      res.status(500).json({ error: 'Failed to get pending appeals' });
    }
  }
);

/**
 * Review conflict appeal
 * POST /api/conflicts/appeals/:appealId/review
 */
router.post(
  '/appeals/:appealId/review',
  requireRole(['admin', 'compliance']),
  async (req: Request, res: Response) => {
    try {
      const appealId = routeParam(req.params.appealId);
      const { decision, rationale } = req.body;
      const userId = req.user?.id;

      if (!decision || !rationale) {
        return res.status(400).json({
          error: 'Decision and rationale are required',
        });
      }

      if (!['approved', 'denied'].includes(decision)) {
        return res.status(400).json({
          error: 'Decision must be approved or denied',
        });
      }

      await ConflictCheckerService.reviewConflictAppeal(
        appealId,
        decision as 'approved' | 'denied',
        rationale,
        userId
      );

      res.json({
        message: `Appeal ${decision} successfully`,
      });
    } catch (error) {
      console.error('Error reviewing appeal:', error);
      res.status(500).json({ error: 'Failed to review appeal' });
    }
  }
);

/**
 * Upload supporting documents for appeal
 * POST /api/conflicts/upload-documents
 */
router.post('/upload-documents', async (req: Request, res: Response) => {
  try {
    // This would integrate with your file upload service
    // For now, returning mock URLs
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No files uploaded',
      });
    }

    // In production, upload files to cloud storage (S3, GCS, etc.)
    // and return the URLs
    const urls = files.map((file) => `/uploads/${file.filename}`);

    res.json({ urls });
  } catch (error) {
    console.error('Error uploading documents:', error);
    res.status(500).json({ error: 'Failed to upload documents' });
  }
});

// ============================================
// ADMIN/COMPLIANCE ENDPOINTS
// ============================================

/**
 * Override conflict block (admin only)
 * POST /api/conflicts/:conflictMatchId/override
 */
router.post(
  '/:conflictMatchId/override',
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const conflictMatchId = routeParam(req.params.conflictMatchId);
      const { reason } = req.body;
      const userId = req.user?.id;

      // Audit log for compliance
      await auditLogger.log({
        userId: userId,
        action: 'conflict_override',
        entityType: 'conflict_match',
        entityId: conflictMatchId,
        status: 'success',
        metadata: {
          reason,
          overriddenAt: new Date(),
        },
      });

      res.json({
        message: 'Conflict block overridden',
      });
    } catch (error) {
      console.error('Error overriding conflict block:', error);
      res.status(500).json({ error: 'Failed to override conflict block' });
    }
  }
);

/**
 * Get all conflict matches (admin)
 * GET /api/conflicts/matches
 */
router.get(
  '/matches',
  requireRole(['admin', 'compliance']),
  async (req: Request, res: Response) => {
    try {
      // This would query the database directly
      // Implementation depends on your database setup
      res.json({
        message: 'Fetch all conflict matches',
        matches: [],
      });
    } catch (error) {
      console.error('Error getting conflict matches:', error);
      res.status(500).json({ error: 'Failed to get conflict matches' });
    }
  }
);

/**
 * Export conflict report
 * GET /api/conflicts/export
 */
router.get(
  '/export',
  requireRole(['admin', 'compliance']),
  async (req: Request, res: Response) => {
    try {
      const format = queryParam(req.query.format); const startDate = queryParam(req.query.startDate); const endDate = queryParam(req.query.endDate);

      // Generate report based on parameters
      res.json({
        message: 'Export report generated',
        format,
        filters: { startDate, endDate },
      });
    } catch (error) {
      console.error('Error exporting conflict report:', error);
      res.status(500).json({ error: 'Failed to export report' });
    }
  }
);

export default router;
