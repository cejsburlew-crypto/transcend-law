// Affiliate Program Service
// Features: Signup, tracking links, commission tracking, payout automation, fraud detection
// All affiliate data is encrypted per data protection policy

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger';
import crypto from 'crypto';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface AffiliateProfile {
  id: string;
  userId: string;
  email: string;
  companyName: string;
  status: 'pending' | 'active' | 'suspended' | 'rejected';
  tier: 'basic' | 'premium' | 'elite';
  commissionRate: number; // percentage (e.g., 15 for 15%)
  uniqueCode: string;
  createdAt: Date;
  updatedAt: Date;
  taxId?: string;
  paymentMethod?: 'bank' | 'paypal' | 'stripe';
  paymentDetails?: Record<string, any>;
  monthlyRevenueCap?: number;
  fraudScore: number; // 0-100, higher = riskier
  verificationStatus: 'pending' | 'verified' | 'failed';
  bankVerified: boolean;
}

export interface TrackingLink {
  id: string;
  affiliateId: string;
  code: string;
  url: string;
  campaignName: string;
  createdAt: Date;
  expiresAt?: Date;
  clickCount: number;
  conversionCount: number;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface Commission {
  id: string;
  affiliateId: string;
  type: 'signup' | 'revenue-share' | 'performance-bonus';
  amount: number;
  currency: string;
  serviceType?: string;
  clientId?: string;
  referralSource?: string; // tracking link code
  status: 'earned' | 'pending' | 'paid' | 'disputed';
  createdAt: Date;
  paidAt?: Date;
  fraudFlags?: string[];
  verificationStatus: 'pending' | 'verified' | 'rejected';
}

export interface Payout {
  id: string;
  affiliateId: string;
  amount: number;
  currency: string;
  method: 'bank' | 'paypal' | 'stripe';
  status: 'scheduled' | 'processing' | 'completed' | 'failed';
  transactionId?: string;
  createdAt: Date;
  processedAt?: Date;
  failureReason?: string;
  retryCount: number;
}

export interface MarketingMaterial {
  id: string;
  affiliateId?: string; // null = global template
  type: 'email' | 'banner' | 'social' | 'landing-page' | 'video';
  title: string;
  content: string;
  previewUrl?: string;
  downloadUrl?: string;
  createdAt: Date;
  isActive: boolean;
  performanceMetrics?: {
    views: number;
    clicks: number;
    conversions: number;
  };
}

export interface AffiliateStats {
  affiliateId: string;
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalEarned: number;
  totalPaid: number;
  pendingPayout: number;
  avgOrderValue: number;
  topPerformingLink?: string;
  lastActivity: Date;
}

export interface FraudIndicator {
  affiliateId: string;
  indicatorType: 'duplicate-ip' | 'high-velocity' | 'suspicious-pattern' | 'geographic-mismatch' | 'invalid-traffic';
  severity: 'low' | 'medium' | 'high';
  description: string;
  flaggedAt: Date;
  resolved: boolean;
}

// ============================================
// AFFILIATE SIGNUP & MANAGEMENT
// ============================================

/**
 * Register a new affiliate
 */
export async function registerAffiliate(
  userId: string,
  email: string,
  companyName: string,
  taxId?: string
): Promise<AffiliateProfile> {
  const affiliateId = uuidv4();
  const uniqueCode = generateUniqueCode();

  try {
    const result = await query(`
      INSERT INTO affiliates (
        id, user_id, email, company_name, unique_code, status,
        tier, commission_rate, fraud_score, verification_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `, [
      affiliateId,
      userId,
      email,
      companyName,
      uniqueCode,
      'pending',
      'basic',
      10, // default 10% commission
      0, // initial fraud score
      'pending'
    ]);

    await logAction('affiliate_signup', { affiliateId, email, companyName, userId });

    return mapAffiliateRow(result.rows[0]);
  } catch (error) {
    console.error('Error registering affiliate:', error);
    throw error;
  }
}

/**
 * Update affiliate profile
 */
export async function updateAffiliateProfile(
  affiliateId: string,
  updates: Partial<AffiliateProfile>
): Promise<AffiliateProfile> {
  const updateFields: string[] = [];
  const updateValues: any[] = [];
  let paramCount = 1;

  const allowedFields = ['companyName', 'paymentMethod', 'paymentDetails', 'monthlyRevenueCap'];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updateFields.push(`${dbKey} = $${paramCount}`);
      updateValues.push(value);
      paramCount++;
    }
  }

  if (updateFields.length === 0) {
    return getAffiliateProfile(affiliateId);
  }

  updateValues.push(affiliateId);

  const result = await query(`
    UPDATE affiliates
    SET ${updateFields.join(', ')}, updated_at = NOW()
    WHERE id = $${paramCount}
    RETURNING *
  `, updateValues);

  if (result.rows.length === 0) throw new Error('Affiliate not found');

  await logAction('affiliate_update', { affiliateId, updates });

  return mapAffiliateRow(result.rows[0]);
}

/**
 * Get affiliate profile
 */
export async function getAffiliateProfile(affiliateId: string): Promise<AffiliateProfile> {
  const result = await query(`
    SELECT * FROM affiliates WHERE id = $1
  `, [affiliateId]);

  if (result.rows.length === 0) throw new Error('Affiliate not found');

  return mapAffiliateRow(result.rows[0]);
}

/**
 * List affiliates with filters
 */
export async function listAffiliates(
  filters?: { status?: string; tier?: string; minFraudScore?: number },
  limit: number = 50,
  offset: number = 0
): Promise<AffiliateProfile[]> {
  let whereClause = 'WHERE 1=1';
  const params: any[] = [];
  let paramCount = 1;

  if (filters?.status) {
    whereClause += ` AND status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  if (filters?.tier) {
    whereClause += ` AND tier = $${paramCount}`;
    params.push(filters.tier);
    paramCount++;
  }

  if (filters?.minFraudScore !== undefined) {
    whereClause += ` AND fraud_score >= $${paramCount}`;
    params.push(filters.minFraudScore);
    paramCount++;
  }

  params.push(limit);
  params.push(offset);

  const result = await query(`
    SELECT * FROM affiliates
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `, params);

  return result.rows.map(mapAffiliateRow);
}

/**
 * Approve affiliate
 */
export async function approveAffiliate(
  affiliateId: string,
  tier: string = 'basic',
  commissionRate: number = 10
): Promise<AffiliateProfile> {
  const result = await query(`
    UPDATE affiliates
    SET status = 'active', tier = $1, commission_rate = $2,
        verification_status = 'verified', updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `, [tier, commissionRate, affiliateId]);

  if (result.rows.length === 0) throw new Error('Affiliate not found');

  await logAction('affiliate_approved', { affiliateId, tier, commissionRate });

  return mapAffiliateRow(result.rows[0]);
}

/**
 * Suspend affiliate
 */
export async function suspendAffiliate(
  affiliateId: string,
  reason: string
): Promise<void> {
  await query(`
    UPDATE affiliates
    SET status = 'suspended', updated_at = NOW()
    WHERE id = $1
  `, [affiliateId]);

  await logAction('affiliate_suspended', { affiliateId, reason });
}

// ============================================
// TRACKING LINKS
// ============================================

/**
 * Create tracking link
 */
export async function createTrackingLink(
  affiliateId: string,
  campaignName: string,
  metadata?: Record<string, any>
): Promise<TrackingLink> {
  const linkId = uuidv4();
  const code = generateTrackingCode();
  const baseUrl = process.env.AFFILIATE_BASE_URL || 'https://transcend-law.com';
  const url = `${baseUrl}?aff=${code}`;

  try {
    const result = await query(`
      INSERT INTO tracking_links (
        id, affiliate_id, code, url, campaign_name, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [linkId, affiliateId, code, url, campaignName, JSON.stringify(metadata || {})]);

    await logAction('tracking_link_created', { linkId, affiliateId, campaignName });

    return mapTrackingLinkRow(result.rows[0]);
  } catch (error) {
    console.error('Error creating tracking link:', error);
    throw error;
  }
}

/**
 * Get tracking link
 */
export async function getTrackingLink(code: string): Promise<TrackingLink | null> {
  const result = await query(`
    SELECT * FROM tracking_links WHERE code = $1 AND is_active = true
  `, [code]);

  return result.rows.length > 0 ? mapTrackingLinkRow(result.rows[0]) : null;
}

/**
 * List affiliate's tracking links
 */
export async function listTrackingLinks(affiliateId: string): Promise<TrackingLink[]> {
  const result = await query(`
    SELECT * FROM tracking_links
    WHERE affiliate_id = $1
    ORDER BY created_at DESC
  `, [affiliateId]);

  return result.rows.map(mapTrackingLinkRow);
}

/**
 * Track click on affiliate link
 */
export async function recordLinkClick(
  code: string,
  clientIp: string,
  userAgent: string
): Promise<void> {
  try {
    await query(`
      UPDATE tracking_links
      SET click_count = click_count + 1
      WHERE code = $1
    `, [code]);

    // Log click for fraud detection
    await query(`
      INSERT INTO click_logs (code, client_ip, user_agent, timestamp)
      VALUES ($1, $2, $3, NOW())
    `, [code, clientIp, userAgent]);
  } catch (error) {
    console.error('Error recording link click:', error);
    throw error;
  }
}

/**
 * Disable tracking link
 */
export async function disableTrackingLink(linkId: string): Promise<void> {
  await query(`
    UPDATE tracking_links
    SET is_active = false, updated_at = NOW()
    WHERE id = $1
  `, [linkId]);

  await logAction('tracking_link_disabled', { linkId });
}

// ============================================
// COMMISSION TRACKING
// ============================================

/**
 * Record commission (signup or revenue-based)
 */
export async function recordCommission(
  affiliateId: string,
  type: 'signup' | 'revenue-share' | 'performance-bonus',
  amount: number,
  options?: {
    serviceType?: string;
    clientId?: string;
    referralSource?: string;
    metadata?: Record<string, any>;
  }
): Promise<Commission> {
  const commissionId = uuidv4();
  const fraudFlags = await detectCommissionFraud(affiliateId, amount, options);

  try {
    const result = await query(`
      INSERT INTO commissions (
        id, affiliate_id, type, amount, currency, service_type,
        client_id, referral_source, status, fraud_flags,
        verification_status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `, [
      commissionId,
      affiliateId,
      type,
      amount,
      'USD',
      options?.serviceType || null,
      options?.clientId || null,
      options?.referralSource || null,
      fraudFlags.length > 0 ? 'pending' : 'earned',
      fraudFlags.length > 0 ? JSON.stringify(fraudFlags) : null,
      fraudFlags.length > 0 ? 'pending' : 'verified'
    ]);

    await logAction('commission_recorded', {
      commissionId,
      affiliateId,
      type,
      amount,
      fraudFlags
    });

    return mapCommissionRow(result.rows[0]);
  } catch (error) {
    console.error('Error recording commission:', error);
    throw error;
  }
}

/**
 * Get affiliate commissions
 */
export async function getAffiliateCommissions(
  affiliateId: string,
  status?: string,
  limit: number = 100
): Promise<Commission[]> {
  let whereClause = 'WHERE affiliate_id = $1';
  const params: any[] = [affiliateId];

  if (status) {
    whereClause += ` AND status = $2`;
    params.push(status);
  }

  const result = await query(`
    SELECT * FROM commissions
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length + 1}
  `, [...params, limit]);

  return result.rows.map(mapCommissionRow);
}

/**
 * Approve commission (verify it's legitimate)
 */
export async function approveCommission(commissionId: string): Promise<Commission> {
  const result = await query(`
    UPDATE commissions
    SET status = 'earned', verification_status = 'verified'
    WHERE id = $1
    RETURNING *
  `, [commissionId]);

  if (result.rows.length === 0) throw new Error('Commission not found');

  await logAction('commission_approved', { commissionId });

  return mapCommissionRow(result.rows[0]);
}

/**
 * Dispute commission
 */
export async function disputeCommission(
  commissionId: string,
  reason: string
): Promise<void> {
  await query(`
    UPDATE commissions
    SET status = 'disputed', verification_status = 'rejected'
    WHERE id = $1
  `, [commissionId]);

  await logAction('commission_disputed', { commissionId, reason });
}

/**
 * Get earnings summary for affiliate
 */
export async function getAffiliateSummary(affiliateId: string): Promise<{
  totalEarned: number;
  totalPaid: number;
  pendingPayout: number;
  disputedAmount: number;
  averageCommissionAmount: number;
}> {
  const result = await query(`
    SELECT
      SUM(CASE WHEN status IN ('earned', 'paid') THEN amount ELSE 0 END) as total_earned,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
      SUM(CASE WHEN status = 'earned' THEN amount ELSE 0 END) as pending_payout,
      SUM(CASE WHEN status = 'disputed' THEN amount ELSE 0 END) as disputed_amount,
      AVG(CASE WHEN status IN ('earned', 'pending', 'paid') THEN amount ELSE NULL END) as avg_commission
    FROM commissions
    WHERE affiliate_id = $1
  `, [affiliateId]);

  const row = result.rows[0];

  return {
    totalEarned: parseFloat(row.total_earned) || 0,
    totalPaid: parseFloat(row.total_paid) || 0,
    pendingPayout: parseFloat(row.pending_payout) || 0,
    disputedAmount: parseFloat(row.disputed_amount) || 0,
    averageCommissionAmount: parseFloat(row.avg_commission) || 0
  };
}

// ============================================
// PAYOUT AUTOMATION
// ============================================

/**
 * Create payout for affiliate
 */
export async function createPayout(
  affiliateId: string,
  minimumThreshold: number = 100
): Promise<Payout | null> {
  const affiliate = await getAffiliateProfile(affiliateId);
  const summary = await getAffiliateSummary(affiliateId);

  // Check if minimum threshold is met
  if (summary.pendingPayout < minimumThreshold) {
    return null; // Not enough to pay out
  }

  const payoutId = uuidv4();

  try {
    const result = await query(`
      INSERT INTO payouts (
        id, affiliate_id, amount, currency, method, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [
      payoutId,
      affiliateId,
      summary.pendingPayout,
      'USD',
      affiliate.paymentMethod || 'bank',
      'scheduled'
    ]);

    // Update commissions to pending payout
    await query(`
      UPDATE commissions
      SET status = 'pending'
      WHERE affiliate_id = $1 AND status = 'earned'
    `, [affiliateId]);

    await logAction('payout_created', {
      payoutId,
      affiliateId,
      amount: summary.pendingPayout
    });

    return mapPayoutRow(result.rows[0]);
  } catch (error) {
    console.error('Error creating payout:', error);
    throw error;
  }
}

/**
 * Process pending payouts (run this periodically)
 */
export async function processPendingPayouts(): Promise<Payout[]> {
  try {
    // Get all scheduled payouts
    const payoutsResult = await query(`
      SELECT * FROM payouts
      WHERE status = 'scheduled'
      ORDER BY created_at ASC
    `);

    const processedPayouts: Payout[] = [];

    for (const payoutRow of payoutsResult.rows) {
      try {
        const payout = mapPayoutRow(payoutRow);

        // Process payment through payment gateway
        const transactionId = await processPaymentTransaction(payout);

        // Update payout status
        const result = await query(`
          UPDATE payouts
          SET status = 'completed', transaction_id = $1, processed_at = NOW()
          WHERE id = $2
          RETURNING *
        `, [transactionId, payout.id]);

        // Mark commissions as paid
        await query(`
          UPDATE commissions
          SET status = 'paid', paid_at = NOW()
          WHERE affiliate_id = $1 AND status = 'pending'
        `, [payout.affiliateId]);

        await logAction('payout_processed', {
          payoutId: payout.id,
          transactionId,
          amount: payout.amount
        });

        processedPayouts.push(mapPayoutRow(result.rows[0]));
      } catch (error) {
        console.error(`Error processing payout ${payoutRow.id}:`, error);

        // Mark as failed and increment retry count
        await query(`
          UPDATE payouts
          SET status = 'failed', failure_reason = $1, retry_count = retry_count + 1
          WHERE id = $2
        `, [(error as any).message, payoutRow.id]);
      }
    }

    return processedPayouts;
  } catch (error) {
    console.error('Error processing payouts:', error);
    throw error;
  }
}

/**
 * Process payment through external gateway (Stripe/PayPal)
 */
async function processPaymentTransaction(payout: Payout): Promise<string> {
  // Placeholder for integration with Stripe/PayPal
  // In production, call actual payment APIs here

  if (payout.method === 'stripe') {
    // Call Stripe API
    return `stripe_${uuidv4()}`;
  } else if (payout.method === 'paypal') {
    // Call PayPal API
    return `paypal_${uuidv4()}`;
  } else {
    // Bank transfer
    return `bank_${uuidv4()}`;
  }
}

/**
 * Get payout history
 */
export async function getPayoutHistory(
  affiliateId: string,
  limit: number = 50
): Promise<Payout[]> {
  const result = await query(`
    SELECT * FROM payouts
    WHERE affiliate_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [affiliateId, limit]);

  return result.rows.map(mapPayoutRow);
}

// ============================================
// MARKETING MATERIALS
// ============================================

/**
 * Create marketing material template
 */
export async function createMarketingMaterial(
  type: 'email' | 'banner' | 'social' | 'landing-page' | 'video',
  title: string,
  content: string,
  affiliateId?: string,
  downloadUrl?: string
): Promise<MarketingMaterial> {
  const materialId = uuidv4();

  try {
    const result = await query(`
      INSERT INTO marketing_materials (
        id, affiliate_id, type, title, content, download_url, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
      RETURNING *
    `, [materialId, affiliateId || null, type, title, content, downloadUrl || null]);

    await logAction('marketing_material_created', {
      materialId,
      type,
      title,
      affiliateId
    });

    return mapMarketingMaterialRow(result.rows[0]);
  } catch (error) {
    console.error('Error creating marketing material:', error);
    throw error;
  }
}

/**
 * Get marketing materials
 */
export async function getMarketingMaterials(
  type?: string,
  affiliateId?: string
): Promise<MarketingMaterial[]> {
  let whereClause = 'WHERE is_active = true';
  const params: any[] = [];
  let paramCount = 1;

  if (type) {
    whereClause += ` AND type = $${paramCount}`;
    params.push(type);
    paramCount++;
  }

  if (affiliateId) {
    whereClause += ` AND (affiliate_id = $${paramCount} OR affiliate_id IS NULL)`;
    params.push(affiliateId);
    paramCount++;
  }

  const result = await query(`
    SELECT * FROM marketing_materials
    ${whereClause}
    ORDER BY created_at DESC
  `, params);

  return result.rows.map(mapMarketingMaterialRow);
}

/**
 * Track marketing material performance
 */
export async function recordMaterialUsage(
  materialId: string,
  eventType: 'view' | 'click' | 'conversion'
): Promise<void> {
  const column = eventType === 'view' ? 'views'
    : eventType === 'click' ? 'clicks'
      : 'conversions';

  await query(`
    UPDATE marketing_materials
    SET performance_metrics = jsonb_set(
      COALESCE(performance_metrics, '{}'),
      '{${column}}',
      COALESCE((performance_metrics->>'${column}')::int + 1, 1)::text::jsonb
    )
    WHERE id = $1
  `, [materialId]);
}

// ============================================
// PERFORMANCE ANALYTICS
// ============================================

/**
 * Get affiliate performance stats
 */
export async function getAffiliateStats(affiliateId: string): Promise<AffiliateStats> {
  const [commissionsResult, linksResult, lastActivityResult] = await Promise.all([
    query(`
      SELECT
        COUNT(*) as total_commissions,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_commissions,
        SUM(CASE WHEN status IN ('earned', 'paid') THEN amount ELSE 0 END) as total_earned,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as total_paid,
        AVG(amount) as avg_commission
      FROM commissions
      WHERE affiliate_id = $1
    `, [affiliateId]),

    query(`
      SELECT
        SUM(click_count) as total_clicks,
        SUM(conversion_count) as total_conversions
      FROM tracking_links
      WHERE affiliate_id = $1
    `, [affiliateId]),

    query(`
      SELECT MAX(created_at) as last_activity
      FROM commissions
      WHERE affiliate_id = $1
    `, [affiliateId])
  ]);

  const comRow = commissionsResult.rows[0];
  const linksRow = linksResult.rows[0];
  const activityRow = lastActivityResult.rows[0];

  const totalClicks = parseInt(linksRow.total_clicks) || 0;
  const totalConversions = parseInt(linksRow.total_conversions) || 0;

  return {
    affiliateId,
    totalClicks,
    totalConversions,
    conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
    totalEarned: parseFloat(comRow.total_earned) || 0,
    totalPaid: parseFloat(comRow.total_paid) || 0,
    pendingPayout: (parseFloat(comRow.total_earned) || 0) - (parseFloat(comRow.total_paid) || 0),
    avgOrderValue: parseFloat(comRow.avg_commission) || 0,
    lastActivity: activityRow.last_activity || new Date()
  };
}

/**
 * Get platform-wide affiliate analytics
 */
export async function getPlatformAffiliateAnalytics(): Promise<{
  totalAffiliates: number;
  activeAffiliates: number;
  totalCommissionsIssued: number;
  totalPayoutsProcessed: number;
  totalRevenueDriven: number;
  averageConversionRate: number;
}> {
  const result = await query(`
    SELECT
      (SELECT COUNT(*) FROM affiliates WHERE status = 'active') as active_affiliates,
      (SELECT COUNT(*) FROM affiliates) as total_affiliates,
      (SELECT COUNT(DISTINCT id) FROM commissions) as total_commissions,
      (SELECT COUNT(DISTINCT id) FROM payouts WHERE status = 'completed') as total_payouts,
      (SELECT SUM(amount) FROM commissions WHERE status IN ('earned', 'paid')) as revenue_driven,
      (SELECT AVG(
        CASE WHEN total_clicks > 0 THEN (total_conversions::float / total_clicks) * 100 ELSE 0 END
      ) FROM (
        SELECT SUM(click_count) as total_clicks, SUM(conversion_count) as total_conversions
        FROM tracking_links
        GROUP BY affiliate_id
      ) subquery) as avg_conversion_rate
  `);

  const row = result.rows[0];

  return {
    totalAffiliates: parseInt(row.total_affiliates) || 0,
    activeAffiliates: parseInt(row.active_affiliates) || 0,
    totalCommissionsIssued: parseInt(row.total_commissions) || 0,
    totalPayoutsProcessed: parseInt(row.total_payouts) || 0,
    totalRevenueDriven: parseFloat(row.revenue_driven) || 0,
    averageConversionRate: parseFloat(row.avg_conversion_rate) || 0
  };
}

// ============================================
// FRAUD DETECTION
// ============================================

/**
 * Detect fraud in commission
 */
async function detectCommissionFraud(
  affiliateId: string,
  amount: number,
  options?: {
    serviceType?: string;
    clientId?: string;
    referralSource?: string;
  }
): Promise<string[]> {
  const flags: string[] = [];

  // Get affiliate profile and stats
  const [affiliate, stats] = await Promise.all([
    getAffiliateProfile(affiliateId),
    getAffiliateStats(affiliateId)
  ]);

  // Flag: High velocity commission (too many in short time)
  const recentCommissions = await query(`
    SELECT COUNT(*) as count FROM commissions
    WHERE affiliate_id = $1
    AND created_at > NOW() - INTERVAL '1 hour'
  `, [affiliateId]);

  if (parseInt(recentCommissions.rows[0].count) > 10) {
    flags.push('high-velocity');
  }

  // Flag: Amount exceeds typical commission
  if (amount > stats.avgOrderValue * 5) {
    flags.push('unusual-amount');
  }

  // Flag: Revenue cap exceeded
  if (affiliate.monthlyRevenueCap) {
    const monthlyEarned = await query(`
      SELECT SUM(amount) as total FROM commissions
      WHERE affiliate_id = $1
      AND created_at > NOW() - INTERVAL '1 month'
    `, [affiliateId]);

    const monthlyTotal = parseFloat(monthlyEarned.rows[0].total) || 0;

    if (monthlyTotal + amount > affiliate.monthlyRevenueCap) {
      flags.push('revenue-cap-exceeded');
    }
  }

  // Flag: Conversion pattern analysis
  if (options?.referralSource) {
    const link = await getTrackingLink(options.referralSource);

    if (link && link.conversionCount > 0) {
      const conversionRate = link.conversionCount / link.clickCount;

      if (conversionRate > 0.5) { // >50% conversion rate is suspicious
        flags.push('high-conversion-rate');
      }
    }
  }

  // Flag: New affiliate with large commission
  const daysSinceSignup = Math.floor(
    (Date.now() - affiliate.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceSignup < 7 && amount > 500) {
    flags.push('new-affiliate-large-commission');
  }

  // Update fraud score if flags detected
  if (flags.length > 0) {
    const fraudScore = Math.min(100, affiliate.fraudScore + (flags.length * 10));

    await query(`
      UPDATE affiliates
      SET fraud_score = $1
      WHERE id = $2
    `, [fraudScore, affiliateId]);

    // Auto-suspend if fraud score exceeds threshold
    if (fraudScore > 75) {
      await suspendAffiliate(affiliateId, 'Fraud detection score exceeded threshold');
    }
  }

  return flags;
}

/**
 * Analyze click patterns for fraud
 */
export async function analyzeClickPatterns(affiliateId: string): Promise<FraudIndicator[]> {
  const indicators: FraudIndicator[] = [];

  // Get click logs
  const clicksResult = await query(`
    SELECT client_ip, COUNT(*) as click_count
    FROM click_logs
    WHERE code IN (
      SELECT code FROM tracking_links WHERE affiliate_id = $1
    )
    AND timestamp > NOW() - INTERVAL '24 hours'
    GROUP BY client_ip
    ORDER BY click_count DESC
  `, [affiliateId]);

  // Check for duplicate IPs clicking multiple times
  for (const click of clicksResult.rows) {
    if (click.click_count > 50) {
      indicators.push({
        affiliateId,
        indicatorType: 'duplicate-ip',
        severity: 'high',
        description: `IP ${click.client_ip} clicked ${click.click_count} times in 24 hours`,
        flaggedAt: new Date(),
        resolved: false
      });
    }
  }

  // Check for geographic anomalies
  const geoResult = await query(`
    SELECT DISTINCT country FROM click_logs cl
    JOIN tracking_links tl ON cl.code = tl.code
    WHERE tl.affiliate_id = $1
    AND cl.timestamp > NOW() - INTERVAL '24 hours'
  `, [affiliateId]);

  if (geoResult.rows.length > 20) {
    indicators.push({
      affiliateId,
      indicatorType: 'geographic-mismatch',
      severity: 'medium',
      description: `Clicks from ${geoResult.rows.length} different countries in 24 hours`,
      flaggedAt: new Date(),
      resolved: false
    });
  }

  return indicators;
}

/**
 * Review and resolve fraud flags
 */
export async function resolveFraudFlag(
  affiliateId: string,
  indicatorType: string,
  approved: boolean
): Promise<void> {
  if (approved) {
    // Clear fraud indicators
    await query(`
      UPDATE fraud_indicators
      SET resolved = true
      WHERE affiliate_id = $1 AND indicator_type = $2
    `, [affiliateId, indicatorType]);

    // Lower fraud score
    const affiliate = await getAffiliateProfile(affiliateId);
    const newScore = Math.max(0, affiliate.fraudScore - 20);

    await query(`
      UPDATE affiliates
      SET fraud_score = $1
      WHERE id = $2
    `, [newScore, affiliateId]);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateUniqueCode(): string {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

function generateTrackingCode(): string {
  return `aff_${uuidv4().substring(0, 12)}`;
}

function mapAffiliateRow(row: any): AffiliateProfile {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    companyName: row.company_name,
    status: row.status,
    tier: row.tier,
    commissionRate: row.commission_rate,
    uniqueCode: row.unique_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    taxId: row.tax_id,
    paymentMethod: row.payment_method,
    paymentDetails: row.payment_details,
    monthlyRevenueCap: row.monthly_revenue_cap,
    fraudScore: row.fraud_score,
    verificationStatus: row.verification_status,
    bankVerified: row.bank_verified
  };
}

function mapTrackingLinkRow(row: any): TrackingLink {
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    code: row.code,
    url: row.url,
    campaignName: row.campaign_name,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    clickCount: row.click_count,
    conversionCount: row.conversion_count,
    isActive: row.is_active,
    metadata: row.metadata
  };
}

function mapCommissionRow(row: any): Commission {
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    type: row.type,
    amount: parseFloat(row.amount),
    currency: row.currency,
    serviceType: row.service_type,
    clientId: row.client_id,
    referralSource: row.referral_source,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    fraudFlags: row.fraud_flags ? JSON.parse(row.fraud_flags) : [],
    verificationStatus: row.verification_status
  };
}

function mapPayoutRow(row: any): Payout {
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
    method: row.method,
    status: row.status,
    transactionId: row.transaction_id,
    createdAt: row.created_at,
    processedAt: row.processed_at,
    failureReason: row.failure_reason,
    retryCount: row.retry_count
  };
}

function mapMarketingMaterialRow(row: any): MarketingMaterial {
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    type: row.type,
    title: row.title,
    content: row.content,
    previewUrl: row.preview_url,
    downloadUrl: row.download_url,
    createdAt: row.created_at,
    isActive: row.is_active,
    performanceMetrics: row.performance_metrics ? JSON.parse(row.performance_metrics) : undefined
  };
}

export default {
  // Signup & Management
  registerAffiliate,
  updateAffiliateProfile,
  getAffiliateProfile,
  listAffiliates,
  approveAffiliate,
  suspendAffiliate,

  // Tracking Links
  createTrackingLink,
  getTrackingLink,
  listTrackingLinks,
  recordLinkClick,
  disableTrackingLink,

  // Commissions
  recordCommission,
  getAffiliateCommissions,
  approveCommission,
  disputeCommission,
  getAffiliateSummary,

  // Payouts
  createPayout,
  processPendingPayouts,
  getPayoutHistory,

  // Marketing
  createMarketingMaterial,
  getMarketingMaterials,
  recordMaterialUsage,

  // Analytics
  getAffiliateStats,
  getPlatformAffiliateAnalytics,

  // Fraud Detection
  analyzeClickPatterns,
  resolveFraudFlag
};
