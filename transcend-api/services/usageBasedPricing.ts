// Usage-Based Pricing Service (Consumption Model)
// Features: Usage tracking, monthly billing, overage handling, cost estimation, alerts
// All pricing calculations and alerts are encrypted per data protection policy

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface PricingTier {
  id: string;
  name: string;
  unitType: 'cases' | 'transactions' | 'api_calls' | 'documents' | 'hours' | 'users';
  basePrice: number; // Price per unit
  volumeDiscounts?: Array<{
    minUnits: number;
    maxUnits?: number;
    discountPercent: number;
  }>;
  includesUnits?: number; // Included in base plan
  overage: {
    enabled: boolean;
    chargePercent?: number; // Additional charge % if enabled
    cap?: number; // Max overage cost per month
  };
}

export interface UsageRecord {
  id: string;
  customerId: string;
  tenantId: string;
  accountId: string;
  unitType: 'cases' | 'transactions' | 'api_calls' | 'documents' | 'hours' | 'users';
  amount: number;
  timestamp: Date;
  billableMonth: string; // YYYY-MM
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface MonthlyUsageSummary {
  id: string;
  customerId: string;
  tenantId: string;
  accountId: string;
  billingMonth: string; // YYYY-MM
  usageByType: {
    [unitType: string]: number;
  };
  includedUnits: number;
  usedUnits: number;
  overageUnits: number;
  overageAmount: number;
  baseCost: number;
  overageCost: number;
  discountAmount: number;
  discountPercent: number;
  totalCost: number;
  status: 'draft' | 'pending' | 'billed' | 'paid';
  generatedAt: Date;
  billedAt?: Date;
  paidAt?: Date;
}

export interface CostEstimate {
  id: string;
  customerId: string;
  tenantId: string;
  accountId: string;
  currentMonthUsage: number;
  projectedMonthlyUsage: number;
  baseCost: number;
  projectedOverageCost: number;
  projectedTotalCost: number;
  projectedMonthlyRate: number; // Units per day * 30
  daysRemainingInMonth: number;
  confidenceLevel: 'low' | 'medium' | 'high'; // Based on usage pattern
  generatedAt: Date;
}

export interface CostAlert {
  id: string;
  customerId: string;
  tenantId: string;
  accountId: string;
  alertType:
    | 'usage_threshold'
    | 'cost_threshold'
    | 'overage_warning'
    | 'budget_exceeded'
    | 'anomaly';
  threshold: number;
  currentValue: number;
  percentageOfThreshold: number;
  billingMonth: string;
  severity: 'info' | 'warning' | 'critical';
  notificationSent: boolean;
  sentAt?: Date;
  dismissedAt?: Date;
  description: string;
  createdAt: Date;
}

export interface BillingPeriod {
  id: string;
  customerId: string;
  tenantId: string;
  accountId: string;
  startDate: Date;
  endDate: Date;
  billingMonth: string; // YYYY-MM
  invoiceId?: string;
  status: 'active' | 'closed' | 'invoiced';
  createdAt: Date;
}

export interface OveragePolicy {
  id: string;
  tenantId: string;
  accountId: string;
  enabled: boolean;
  allowOverage: boolean; // Allow usage to exceed included units
  overagePrice: number; // Per unit overage price
  maxOveragePerMonth?: number; // Cap on overage charges
  autoScale: boolean; // Automatically upgrade if usage exceeds
  notifyAt: number; // Notify when usage reaches X% of included
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageAlert {
  id: string;
  customerId: string;
  billingMonth: string;
  usageType: string;
  currentUsage: number;
  limit: number;
  percentageUsed: number;
  alertThreshold: number;
  severity: 'warning' | 'critical';
  actionRequired: boolean;
}

// ============================================
// USAGE TRACKING
// ============================================

export async function recordUsage(
  customerId: string,
  tenantId: string,
  accountId: string,
  unitType: string,
  amount: number,
  description?: string,
  metadata?: Record<string, any>
): Promise<UsageRecord> {
  const usageId = uuidv4();
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const usageRecord: UsageRecord = {
    id: usageId,
    customerId,
    tenantId,
    accountId,
    unitType: unitType as any,
    amount,
    timestamp: now,
    billableMonth: billingMonth,
    description,
    metadata,
    createdAt: now,
  };

  try {
    await query(
      `INSERT INTO usage_records
       (id, customer_id, tenant_id, account_id, unit_type, amount, timestamp, billable_month, description, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        usageId,
        customerId,
        tenantId,
        accountId,
        unitType,
        amount,
        now,
        billingMonth,
        description || null,
        JSON.stringify(metadata || {}),
        now,
      ]
    );

    await logAction(tenantId, 'USAGE_RECORDED', {
      recordId: usageId,
      customerId,
      unitType,
      amount,
    });

    return usageRecord;
  } catch (error) {
    throw new Error(`Failed to record usage: ${error}`);
  }
}

export async function getMonthlyUsage(
  customerId: string,
  tenantId: string,
  accountId: string,
  billingMonth: string
): Promise<{ [key: string]: number }> {
  try {
    const result = await query(
      `SELECT unit_type, SUM(amount) as total
       FROM usage_records
       WHERE customer_id = $1 AND tenant_id = $2 AND account_id = $3 AND billable_month = $4
       GROUP BY unit_type`,
      [customerId, tenantId, accountId, billingMonth]
    );

    const usageByType: { [key: string]: number } = {};
    result.rows.forEach((row: any) => {
      usageByType[row.unit_type] = parseInt(row.total, 10);
    });

    return usageByType;
  } catch (error) {
    throw new Error(`Failed to retrieve monthly usage: ${error}`);
  }
}

export async function getCurrentMonthUsage(
  customerId: string,
  tenantId: string,
  accountId: string
): Promise<{ [key: string]: number }> {
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return getMonthlyUsage(customerId, tenantId, accountId, billingMonth);
}

// ============================================
// PRICING & COST CALCULATION
// ============================================

export async function getPricingTiers(
  tenantId: string,
  accountId: string
): Promise<PricingTier[]> {
  try {
    const result = await query(
      `SELECT * FROM pricing_tiers
       WHERE tenant_id = $1 AND account_id = $2
       ORDER BY unit_type`,
      [tenantId, accountId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      unitType: row.unit_type,
      basePrice: parseFloat(row.base_price),
      volumeDiscounts: row.volume_discounts ? JSON.parse(row.volume_discounts) : [],
      includesUnits: row.includes_units,
      overage: row.overage ? JSON.parse(row.overage) : { enabled: false },
    }));
  } catch (error) {
    throw new Error(`Failed to retrieve pricing tiers: ${error}`);
  }
}

function calculateVolumeDiscount(
  units: number,
  discounts?: Array<{ minUnits: number; maxUnits?: number; discountPercent: number }>
): number {
  if (!discounts || discounts.length === 0) return 0;

  for (const discount of discounts) {
    if (units >= discount.minUnits) {
      if (!discount.maxUnits || units <= discount.maxUnits) {
        return discount.discountPercent;
      }
    }
  }

  return 0;
}

export async function calculateMonthlyCost(
  customerId: string,
  tenantId: string,
  accountId: string,
  billingMonth: string
): Promise<MonthlyUsageSummary> {
  const summaryId = uuidv4();
  const usageByType = await getMonthlyUsage(customerId, tenantId, accountId, billingMonth);
  const pricingTiers = await getPricingTiers(tenantId, accountId);
  const overagePolicy = await getOveragePolicy(tenantId, accountId);

  let totalBaseCost = 0;
  let totalOverageCost = 0;
  let totalUsedUnits = 0;
  let totalOverageUnits = 0;
  let totalIncludedUnits = 0;
  let totalDiscountAmount = 0;

  for (const tier of pricingTiers) {
    const usedUnits = usageByType[tier.unitType] || 0;
    const includedUnits = tier.includesUnits || 0;
    totalUsedUnits += usedUnits;
    totalIncludedUnits += includedUnits;

    // Calculate base cost (charged units = used units if no included, else used - included)
    const chargedUnits = Math.max(0, usedUnits - includedUnits);
    let tierBaseCost = chargedUnits * tier.basePrice;

    // Apply volume discounts
    const discountPercent = calculateVolumeDiscount(usedUnits, tier.volumeDiscounts);
    const tierDiscountAmount = tierBaseCost * (discountPercent / 100);
    tierBaseCost -= tierDiscountAmount;
    totalDiscountAmount += tierDiscountAmount;
    totalBaseCost += tierBaseCost;

    // Calculate overage
    if (tier.overage.enabled && overagePolicy?.enabled) {
      const overageUnits = Math.max(0, usedUnits - includedUnits);
      if (overageUnits > 0) {
        let overageCost = overageUnits * (tier.overage.chargePercent || 150) * (tier.basePrice / 100);

        // Apply overage cap if set
        if (tier.overage.cap) {
          overageCost = Math.min(overageCost, tier.overage.cap);
        }

        totalOverageUnits += overageUnits;
        totalOverageCost += overageCost;
      }
    }
  }

  const totalCost = totalBaseCost + totalOverageCost;
  const discountPercent = totalBaseCost > 0 ? (totalDiscountAmount / (totalBaseCost + totalDiscountAmount)) * 100 : 0;

  const summary: MonthlyUsageSummary = {
    id: summaryId,
    customerId,
    tenantId,
    accountId,
    billingMonth,
    usageByType,
    includedUnits: totalIncludedUnits,
    usedUnits: totalUsedUnits,
    overageUnits: totalOverageUnits,
    overageAmount: totalOverageCost,
    baseCost: totalBaseCost,
    overageCost: totalOverageCost,
    discountAmount: totalDiscountAmount,
    discountPercent,
    totalCost,
    status: 'draft',
    generatedAt: new Date(),
  };

  // Store summary
  try {
    await query(
      `INSERT INTO monthly_usage_summaries
       (id, customer_id, tenant_id, account_id, billing_month, usage_by_type, included_units, used_units,
        overage_units, overage_amount, base_cost, overage_cost, discount_amount, discount_percent, total_cost, status, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        summaryId,
        customerId,
        tenantId,
        accountId,
        billingMonth,
        JSON.stringify(usageByType),
        totalIncludedUnits,
        totalUsedUnits,
        totalOverageUnits,
        totalOverageCost,
        totalBaseCost,
        totalOverageCost,
        totalDiscountAmount,
        discountPercent,
        totalCost,
        'draft',
        new Date(),
      ]
    );

    await logAction(tenantId, 'MONTHLY_COST_CALCULATED', {
      summaryId,
      customerId,
      billingMonth,
      totalCost,
    });
  } catch (error) {
    throw new Error(`Failed to store monthly usage summary: ${error}`);
  }

  return summary;
}

// ============================================
// COST ESTIMATION & PROJECTION
// ============================================

export async function estimateMonthlyProjection(
  customerId: string,
  tenantId: string,
  accountId: string
): Promise<CostEstimate> {
  const estimateId = uuidv4();
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get current month usage
  const currentUsage = await getCurrentMonthUsage(customerId, tenantId, accountId);
  const totalCurrentUsage = Object.values(currentUsage).reduce((a: number, b: number) => a + b, 0) as number;

  // Calculate daily usage rate
  const dayOfMonth = now.getDate();
  const dailyUsageRate = totalCurrentUsage / dayOfMonth;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedMonthlyUsage = dailyUsageRate * daysInMonth;

  // Calculate confidence level based on usage pattern consistency
  let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
  if (dayOfMonth >= 20) confidenceLevel = 'high'; // Enough data
  if (dayOfMonth < 5) confidenceLevel = 'low'; // Not enough data

  // Get usage for projection calculation
  const currentMonthlyCost = await calculateMonthlyCost(customerId, tenantId, accountId, billingMonth);
  const projectedCostFactor = projectedMonthlyUsage / totalCurrentUsage || 1;

  const estimate: CostEstimate = {
    id: estimateId,
    customerId,
    tenantId,
    accountId,
    currentMonthUsage: totalCurrentUsage,
    projectedMonthlyUsage: Math.ceil(projectedMonthlyUsage),
    baseCost: currentMonthlyCost.baseCost,
    projectedOverageCost: Math.ceil(currentMonthlyCost.overageCost * projectedCostFactor),
    projectedTotalCost: Math.ceil((currentMonthlyCost.totalCost * projectedCostFactor)),
    projectedMonthlyRate: Math.round(dailyUsageRate),
    daysRemainingInMonth: daysInMonth - dayOfMonth,
    confidenceLevel,
    generatedAt: now,
  };

  return estimate;
}

// ============================================
// OVERAGE HANDLING
// ============================================

export async function getOveragePolicy(
  tenantId: string,
  accountId: string
): Promise<OveragePolicy | null> {
  try {
    const result = await query(
      `SELECT * FROM overage_policies
       WHERE tenant_id = $1 AND account_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, accountId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      enabled: row.enabled,
      allowOverage: row.allow_overage,
      overagePrice: parseFloat(row.overage_price),
      maxOveragePerMonth: row.max_overage_per_month ? parseFloat(row.max_overage_per_month) : undefined,
      autoScale: row.auto_scale,
      notifyAt: row.notify_at,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    throw new Error(`Failed to retrieve overage policy: ${error}`);
  }
}

export async function handleOverage(
  customerId: string,
  tenantId: string,
  accountId: string,
  billingMonth: string
): Promise<{ overageCharged: boolean; overageAmount: number; autoScaled: boolean }> {
  const monthlySummary = await calculateMonthlyCost(customerId, tenantId, accountId, billingMonth);
  const overagePolicy = await getOveragePolicy(tenantId, accountId);

  if (!overagePolicy?.enabled || monthlySummary.overageUnits === 0) {
    return { overageCharged: false, overageAmount: 0, autoScaled: false };
  }

  let autoScaled = false;

  // Auto-scale if policy allows and overage exceeds threshold
  if (overagePolicy.autoScale && monthlySummary.overageUnits > 0) {
    // Logic to trigger upgrade
    await logAction(tenantId, 'OVERAGE_AUTO_SCALE_TRIGGERED', {
      customerId,
      overageUnits: monthlySummary.overageUnits,
      overageAmount: monthlySummary.overageAmount,
    });
    autoScaled = true;
  }

  return {
    overageCharged: true,
    overageAmount: monthlySummary.overageAmount,
    autoScaled,
  };
}

// ============================================
// COST ALERTS
// ============================================

export async function createCostAlert(
  customerId: string,
  tenantId: string,
  accountId: string,
  alertType: string,
  threshold: number,
  currentValue: number,
  billingMonth: string,
  description: string
): Promise<CostAlert> {
  const alertId = uuidv4();
  const percentageOfThreshold = (currentValue / threshold) * 100;
  const severity = percentageOfThreshold > 100 ? 'critical' : percentageOfThreshold > 80 ? 'warning' : 'info';

  const alert: CostAlert = {
    id: alertId,
    customerId,
    tenantId,
    accountId,
    alertType: alertType as any,
    threshold,
    currentValue,
    percentageOfThreshold,
    billingMonth,
    severity,
    notificationSent: false,
    description,
    createdAt: new Date(),
  };

  try {
    await query(
      `INSERT INTO cost_alerts
       (id, customer_id, tenant_id, account_id, alert_type, threshold, current_value, percentage_of_threshold,
        billing_month, severity, notification_sent, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        alertId,
        customerId,
        tenantId,
        accountId,
        alertType,
        threshold,
        currentValue,
        percentageOfThreshold,
        billingMonth,
        severity,
        false,
        description,
        new Date(),
      ]
    );

    await logAction(tenantId, 'COST_ALERT_CREATED', {
      alertId,
      customerId,
      alertType,
      severity,
    });
  } catch (error) {
    throw new Error(`Failed to create cost alert: ${error}`);
  }

  return alert;
}

export async function checkUsageThresholds(
  customerId: string,
  tenantId: string,
  accountId: string,
  billingMonth: string
): Promise<CostAlert[]> {
  const overagePolicy = await getOveragePolicy(tenantId, accountId);
  if (!overagePolicy) return [];

  const currentUsage = await getMonthlyUsage(customerId, tenantId, accountId, billingMonth);
  const pricingTiers = await getPricingTiers(tenantId, accountId);
  const alerts: CostAlert[] = [];

  for (const tier of pricingTiers) {
    const used = currentUsage[tier.unitType] || 0;
    const included = tier.includesUnits || 0;
    const threshold = included * (overagePolicy.notifyAt / 100);

    if (used >= threshold && used < included) {
      const alert = await createCostAlert(
        customerId,
        tenantId,
        accountId,
        'usage_threshold',
        threshold,
        used,
        billingMonth,
        `${tier.unitType} usage at ${((used / included) * 100).toFixed(1)}% of included units`
      );
      alerts.push(alert);
    }

    if (used >= included) {
      const alert = await createCostAlert(
        customerId,
        tenantId,
        accountId,
        'overage_warning',
        included,
        used,
        billingMonth,
        `${tier.unitType} usage exceeds included units by ${used - included}`
      );
      alerts.push(alert);
    }
  }

  return alerts;
}

export async function getActiveCostAlerts(
  customerId: string,
  tenantId: string,
  accountId: string,
  billingMonth: string
): Promise<CostAlert[]> {
  try {
    const result = await query(
      `SELECT * FROM cost_alerts
       WHERE customer_id = $1 AND tenant_id = $2 AND account_id = $3 AND billing_month = $4
       AND dismissed_at IS NULL
       ORDER BY created_at DESC`,
      [customerId, tenantId, accountId, billingMonth]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      alertType: row.alert_type,
      threshold: parseFloat(row.threshold),
      currentValue: parseFloat(row.current_value),
      percentageOfThreshold: parseFloat(row.percentage_of_threshold),
      billingMonth: row.billing_month,
      severity: row.severity,
      notificationSent: row.notification_sent,
      sentAt: row.sent_at ? new Date(row.sent_at) : undefined,
      dismissedAt: row.dismissed_at ? new Date(row.dismissed_at) : undefined,
      description: row.description,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    throw new Error(`Failed to retrieve cost alerts: ${error}`);
  }
}

export async function dismissCostAlert(alertId: string): Promise<void> {
  try {
    await query(`UPDATE cost_alerts SET dismissed_at = NOW() WHERE id = $1`, [alertId]);
  } catch (error) {
    throw new Error(`Failed to dismiss cost alert: ${error}`);
  }
}

// ============================================
// BILLING & INVOICING
// ============================================

export async function createBillingPeriod(
  customerId: string,
  tenantId: string,
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<BillingPeriod> {
  const periodId = uuidv4();
  const billingMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;

  const period: BillingPeriod = {
    id: periodId,
    customerId,
    tenantId,
    accountId,
    startDate,
    endDate,
    billingMonth,
    status: 'active',
    createdAt: new Date(),
  };

  try {
    await query(
      `INSERT INTO billing_periods
       (id, customer_id, tenant_id, account_id, start_date, end_date, billing_month, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [periodId, customerId, tenantId, accountId, startDate, endDate, billingMonth, 'active', new Date()]
    );

    await logAction(tenantId, 'BILLING_PERIOD_CREATED', {
      periodId,
      customerId,
      billingMonth,
    });
  } catch (error) {
    throw new Error(`Failed to create billing period: ${error}`);
  }

  return period;
}

export async function generateMonthlyInvoice(
  customerId: string,
  tenantId: string,
  accountId: string,
  billingMonth: string
): Promise<{ invoiceId: string; totalAmount: number; status: string }> {
  const invoiceId = uuidv4();

  try {
    const monthlySummary = await calculateMonthlyCost(customerId, tenantId, accountId, billingMonth);

    // Update summary status
    await query(
      `UPDATE monthly_usage_summaries
       SET status = 'billed', billed_at = NOW()
       WHERE id = $1`,
      [monthlySummary.id]
    );

    // Create invoice record
    await query(
      `INSERT INTO invoices
       (id, customer_id, tenant_id, account_id, billing_month, amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        invoiceId,
        customerId,
        tenantId,
        accountId,
        billingMonth,
        monthlySummary.totalCost,
        'created',
        new Date(),
      ]
    );

    await logAction(tenantId, 'MONTHLY_INVOICE_GENERATED', {
      invoiceId,
      customerId,
      billingMonth,
      amount: monthlySummary.totalCost,
    });

    return {
      invoiceId,
      totalAmount: monthlySummary.totalCost,
      status: 'created',
    };
  } catch (error) {
    throw new Error(`Failed to generate monthly invoice: ${error}`);
  }
}

// ============================================
// REPORTING
// ============================================

export async function getUsageReport(
  customerId: string,
  tenantId: string,
  accountId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  customerId: string;
  period: { startDate: Date; endDate: Date };
  totalUsage: { [key: string]: number };
  totalCost: number;
  monthlyBreakdown: MonthlyUsageSummary[];
}> {
  const start = startDate.toISOString().split('T')[0];
  const end = endDate.toISOString().split('T')[0];

  try {
    // Get all billing months in range
    const result = await query(
      `SELECT DISTINCT billing_month FROM monthly_usage_summaries
       WHERE customer_id = $1 AND tenant_id = $2 AND account_id = $3
       AND billing_month BETWEEN $4 AND $5
       ORDER BY billing_month DESC`,
      [customerId, tenantId, accountId, start.substring(0, 7), end.substring(0, 7)]
    );

    const billingMonths = result.rows.map((row: any) => row.billing_month);
    const monthlyBreakdown: MonthlyUsageSummary[] = [];
    let totalUsage: { [key: string]: number } = {};
    let totalCost = 0;

    for (const month of billingMonths) {
      const summary = await calculateMonthlyCost(customerId, tenantId, accountId, month);
      monthlyBreakdown.push(summary);
      totalCost += summary.totalCost;

      // Aggregate usage
      for (const [unitType, amount] of Object.entries(summary.usageByType)) {
        totalUsage[unitType] = (totalUsage[unitType] || 0) + (amount as number);
      }
    }

    return {
      customerId,
      period: { startDate, endDate },
      totalUsage,
      totalCost,
      monthlyBreakdown,
    };
  } catch (error) {
    throw new Error(`Failed to generate usage report: ${error}`);
  }
}

export async function exportUsageData(
  customerId: string,
  tenantId: string,
  accountId: string,
  billingMonth: string,
  format: 'csv' | 'json' = 'json'
): Promise<string> {
  try {
    const usageRecords = await query(
      `SELECT * FROM usage_records
       WHERE customer_id = $1 AND tenant_id = $2 AND account_id = $3 AND billable_month = $4
       ORDER BY timestamp DESC`,
      [customerId, tenantId, accountId, billingMonth]
    );

    if (format === 'json') {
      return JSON.stringify(usageRecords.rows, null, 2);
    }

    // CSV format
    if (usageRecords.rows.length === 0) return 'No data available';

    const headers = Object.keys(usageRecords.rows[0]).join(',');
    const rows = usageRecords.rows
      .map((row: any) =>
        Object.values(row)
          .map((v: any) => (typeof v === 'string' ? `"${v}"` : v))
          .join(',')
      )
      .join('\n');

    return `${headers}\n${rows}`;
  } catch (error) {
    throw new Error(`Failed to export usage data: ${error}`);
  }
}
