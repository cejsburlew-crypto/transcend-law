// NPS Survey Service
// Features: Monthly NPS surveys, trend tracking, segmentation by user type, admin dashboard

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface NPSSurvey {
  id: string;
  userId: string;
  userType: 'client' | 'provider' | 'admin';
  score: number; // 0-10
  followUpComment?: string;
  sentiment?: 'promoter' | 'passive' | 'detractor'; // NPS classification
  tags?: string[]; // feedback categories
  createdAt: Date;
  updatedAt: Date;
  respondedAt?: Date;
}

export interface NPSTrend {
  id: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  npsScore: number; // Calculated NPS: (promoters % - detractors %) * 100
  promoterCount: number;
  passiveCount: number;
  detractorCount: number;
  totalResponses: number;
  averageScore: number;
  segmentData: SegmentData[];
  trends?: {
    direction: 'improving' | 'declining' | 'stable';
    changePercentage: number;
  };
}

export interface SegmentData {
  userType: 'client' | 'provider' | 'admin';
  npsScore: number;
  count: number;
  averageScore: number;
  sentiment: Record<'promoter' | 'passive' | 'detractor', number>;
}

export interface ActionItem {
  id: string;
  relatedToTrendId: string;
  category: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  suggestedAction: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: Date;
  resolvedAt?: Date;
  linkedSurveyIds: string[];
}

export interface NPSDashboardMetrics {
  currentNPS: number;
  monthlyNPS: number;
  quarterlyNPS: number;
  annualNPS: number;
  promoterPercentage: number;
  passivePercentage: number;
  detractorPercentage: number;
  totalResponses: number;
  responseRate: number; // percentage
  segmentBreakdown: SegmentData[];
  topFeedbackThemes: FeedbackTheme[];
  actionItems: ActionItem[];
  trends: NPSTrend[];
  alerts: NPSAlert[];
}

export interface FeedbackTheme {
  theme: string;
  frequency: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  examples: string[];
}

export interface NPSAlert {
  id: string;
  type: 'low_nps' | 'declining_trend' | 'high_detractor_rate' | 'low_response_rate';
  severity: 'warning' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  triggeredAt: Date;
  resolved?: boolean;
}

export interface NPSSurveyRequest {
  userId: string;
  userType: 'client' | 'provider' | 'admin';
  scheduledFor?: Date;
}

// ============================================
// NPS SERVICE
// ============================================

export class NPSService {
  private static instance: NPSService;
  private surveyScheduleInterval = 30 * 24 * 60 * 60 * 1000; // 30 days (monthly)

  private constructor() {
    this.initializeDatabase();
    this.startSurveyScheduling();
  }

  static getInstance(): NPSService {
    if (!NPSService.instance) {
      NPSService.instance = new NPSService();
    }
    return NPSService.instance;
  }

  // ============================================
  // INITIALIZATION & SCHEDULING
  // ============================================

  private async initializeDatabase(): Promise<void> {
    try {
      // Create NPS surveys table
      await query(`
        CREATE TABLE IF NOT EXISTS nps_surveys (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          user_type VARCHAR(50) NOT NULL,
          score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
          follow_up_comment TEXT,
          sentiment VARCHAR(20),
          tags TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          responded_at TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // Create NPS trends table
      await query(`
        CREATE TABLE IF NOT EXISTS nps_trends (
          id UUID PRIMARY KEY,
          period VARCHAR(20) NOT NULL,
          start_date TIMESTAMP NOT NULL,
          end_date TIMESTAMP NOT NULL,
          nps_score FLOAT,
          promoter_count INTEGER DEFAULT 0,
          passive_count INTEGER DEFAULT 0,
          detractor_count INTEGER DEFAULT 0,
          total_responses INTEGER DEFAULT 0,
          average_score FLOAT,
          segment_data JSONB,
          trends JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(period, start_date, end_date)
        )
      `);

      // Create action items table
      await query(`
        CREATE TABLE IF NOT EXISTS nps_action_items (
          id UUID PRIMARY KEY,
          related_to_trend_id UUID NOT NULL,
          category VARCHAR(100),
          priority VARCHAR(20),
          description TEXT,
          suggested_action TEXT,
          status VARCHAR(20) DEFAULT 'open',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP,
          linked_survey_ids UUID[],
          FOREIGN KEY (related_to_trend_id) REFERENCES nps_trends(id) ON DELETE CASCADE
        )
      `);

      // Create NPS alerts table
      await query(`
        CREATE TABLE IF NOT EXISTS nps_alerts (
          id UUID PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          severity VARCHAR(20),
          message TEXT,
          threshold FLOAT,
          current_value FLOAT,
          triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create survey schedule table
      await query(`
        CREATE TABLE IF NOT EXISTS nps_survey_schedule (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL,
          user_type VARCHAR(50),
          last_survey_date TIMESTAMP,
          next_survey_date TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id)
        )
      `);

      // Create indexes
      await query('CREATE INDEX IF NOT EXISTS idx_nps_surveys_user_id ON nps_surveys(user_id)');
      await query('CREATE INDEX IF NOT EXISTS idx_nps_surveys_user_type ON nps_surveys(user_type)');
      await query('CREATE INDEX IF NOT EXISTS idx_nps_surveys_created_at ON nps_surveys(created_at)');
      await query('CREATE INDEX IF NOT EXISTS idx_nps_trends_period ON nps_trends(period, start_date)');
      await query('CREATE INDEX IF NOT EXISTS idx_nps_alerts_type ON nps_alerts(type)');
    } catch (error) {
      console.error('Error initializing NPS database:', error);
    }
  }

  private startSurveyScheduling(): void {
    // Run survey scheduling every hour
    setInterval(async () => {
      try {
        await this.scheduleSurveys();
        await this.calculateTrends();
        await this.checkAlerts();
        await this.generateActionItems();
      } catch (error) {
        console.error('Error in survey scheduling:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Initial run
    this.scheduleSurveys().catch(console.error);
  }

  // ============================================
  // SURVEY MANAGEMENT
  // ============================================

  async scheduleSurveys(): Promise<void> {
    try {
      // Get all users who need a survey
      const result = await query(`
        SELECT u.id, u.user_type, COALESCE(s.last_survey_date, '1970-01-01'::timestamp) as last_survey_date
        FROM users u
        LEFT JOIN nps_survey_schedule s ON u.id = s.user_id
        WHERE s.last_survey_date IS NULL
           OR NOW() - s.last_survey_date > INTERVAL '30 days'
      `);

      for (const user of result.rows) {
        // Check if survey already exists for this month
        const existingResult = await query(
          `SELECT id FROM nps_surveys
           WHERE user_id = $1
           AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`,
          [user.id]
        );

        if (existingResult.rows.length === 0) {
          // Create schedule entry
          await query(
            `INSERT INTO nps_survey_schedule (id, user_id, user_type, next_survey_date, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW(), NOW())
             ON CONFLICT (user_id) DO UPDATE
             SET next_survey_date = NOW(), updated_at = NOW()`,
            [uuidv4(), user.id, user.user_type]
          );
        }
      }
    } catch (error) {
      console.error('Error scheduling surveys:', error);
    }
  }

  async submitSurvey(userId: string, score: number, followUpComment?: string, tags?: string[]): Promise<NPSSurvey> {
    const surveyId = uuidv4();

    try {
      // Get user type
      const userResult = await query('SELECT user_type FROM users WHERE id = $1', [userId]);
      if (!userResult.rows.length) {
        throw new Error('User not found');
      }

      const userType = userResult.rows[0].user_type;

      // Determine sentiment
      const sentiment = this.calculateSentiment(score);

      // Insert survey
      await query(
        `INSERT INTO nps_surveys (id, user_id, user_type, score, follow_up_comment, sentiment, tags, created_at, updated_at, responded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())`,
        [surveyId, userId, userType, score, followUpComment || null, sentiment, tags || null]
      );

      // Update schedule
      await query(
        `UPDATE nps_survey_schedule
         SET last_survey_date = NOW(), updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      // Log action
      await logAction(userId, 'submit', 'nps_survey', surveyId, { score, sentiment });

      return {
        id: surveyId,
        userId,
        userType,
        score,
        followUpComment,
        sentiment,
        tags,
        createdAt: new Date(),
        updatedAt: new Date(),
        respondedAt: new Date(),
      };
    } catch (error) {
      console.error('Error submitting NPS survey:', error);
      throw error;
    }
  }

  async getSurvey(surveyId: string): Promise<NPSSurvey | null> {
    try {
      const result = await query(
        `SELECT * FROM nps_surveys WHERE id = $1`,
        [surveyId]
      );

      if (!result.rows.length) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        userType: row.user_type,
        score: row.score,
        followUpComment: row.follow_up_comment,
        sentiment: row.sentiment,
        tags: row.tags,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      };
    } catch (error) {
      console.error('Error fetching survey:', error);
      throw error;
    }
  }

  async getUserSurveyHistory(userId: string, limit: number = 12): Promise<NPSSurvey[]> {
    try {
      const result = await query(
        `SELECT * FROM nps_surveys
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        userType: row.user_type,
        score: row.score,
        followUpComment: row.follow_up_comment,
        sentiment: row.sentiment,
        tags: row.tags,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      }));
    } catch (error) {
      console.error('Error fetching user survey history:', error);
      throw error;
    }
  }

  // ============================================
  // TREND CALCULATION
  // ============================================

  async calculateTrends(): Promise<void> {
    try {
      // Calculate daily trends
      await this.calculateTrendForPeriod('daily');
      // Calculate weekly trends
      await this.calculateTrendForPeriod('weekly');
      // Calculate monthly trends
      await this.calculateTrendForPeriod('monthly');
    } catch (error) {
      console.error('Error calculating trends:', error);
    }
  }

  private async calculateTrendForPeriod(period: 'daily' | 'weekly' | 'monthly'): Promise<void> {
    const intervalStr = period === 'daily' ? '1 day' : period === 'weekly' ? '7 days' : '30 days';
    const truncFunc = period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month';

    try {
      const result = await query(`
        SELECT
          DATE_TRUNC('${truncFunc}', created_at) as period_start,
          DATE_TRUNC('${truncFunc}', created_at) + INTERVAL '${intervalStr}' - INTERVAL '1 second' as period_end,
          COUNT(*) as total,
          AVG(score) as avg_score,
          SUM(CASE WHEN sentiment = 'promoter' THEN 1 ELSE 0 END) as promoter_count,
          SUM(CASE WHEN sentiment = 'passive' THEN 1 ELSE 0 END) as passive_count,
          SUM(CASE WHEN sentiment = 'detractor' THEN 1 ELSE 0 END) as detractor_count
        FROM nps_surveys
        WHERE created_at >= NOW() - INTERVAL '1 year'
        GROUP BY DATE_TRUNC('${truncFunc}', created_at)
        ORDER BY period_start DESC
      `);

      for (const row of result.rows) {
        const startDate = new Date(row.period_start);
        const endDate = new Date(row.period_end);
        const total = parseInt(row.total);
        const promoters = parseInt(row.promoter_count) || 0;
        const detractors = parseInt(row.detractor_count) || 0;

        // Calculate NPS Score: (Promoters % - Detractors %) * 100
        const npsScore = total > 0 ? ((promoters - detractors) / total) * 100 : 0;

        // Get segment breakdown
        const segmentResult = await query(`
          SELECT
            user_type,
            COUNT(*) as count,
            AVG(score) as avg_score,
            SUM(CASE WHEN sentiment = 'promoter' THEN 1 ELSE 0 END) as promoter_count,
            SUM(CASE WHEN sentiment = 'passive' THEN 1 ELSE 0 END) as passive_count,
            SUM(CASE WHEN sentiment = 'detractor' THEN 1 ELSE 0 END) as detractor_count
          FROM nps_surveys
          WHERE created_at >= $1 AND created_at <= $2
          GROUP BY user_type
        `, [startDate, endDate]);

        const segmentData: SegmentData[] = segmentResult.rows.map(seg => {
          const segTotal = parseInt(seg.count);
          const segPromoters = parseInt(seg.promoter_count) || 0;
          const segDetractors = parseInt(seg.detractor_count) || 0;
          const segNPS = segTotal > 0 ? ((segPromoters - segDetractors) / segTotal) * 100 : 0;

          return {
            userType: seg.user_type,
            npsScore: parseFloat(segNPS.toFixed(2)),
            count: segTotal,
            averageScore: parseFloat(seg.avg_score) || 0,
            sentiment: {
              promoter: parseInt(seg.promoter_count) || 0,
              passive: parseInt(seg.passive_count) || 0,
              detractor: parseInt(seg.detractor_count) || 0,
            },
          };
        });

        // Calculate trend direction
        const previousResult = await query(`
          SELECT nps_score FROM nps_trends
          WHERE period = $1 AND end_date < $2
          ORDER BY end_date DESC LIMIT 1
        `, [period, startDate]);

        let trends: { direction: 'improving' | 'declining' | 'stable'; changePercentage: number } =
          { direction: 'stable', changePercentage: 0 };
        if (previousResult.rows.length > 0) {
          const previousNPS = previousResult.rows[0].nps_score;
          const change = npsScore - previousNPS;
          trends = {
            direction: change > 2 ? 'improving' : change < -2 ? 'declining' : 'stable',
            changePercentage: parseFloat(((change / Math.abs(previousNPS || 1)) * 100).toFixed(2)),
          };
        }

        // Upsert trend
        await query(
          `INSERT INTO nps_trends (id, period, start_date, end_date, nps_score, promoter_count, passive_count, detractor_count, total_responses, average_score, segment_data, trends, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
           ON CONFLICT (period, start_date, end_date) DO UPDATE SET
           nps_score = $5, promoter_count = $6, passive_count = $7, detractor_count = $8, total_responses = $9, average_score = $10, segment_data = $11, trends = $12`,
          [uuidv4(), period, startDate, endDate, parseFloat(npsScore.toFixed(2)), promoters,
           parseInt(row.passive_count) || 0, detractors, total, parseFloat(row.avg_score) || 0,
           JSON.stringify(segmentData), JSON.stringify(trends)]
        );
      }
    } catch (error) {
      console.error(`Error calculating ${period} trends:`, error);
    }
  }

  async getTrends(period: 'daily' | 'weekly' | 'monthly', limit: number = 12): Promise<NPSTrend[]> {
    try {
      const result = await query(
        `SELECT * FROM nps_trends
         WHERE period = $1
         ORDER BY start_date DESC
         LIMIT $2`,
        [period, limit]
      );

      return result.rows.map(row => ({
        id: row.id,
        period: row.period,
        startDate: new Date(row.start_date),
        endDate: new Date(row.end_date),
        npsScore: parseFloat(row.nps_score) || 0,
        promoterCount: parseInt(row.promoter_count) || 0,
        passiveCount: parseInt(row.passive_count) || 0,
        detractorCount: parseInt(row.detractor_count) || 0,
        totalResponses: parseInt(row.total_responses) || 0,
        averageScore: parseFloat(row.average_score) || 0,
        segmentData: row.segment_data || [],
        trends: row.trends,
      }));
    } catch (error) {
      console.error('Error fetching trends:', error);
      throw error;
    }
  }

  // ============================================
  // ACTION ITEMS & ALERTS
  // ============================================

  private async generateActionItems(): Promise<void> {
    try {
      const latestTrend = await query(
        `SELECT * FROM nps_trends WHERE period = 'monthly' ORDER BY end_date DESC LIMIT 1`
      );

      if (!latestTrend.rows.length) return;

      const trend = latestTrend.rows[0];
      const trendId = trend.id;

      // Get survey feedback for this period
      const feedbackResult = await query(`
        SELECT follow_up_comment, tags, sentiment, score
        FROM nps_surveys
        WHERE created_at >= $1 AND created_at <= $2 AND follow_up_comment IS NOT NULL
        ORDER BY score ASC
      `, [trend.start_date, trend.end_date]);

      const themes = this.analyzeThemes(feedbackResult.rows);

      // Generate action items for low scores
      if (trend.detractor_count > trend.promoter_count) {
        const categories = this.categorizeFeedback(feedbackResult.rows);

        for (const category of Object.entries(categories)) {
          if (category[1].length > 0) {
            const actionId = uuidv4();
            const relatedSurveyIds = category[1].map(f => f.id).slice(0, 5); // Top 5 surveys

            await query(
              `INSERT INTO nps_action_items (id, related_to_trend_id, category, priority, description, suggested_action, status, linked_survey_ids, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, NOW())
               ON CONFLICT DO NOTHING`,
              [
                actionId,
                trendId,
                category[0],
                'high',
                `Improve ${category[0]} - ${category[1].length} users reported issues`,
                this.generateSuggestedAction(category[0]),
                relatedSurveyIds,
              ]
            );
          }
        }
      }
    } catch (error) {
      console.error('Error generating action items:', error);
    }
  }

  private async checkAlerts(): Promise<void> {
    try {
      const latestTrend = await query(
        `SELECT nps_score, total_responses, detractor_count
         FROM nps_trends
         WHERE period = 'monthly'
         ORDER BY end_date DESC
         LIMIT 1`
      );

      if (!latestTrend.rows.length) return;

      const trend = latestTrend.rows[0];
      const npsScore = parseFloat(trend.nps_score) || 0;
      const totalResponses = parseInt(trend.total_responses) || 0;
      const detractorCount = parseInt(trend.detractor_count) || 0;

      const alerts: NPSAlert[] = [];

      // Alert: NPS below 0
      if (npsScore < 0) {
        alerts.push({
          id: uuidv4(),
          type: 'low_nps',
          severity: 'critical',
          message: 'NPS Score is critically low',
          threshold: 0,
          currentValue: npsScore,
          triggeredAt: new Date(),
        });
      }

      // Alert: Declining trend
      const previousTrend = await query(
        `SELECT nps_score FROM nps_trends WHERE period = 'monthly' ORDER BY end_date DESC LIMIT 2 OFFSET 1`
      );

      if (previousTrend.rows.length > 0) {
        const previousNPS = parseFloat(previousTrend.rows[0].nps_score) || 0;
        if (npsScore < previousNPS - 10) {
          alerts.push({
            id: uuidv4(),
            type: 'declining_trend',
            severity: 'warning',
            message: 'NPS score declining significantly',
            threshold: previousNPS,
            currentValue: npsScore,
            triggeredAt: new Date(),
          });
        }
      }

      // Alert: High detractor rate
      const detractorRate = (detractorCount / Math.max(totalResponses, 1)) * 100;
      if (detractorRate > 40) {
        alerts.push({
          id: uuidv4(),
          type: 'high_detractor_rate',
          severity: 'critical',
          message: 'High detractor rate detected',
          threshold: 40,
          currentValue: detractorRate,
          triggeredAt: new Date(),
        });
      }

      // Alert: Low response rate
      const responseRateResult = await query(`
        SELECT COUNT(*) as total_users FROM users
      `);
      const totalUsers = parseInt(responseRateResult.rows[0]?.total_users) || 1;
      const responseRate = (totalResponses / totalUsers) * 100;

      if (responseRate < 20) {
        alerts.push({
          id: uuidv4(),
          type: 'low_response_rate',
          severity: 'warning',
          message: 'Survey response rate is low',
          threshold: 20,
          currentValue: responseRate,
          triggeredAt: new Date(),
        });
      }

      // Insert alerts
      for (const alert of alerts) {
        await query(
          `INSERT INTO nps_alerts (id, type, severity, message, threshold, current_value, triggered_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [alert.id, alert.type, alert.severity, alert.message, alert.threshold, alert.currentValue, alert.triggeredAt]
        );
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  async getActionItems(trendId?: string, status?: string): Promise<ActionItem[]> {
    try {
      let query_str = 'SELECT * FROM nps_action_items WHERE 1=1';
      const params: any[] = [];

      if (trendId) {
        query_str += ' AND related_to_trend_id = $' + (params.length + 1);
        params.push(trendId);
      }

      if (status) {
        query_str += ' AND status = $' + (params.length + 1);
        params.push(status);
      }

      query_str += ' ORDER BY priority DESC, created_at DESC';

      const result = await query(query_str, params);

      return result.rows.map(row => ({
        id: row.id,
        relatedToTrendId: row.related_to_trend_id,
        category: row.category,
        priority: row.priority,
        description: row.description,
        suggestedAction: row.suggested_action,
        status: row.status,
        createdAt: new Date(row.created_at),
        resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
        linkedSurveyIds: row.linked_survey_ids || [],
      }));
    } catch (error) {
      console.error('Error fetching action items:', error);
      throw error;
    }
  }

  async updateActionItemStatus(itemId: string, status: 'open' | 'in_progress' | 'resolved'): Promise<void> {
    try {
      await query(
        `UPDATE nps_action_items
         SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END
         WHERE id = $2`,
        [status, itemId]
      );
    } catch (error) {
      console.error('Error updating action item status:', error);
      throw error;
    }
  }

  // ============================================
  // DASHBOARD METRICS
  // ============================================

  async getDashboardMetrics(userId?: string, isAdmin?: boolean): Promise<NPSDashboardMetrics> {
    if (userId && !isAdmin) {
      throw new Error('Admin access required');
    }

    try {
      // Get current NPS
      const currentNpsResult = await query(
        `SELECT nps_score FROM nps_trends WHERE period = 'daily' ORDER BY end_date DESC LIMIT 1`
      );

      // Get monthly NPS
      const monthlyNpsResult = await query(
        `SELECT nps_score FROM nps_trends WHERE period = 'monthly' ORDER BY end_date DESC LIMIT 1`
      );

      // Get quarterly NPS
      const quarterlyNpsResult = await query(
        `SELECT AVG(nps_score) as avg_nps FROM nps_trends
         WHERE period = 'monthly' AND end_date >= NOW() - INTERVAL '3 months'`
      );

      // Get annual NPS
      const annualNpsResult = await query(
        `SELECT AVG(nps_score) as avg_nps FROM nps_trends
         WHERE period = 'monthly' AND end_date >= NOW() - INTERVAL '1 year'`
      );

      // Get overall sentiment distribution
      const sentimentResult = await query(
        `SELECT
          SUM(CASE WHEN sentiment = 'promoter' THEN 1 ELSE 0 END) as promoters,
          SUM(CASE WHEN sentiment = 'passive' THEN 1 ELSE 0 END) as passives,
          SUM(CASE WHEN sentiment = 'detractor' THEN 1 ELSE 0 END) as detractors,
          COUNT(*) as total
        FROM nps_surveys
        WHERE created_at >= NOW() - INTERVAL '30 days'`
      );

      const sentiment = sentimentResult.rows[0];
      const totalResponses = parseInt(sentiment.total) || 0;
      const promoters = parseInt(sentiment.promoters) || 0;
      const passives = parseInt(sentiment.passives) || 0;
      const detractors = parseInt(sentiment.detractors) || 0;

      // Get segment breakdown
      const segmentResult = await query(
        `SELECT * FROM nps_trends WHERE period = 'monthly' ORDER BY end_date DESC LIMIT 1`
      );

      // Get response rate
      const userCountResult = await query('SELECT COUNT(*) as count FROM users');
      const totalUsers = parseInt(userCountResult.rows[0]?.count) || 1;
      const responseRate = (totalResponses / totalUsers) * 100;

      // Get top feedback themes
      const themesResult = await query(
        `SELECT tags, sentiment FROM nps_surveys
         WHERE created_at >= NOW() - INTERVAL '30 days' AND tags IS NOT NULL`
      );

      const topThemes = this.extractTopThemes(themesResult.rows);

      // Get action items
      const actionItems = await this.getActionItems(undefined, 'open');

      // Get trends
      const trends = await this.getTrends('monthly', 6);

      // Get alerts
      const alertsResult = await query(
        `SELECT * FROM nps_alerts WHERE resolved = FALSE ORDER BY triggered_at DESC LIMIT 10`
      );

      const alerts: NPSAlert[] = alertsResult.rows.map(row => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        message: row.message,
        threshold: row.threshold,
        currentValue: row.current_value,
        triggeredAt: new Date(row.triggered_at),
        resolved: row.resolved,
      }));

      return {
        currentNPS: parseFloat(currentNpsResult.rows[0]?.nps_score) || 0,
        monthlyNPS: parseFloat(monthlyNpsResult.rows[0]?.nps_score) || 0,
        quarterlyNPS: parseFloat(quarterlyNpsResult.rows[0]?.avg_nps) || 0,
        annualNPS: parseFloat(annualNpsResult.rows[0]?.avg_nps) || 0,
        promoterPercentage: totalResponses > 0 ? (promoters / totalResponses) * 100 : 0,
        passivePercentage: totalResponses > 0 ? (passives / totalResponses) * 100 : 0,
        detractorPercentage: totalResponses > 0 ? (detractors / totalResponses) * 100 : 0,
        totalResponses,
        responseRate,
        segmentBreakdown: segmentResult.rows[0]?.segment_data || [],
        topFeedbackThemes: topThemes,
        actionItems: actionItems.slice(0, 5),
        trends,
        alerts,
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private calculateSentiment(score: number): 'promoter' | 'passive' | 'detractor' {
    if (score >= 9) return 'promoter';
    if (score >= 7) return 'passive';
    return 'detractor';
  }

  private analyzeThemes(feedback: any[]): FeedbackTheme[] {
    const themeMap: Record<string, FeedbackTheme> = {};

    feedback.forEach(fb => {
      const sentiment = fb.sentiment === 'detractor' ? 'negative' : fb.sentiment === 'promoter' ? 'positive' : 'neutral';

      if (fb.tags && Array.isArray(fb.tags)) {
        fb.tags.forEach((tag: string) => {
          if (!themeMap[tag]) {
            themeMap[tag] = { theme: tag, frequency: 0, sentiment, examples: [] };
          }
          themeMap[tag].frequency++;
          if (themeMap[tag].examples.length < 3) {
            themeMap[tag].examples.push(fb.follow_up_comment || '');
          }
        });
      }
    });

    return Object.values(themeMap)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  private categorizeFeedback(feedback: any[]): Record<string, any[]> {
    const categories: Record<string, any[]> = {
      'User Experience': [],
      'Performance': [],
      'Support': [],
      'Features': [],
      'Other': [],
    };

    feedback.forEach(fb => {
      if (fb.tags?.includes('ux') || fb.tags?.includes('usability')) {
        categories['User Experience'].push(fb);
      } else if (fb.tags?.includes('performance') || fb.tags?.includes('speed')) {
        categories['Performance'].push(fb);
      } else if (fb.tags?.includes('support') || fb.tags?.includes('help')) {
        categories['Support'].push(fb);
      } else if (fb.tags?.includes('features') || fb.tags?.includes('feature_request')) {
        categories['Features'].push(fb);
      } else {
        categories['Other'].push(fb);
      }
    });

    return categories;
  }

  private generateSuggestedAction(category: string): string {
    const suggestions: Record<string, string> = {
      'User Experience': 'Conduct UX research and implement interface improvements based on user feedback',
      'Performance': 'Analyze performance bottlenecks and optimize critical paths',
      'Support': 'Enhance support resources and reduce response times',
      'Features': 'Prioritize feature requests and plan development roadmap',
      'Other': 'Investigate feedback and determine root causes',
    };

    return suggestions[category] || 'Review user feedback and take corrective action';
  }

  private extractTopThemes(feedback: any[]): FeedbackTheme[] {
    const themes: Record<string, FeedbackTheme> = {};

    feedback.forEach(fb => {
      if (fb.tags && Array.isArray(fb.tags)) {
        fb.tags.forEach((tag: string) => {
          if (!themes[tag]) {
            themes[tag] = {
              theme: tag,
              frequency: 0,
              sentiment: fb.sentiment === 'detractor' ? 'negative' : fb.sentiment === 'promoter' ? 'positive' : 'neutral',
              examples: [],
            };
          }
          themes[tag].frequency++;
        });
      }
    });

    return Object.values(themes)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
  }
}

export const npsService = NPSService.getInstance();
