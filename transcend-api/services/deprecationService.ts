// Comprehensive Deprecation & Migration Management Service
// Features: Timeline tracking, auto-disable, migration guides, legacy version support, end-of-life removal
// Ensures smooth transitions with 6-month advance notice and comprehensive tracking

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export type DeprecationStatus = 'announced' | 'active' | 'disabled' | 'removed';
export type DeprecationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface DeprecatedFeature {
  id: string;
  featureName: string;
  featurePath: string;
  status: DeprecationStatus;
  severity: DeprecationSeverity;
  announcedDate: Date;
  disabledDate?: Date;
  endOfLifeDate: Date;
  removalDate?: Date;
  replacementFeature?: string;
  replacementPath?: string;
  migrationGuideUrl?: string;
  migrationGuideContent?: string;
  description: string;
  affectedUsers?: number;
  affectedServices?: string[];
  breakingChanges?: string[];
  apiVersions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MigrationRecord {
  id: string;
  userId: string;
  fromFeature: string;
  toFeature: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  migrationData?: Record<string, any>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LegacyAPIVersion {
  id: string;
  version: string;
  deprecationDate: Date;
  endOfLifeDate: Date;
  replacementVersion: string;
  supportUrl?: string;
  isActive: boolean;
  endpointMappings: Record<string, string>; // old endpoint -> new endpoint
  transformationRules?: Record<string, any>;
  createdAt: Date;
}

export interface DeprecationWarning {
  id: string;
  featureId: string;
  userId: string;
  issuedAt: Date;
  acknowledgedAt?: Date;
  severity: DeprecationSeverity;
  message: string;
  migrationUrl?: string;
  daysUntilDisabled?: number;
  daysUntilRemoved?: number;
}

export interface MigrationProgress {
  totalFeatures: number;
  completedMigrations: number;
  inProgressMigrations: number;
  failedMigrations: number;
  skippedMigrations: number;
  percentageComplete: number;
  estimatedCompletionDate: Date;
  blockers: Array<{ feature: string; blocker: string; severity: DeprecationSeverity }>;
}

export interface DeprecationReport {
  id: string;
  reportDate: Date;
  generatedBy: string;
  deprecatedFeatures: DeprecatedFeature[];
  migrationProgress: MigrationProgress;
  upcomingRemovals: Array<{ feature: string; removalDate: Date; daysUntil: number }>;
  recommendations: string[];
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initializeDeprecationTables(): Promise<void> {
  try {
    // Deprecated features table
    await query(`
      CREATE TABLE IF NOT EXISTS deprecated_features (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_name VARCHAR(255) NOT NULL UNIQUE,
        feature_path VARCHAR(500),
        status VARCHAR(50) NOT NULL CHECK (status IN ('announced', 'active', 'disabled', 'removed')),
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        announced_date TIMESTAMP NOT NULL,
        disabled_date TIMESTAMP,
        end_of_life_date TIMESTAMP NOT NULL,
        removal_date TIMESTAMP,
        replacement_feature VARCHAR(255),
        replacement_path VARCHAR(500),
        migration_guide_url TEXT,
        migration_guide_content TEXT,
        description TEXT NOT NULL,
        affected_users INT,
        affected_services TEXT[],
        breaking_changes TEXT[],
        api_versions TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_deprecated_features_status ON deprecated_features(status);
      CREATE INDEX IF NOT EXISTS idx_deprecated_features_end_of_life ON deprecated_features(end_of_life_date);
      CREATE INDEX IF NOT EXISTS idx_deprecated_features_feature_name ON deprecated_features(feature_name);
      CREATE INDEX IF NOT EXISTS idx_deprecated_features_removal_date ON deprecated_features(removal_date);
    `);

    // Migration records table
    await query(`
      CREATE TABLE IF NOT EXISTS migration_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        from_feature VARCHAR(255) NOT NULL,
        to_feature VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed', 'failed', 'skipped')),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        failure_reason TEXT,
        migration_data JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_migration_records_user_id ON migration_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_migration_records_from_feature ON migration_records(from_feature);
      CREATE INDEX IF NOT EXISTS idx_migration_records_to_feature ON migration_records(to_feature);
      CREATE INDEX IF NOT EXISTS idx_migration_records_status ON migration_records(status);
      CREATE INDEX IF NOT EXISTS idx_migration_records_created_at ON migration_records(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_migration_records_completed_at ON migration_records(completed_at);
    `);

    // Legacy API versions table
    await query(`
      CREATE TABLE IF NOT EXISTS legacy_api_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version VARCHAR(50) NOT NULL UNIQUE,
        deprecation_date TIMESTAMP NOT NULL,
        end_of_life_date TIMESTAMP NOT NULL,
        replacement_version VARCHAR(50) NOT NULL,
        support_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        endpoint_mappings JSONB NOT NULL,
        transformation_rules JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_legacy_api_versions_version ON legacy_api_versions(version);
      CREATE INDEX IF NOT EXISTS idx_legacy_api_versions_is_active ON legacy_api_versions(is_active);
      CREATE INDEX IF NOT EXISTS idx_legacy_api_versions_end_of_life ON legacy_api_versions(end_of_life_date);
    `);

    // Deprecation warnings table
    await query(`
      CREATE TABLE IF NOT EXISTS deprecation_warnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature_id UUID NOT NULL REFERENCES deprecated_features(id),
        user_id UUID NOT NULL,
        issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acknowledged_at TIMESTAMP,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        message TEXT NOT NULL,
        migration_url TEXT,
        days_until_disabled INT,
        days_until_removed INT
      );

      CREATE INDEX IF NOT EXISTS idx_deprecation_warnings_user_id ON deprecation_warnings(user_id);
      CREATE INDEX IF NOT EXISTS idx_deprecation_warnings_feature_id ON deprecation_warnings(feature_id);
      CREATE INDEX IF NOT EXISTS idx_deprecation_warnings_issued_at ON deprecation_warnings(issued_at DESC);
      CREATE INDEX IF NOT EXISTS idx_deprecation_warnings_acknowledged ON deprecation_warnings(acknowledged_at);
    `);

    // Migration history table
    await query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        feature_name VARCHAR(255) NOT NULL,
        migration_type VARCHAR(50) NOT NULL,
        old_data JSONB,
        new_data JSONB,
        migration_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        success BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        rollback_available BOOLEAN DEFAULT TRUE,
        rollback_data JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_migration_history_user_id ON migration_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_migration_history_feature_name ON migration_history(feature_name);
      CREATE INDEX IF NOT EXISTS idx_migration_history_timestamp ON migration_history(migration_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_migration_history_success ON migration_history(success);
    `);

    console.log('Deprecation management tables initialized successfully');
  } catch (error) {
    console.error('Error initializing deprecation tables:', error);
    throw error;
  }
}

// ============================================
// FEATURE DEPRECATION FUNCTIONS
// ============================================

/**
 * Announce a feature deprecation (6 months before disabling)
 */
export async function announceFeatureDeprecation(
  featureName: string,
  featurePath: string,
  replacementFeature: string,
  replacementPath: string,
  description: string,
  severity: DeprecationSeverity = 'medium',
  migrationGuideUrl?: string,
  breakingChanges?: string[],
  affectedServices?: string[],
  adminId?: string
): Promise<DeprecatedFeature> {
  try {
    const announcedDate = new Date();
    const disabledDate = new Date();
    disabledDate.setMonth(disabledDate.getMonth() + 6); // Disable in 6 months
    const endOfLifeDate = new Date(disabledDate);
    endOfLifeDate.setMonth(endOfLifeDate.getMonth() + 3); // Remove 3 months after disable

    const result = await query(
      `INSERT INTO deprecated_features (
        feature_name, feature_path, status, severity, announced_date,
        disabled_date, end_of_life_date, replacement_feature, replacement_path,
        migration_guide_url, description, breaking_changes, affected_services
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        featureName,
        featurePath,
        'announced',
        severity,
        announcedDate,
        disabledDate,
        endOfLifeDate,
        replacementFeature,
        replacementPath,
        migrationGuideUrl,
        description,
        breakingChanges || [],
        affectedServices || [],
      ]
    );

    const feature = parseDeprecatedFeatureRow(result.rows[0]);

    // Log the deprecation announcement
    if (adminId) {
      await logAction(adminId, 'admin', 'feature_deprecation', featureName, {
        ipAddress: '127.0.0.1',
        metadata: {
          reason: 'Feature deprecation announced',
          replacement: replacementFeature,
          timeline: {
            announced: announcedDate,
            disabled: disabledDate,
            removed: endOfLifeDate,
          },
        },
        dataClassification: 'internal',
      });
    }

    return feature;
  } catch (error) {
    console.error('Error announcing feature deprecation:', error);
    throw error;
  }
}

/**
 * Update feature deprecation status
 */
export async function updateDeprecationStatus(
  featureId: string,
  newStatus: DeprecationStatus,
  adminId?: string
): Promise<DeprecatedFeature> {
  try {
    let updateData: Record<string, any> = { updated_at: new Date() };

    if (newStatus === 'disabled') {
      updateData.disabled_date = new Date();
    } else if (newStatus === 'removed') {
      updateData.removal_date = new Date();
    }

    const result = await query(
      `UPDATE deprecated_features
       SET status = $1, ${Object.keys(updateData).map((k, i) => `${k} = $${i + 2}`).join(', ')}
       WHERE id = $3
       RETURNING *`,
      [newStatus, ...Object.values(updateData), featureId]
    );

    if (!result.rows.length) {
      throw new Error('Feature not found');
    }

    const feature = parseDeprecatedFeatureRow(result.rows[0]);

    // Log status change
    if (adminId) {
      await logAction(adminId, 'admin', 'deprecation_status_change', featureId, {
        ipAddress: '127.0.0.1',
        metadata: {
          old_status: feature.status,
          new_status: newStatus,
          feature_name: feature.featureName,
        },
        dataClassification: 'internal',
      });
    }

    return feature;
  } catch (error) {
    console.error('Error updating deprecation status:', error);
    throw error;
  }
}

/**
 * Get deprecated features
 */
export async function getDeprecatedFeatures(
  status?: DeprecationStatus,
  limit: number = 100
): Promise<DeprecatedFeature[]> {
  try {
    let query_str = 'SELECT * FROM deprecated_features';
    const params: any[] = [];

    if (status) {
      query_str += ' WHERE status = $1';
      params.push(status);
    }

    query_str += ' ORDER BY end_of_life_date ASC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(query_str, params);
    return result.rows.map(parseDeprecatedFeatureRow);
  } catch (error) {
    console.error('Error getting deprecated features:', error);
    throw error;
  }
}

/**
 * Get upcoming removals (within 30 days)
 */
export async function getUpcomingRemovals(): Promise<DeprecatedFeature[]> {
  try {
    const now = new Date();
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    const result = await query(
      `SELECT * FROM deprecated_features
       WHERE status = 'active' AND end_of_life_date BETWEEN $1 AND $2
       ORDER BY end_of_life_date ASC`,
      [now, thirtyDaysOut]
    );

    return result.rows.map(parseDeprecatedFeatureRow);
  } catch (error) {
    console.error('Error getting upcoming removals:', error);
    throw error;
  }
}

// ============================================
// MIGRATION TRACKING FUNCTIONS
// ============================================

/**
 * Create migration record for user
 */
export async function createMigrationRecord(
  userId: string,
  fromFeature: string,
  toFeature: string,
  notes?: string
): Promise<MigrationRecord> {
  try {
    const result = await query(
      `INSERT INTO migration_records (
        user_id, from_feature, to_feature, status, notes
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [userId, fromFeature, toFeature, 'not_started', notes]
    );

    return parseMigrationRecord(result.rows[0]);
  } catch (error) {
    console.error('Error creating migration record:', error);
    throw error;
  }
}

/**
 * Update migration progress
 */
export async function updateMigrationProgress(
  migrationId: string,
  status: 'in_progress' | 'completed' | 'failed' | 'skipped',
  failureReason?: string,
  migrationData?: Record<string, any>
): Promise<MigrationRecord> {
  try {
    const updateFields = ['status = $1', 'updated_at = $2'];
    const params: any[] = [status, new Date()];
    let paramIndex = 3;

    if (status === 'in_progress') {
      updateFields.push(`started_at = $${paramIndex++}`);
      params.push(new Date());
    } else if (status === 'completed') {
      updateFields.push(`completed_at = $${paramIndex++}`);
      params.push(new Date());
    } else if (status === 'failed' && failureReason) {
      updateFields.push(`failure_reason = $${paramIndex++}`);
      params.push(failureReason);
    }

    if (migrationData) {
      updateFields.push(`migration_data = $${paramIndex++}`);
      params.push(JSON.stringify(migrationData));
    }

    params.push(migrationId);

    const result = await query(
      `UPDATE migration_records
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    return parseMigrationRecord(result.rows[0]);
  } catch (error) {
    console.error('Error updating migration progress:', error);
    throw error;
  }
}

/**
 * Record migration history with rollback capability
 */
export async function recordMigrationHistory(
  userId: string,
  featureName: string,
  migrationType: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  success: boolean = true,
  errorMessage?: string
): Promise<string> {
  try {
    const result = await query(
      `INSERT INTO migration_history (
        user_id, feature_name, migration_type, old_data, new_data,
        success, error_message, rollback_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        userId,
        featureName,
        migrationType,
        JSON.stringify(oldData),
        JSON.stringify(newData),
        success,
        errorMessage,
        JSON.stringify(oldData), // Store original for rollback
      ]
    );

    return result.rows[0].id;
  } catch (error) {
    console.error('Error recording migration history:', error);
    throw error;
  }
}

/**
 * Get user migration progress
 */
export async function getUserMigrationProgress(userId: string): Promise<MigrationProgress> {
  try {
    const result = await query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
       FROM migration_records
       WHERE user_id = $1`,
      [userId]
    );

    const stats = result.rows[0];
    const total = parseInt(stats.total) || 0;
    const completed = parseInt(stats.completed) || 0;
    const percentageComplete = total > 0 ? (completed / total) * 100 : 0;

    // Estimate completion date
    const estimatedDate = new Date();
    if (completed < total) {
      const remainingDays = Math.ceil((total - completed) / 2); // Assume 2 migrations per day
      estimatedDate.setDate(estimatedDate.getDate() + remainingDays);
    }

    return {
      totalFeatures: total,
      completedMigrations: completed,
      inProgressMigrations: parseInt(stats.in_progress) || 0,
      failedMigrations: parseInt(stats.failed) || 0,
      skippedMigrations: parseInt(stats.skipped) || 0,
      percentageComplete,
      estimatedCompletionDate: estimatedDate,
      blockers: [],
    };
  } catch (error) {
    console.error('Error getting user migration progress:', error);
    throw error;
  }
}

// ============================================
// LEGACY API VERSION SUPPORT
// ============================================

/**
 * Register legacy API version
 */
export async function registerLegacyAPIVersion(
  version: string,
  replacementVersion: string,
  endpointMappings: Record<string, string>,
  transformationRules?: Record<string, any>,
  supportUrl?: string
): Promise<LegacyAPIVersion> {
  try {
    const deprecationDate = new Date();
    const endOfLifeDate = new Date();
    endOfLifeDate.setMonth(endOfLifeDate.getMonth() + 12); // 1 year support

    const result = await query(
      `INSERT INTO legacy_api_versions (
        version, deprecation_date, end_of_life_date, replacement_version,
        endpoint_mappings, transformation_rules, support_url, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        version,
        deprecationDate,
        endOfLifeDate,
        replacementVersion,
        JSON.stringify(endpointMappings),
        transformationRules ? JSON.stringify(transformationRules) : null,
        supportUrl,
        true,
      ]
    );

    return parseLegacyAPIVersion(result.rows[0]);
  } catch (error) {
    console.error('Error registering legacy API version:', error);
    throw error;
  }
}

/**
 * Get legacy API version
 */
export async function getLegacyAPIVersion(version: string): Promise<LegacyAPIVersion | null> {
  try {
    const result = await query(
      `SELECT * FROM legacy_api_versions WHERE version = $1`,
      [version]
    );

    return result.rows.length ? parseLegacyAPIVersion(result.rows[0]) : null;
  } catch (error) {
    console.error('Error getting legacy API version:', error);
    throw error;
  }
}

/**
 * Transform legacy API request to new version
 */
export async function transformLegacyRequest(
  apiVersion: string,
  endpoint: string,
  requestData: Record<string, any>
): Promise<{ newEndpoint: string; transformedData: Record<string, any> }> {
  try {
    const legacyVersion = await getLegacyAPIVersion(apiVersion);

    if (!legacyVersion) {
      throw new Error(`API version ${apiVersion} not found`);
    }

    const newEndpoint = legacyVersion.endpointMappings[endpoint] || endpoint;
    let transformedData = requestData;

    // Apply transformation rules if available
    if (legacyVersion.transformationRules) {
      transformedData = applyTransformationRules(requestData, legacyVersion.transformationRules);
    }

    return {
      newEndpoint,
      transformedData,
    };
  } catch (error) {
    console.error('Error transforming legacy request:', error);
    throw error;
  }
}

/**
 * Deactivate legacy API version (end of life)
 */
export async function deactivateLegacyAPIVersion(
  version: string,
  adminId?: string
): Promise<void> {
  try {
    await query(
      `UPDATE legacy_api_versions SET is_active = FALSE WHERE version = $1`,
      [version]
    );

    if (adminId) {
      await logAction(adminId, 'admin', 'legacy_api_version', version, {
        ipAddress: '127.0.0.1',
        metadata: { action: 'deactivated' },
        dataClassification: 'internal',
      });
    }
  } catch (error) {
    console.error('Error deactivating legacy API version:', error);
    throw error;
  }
}

// ============================================
// DEPRECATION WARNING FUNCTIONS
// ============================================

/**
 * Issue deprecation warning to user
 */
export async function issueDeprecationWarning(
  userId: string,
  featureId: string,
  message: string,
  severity: DeprecationSeverity = 'medium',
  migrationUrl?: string
): Promise<DeprecationWarning> {
  try {
    // Get feature details
    const featureResult = await query(
      `SELECT * FROM deprecated_features WHERE id = $1`,
      [featureId]
    );

    if (!featureResult.rows.length) {
      throw new Error('Feature not found');
    }

    const feature = parseDeprecatedFeatureRow(featureResult.rows[0]);
    const now = new Date();
    const daysUntilDisabled = Math.ceil(
      (feature.disabledDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilRemoved = Math.ceil(
      (feature.endOfLifeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const result = await query(
      `INSERT INTO deprecation_warnings (
        feature_id, user_id, severity, message, migration_url,
        days_until_disabled, days_until_removed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [featureId, userId, severity, message, migrationUrl, daysUntilDisabled, daysUntilRemoved]
    );

    return parseDeprecationWarning(result.rows[0]);
  } catch (error) {
    console.error('Error issuing deprecation warning:', error);
    throw error;
  }
}

/**
 * Acknowledge deprecation warning
 */
export async function acknowledgeDeprecationWarning(warningId: string): Promise<void> {
  try {
    await query(
      `UPDATE deprecation_warnings SET acknowledged_at = $1 WHERE id = $2`,
      [new Date(), warningId]
    );
  } catch (error) {
    console.error('Error acknowledging warning:', error);
    throw error;
  }
}

/**
 * Get unacknowledged warnings for user
 */
export async function getUnacknowledgedWarnings(userId: string): Promise<DeprecationWarning[]> {
  try {
    const result = await query(
      `SELECT * FROM deprecation_warnings
       WHERE user_id = $1 AND acknowledged_at IS NULL
       ORDER BY issued_at DESC`,
      [userId]
    );

    return result.rows.map(parseDeprecationWarning);
  } catch (error) {
    console.error('Error getting unacknowledged warnings:', error);
    throw error;
  }
}

// ============================================
// AUTO-DISABLE & REMOVAL FUNCTIONS
// ============================================

/**
 * Auto-disable deprecated features on scheduled date
 */
export async function autoDisableDeprecatedFeatures(): Promise<{ disabled: number }> {
  try {
    const now = new Date();

    const result = await query(
      `UPDATE deprecated_features
       SET status = 'disabled', disabled_date = $1, updated_at = $2
       WHERE status = 'active' AND disabled_date <= $1 AND disabled_date IS NOT NULL`,
      [now, now]
    );

    return { disabled: result.rowCount || 0 };
  } catch (error) {
    console.error('Error auto-disabling deprecated features:', error);
    throw error;
  }
}

/**
 * Auto-remove end-of-life features
 */
export async function autoRemoveEOLFeatures(): Promise<{ removed: number }> {
  try {
    const now = new Date();

    // First, get list of features to be removed for logging
    const featuresToRemove = await query(
      `SELECT feature_name FROM deprecated_features
       WHERE status IN ('active', 'disabled') AND end_of_life_date <= $1`,
      [now]
    );

    const result = await query(
      `UPDATE deprecated_features
       SET status = 'removed', removal_date = $1, updated_at = $2
       WHERE status IN ('active', 'disabled') AND end_of_life_date <= $1`,
      [now, now]
    );

    // Log removals
    for (const row of featuresToRemove.rows) {
      await logAction('system', 'admin', 'feature_removal', row.feature_name, {
        ipAddress: '127.0.0.1',
        metadata: { reason: 'End of life reached' },
        dataClassification: 'internal',
      });
    }

    return { removed: result.rowCount || 0 };
  } catch (error) {
    console.error('Error removing EOL features:', error);
    throw error;
  }
}

/**
 * Check if feature is deprecated
 */
export async function isFeatureDeprecated(featureName: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT * FROM deprecated_features
       WHERE feature_name = $1 AND status IN ('announced', 'active', 'disabled')`,
      [featureName]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking deprecation status:', error);
    return false;
  }
}

/**
 * Check if feature is disabled
 */
export async function isFeatureDisabled(featureName: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT * FROM deprecated_features
       WHERE feature_name = $1 AND status IN ('disabled', 'removed')`,
      [featureName]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking if feature is disabled:', error);
    return false;
  }
}

// ============================================
// MIGRATION REDIRECT FUNCTIONS
// ============================================

/**
 * Get redirect target for deprecated feature
 */
export async function getRedirectTarget(featureName: string): Promise<string | null> {
  try {
    const result = await query(
      `SELECT replacement_path FROM deprecated_features
       WHERE feature_name = $1 AND replacement_path IS NOT NULL`,
      [featureName]
    );

    return result.rows.length > 0 ? result.rows[0].replacement_path : null;
  } catch (error) {
    console.error('Error getting redirect target:', error);
    return null;
  }
}

/**
 * Get migration guide for feature
 */
export async function getMigrationGuide(featureName: string): Promise<{
  guideUrl?: string;
  guideContent?: string;
  replacementFeature?: string;
  breakingChanges?: string[];
} | null> {
  try {
    const result = await query(
      `SELECT migration_guide_url, migration_guide_content, replacement_feature, breaking_changes
       FROM deprecated_features
       WHERE feature_name = $1`,
      [featureName]
    );

    if (!result.rows.length) {
      return null;
    }

    const row = result.rows[0];
    return {
      guideUrl: row.migration_guide_url,
      guideContent: row.migration_guide_content,
      replacementFeature: row.replacement_feature,
      breakingChanges: row.breaking_changes,
    };
  } catch (error) {
    console.error('Error getting migration guide:', error);
    return null;
  }
}

// ============================================
// REPORTING FUNCTIONS
// ============================================

/**
 * Generate comprehensive deprecation report
 */
export async function generateDeprecationReport(generatedBy: string): Promise<DeprecationReport> {
  try {
    const now = new Date();
    const deprecatedFeatures = await getDeprecatedFeatures();

    // Get upcoming removals
    const upcomingRemovals = await query(
      `SELECT feature_name, end_of_life_date FROM deprecated_features
       WHERE status IN ('active', 'disabled') AND end_of_life_date > $1 AND end_of_life_date <= date_add($1, interval 30 day)
       ORDER BY end_of_life_date ASC`,
      [now]
    );

    // Get global migration progress
    const globalProgress = await query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM migration_records`
    );

    const stats = globalProgress.rows[0];
    const totalMigrations = parseInt(stats.total) || 0;
    const completedMigrations = parseInt(stats.completed) || 0;
    const percentageComplete = totalMigrations > 0 ? (completedMigrations / totalMigrations) * 100 : 0;

    const recommendations: string[] = [];

    // Generate recommendations
    if (percentageComplete < 50) {
      recommendations.push('Less than 50% migration complete. Accelerate migration efforts.');
    }
    if (upcomingRemovals.rows.length > 0) {
      recommendations.push(`${upcomingRemovals.rows.length} features scheduled for removal within 30 days.`);
    }
    if (deprecatedFeatures.filter(f => f.severity === 'critical').length > 0) {
      recommendations.push('Critical deprecations detected. Prioritize migration.');
    }

    const report: DeprecationReport = {
      id: uuidv4(),
      reportDate: now,
      generatedBy,
      deprecatedFeatures,
      migrationProgress: {
        totalFeatures: totalMigrations,
        completedMigrations,
        inProgressMigrations: 0,
        failedMigrations: 0,
        skippedMigrations: 0,
        percentageComplete,
        estimatedCompletionDate: new Date(now.getTime() + (totalMigrations - completedMigrations) * 86400000),
        blockers: [],
      },
      upcomingRemovals: upcomingRemovals.rows.map(row => ({
        feature: row.feature_name,
        removalDate: new Date(row.end_of_life_date),
        daysUntil: Math.ceil((new Date(row.end_of_life_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      recommendations,
    };

    return report;
  } catch (error) {
    console.error('Error generating deprecation report:', error);
    throw error;
  }
}

/**
 * Get deprecation statistics
 */
export async function getDeprecationStats(): Promise<Record<string, any>> {
  try {
    const result = await query(`
      SELECT
        status,
        COUNT(*) as count,
        severity
      FROM deprecated_features
      GROUP BY status, severity
      ORDER BY count DESC
    `);

    const stats = {
      byStatus: {},
      bySeverity: {},
      total: 0,
    };

    result.rows.forEach((row: any) => {
      stats.total += row.count;
      stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + row.count;
      stats.bySeverity[row.severity] = (stats.bySeverity[row.severity] || 0) + row.count;
    });

    return stats;
  } catch (error) {
    console.error('Error getting deprecation statistics:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseDeprecatedFeatureRow(row: any): DeprecatedFeature {
  return {
    id: row.id,
    featureName: row.feature_name,
    featurePath: row.feature_path,
    status: row.status,
    severity: row.severity,
    announcedDate: new Date(row.announced_date),
    disabledDate: row.disabled_date ? new Date(row.disabled_date) : undefined,
    endOfLifeDate: new Date(row.end_of_life_date),
    removalDate: row.removal_date ? new Date(row.removal_date) : undefined,
    replacementFeature: row.replacement_feature,
    replacementPath: row.replacement_path,
    migrationGuideUrl: row.migration_guide_url,
    migrationGuideContent: row.migration_guide_content,
    description: row.description,
    affectedUsers: row.affected_users,
    affectedServices: row.affected_services,
    breakingChanges: row.breaking_changes,
    apiVersions: row.api_versions,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function parseMigrationRecord(row: any): MigrationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    fromFeature: row.from_feature,
    toFeature: row.to_feature,
    status: row.status,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    failureReason: row.failure_reason,
    migrationData: row.migration_data ? JSON.parse(row.migration_data) : undefined,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function parseLegacyAPIVersion(row: any): LegacyAPIVersion {
  return {
    id: row.id,
    version: row.version,
    deprecationDate: new Date(row.deprecation_date),
    endOfLifeDate: new Date(row.end_of_life_date),
    replacementVersion: row.replacement_version,
    supportUrl: row.support_url,
    isActive: row.is_active,
    endpointMappings: JSON.parse(row.endpoint_mappings),
    transformationRules: row.transformation_rules ? JSON.parse(row.transformation_rules) : undefined,
    createdAt: new Date(row.created_at),
  };
}

function parseDeprecationWarning(row: any): DeprecationWarning {
  return {
    id: row.id,
    featureId: row.feature_id,
    userId: row.user_id,
    issuedAt: new Date(row.issued_at),
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
    severity: row.severity,
    message: row.message,
    migrationUrl: row.migration_url,
    daysUntilDisabled: row.days_until_disabled,
    daysUntilRemoved: row.days_until_removed,
  };
}

function applyTransformationRules(data: Record<string, any>, rules: Record<string, any>): Record<string, any> {
  const transformed = { ...data };

  for (const [oldKey, newKey] of Object.entries(rules)) {
    if (oldKey in transformed) {
      transformed[newKey as string] = transformed[oldKey];
      delete transformed[oldKey];
    }
  }

  return transformed;
}

export default {
  initializeDeprecationTables,
  announceFeatureDeprecation,
  updateDeprecationStatus,
  getDeprecatedFeatures,
  getUpcomingRemovals,
  createMigrationRecord,
  updateMigrationProgress,
  recordMigrationHistory,
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
  getRedirectTarget,
  getMigrationGuide,
  generateDeprecationReport,
  getDeprecationStats,
};
