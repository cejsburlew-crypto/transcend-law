// Freemium Service
// Features: Usage tier management, case limits, trial tracking, upgrade flow, conversion metrics
// Free tier: 5 cases, 7-day trial; Pro tier: unlimited cases

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export type UserTier = 'free' | 'pro' | 'enterprise';
export type TrialStatus = 'active' | 'expired' | 'converted' | 'cancelled';
export type ConversionEvent =
  | 'prompt_shown'
  | 'comparison_viewed'
  | 'trial_started'
  | 'trial_extended'
  | 'upgrade_clicked'
  | 'payment_completed'
  | 'upgrade_cancelled';

export interface UserSubscription {
  id: string;
  userId: string;
  tier: UserTier;
  status: 'active' | 'cancelled' | 'expired';
  createdAt: Date;
  updatedAt: Date;
  trialStartDate?: Date;
  trialEndDate?: Date;
  trialStatus: TrialStatus;
  isTrialActive: boolean;
  paidPlanStartDate?: Date;
  billingCycle: 'monthly' | 'annual';
  autoRenew: boolean;
}

export interface SubscriptionUsage {
  id: string;
  userId: string;
  subscriptionId: string;
  casesCreated: number;
  casesActive: number;
  storageUsed: number; // in MB
  documentsUploaded: number;
  lastUpdated: Date;
}

export interface FeatureLimit {
  feature: string;
  free: number | boolean;
  pro: number | boolean;
  enterprise: number | boolean;
}

export interface UpgradePromptContext {
  userId: string;
  currentTier: UserTier;
  currentUsage: number;
  limit: number;
  feature: string;
  upgradeUrl: string;
  trialDaysRemaining?: number;
}

export interface ConversionMetrics {
  id: string;
  userId: string;
  event: ConversionEvent;
  timestamp: Date;
  metadata: {
    currentTier?: UserTier;
    attemptedFeature?: string;
    conversionFunnel?: string;
    sessionId?: string;
  };
}

export interface FeatureComparison {
  features: Array<{
    name: string;
    category: string;
    free: string | boolean;
    pro: string | boolean;
    enterprise: string | boolean;
  }>;
}

export interface PricingTier {
  id: string;
  name: UserTier;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
  maxCases: number | null; // null = unlimited
  maxStorage: number | null; // null = unlimited
  supportLevel: 'email' | 'email_priority' | '24_7_phone';
}

// ============================================
// FEATURE LIMITS MATRIX
// ============================================

// `null` means unlimited (enterprise tier), so the value type must admit it.
const FEATURE_LIMITS: Record<UserTier, Record<string, number | boolean | null>> = {
  free: {
    maxCases: 5,
    maxDocuments: 50,
    maxStorageMB: 500,
    caseAnalysis: false,
    prioritySupport: false,
    apiAccess: false,
    customBranding: false,
    advancedReporting: false,
    bulkOperations: false,
  },
  pro: {
    maxCases: 1000,
    maxDocuments: 5000,
    maxStorageMB: 50000,
    caseAnalysis: true,
    prioritySupport: true,
    apiAccess: true,
    customBranding: true,
    advancedReporting: true,
    bulkOperations: true,
  },
  enterprise: {
    maxCases: null, // unlimited
    maxDocuments: null,
    maxStorageMB: null,
    caseAnalysis: true,
    prioritySupport: true,
    apiAccess: true,
    customBranding: true,
    advancedReporting: true,
    bulkOperations: true,
  },
};

const FEATURE_COMPARISON: FeatureComparison = {
  features: [
    {
      name: 'Active Cases',
      category: 'Core Features',
      free: '5 cases',
      pro: '1,000 cases',
      enterprise: 'Unlimited',
    },
    {
      name: 'Storage',
      category: 'Core Features',
      free: '500 MB',
      pro: '50 GB',
      enterprise: 'Unlimited',
    },
    {
      name: 'Document Management',
      category: 'Core Features',
      free: '50 documents',
      pro: '5,000 documents',
      enterprise: 'Unlimited',
    },
    {
      name: 'Case Analysis',
      category: 'Advanced Features',
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      name: 'Advanced Reporting',
      category: 'Advanced Features',
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      name: 'Bulk Operations',
      category: 'Advanced Features',
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      name: 'API Access',
      category: 'Integration',
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      name: 'Custom Branding',
      category: 'Integration',
      free: false,
      pro: true,
      enterprise: true,
    },
    {
      name: 'Priority Support',
      category: 'Support',
      free: 'Email',
      pro: 'Email + Priority',
      enterprise: '24/7 Phone',
    },
    {
      name: 'SLA Guarantee',
      category: 'Support',
      free: false,
      pro: '99.5%',
      enterprise: '99.99%',
    },
  ],
};

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'tier-free',
    name: 'free',
    displayName: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Perfect for getting started with legal services',
    features: [
      '5 active cases',
      '500 MB storage',
      'Basic case management',
      'Email support',
      '7-day trial included',
    ],
    maxCases: 5,
    maxStorage: 500,
    supportLevel: 'email',
  },
  {
    id: 'tier-pro',
    name: 'pro',
    displayName: 'Professional',
    monthlyPrice: 99,
    annualPrice: 990,
    description: 'For growing law practices',
    features: [
      '1,000 active cases',
      '50 GB storage',
      'Advanced case analysis',
      'Bulk operations',
      'API access',
      'Priority email support',
      'Advanced reporting',
    ],
    maxCases: 1000,
    maxStorage: 50000,
    supportLevel: 'email_priority',
  },
  {
    id: 'tier-enterprise',
    name: 'enterprise',
    displayName: 'Enterprise',
    monthlyPrice: 0, // custom pricing
    annualPrice: 0,
    description: 'For large-scale operations',
    features: [
      'Unlimited cases',
      'Unlimited storage',
      'All Pro features',
      'Custom integrations',
      'Dedicated account manager',
      '24/7 phone support',
      '99.99% SLA',
    ],
    maxCases: null,
    maxStorage: null,
    supportLevel: '24_7_phone',
  },
];

// ============================================
// TIER MANAGEMENT FUNCTIONS
// ============================================

export async function createUserSubscription(
  userId: string,
  tier: UserTier = 'free',
  includeFreeTrial: boolean = true
): Promise<UserSubscription> {
  const subscriptionId = uuidv4();
  const now = new Date();
  const trialEndDate = includeFreeTrial ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined;

  const subscriptionQuery = `
    INSERT INTO user_subscriptions (
      id, user_id, tier, status, trial_start_date, trial_end_date,
      trial_status, is_trial_active, billing_cycle, auto_renew, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *;
  `;

  const result = await query(subscriptionQuery, [
    subscriptionId,
    userId,
    tier,
    'active',
    includeFreeTrial ? now : null,
    trialEndDate,
    includeFreeTrial ? 'active' : 'expired',
    includeFreeTrial,
    'monthly',
    tier !== 'free',
    now,
    now,
  ]);

  const usageQuery = `
    INSERT INTO subscription_usage (
      id, user_id, subscription_id, cases_created, cases_active, storage_used, documents_uploaded, last_updated
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

  await query(usageQuery, [uuidv4(), userId, subscriptionId, 0, 0, 0, 0, now]);

  await logAction(userId, 'subscription_created', {
    subscriptionId,
    tier,
    trialIncluded: includeFreeTrial,
  });

  return {
    id: result.rows[0].id,
    userId: result.rows[0].user_id,
    tier: result.rows[0].tier,
    status: result.rows[0].status,
    createdAt: result.rows[0].created_at,
    updatedAt: result.rows[0].updated_at,
    trialStartDate: result.rows[0].trial_start_date,
    trialEndDate: result.rows[0].trial_end_date,
    trialStatus: result.rows[0].trial_status,
    isTrialActive: result.rows[0].is_trial_active,
    paidPlanStartDate: result.rows[0].paid_plan_start_date,
    billingCycle: result.rows[0].billing_cycle,
    autoRenew: result.rows[0].auto_renew,
  };
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const queryStr = `
    SELECT * FROM user_subscriptions
    WHERE user_id = $1 AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1;
  `;

  const result = await query(queryStr, [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  const subscription = result.rows[0];
  const now = new Date();
  const isTrialActive =
    subscription.trial_status === 'active' &&
    subscription.trial_end_date &&
    new Date(subscription.trial_end_date) > now;

  return {
    id: subscription.id,
    userId: subscription.user_id,
    tier: subscription.tier,
    status: subscription.status,
    createdAt: subscription.created_at,
    updatedAt: subscription.updated_at,
    trialStartDate: subscription.trial_start_date,
    trialEndDate: subscription.trial_end_date,
    trialStatus: subscription.trial_status,
    isTrialActive,
    paidPlanStartDate: subscription.paid_plan_start_date,
    billingCycle: subscription.billing_cycle,
    autoRenew: subscription.auto_renew,
  };
}

export async function upgradeSubscription(
  userId: string,
  newTier: UserTier,
  billingCycle: 'monthly' | 'annual' = 'monthly'
): Promise<UserSubscription> {
  const currentSubscription = await getUserSubscription(userId);
  if (!currentSubscription) {
    throw new Error('Subscription not found');
  }

  if (currentSubscription.tier === newTier) {
    throw new Error('Already on this tier');
  }

  const now = new Date();
  const updateQuery = `
    UPDATE user_subscriptions
    SET tier = $1, billing_cycle = $2, trial_status = 'converted',
        is_trial_active = false, paid_plan_start_date = $3, updated_at = $4
    WHERE id = $5
    RETURNING *;
  `;

  const result = await query(updateQuery, [
    newTier,
    billingCycle,
    now,
    now,
    currentSubscription.id,
  ]);

  const subscription = result.rows[0];

  await logAction(userId, 'upgrade_completed', {
    fromTier: currentSubscription.tier,
    toTier: newTier,
    billingCycle,
    subscriptionId: subscription.id,
  });

  return {
    id: subscription.id,
    userId: subscription.user_id,
    tier: subscription.tier,
    status: subscription.status,
    createdAt: subscription.created_at,
    updatedAt: subscription.updated_at,
    trialStartDate: subscription.trial_start_date,
    trialEndDate: subscription.trial_end_date,
    trialStatus: subscription.trial_status,
    isTrialActive: false,
    paidPlanStartDate: subscription.paid_plan_start_date,
    billingCycle: subscription.billing_cycle,
    autoRenew: subscription.auto_renew,
  };
}

// ============================================
// USAGE TRACKING FUNCTIONS
// ============================================

export async function incrementCaseCount(userId: string, count: number = 1): Promise<void> {
  const usageQuery = `
    UPDATE subscription_usage
    SET cases_created = cases_created + $1,
        cases_active = cases_active + $2,
        last_updated = NOW()
    WHERE user_id = $3;
  `;

  await query(usageQuery, [count, count, userId]);

  await logAction(userId, 'case_created', { increment: count });
}

export async function getUsageStats(userId: string): Promise<SubscriptionUsage | null> {
  const queryStr = `
    SELECT * FROM subscription_usage
    WHERE user_id = $1
    LIMIT 1;
  `;

  const result = await query(queryStr, [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  return {
    id: result.rows[0].id,
    userId: result.rows[0].user_id,
    subscriptionId: result.rows[0].subscription_id,
    casesCreated: result.rows[0].cases_created,
    casesActive: result.rows[0].cases_active,
    storageUsed: result.rows[0].storage_used,
    documentsUploaded: result.rows[0].documents_uploaded,
    lastUpdated: result.rows[0].last_updated,
  };
}

export async function updateStorageUsage(userId: string, storageMB: number): Promise<void> {
  const usageQuery = `
    UPDATE subscription_usage
    SET storage_used = storage_used + $1,
        last_updated = NOW()
    WHERE user_id = $2;
  `;

  await query(usageQuery, [storageMB, userId]);
}

export async function incrementDocumentCount(userId: string, count: number = 1): Promise<void> {
  const usageQuery = `
    UPDATE subscription_usage
    SET documents_uploaded = documents_uploaded + $1,
        last_updated = NOW()
    WHERE user_id = $2;
  `;

  await query(usageQuery, [count, userId]);

  await logAction(userId, 'document_uploaded', { increment: count });
}

// ============================================
// FEATURE AVAILABILITY FUNCTIONS
// ============================================

export function getFeatureLimit(tier: UserTier, feature: string): number | boolean | null {
  const tierLimits = FEATURE_LIMITS[tier];
  return tierLimits?.[feature] || null;
}

export function isFeatureAvailable(tier: UserTier, feature: string): boolean {
  const limit = getFeatureLimit(tier, feature);
  if (typeof limit === 'boolean') {
    return limit;
  }
  if (typeof limit === 'number') {
    return limit > 0;
  }
  return false;
}

export async function checkFeatureLimit(
  userId: string,
  feature: string
): Promise<{
  allowed: boolean;
  current: number;
  limit: number | null;
  percentageUsed: number;
  needsUpgrade: boolean;
}> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    throw new Error('No subscription found for user');
  }

  const usage = await getUsageStats(userId);
  if (!usage) {
    throw new Error('No usage stats found for user');
  }

  let current = 0;
  let limit = getFeatureLimit(subscription.tier, `max${feature.charAt(0).toUpperCase()}${feature.slice(1)}`);

  if (feature === 'Cases') {
    current = usage.casesActive;
    if (!limit) limit = null;
  } else if (feature === 'Documents') {
    current = usage.documentsUploaded;
    if (!limit) limit = null;
  } else if (feature === 'Storage') {
    current = Math.ceil(usage.storageUsed);
    if (!limit) limit = null;
  }

  // `limit` may be a boolean flag or null (unlimited) in the matrix; only a
  // numeric limit participates in the percentage/allowance maths.
  const numericLimit = typeof limit === 'number' ? limit : null;
  const percentageUsed = numericLimit ? Math.round((current / numericLimit) * 100) : 0;
  const allowed = numericLimit === null || current < numericLimit;
  const needsUpgrade = percentageUsed >= 80 && subscription.tier === 'free';

  return {
    allowed,
    current,
    limit: limit as number | null,
    percentageUsed,
    needsUpgrade,
  };
}

// ============================================
// UPGRADE PROMPT CONTEXT
// ============================================

export async function generateUpgradePromptContext(
  userId: string,
  feature: string
): Promise<UpgradePromptContext | null> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return null;
  }

  const featureCheck = await checkFeatureLimit(userId, feature);

  const trialDaysRemaining = subscription.trialEndDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(subscription.trialEndDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : undefined;

  return {
    userId,
    currentTier: subscription.tier,
    currentUsage: featureCheck.current,
    limit: featureCheck.limit || 0,
    feature,
    upgradeUrl: `/upgrade?tier=pro&source=${feature}`,
    trialDaysRemaining,
  };
}

// ============================================
// CONVERSION TRACKING
// ============================================

export async function trackConversionEvent(
  userId: string,
  event: ConversionEvent,
  metadata?: Record<string, any>
): Promise<ConversionMetrics> {
  const subscription = await getUserSubscription(userId);

  const metricsId = uuidv4();
  const now = new Date();

  const insertQuery = `
    INSERT INTO conversion_metrics (
      id, user_id, event, timestamp, metadata
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;

  const fullMetadata = {
    currentTier: subscription?.tier,
    ...metadata,
  };

  const result = await query(insertQuery, [
    metricsId,
    userId,
    event,
    now,
    JSON.stringify(fullMetadata),
  ]);

  await logAction(userId, `conversion_${event}`, fullMetadata);

  return {
    id: result.rows[0].id,
    userId: result.rows[0].user_id,
    event: result.rows[0].event,
    timestamp: result.rows[0].timestamp,
    metadata: JSON.parse(result.rows[0].metadata),
  };
}

export async function getConversionFunnelMetrics(startDate: Date, endDate: Date): Promise<{
  totalPromptsSeen: number;
  totalComparisonsViewed: number;
  totalUpgradesClicked: number;
  totalPaymentsCompleted: number;
  conversionRate: number; // percentage
}> {
  const query1 = `
    SELECT COUNT(*) as count FROM conversion_metrics
    WHERE event = 'prompt_shown' AND timestamp BETWEEN $1 AND $2;
  `;

  const query2 = `
    SELECT COUNT(*) as count FROM conversion_metrics
    WHERE event = 'comparison_viewed' AND timestamp BETWEEN $1 AND $2;
  `;

  const query3 = `
    SELECT COUNT(*) as count FROM conversion_metrics
    WHERE event = 'upgrade_clicked' AND timestamp BETWEEN $1 AND $2;
  `;

  const query4 = `
    SELECT COUNT(*) as count FROM conversion_metrics
    WHERE event = 'payment_completed' AND timestamp BETWEEN $1 AND $2;
  `;

  const [result1, result2, result3, result4] = await Promise.all([
    query(query1, [startDate, endDate]),
    query(query2, [startDate, endDate]),
    query(query3, [startDate, endDate]),
    query(query4, [startDate, endDate]),
  ]);

  const totalPromptsSeen = result1.rows[0]?.count || 0;
  const totalComparisonsViewed = result2.rows[0]?.count || 0;
  const totalUpgradesClicked = result3.rows[0]?.count || 0;
  const totalPaymentsCompleted = result4.rows[0]?.count || 0;

  const conversionRate = totalPromptsSeen > 0
    ? Math.round((totalPaymentsCompleted / totalPromptsSeen) * 100)
    : 0;

  return {
    totalPromptsSeen,
    totalComparisonsViewed,
    totalUpgradesClicked,
    totalPaymentsCompleted,
    conversionRate,
  };
}

// ============================================
// FEATURE COMPARISON & PRICING
// ============================================

export function getFeatureComparison(): FeatureComparison {
  return FEATURE_COMPARISON;
}

export function getPricingTiers(): PricingTier[] {
  return PRICING_TIERS;
}

export function getPricingTier(tier: UserTier): PricingTier | null {
  return PRICING_TIERS.find((t) => t.name === tier) || null;
}

// ============================================
// TRIAL MANAGEMENT
// ============================================

export async function extendTrialPeriod(userId: string, days: number = 7): Promise<void> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const currentEndDate = subscription.trialEndDate || new Date();
  const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);

  const updateQuery = `
    UPDATE user_subscriptions
    SET trial_end_date = $1, is_trial_active = true, updated_at = NOW()
    WHERE id = $2;
  `;

  await query(updateQuery, [newEndDate, subscription.id]);

  await logAction(userId, 'trial_extended', {
    originalEndDate: currentEndDate,
    newEndDate,
    daysAdded: days,
  });
}

export async function cancelTrialAndDowngrade(userId: string): Promise<void> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }

  const updateQuery = `
    UPDATE user_subscriptions
    SET trial_status = 'cancelled', is_trial_active = false,
        trial_end_date = NOW(), updated_at = NOW()
    WHERE id = $1;
  `;

  await query(updateQuery, [subscription.id]);

  await logAction(userId, 'trial_cancelled', { subscriptionId: subscription.id });
}

export async function getTrialRemainingDays(userId: string): Promise<number> {
  const subscription = await getUserSubscription(userId);
  if (!subscription || !subscription.trialEndDate) {
    return 0;
  }

  const now = new Date();
  const endDate = new Date(subscription.trialEndDate);
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return Math.max(0, daysRemaining);
}
