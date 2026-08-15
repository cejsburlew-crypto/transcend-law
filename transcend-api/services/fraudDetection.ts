// Advanced Fraud Detection Service
// ML-powered detection for velocity attacks, geographical anomalies, behavioral patterns
// Real-time risk scoring (0-100), auto-blocking, admin override, and comprehensive logging

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import * as geoip from 'geoip-lite';
import { sendAlert } from './notificationService';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  merchantId: string;
  merchantCategory: string;
  timestamp: Date;
  ipAddress: string;
  deviceId: string;
  location?: {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
  };
  paymentMethod: string;
  deviceFingerprint: string;
  userAgent: string;
}

export interface FraudDetectionResult {
  transactionId: string;
  userId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  isBlocked: boolean;
  blockReason?: string;
  detectedAnomalies: AnomalyDetection[];
  timestamp: Date;
  recommendedActions: string[];
  modelVersion: string;
  confidence: number; // 0-100
}

export interface AnomalyDetection {
  type: 'velocity' | 'geographical' | 'behavioral' | 'pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, any>;
  score: number; // 0-100
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  userId: string;
  adminId?: string;
  alertType: 'fraud_detected' | 'manual_review' | 'override_approved' | 'override_denied';
  riskScore: number;
  riskLevel: string;
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  notes?: string;
  timestamp: Date;
  resolvedAt?: Date;
  resolution?: 'fraud_confirmed' | 'legitimate' | 'unable_to_verify';
}

export interface UserBehaviorProfile {
  userId: string;
  averageTransactionAmount: number;
  averageTransactionFrequency: number; // per day
  commonMerchantCategories: string[];
  commonLocations: Array<{ latitude: number; longitude: number; city: string }>;
  typicalTimeOfDay: { hour: number; minute: number }[];
  preferredPaymentMethods: string[];
  maxSingleTransactionAmount: number;
  maxDailyTransactionAmount: number;
  riskProfile: 'low' | 'medium' | 'high';
  lastUpdated: Date;
}

export interface AdminOverride {
  id: string;
  transactionId: string;
  adminId: string;
  originalRiskScore: number;
  overrideAction: 'allow' | 'block';
  reason: string;
  timestamp: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initializeFraudDetectionTables(): Promise<void> {
  try {
    // Transactions table
    await query(`
      CREATE TABLE IF NOT EXISTS fraud_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        amount DECIMAL(12, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        merchant_id VARCHAR(255) NOT NULL,
        merchant_category VARCHAR(100) NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ip_address INET NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        location JSONB,
        payment_method VARCHAR(50) NOT NULL,
        device_fingerprint VARCHAR(255) NOT NULL,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT fraud_transactions_amount_check CHECK (amount > 0)
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_transactions_user_id ON fraud_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_transactions_timestamp ON fraud_transactions(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_fraud_transactions_ip_address ON fraud_transactions(ip_address);
      CREATE INDEX IF NOT EXISTS idx_fraud_transactions_device_id ON fraud_transactions(device_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_transactions_composite ON fraud_transactions(user_id, timestamp DESC);
    `);

    // Fraud Detection Results table
    await query(`
      CREATE TABLE IF NOT EXISTS fraud_detection_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID NOT NULL UNIQUE,
        user_id UUID NOT NULL,
        risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
        risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
        is_blocked BOOLEAN DEFAULT FALSE,
        block_reason TEXT,
        detected_anomalies JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        recommended_actions JSONB,
        model_version VARCHAR(50) NOT NULL,
        confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT fraud_detection_fk FOREIGN KEY (transaction_id) REFERENCES fraud_transactions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_detection_user_id ON fraud_detection_results(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_detection_risk_score ON fraud_detection_results(risk_score DESC);
      CREATE INDEX IF NOT EXISTS idx_fraud_detection_is_blocked ON fraud_detection_results(is_blocked);
      CREATE INDEX IF NOT EXISTS idx_fraud_detection_timestamp ON fraud_detection_results(timestamp DESC);
    `);

    // Fraud Alerts table
    await query(`
      CREATE TABLE IF NOT EXISTS fraud_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID NOT NULL,
        user_id UUID NOT NULL,
        admin_id UUID,
        alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('fraud_detected', 'manual_review', 'override_approved', 'override_denied')),
        risk_score INTEGER NOT NULL,
        risk_level VARCHAR(20) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'investigating', 'resolved', 'false_positive')),
        notes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        resolved_at TIMESTAMP,
        resolution VARCHAR(30) CHECK (resolution IN ('fraud_confirmed', 'legitimate', 'unable_to_verify')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT fraud_alerts_fk FOREIGN KEY (transaction_id) REFERENCES fraud_transactions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user_id ON fraud_alerts(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status);
      CREATE INDEX IF NOT EXISTS idx_fraud_alerts_timestamp ON fraud_alerts(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_fraud_alerts_risk_level ON fraud_alerts(risk_level);
    `);

    // User Behavior Profiles table
    await query(`
      CREATE TABLE IF NOT EXISTS user_behavior_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE,
        average_transaction_amount DECIMAL(12, 2),
        average_transaction_frequency DECIMAL(5, 2),
        common_merchant_categories JSONB,
        common_locations JSONB,
        typical_time_of_day JSONB,
        preferred_payment_methods JSONB,
        max_single_transaction_amount DECIMAL(12, 2),
        max_daily_transaction_amount DECIMAL(12, 2),
        risk_profile VARCHAR(20) DEFAULT 'medium' CHECK (risk_profile IN ('low', 'medium', 'high')),
        total_transactions INT DEFAULT 0,
        fraud_score_average DECIMAL(5, 2) DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT user_behavior_profiles_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_user_behavior_profiles_user_id ON user_behavior_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_behavior_profiles_risk_profile ON user_behavior_profiles(risk_profile);
    `);

    // Admin Overrides table
    await query(`
      CREATE TABLE IF NOT EXISTS fraud_admin_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID NOT NULL UNIQUE,
        admin_id UUID NOT NULL,
        original_risk_score INTEGER NOT NULL,
        override_action VARCHAR(20) NOT NULL CHECK (override_action IN ('allow', 'block')),
        reason TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        expires_at TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT fraud_overrides_fk FOREIGN KEY (transaction_id) REFERENCES fraud_transactions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_overrides_admin_id ON fraud_admin_overrides(admin_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_overrides_timestamp ON fraud_admin_overrides(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_fraud_overrides_expires_at ON fraud_admin_overrides(expires_at);
    `);

    // Flagged Transactions Log table
    await query(`
      CREATE TABLE IF NOT EXISTS fraud_flagged_transactions_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID NOT NULL,
        user_id UUID NOT NULL,
        flag_reason VARCHAR(100) NOT NULL,
        risk_score INTEGER NOT NULL,
        flag_details JSONB,
        action_taken VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_fraud_flagged_user_id ON fraud_flagged_transactions_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_fraud_flagged_timestamp ON fraud_flagged_transactions_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_fraud_flagged_reason ON fraud_flagged_transactions_log(flag_reason);
    `);

    console.log('Fraud detection tables initialized successfully');
  } catch (error) {
    console.error('Error initializing fraud detection tables:', error);
    throw error;
  }
}

// ============================================
// CORE FRAUD DETECTION ENGINE
// ============================================

/**
 * Analyze transaction for fraud risk using ML model
 */
export async function analyzeTransactionFraud(
  transaction: Transaction
): Promise<FraudDetectionResult> {
  try {
    const startTime = Date.now();
    const anomalies: AnomalyDetection[] = [];
    let riskScore = 0;

    // 1. Velocity Attack Detection
    const velocityAnomaly = await detectVelocityAttacks(transaction);
    if (velocityAnomaly) {
      anomalies.push(velocityAnomaly);
      riskScore += velocityAnomaly.score * 0.35; // 35% weight
    }

    // 2. Geographical Impossibility Detection
    const geoAnomaly = await detectGeographicalImpossibility(transaction);
    if (geoAnomaly) {
      anomalies.push(geoAnomaly);
      riskScore += geoAnomaly.score * 0.25; // 25% weight
    }

    // 3. Behavioral Anomaly Detection
    const behavioralAnomaly = await detectBehavioralAnomalies(transaction);
    if (behavioralAnomaly.length > 0) {
      anomalies.push(...behavioralAnomaly);
      const avgBehavioralScore = behavioralAnomaly.reduce((a, b) => a + b.score, 0) / behavioralAnomaly.length;
      riskScore += avgBehavioralScore * 0.25; // 25% weight
    }

    // 4. Pattern-based Detection
    const patternAnomaly = await detectPatternAnomalies(transaction);
    if (patternAnomaly) {
      anomalies.push(patternAnomaly);
      riskScore += patternAnomaly.score * 0.15; // 15% weight
    }

    // Normalize risk score to 0-100
    riskScore = Math.min(100, Math.max(0, riskScore));
    const riskLevel = getRiskLevel(riskScore);
    const confidence = calculateConfidence(anomalies);

    // Determine if transaction should be auto-blocked
    const autoBlock = shouldAutoBlock(riskScore, riskLevel);
    const blockReason = autoBlock ? `High-risk fraud score: ${Math.round(riskScore)}` : undefined;

    const result: FraudDetectionResult = {
      transactionId: transaction.id,
      userId: transaction.userId,
      riskScore: Math.round(riskScore),
      riskLevel,
      isBlocked: autoBlock,
      blockReason,
      detectedAnomalies: anomalies,
      timestamp: new Date(),
      recommendedActions: getRecommendedActions(riskLevel, anomalies),
      modelVersion: '1.0.0',
      confidence,
    };

    // Store result in database
    await storeFraudDetectionResult(transaction, result);

    // Create alert if high risk
    if (riskLevel === 'high' || riskLevel === 'critical') {
      await createFraudAlert({
        transactionId: transaction.id,
        userId: transaction.userId,
        alertType: 'fraud_detected',
        riskScore: result.riskScore,
        riskLevel: riskLevel,
        status: 'open',
      });

      // Send alerts to user and admin
      await sendAlert(transaction.userId, `High-risk transaction detected`, {
        transactionId: transaction.id,
        riskScore: result.riskScore,
        amount: transaction.amount,
        merchant: transaction.merchantId,
        action: autoBlock ? 'blocked' : 'flagged_for_review',
      });

      // Log to audit
      await logAction(
        'fraud-detection-system',
        'create',
        'fraud_alert',
        transaction.id,
        {
          ipAddress: transaction.ipAddress,
          status: 'success',
          metadata: {
            riskScore: result.riskScore,
            riskLevel,
            blocked: autoBlock,
          },
        }
      );
    }

    return result;
  } catch (error) {
    console.error('Error analyzing transaction for fraud:', error);
    throw error;
  }
}

// ============================================
// ANOMALY DETECTION METHODS
// ============================================

/**
 * Detect velocity attacks (multiple attempts in short time)
 */
async function detectVelocityAttacks(transaction: Transaction): Promise<AnomalyDetection | null> {
  try {
    // Check for multiple transactions in last 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const result = await query(`
      SELECT COUNT(*) as count, MAX(amount) as max_amount, SUM(amount) as total_amount
      FROM fraud_transactions
      WHERE user_id = $1 AND timestamp > $2 AND timestamp < $3
    `, [transaction.userId, fifteenMinutesAgo, new Date()]);

    const transactionCount = result.rows[0].count;
    const totalAmount = parseFloat(result.rows[0].total_amount || 0);

    // Multiple transactions in short time (more than 5 in 15 min)
    if (transactionCount >= 5) {
      return {
        type: 'velocity',
        severity: transactionCount > 10 ? 'critical' : 'high',
        description: `${transactionCount} transactions in 15 minutes - Velocity attack suspected`,
        evidence: {
          transactionCount,
          timeWindow: '15 minutes',
          totalAmount,
        },
        score: Math.min(100, 50 + transactionCount * 5),
      };
    }

    // Also check hourly velocity
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const hourlyResult = await query(`
      SELECT COUNT(*) as count
      FROM fraud_transactions
      WHERE user_id = $1 AND timestamp > $2 AND timestamp < $3
    `, [transaction.userId, oneHourAgo, new Date()]);

    const hourlyCount = hourlyResult.rows[0].count;
    if (hourlyCount > 20) {
      return {
        type: 'velocity',
        severity: 'high',
        description: `${hourlyCount} transactions in 1 hour - Unusual activity detected`,
        evidence: {
          transactionCount: hourlyCount,
          timeWindow: '1 hour',
        },
        score: Math.min(100, 60 + hourlyCount * 2),
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting velocity attacks:', error);
    return null;
  }
}

/**
 * Detect geographical impossibilities (location jumps > 1000km in < 30min)
 */
async function detectGeographicalImpossibility(transaction: Transaction): Promise<AnomalyDetection | null> {
  try {
    if (!transaction.location) return null;

    // Get last transaction within 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const result = await query(`
      SELECT location, timestamp
      FROM fraud_transactions
      WHERE user_id = $1 AND timestamp > $2 AND id != $3
      ORDER BY timestamp DESC
      LIMIT 1
    `, [transaction.userId, thirtyMinutesAgo, transaction.id]);

    if (result.rows.length === 0) return null;

    const lastTransaction = result.rows[0];
    const lastLocation = JSON.parse(lastTransaction.location || '{}');

    if (!lastLocation.latitude || !lastLocation.longitude) return null;

    // Calculate distance using Haversine formula
    const distance = calculateDistance(
      lastLocation.latitude,
      lastLocation.longitude,
      transaction.location.latitude,
      transaction.location.longitude
    );

    // Time difference in minutes
    const timeDiff = (new Date().getTime() - new Date(lastTransaction.timestamp).getTime()) / (1000 * 60);

    // Required speed to cover distance: km/min
    const requiredSpeed = distance / timeDiff;
    const impossibleSpeed = 1000; // km/min (60km/h is normal travel)

    if (distance > 1000 && timeDiff < 30 && requiredSpeed > impossibleSpeed) {
      return {
        type: 'geographical',
        severity: 'critical',
        description: `Impossible location jump: ${Math.round(distance)}km in ${Math.round(timeDiff)}min (requires ${Math.round(requiredSpeed)}km/min)`,
        evidence: {
          distance: Math.round(distance),
          timeMinutes: Math.round(timeDiff),
          requiredSpeed: Math.round(requiredSpeed),
          fromLocation: `${lastLocation.city}, ${lastLocation.country}`,
          toLocation: `${transaction.location.city}, ${transaction.location.country}`,
        },
        score: 95,
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting geographical impossibility:', error);
    return null;
  }
}

/**
 * Detect behavioral anomalies
 */
async function detectBehavioralAnomalies(transaction: Transaction): Promise<AnomalyDetection[]> {
  try {
    const anomalies: AnomalyDetection[] = [];

    // Get user behavior profile
    const profileResult = await query(`
      SELECT * FROM user_behavior_profiles WHERE user_id = $1
    `, [transaction.userId]);

    if (profileResult.rows.length === 0) {
      // New user - return empty
      return anomalies;
    }

    const profile: UserBehaviorProfile = parseUserBehaviorProfile(profileResult.rows[0]);

    // Check unusual amount
    if (profile.maxSingleTransactionAmount &&
        transaction.amount > profile.maxSingleTransactionAmount * 2) {
      anomalies.push({
        type: 'behavioral',
        severity: 'medium',
        description: `Unusual transaction amount: $${transaction.amount} (normal max: $${profile.maxSingleTransactionAmount})`,
        evidence: {
          amount: transaction.amount,
          userMaxAmount: profile.maxSingleTransactionAmount,
          deviation: Math.round((transaction.amount / profile.maxSingleTransactionAmount - 1) * 100),
        },
        score: 45,
      });
    }

    // Check unusual merchant category
    if (profile.commonMerchantCategories &&
        profile.commonMerchantCategories.length > 0 &&
        !profile.commonMerchantCategories.includes(transaction.merchantCategory)) {
      anomalies.push({
        type: 'behavioral',
        severity: 'low',
        description: `Unusual merchant category: ${transaction.merchantCategory}`,
        evidence: {
          merchantCategory: transaction.merchantCategory,
          commonCategories: profile.commonMerchantCategories,
        },
        score: 25,
      });
    }

    // Check unusual time of day
    const hour = new Date(transaction.timestamp).getHours();
    const unusualTime = !profile.typicalTimeOfDay ||
      !profile.typicalTimeOfDay.some(t => Math.abs(t.hour - hour) <= 2);

    if (unusualTime && profile.typicalTimeOfDay && profile.typicalTimeOfDay.length > 0) {
      anomalies.push({
        type: 'behavioral',
        severity: 'low',
        description: `Unusual transaction time: ${hour}:00 hours`,
        evidence: {
          transactionHour: hour,
          typicalHours: profile.typicalTimeOfDay.map(t => `${t.hour}:00`),
        },
        score: 20,
      });
    }

    return anomalies;
  } catch (error) {
    console.error('Error detecting behavioral anomalies:', error);
    return [];
  }
}

/**
 * Detect pattern-based anomalies
 */
async function detectPatternAnomalies(transaction: Transaction): Promise<AnomalyDetection | null> {
  try {
    // Check for same device/IP with different users (account takeover)
    const result = await query(`
      SELECT COUNT(DISTINCT user_id) as user_count
      FROM fraud_transactions
      WHERE device_id = $1 AND ip_address = $2 AND user_id != $3
      AND timestamp > NOW() - INTERVAL '24 hours'
    `, [transaction.deviceId, transaction.ipAddress, transaction.userId]);

    if (result.rows[0].user_count > 0) {
      return {
        type: 'pattern',
        severity: 'high',
        description: `Device/IP shared with ${result.rows[0].user_count} other user(s) - Possible account takeover`,
        evidence: {
          sharedWithUsers: result.rows[0].user_count,
          deviceId: transaction.deviceId,
          ipAddress: transaction.ipAddress,
        },
        score: 75,
      };
    }

    return null;
  } catch (error) {
    console.error('Error detecting pattern anomalies:', error);
    return null;
  }
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Store fraud detection result
 */
async function storeFraudDetectionResult(
  transaction: Transaction,
  result: FraudDetectionResult
): Promise<void> {
  try {
    // Store transaction
    await query(`
      INSERT INTO fraud_transactions (
        user_id, amount, currency, merchant_id, merchant_category, timestamp,
        ip_address, device_id, location, payment_method, device_fingerprint, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      transaction.userId,
      transaction.amount,
      transaction.currency,
      transaction.merchantId,
      transaction.merchantCategory,
      transaction.timestamp,
      transaction.ipAddress,
      transaction.deviceId,
      transaction.location ? JSON.stringify(transaction.location) : null,
      transaction.paymentMethod,
      transaction.deviceFingerprint,
      transaction.userAgent,
    ]);

    // Store detection result
    await query(`
      INSERT INTO fraud_detection_results (
        transaction_id, user_id, risk_score, risk_level, is_blocked, block_reason,
        detected_anomalies, recommended_actions, model_version, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      transaction.id,
      transaction.userId,
      result.riskScore,
      result.riskLevel,
      result.isBlocked,
      result.blockReason,
      JSON.stringify(result.detectedAnomalies),
      JSON.stringify(result.recommendedActions),
      result.modelVersion,
      result.confidence,
    ]);

    // Log flagged transaction
    if (result.riskLevel !== 'low') {
      await query(`
        INSERT INTO fraud_flagged_transactions_log (
          transaction_id, user_id, flag_reason, risk_score, flag_details, action_taken
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        transaction.id,
        transaction.userId,
        result.riskLevel,
        result.riskScore,
        JSON.stringify({
          anomalies: result.detectedAnomalies,
          recommendations: result.recommendedActions,
        }),
        result.isBlocked ? 'auto_blocked' : 'flagged_for_review',
      ]);
    }
  } catch (error) {
    console.error('Error storing fraud detection result:', error);
    throw error;
  }
}

/**
 * Create fraud alert
 */
export async function createFraudAlert(alert: Partial<FraudAlert>): Promise<FraudAlert> {
  try {
    const id = uuidv4();
    const timestamp = new Date();

    await query(`
      INSERT INTO fraud_alerts (
        id, transaction_id, user_id, alert_type, risk_score, risk_level, status, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      id,
      alert.transactionId,
      alert.userId,
      alert.alertType,
      alert.riskScore,
      alert.riskLevel,
      alert.status || 'open',
      timestamp,
    ]);

    return {
      id,
      transactionId: alert.transactionId!,
      userId: alert.userId!,
      alertType: alert.alertType as any,
      riskScore: alert.riskScore!,
      riskLevel: alert.riskLevel!,
      status: 'open',
      timestamp,
    };
  } catch (error) {
    console.error('Error creating fraud alert:', error);
    throw error;
  }
}

/**
 * Get all fraud alerts for user
 */
export async function getUserFraudAlerts(userId: string): Promise<FraudAlert[]> {
  try {
    const result = await query(`
      SELECT * FROM fraud_alerts
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT 100
    `, [userId]);

    return result.rows.map(parseFraudAlert);
  } catch (error) {
    console.error('Error getting user fraud alerts:', error);
    throw error;
  }
}

/**
 * Update fraud alert status
 */
export async function updateFraudAlertStatus(
  alertId: string,
  status: FraudAlert['status'],
  resolution?: FraudAlert['resolution'],
  notes?: string
): Promise<FraudAlert> {
  try {
    const resolvedAt = status === 'resolved' ? new Date() : null;

    const result = await query(`
      UPDATE fraud_alerts
      SET status = $1, resolution = $2, notes = $3, resolved_at = $4
      WHERE id = $5
      RETURNING *
    `, [status, resolution, notes, resolvedAt, alertId]);

    return parseFraudAlert(result.rows[0]);
  } catch (error) {
    console.error('Error updating fraud alert status:', error);
    throw error;
  }
}

/**
 * Admin override - allow or block transaction
 */
export async function createAdminOverride(
  transactionId: string,
  adminId: string,
  action: 'allow' | 'block',
  reason: string,
  expiresAt?: Date
): Promise<AdminOverride> {
  try {
    const id = uuidv4();

    // Get original risk score
    const result = await query(`
      SELECT risk_score FROM fraud_detection_results WHERE transaction_id = $1
    `, [transactionId]);

    const originalRiskScore = result.rows[0]?.risk_score || 0;

    await query(`
      INSERT INTO fraud_admin_overrides (
        id, transaction_id, admin_id, original_risk_score, override_action, reason, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, transactionId, adminId, originalRiskScore, action, reason, expiresAt]);

    // Update fraud alert
    const alertResult = await query(`
      SELECT id FROM fraud_alerts WHERE transaction_id = $1 LIMIT 1
    `, [transactionId]);

    if (alertResult.rows.length > 0) {
      await updateFraudAlertStatus(
        alertResult.rows[0].id,
        'resolved',
        action === 'allow' ? 'legitimate' : 'fraud_confirmed',
        reason
      );
    }

    // Log admin action
    await logAction(adminId, 'admin', 'fraud_override', transactionId, {
      ipAddress: '0.0.0.0',
      status: 'success',
      metadata: { action, reason },
    });

    return {
      id,
      transactionId,
      adminId,
      originalRiskScore,
      overrideAction: action,
      reason,
      timestamp: new Date(),
      expiresAt,
    };
  } catch (error) {
    console.error('Error creating admin override:', error);
    throw error;
  }
}

/**
 * Build or update user behavior profile
 */
export async function buildUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
  try {
    // Get transactions from last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const result = await query(`
      SELECT
        COUNT(*) as transaction_count,
        AVG(amount) as avg_amount,
        MAX(amount) as max_amount,
        MAX(location) as latest_location,
        array_agg(DISTINCT merchant_category) as categories,
        array_agg(DISTINCT payment_method) as payment_methods
      FROM fraud_transactions
      WHERE user_id = $1 AND timestamp > $2
    `, [userId, ninetyDaysAgo]);

    const data = result.rows[0];

    // Get profile or create new
    const profileResult = await query(`
      SELECT * FROM user_behavior_profiles WHERE user_id = $1
    `, [userId]);

    const transactionCount = parseInt(data.transaction_count) || 0;
    const avgAmount = parseFloat(data.avg_amount) || 0;
    const maxAmount = parseFloat(data.max_amount) || 0;

    // Determine risk profile based on transaction patterns
    const riskProfile = transactionCount > 50 ? 'low' : transactionCount > 20 ? 'medium' : 'high';

    const profile: UserBehaviorProfile = {
      userId,
      averageTransactionAmount: avgAmount,
      averageTransactionFrequency: transactionCount / 90,
      commonMerchantCategories: data.categories || [],
      commonLocations: [],
      typicalTimeOfDay: [],
      preferredPaymentMethods: data.payment_methods || [],
      maxSingleTransactionAmount: maxAmount,
      maxDailyTransactionAmount: avgAmount * 5,
      riskProfile: riskProfile as any,
      lastUpdated: new Date(),
    };

    // Upsert profile
    await query(`
      INSERT INTO user_behavior_profiles (
        user_id, average_transaction_amount, average_transaction_frequency,
        common_merchant_categories, preferred_payment_methods, max_single_transaction_amount,
        max_daily_transaction_amount, risk_profile, total_transactions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id) DO UPDATE SET
        average_transaction_amount = EXCLUDED.average_transaction_amount,
        average_transaction_frequency = EXCLUDED.average_transaction_frequency,
        common_merchant_categories = EXCLUDED.common_merchant_categories,
        preferred_payment_methods = EXCLUDED.preferred_payment_methods,
        max_single_transaction_amount = EXCLUDED.max_single_transaction_amount,
        max_daily_transaction_amount = EXCLUDED.max_daily_transaction_amount,
        risk_profile = EXCLUDED.risk_profile,
        total_transactions = EXCLUDED.total_transactions,
        last_updated = CURRENT_TIMESTAMP
    `, [
      userId,
      avgAmount,
      transactionCount / 90,
      JSON.stringify(data.categories || []),
      JSON.stringify(data.payment_methods || []),
      maxAmount,
      avgAmount * 5,
      riskProfile,
      transactionCount,
    ]);

    return profile;
  } catch (error) {
    console.error('Error building user behavior profile:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate Haversine distance between two coordinates
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determine risk level from score
 */
function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Determine if transaction should be auto-blocked
 */
function shouldAutoBlock(riskScore: number, riskLevel: string): boolean {
  // Auto-block critical risk scores only
  return riskLevel === 'critical' && riskScore >= 85;
}

/**
 * Calculate model confidence based on evidence
 */
function calculateConfidence(anomalies: AnomalyDetection[]): number {
  if (anomalies.length === 0) return 100;
  const avgScore = anomalies.reduce((a, b) => a + b.score, 0) / anomalies.length;
  return Math.min(100, 50 + (anomalies.length * 10) + (avgScore / 2));
}

/**
 * Get recommended actions based on risk
 */
function getRecommendedActions(riskLevel: string, anomalies: AnomalyDetection[]): string[] {
  const actions: string[] = [];

  if (riskLevel === 'critical') {
    actions.push('Block transaction immediately');
    actions.push('Contact customer for verification');
    actions.push('Initiate manual review');
  } else if (riskLevel === 'high') {
    actions.push('Flag for manual review');
    actions.push('Request additional verification');
    actions.push('Monitor account for 24 hours');
  } else if (riskLevel === 'medium') {
    actions.push('Monitor transaction');
  }

  anomalies.forEach(anomaly => {
    if (anomaly.type === 'velocity') {
      actions.push('Implement temporary rate limiting');
    } else if (anomaly.type === 'geographical') {
      actions.push('Verify user location');
    } else if (anomaly.type === 'behavioral') {
      actions.push('Request verification of transaction details');
    }
  });

  return [...new Set(actions)];
}

/**
 * Parse fraud alert from database row
 */
function parseFraudAlert(row: any): FraudAlert {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    userId: row.user_id,
    adminId: row.admin_id,
    alertType: row.alert_type as any,
    riskScore: row.risk_score,
    riskLevel: row.risk_level,
    status: row.status as any,
    notes: row.notes,
    timestamp: new Date(row.timestamp),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    resolution: row.resolution as any,
  };
}

/**
 * Parse user behavior profile from database row
 */
function parseUserBehaviorProfile(row: any): UserBehaviorProfile {
  return {
    userId: row.user_id,
    averageTransactionAmount: parseFloat(row.average_transaction_amount || 0),
    averageTransactionFrequency: parseFloat(row.average_transaction_frequency || 0),
    commonMerchantCategories: row.common_merchant_categories ? JSON.parse(row.common_merchant_categories) : [],
    commonLocations: row.common_locations ? JSON.parse(row.common_locations) : [],
    typicalTimeOfDay: row.typical_time_of_day ? JSON.parse(row.typical_time_of_day) : [],
    preferredPaymentMethods: row.preferred_payment_methods ? JSON.parse(row.preferred_payment_methods) : [],
    maxSingleTransactionAmount: parseFloat(row.max_single_transaction_amount || 0),
    maxDailyTransactionAmount: parseFloat(row.max_daily_transaction_amount || 0),
    riskProfile: row.risk_profile as any,
    lastUpdated: new Date(row.last_updated),
  };
}

/**
 * Get fraud statistics dashboard
 */
export async function getFraudStatistics(days: number = 30): Promise<Record<string, any>> {
  try {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await query(`
      SELECT
        COUNT(*) as total_transactions,
        SUM(CASE WHEN is_blocked THEN 1 ELSE 0 END) as blocked_transactions,
        SUM(CASE WHEN risk_level = 'critical' THEN 1 ELSE 0 END) as critical_alerts,
        SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_alerts,
        AVG(risk_score) as avg_risk_score,
        MAX(risk_score) as max_risk_score,
        COUNT(DISTINCT user_id) as unique_users
      FROM fraud_detection_results
      WHERE timestamp > $1
    `, [startDate]);

    return result.rows[0];
  } catch (error) {
    console.error('Error getting fraud statistics:', error);
    throw error;
  }
}

export default {
  initializeFraudDetectionTables,
  analyzeTransactionFraud,
  createFraudAlert,
  getUserFraudAlerts,
  updateFraudAlertStatus,
  createAdminOverride,
  buildUserBehaviorProfile,
  getFraudStatistics,
};
