// Churn Prediction & Win-Back Campaign Service
// ML-driven churn probability calculation and win-back orchestration

import { query } from '../database/connection';
import { sendEmail } from '../services/emailService';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // Cast: the installed SDK's types pin this literal to its own release.
  // Keep the pinned version - upgrading Stripe's API is a deliberate decision,
  // not a side effect of satisfying the compiler.
  apiVersion: '2023-10-16' as any,
});

// ============================================
// TYPES & INTERFACES
// ============================================

export interface UserBehaviorMetrics {
  userId: string;
  lastLoginDaysAgo: number;
  totalCasesSubmitted: number;
  casesInLast90Days: number;
  casesInLast30Days: number;
  averageSpendPerCase: number;
  totalSpent: number;
  accountAgeDays: number;
  supportTicketsCount: number;
  supportTicketsUnresolved: number;
  messageResponseTime: number; // avg hours
  caseCompletionRate: number; // percentage
  lastActivityDaysAgo: number;
  subscriptionStatus: 'active' | 'paused' | 'cancelled';
  hasActiveRetainer: boolean;
  ratingScore: number; // 1-5 based on reviews
  platformEngagementScore: number; // 0-100
}

export interface ChurnPredictionResult {
  userId: string;
  email: string;
  churnProbability: number; // 0-1
  riskSegment: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  recommendedActions: string[];
  retentionScore: number; // 0-100
  predictedValueAtRisk: number;
  lastPredictionUpdate: Date;
}

export interface WinBackCampaign {
  id: string;
  userId: string;
  email: string;
  churnProbability: number;
  riskSegment: string;
  campaignStatus: 'pending' | 'email_sent' | 'offer_accepted' | 'offer_declined' | 'user_retained' | 'churned';
  campaignStartDate: Date;
  campaignEndDate?: Date;

  // Offer details
  discountPercentage: number;
  discountExpiryDays: number;
  prioritySupportEnabled: boolean;

  // Email campaign
  emailSentAt?: Date;
  emailOpenedAt?: Date;
  emailClickedAt?: Date;

  // Tracking
  impressions: number;
  clicks: number;
  conversions: number;
  conversionDate?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface ChurnAnalytics {
  totalUsersAnalyzed: number;
  usersAtRisk: number;
  averageChurnProbability: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  campaignMetrics: {
    totalCampaigns: number;
    emailsSent: number;
    emailOpenRate: number;
    clickThroughRate: number;
    conversionRate: number;
    averageRetentionIncrease: number;
  };
  predictedMonthlyChurn: {
    usersAtRisk: number;
    potentialRevenueLoss: number;
  };
}

// ============================================
// ML MODEL: CHURN PREDICTION
// ============================================

class ChurnPredictionModel {
  /**
   * Calculate churn probability using weighted feature scoring
   * Features based on user engagement, activity, and transaction patterns
   */
  predictChurnProbability(metrics: UserBehaviorMetrics): number {
    let churnScore = 0;
    const weights: Record<string, number> = {
      inactivity: 0.25,
      lowEngagement: 0.20,
      lowTransactionValue: 0.15,
      supportIssues: 0.15,
      accountAge: 0.10,
      responseTime: 0.10,
      ratingScore: 0.05,
    };

    // 1. INACTIVITY SCORE (0-1)
    // Users inactive for >60 days are high risk
    let inactivityScore = Math.min(metrics.lastLoginDaysAgo / 60, 1);
    if (metrics.lastActivityDaysAgo > 90) inactivityScore = Math.min(inactivityScore + 0.3, 1);

    // 2. ENGAGEMENT SCORE (0-1)
    // Low engagement = few cases, low activity
    let engagementScore = 0;
    if (metrics.casesInLast30Days === 0 && metrics.casesInLast90Days === 0) {
      engagementScore = 1; // No activity in 90 days = high risk
    } else if (metrics.casesInLast30Days === 0) {
      engagementScore = 0.6; // No recent activity
    } else if (metrics.casesInLast90Days < 2) {
      engagementScore = 0.4; // Low activity
    }

    // 3. TRANSACTION VALUE SCORE (0-1)
    // Users spending very little are higher churn risk
    let transactionScore = 0;
    if (metrics.totalSpent === 0) {
      transactionScore = 1; // Free trial user, no conversion
    } else if (metrics.averageSpendPerCase < 50) {
      transactionScore = 0.6; // Very low spend
    } else if (metrics.averageSpendPerCase < 200) {
      transactionScore = 0.3;
    }

    // 4. SUPPORT ISSUES SCORE (0-1)
    // Unresolved support tickets indicate dissatisfaction
    let supportScore = 0;
    if (metrics.supportTicketsUnresolved > 2) {
      supportScore = 0.8;
    } else if (metrics.supportTicketsUnresolved === 2) {
      supportScore = 0.5;
    } else if (metrics.supportTicketsUnresolved === 1) {
      supportScore = 0.2;
    }

    // 5. ACCOUNT AGE SCORE (0-1)
    // New accounts have higher natural churn; mature accounts are more stable
    let accountAgeScore = 0;
    if (metrics.accountAgeDays < 30) {
      accountAgeScore = 0.6; // High churn for new users
    } else if (metrics.accountAgeDays < 90) {
      accountAgeScore = 0.3;
    } else if (metrics.accountAgeDays > 365) {
      accountAgeScore = 0.05; // Long-term users rarely churn
    }

    // 6. RESPONSE TIME SCORE (0-1)
    // Slow response from attorneys indicates poor engagement
    let responseTimeScore = 0;
    if (metrics.messageResponseTime > 72) {
      responseTimeScore = 0.5;
    } else if (metrics.messageResponseTime > 24) {
      responseTimeScore = 0.2;
    }

    // 7. RATING SCORE (0-1)
    // Low ratings indicate dissatisfaction
    let ratingScore = 0;
    if (metrics.ratingScore < 2) {
      ratingScore = 0.7;
    } else if (metrics.ratingScore < 3) {
      ratingScore = 0.4;
    } else if (metrics.ratingScore < 4) {
      ratingScore = 0.1;
    }

    // Calculate weighted churn score
    churnScore =
      inactivityScore * weights.inactivity +
      engagementScore * weights.lowEngagement +
      transactionScore * weights.lowTransactionValue +
      supportScore * weights.supportIssues +
      accountAgeScore * weights.accountAge +
      responseTimeScore * weights.responseTime +
      ratingScore * weights.ratingScore;

    // Apply subscription status modifier
    if (metrics.subscriptionStatus === 'paused') {
      churnScore = Math.min(churnScore + 0.3, 1);
    } else if (metrics.subscriptionStatus === 'cancelled') {
      churnScore = 0.95; // Already churned
    }

    // If user has active retainer, reduce churn probability
    if (metrics.hasActiveRetainer) {
      churnScore = Math.max(churnScore - 0.2, 0);
    }

    return Math.min(Math.max(churnScore, 0), 1);
  }

  /**
   * Classify risk segment based on churn probability
   */
  classifyRiskSegment(churnProbability: number): 'low' | 'medium' | 'high' | 'critical' {
    if (churnProbability >= 0.75) return 'critical';
    if (churnProbability >= 0.55) return 'high';
    if (churnProbability >= 0.35) return 'medium';
    return 'low';
  }

  /**
   * Identify primary risk factors
   */
  identifyRiskFactors(metrics: UserBehaviorMetrics): string[] {
    const factors: string[] = [];

    if (metrics.lastLoginDaysAgo > 60) {
      factors.push('No login activity in 60+ days');
    }
    if (metrics.casesInLast90Days === 0) {
      factors.push('No cases submitted in 90 days');
    }
    if (metrics.totalSpent === 0) {
      factors.push('No transactions completed');
    }
    if (metrics.supportTicketsUnresolved > 2) {
      factors.push('Multiple unresolved support tickets');
    }
    if (metrics.messageResponseTime > 72) {
      factors.push('Slow response from service providers');
    }
    if (metrics.ratingScore < 3) {
      factors.push('Low satisfaction rating');
    }
    if (metrics.subscriptionStatus !== 'active') {
      factors.push(`Subscription status: ${metrics.subscriptionStatus}`);
    }
    if (metrics.caseCompletionRate < 50) {
      factors.push('Low case completion rate');
    }

    return factors;
  }

  /**
   * Recommend retention actions based on risk profile
   */
  recommendRetentionActions(metrics: UserBehaviorMetrics, riskSegment: string): string[] {
    const actions: string[] = [];

    if (riskSegment === 'critical') {
      actions.push('VIP support outreach');
      actions.push('Personalized win-back discount (15-20%)');
      actions.push('Priority support for next 30 days');
      actions.push('Account review call with success manager');
    } else if (riskSegment === 'high') {
      actions.push('Email campaign with personal touch');
      actions.push('Moderate discount offer (10-15%)');
      actions.push('Priority support enrollment');
      actions.push('Educational content on platform features');
    } else if (riskSegment === 'medium') {
      actions.push('Targeted email campaign');
      actions.push('Small discount offer (5-10%)');
      actions.push('Feature education');
      actions.push('Success stories case studies');
    }

    if (metrics.supportTicketsUnresolved > 0) {
      actions.push('Resolve outstanding support tickets');
    }

    return actions;
  }

  /**
   * Calculate retention score (inverse of churn probability)
   */
  calculateRetentionScore(churnProbability: number): number {
    return Math.round((1 - churnProbability) * 100);
  }

  /**
   * Estimate revenue at risk
   */
  estimateValueAtRisk(metrics: UserBehaviorMetrics): number {
    // Calculate average monthly spend
    const monthlySpend = metrics.totalSpent / Math.max(metrics.accountAgeDays / 30, 1);

    // Estimate 12-month value at risk
    return Math.round(monthlySpend * 12);
  }
}

// ============================================
// SERVICE: CHURN PREDICTION & MANAGEMENT
// ============================================

export class ChurnPredictionService {
  private model = new ChurnPredictionModel();

  /**
   * Fetch user behavior metrics from database
   */
  async getUserBehaviorMetrics(userId: string): Promise<UserBehaviorMetrics | null> {
    try {
      const result = await query(`
        SELECT
          u.id,
          u.email,
          u.created_at,
          EXTRACT(DAY FROM NOW() - u.created_at) as account_age_days,
          EXTRACT(DAY FROM NOW() - COALESCE(u.last_login, u.created_at)) as last_login_days_ago,
          EXTRACT(DAY FROM NOW() - COALESCE(u.last_activity, u.created_at)) as last_activity_days_ago,
          COUNT(DISTINCT CASE WHEN c.created_at > NOW() - INTERVAL '90 days' THEN c.id END) as cases_in_90_days,
          COUNT(DISTINCT CASE WHEN c.created_at > NOW() - INTERVAL '30 days' THEN c.id END) as cases_in_30_days,
          COUNT(DISTINCT c.id) as total_cases,
          COALESCE(AVG(CASE WHEN c.budget_max > 0 THEN c.budget_max END), 0) as avg_spend_per_case,
          COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_spent,
          COUNT(DISTINCT CASE WHEN st.status = 'open' THEN st.id END) as support_unresolved,
          COUNT(DISTINCT st.id) as support_total,
          COALESCE(AVG(EXTRACT(EPOCH FROM (m.created_at - m.sent_at))/3600), 0) as avg_message_response_hours,
          COALESCE(COUNT(DISTINCT CASE WHEN c.status = 'completed' THEN c.id END)::float /
                   NULLIF(COUNT(DISTINCT c.id), 0), 0) as case_completion_rate,
          COALESCE(AVG(r.rating), 0) as rating_score,
          COALESCE(s.status, 'active') as subscription_status,
          CASE WHEN ret.id IS NOT NULL THEN true ELSE false END as has_active_retainer
        FROM users u
        LEFT JOIN cases c ON u.id = c.client_id
        LEFT JOIN payments p ON u.id = p.user_id
        LEFT JOIN support_tickets st ON u.id = st.user_id
        LEFT JOIN messages m ON u.id = m.sender_id AND m.response_to_id IS NOT NULL
        LEFT JOIN reviews r ON u.id = r.client_id
        LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status != 'cancelled'
        LEFT JOIN retainers ret ON u.id = ret.client_id AND ret.status = 'active'
        WHERE u.id = $1 AND u.deleted_at IS NULL
        GROUP BY u.id, u.email, u.created_at, u.last_login, u.last_activity, s.status, ret.id
      `, [userId]);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        userId: row.id,
        lastLoginDaysAgo: row.last_login_days_ago || 999,
        totalCasesSubmitted: parseInt(row.total_cases) || 0,
        casesInLast90Days: parseInt(row.cases_in_90_days) || 0,
        casesInLast30Days: parseInt(row.cases_in_30_days) || 0,
        averageSpendPerCase: parseFloat(row.avg_spend_per_case) || 0,
        totalSpent: parseFloat(row.total_spent) || 0,
        accountAgeDays: parseInt(row.account_age_days) || 0,
        supportTicketsCount: parseInt(row.support_total) || 0,
        supportTicketsUnresolved: parseInt(row.support_unresolved) || 0,
        messageResponseTime: parseFloat(row.avg_message_response_hours) || 0,
        caseCompletionRate: parseFloat(row.case_completion_rate) || 0,
        lastActivityDaysAgo: row.last_activity_days_ago || 999,
        subscriptionStatus: row.subscription_status || 'active',
        hasActiveRetainer: row.has_active_retainer || false,
        ratingScore: parseFloat(row.rating_score) || 3,
        platformEngagementScore: this.calculateEngagementScore(row),
      };
    } catch (error) {
      console.error(`Error fetching behavior metrics for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Calculate platform engagement score (0-100)
   */
  private calculateEngagementScore(row: any): number {
    const casesInMonth = parseInt(row.cases_in_30_days) || 0;
    const messageResponseHours = parseFloat(row.avg_message_response_hours) || 0;
    const completionRate = parseFloat(row.case_completion_rate) || 0;

    let score = 50; // Base score

    // Cases activity
    if (casesInMonth >= 3) score += 30;
    else if (casesInMonth >= 1) score += 15;

    // Response time quality
    if (messageResponseHours < 24) score += 10;
    else if (messageResponseHours < 72) score += 5;

    // Completion rate
    score += completionRate * 10;

    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Predict churn for a single user
   */
  async predictChurnForUser(userId: string): Promise<ChurnPredictionResult | null> {
    const metrics = await this.getUserBehaviorMetrics(userId);
    if (!metrics) return null;

    const churnProbability = this.model.predictChurnProbability(metrics);
    const riskSegment = this.model.classifyRiskSegment(churnProbability);
    const riskFactors = this.model.identifyRiskFactors(metrics);
    const recommendedActions = this.model.recommendRetentionActions(metrics, riskSegment);
    const retentionScore = this.model.calculateRetentionScore(churnProbability);
    const predictedValueAtRisk = this.model.estimateValueAtRisk(metrics);

    const result: ChurnPredictionResult = {
      userId,
      email: '', // Will be fetched from DB
      churnProbability,
      riskSegment,
      riskFactors,
      recommendedActions,
      retentionScore,
      predictedValueAtRisk,
      lastPredictionUpdate: new Date(),
    };

    // Fetch email
    const userResult = await query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userResult.rows?.length > 0) {
      result.email = userResult.rows[0].email;
    }

    // Store prediction in database
    await this.storePrediction(result);

    return result;
  }

  /**
   * Predict churn for all active users
   */
  async predictChurnForAllUsers(): Promise<ChurnPredictionResult[]> {
    try {
      const usersResult = await query(`
        SELECT DISTINCT u.id FROM users u
        WHERE u.deleted_at IS NULL
        AND u.user_type = 'client'
        LIMIT 5000
      `);

      const predictions: ChurnPredictionResult[] = [];

      for (const user of usersResult.rows) {
        try {
          const prediction = await this.predictChurnForUser(user.id);
          if (prediction) {
            predictions.push(prediction);
          }
        } catch (error) {
          console.error(`Error predicting churn for user ${user.id}:`, error);
        }
      }

      return predictions;
    } catch (error) {
      console.error('Error predicting churn for all users:', error);
      return [];
    }
  }

  /**
   * Store churn prediction in database
   */
  private async storePrediction(prediction: ChurnPredictionResult): Promise<void> {
    try {
      await query(`
        INSERT INTO churn_predictions
        (user_id, email, churn_probability, risk_segment, risk_factors,
         recommended_actions, retention_score, value_at_risk, predicted_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          churn_probability = $3,
          risk_segment = $4,
          risk_factors = $5,
          recommended_actions = $6,
          retention_score = $7,
          value_at_risk = $8,
          predicted_at = NOW()
      `, [
        prediction.userId,
        prediction.email,
        prediction.churnProbability,
        prediction.riskSegment,
        JSON.stringify(prediction.riskFactors),
        JSON.stringify(prediction.recommendedActions),
        prediction.retentionScore,
        prediction.predictedValueAtRisk,
      ]);
    } catch (error) {
      console.error('Error storing churn prediction:', error);
    }
  }

  /**
   * Get users at risk of churning
   */
  async getAtRiskUsers(minChurnProbability: number = 0.5, limit: number = 100): Promise<ChurnPredictionResult[]> {
    try {
      const result = await query(`
        SELECT
          user_id, email, churn_probability, risk_segment,
          risk_factors, recommended_actions, retention_score, value_at_risk
        FROM churn_predictions
        WHERE churn_probability >= $1
        AND risk_segment IN ('high', 'critical')
        ORDER BY churn_probability DESC
        LIMIT $2
      `, [minChurnProbability, limit]);

      return result.rows?.map((row: any) => ({
        userId: row.user_id,
        email: row.email,
        churnProbability: parseFloat(row.churn_probability),
        riskSegment: row.risk_segment,
        riskFactors: JSON.parse(row.risk_factors || '[]'),
        recommendedActions: JSON.parse(row.recommended_actions || '[]'),
        retentionScore: parseInt(row.retention_score),
        predictedValueAtRisk: parseFloat(row.value_at_risk),
        lastPredictionUpdate: new Date(),
      })) || [];
    } catch (error) {
      console.error('Error fetching at-risk users:', error);
      return [];
    }
  }

  /**
   * Create win-back campaign for user
   */
  async createWinBackCampaign(
    userId: string,
    prediction: ChurnPredictionResult,
    discountPercentage: number = 0,
    prioritySupportDays: number = 30
  ): Promise<WinBackCampaign | null> {
    try {
      const campaignId = `winback-${userId}-${Date.now()}`;

      const result = await query(`
        INSERT INTO win_back_campaigns
        (id, user_id, email, churn_probability, risk_segment, discount_percentage,
         discount_expiry_days, priority_support_enabled, campaign_status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', NOW(), NOW())
        RETURNING *
      `, [
        campaignId,
        userId,
        prediction.email,
        prediction.churnProbability,
        prediction.riskSegment,
        discountPercentage,
        discountPercentage > 0 ? 7 : 0, // 7-day expiry for discounts
        prioritySupportDays > 0,
      ]);

      if (!result.rows?.length) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        churnProbability: parseFloat(row.churn_probability),
        riskSegment: row.risk_segment,
        campaignStatus: row.campaign_status,
        campaignStartDate: new Date(row.created_at),
        discountPercentage: row.discount_percentage,
        discountExpiryDays: row.discount_expiry_days,
        prioritySupportEnabled: row.priority_support_enabled,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    } catch (error) {
      console.error('Error creating win-back campaign:', error);
      return null;
    }
  }

  /**
   * Send win-back email with personalized offer
   */
  async sendWinBackEmail(campaign: WinBackCampaign, prediction: ChurnPredictionResult): Promise<boolean> {
    try {
      const personalizationToken = Buffer.from(`${campaign.id}:${prediction.userId}`).toString('base64');
      const trackingPixel = `https://api.transcend-law.com/churn/track-open/${personalizationToken}`;
      const ctaLink = `https://transcend-law.com/winback?campaign=${personalizationToken}`;

      let emailContent = this.buildWinBackEmailContent(
        prediction,
        campaign,
        ctaLink,
        trackingPixel
      );

      await sendEmail(campaign.email, 'churnWinBack', {
        firstName: prediction.email.split('@')[0],
        discountPercentage: campaign.discountPercentage.toString(),
        discountExpiryDays: campaign.discountExpiryDays.toString(),
        prioritySupportText: campaign.prioritySupportEnabled ? 'including priority support' : '',
        ctaLink,
        trackingPixel,
      });

      // Update campaign status
      await query(`
        UPDATE win_back_campaigns
        SET campaign_status = 'email_sent', email_sent_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [campaign.id]);

      return true;
    } catch (error) {
      console.error('Error sending win-back email:', error);
      return false;
    }
  }

  /**
   * Build personalized win-back email content
   */
  private buildWinBackEmailContent(
    prediction: ChurnPredictionResult,
    campaign: WinBackCampaign,
    ctaLink: string,
    trackingPixel: string
  ): string {
    const primaryReason = prediction.riskFactors[0] || 'We miss you!';

    let subject = '';
    if (campaign.riskSegment === 'critical') {
      subject = `${campaign.discountPercentage}% off - We want you back, ${campaign.email.split('@')[0]}`;
    } else {
      subject = `Come back to Transcend Law - Special offer inside`;
    }

    return `
      <h2>We Miss You!</h2>
      <p>Hi ${campaign.email.split('@')[0]},</p>
      <p>We noticed you haven't been as active on Transcend Law lately. We value your business and want to help you get back on track.</p>

      ${campaign.discountPercentage > 0 ? `
        <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Special Offer: ${campaign.discountPercentage}% Off Your Next Service</h3>
          <p>Use this exclusive offer to get ${campaign.discountPercentage}% off your next legal service request.</p>
          <p><strong>Valid for ${campaign.discountExpiryDays} days</strong></p>
        </div>
      ` : ''}

      ${campaign.prioritySupportEnabled ? `
        <div style="background: #fff5e6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Free Priority Support for 30 Days</h3>
          <p>Get faster responses and dedicated support when you return.</p>
        </div>
      ` : ''}

      <p>We identified that: <strong>${primaryReason}</strong></p>

      <p>
        <a href="${ctaLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Redeem Your Offer
        </a>
      </p>

      <p>Questions? Our support team is here to help.</p>
      <img src="${trackingPixel}" width="1" height="1" alt="" />
    `;
  }

  /**
   * Track email opens
   */
  async trackEmailOpen(campaignId: string): Promise<void> {
    try {
      await query(`
        UPDATE win_back_campaigns
        SET email_opened_at = NOW(), impressions = impressions + 1, updated_at = NOW()
        WHERE id = $1
      `, [campaignId]);
    } catch (error) {
      console.error('Error tracking email open:', error);
    }
  }

  /**
   * Track campaign clicks
   */
  async trackCampaignClick(campaignId: string): Promise<void> {
    try {
      await query(`
        UPDATE win_back_campaigns
        SET email_clicked_at = NOW(), clicks = clicks + 1, updated_at = NOW()
        WHERE id = $1
      `, [campaignId]);
    } catch (error) {
      console.error('Error tracking campaign click:', error);
    }
  }

  /**
   * Mark offer as accepted
   */
  async markOfferAccepted(campaignId: string): Promise<void> {
    try {
      await query(`
        UPDATE win_back_campaigns
        SET campaign_status = 'offer_accepted', conversions = conversions + 1,
            conversion_date = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [campaignId]);
    } catch (error) {
      console.error('Error marking offer as accepted:', error);
    }
  }

  /**
   * Mark user as retained
   */
  async markUserRetained(userId: string): Promise<void> {
    try {
      // Find active campaign
      const campaignResult = await query(`
        SELECT id FROM win_back_campaigns
        WHERE user_id = $1 AND campaign_status IN ('email_sent', 'offer_accepted')
        ORDER BY created_at DESC LIMIT 1
      `, [userId]);

      if (campaignResult.rows?.length > 0) {
        const campaignId = campaignResult.rows[0].id;
        await query(`
          UPDATE win_back_campaigns
          SET campaign_status = 'user_retained', campaign_end_date = NOW(), updated_at = NOW()
          WHERE id = $1
        `, [campaignId]);
      }

      // Update churn prediction
      await query(`
        UPDATE churn_predictions
        SET churn_probability = GREATEST(churn_probability - 0.3, 0),
            retention_score = LEAST(retention_score + 30, 100),
            predicted_at = NOW()
        WHERE user_id = $1
      `, [userId]);
    } catch (error) {
      console.error('Error marking user as retained:', error);
    }
  }

  /**
   * Get churn analytics dashboard data
   */
  async getChurnAnalytics(): Promise<ChurnAnalytics | null> {
    try {
      // Fetch predictions
      const predictionsResult = await query(`
        SELECT
          COUNT(*) as total_analyzed,
          SUM(CASE WHEN churn_probability >= 0.5 THEN 1 ELSE 0 END) as at_risk,
          AVG(churn_probability) as avg_churn,
          SUM(CASE WHEN risk_segment = 'low' THEN 1 ELSE 0 END) as risk_low,
          SUM(CASE WHEN risk_segment = 'medium' THEN 1 ELSE 0 END) as risk_medium,
          SUM(CASE WHEN risk_segment = 'high' THEN 1 ELSE 0 END) as risk_high,
          SUM(CASE WHEN risk_segment = 'critical' THEN 1 ELSE 0 END) as risk_critical,
          SUM(value_at_risk) as total_value_at_risk
        FROM churn_predictions
      `);

      const campaignsResult = await query(`
        SELECT
          COUNT(*) as total_campaigns,
          SUM(CASE WHEN campaign_status = 'email_sent' THEN 1 ELSE 0 END) as emails_sent,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          SUM(conversions) as total_conversions,
          SUM(CASE WHEN campaign_status = 'user_retained' THEN 1 ELSE 0 END) as users_retained
        FROM win_back_campaigns
      `);

      const predictions = predictionsResult.rows?.[0] || {};
      const campaigns = campaignsResult.rows?.[0] || {};

      const emailsOpened = campaigns.total_impressions || 0;
      const emailsSent = campaigns.emails_sent || 0;
      const totalImpressions = campaigns.total_impressions || 0;
      const totalClicks = campaigns.total_clicks || 0;
      const totalConversions = campaigns.total_conversions || 0;

      return {
        totalUsersAnalyzed: parseInt(predictions.total_analyzed) || 0,
        usersAtRisk: parseInt(predictions.at_risk) || 0,
        averageChurnProbability: parseFloat(predictions.avg_churn) || 0,
        riskDistribution: {
          low: parseInt(predictions.risk_low) || 0,
          medium: parseInt(predictions.risk_medium) || 0,
          high: parseInt(predictions.risk_high) || 0,
          critical: parseInt(predictions.risk_critical) || 0,
        },
        campaignMetrics: {
          totalCampaigns: parseInt(campaigns.total_campaigns) || 0,
          emailsSent: parseInt(emailsSent) || 0,
          emailOpenRate: emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0,
          clickThroughRate: emailsOpened > 0 ? (totalClicks / emailsOpened) * 100 : 0,
          conversionRate: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0,
          averageRetentionIncrease: parseInt(campaigns.users_retained) > 0 ?
            (parseInt(campaigns.users_retained) / parseInt(campaigns.total_campaigns)) * 100 : 0,
        },
        predictedMonthlyChurn: {
          usersAtRisk: parseInt(predictions.at_risk) || 0,
          potentialRevenueLoss: parseFloat(predictions.total_value_at_risk) || 0,
        },
      };
    } catch (error) {
      console.error('Error fetching churn analytics:', error);
      return null;
    }
  }

  /**
   * Run automated churn detection and campaign orchestration
   */
  async runAutomatedChurnCampaigns(): Promise<{ campaignsCreated: number; emailsSent: number }> {
    try {
      const atRiskUsers = await this.getAtRiskUsers(0.55, 500);
      let campaignsCreated = 0;
      let emailsSent = 0;

      for (const prediction of atRiskUsers) {
        // Skip if campaign already exists for this user in last 30 days
        const existingCampaign = await query(`
          SELECT id FROM win_back_campaigns
          WHERE user_id = $1
          AND created_at > NOW() - INTERVAL '30 days'
          LIMIT 1
        `, [prediction.userId]);

        if (existingCampaign.rows?.length > 0) {
          continue;
        }

        // Determine discount based on risk
        let discount = 0;
        if (prediction.riskSegment === 'critical') {
          discount = 20;
        } else if (prediction.riskSegment === 'high') {
          discount = 15;
        } else {
          discount = 10;
        }

        // Create campaign
        const campaign = await this.createWinBackCampaign(
          prediction.userId,
          prediction,
          discount,
          30
        );

        if (campaign) {
          campaignsCreated++;

          // Send email
          const emailSent = await this.sendWinBackEmail(campaign, prediction);
          if (emailSent) {
            emailsSent++;
          }
        }
      }

      return { campaignsCreated, emailsSent };
    } catch (error) {
      console.error('Error running automated churn campaigns:', error);
      return { campaignsCreated: 0, emailsSent: 0 };
    }
  }
}

export default new ChurnPredictionService();
