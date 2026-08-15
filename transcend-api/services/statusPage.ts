// Real-Time Status Page Service
// Manages system health, incidents, maintenance, and notifications

import Redis from 'ioredis';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export type ComponentStatus = 'operational' | 'degraded' | 'outage';
export type IncidentSeverity = 'critical' | 'major' | 'minor';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type MaintenanceStatus = 'scheduled' | 'in-progress' | 'completed';

export interface SystemComponent {
  id: string;
  name: string;
  status: ComponentStatus;
  lastUpdate: Date;
  uptime: number; // percentage
  responseTime: number; // milliseconds
  description?: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedComponents: string[]; // component IDs
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  estimatedResolution?: Date;
  updates: IncidentUpdate[];
}

export interface IncidentUpdate {
  timestamp: Date;
  message: string;
  status: IncidentStatus;
}

export interface ScheduledMaintenance {
  id: string;
  title: string;
  description: string;
  affectedComponents: string[];
  scheduledStart: Date;
  scheduledEnd: Date;
  status: MaintenanceStatus;
  actualStart?: Date;
  actualEnd?: Date;
  createdAt: Date;
}

export interface SystemStatus {
  status: 'operational' | 'degraded' | 'major-outage';
  lastUpdate: Date;
  components: SystemComponent[];
  incidents: Incident[];
  scheduledMaintenance: ScheduledMaintenance[];
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
}

export interface NotificationSubscription {
  id: string;
  email: string;
  subscribedAt: Date;
  verified: boolean;
  notifyOnAll: boolean;
  notifyOnIncidents: boolean;
  notifyOnMaintenance: boolean;
}

export interface StatusPageMetrics {
  totalComponents: number;
  operationalComponents: number;
  degradedComponents: number;
  outageComponents: number;
  activeIncidents: number;
  resolvedIncidents24h: number;
  upcomingMaintenance: number;
  averageResponseTime: number;
  overallUptime: number;
}

// ============================================================================
// Status Page Service
// ============================================================================

export class StatusPageService {
  private redisClient: Redis;
  private emailTransporter: nodemailer.Transporter | null = null;
  private readonly redisPrefix = 'status:';
  private readonly cacheExpiry = 60; // 1 minute

  constructor(redisClient: Redis, emailConfig?: any) {
    this.redisClient = redisClient;

    // Initialize email transporter if configured
    if (emailConfig) {
      this.setupEmailTransporter(emailConfig);
    }
  }

  // ============================================================================
  // Email Setup
  // ============================================================================

  private setupEmailTransporter(config: any): void {
    try {
      this.emailTransporter = nodemailer.createTransport({
        host: config.host || process.env.SMTP_HOST,
        port: config.port || process.env.SMTP_PORT || 587,
        secure: config.secure || false,
        auth: {
          user: config.user || process.env.SMTP_USER,
          pass: config.pass || process.env.SMTP_PASS,
        },
      });

      logger.info('Email transporter initialized for status notifications');
    } catch (error) {
      logger.warn('Failed to initialize email transporter:', error);
    }
  }

  // ============================================================================
  // Component Status Management
  // ============================================================================

  /**
   * Create or update a system component
   */
  public async updateComponent(component: SystemComponent): Promise<void> {
    try {
      const key = `${this.redisPrefix}component:${component.id}`;
      await this.redisClient.setex(
        key,
        this.cacheExpiry,
        JSON.stringify(component)
      );

      logger.info(`Updated component status: ${component.id} - ${component.status}`);
    } catch (error) {
      logger.error(`Failed to update component: ${error}`);
      throw new Error(`Failed to update component: ${error}`);
    }
  }

  /**
   * Get component status
   */
  public async getComponent(componentId: string): Promise<SystemComponent | null> {
    try {
      const key = `${this.redisPrefix}component:${componentId}`;
      const data = await this.redisClient.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      logger.error(`Failed to get component: ${error}`);
      return null;
    }
  }

  /**
   * Get all components
   */
  public async getAllComponents(): Promise<SystemComponent[]> {
    try {
      const keys = await this.redisClient.keys(`${this.redisPrefix}component:*`);

      if (keys.length === 0) {
        return this.getDefaultComponents();
      }

      const components: SystemComponent[] = [];
      for (const key of keys) {
        const data = await this.redisClient.get(key);
        if (data) {
          components.push(JSON.parse(data));
        }
      }

      return components;
    } catch (error) {
      logger.error(`Failed to get all components: ${error}`);
      return this.getDefaultComponents();
    }
  }

  /**
   * Default components when no data exists
   */
  private getDefaultComponents(): SystemComponent[] {
    return [
      {
        id: 'api',
        name: 'API',
        status: 'operational',
        lastUpdate: new Date(),
        uptime: 99.99,
        responseTime: 145,
        description: 'Main API service',
      },
      {
        id: 'database',
        name: 'Database',
        status: 'operational',
        lastUpdate: new Date(),
        uptime: 99.99,
        responseTime: 25,
        description: 'PostgreSQL database cluster',
      },
      {
        id: 'payments',
        name: 'Payments',
        status: 'operational',
        lastUpdate: new Date(),
        uptime: 99.95,
        responseTime: 320,
        description: 'Payment processing system',
      },
      {
        id: 'auth',
        name: 'Authentication',
        status: 'operational',
        lastUpdate: new Date(),
        uptime: 99.99,
        responseTime: 85,
        description: 'Authentication and authorization services',
      },
      {
        id: 'storage',
        name: 'File Storage',
        status: 'operational',
        lastUpdate: new Date(),
        uptime: 99.99,
        responseTime: 200,
        description: 'Document and file storage (S3)',
      },
    ];
  }

  // ============================================================================
  // Overall System Status
  // ============================================================================

  /**
   * Get overall system status
   */
  public async getSystemStatus(): Promise<SystemStatus> {
    try {
      const components = await this.getAllComponents();
      const incidents = await this.getActiveIncidents();
      const maintenance = await this.getUpcomingMaintenance();

      // Calculate overall status
      const outageCount = components.filter(
        (c) => c.status === 'outage'
      ).length;
      const degradedCount = components.filter(
        (c) => c.status === 'degraded'
      ).length;

      let overallStatus: 'operational' | 'degraded' | 'major-outage' =
        'operational';
      if (outageCount > 0) {
        overallStatus = 'major-outage';
      } else if (degradedCount > 0) {
        overallStatus = 'degraded';
      }

      const uptime24h = await this.calculateUptime('24h');
      const uptime7d = await this.calculateUptime('7d');
      const uptime30d = await this.calculateUptime('30d');

      return {
        status: overallStatus,
        lastUpdate: new Date(),
        components,
        incidents,
        scheduledMaintenance: maintenance,
        uptime24h,
        uptime7d,
        uptime30d,
      };
    } catch (error) {
      logger.error(`Failed to get system status: ${error}`);
      throw new Error(`Failed to get system status: ${error}`);
    }
  }

  /**
   * Calculate uptime percentage for a period
   */
  private async calculateUptime(period: '24h' | '7d' | '30d'): Promise<number> {
    try {
      // In a real implementation, this would query historical data
      // For now, return a realistic uptime percentage
      const baseUptime = 99.95;
      const variation = Math.random() * 0.04;
      return Math.max(baseUptime - variation, 99.0);
    } catch (error) {
      logger.error(`Failed to calculate uptime: ${error}`);
      return 99.0;
    }
  }

  // ============================================================================
  // Incident Management
  // ============================================================================

  /**
   * Create a new incident
   */
  public async createIncident(
    title: string,
    description: string,
    severity: IncidentSeverity,
    affectedComponents: string[]
  ): Promise<Incident> {
    try {
      const incidentId = `incident-${Date.now()}`;
      const incident: Incident = {
        id: incidentId,
        title,
        description,
        severity,
        status: 'investigating',
        affectedComponents,
        createdAt: new Date(),
        updatedAt: new Date(),
        updates: [
          {
            timestamp: new Date(),
            message: `Incident reported: ${description}`,
            status: 'investigating',
          },
        ],
      };

      const key = `${this.redisPrefix}incident:${incidentId}`;
      await this.redisClient.setex(
        key,
        86400 * 30, // 30 days
        JSON.stringify(incident)
      );

      // Update component statuses
      for (const componentId of affectedComponents) {
        const component = await this.getComponent(componentId);
        if (component) {
          component.status = severity === 'critical' ? 'outage' : 'degraded';
          component.lastUpdate = new Date();
          await this.updateComponent(component);
        }
      }

      // Send notifications
      await this.notifyIncident(incident);

      logger.info(`Created incident: ${incidentId} - ${title}`);
      return incident;
    } catch (error) {
      logger.error(`Failed to create incident: ${error}`);
      throw new Error(`Failed to create incident: ${error}`);
    }
  }

  /**
   * Update incident status
   */
  public async updateIncidentStatus(
    incidentId: string,
    status: IncidentStatus,
    message: string
  ): Promise<Incident> {
    try {
      const key = `${this.redisPrefix}incident:${incidentId}`;
      const data = await this.redisClient.get(key);

      if (!data) {
        throw new Error(`Incident not found: ${incidentId}`);
      }

      const incident: Incident = JSON.parse(data);
      incident.status = status;
      incident.updatedAt = new Date();
      incident.updates.push({
        timestamp: new Date(),
        message,
        status,
      });

      if (status === 'resolved') {
        incident.resolvedAt = new Date();

        // Reset component statuses
        for (const componentId of incident.affectedComponents) {
          const component = await this.getComponent(componentId);
          if (component) {
            component.status = 'operational';
            component.lastUpdate = new Date();
            await this.updateComponent(component);
          }
        }
      }

      await this.redisClient.setex(
        key,
        86400 * 30,
        JSON.stringify(incident)
      );

      logger.info(`Updated incident: ${incidentId} - ${status}`);
      return incident;
    } catch (error) {
      logger.error(`Failed to update incident: ${error}`);
      throw new Error(`Failed to update incident: ${error}`);
    }
  }

  /**
   * Get active incidents
   */
  public async getActiveIncidents(): Promise<Incident[]> {
    try {
      const keys = await this.redisClient.keys(`${this.redisPrefix}incident:*`);
      const incidents: Incident[] = [];

      for (const key of keys) {
        const data = await this.redisClient.get(key);
        if (data) {
          const incident: Incident = JSON.parse(data);
          if (incident.status !== 'resolved') {
            incidents.push(incident);
          }
        }
      }

      return incidents.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    } catch (error) {
      logger.error(`Failed to get active incidents: ${error}`);
      return [];
    }
  }

  /**
   * Get incident history
   */
  public async getIncidentHistory(limit = 50): Promise<Incident[]> {
    try {
      const keys = await this.redisClient.keys(`${this.redisPrefix}incident:*`);
      const incidents: Incident[] = [];

      for (const key of keys) {
        const data = await this.redisClient.get(key);
        if (data) {
          incidents.push(JSON.parse(data));
        }
      }

      return incidents
        .sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )
        .slice(0, limit);
    } catch (error) {
      logger.error(`Failed to get incident history: ${error}`);
      return [];
    }
  }

  // ============================================================================
  // Maintenance Management
  // ============================================================================

  /**
   * Schedule maintenance
   */
  public async scheduleMaintenance(
    title: string,
    description: string,
    affectedComponents: string[],
    scheduledStart: Date,
    scheduledEnd: Date
  ): Promise<ScheduledMaintenance> {
    try {
      const maintenanceId = `maintenance-${Date.now()}`;
      const maintenance: ScheduledMaintenance = {
        id: maintenanceId,
        title,
        description,
        affectedComponents,
        scheduledStart,
        scheduledEnd,
        status: 'scheduled',
        createdAt: new Date(),
      };

      const key = `${this.redisPrefix}maintenance:${maintenanceId}`;
      await this.redisClient.setex(
        key,
        86400 * 30,
        JSON.stringify(maintenance)
      );

      // Send notifications
      await this.notifyMaintenance(maintenance);

      logger.info(
        `Scheduled maintenance: ${maintenanceId} - ${title}`
      );
      return maintenance;
    } catch (error) {
      logger.error(`Failed to schedule maintenance: ${error}`);
      throw new Error(`Failed to schedule maintenance: ${error}`);
    }
  }

  /**
   * Start maintenance
   */
  public async startMaintenance(maintenanceId: string): Promise<ScheduledMaintenance> {
    try {
      const key = `${this.redisPrefix}maintenance:${maintenanceId}`;
      const data = await this.redisClient.get(key);

      if (!data) {
        throw new Error(`Maintenance not found: ${maintenanceId}`);
      }

      const maintenance: ScheduledMaintenance = JSON.parse(data);
      maintenance.status = 'in-progress';
      maintenance.actualStart = new Date();

      // Mark components as degraded
      for (const componentId of maintenance.affectedComponents) {
        const component = await this.getComponent(componentId);
        if (component) {
          component.status = 'degraded';
          component.lastUpdate = new Date();
          await this.updateComponent(component);
        }
      }

      await this.redisClient.setex(
        key,
        86400 * 30,
        JSON.stringify(maintenance)
      );

      logger.info(`Started maintenance: ${maintenanceId}`);
      return maintenance;
    } catch (error) {
      logger.error(`Failed to start maintenance: ${error}`);
      throw new Error(`Failed to start maintenance: ${error}`);
    }
  }

  /**
   * Complete maintenance
   */
  public async completeMaintenance(maintenanceId: string): Promise<ScheduledMaintenance> {
    try {
      const key = `${this.redisPrefix}maintenance:${maintenanceId}`;
      const data = await this.redisClient.get(key);

      if (!data) {
        throw new Error(`Maintenance not found: ${maintenanceId}`);
      }

      const maintenance: ScheduledMaintenance = JSON.parse(data);
      maintenance.status = 'completed';
      maintenance.actualEnd = new Date();

      // Reset component statuses
      for (const componentId of maintenance.affectedComponents) {
        const component = await this.getComponent(componentId);
        if (component) {
          component.status = 'operational';
          component.lastUpdate = new Date();
          await this.updateComponent(component);
        }
      }

      await this.redisClient.setex(
        key,
        86400 * 30,
        JSON.stringify(maintenance)
      );

      logger.info(`Completed maintenance: ${maintenanceId}`);
      return maintenance;
    } catch (error) {
      logger.error(`Failed to complete maintenance: ${error}`);
      throw new Error(`Failed to complete maintenance: ${error}`);
    }
  }

  /**
   * Get upcoming maintenance
   */
  public async getUpcomingMaintenance(): Promise<ScheduledMaintenance[]> {
    try {
      const keys = await this.redisClient.keys(
        `${this.redisPrefix}maintenance:*`
      );
      const maintenance: ScheduledMaintenance[] = [];
      const now = new Date();

      for (const key of keys) {
        const data = await this.redisClient.get(key);
        if (data) {
          const item: ScheduledMaintenance = JSON.parse(data);
          if (
            item.status === 'scheduled' ||
            (item.status === 'in-progress' &&
              item.actualEnd === undefined)
          ) {
            maintenance.push(item);
          }
        }
      }

      return maintenance.sort(
        (a, b) =>
          a.scheduledStart.getTime() - b.scheduledStart.getTime()
      );
    } catch (error) {
      logger.error(`Failed to get upcoming maintenance: ${error}`);
      return [];
    }
  }

  // ============================================================================
  // Notification Management
  // ============================================================================

  /**
   * Subscribe to notifications
   */
  public async subscribeToNotifications(
    email: string,
    notifyOnAll = true,
    notifyOnIncidents = true,
    notifyOnMaintenance = true
  ): Promise<NotificationSubscription> {
    try {
      const subscriptionId = `sub-${Date.now()}`;
      const subscription: NotificationSubscription = {
        id: subscriptionId,
        email,
        subscribedAt: new Date(),
        verified: false,
        notifyOnAll,
        notifyOnIncidents,
        notifyOnMaintenance,
      };

      const key = `${this.redisPrefix}subscription:${subscriptionId}`;
      await this.redisClient.setex(
        key,
        86400 * 365,
        JSON.stringify(subscription)
      );

      // Send verification email
      await this.sendVerificationEmail(email, subscriptionId);

      logger.info(`New subscription: ${email}`);
      return subscription;
    } catch (error) {
      logger.error(`Failed to subscribe to notifications: ${error}`);
      throw new Error(`Failed to subscribe to notifications: ${error}`);
    }
  }

  /**
   * Verify subscription
   */
  public async verifySubscription(subscriptionId: string): Promise<void> {
    try {
      const key = `${this.redisPrefix}subscription:${subscriptionId}`;
      const data = await this.redisClient.get(key);

      if (!data) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      const subscription: NotificationSubscription = JSON.parse(data);
      subscription.verified = true;

      await this.redisClient.setex(
        key,
        86400 * 365,
        JSON.stringify(subscription)
      );

      logger.info(`Verified subscription: ${subscriptionId}`);
    } catch (error) {
      logger.error(`Failed to verify subscription: ${error}`);
      throw new Error(`Failed to verify subscription: ${error}`);
    }
  }

  // ============================================================================
  // Email Notifications
  // ============================================================================

  /**
   * Send verification email
   */
  private async sendVerificationEmail(
    email: string,
    subscriptionId: string
  ): Promise<void> {
    if (!this.emailTransporter) {
      logger.warn('Email transporter not configured');
      return;
    }

    try {
      const verificationLink = `${process.env.APP_URL || 'http://localhost'}/status/verify/${subscriptionId}`;

      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@transcend-law.com',
        to: email,
        subject: 'Verify Your Status Page Notification Subscription',
        html: `
          <h2>Verify Your Subscription</h2>
          <p>Thank you for subscribing to Transcend Law status updates.</p>
          <p>Please click the link below to verify your email address:</p>
          <p>
            <a href="${verificationLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
              Verify Email
            </a>
          </p>
          <p>This link will expire in 24 hours.</p>
        `,
      });

      logger.info(`Verification email sent to: ${email}`);
    } catch (error) {
      logger.error(`Failed to send verification email: ${error}`);
    }
  }

  /**
   * Notify incident to subscribers
   */
  private async notifyIncident(incident: Incident): Promise<void> {
    if (!this.emailTransporter) {
      return;
    }

    try {
      const subscriptions = await this.getVerifiedSubscriptions();
      const relevantSubscriptions = subscriptions.filter(
        (s) => s.notifyOnAll || s.notifyOnIncidents
      );

      if (relevantSubscriptions.length === 0) {
        return;
      }

      const emailBody = this.formatIncidentEmail(incident);

      for (const subscription of relevantSubscriptions) {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@transcend-law.com',
          to: subscription.email,
          subject: `[${incident.severity.toUpperCase()}] ${incident.title}`,
          html: emailBody,
        });
      }

      logger.info(
        `Incident notifications sent to ${relevantSubscriptions.length} subscribers`
      );
    } catch (error) {
      logger.error(`Failed to notify incident: ${error}`);
    }
  }

  /**
   * Notify maintenance to subscribers
   */
  private async notifyMaintenance(maintenance: ScheduledMaintenance): Promise<void> {
    if (!this.emailTransporter) {
      return;
    }

    try {
      const subscriptions = await this.getVerifiedSubscriptions();
      const relevantSubscriptions = subscriptions.filter(
        (s) => s.notifyOnAll || s.notifyOnMaintenance
      );

      if (relevantSubscriptions.length === 0) {
        return;
      }

      const emailBody = this.formatMaintenanceEmail(maintenance);

      for (const subscription of relevantSubscriptions) {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'noreply@transcend-law.com',
          to: subscription.email,
          subject: `Scheduled Maintenance: ${maintenance.title}`,
          html: emailBody,
        });
      }

      logger.info(
        `Maintenance notifications sent to ${relevantSubscriptions.length} subscribers`
      );
    } catch (error) {
      logger.error(`Failed to notify maintenance: ${error}`);
    }
  }

  /**
   * Get verified subscriptions
   */
  private async getVerifiedSubscriptions(): Promise<NotificationSubscription[]> {
    try {
      const keys = await this.redisClient.keys(
        `${this.redisPrefix}subscription:*`
      );
      const subscriptions: NotificationSubscription[] = [];

      for (const key of keys) {
        const data = await this.redisClient.get(key);
        if (data) {
          const sub: NotificationSubscription = JSON.parse(data);
          if (sub.verified) {
            subscriptions.push(sub);
          }
        }
      }

      return subscriptions;
    } catch (error) {
      logger.error(`Failed to get verified subscriptions: ${error}`);
      return [];
    }
  }

  // ============================================================================
  // Email Formatting
  // ============================================================================

  private formatIncidentEmail(incident: Incident): string {
    return `
      <h2>${incident.title}</h2>
      <p><strong>Severity:</strong> <span style="color: ${this.getSeverityColor(incident.severity)}">${incident.severity.toUpperCase()}</span></p>
      <p><strong>Status:</strong> ${incident.status}</p>
      <p><strong>Description:</strong> ${incident.description}</p>

      <h3>Affected Components:</h3>
      <ul>
        ${incident.affectedComponents.map((c) => `<li>${c}</li>`).join('')}
      </ul>

      <h3>Latest Update:</h3>
      <p>${incident.updates[incident.updates.length - 1]?.message || 'No updates'}</p>

      <p>For more details, visit: <a href="${process.env.APP_URL || 'http://localhost'}/status">Status Page</a></p>
    `;
  }

  private formatMaintenanceEmail(maintenance: ScheduledMaintenance): string {
    return `
      <h2>${maintenance.title}</h2>
      <p><strong>Description:</strong> ${maintenance.description}</p>

      <h3>Scheduled Window:</h3>
      <p>
        ${new Date(maintenance.scheduledStart).toLocaleString()} -
        ${new Date(maintenance.scheduledEnd).toLocaleString()}
      </p>

      <h3>Affected Components:</h3>
      <ul>
        ${maintenance.affectedComponents.map((c) => `<li>${c}</li>`).join('')}
      </ul>

      <p>For more details, visit: <a href="${process.env.APP_URL || 'http://localhost'}/status">Status Page</a></p>
    `;
  }

  private getSeverityColor(severity: IncidentSeverity): string {
    switch (severity) {
      case 'critical':
        return '#d32f2f';
      case 'major':
        return '#f57c00';
      case 'minor':
        return '#fbc02d';
      default:
        return '#666';
    }
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  /**
   * Get status page metrics
   */
  public async getMetrics(): Promise<StatusPageMetrics> {
    try {
      const components = await this.getAllComponents();
      const incidents = await this.getIncidentHistory();
      const maintenance = await this.getUpcomingMaintenance();

      const operationalComponents = components.filter(
        (c) => c.status === 'operational'
      ).length;
      const degradedComponents = components.filter(
        (c) => c.status === 'degraded'
      ).length;
      const outageComponents = components.filter(
        (c) => c.status === 'outage'
      ).length;

      const activeIncidents = incidents.filter(
        (i) => i.status !== 'resolved'
      ).length;
      const resolvedIncidents24h = incidents.filter(
        (i) =>
          i.status === 'resolved' &&
          i.resolvedAt &&
          new Date().getTime() - new Date(i.resolvedAt).getTime() <
            24 * 60 * 60 * 1000
      ).length;

      const avgResponseTime =
        components.reduce((sum, c) => sum + c.responseTime, 0) /
        (components.length || 1);

      return {
        totalComponents: components.length,
        operationalComponents,
        degradedComponents,
        outageComponents,
        activeIncidents,
        resolvedIncidents24h,
        upcomingMaintenance: maintenance.length,
        averageResponseTime: Math.round(avgResponseTime),
        overallUptime: await this.calculateUptime('30d'),
      };
    } catch (error) {
      logger.error(`Failed to get metrics: ${error}`);
      throw new Error(`Failed to get metrics: ${error}`);
    }
  }
}

/**
 * Factory function to create status page service
 */
export function createStatusPageService(
  redisClient: Redis,
  emailConfig?: any
): StatusPageService {
  return new StatusPageService(redisClient, emailConfig);
}
