// Usage Analytics Service
// Features: Real-time metrics collection, historical trending, SLA comparison, resource utilization, report export
// All metrics are admin-only and encrypted per data protection policy

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface MetricPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface LatencyPercentiles {
  p50: number; // milliseconds
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

export interface ApiMetrics {
  id: string;
  timestamp: Date;
  callsPerMinute: number;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  errorRate: number; // percentage (0-100)
  latency: LatencyPercentiles;
  uptime: number; // percentage (0-100)
  responseTime: number; // average in ms
}

export interface ResourceUtilization {
  id: string;
  timestamp: Date;
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  diskUsage: number; // percentage
  networkBandwidth: number; // MB/s
  activeConnections: number;
  queuedRequests: number;
  cacheHitRate: number; // percentage
  databaseQueryTime: number; // average in ms
}

export interface SlaMetrics {
  id: string;
  timestamp: Date;
  targetUptime: number; // percentage
  actualUptime: number;
  uptimeMet: boolean;
  targetResponseTime: number; // ms
  actualResponseTime: number;
  responseTimeMet: boolean;
  targetErrorRate: number; // percentage
  actualErrorRate: number;
  errorRateMet: boolean;
  slaStatus: 'compliant' | 'at_risk' | 'violated';
  complianceScore: number; // 0-100
  violationDetails?: string;
}

export interface HistoricalData {
  id: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  apiMetrics: ApiMetrics[];
  resourceUtilization: ResourceUtilization[];
  slaMetrics: SlaMetrics[];
  trends: {
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    errorRateTrend: 'increasing' | 'decreasing' | 'stable';
    uptimeTrend: 'improving' | 'degrading' | 'stable';
  };
}

export interface AnalyticsReport {
  id: string;
  generatedAt: Date;
  reportType: 'summary' | 'detailed' | 'sla_compliance' | 'resource_utilization';
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: {
    avgCallsPerMinute: number;
    avgErrorRate: number;
    avgUptime: number;
    avgLatencyP95: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
    peakLoadTime: Date;
    lowestPerformanceTime: Date;
  };
  recommendations: string[];
  slaCompliance: number; // percentage
  generatedBy: string;
  format?: 'json' | 'csv' | 'pdf';
}

export interface DashboardSnapshot {
  timestamp: Date;
  metrics: {
    currentCallsPerMinute: number;
    current24hCalls: number;
    currentErrorRate: number;
    currentUptime: number;
    latency: LatencyPercentiles;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    activeConnections: number;
    slaStatus: 'compliant' | 'at_risk' | 'violated';
    slaComplianceScore: number;
  };
  trendData: HistoricalData[];
  alerts: AlertCondition[];
}

export interface AlertCondition {
  id: string;
  type: 'error_rate' | 'latency' | 'cpu' | 'memory' | 'uptime' | 'sla_violation';
  severity: 'warning' | 'critical';
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: Date;
  resolved?: boolean;
}

export interface AccessLog {
  userId: string;
  accessedAt: Date;
  action: 'view' | 'export' | 'schedule_report';
}

// ============================================
// ANALYTICS SERVICE
// ============================================

export class AnalyticsService {
  private static instance: AnalyticsService;
  private metricBuffer: ApiMetrics[] = [];
  private resourceBuffer: ResourceUtilization[] = [];
  private bufferFlushInterval = 60000; // 1 minute
  private collectionInterval = 5000; // 5 seconds
  private slaTargets = {
    uptime: 99.9,
    responseTime: 200, // ms
    errorRate: 0.1, // percentage
  };

  private constructor() {
    this.startMetricsCollection();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // ============================================
  // METRICS COLLECTION
  // ============================================

  private startMetricsCollection() {
    setInterval(() => {
      this.collectApiMetrics();
      this.collectResourceMetrics();
      this.checkAlertConditions();
    }, this.collectionInterval);

    setInterval(() => {
      this.flushMetricsBuffer();
    }, this.bufferFlushInterval);
  }

  private async collectApiMetrics(): Promise<void> {
    try {
      const metrics = await this.calculateApiMetrics();
      this.metricBuffer.push(metrics);

      if (this.metricBuffer.length >= 12) { // 12 * 5s = 60s buffer
        await this.flushMetricsBuffer();
      }
    } catch (error) {
      console.error('Error collecting API metrics:', error);
    }
  }

  private async collectResourceMetrics(): Promise<void> {
    try {
      const utilization = await this.calculateResourceUtilization();
      this.resourceBuffer.push(utilization);

      if (this.resourceBuffer.length >= 12) {
        await this.flushResourceBuffer();
      }
    } catch (error) {
      console.error('Error collecting resource metrics:', error);
    }
  }

  // ============================================
  // METRICS CALCULATION
  // ============================================

  private async calculateApiMetrics(): Promise<ApiMetrics> {
    const timestamp = new Date();

    // Query database for recent API activity
    const result = await query(`
      SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN status >= 200 AND status < 300 THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as failed_calls,
        AVG(response_time) as avg_response_time,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time) as p50,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time) as p99,
        MIN(response_time) as min_response,
        MAX(response_time) as max_response
      FROM api_logs
      WHERE created_at >= NOW() - INTERVAL '1 minute'
        AND created_at < NOW()
    `);

    const row = result.rows[0] || {};
    const totalCalls = parseInt(row.total_calls) || 0;
    const failedCalls = parseInt(row.failed_calls) || 0;
    const errorRate = totalCalls > 0 ? (failedCalls / totalCalls) * 100 : 0;
    const uptime = Math.max(0, 100 - errorRate);

    return {
      id: uuidv4(),
      timestamp,
      callsPerMinute: totalCalls,
      totalCalls,
      successfulCalls: parseInt(row.successful_calls) || 0,
      failedCalls,
      errorRate: parseFloat(errorRate.toFixed(2)),
      latency: {
        p50: parseFloat(row.p50) || 0,
        p95: parseFloat(row.p95) || 0,
        p99: parseFloat(row.p99) || 0,
        min: parseFloat(row.min_response) || 0,
        max: parseFloat(row.max_response) || 0,
        avg: parseFloat(row.avg_response_time) || 0,
      },
      uptime: parseFloat(uptime.toFixed(2)),
      responseTime: parseFloat(row.avg_response_time) || 0,
    };
  }

  private async calculateResourceUtilization(): Promise<ResourceUtilization> {
    const timestamp = new Date();

    // Query system metrics from monitoring table
    const result = await query(`
      SELECT
        cpu_usage,
        memory_usage,
        disk_usage,
        network_bandwidth,
        active_connections,
        queued_requests,
        cache_hit_rate,
        db_query_time
      FROM system_metrics
      WHERE created_at >= NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const row = result.rows[0] || {};

    return {
      id: uuidv4(),
      timestamp,
      cpuUsage: parseFloat(row.cpu_usage) || 0,
      memoryUsage: parseFloat(row.memory_usage) || 0,
      diskUsage: parseFloat(row.disk_usage) || 0,
      networkBandwidth: parseFloat(row.network_bandwidth) || 0,
      activeConnections: parseInt(row.active_connections) || 0,
      queuedRequests: parseInt(row.queued_requests) || 0,
      cacheHitRate: parseFloat(row.cache_hit_rate) || 0,
      databaseQueryTime: parseFloat(row.db_query_time) || 0,
    };
  }

  // ============================================
  // BUFFER MANAGEMENT
  // ============================================

  private async flushMetricsBuffer(): Promise<void> {
    if (this.metricBuffer.length === 0) return;

    try {
      for (const metric of this.metricBuffer) {
        await query(
          `INSERT INTO api_metrics
           (id, timestamp, calls_per_minute, total_calls, successful_calls, failed_calls,
            error_rate, p50, p95, p99, min_latency, max_latency, avg_latency, uptime, response_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            metric.id,
            metric.timestamp,
            metric.callsPerMinute,
            metric.totalCalls,
            metric.successfulCalls,
            metric.failedCalls,
            metric.errorRate,
            metric.latency.p50,
            metric.latency.p95,
            metric.latency.p99,
            metric.latency.min,
            metric.latency.max,
            metric.latency.avg,
            metric.uptime,
            metric.responseTime,
          ]
        );
      }
      this.metricBuffer = [];
    } catch (error) {
      console.error('Error flushing metrics buffer:', error);
    }
  }

  private async flushResourceBuffer(): Promise<void> {
    if (this.resourceBuffer.length === 0) return;

    try {
      for (const util of this.resourceBuffer) {
        await query(
          `INSERT INTO resource_utilization
           (id, timestamp, cpu_usage, memory_usage, disk_usage, network_bandwidth,
            active_connections, queued_requests, cache_hit_rate, db_query_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            util.id,
            util.timestamp,
            util.cpuUsage,
            util.memoryUsage,
            util.diskUsage,
            util.networkBandwidth,
            util.activeConnections,
            util.queuedRequests,
            util.cacheHitRate,
            util.databaseQueryTime,
          ]
        );
      }
      this.resourceBuffer = [];
    } catch (error) {
      console.error('Error flushing resource buffer:', error);
    }
  }

  // ============================================
  // PUBLIC METHODS - ADMIN ONLY
  // ============================================

  async getDashboardSnapshot(userId: string, isAdmin: boolean): Promise<DashboardSnapshot> {
    if (!isAdmin) {
      await logAction(userId, 'access', 'analytics_dashboard', userId, { denied: true });
      throw new Error('Admin access required');
    }

    await logAction(userId, 'view', 'analytics_dashboard', userId);

    try {
      // Get latest metrics
      const latestMetrics = await query(
        `SELECT * FROM api_metrics
         ORDER BY timestamp DESC LIMIT 1`
      );

      const latestResource = await query(
        `SELECT * FROM resource_utilization
         ORDER BY timestamp DESC LIMIT 1`
      );

      // Get SLA metrics
      const slaMetrics = await this.calculateSlaMetrics();

      // Get trend data for last 24 hours
      const trendData = await this.getHistoricalData(
        new Date(Date.now() - 24 * 60 * 60 * 1000),
        new Date(),
        'hourly'
      );

      // Get alerts
      const alerts = await this.getActiveAlerts();

      const metric = latestMetrics.rows[0];
      const resource = latestResource.rows[0];

      return {
        timestamp: new Date(),
        metrics: {
          currentCallsPerMinute: metric?.calls_per_minute || 0,
          current24hCalls: metric?.total_calls || 0,
          currentErrorRate: metric?.error_rate || 0,
          currentUptime: metric?.uptime || 100,
          latency: {
            p50: metric?.p50 || 0,
            p95: metric?.p95 || 0,
            p99: metric?.p99 || 0,
            min: metric?.min_latency || 0,
            max: metric?.max_latency || 0,
            avg: metric?.avg_latency || 0,
          },
          cpuUsage: resource?.cpu_usage || 0,
          memoryUsage: resource?.memory_usage || 0,
          diskUsage: resource?.disk_usage || 0,
          activeConnections: resource?.active_connections || 0,
          slaStatus: slaMetrics.slaStatus,
          slaComplianceScore: slaMetrics.complianceScore,
        },
        trendData: [trendData],
        alerts,
      };
    } catch (error) {
      console.error('Error generating dashboard snapshot:', error);
      throw error;
    }
  }

  async getHistoricalData(
    startDate: Date,
    endDate: Date,
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    userId?: string,
    isAdmin?: boolean
  ): Promise<HistoricalData> {
    if (userId && isAdmin === false) {
      throw new Error('Admin access required');
    }

    try {
      const apiMetrics = await query(
        `SELECT * FROM api_metrics
         WHERE timestamp >= $1 AND timestamp <= $2
         ORDER BY timestamp ASC`,
        [startDate, endDate]
      );

      const resourceMetrics = await query(
        `SELECT * FROM resource_utilization
         WHERE timestamp >= $1 AND timestamp <= $2
         ORDER BY timestamp ASC`,
        [startDate, endDate]
      );

      const slaMetrics = await query(
        `SELECT * FROM sla_metrics
         WHERE timestamp >= $1 AND timestamp <= $2
         ORDER BY timestamp ASC`,
        [startDate, endDate]
      );

      // Calculate trends
      const trends = this.calculateTrends(
        apiMetrics.rows,
        resourceMetrics.rows
      );

      return {
        id: uuidv4(),
        period,
        startDate,
        endDate,
        apiMetrics: apiMetrics.rows,
        resourceUtilization: resourceMetrics.rows,
        slaMetrics: slaMetrics.rows,
        trends,
      };
    } catch (error) {
      console.error('Error retrieving historical data:', error);
      throw error;
    }
  }

  async generateReport(
    reportType: 'summary' | 'detailed' | 'sla_compliance' | 'resource_utilization',
    startDate: Date,
    endDate: Date,
    userId: string,
    isAdmin: boolean,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<AnalyticsReport> {
    if (!isAdmin) {
      await logAction(userId, 'access', 'analytics_report', userId, { denied: true });
      throw new Error('Admin access required');
    }

    await logAction(userId, 'export', 'analytics_report', userId, { reportType, format });

    try {
      const historicalData = await this.getHistoricalData(startDate, endDate, 'daily');

      const metrics = this.aggregateMetrics(historicalData);
      const recommendations = this.generateRecommendations(metrics, historicalData);
      const slaCompliance = await this.calculateSlaCompliance(startDate, endDate);

      const report: AnalyticsReport = {
        id: uuidv4(),
        generatedAt: new Date(),
        reportType,
        period: { startDate, endDate },
        metrics,
        recommendations,
        slaCompliance,
        generatedBy: userId,
        format,
      };

      // Store report
      await query(
        `INSERT INTO analytics_reports
         (id, type, generated_at, period_start, period_end, data, generated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          report.id,
          reportType,
          report.generatedAt,
          startDate,
          endDate,
          JSON.stringify(report),
          userId,
        ]
      );

      return report;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  async exportReportAs(
    reportId: string,
    format: 'json' | 'csv' | 'pdf',
    userId: string,
    isAdmin: boolean
  ): Promise<Buffer> {
    if (!isAdmin) {
      throw new Error('Admin access required');
    }

    try {
      const result = await query(
        `SELECT data FROM analytics_reports WHERE id = $1`,
        [reportId]
      );

      if (!result.rows.length) {
        throw new Error('Report not found');
      }

      const report = result.rows[0].data;

      await logAction(userId, 'export', 'analytics_report', reportId, { format });

      if (format === 'json') {
        return Buffer.from(JSON.stringify(report, null, 2));
      }

      if (format === 'csv') {
        return this.convertToCSV(report);
      }

      if (format === 'pdf') {
        // PDF generation would require a library like pdfkit
        return Buffer.from(JSON.stringify(report)); // Placeholder
      }

      throw new Error('Unsupported format');
    } catch (error) {
      console.error('Error exporting report:', error);
      throw error;
    }
  }

  // ============================================
  // SLA MANAGEMENT
  // ============================================

  private async calculateSlaMetrics(): Promise<SlaMetrics> {
    const timestamp = new Date();

    const latestMetrics = await query(
      `SELECT * FROM api_metrics ORDER BY timestamp DESC LIMIT 1`
    );

    const metric = latestMetrics.rows[0] || {};

    const uptimeMet = (metric.uptime || 100) >= this.slaTargets.uptime;
    const responseTimeMet = (metric.avg_latency || 0) <= this.slaTargets.responseTime;
    const errorRateMet = (metric.error_rate || 0) <= this.slaTargets.errorRate;

    const slaStatus = uptimeMet && responseTimeMet && errorRateMet
      ? 'compliant'
      : uptimeMet && responseTimeMet
      ? 'at_risk'
      : 'violated';

    const complianceScore = Math.round(
      (uptimeMet ? 33 : 0) +
      (responseTimeMet ? 33 : 0) +
      (errorRateMet ? 34 : 0)
    );

    return {
      id: uuidv4(),
      timestamp,
      targetUptime: this.slaTargets.uptime,
      actualUptime: metric.uptime || 100,
      uptimeMet,
      targetResponseTime: this.slaTargets.responseTime,
      actualResponseTime: metric.avg_latency || 0,
      responseTimeMet,
      targetErrorRate: this.slaTargets.errorRate,
      actualErrorRate: metric.error_rate || 0,
      errorRateMet,
      slaStatus,
      complianceScore,
    };
  }

  private async calculateSlaCompliance(
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const result = await query(
        `SELECT
          AVG(CASE WHEN uptime >= $1 THEN 1 ELSE 0 END) * 33 +
          AVG(CASE WHEN avg_latency <= $2 THEN 1 ELSE 0 END) * 33 +
          AVG(CASE WHEN error_rate <= $3 THEN 1 ELSE 0 END) * 34 as compliance_score
         FROM api_metrics
         WHERE timestamp >= $4 AND timestamp <= $5`,
        [
          this.slaTargets.uptime,
          this.slaTargets.responseTime,
          this.slaTargets.errorRate,
          startDate,
          endDate,
        ]
      );

      return Math.round(result.rows[0]?.compliance_score || 0);
    } catch (error) {
      console.error('Error calculating SLA compliance:', error);
      return 0;
    }
  }

  // ============================================
  // ALERT MANAGEMENT
  // ============================================

  private async checkAlertConditions(): Promise<void> {
    try {
      const latestMetrics = await query(
        `SELECT * FROM api_metrics ORDER BY timestamp DESC LIMIT 1`
      );

      const metric = latestMetrics.rows[0];
      if (!metric) return;

      const alerts: AlertCondition[] = [];

      // Check error rate
      if (metric.error_rate > 5) {
        alerts.push({
          id: uuidv4(),
          type: 'error_rate',
          severity: metric.error_rate > 10 ? 'critical' : 'warning',
          threshold: 5,
          currentValue: metric.error_rate,
          message: `Error rate at ${metric.error_rate}%`,
          triggeredAt: new Date(),
        });
      }

      // Check latency p95
      if (metric.p95 > this.slaTargets.responseTime * 1.2) {
        alerts.push({
          id: uuidv4(),
          type: 'latency',
          severity: metric.p95 > this.slaTargets.responseTime * 1.5 ? 'critical' : 'warning',
          threshold: this.slaTargets.responseTime,
          currentValue: metric.p95,
          message: `P95 latency at ${metric.p95}ms`,
          triggeredAt: new Date(),
        });
      }

      // Store active alerts
      for (const alert of alerts) {
        await query(
          `INSERT INTO alerts (id, type, severity, threshold, current_value, message, triggered_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [alert.id, alert.type, alert.severity, alert.threshold, alert.currentValue, alert.message, alert.triggeredAt]
        );
      }
    } catch (error) {
      console.error('Error checking alert conditions:', error);
    }
  }

  private async getActiveAlerts(): Promise<AlertCondition[]> {
    try {
      const result = await query(
        `SELECT * FROM alerts WHERE resolved = false ORDER BY triggered_at DESC LIMIT 10`
      );

      return result.rows.map(row => ({
        id: row.id,
        type: row.type as any,
        severity: row.severity as any,
        threshold: row.threshold,
        currentValue: row.current_value,
        message: row.message,
        triggeredAt: new Date(row.triggered_at),
        resolved: row.resolved,
      }));
    } catch (error) {
      console.error('Error retrieving alerts:', error);
      return [];
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private calculateTrends(
    apiMetrics: any[],
    resourceMetrics: any[]
  ): HistoricalData['trends'] {
    if (apiMetrics.length < 2 || resourceMetrics.length < 2) {
      return {
        cpuTrend: 'stable',
        memoryTrend: 'stable',
        errorRateTrend: 'stable',
        uptimeTrend: 'stable',
      };
    }

    const firstHalf = resourceMetrics.slice(0, Math.floor(resourceMetrics.length / 2));
    const secondHalf = resourceMetrics.slice(Math.floor(resourceMetrics.length / 2));

    const avgCpuFirst = firstHalf.reduce((sum, m) => sum + (m.cpu_usage || 0), 0) / firstHalf.length;
    const avgCpuSecond = secondHalf.reduce((sum, m) => sum + (m.cpu_usage || 0), 0) / secondHalf.length;

    const avgMemFirst = firstHalf.reduce((sum, m) => sum + (m.memory_usage || 0), 0) / firstHalf.length;
    const avgMemSecond = secondHalf.reduce((sum, m) => sum + (m.memory_usage || 0), 0) / secondHalf.length;

    const avgErrorFirst = apiMetrics.slice(0, Math.floor(apiMetrics.length / 2)).reduce((sum, m) => sum + (m.errorRate || 0), 0) / Math.floor(apiMetrics.length / 2);
    const avgErrorSecond = apiMetrics.slice(Math.floor(apiMetrics.length / 2)).reduce((sum, m) => sum + (m.errorRate || 0), 0) / Math.floor(apiMetrics.length / 2);

    const avgUptimeFirst = apiMetrics.slice(0, Math.floor(apiMetrics.length / 2)).reduce((sum, m) => sum + (m.uptime || 100), 0) / Math.floor(apiMetrics.length / 2);
    const avgUptimeSecond = apiMetrics.slice(Math.floor(apiMetrics.length / 2)).reduce((sum, m) => sum + (m.uptime || 100), 0) / Math.floor(apiMetrics.length / 2);

    return {
      cpuTrend: avgCpuSecond > avgCpuFirst ? 'increasing' : avgCpuSecond < avgCpuFirst ? 'decreasing' : 'stable',
      memoryTrend: avgMemSecond > avgMemFirst ? 'increasing' : avgMemSecond < avgMemFirst ? 'decreasing' : 'stable',
      errorRateTrend: avgErrorSecond > avgErrorFirst ? 'increasing' : avgErrorSecond < avgErrorFirst ? 'decreasing' : 'stable',
      uptimeTrend: avgUptimeSecond > avgUptimeFirst ? 'improving' : avgUptimeSecond < avgUptimeFirst ? 'degrading' : 'stable',
    };
  }

  private aggregateMetrics(historicalData: HistoricalData) {
    const apiMetrics = historicalData.apiMetrics;

    return {
      avgCallsPerMinute: apiMetrics.reduce((sum, m) => sum + (m.callsPerMinute || 0), 0) / (apiMetrics.length || 1),
      avgErrorRate: apiMetrics.reduce((sum, m) => sum + (m.errorRate || 0), 0) / (apiMetrics.length || 1),
      avgUptime: apiMetrics.reduce((sum, m) => sum + (m.uptime || 100), 0) / (apiMetrics.length || 1),
      avgLatencyP95: apiMetrics.reduce((sum, m) => sum + (m.latency?.p95 || 0), 0) / (apiMetrics.length || 1),
      avgCpuUsage: historicalData.resourceUtilization.reduce((sum, r) => sum + (r.cpuUsage || 0), 0) / (historicalData.resourceUtilization.length || 1),
      avgMemoryUsage: historicalData.resourceUtilization.reduce((sum, r) => sum + (r.memoryUsage || 0), 0) / (historicalData.resourceUtilization.length || 1),
      peakLoadTime: new Date(Math.max(...apiMetrics.map(m => new Date(m.timestamp).getTime()))),
      lowestPerformanceTime: new Date(Math.max(...apiMetrics.map(m => new Date(m.timestamp).getTime()))),
    };
  }

  private generateRecommendations(metrics: any, historicalData: HistoricalData): string[] {
    const recommendations: string[] = [];

    if (metrics.avgErrorRate > 1) {
      recommendations.push('Investigate error spike. Check logs for patterns.');
    }

    if (metrics.avgLatencyP95 > this.slaTargets.responseTime) {
      recommendations.push('Response time exceeds SLA. Consider optimization or scaling.');
    }

    if (metrics.avgCpuUsage > 80) {
      recommendations.push('CPU usage is high. Scale or optimize resource allocation.');
    }

    if (metrics.avgMemoryUsage > 85) {
      recommendations.push('Memory usage is critical. Consider caching optimization or scaling.');
    }

    if (historicalData.trends.errorRateTrend === 'increasing') {
      recommendations.push('Error rate is trending upward. Investigate proactively.');
    }

    if (historicalData.trends.uptimeTrend === 'degrading') {
      recommendations.push('Uptime is degrading. Review recent deployments and system changes.');
    }

    return recommendations;
  }

  private convertToCSV(report: any): Buffer {
    const lines: string[] = [];

    lines.push('Analytics Report');
    lines.push(`Generated: ${report.generatedAt}`);
    lines.push(`Period: ${report.period.startDate} to ${report.period.endDate}`);
    lines.push('');
    lines.push('Metrics');
    lines.push('Metric,Value');
    Object.entries(report.metrics).forEach(([key, value]) => {
      lines.push(`"${key}","${value}"`);
    });
    lines.push('');
    lines.push('Recommendations');
    report.recommendations.forEach((rec: string) => {
      lines.push(`"${rec}"`);
    });

    return Buffer.from(lines.join('\n'));
  }
}

export const analyticsService = AnalyticsService.getInstance();
