// Data Residency Setup & Configuration
// Initialize residency middleware and endpoints

import express, { Express } from 'express';
import residencyRouter from '../routes/residency';
import { validateRegionalAccess, checkDataTransferRestrictions } from '../routes/residency';

/**
 * Setup data residency middleware and routes
 */
export function setupDataResidency(app: Express): void {
  console.log('Setting up Data Residency middleware...');

  // ============================================
  // RESIDENCY API ROUTES
  // ============================================

  // Mount residency routes
  app.use('/api/residency', residencyRouter);
  console.log('Data Residency API routes mounted at /api/residency');

  // ============================================
  // REGIONAL ACCESS VALIDATION MIDDLEWARE
  // ============================================

  // Apply to all data access routes
  const protectedRoutes = [
    '/api/cases',
    '/api/documents',
    '/api/clients',
    '/api/payments',
    '/api/communications',
  ];

  protectedRoutes.forEach((route) => {
    app.use(route, validateRegionalAccess);
  });

  console.log(`Regional access validation applied to ${protectedRoutes.length} route groups`);

  // ============================================
  // DATA TRANSFER RESTRICTIONS MIDDLEWARE
  // ============================================

  // Apply to all export/download routes
  const exportRoutes = [
    '/api/documents/export',
    '/api/cases/export',
    '/api/clients/export',
    '/api/communications/export',
  ];

  exportRoutes.forEach((route) => {
    app.use(route, checkDataTransferRestrictions);
  });

  console.log(`Data transfer restrictions applied to ${exportRoutes.length} route groups`);

  // ============================================
  // LOGGING & MONITORING
  // ============================================

  logResidencyConfig();
}

/**
 * Log residency configuration on startup
 */
function logResidencyConfig(): void {
  console.log('\n========================================');
  console.log('DATA RESIDENCY CONFIGURATION');
  console.log('========================================\n');

  console.log('SUPPORTED REGIONS:');
  console.log('  - us-east-1: US East Coast (CCPA/HIPAA/SOC2)');
  console.log('  - eu-west-1: EU Ireland (GDPR)');
  console.log('  - uk-west-2: UK London (UK GDPR)');
  console.log('  - ca-central-1: Canada Toronto (PIPEDA)\n');

  console.log('COMPLIANCE FRAMEWORKS:');
  console.log('  - GDPR: Quarterly audits, 7-year retention');
  console.log('  - CCPA: Annual audits, 5-year retention');
  console.log('  - PIPEDA: Annual audits, 5-year retention');
  console.log('  - UK GDPR: Quarterly audits, 7-year retention\n');

  console.log('SECURITY FEATURES:');
  console.log('  - AES-256-GCM encryption at rest');
  console.log('  - TLS 1.3+ encryption in transit');
  console.log('  - Regional encryption keys');
  console.log('  - Automatic key rotation (quarterly)');
  console.log('  - Cross-region access blocking');
  console.log('  - External data transfer blocking\n');

  console.log('AUDIT & MONITORING:');
  console.log('  - All residency operations logged');
  console.log('  - Cross-region access attempts blocked');
  console.log('  - Data transfer audit trail maintained');
  console.log('  - Monthly compliance reports generated\n');

  console.log('ENDPOINTS:');
  console.log('  POST   /api/residency/select');
  console.log('  GET    /api/residency/config');
  console.log('  GET    /api/residency/regions');
  console.log('  POST   /api/residency/compliance-report');
  console.log('  GET    /api/residency/audit-trail');
  console.log('  POST   /api/residency/transfer-request');
  console.log('  POST   /api/residency/rotate-keys');
  console.log('  GET    /api/residency/compliance-frameworks\n');
}

/**
 * Verify residency configuration on startup
 */
export async function verifyResidencyConfiguration(): Promise<boolean> {
  try {
    console.log('Verifying data residency configuration...');

    // Check environment variables
    const requiredEnvVars = [
      'DB_HOST',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME',
    ];

    const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

    if (missingVars.length > 0) {
      console.error(`Missing environment variables: ${missingVars.join(', ')}`);
      return false;
    }

    // Check database connection
    const { query } = require('../database/connection');
    try {
      await query('SELECT 1');
      console.log('✓ Database connection successful');
    } catch (dbError) {
      console.error('✗ Database connection failed:', dbError);
      return false;
    }

    // Check residency tables exist
    const tables = [
      'user_residency',
      'user_encryption_keys',
      'data_transfer_requests',
      'compliance_reports',
      'audit_logs',
    ];

    for (const table of tables) {
      try {
        await query(`SELECT 1 FROM ${table} LIMIT 1`);
        console.log(`✓ Table ${table} exists`);
      } catch (error) {
        console.warn(`✗ Table ${table} may not exist - run migrations`);
      }
    }

    console.log('\n✓ Residency configuration verified\n');
    return true;
  } catch (error) {
    console.error('Residency configuration verification failed:', error);
    return false;
  }
}

/**
 * Residency configuration object
 */
export const residencyConfig = {
  // Regional database endpoints (set via environment variables)
  regions: {
    'us-east-1': {
      name: 'US East',
      compliance: ['CCPA', 'HIPAA', 'SOC2'],
      dbHost: process.env.DB_US_EAST_HOST || 'localhost',
      dbName: process.env.DB_US_EAST_NAME || 'transcend_law_us_east',
    },
    'eu-west-1': {
      name: 'EU West',
      compliance: ['GDPR'],
      dbHost: process.env.DB_EU_WEST_HOST || 'localhost',
      dbName: process.env.DB_EU_WEST_NAME || 'transcend_law_eu_west',
    },
    'uk-west-2': {
      name: 'UK West',
      compliance: ['UK GDPR'],
      dbHost: process.env.DB_UK_WEST_HOST || 'localhost',
      dbName: process.env.DB_UK_WEST_NAME || 'transcend_law_uk_west',
    },
    'ca-central-1': {
      name: 'Canada Central',
      compliance: ['PIPEDA'],
      dbHost: process.env.DB_CA_CENTRAL_HOST || 'localhost',
      dbName: process.env.DB_CA_CENTRAL_NAME || 'transcend_law_ca_central',
    },
  },

  // Encryption settings
  encryption: {
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'AES-256-GCM',
    keyRotationFrequencyDays: parseInt(process.env.KEY_ROTATION_FREQUENCY_DAYS || '90'),
  },

  // Compliance settings
  compliance: {
    reportFrequency: process.env.COMPLIANCE_REPORT_FREQUENCY || 'monthly',
    reportEmail: process.env.COMPLIANCE_REPORT_EMAIL || 'compliance@transcend-law.com',
    dataTransferRequiresApproval: process.env.DATA_TRANSFER_REQUIRES_APPROVAL !== 'false',
  },

  // Transfer settings
  transfer: {
    requiresApproval: process.env.DATA_TRANSFER_REQUIRES_APPROVAL !== 'false',
    approvalEmail: process.env.DATA_TRANSFER_APPROVAL_EMAIL || 'legal@transcend-law.com',
  },
};

/**
 * Health check for residency service
 */
export async function checkResidencyHealth(): Promise<{
  healthy: boolean;
  status: string;
  timestamp: string;
}> {
  try {
    const { query } = require('../database/connection');

    // Check database
    await query('SELECT 1');

    // Check tables
    await query('SELECT COUNT(*) FROM user_residency');
    await query('SELECT COUNT(*) FROM audit_logs');

    return {
      healthy: true,
      status: 'All residency services operational',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      healthy: false,
      status: `Residency service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString(),
    };
  }
}

export default {
  setupDataResidency,
  verifyResidencyConfiguration,
  checkResidencyHealth,
  residencyConfig,
};
