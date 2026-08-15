// Wait Time Analytics Service
// Tracks client wait times, provider response times, and correlates with satisfaction metrics

import { query, transaction } from '../src/database/connection';
import { auditLog } from './auditLogger';

// ============================================
// INTERFACES AND TYPES
// ============================================

export interface WaitTimeEvent {
  id: string;
  caseId: string;
  clientId: string;
  providerId: string;
  serviceType: string;

  // Timestamp tracking
  clientArrivalTime: Date;
  providerResponseTime?: Date;
  serviceCompletionTime?: Date;

  // Calculated wait times (in seconds)
  clientWaitTime?: number;  // Time from arrival to provider response
  totalServiceTime?: number; // Time from arrival to completion

  // Status tracking
  status: 'waiting' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';

  // Thresholds
  exceedsResponseThreshold: boolean;
  exceedsCompletionThreshold: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderMetrics {
  providerId: string;
  providerName: string;
  totalServices: number;
  averageClientWaitTime: number;
  averageTotalServiceTime: number;
  medianClientWaitTime: number;
  medianTotalServiceTime: number;
  maxClientWaitTime: number;
  maxTotalServiceTime: number;
  minClientWaitTime: number;
  minTotalServiceTime: number;
  percentageResponseThresholdExceeded: number;
  percentageCompletionThresholdExceeded: number;
  averageClientSatisfaction: number;
  responseThresholdSla: number; // SLA target in seconds
  completionThresholdSla: number; // SLA target in seconds
  slaCompliancePercentage: number;
  lastUpdated: Date;
}

export interface ClientSatisfactionCorrelation {
  waitTimeRange: string; // e.g., "0-5 min", "5-15 min", "15+ min"
  averageSatisfactionScore: number;
  totalResponses: number;
  percentageNegative: number;
}

export interface WaitTimeAlert {
  id: string;
  eventId: string;
  caseId: string;
  clientId: string;
  providerId: string;
  alertType: 'response_time_exceeded' | 'completion_time_exceeded' | 'no_show';
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  actualValue: number;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface HistoricalAnalytics {
  period: string; // e.g., "2024-01", "2024-Q1"
  totalServices: number;
  averageClientWaitTime: number;
  averageTotalServiceTime: number;
  percentageThresholdExceeded: number;
  totalAlertsGenerated: number;
  averageClientSatisfaction: number;
  topProviders: Array<{
    providerId: string;
    providerName: string;
    averageWaitTime: number;
  }>;
  slowestProviders: Array<{
    providerId: string;
    providerName: string;
    averageWaitTime: number;
  }>;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_RESPONSE_THRESHOLD_SECONDS = 300; // 5 minutes
const DEFAULT_COMPLETION_THRESHOLD_SECONDS = 1800; // 30 minutes
const CRITICAL_WAIT_TIME_SECONDS = 3600; // 1 hour
const ALERT_ESCALATION_TIME_SECONDS = 1800; // 30 minutes

// ============================================
// TIMESTAMP TRACKING FUNCTIONS
// ============================================

/**
 * Records a client arrival timestamp
 */
export async function recordClientArrival(
  caseId: string,
  clientId: string,
  providerId: string,
  serviceType: string
): Promise<WaitTimeEvent> {
  try {
    const eventId = `wait_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const insertQuery = `
      INSERT INTO wait_time_events (
        id, case_id, client_id, provider_id, service_type,
        client_arrival_time, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )
      RETURNING *;
    `;

    const result = await query(insertQuery, [
      eventId,
      caseId,
      clientId,
      providerId,
      serviceType,
      now,
      'waiting',
      now,
      now,
    ]);

    await auditLog('wait_time', 'client_arrival_recorded', {
      eventId,
      caseId,
      clientId,
      providerId,
      timestamp: now,
    });

    return mapDatabaseRowToWaitTimeEvent(result.rows[0]);
  } catch (error) {
    console.error('Error recording client arrival:', error);
    throw error;
  }
}

/**
 * Records provider response timestamp and calculates client wait time
 */
export async function recordProviderResponse(
  eventId: string,
  providerId: string
): Promise<WaitTimeEvent> {
  try {
    const now = new Date();

    // Get the event to calculate wait time
    const getQuery = `
      SELECT * FROM wait_time_events WHERE id = $1;
    `;
    const eventResult = await query(getQuery, [eventId]);

    if (eventResult.rows.length === 0) {
      throw new Error(`Wait time event not found: ${eventId}`);
    }

    const event = eventResult.rows[0];
    const clientWaitTime = Math.floor(
      (now.getTime() - new Date(event.client_arrival_time).getTime()) / 1000
    );

    const responseThreshold = event.response_threshold_sla || DEFAULT_RESPONSE_THRESHOLD_SECONDS;
    const exceedsThreshold = clientWaitTime > responseThreshold;

    const updateQuery = `
      UPDATE wait_time_events
      SET
        provider_response_time = $2,
        client_wait_time = $3,
        exceeds_response_threshold = $4,
        status = $5,
        updated_at = $6
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(updateQuery, [
      eventId,
      now,
      clientWaitTime,
      exceedsThreshold,
      'in_progress',
      now,
    ]);

    // Generate alert if threshold exceeded
    if (exceedsThreshold) {
      await createWaitTimeAlert(
        eventId,
        event.case_id,
        event.client_id,
        providerId,
        'response_time_exceeded',
        clientWaitTime,
        responseThreshold
      );
    }

    await auditLog('wait_time', 'provider_response_recorded', {
      eventId,
      providerId,
      clientWaitTime,
      exceedsThreshold,
      timestamp: now,
    });

    return mapDatabaseRowToWaitTimeEvent(result.rows[0]);
  } catch (error) {
    console.error('Error recording provider response:', error);
    throw error;
  }
}

/**
 * Records service completion timestamp and calculates total service time
 */
export async function recordServiceCompletion(
  eventId: string,
  providerId: string
): Promise<WaitTimeEvent> {
  try {
    const now = new Date();

    // Get the event to calculate service time
    const getQuery = `
      SELECT * FROM wait_time_events WHERE id = $1;
    `;
    const eventResult = await query(getQuery, [eventId]);

    if (eventResult.rows.length === 0) {
      throw new Error(`Wait time event not found: ${eventId}`);
    }

    const event = eventResult.rows[0];
    const totalServiceTime = Math.floor(
      (now.getTime() - new Date(event.client_arrival_time).getTime()) / 1000
    );

    const completionThreshold =
      event.completion_threshold_sla || DEFAULT_COMPLETION_THRESHOLD_SECONDS;
    const exceedsThreshold = totalServiceTime > completionThreshold;

    const updateQuery = `
      UPDATE wait_time_events
      SET
        service_completion_time = $2,
        total_service_time = $3,
        exceeds_completion_threshold = $4,
        status = $5,
        updated_at = $6
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(updateQuery, [
      eventId,
      now,
      totalServiceTime,
      exceedsThreshold,
      'completed',
      now,
    ]);

    // Generate alert if threshold exceeded
    if (exceedsThreshold) {
      await createWaitTimeAlert(
        eventId,
        event.case_id,
        event.client_id,
        providerId,
        'completion_time_exceeded',
        totalServiceTime,
        completionThreshold
      );
    }

    await auditLog('wait_time', 'service_completion_recorded', {
      eventId,
      providerId,
      totalServiceTime,
      exceedsThreshold,
      timestamp: now,
    });

    return mapDatabaseRowToWaitTimeEvent(result.rows[0]);
  } catch (error) {
    console.error('Error recording service completion:', error);
    throw error;
  }
}

// ============================================
// WAIT TIME CALCULATION FUNCTIONS
// ============================================

/**
 * Get current wait time for a specific service
 */
export async function getCurrentWaitTime(eventId: string): Promise<number | null> {
  try {
    const queryStr = `
      SELECT client_arrival_time, provider_response_time, status
      FROM wait_time_events
      WHERE id = $1;
    `;

    const result = await query(queryStr, [eventId]);

    if (result.rows.length === 0) {
      return null;
    }

    const event = result.rows[0];

    if (event.status === 'waiting') {
      // Client still waiting
      const now = new Date();
      const arrivalTime = new Date(event.client_arrival_time);
      return Math.floor((now.getTime() - arrivalTime.getTime()) / 1000);
    } else if (event.provider_response_time) {
      // Already responded, return the calculated wait time
      const responseTime = new Date(event.provider_response_time);
      const arrivalTime = new Date(event.client_arrival_time);
      return Math.floor((responseTime.getTime() - arrivalTime.getTime()) / 1000);
    }

    return null;
  } catch (error) {
    console.error('Error getting current wait time:', error);
    throw error;
  }
}

/**
 * Get average wait times for a specific provider
 */
export async function getProviderAverageWaitTimes(
  providerId: string,
  daysBack: number = 30
): Promise<{
  averageResponseWaitTime: number;
  averageTotalServiceTime: number;
  medianResponseWaitTime: number;
  medianTotalServiceTime: number;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const queryStr = `
      SELECT
        AVG(client_wait_time) as avg_response,
        AVG(total_service_time) as avg_total,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY client_wait_time) as median_response,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_service_time) as median_total
      FROM wait_time_events
      WHERE provider_id = $1
        AND status = 'completed'
        AND created_at >= $2;
    `;

    const result = await query(queryStr, [providerId, cutoffDate]);

    const row = result.rows[0];

    return {
      averageResponseWaitTime: Math.round(row.avg_response || 0),
      averageTotalServiceTime: Math.round(row.avg_total || 0),
      medianResponseWaitTime: Math.round(row.median_response || 0),
      medianTotalServiceTime: Math.round(row.median_total || 0),
    };
  } catch (error) {
    console.error('Error calculating provider average wait times:', error);
    throw error;
  }
}

// ============================================
// PROVIDER METRICS FUNCTIONS
// ============================================

/**
 * Generate comprehensive provider metrics
 */
export async function generateProviderMetrics(
  providerId: string,
  daysBack: number = 30
): Promise<ProviderMetrics> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const metricsQuery = `
      SELECT
        provider_id,
        COUNT(*) as total_services,
        COUNT(CASE WHEN exceeds_response_threshold THEN 1 END) as response_threshold_exceeded,
        COUNT(CASE WHEN exceeds_completion_threshold THEN 1 END) as completion_threshold_exceeded,
        AVG(client_wait_time) as avg_response_wait,
        AVG(total_service_time) as avg_total_service,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY client_wait_time) as median_response_wait,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_service_time) as median_total_service,
        MAX(client_wait_time) as max_response_wait,
        MAX(total_service_time) as max_total_service,
        MIN(client_wait_time) as min_response_wait,
        MIN(total_service_time) as min_total_service
      FROM wait_time_events
      WHERE provider_id = $1
        AND status IN ('completed', 'in_progress')
        AND created_at >= $2
      GROUP BY provider_id;
    `;

    const metricsResult = await query(metricsQuery, [providerId, cutoffDate]);

    if (metricsResult.rows.length === 0) {
      throw new Error(`No metrics found for provider: ${providerId}`);
    }

    const metrics = metricsResult.rows[0];

    // Get provider name
    const providerQuery = `
      SELECT name FROM providers WHERE id = $1;
    `;
    const providerResult = await query(providerQuery, [providerId]);
    const providerName = providerResult.rows[0]?.name || 'Unknown';

    // Get average satisfaction score
    const satisfactionQuery = `
      SELECT AVG(satisfaction_score) as avg_satisfaction
      FROM service_reviews
      WHERE provider_id = $1
        AND created_at >= $2;
    `;
    const satisfactionResult = await query(satisfactionQuery, [providerId, cutoffDate]);
    const avgSatisfaction = satisfactionResult.rows[0]?.avg_satisfaction || 0;

    const totalServices = metrics.total_services || 0;

    return {
      providerId,
      providerName,
      totalServices,
      averageClientWaitTime: Math.round(metrics.avg_response_wait || 0),
      averageTotalServiceTime: Math.round(metrics.avg_total_service || 0),
      medianClientWaitTime: Math.round(metrics.median_response_wait || 0),
      medianTotalServiceTime: Math.round(metrics.median_total_service || 0),
      maxClientWaitTime: Math.round(metrics.max_response_wait || 0),
      maxTotalServiceTime: Math.round(metrics.max_total_service || 0),
      minClientWaitTime: Math.round(metrics.min_response_wait || 0),
      minTotalServiceTime: Math.round(metrics.min_total_service || 0),
      percentageResponseThresholdExceeded: totalServices > 0
        ? Math.round((metrics.response_threshold_exceeded / totalServices) * 100)
        : 0,
      percentageCompletionThresholdExceeded: totalServices > 0
        ? Math.round((metrics.completion_threshold_exceeded / totalServices) * 100)
        : 0,
      averageClientSatisfaction: Math.round(avgSatisfaction * 100) / 100,
      responseThresholdSla: DEFAULT_RESPONSE_THRESHOLD_SECONDS,
      completionThresholdSla: DEFAULT_COMPLETION_THRESHOLD_SECONDS,
      slaCompliancePercentage: totalServices > 0
        ? Math.round(
          ((totalServices - metrics.response_threshold_exceeded - metrics.completion_threshold_exceeded) /
            totalServices) *
          100
        )
        : 100,
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('Error generating provider metrics:', error);
    throw error;
  }
}

/**
 * Get top providers by performance
 */
export async function getTopProvidersByPerformance(
  limit: number = 10,
  daysBack: number = 30
): Promise<ProviderMetrics[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const queryStr = `
      SELECT DISTINCT provider_id
      FROM wait_time_events
      WHERE status IN ('completed', 'in_progress')
        AND created_at >= $1
      ORDER BY provider_id
      LIMIT $2;
    `;

    const result = await query(queryStr, [cutoffDate, limit]);
    const providerIds = result.rows.map((row) => row.provider_id);

    const metrics: ProviderMetrics[] = [];
    for (const providerId of providerIds) {
      const providerMetrics = await generateProviderMetrics(providerId, daysBack);
      metrics.push(providerMetrics);
    }

    // Sort by SLA compliance (highest first)
    metrics.sort((a, b) => b.slaCompliancePercentage - a.slaCompliancePercentage);

    return metrics.slice(0, limit);
  } catch (error) {
    console.error('Error getting top providers:', error);
    throw error;
  }
}

// ============================================
// SATISFACTION CORRELATION FUNCTIONS
// ============================================

/**
 * Correlate wait times with client satisfaction
 */
export async function correlateWaitTimesWithSatisfaction(
  daysBack: number = 30
): Promise<ClientSatisfactionCorrelation[]> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const queryStr = `
      SELECT
        CASE
          WHEN we.client_wait_time <= 300 THEN '0-5 min'
          WHEN we.client_wait_time <= 900 THEN '5-15 min'
          WHEN we.client_wait_time <= 1800 THEN '15-30 min'
          ELSE '30+ min'
        END as wait_time_range,
        AVG(sr.satisfaction_score) as avg_satisfaction,
        COUNT(sr.id) as total_responses,
        COUNT(CASE WHEN sr.satisfaction_score <= 2 THEN 1 END) as negative_responses
      FROM wait_time_events we
      LEFT JOIN service_reviews sr ON we.case_id = sr.case_id
        AND sr.created_at >= $1
      WHERE we.created_at >= $1
      GROUP BY wait_time_range
      ORDER BY
        CASE
          WHEN wait_time_range = '0-5 min' THEN 1
          WHEN wait_time_range = '5-15 min' THEN 2
          WHEN wait_time_range = '15-30 min' THEN 3
          ELSE 4
        END;
    `;

    const result = await query(queryStr, [cutoffDate]);

    return result.rows.map((row) => ({
      waitTimeRange: row.wait_time_range || 'unknown',
      averageSatisfactionScore: Math.round(row.avg_satisfaction * 100) / 100 || 0,
      totalResponses: row.total_responses || 0,
      percentageNegative:
        row.total_responses > 0
          ? Math.round((row.negative_responses / row.total_responses) * 100)
          : 0,
    }));
  } catch (error) {
    console.error('Error correlating wait times with satisfaction:', error);
    throw error;
  }
}

// ============================================
// ALERT MANAGEMENT FUNCTIONS
// ============================================

/**
 * Create a wait time alert
 */
async function createWaitTimeAlert(
  eventId: string,
  caseId: string,
  clientId: string,
  providerId: string,
  alertType: 'response_time_exceeded' | 'completion_time_exceeded' | 'no_show',
  actualValue: number,
  threshold: number
): Promise<WaitTimeAlert> {
  try {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Determine severity
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (actualValue > threshold * 3) {
      severity = 'critical';
    } else if (actualValue > threshold * 2) {
      severity = 'high';
    } else if (actualValue > threshold) {
      severity = 'low';
    }

    const message = `${alertType}: Wait time of ${Math.floor(actualValue / 60)} minutes exceeds threshold of ${Math.floor(threshold / 60)} minutes`;

    const insertQuery = `
      INSERT INTO wait_time_alerts (
        id, event_id, case_id, client_id, provider_id,
        alert_type, severity, threshold, actual_value,
        message, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING *;
    `;

    const result = await query(insertQuery, [
      alertId,
      eventId,
      caseId,
      clientId,
      providerId,
      alertType,
      severity,
      threshold,
      actualValue,
      message,
      'active',
      now,
    ]);

    await auditLog('wait_time', 'alert_created', {
      alertId,
      eventId,
      alertType,
      severity,
      actualValue,
      threshold,
    });

    return mapDatabaseRowToWaitTimeAlert(result.rows[0]);
  } catch (error) {
    console.error('Error creating wait time alert:', error);
    throw error;
  }
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(providerId?: string): Promise<WaitTimeAlert[]> {
  try {
    let queryStr = `
      SELECT * FROM wait_time_alerts
      WHERE status = 'active'
    `;
    const params: any[] = [];

    if (providerId) {
      queryStr += ` AND provider_id = $1`;
      params.push(providerId);
    }

    queryStr += ` ORDER BY created_at DESC`;

    const result = await query(queryStr, params);
    return result.rows.map(mapDatabaseRowToWaitTimeAlert);
  } catch (error) {
    console.error('Error getting active alerts:', error);
    throw error;
  }
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<WaitTimeAlert> {
  try {
    const now = new Date();

    const updateQuery = `
      UPDATE wait_time_alerts
      SET
        status = 'acknowledged',
        acknowledged_by = $2,
        acknowledged_at = $3
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(updateQuery, [alertId, acknowledgedBy, now]);

    await auditLog('wait_time', 'alert_acknowledged', {
      alertId,
      acknowledgedBy,
      timestamp: now,
    });

    return mapDatabaseRowToWaitTimeAlert(result.rows[0]);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    throw error;
  }
}

/**
 * Resolve an alert
 */
export async function resolveAlert(alertId: string): Promise<WaitTimeAlert> {
  try {
    const now = new Date();

    const updateQuery = `
      UPDATE wait_time_alerts
      SET
        status = 'resolved',
        resolved_at = $2
      WHERE id = $1
      RETURNING *;
    `;

    const result = await query(updateQuery, [alertId, now]);

    await auditLog('wait_time', 'alert_resolved', {
      alertId,
      timestamp: now,
    });

    return mapDatabaseRowToWaitTimeAlert(result.rows[0]);
  } catch (error) {
    console.error('Error resolving alert:', error);
    throw error;
  }
}

// ============================================
// HISTORICAL ANALYTICS FUNCTIONS
// ============================================

/**
 * Generate historical analytics for a period
 */
export async function generateHistoricalAnalytics(
  yearMonth: string // "2024-01" format
): Promise<HistoricalAnalytics> {
  try {
    const [year, month] = yearMonth.split('-');
    const startDate = new Date(`${year}-${month}-01`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const analyticsQuery = `
      SELECT
        COUNT(*) as total_services,
        AVG(client_wait_time) as avg_client_wait,
        AVG(total_service_time) as avg_total_service,
        COUNT(CASE WHEN exceeds_response_threshold OR exceeds_completion_threshold THEN 1 END) as threshold_exceeded,
        COUNT(CASE WHEN status = 'no_show' THEN 1 END) as no_show_count
      FROM wait_time_events
      WHERE created_at >= $1 AND created_at < $2;
    `;

    const analyticsResult = await query(analyticsQuery, [startDate, endDate]);
    const analytics = analyticsResult.rows[0];

    const alertsQuery = `
      SELECT COUNT(*) as total_alerts
      FROM wait_time_alerts
      WHERE created_at >= $1 AND created_at < $2;
    `;

    const alertsResult = await query(alertsQuery, [startDate, endDate]);
    const alertsCount = alertsResult.rows[0]?.total_alerts || 0;

    const satisfactionQuery = `
      SELECT AVG(satisfaction_score) as avg_satisfaction
      FROM service_reviews
      WHERE created_at >= $1 AND created_at < $2;
    `;

    const satisfactionResult = await query(satisfactionQuery, [startDate, endDate]);
    const avgSatisfaction = satisfactionResult.rows[0]?.avg_satisfaction || 0;

    const totalServices = analytics.total_services || 0;

    // Get top providers
    const topProvidersQuery = `
      SELECT
        provider_id,
        (SELECT name FROM providers WHERE id = we.provider_id) as provider_name,
        AVG(client_wait_time) as avg_wait_time,
        COUNT(*) as service_count
      FROM wait_time_events we
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY provider_id
      ORDER BY avg_wait_time ASC
      LIMIT 5;
    `;

    const topProvidersResult = await query(topProvidersQuery, [startDate, endDate]);

    // Get slowest providers
    const slowestProvidersQuery = `
      SELECT
        provider_id,
        (SELECT name FROM providers WHERE id = we.provider_id) as provider_name,
        AVG(client_wait_time) as avg_wait_time,
        COUNT(*) as service_count
      FROM wait_time_events we
      WHERE created_at >= $1 AND created_at < $2
      GROUP BY provider_id
      ORDER BY avg_wait_time DESC
      LIMIT 5;
    `;

    const slowestProvidersResult = await query(slowestProvidersQuery, [startDate, endDate]);

    return {
      period: yearMonth,
      totalServices,
      averageClientWaitTime: Math.round(analytics.avg_client_wait || 0),
      averageTotalServiceTime: Math.round(analytics.avg_total_service || 0),
      percentageThresholdExceeded:
        totalServices > 0 ? Math.round((analytics.threshold_exceeded / totalServices) * 100) : 0,
      totalAlertsGenerated: alertsCount,
      averageClientSatisfaction: Math.round(avgSatisfaction * 100) / 100,
      topProviders: topProvidersResult.rows.map((row) => ({
        providerId: row.provider_id,
        providerName: row.provider_name || 'Unknown',
        averageWaitTime: Math.round(row.avg_wait_time || 0),
      })),
      slowestProviders: slowestProvidersResult.rows.map((row) => ({
        providerId: row.provider_id,
        providerName: row.provider_name || 'Unknown',
        averageWaitTime: Math.round(row.avg_wait_time || 0),
      })),
    };
  } catch (error) {
    console.error('Error generating historical analytics:', error);
    throw error;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function mapDatabaseRowToWaitTimeEvent(row: any): WaitTimeEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    clientId: row.client_id,
    providerId: row.provider_id,
    serviceType: row.service_type,
    clientArrivalTime: new Date(row.client_arrival_time),
    providerResponseTime: row.provider_response_time ? new Date(row.provider_response_time) : undefined,
    serviceCompletionTime: row.service_completion_time
      ? new Date(row.service_completion_time)
      : undefined,
    clientWaitTime: row.client_wait_time,
    totalServiceTime: row.total_service_time,
    status: row.status,
    exceedsResponseThreshold: row.exceeds_response_threshold,
    exceedsCompletionThreshold: row.exceeds_completion_threshold,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapDatabaseRowToWaitTimeAlert(row: any): WaitTimeAlert {
  return {
    id: row.id,
    eventId: row.event_id,
    caseId: row.case_id,
    clientId: row.client_id,
    providerId: row.provider_id,
    alertType: row.alert_type,
    severity: row.severity,
    threshold: row.threshold,
    actualValue: row.actual_value,
    message: row.message,
    status: row.status,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at) : undefined,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : undefined,
    createdAt: new Date(row.created_at),
  };
}

export default {
  recordClientArrival,
  recordProviderResponse,
  recordServiceCompletion,
  getCurrentWaitTime,
  getProviderAverageWaitTimes,
  generateProviderMetrics,
  getTopProvidersByPerformance,
  correlateWaitTimesWithSatisfaction,
  getActiveAlerts,
  acknowledgeAlert,
  resolveAlert,
  generateHistoricalAnalytics,
};
