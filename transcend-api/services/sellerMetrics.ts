// Seller Performance Metrics & Dashboard Service
// Tracks provider performance metrics, benchmarking, and improvement suggestions

import { query } from '../database/connection';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface ProviderMetrics {
  providerId: string;
  providerName: string;
  serviceType: string;
  ratingScore: number; // 1-5 stars
  ratingCount: number;
  defectRate: number; // percentage 0-100
  onTimeDeliveryRate: number; // percentage 0-100
  cancellationRate: number; // percentage 0-100
  responseRatePercent: number; // percentage 0-100
  averageResponseTime: number; // minutes
  totalTransactions: number;
  totalReviewsSubmitted: number;
  accountAgeDays: number;
  subscriptionStatus: 'active' | 'suspended' | 'inactive';
  lastUpdated: Date;
}

export interface BenchmarkComparison {
  metric: string;
  yourValue: number;
  categoryAverage: number;
  percentile: number; // 0-100, where 100 is best
  trend: 'improving' | 'stable' | 'declining';
  trendDirection: number; // -1 to 1
}

export interface PerformanceAlert {
  id: string;
  providerId: string;
  alertType:
    | 'low_rating'
    | 'high_defect_rate'
    | 'poor_delivery'
    | 'high_cancellation'
    | 'low_response_rate'
    | 'declining_trend';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  recommendedAction: string;
  createdAt: Date;
  acknowledgedAt?: Date;
}

export interface HistoricalTrend {
  date: Date;
  ratingScore: number;
  defectRate: number;
  onTimeDeliveryRate: number;
  cancellationRate: number;
  responseRatePercent: number;
  transactionCount: number;
}

export interface ImprovementSuggestion {
  id: string;
  providerId: string;
  category:
    | 'quality'
    | 'speed'
    | 'reliability'
    | 'communication'
    | 'customer_satisfaction';
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: number; // percentage improvement potential
  implementationDifficulty: 'easy' | 'medium' | 'hard';
  resourcesNeeded: string[];
  successMetrics: string[];
  createdAt: Date;
  resolvedAt?: Date;
  completed: boolean;
}

export interface SellerDashboardData {
  metrics: ProviderMetrics;
  benchmarks: BenchmarkComparison[];
  activeAlerts: PerformanceAlert[];
  historicalTrends: HistoricalTrend[];
  improvementSuggestions: ImprovementSuggestion[];
  performanceScore: number; // 0-100
  monthlyTargets: {
    targetRating: number;
    targetDefectRate: number;
    targetOnTimeRate: number;
    targetResponseRate: number;
  };
  comparisonStats: {
    topPerformers: ProviderMetrics[];
    similarProviders: ProviderMetrics[];
    categoryRanking: {
      rank: number;
      totalProviders: number;
      percentile: number;
    };
  };
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get current metrics for a seller
 */
export async function getSellerMetrics(
  providerId: string
): Promise<ProviderMetrics | null> {
  try {
    const result = await query(
      `
      SELECT
        id as providerId,
        name as providerName,
        service_type as serviceType,
        COALESCE(rating_score, 0) as ratingScore,
        COALESCE(rating_count, 0) as ratingCount,
        COALESCE(defect_rate, 0) as defectRate,
        COALESCE(on_time_delivery_rate, 0) as onTimeDeliveryRate,
        COALESCE(cancellation_rate, 0) as cancellationRate,
        COALESCE(response_rate, 0) as responseRatePercent,
        COALESCE(avg_response_time, 0) as averageResponseTime,
        COALESCE(total_transactions, 0) as totalTransactions,
        COALESCE(total_reviews, 0) as totalReviewsSubmitted,
        EXTRACT(DAY FROM NOW() - created_at) as accountAgeDays,
        subscription_status as subscriptionStatus,
        updated_at as lastUpdated
      FROM sellers
      WHERE id = $1
      `,
      [providerId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching seller metrics:', error);
    throw error;
  }
}

/**
 * Get benchmarking comparison against category
 */
export async function getBenchmarkComparison(
  providerId: string,
  serviceType: string
): Promise<BenchmarkComparison[]> {
  try {
    const result = await query(
      `
      WITH category_stats AS (
        SELECT
          service_type,
          AVG(rating_score) as avg_rating,
          AVG(defect_rate) as avg_defect,
          AVG(on_time_delivery_rate) as avg_on_time,
          AVG(cancellation_rate) as avg_cancellation,
          AVG(response_rate) as avg_response,
          MAX(rating_score) as max_rating,
          MIN(defect_rate) as min_defect,
          MAX(on_time_delivery_rate) as max_on_time,
          MIN(cancellation_rate) as min_cancellation,
          MAX(response_rate) as max_response
        FROM sellers
        WHERE service_type = $2 AND subscription_status = 'active'
        GROUP BY service_type
      ),
      seller_data AS (
        SELECT
          rating_score,
          defect_rate,
          on_time_delivery_rate,
          cancellation_rate,
          response_rate
        FROM sellers
        WHERE id = $1
      ),
      percentile_calc AS (
        SELECT
          100.0 * (1.0 - (
            SELECT COUNT(*)
            FROM sellers s2
            WHERE s2.service_type = $2
            AND s2.subscription_status = 'active'
            AND s2.rating_score < (SELECT rating_score FROM seller_data)
          )) / NULLIF((
            SELECT COUNT(*)
            FROM sellers
            WHERE service_type = $2 AND subscription_status = 'active'
          ), 0) as rating_percentile,
          100.0 * (
            SELECT COUNT(*)
            FROM sellers s2
            WHERE s2.service_type = $2
            AND s2.subscription_status = 'active'
            AND s2.defect_rate < (SELECT defect_rate FROM seller_data)
          ) / NULLIF((
            SELECT COUNT(*)
            FROM sellers
            WHERE service_type = $2 AND subscription_status = 'active'
          ), 0) as defect_percentile
        FROM category_stats
      )
      SELECT * FROM category_stats, seller_data, percentile_calc
      `,
      [providerId, serviceType]
    );

    if (result.rows.length === 0) {
      return [];
    }

    const row = result.rows[0];
    const comparisons: BenchmarkComparison[] = [
      {
        metric: 'Rating Score',
        yourValue: row.rating_score || 0,
        categoryAverage: row.avg_rating || 0,
        percentile: row.rating_percentile || 0,
        trend: calculateTrend(row.rating_score, row.avg_rating),
        trendDirection: ((row.rating_score || 0) - (row.avg_rating || 0)) / 5,
      },
      {
        metric: 'Defect Rate (%)',
        yourValue: row.defect_rate || 0,
        categoryAverage: row.avg_defect || 0,
        percentile: row.defect_percentile || 0,
        trend: calculateTrend(row.defect_rate, row.avg_defect, true),
        trendDirection: ((row.avg_defect || 0) - (row.defect_rate || 0)) / 100,
      },
      {
        metric: 'On-Time Delivery (%)',
        yourValue: row.on_time_delivery_rate || 0,
        categoryAverage: row.avg_on_time || 0,
        percentile: ((row.on_time_delivery_rate || 0) / (row.max_on_time || 100)) * 100,
        trend: calculateTrend(row.on_time_delivery_rate, row.avg_on_time),
        trendDirection: ((row.on_time_delivery_rate || 0) - (row.avg_on_time || 0)) / 100,
      },
      {
        metric: 'Cancellation Rate (%)',
        yourValue: row.cancellation_rate || 0,
        categoryAverage: row.avg_cancellation || 0,
        percentile: ((row.cancellation_rate || 0) / (row.max_cancellation || 100)) * 100,
        trend: calculateTrend(row.cancellation_rate, row.avg_cancellation, true),
        trendDirection: ((row.avg_cancellation || 0) - (row.cancellation_rate || 0)) / 100,
      },
      {
        metric: 'Response Rate (%)',
        yourValue: row.response_rate || 0,
        categoryAverage: row.avg_response || 0,
        percentile: ((row.response_rate || 0) / (row.max_response || 100)) * 100,
        trend: calculateTrend(row.response_rate, row.avg_response),
        trendDirection: ((row.response_rate || 0) - (row.avg_response || 0)) / 100,
      },
    ];

    return comparisons;
  } catch (error) {
    console.error('Error getting benchmark comparison:', error);
    throw error;
  }
}

/**
 * Get active performance alerts
 */
export async function getPerformanceAlerts(providerId: string): Promise<PerformanceAlert[]> {
  try {
    const result = await query(
      `
      SELECT
        id,
        provider_id as providerId,
        alert_type as alertType,
        severity,
        message,
        metric,
        current_value as currentValue,
        threshold,
        recommended_action as recommendedAction,
        created_at as createdAt,
        acknowledged_at as acknowledgedAt
      FROM performance_alerts
      WHERE provider_id = $1
      AND acknowledged_at IS NULL
      AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [providerId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching performance alerts:', error);
    throw error;
  }
}

/**
 * Get historical trends (last 90 days)
 */
export async function getHistoricalTrends(providerId: string): Promise<HistoricalTrend[]> {
  try {
    const result = await query(
      `
      SELECT
        DATE(created_at) as date,
        COALESCE(AVG(rating_score), 0) as ratingScore,
        COALESCE(AVG(defect_rate), 0) as defectRate,
        COALESCE(AVG(on_time_delivery_rate), 0) as onTimeDeliveryRate,
        COALESCE(AVG(cancellation_rate), 0) as cancellationRate,
        COALESCE(AVG(response_rate), 0) as responseRatePercent,
        COUNT(*) as transactionCount
      FROM seller_metrics_history
      WHERE provider_id = $1
      AND created_at > NOW() - INTERVAL '90 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
      `,
      [providerId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching historical trends:', error);
    throw error;
  }
}

/**
 * Generate improvement suggestions
 */
export async function generateImprovementSuggestions(
  providerId: string,
  metrics: ProviderMetrics
): Promise<ImprovementSuggestion[]> {
  try {
    const suggestions: ImprovementSuggestion[] = [];

    // Quality improvements
    if (metrics.defectRate > 5) {
      suggestions.push({
        id: `sug_${providerId}_defect_${Date.now()}`,
        providerId,
        category: 'quality',
        suggestion: 'Implement quality assurance checklist before delivery',
        priority: metrics.defectRate > 10 ? 'high' : 'medium',
        estimatedImpact: 25,
        implementationDifficulty: 'easy',
        resourcesNeeded: ['QA Checklist Template', 'Staff Training'],
        successMetrics: ['Defect rate < 3%', 'Customer satisfaction +10%'],
        createdAt: new Date(),
        completed: false,
      });
    }

    // Delivery speed improvements
    if (metrics.onTimeDeliveryRate < 90) {
      suggestions.push({
        id: `sug_${providerId}_delivery_${Date.now()}`,
        providerId,
        category: 'speed',
        suggestion: 'Optimize delivery scheduling and resource allocation',
        priority: metrics.onTimeDeliveryRate < 80 ? 'high' : 'medium',
        estimatedImpact: 20,
        implementationDifficulty: 'medium',
        resourcesNeeded: ['Scheduling Software', 'Process Review'],
        successMetrics: ['On-time rate > 95%', 'Customer retention +15%'],
        createdAt: new Date(),
        completed: false,
      });
    }

    // Response time improvements
    if (metrics.responseRatePercent < 85) {
      suggestions.push({
        id: `sug_${providerId}_response_${Date.now()}`,
        providerId,
        category: 'communication',
        suggestion: 'Set up automated response system and response time SLAs',
        priority: 'high',
        estimatedImpact: 30,
        implementationDifficulty: 'medium',
        resourcesNeeded: ['CRM System', 'Automation Tools', 'Staff Training'],
        successMetrics: ['Response rate > 95%', 'Customer rating +0.5 stars'],
        createdAt: new Date(),
        completed: false,
      });
    }

    // Rating improvements
    if (metrics.ratingScore < 4.0) {
      suggestions.push({
        id: `sug_${providerId}_rating_${Date.now()}`,
        providerId,
        category: 'customer_satisfaction',
        suggestion: 'Launch customer satisfaction improvement program',
        priority: 'high',
        estimatedImpact: 35,
        implementationDifficulty: 'hard',
        resourcesNeeded: ['Feedback System', 'Training Program', 'Incentives'],
        successMetrics: ['Rating > 4.5 stars', 'Positive reviews +50%'],
        createdAt: new Date(),
        completed: false,
      });
    }

    // Cancellation reduction
    if (metrics.cancellationRate > 5) {
      suggestions.push({
        id: `sug_${providerId}_cancellation_${Date.now()}`,
        providerId,
        category: 'reliability',
        suggestion: 'Implement reliability improvements and contingency planning',
        priority: 'medium',
        estimatedImpact: 15,
        implementationDifficulty: 'medium',
        resourcesNeeded: ['Backup Team', 'Equipment Upgrades', 'Process Documentation'],
        successMetrics: ['Cancellation rate < 2%', 'Trust score +20%'],
        createdAt: new Date(),
        completed: false,
      });
    }

    // Save suggestions to database
    for (const suggestion of suggestions) {
      await query(
        `
        INSERT INTO improvement_suggestions
        (id, provider_id, category, suggestion, priority, estimated_impact,
         implementation_difficulty, resources_needed, success_metrics, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO NOTHING
        `,
        [
          suggestion.id,
          providerId,
          suggestion.category,
          suggestion.suggestion,
          suggestion.priority,
          suggestion.estimatedImpact,
          suggestion.implementationDifficulty,
          JSON.stringify(suggestion.resourcesNeeded),
          JSON.stringify(suggestion.successMetrics),
          suggestion.createdAt,
        ]
      );
    }

    return suggestions;
  } catch (error) {
    console.error('Error generating improvement suggestions:', error);
    throw error;
  }
}

/**
 * Calculate performance score (0-100)
 */
export function calculatePerformanceScore(metrics: ProviderMetrics): number {
  let score = 100;

  // Rating component (max 40 points)
  score += (metrics.ratingScore / 5) * 40;

  // Defect rate component (max 20 points, lower is better)
  score -= (metrics.defectRate / 100) * 20;

  // On-time delivery (max 20 points)
  score += (metrics.onTimeDeliveryRate / 100) * 20;

  // Cancellation rate (max 10 points, lower is better)
  score -= (metrics.cancellationRate / 100) * 10;

  // Response rate (max 10 points)
  score += (metrics.responseRatePercent / 100) * 10;

  return Math.min(100, Math.max(0, score));
}

/**
 * Get top performers in category
 */
export async function getTopPerformers(
  serviceType: string,
  limit: number = 5
): Promise<ProviderMetrics[]> {
  try {
    const result = await query(
      `
      SELECT
        id as providerId,
        name as providerName,
        service_type as serviceType,
        COALESCE(rating_score, 0) as ratingScore,
        COALESCE(rating_count, 0) as ratingCount,
        COALESCE(defect_rate, 0) as defectRate,
        COALESCE(on_time_delivery_rate, 0) as onTimeDeliveryRate,
        COALESCE(cancellation_rate, 0) as cancellationRate,
        COALESCE(response_rate, 0) as responseRatePercent,
        COALESCE(avg_response_time, 0) as averageResponseTime,
        COALESCE(total_transactions, 0) as totalTransactions,
        COALESCE(total_reviews, 0) as totalReviewsSubmitted,
        EXTRACT(DAY FROM NOW() - created_at) as accountAgeDays,
        subscription_status as subscriptionStatus,
        updated_at as lastUpdated
      FROM sellers
      WHERE service_type = $1
      AND subscription_status = 'active'
      AND rating_count > 10
      ORDER BY rating_score DESC, on_time_delivery_rate DESC
      LIMIT $2
      `,
      [serviceType, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Error fetching top performers:', error);
    throw error;
  }
}

/**
 * Get category ranking for a seller
 */
export async function getCategoryRanking(
  providerId: string,
  serviceType: string
): Promise<{ rank: number; totalProviders: number; percentile: number }> {
  try {
    const result = await query(
      `
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            ORDER BY rating_score DESC, on_time_delivery_rate DESC
          ) as rank,
          COUNT(*) OVER () as total_count
        FROM sellers
        WHERE service_type = $2
        AND subscription_status = 'active'
      )
      SELECT
        rank,
        total_count,
        ROUND(100.0 * (total_count - rank) / NULLIF(total_count, 0))::INT as percentile
      FROM ranked
      WHERE id = $1
      `,
      [providerId, serviceType]
    );

    if (result.rows.length === 0) {
      return { rank: 0, totalProviders: 0, percentile: 0 };
    }

    return {
      rank: result.rows[0].rank,
      totalProviders: result.rows[0].total_count,
      percentile: result.rows[0].percentile,
    };
  } catch (error) {
    console.error('Error getting category ranking:', error);
    throw error;
  }
}

/**
 * Get complete dashboard data
 */
export async function getSellerDashboardData(providerId: string): Promise<SellerDashboardData | null> {
  try {
    const metrics = await getSellerMetrics(providerId);
    if (!metrics) {
      return null;
    }

    const [
      benchmarks,
      alerts,
      trends,
      suggestions,
      topPerformers,
      ranking,
    ] = await Promise.all([
      getBenchmarkComparison(providerId, metrics.serviceType),
      getPerformanceAlerts(providerId),
      getHistoricalTrends(providerId),
      generateImprovementSuggestions(providerId, metrics),
      getTopPerformers(metrics.serviceType, 5),
      getCategoryRanking(providerId, metrics.serviceType),
    ]);

    const performanceScore = calculatePerformanceScore(metrics);

    // Get similar providers (within 0.5 rating points)
    const similarProviders = await query(
      `
      SELECT
        id as providerId,
        name as providerName,
        service_type as serviceType,
        COALESCE(rating_score, 0) as ratingScore,
        COALESCE(rating_count, 0) as ratingCount,
        COALESCE(defect_rate, 0) as defectRate,
        COALESCE(on_time_delivery_rate, 0) as onTimeDeliveryRate,
        COALESCE(cancellation_rate, 0) as cancellationRate,
        COALESCE(response_rate, 0) as responseRatePercent,
        COALESCE(avg_response_time, 0) as averageResponseTime,
        COALESCE(total_transactions, 0) as totalTransactions,
        COALESCE(total_reviews, 0) as totalReviewsSubmitted,
        EXTRACT(DAY FROM NOW() - created_at) as accountAgeDays,
        subscription_status as subscriptionStatus,
        updated_at as lastUpdated
      FROM sellers
      WHERE service_type = $1
      AND id != $2
      AND subscription_status = 'active'
      AND ABS(rating_score - $3) < 0.5
      LIMIT 5
      `,
      [metrics.serviceType, providerId, metrics.ratingScore]
    );

    return {
      metrics,
      benchmarks,
      activeAlerts: alerts,
      historicalTrends: trends,
      improvementSuggestions: suggestions,
      performanceScore,
      monthlyTargets: {
        targetRating: 4.8,
        targetDefectRate: 2,
        targetOnTimeRate: 95,
        targetResponseRate: 95,
      },
      comparisonStats: {
        topPerformers,
        similarProviders: similarProviders.rows,
        categoryRanking: ranking,
      },
    };
  } catch (error) {
    console.error('Error getting seller dashboard data:', error);
    throw error;
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, providerId: string): Promise<boolean> {
  try {
    const result = await query(
      `
      UPDATE performance_alerts
      SET acknowledged_at = NOW()
      WHERE id = $1 AND provider_id = $2
      RETURNING id
      `,
      [alertId, providerId]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    throw error;
  }
}

/**
 * Helper function to calculate trend
 */
function calculateTrend(
  current: number,
  average: number,
  lowerIsBetter: boolean = false
): 'improving' | 'stable' | 'declining' {
  const threshold = 2;

  if (lowerIsBetter) {
    if (current < average - threshold) return 'improving';
    if (current > average + threshold) return 'declining';
  } else {
    if (current > average + threshold) return 'improving';
    if (current < average - threshold) return 'declining';
  }

  return 'stable';
}
