// Deprecation Management API Routes
// Endpoints for managing deprecations, migrations, and legacy API versions

import { Router, Request, Response } from 'express';
import {
  announceFeatureDeprecation,
  updateDeprecationStatus,
  getDeprecatedFeatures,
  getUpcomingRemovals,
  createMigrationRecord,
  updateMigrationProgress,
  getUserMigrationProgress,
  registerLegacyAPIVersion,
  getLegacyAPIVersion,
  transformLegacyRequest,
  deactivateLegacyAPIVersion,
  issueDeprecationWarning,
  acknowledgeDeprecationWarning,
  getUnacknowledgedWarnings,
  autoDisableDeprecatedFeatures,
  autoRemoveEOLFeatures,
  isFeatureDeprecated,
  isFeatureDisabled,
  getMigrationGuide,
  generateDeprecationReport,
  getDeprecationStats,
} from '../services/deprecationService';
import { logAction } from '../services/auditLogger';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();

// ============================================
// FEATURE DEPRECATION ENDPOINTS
// ============================================

/**
 * POST /api/admin/deprecations
 * Announce a new feature deprecation
 */
router.post('/admin/deprecations', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      featureName,
      featurePath,
      replacementFeature,
      replacementPath,
      description,
      severity = 'medium',
      migrationGuideUrl,
      breakingChanges,
      affectedServices,
    } = req.body;

    // Validate required fields
    if (!featureName || !replacementFeature || !description) {
      return res.status(400).json({
        error: 'Missing required fields: featureName, replacementFeature, description',
      });
    }

    const deprecation = await announceFeatureDeprecation(
      featureName,
      featurePath,
      replacementFeature,
      replacementPath,
      description,
      severity,
      migrationGuideUrl,
      breakingChanges,
      affectedServices,
      req.user.id
    );

    res.status(201).json(deprecation);
  } catch (error) {
    console.error('Error announcing deprecation:', error);
    res.status(500).json({ error: 'Failed to announce deprecation' });
  }
});

/**
 * GET /api/admin/deprecations
 * Get all deprecated features with optional filtering
 */
router.get('/admin/deprecations', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, limit = 100 } = req.query;

    const deprecations = await getDeprecatedFeatures(status as any, parseInt(limit as string));

    res.json({
      total: deprecations.length,
      deprecations,
    });
  } catch (error) {
    console.error('Error fetching deprecations:', error);
    res.status(500).json({ error: 'Failed to fetch deprecations' });
  }
});

/**
 * GET /api/admin/deprecations/upcoming
 * Get features scheduled for removal within 30 days
 */
router.get('/admin/deprecations/upcoming', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const upcoming = await getUpcomingRemovals();

    res.json({
      total: upcoming.length,
      features: upcoming.map(f => ({
        featureName: f.featureName,
        status: f.status,
        endOfLifeDate: f.endOfLifeDate,
        severity: f.severity,
      })),
    });
  } catch (error) {
    console.error('Error fetching upcoming removals:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming removals' });
  }
});

/**
 * PATCH /api/admin/deprecations/:featureId
 * Update deprecation status
 */
router.patch('/admin/deprecations/:featureId', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { featureId } = req.params;
    const { status } = req.body;

    if (!status || !['announced', 'active', 'disabled', 'removed'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be one of: announced, active, disabled, removed',
      });
    }

    const deprecation = await updateDeprecationStatus(featureId, status, req.user.id);

    res.json(deprecation);
  } catch (error) {
    console.error('Error updating deprecation status:', error);
    res.status(500).json({ error: 'Failed to update deprecation status' });
  }
});

/**
 * GET /api/admin/deprecations/stats
 * Get deprecation statistics
 */
router.get('/admin/deprecations/stats', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const stats = await getDeprecationStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * POST /api/admin/deprecations/auto-disable
 * Trigger auto-disable of deprecated features
 */
router.post('/admin/deprecations/auto-disable', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await autoDisableDeprecatedFeatures();

    await logAction(req.user.id, 'admin', 'auto_disable', 'deprecation_system', {
      ipAddress: req.ip || '0.0.0.0',
      metadata: { disabled_count: result.disabled },
      dataClassification: 'internal',
    });

    res.json({
      message: `Disabled ${result.disabled} features`,
      ...result,
    });
  } catch (error) {
    console.error('Error auto-disabling features:', error);
    res.status(500).json({ error: 'Failed to auto-disable features' });
  }
});

/**
 * POST /api/admin/deprecations/auto-remove
 * Trigger end-of-life removal
 */
router.post('/admin/deprecations/auto-remove', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await autoRemoveEOLFeatures();

    await logAction(req.user.id, 'admin', 'auto_remove', 'deprecation_system', {
      ipAddress: req.ip || '0.0.0.0',
      metadata: { removed_count: result.removed },
      dataClassification: 'internal',
    });

    res.json({
      message: `Removed ${result.removed} features`,
      ...result,
    });
  } catch (error) {
    console.error('Error removing EOL features:', error);
    res.status(500).json({ error: 'Failed to remove EOL features' });
  }
});

// ============================================
// MIGRATION TRACKING ENDPOINTS
// ============================================

/**
 * POST /api/user/migrations
 * Create a migration record for the current user
 */
router.post('/user/migrations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { fromFeature, toFeature, notes } = req.body;

    if (!fromFeature || !toFeature) {
      return res.status(400).json({
        error: 'Missing required fields: fromFeature, toFeature',
      });
    }

    const migration = await createMigrationRecord(
      req.user.id,
      fromFeature,
      toFeature,
      notes
    );

    res.status(201).json(migration);
  } catch (error) {
    console.error('Error creating migration record:', error);
    res.status(500).json({ error: 'Failed to create migration record' });
  }
});

/**
 * GET /api/user/migrations
 * Get user's migration records
 */
router.get('/user/migrations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { status, limit = 50 } = req.query;

    // In real implementation, query from database with user_id filter
    // This is a placeholder - implement database query in your service

    res.json({
      message: 'User migrations endpoint',
      userId: req.user.id,
      filters: { status, limit },
    });
  } catch (error) {
    console.error('Error fetching migrations:', error);
    res.status(500).json({ error: 'Failed to fetch migrations' });
  }
});

/**
 * PATCH /api/user/migrations/:migrationId
 * Update migration progress
 */
router.patch('/user/migrations/:migrationId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { migrationId } = req.params;
    const { status, failureReason, migrationData } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Missing required field: status' });
    }

    const migration = await updateMigrationProgress(
      migrationId,
      status,
      failureReason,
      migrationData
    );

    res.json(migration);
  } catch (error) {
    console.error('Error updating migration progress:', error);
    res.status(500).json({ error: 'Failed to update migration progress' });
  }
});

/**
 * GET /api/user/migrations/progress
 * Get user's overall migration progress
 */
router.get('/user/migrations/progress', authMiddleware, async (req: Request, res: Response) => {
  try {
    const progress = await getUserMigrationProgress(req.user.id);
    res.json(progress);
  } catch (error) {
    console.error('Error fetching migration progress:', error);
    res.status(500).json({ error: 'Failed to fetch migration progress' });
  }
});

// ============================================
// LEGACY API VERSION ENDPOINTS
// ============================================

/**
 * POST /api/admin/legacy-versions
 * Register a legacy API version
 */
router.post('/admin/legacy-versions', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      version,
      replacementVersion,
      endpointMappings,
      transformationRules,
      supportUrl,
    } = req.body;

    if (!version || !replacementVersion || !endpointMappings) {
      return res.status(400).json({
        error: 'Missing required fields: version, replacementVersion, endpointMappings',
      });
    }

    const legacyVersion = await registerLegacyAPIVersion(
      version,
      replacementVersion,
      endpointMappings,
      transformationRules,
      supportUrl
    );

    res.status(201).json(legacyVersion);
  } catch (error) {
    console.error('Error registering legacy version:', error);
    res.status(500).json({ error: 'Failed to register legacy version' });
  }
});

/**
 * GET /api/admin/legacy-versions/:version
 * Get legacy API version details
 */
router.get('/admin/legacy-versions/:version', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { version } = req.params;

    const legacyVersion = await getLegacyAPIVersion(version);

    if (!legacyVersion) {
      return res.status(404).json({ error: 'Legacy API version not found' });
    }

    res.json(legacyVersion);
  } catch (error) {
    console.error('Error fetching legacy version:', error);
    res.status(500).json({ error: 'Failed to fetch legacy version' });
  }
});

/**
 * POST /api/admin/legacy-versions/:version/deactivate
 * Deactivate a legacy API version (end of support)
 */
router.post('/admin/legacy-versions/:version/deactivate', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { version } = req.params;

    await deactivateLegacyAPIVersion(version, req.user.id);

    await logAction(req.user.id, 'admin', 'api_version_deactivation', version, {
      ipAddress: req.ip || '0.0.0.0',
      metadata: { deactivated_version: version },
      dataClassification: 'internal',
    });

    res.json({ message: `Legacy API version ${version} deactivated` });
  } catch (error) {
    console.error('Error deactivating legacy version:', error);
    res.status(500).json({ error: 'Failed to deactivate legacy version' });
  }
});

// ============================================
// DEPRECATION WARNINGS ENDPOINTS
// ============================================

/**
 * GET /api/user/warnings
 * Get unacknowledged deprecation warnings for user
 */
router.get('/user/warnings', authMiddleware, async (req: Request, res: Response) => {
  try {
    const warnings = await getUnacknowledgedWarnings(req.user.id);

    res.json({
      total: warnings.length,
      warnings,
    });
  } catch (error) {
    console.error('Error fetching warnings:', error);
    res.status(500).json({ error: 'Failed to fetch warnings' });
  }
});

/**
 * POST /api/user/warnings/:warningId/acknowledge
 * Acknowledge a deprecation warning
 */
router.post('/user/warnings/:warningId/acknowledge', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { warningId } = req.params;

    await acknowledgeDeprecationWarning(warningId);

    res.json({ message: 'Warning acknowledged' });
  } catch (error) {
    console.error('Error acknowledging warning:', error);
    res.status(500).json({ error: 'Failed to acknowledge warning' });
  }
});

// ============================================
// MIGRATION GUIDE ENDPOINTS
// ============================================

/**
 * GET /api/public/deprecations/:featureName/guide
 * Get migration guide for a feature (public endpoint)
 */
router.get('/public/deprecations/:featureName/guide', async (req: Request, res: Response) => {
  try {
    const { featureName } = req.params;

    const guide = await getMigrationGuide(featureName);

    if (!guide) {
      return res.status(404).json({ error: 'Migration guide not found' });
    }

    res.json(guide);
  } catch (error) {
    console.error('Error fetching migration guide:', error);
    res.status(500).json({ error: 'Failed to fetch migration guide' });
  }
});

/**
 * GET /api/public/deprecations/:featureName/status
 * Get deprecation status for a feature (public endpoint)
 */
router.get('/public/deprecations/:featureName/status', async (req: Request, res: Response) => {
  try {
    const { featureName } = req.params;

    const deprecated = await isFeatureDeprecated(featureName);
    const disabled = await isFeatureDisabled(featureName);

    res.json({
      featureName,
      isDeprecated: deprecated,
      isDisabled: disabled,
    });
  } catch (error) {
    console.error('Error fetching deprecation status:', error);
    res.status(500).json({ error: 'Failed to fetch deprecation status' });
  }
});

// ============================================
// REPORTING ENDPOINTS
// ============================================

/**
 * GET /api/admin/deprecations/reports/overview
 * Get comprehensive deprecation report
 */
router.get('/admin/deprecations/reports/overview', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const report = await generateDeprecationReport(req.user.id);

    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ============================================
// LEGACY API MIDDLEWARE
// ============================================

/**
 * Middleware to handle legacy API requests
 * Transforms old requests to new format and forwards them
 */
export async function legacyAPIMiddleware(req: Request, res: Response, next: Function) {
  try {
    const apiVersion = req.headers['x-api-version'] as string;

    if (!apiVersion) {
      return next(); // Not a legacy API request
    }

    const { newEndpoint, transformedData } = await transformLegacyRequest(
      apiVersion,
      req.path,
      req.body
    );

    // Update request to use new endpoint and transformed data
    req.url = newEndpoint;
    req.body = transformedData;
    req.headers['x-legacy-transformed'] = 'true';
    req.headers['x-legacy-version'] = apiVersion;

    next();
  } catch (error) {
    console.error('Error transforming legacy request:', error);
    res.status(400).json({ error: 'Failed to transform legacy API request' });
  }
}

// ============================================
// ERROR HANDLING
// ============================================

router.use((error: any, req: Request, res: Response, next: Function) => {
  console.error('Deprecation route error:', error);

  if (error.message.includes('not found')) {
    return res.status(404).json({ error: error.message });
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});

export default router;
