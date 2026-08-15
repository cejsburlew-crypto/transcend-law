// User Segmentation & Personalized Journeys Service
// Features: Multi-dimensional user segmentation, CTA optimization, A/B testing, performance tracking

import { query, transaction, getConnection } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface UserSegment {
  id: string;
  userId: string;
  lifecycle: 'new' | 'active' | 'at-risk' | 'loyal' | 'churned';
  value: 'high' | 'medium' | 'low';
  engagement: 'high' | 'medium' | 'low' | 'inactive';
  serviceTypes: string[];
  behaviorPatterns: BehaviorPattern[];
  riskFactors: RiskFactor[];
  recommendedCTAs: CTA[];
  createdAt: Date;
  lastUpdated: Date;
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  lastOccurred: Date;
  severity?: 'low' | 'medium' | 'high';
}

export interface RiskFactor {
  type: 'low-engagement' | 'high-churn-risk' | 'support-needed' | 'upsell-opportunity';
  score: number; // 0-100
  description: string;
}

export interface CTA {
  id: string;
  segment: string;
  action: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  conversionRate?: number;
  variant?: string; // for A/B testing
}

export interface SegmentPerformance {
  segmentId: string;
  userId: string;
  segment: UserSegment['lifecycle'];
  value: UserSegment['value'];
  ctasShown: number;
  ctasClicked: number;
  conversionRate: number;
  revenue: number;
  retention: number; // days retained
  churnRisk: number; // 0-100
  timestamp: Date;
}

export interface PersonalizedJourney {
  userId: string;
  segmentId: string;
  journeyStage: string;
  recommendedContent: ContentRecommendation[];
  nextSteps: string[];
  estimatedTimeToConversion: number; // days
  successProbability: number; // 0-100
}

export interface ContentRecommendation {
  id: string;
  title: string;
  description: string;
  type: 'guide' | 'video' | 'case-study' | 'webinar' | 'resource';
  relevanceScore: number; // 0-100
  estimatedReadTime: number;
}

export interface ABTestConfig {
  id: string;
  testName: string;
  segment: string;
  variant1: { cta: CTA; weight: number };
  variant2: { cta: CTA; weight: number };
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'paused' | 'completed';
  resultsVariant1: TestResults;
  resultsVariant2: TestResults;
}

export interface TestResults {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  cpc: number;
  roas: number;
}

export interface SegmentationMetrics {
  totalUsers: number;
  segmentDistribution: Record<string, number>;
  lifecycleBreakdown: Record<string, number>;
  valueBreakdown: Record<string, number>;
  engagementBreakdown: Record<string, number>;
  averageConversionRate: number;
  averageChurnRisk: number;
  topRiskFactors: RiskFactor[];
  generatedAt: Date;
}

export interface AdminSegmentationDashboard {
  id: string;
  generatedAt: Date;
  metrics: SegmentationMetrics;
  topPerformingCTAs: CTA[];
  underperformingSegments: UserSegment[];
  recommendedActions: string[];
  activeABTests: ABTestConfig[];
  predictionModels: {
    churnPrediction: number; // accuracy %
    lifetimeValuePrediction: number; // accuracy %
  };
}

// ============================================
// USER SEGMENTATION SERVICE
// ============================================

export class UserSegmentationService {
  // ==========================================
  // 1. User Segmentation Analysis
  // ==========================================

  /**
   * Analyze and segment a user across multiple dimensions
   */
  static async segmentUser(userId: string): Promise<UserSegment> {
    try {
      const segment: UserSegment = {
        id: uuidv4(),
        userId,
        lifecycle: 'active',
        value: 'medium',
        engagement: 'medium',
        serviceTypes: [],
        behaviorPatterns: [],
        riskFactors: [],
        recommendedCTAs: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
      };

      // Get user activity data
      const activityResult = await query(
        `SELECT
          u.id, u.created_at, u.last_login, u.email_verified,
          COUNT(DISTINCT CASE WHEN a.action_type = 'service_used' THEN a.id END) as services_used,
          COUNT(DISTINCT CASE WHEN a.action_type = 'purchase' THEN a.id END) as purchases,
          COUNT(a.id) as total_actions,
          SUM(CASE WHEN a.action_type = 'purchase' THEN a.metadata->>'amount'::numeric ELSE 0 END) as lifetime_value
         FROM users u
         LEFT JOIN user_activities a ON u.id = a.user_id AND a.created_at > NOW() - INTERVAL '90 days'
         WHERE u.id = $1
         GROUP BY u.id, u.created_at, u.last_login, u.email_verified`,
        [userId]
      );

      if (activityResult.rows.length === 0) {
        throw new Error(`User ${userId} not found`);
      }

      const userData = activityResult.rows[0];

      // Determine lifecycle stage
      segment.lifecycle = this.determineLifecycleStage(userData);

      // Determine value tier
      segment.value = this.determineValueTier(userData);

      // Determine engagement level
      segment.engagement = this.determineEngagementLevel(userData);

      // Get service types used
      const servicesResult = await query(
        `SELECT DISTINCT service_type FROM user_activities
         WHERE user_id = $1 AND action_type = 'service_used'
         AND created_at > NOW() - INTERVAL '180 days'`,
        [userId]
      );

      segment.serviceTypes = servicesResult.rows.map((r) => r.service_type);

      // Identify behavior patterns
      segment.behaviorPatterns = await this.identifyBehaviorPatterns(userId);

      // Calculate risk factors
      segment.riskFactors = await this.calculateRiskFactors(userId, userData);

      // Generate recommended CTAs
      segment.recommendedCTAs = await this.generateRecommendedCTAs(segment);

      // Save segment to database
      await query(
        `INSERT INTO user_segments (id, user_id, lifecycle, value, engagement, service_types, behavior_patterns, risk_factors, created_at, last_updated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id) DO UPDATE SET
           lifecycle = $3,
           value = $4,
           engagement = $5,
           service_types = $6,
           behavior_patterns = $7,
           risk_factors = $8,
           last_updated = $10`,
        [
          segment.id,
          userId,
          segment.lifecycle,
          segment.value,
          segment.engagement,
          JSON.stringify(segment.serviceTypes),
          JSON.stringify(segment.behaviorPatterns),
          JSON.stringify(segment.riskFactors),
          segment.createdAt,
          segment.lastUpdated,
        ]
      );

      return segment;
    } catch (error) {
      console.error('Error segmenting user:', error);
      throw error;
    }
  }

  /**
   * Determine lifecycle stage based on user behavior
   */
  private static determineLifecycleStage(userData: any): UserSegment['lifecycle'] {
    const accountAgeDays = (Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const daysSinceLastLogin =
      (Date.now() - new Date(userData.last_login).getTime()) / (1000 * 60 * 60 * 24);

    if (accountAgeDays < 30) {
      return 'new';
    } else if (daysSinceLastLogin > 180) {
      return 'churned';
    } else if (daysSinceLastLogin > 60) {
      return 'at-risk';
    } else if (accountAgeDays > 365) {
      return 'loyal';
    } else {
      return 'active';
    }
  }

  /**
   * Determine user value tier based on LTV and engagement
   */
  private static determineValueTier(userData: any): UserSegment['value'] {
    const lifetimeValue = parseFloat(userData.lifetime_value) || 0;
    const purchases = userData.purchases || 0;

    if (lifetimeValue > 5000 || purchases > 50) {
      return 'high';
    } else if (lifetimeValue > 1000 || purchases > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Determine engagement level
   */
  private static determineEngagementLevel(userData: any): UserSegment['engagement'] {
    const totalActions = userData.total_actions || 0;
    const daysSinceLastLogin =
      (Date.now() - new Date(userData.last_login).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceLastLogin > 180) {
      return 'inactive';
    } else if (totalActions > 100) {
      return 'high';
    } else if (totalActions > 20) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Identify user behavior patterns
   */
  private static async identifyBehaviorPatterns(userId: string): Promise<BehaviorPattern[]> {
    try {
      const result = await query(
        `SELECT action_type, COUNT(*) as frequency, MAX(created_at) as last_occurred
         FROM user_activities
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
         GROUP BY action_type
         ORDER BY frequency DESC
         LIMIT 10`,
        [userId]
      );

      return result.rows.map((row) => ({
        pattern: row.action_type,
        frequency: row.frequency,
        lastOccurred: row.last_occurred,
        severity: row.frequency > 20 ? 'high' : row.frequency > 10 ? 'medium' : 'low',
      }));
    } catch (error) {
      console.error('Error identifying behavior patterns:', error);
      return [];
    }
  }

  /**
   * Calculate risk factors for a user
   */
  private static async calculateRiskFactors(userId: string, userData: any): Promise<RiskFactor[]> {
    const riskFactors: RiskFactor[] = [];

    const daysSinceLastLogin =
      (Date.now() - new Date(userData.last_login).getTime()) / (1000 * 60 * 60 * 24);
    const totalActions = userData.total_actions || 0;

    // Low engagement risk
    if (daysSinceLastLogin > 30) {
      riskFactors.push({
        type: 'low-engagement',
        score: Math.min(100, daysSinceLastLogin * 2),
        description: `User hasn't logged in for ${Math.floor(daysSinceLastLogin)} days`,
      });
    }

    // Churn risk
    if (daysSinceLastLogin > 60 && totalActions < 20) {
      riskFactors.push({
        type: 'high-churn-risk',
        score: Math.min(100, (daysSinceLastLogin - 60) * 1.5),
        description: 'User showing signs of disengagement and churn risk',
      });
    }

    // Support needed
    if (daysSinceLastLogin < 3 && totalActions > 50) {
      riskFactors.push({
        type: 'support-needed',
        score: 60,
        description: 'Highly active user may need additional support',
      });
    }

    // Upsell opportunity
    if (userData.lifetime_value > 1000 && userData.purchases < 10) {
      riskFactors.push({
        type: 'upsell-opportunity',
        score: 75,
        description: 'High-value user ready for premium services',
      });
    }

    return riskFactors;
  }

  /**
   * Generate recommended CTAs for a segment
   */
  private static async generateRecommendedCTAs(segment: UserSegment): Promise<CTA[]> {
    const ctas: CTA[] = [];
    const ctaMap: Record<string, Record<string, CTA>> = {
      new: {
        high: {
          id: uuidv4(),
          segment: 'new',
          action: 'complete_onboarding',
          text: 'Complete Your Profile',
          priority: 'high',
          conversionRate: 0.45,
        },
      },
      active: {
        high: {
          id: uuidv4(),
          segment: 'active',
          action: 'upgrade_plan',
          text: 'Upgrade to Pro',
          priority: 'high',
          conversionRate: 0.32,
        },
      },
      'at-risk': {
        high: {
          id: uuidv4(),
          segment: 'at-risk',
          action: 'retention_offer',
          text: 'Special Offer: 50% Off',
          priority: 'high',
          conversionRate: 0.28,
        },
      },
      loyal: {
        high: {
          id: uuidv4(),
          segment: 'loyal',
          action: 'vip_program',
          text: 'Join VIP Program',
          priority: 'medium',
          conversionRate: 0.52,
        },
      },
    };

    if (ctaMap[segment.lifecycle] && ctaMap[segment.lifecycle][segment.value]) {
      ctas.push(ctaMap[segment.lifecycle][segment.value]);
    }

    return ctas;
  }

  // ==========================================
  // 2. CTA & Journey Management
  // ==========================================

  /**
   * Get personalized CTAs for a user
   */
  static async getPersonalizedCTAs(userId: string): Promise<CTA[]> {
    try {
      const segmentResult = await query(
        `SELECT recommended_ctas FROM user_segments WHERE user_id = $1`,
        [userId]
      );

      if (segmentResult.rows.length === 0) {
        return [];
      }

      return segmentResult.rows[0].recommended_ctas || [];
    } catch (error) {
      console.error('Error getting personalized CTAs:', error);
      return [];
    }
  }

  /**
   * Get personalized journey for a user
   */
  static async getPersonalizedJourney(userId: string): Promise<PersonalizedJourney | null> {
    try {
      const segmentResult = await query(
        `SELECT * FROM user_segments WHERE user_id = $1`,
        [userId]
      );

      if (segmentResult.rows.length === 0) {
        return null;
      }

      const segment = segmentResult.rows[0];

      // Get recommended content
      const contentResult = await query(
        `SELECT * FROM content_recommendations
         WHERE segment_type = $1 AND is_active = true
         ORDER BY relevance_score DESC LIMIT 5`,
        [segment.lifecycle]
      );

      const journey: PersonalizedJourney = {
        userId,
        segmentId: segment.id,
        journeyStage: segment.lifecycle,
        recommendedContent: contentResult.rows || [],
        nextSteps: this.generateNextSteps(segment),
        estimatedTimeToConversion: this.estimateTimeToConversion(segment),
        successProbability: this.calculateSuccessProbability(segment),
      };

      return journey;
    } catch (error) {
      console.error('Error getting personalized journey:', error);
      return null;
    }
  }

  /**
   * Track CTA interaction
   */
  static async trackCTAInteraction(
    userId: string,
    ctaId: string,
    action: 'shown' | 'clicked' | 'converted'
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO cta_interactions (id, user_id, cta_id, action, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), userId, ctaId, action, new Date()]
      );

      // Update segment performance
      await this.updateSegmentPerformance(userId);
    } catch (error) {
      console.error('Error tracking CTA interaction:', error);
      throw error;
    }
  }

  // ==========================================
  // 3. A/B Testing
  // ==========================================

  /**
   * Create A/B test for a segment
   */
  static async createABTest(config: Omit<ABTestConfig, 'id'>): Promise<ABTestConfig> {
    try {
      const id = uuidv4();

      await query(
        `INSERT INTO ab_tests (id, test_name, segment, variant1_cta, variant2_cta, start_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          config.testName,
          config.segment,
          JSON.stringify(config.variant1.cta),
          JSON.stringify(config.variant2.cta),
          config.startDate,
          config.status,
        ]
      );

      return {
        ...config,
        id,
        resultsVariant1: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          conversionRate: 0,
          cpc: 0,
          roas: 0,
        },
        resultsVariant2: {
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
          conversionRate: 0,
          cpc: 0,
          roas: 0,
        },
      };
    } catch (error) {
      console.error('Error creating A/B test:', error);
      throw error;
    }
  }

  /**
   * Get variant for A/B test
   */
  static async getVariantForABTest(userId: string, testId: string): Promise<CTA | null> {
    try {
      const result = await query(
        `SELECT variant1_cta, variant1_weight, variant2_cta, variant2_weight
         FROM ab_tests WHERE id = $1`,
        [testId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const test = result.rows[0];
      const randomValue = Math.random();

      const variant1Weight = test.variant1_weight || 0.5;
      const cta = randomValue < variant1Weight ? test.variant1_cta : test.variant2_cta;

      // Record test assignment
      await query(
        `INSERT INTO ab_test_assignments (id, test_id, user_id, variant, assigned_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), testId, userId, randomValue < variant1Weight ? 'variant1' : 'variant2', new Date()]
      );

      return cta;
    } catch (error) {
      console.error('Error getting test variant:', error);
      return null;
    }
  }

  /**
   * Record A/B test result
   */
  static async recordABTestResult(
    testId: string,
    variant: 'variant1' | 'variant2',
    result: Partial<TestResults>
  ): Promise<void> {
    try {
      await query(
        `UPDATE ab_tests
         SET ${variant}_results = ${variant}_results || $1
         WHERE id = $2`,
        [JSON.stringify(result), testId]
      );
    } catch (error) {
      console.error('Error recording test result:', error);
      throw error;
    }
  }

  /**
   * End A/B test and determine winner
   */
  static async endABTest(testId: string): Promise<{ winner: 'variant1' | 'variant2'; uplift: number }> {
    try {
      const result = await query(
        `SELECT variant1_results, variant2_results FROM ab_tests WHERE id = $1`,
        [testId]
      );

      if (result.rows.length === 0) {
        throw new Error('Test not found');
      }

      const test = result.rows[0];
      const r1 = test.variant1_results;
      const r2 = test.variant2_results;

      const winner = (r1?.conversionRate || 0) > (r2?.conversionRate || 0) ? 'variant1' : 'variant2';
      const winnerRate =
        winner === 'variant1' ? r1?.conversionRate || 0 : r2?.conversionRate || 0;
      const loserRate =
        winner === 'variant1' ? r2?.conversionRate || 0 : r1?.conversionRate || 0;
      const uplift = ((winnerRate - loserRate) / loserRate) * 100;

      await query(`UPDATE ab_tests SET status = $1, end_date = $2 WHERE id = $3`, [
        'completed',
        new Date(),
        testId,
      ]);

      return { winner, uplift };
    } catch (error) {
      console.error('Error ending A/B test:', error);
      throw error;
    }
  }

  // ==========================================
  // 4. Performance & Analytics
  // ==========================================

  /**
   * Get segment performance metrics
   */
  static async getSegmentPerformance(segmentId: string): Promise<SegmentPerformance | null> {
    try {
      const result = await query(
        `SELECT * FROM segment_performance WHERE segment_id = $1 ORDER BY timestamp DESC LIMIT 1`,
        [segmentId]
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting segment performance:', error);
      return null;
    }
  }

  /**
   * Update segment performance metrics
   */
  private static async updateSegmentPerformance(userId: string): Promise<void> {
    try {
      const segmentResult = await query(
        `SELECT id, lifecycle, value FROM user_segments WHERE user_id = $1`,
        [userId]
      );

      if (segmentResult.rows.length === 0) return;

      const segment = segmentResult.rows[0];

      const statsResult = await query(
        `SELECT
          COUNT(CASE WHEN action = 'shown' THEN 1 END) as ctas_shown,
          COUNT(CASE WHEN action = 'clicked' THEN 1 END) as ctas_clicked,
          COUNT(CASE WHEN action = 'converted' THEN 1 END) as conversions,
          COALESCE(SUM(CASE WHEN action = 'converted' THEN revenue ELSE 0 END), 0) as revenue,
          EXTRACT(DAY FROM NOW() - u.created_at) as retention_days,
          COALESCE(MAX(churn_risk), 0) as churn_risk
         FROM cta_interactions
         JOIN users u ON u.id = $1
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
        [userId]
      );

      if (statsResult.rows.length > 0) {
        const stats = statsResult.rows[0];
        const conversionRate = stats.ctas_shown > 0 ? stats.ctas_clicked / stats.ctas_shown : 0;

        await query(
          `INSERT INTO segment_performance (id, segment_id, user_id, segment, value, ctas_shown, ctas_clicked, conversion_rate, revenue, retention, churn_risk, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            uuidv4(),
            segment.id,
            userId,
            segment.lifecycle,
            segment.value,
            stats.ctas_shown,
            stats.ctas_clicked,
            conversionRate,
            stats.revenue,
            stats.retention_days,
            stats.churn_risk,
            new Date(),
          ]
        );
      }
    } catch (error) {
      console.error('Error updating segment performance:', error);
    }
  }

  /**
   * Get segmentation dashboard metrics
   */
  static async getSegmentationMetrics(): Promise<SegmentationMetrics> {
    try {
      const totalUsersResult = await query(`SELECT COUNT(*) as total FROM user_segments`);
      const totalUsers = totalUsersResult.rows[0].total;

      const lifecycleResult = await query(
        `SELECT lifecycle, COUNT(*) as count FROM user_segments GROUP BY lifecycle`
      );

      const valueResult = await query(
        `SELECT value, COUNT(*) as count FROM user_segments GROUP BY value`
      );

      const engagementResult = await query(
        `SELECT engagement, COUNT(*) as count FROM user_segments GROUP BY engagement`
      );

      const performanceResult = await query(
        `SELECT AVG(conversion_rate) as avg_conversion, AVG(churn_risk) as avg_churn
         FROM segment_performance
         WHERE created_at > NOW() - INTERVAL '30 days'`
      );

      const riskFactorsResult = await query(
        `SELECT DISTINCT risk_factors FROM user_segments
         WHERE risk_factors IS NOT NULL
         ORDER BY risk_factors DESC
         LIMIT 5`
      );

      return {
        totalUsers,
        segmentDistribution: Object.fromEntries(
          lifecycleResult.rows.map((r) => [r.lifecycle, r.count])
        ),
        lifecycleBreakdown: Object.fromEntries(
          lifecycleResult.rows.map((r) => [r.lifecycle, r.count])
        ),
        valueBreakdown: Object.fromEntries(valueResult.rows.map((r) => [r.value, r.count])),
        engagementBreakdown: Object.fromEntries(
          engagementResult.rows.map((r) => [r.engagement, r.count])
        ),
        averageConversionRate: performanceResult.rows[0]?.avg_conversion || 0,
        averageChurnRisk: performanceResult.rows[0]?.avg_churn || 0,
        topRiskFactors: riskFactorsResult.rows.map((r) => r.risk_factors).flat(),
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error getting segmentation metrics:', error);
      throw error;
    }
  }

  /**
   * Get admin segmentation dashboard
   */
  static async getAdminDashboard(): Promise<AdminSegmentationDashboard> {
    try {
      const metrics = await this.getSegmentationMetrics();

      const topCTAsResult = await query(
        `SELECT c.*, COUNT(i.id) as interaction_count, COUNT(CASE WHEN i.action = 'converted' THEN 1 END) as conversion_count
         FROM recommended_ctas c
         LEFT JOIN cta_interactions i ON c.id = i.cta_id
         GROUP BY c.id
         ORDER BY interaction_count DESC
         LIMIT 10`
      );

      const underperformingResult = await query(
        `SELECT us.*, sp.churn_risk, sp.conversion_rate
         FROM user_segments us
         LEFT JOIN segment_performance sp ON us.id = sp.segment_id
         WHERE sp.churn_risk > 70 OR sp.conversion_rate < 0.1
         ORDER BY sp.churn_risk DESC
         LIMIT 10`
      );

      const activeABTestsResult = await query(
        `SELECT * FROM ab_tests WHERE status = 'active'`
      );

      return {
        id: uuidv4(),
        generatedAt: new Date(),
        metrics,
        topPerformingCTAs: topCTAsResult.rows || [],
        underperformingSegments: underperformingResult.rows || [],
        recommendedActions: this.generateRecommendedActions(metrics),
        activeABTests: activeABTestsResult.rows || [],
        predictionModels: {
          churnPrediction: 0.82,
          lifetimeValuePrediction: 0.76,
        },
      };
    } catch (error) {
      console.error('Error getting admin dashboard:', error);
      throw error;
    }
  }

  /**
   * Generate next steps for a journey
   */
  private static generateNextSteps(segment: any): string[] {
    const steps: string[] = [];

    if (segment.lifecycle === 'new') {
      steps.push('Complete profile setup');
      steps.push('Verify email address');
      steps.push('Take platform tour');
    } else if (segment.lifecycle === 'at-risk') {
      steps.push('Claim special retention offer');
      steps.push('Schedule support consultation');
      steps.push('Explore new features');
    } else if (segment.lifecycle === 'loyal') {
      steps.push('Upgrade to premium tier');
      steps.push('Join VIP program');
      steps.push('Refer a friend');
    }

    return steps;
  }

  /**
   * Estimate time to conversion
   */
  private static estimateTimeToConversion(segment: any): number {
    const estimates: Record<string, number> = {
      new: 14,
      active: 7,
      'at-risk': 3,
      loyal: 1,
      churned: 30,
    };

    return estimates[segment.lifecycle] || 7;
  }

  /**
   * Calculate success probability
   */
  private static calculateSuccessProbability(segment: any): number {
    const probabilities: Record<string, number> = {
      new: 65,
      active: 75,
      'at-risk': 45,
      loyal: 85,
      churned: 20,
    };

    return probabilities[segment.lifecycle] || 50;
  }

  /**
   * Generate recommended actions for dashboard
   */
  private static generateRecommendedActions(metrics: SegmentationMetrics): string[] {
    const actions: string[] = [];

    if (metrics.averageChurnRisk > 60) {
      actions.push('Create retention campaign for at-risk users');
    }

    if (metrics.averageConversionRate < 0.2) {
      actions.push('Launch A/B test for low-performing CTAs');
    }

    if ((metrics.segmentDistribution['new'] || 0) > metrics.totalUsers * 0.3) {
      actions.push('Strengthen onboarding process');
    }

    if ((metrics.segmentDistribution['loyal'] || 0) > metrics.totalUsers * 0.4) {
      actions.push('Create upsell program for loyal customers');
    }

    return actions;
  }
}

export default UserSegmentationService;
