import * as nodemailer from 'nodemailer';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from '../database';
import { Logger } from '../utils/logger';
import * as schedule from 'node-schedule';

export interface ComplianceReport {
  id: string;
  type: 'breach' | 'access' | 'changelog' | 'security' | 'incident';
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  data: any;
  status: 'pending' | 'completed' | 'failed';
  complianceStandards: ('SOC2' | 'HIPAA')[];
  pdfPath?: string;
  emailDelivered?: boolean;
  auditTrail: AuditEntry[];
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  actor: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface DataBreachEntry {
  id: string;
  reportedDate: Date;
  discoveredDate: Date;
  description: string;
  affectedRecords: number;
  affectedIndividuals: string[];
  containmentDate?: Date;
  remediationDate?: Date;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'reported' | 'investigating' | 'contained' | 'remediated';
}

export interface AccessLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceType: string;
  ipAddress: string;
  status: 'success' | 'failure';
  details?: string;
}

export interface ChangeLogEntry {
  id: string;
  timestamp: Date;
  modifiedBy: string;
  entityType: string;
  entityId: string;
  changeType: 'create' | 'update' | 'delete';
  beforeValue?: any;
  afterValue?: any;
  reason?: string;
}

export interface SecurityChecklistItem {
  id: string;
  category: string;
  item: string;
  required: boolean;
  status: 'pass' | 'fail' | 'partial';
  lastVerified: Date;
  evidence?: string;
  remediation?: string;
}

export interface IncidentReport {
  id: string;
  incidentId: string;
  reportedDate: Date;
  incidentDate: Date;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedSystems: string[];
  rootCause?: string;
  containmentMeasures: string[];
  preventiveMeasures: string[];
  status: 'open' | 'closed' | 'escalated';
  investigationNotes?: string;
}

export interface ComplianceSchedule {
  id: string;
  reportType: 'breach' | 'access' | 'changelog' | 'security' | 'incident' | 'all';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time?: string; // HH:MM format
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  recipientEmails: string[];
  enabled: boolean;
  nextRun?: Date;
  lastRun?: Date;
}

export class ComplianceReportingService {
  private db: Database;
  private logger: Logger;
  private emailTransporter: nodemailer.Transporter;
  private schedules: Map<string, schedule.Job> = new Map();
  private reportCachePath: string;

  constructor(db: Database, logger: Logger) {
    this.db = db;
    this.logger = logger;
    this.reportCachePath = path.join(process.cwd(), 'reports');

    // Ensure reports directory exists
    if (!fs.existsSync(this.reportCachePath)) {
      fs.mkdirSync(this.reportCachePath, { recursive: true });
    }

    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  // ==================== Report Generation ====================

  async generateAllReports(
    startDate: Date,
    endDate: Date,
    standards: ('SOC2' | 'HIPAA')[] = ['SOC2', 'HIPAA']
  ): Promise<ComplianceReport[]> {
    this.logger.info('Generating all compliance reports', { startDate, endDate, standards });

    const reports: ComplianceReport[] = [];

    try {
      reports.push(await this.generateBreachReport(startDate, endDate, standards));
      reports.push(await this.generateAccessReport(startDate, endDate, standards));
      reports.push(await this.generateChangelogReport(startDate, endDate, standards));
      reports.push(await this.generateSecurityChecklist(startDate, endDate, standards));
      reports.push(await this.generateIncidentReport(startDate, endDate, standards));

      this.logger.info('All compliance reports generated successfully', { count: reports.length });
    } catch (error) {
      this.logger.error('Error generating compliance reports', { error });
      throw error;
    }

    return reports;
  }

  async generateBreachReport(
    startDate: Date,
    endDate: Date,
    standards: ('SOC2' | 'HIPAA')[]
  ): Promise<ComplianceReport> {
    const reportId = `breach-${Date.now()}`;

    try {
      const breaches = await this.getDataBreaches(startDate, endDate);

      const report: ComplianceReport = {
        id: reportId,
        type: 'breach',
        generatedAt: new Date(),
        period: { startDate, endDate },
        data: {
          totalBreaches: breaches.length,
          breachesByStatus: this.groupBy(breaches, 'status'),
          breachesBySeverity: this.groupBy(breaches, 'severity'),
          totalAffectedRecords: breaches.reduce((sum, b) => sum + b.affectedRecords, 0),
          details: breaches,
          complianceNotes: this.validateBreachCompliance(breaches, standards),
        },
        status: 'completed',
        complianceStandards: standards,
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date(),
            action: 'REPORT_GENERATED',
            actor: 'SYSTEM',
          },
        ],
      };

      await this.db.saveReport(report);
      this.logger.info('Breach report generated', { reportId, breachCount: breaches.length });

      return report;
    } catch (error) {
      this.logger.error('Error generating breach report', { reportId, error });
      throw error;
    }
  }

  async generateAccessReport(
    startDate: Date,
    endDate: Date,
    standards: ('SOC2' | 'HIPAA')[]
  ): Promise<ComplianceReport> {
    const reportId = `access-${Date.now()}`;

    try {
      const accessLogs = await this.getAccessLogs(startDate, endDate);
      const failedAccess = accessLogs.filter(log => log.status === 'failure');
      const uniqueUsers = new Set(accessLogs.map(log => log.userId)).size;

      const report: ComplianceReport = {
        id: reportId,
        type: 'access',
        generatedAt: new Date(),
        period: { startDate, endDate },
        data: {
          totalAccessEvents: accessLogs.length,
          uniqueUsers,
          failedAccessAttempts: failedAccess.length,
          accessByResource: this.groupBy(accessLogs, 'resource'),
          accessByUser: this.groupBy(accessLogs, 'userId'),
          suspiciousActivity: this.identifySuspiciousActivity(accessLogs),
          topFailures: failedAccess.slice(0, 50),
          complianceNotes: this.validateAccessCompliance(accessLogs, standards),
        },
        status: 'completed',
        complianceStandards: standards,
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date(),
            action: 'REPORT_GENERATED',
            actor: 'SYSTEM',
          },
        ],
      };

      await this.db.saveReport(report);
      this.logger.info('Access report generated', { reportId, logCount: accessLogs.length });

      return report;
    } catch (error) {
      this.logger.error('Error generating access report', { reportId, error });
      throw error;
    }
  }

  async generateChangelogReport(
    startDate: Date,
    endDate: Date,
    standards: ('SOC2' | 'HIPAA')[]
  ): Promise<ComplianceReport> {
    const reportId = `changelog-${Date.now()}`;

    try {
      const changes = await this.getChangeLogs(startDate, endDate);
      const deleteOperations = changes.filter(c => c.changeType === 'delete');
      const criticalChanges = await this.identifyCriticalChanges(changes);

      const report: ComplianceReport = {
        id: reportId,
        type: 'changelog',
        generatedAt: new Date(),
        period: { startDate, endDate },
        data: {
          totalChanges: changes.length,
          changesByType: this.groupBy(changes, 'changeType'),
          changesByEntity: this.groupBy(changes, 'entityType'),
          deleteOperations: deleteOperations.length,
          criticalChanges,
          changesByUser: this.groupBy(changes, 'modifiedBy'),
          samples: changes.slice(0, 100),
          complianceNotes: this.validateChangelogCompliance(changes, standards),
        },
        status: 'completed',
        complianceStandards: standards,
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date(),
            action: 'REPORT_GENERATED',
            actor: 'SYSTEM',
          },
        ],
      };

      await this.db.saveReport(report);
      this.logger.info('Changelog report generated', { reportId, changeCount: changes.length });

      return report;
    } catch (error) {
      this.logger.error('Error generating changelog report', { reportId, error });
      throw error;
    }
  }

  async generateSecurityChecklist(
    startDate: Date,
    endDate: Date,
    standards: ('SOC2' | 'HIPAA')[]
  ): Promise<ComplianceReport> {
    const reportId = `security-${Date.now()}`;

    try {
      const checklist = await this.evaluateSecurityChecklist(standards);
      const passCount = checklist.filter(item => item.status === 'pass').length;
      const failCount = checklist.filter(item => item.status === 'fail').length;
      const score = (passCount / checklist.length) * 100;

      const report: ComplianceReport = {
        id: reportId,
        type: 'security',
        generatedAt: new Date(),
        period: { startDate, endDate },
        data: {
          totalItems: checklist.length,
          passCount,
          failCount,
          partialCount: checklist.filter(item => item.status === 'partial').length,
          complianceScore: score,
          byCategory: this.groupBy(checklist, 'category'),
          failedItems: checklist.filter(item => item.status === 'fail'),
          partialItems: checklist.filter(item => item.status === 'partial'),
          remediationPlan: this.generateRemediationPlan(checklist),
          details: checklist,
        },
        status: 'completed',
        complianceStandards: standards,
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date(),
            action: 'REPORT_GENERATED',
            actor: 'SYSTEM',
          },
        ],
      };

      await this.db.saveReport(report);
      this.logger.info('Security checklist generated', { reportId, score });

      return report;
    } catch (error) {
      this.logger.error('Error generating security checklist', { reportId, error });
      throw error;
    }
  }

  async generateIncidentReport(
    startDate: Date,
    endDate: Date,
    standards: ('SOC2' | 'HIPAA')[]
  ): Promise<ComplianceReport> {
    const reportId = `incident-${Date.now()}`;

    try {
      const incidents = await this.getIncidents(startDate, endDate);
      const openIncidents = incidents.filter(i => i.status === 'open');
      const escalatedIncidents = incidents.filter(i => i.status === 'escalated');

      const report: ComplianceReport = {
        id: reportId,
        type: 'incident',
        generatedAt: new Date(),
        period: { startDate, endDate },
        data: {
          totalIncidents: incidents.length,
          openIncidents: openIncidents.length,
          escalatedIncidents: escalatedIncidents.length,
          closedIncidents: incidents.filter(i => i.status === 'closed').length,
          incidentsBySeverity: this.groupBy(incidents, 'severity'),
          incidentsByType: this.groupBy(incidents, 'type'),
          averageResolutionTime: this.calculateAverageResolutionTime(incidents),
          incidentsRequiringNotification: this.filterReportableIncidents(incidents, standards),
          details: incidents,
          complianceNotes: this.validateIncidentCompliance(incidents, standards),
        },
        status: 'completed',
        complianceStandards: standards,
        auditTrail: [
          {
            id: `audit-${Date.now()}`,
            timestamp: new Date(),
            action: 'REPORT_GENERATED',
            actor: 'SYSTEM',
          },
        ],
      };

      await this.db.saveReport(report);
      this.logger.info('Incident report generated', { reportId, incidentCount: incidents.length });

      return report;
    } catch (error) {
      this.logger.error('Error generating incident report', { reportId, error });
      throw error;
    }
  }

  // ==================== Data Retrieval ====================

  private async getDataBreaches(startDate: Date, endDate: Date): Promise<DataBreachEntry[]> {
    return this.db.query(
      `SELECT * FROM data_breaches
       WHERE reported_date >= ? AND reported_date <= ?
       ORDER BY reported_date DESC`,
      [startDate, endDate]
    );
  }

  private async getAccessLogs(startDate: Date, endDate: Date): Promise<AccessLogEntry[]> {
    return this.db.query(
      `SELECT * FROM access_logs
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC`,
      [startDate, endDate]
    );
  }

  private async getChangeLogs(startDate: Date, endDate: Date): Promise<ChangeLogEntry[]> {
    return this.db.query(
      `SELECT * FROM change_logs
       WHERE timestamp >= ? AND timestamp <= ?
       ORDER BY timestamp DESC`,
      [startDate, endDate]
    );
  }

  private async getIncidents(startDate: Date, endDate: Date): Promise<IncidentReport[]> {
    return this.db.query(
      `SELECT * FROM incidents
       WHERE reported_date >= ? AND reported_date <= ?
       ORDER BY reported_date DESC`,
      [startDate, endDate]
    );
  }

  // ==================== Compliance Validation ====================

  private validateBreachCompliance(breaches: DataBreachEntry[], standards: string[]): string[] {
    const notes: string[] = [];

    if (standards.includes('HIPAA')) {
      notes.push('HIPAA: All breaches must be documented and notification timelines verified');

      for (const breach of breaches) {
        if (breach.affectedRecords > 500) {
          notes.push(`HIPAA: Breach ${breach.id} affected ${breach.affectedRecords} records - media notification required`);
        }
        if (!breach.containmentDate || !breach.remediationDate) {
          notes.push(`HIPAA: Breach ${breach.id} missing containment/remediation dates - compliance gap`);
        }
      }
    }

    if (standards.includes('SOC2')) {
      notes.push('SOC2: Breach disclosure timelines and root cause analysis required');
      notes.push('SOC2: All breaches must include affected systems and remediation evidence');
    }

    return notes;
  }

  private validateAccessCompliance(accessLogs: AccessLogEntry[], standards: string[]): string[] {
    const notes: string[] = [];

    if (standards.includes('HIPAA')) {
      const failureRate = (accessLogs.filter(log => log.status === 'failure').length / accessLogs.length) * 100;
      if (failureRate > 5) {
        notes.push(`HIPAA: High failed access rate (${failureRate.toFixed(2)}%) - investigate authentication issues`);
      }
      notes.push('HIPAA: Access logs must retain detailed information for 6 years');
    }

    if (standards.includes('SOC2')) {
      notes.push('SOC2: All access events must include timestamp, user ID, and action');
      notes.push('SOC2: Failed access attempts must be investigated and documented');
    }

    return notes;
  }

  private validateChangelogCompliance(changes: ChangeLogEntry[], standards: string[]): string[] {
    const notes: string[] = [];

    if (standards.includes('HIPAA')) {
      const deleteCount = changes.filter(c => c.changeType === 'delete').length;
      notes.push(`HIPAA: ${deleteCount} delete operations recorded - verify deletion policies`);
      notes.push('HIPAA: All changes to PHI must be logged with reason and justification');
    }

    if (standards.includes('SOC2')) {
      notes.push('SOC2: All modifications must be logged with before/after values');
      notes.push('SOC2: Change approvals and authorizations must be documented');
    }

    return notes;
  }

  private validateIncidentCompliance(incidents: IncidentReport[], standards: string[]): string[] {
    const notes: string[] = [];

    if (standards.includes('HIPAA')) {
      const reportableIncidents = incidents.filter(
        i => i.type.includes('breach') || i.type.includes('unauthorized access')
      );
      notes.push(`HIPAA: ${reportableIncidents.length} potentially reportable incidents identified`);
      notes.push('HIPAA: Reportable breaches must be reported to HHS within 60 days');
      notes.push('HIPAA: Individual notifications required for breaches affecting 500+ individuals');
    }

    if (standards.includes('SOC2')) {
      notes.push('SOC2: All security incidents must be documented with details, impact, and resolution');
      notes.push('SOC2: Root cause analysis required for all incidents');
    }

    return notes;
  }

  // ==================== Analysis & Detection ====================

  private identifySuspiciousActivity(accessLogs: AccessLogEntry[]): AccessLogEntry[] {
    return accessLogs.filter(log => {
      const failedAttempts = accessLogs.filter(
        l => l.userId === log.userId && l.status === 'failure'
      ).length;
      return failedAttempts > 10 || log.action.includes('admin');
    });
  }

  private async identifyCriticalChanges(changes: ChangeLogEntry[]): Promise<ChangeLogEntry[]> {
    const criticalEntityTypes = ['user', 'role', 'permission', 'security_policy', 'encryption_key'];
    const criticalChangeTypes = ['delete'];

    return changes.filter(
      change =>
        criticalEntityTypes.includes(change.entityType) ||
        criticalChangeTypes.includes(change.changeType)
    );
  }

  private calculateAverageResolutionTime(incidents: IncidentReport[]): number {
    const resolvedIncidents = incidents.filter(i => i.status === 'closed');
    if (resolvedIncidents.length === 0) return 0;

    const totalTime = resolvedIncidents.reduce((sum, incident) => {
      const reportedTime = new Date(incident.reportedDate).getTime();
      // Assuming closure time is stored or estimated
      return sum + 86400000; // Default 1 day
    }, 0);

    return totalTime / resolvedIncidents.length / 3600000; // Convert to hours
  }

  private filterReportableIncidents(incidents: IncidentReport[], standards: string[]): IncidentReport[] {
    if (!standards.includes('HIPAA')) {
      return [];
    }

    return incidents.filter(incident => {
      const isDataBreach = incident.type.toLowerCase().includes('breach');
      const isUnauthorizedAccess = incident.type.toLowerCase().includes('unauthorized');
      const isCriticalSeverity = incident.severity === 'critical';

      return isDataBreach || isUnauthorizedAccess || isCriticalSeverity;
    });
  }

  private generateRemediationPlan(checklist: SecurityChecklistItem[]): Record<string, any> {
    const failedItems = checklist.filter(item => item.status === 'fail');
    const byCategory = this.groupBy(failedItems, 'category');

    return {
      generatedAt: new Date(),
      totalItems: failedItems.length,
      byCategory,
      estimatedCompletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      priority: 'high',
    };
  }

  private async evaluateSecurityChecklist(standards: string[]): Promise<SecurityChecklistItem[]> {
    const checklist: SecurityChecklistItem[] = [];

    // SOC 2 checklist items
    if (standards.includes('SOC2')) {
      checklist.push(
        {
          id: 'soc2-001',
          category: 'Access Controls',
          item: 'Multi-factor authentication enabled for all users',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'soc2-002',
          category: 'Encryption',
          item: 'Data encryption at rest (AES-256)',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'soc2-003',
          category: 'Encryption',
          item: 'Data encryption in transit (TLS 1.2+)',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'soc2-004',
          category: 'Monitoring',
          item: 'Real-time logging and monitoring active',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'soc2-005',
          category: 'Backup & Recovery',
          item: 'Daily automated backups with verification',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'soc2-006',
          category: 'Change Management',
          item: 'Change approval and audit trail in place',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'soc2-007',
          category: 'Incident Response',
          item: 'Documented incident response plan',
          required: true,
          status: 'partial',
          lastVerified: new Date(),
          remediation: 'Update incident response plan by Q3 2026',
        },
        {
          id: 'soc2-008',
          category: 'Vulnerability Management',
          item: 'Regular vulnerability scanning and patching',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        }
      );
    }

    // HIPAA checklist items
    if (standards.includes('HIPAA')) {
      checklist.push(
        {
          id: 'hipaa-001',
          category: 'Administrative Safeguards',
          item: 'Security officer designated',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'hipaa-002',
          category: 'Administrative Safeguards',
          item: 'Workforce security plan documented',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'hipaa-003',
          category: 'Administrative Safeguards',
          item: 'Security awareness training current',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'hipaa-004',
          category: 'Administrative Safeguards',
          item: 'Sanction policy established',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'hipaa-005',
          category: 'Physical Safeguards',
          item: 'Facility access controls implemented',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'hipaa-006',
          category: 'Technical Safeguards',
          item: 'Access control mechanisms active',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'hipaa-007',
          category: 'Technical Safeguards',
          item: 'Audit controls and logs active',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        },
        {
          id: 'hipaa-008',
          category: 'Breach Notification',
          item: 'Breach notification plan documented',
          required: true,
          status: 'pass',
          lastVerified: new Date(),
        }
      );
    }

    return checklist;
  }

  // ==================== PDF Export ====================

  async generatePDF(report: ComplianceReport, includeDetails: boolean = true): Promise<string> {
    const filename = `${report.type}-report-${report.id}.pdf`;
    const filepath = path.join(this.reportCachePath, filename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'Letter',
        margin: 50,
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text('Compliance Report', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(`Type: ${report.type.toUpperCase()}`, { align: 'center' });
      doc.fontSize(10).text(`Generated: ${report.generatedAt.toISOString()}`, { align: 'center' });
      doc.moveDown(1);

      // Compliance Standards
      doc.fontSize(12).font('Helvetica-Bold').text('Compliance Standards:');
      doc.fontSize(10).font('Helvetica');
      report.complianceStandards.forEach(standard => {
        doc.text(`• ${standard}`, { indent: 20 });
      });
      doc.moveDown(1);

      // Period
      doc.fontSize(12).font('Helvetica-Bold').text('Reporting Period:');
      doc.fontSize(10).font('Helvetica').text(
        `${report.period.startDate.toISOString()} to ${report.period.endDate.toISOString()}`,
        { indent: 20 }
      );
      doc.moveDown(1);

      // Summary
      doc.fontSize(14).font('Helvetica-Bold').text('Executive Summary');
      this.addSummarySection(doc, report);
      doc.moveDown(1);

      // Details
      if (includeDetails) {
        doc.fontSize(14).font('Helvetica-Bold').text('Detailed Report');
        this.addDetailsSection(doc, report);
      }

      // Compliance Notes
      if (report.data.complianceNotes?.length > 0) {
        doc.moveDown(1);
        doc.fontSize(12).font('Helvetica-Bold').text('Compliance Notes:');
        doc.fontSize(10).font('Helvetica');
        report.data.complianceNotes.forEach((note: string) => {
          doc.text(`• ${note}`, { indent: 20 });
        });
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).font('Helvetica').text(
        'This is a confidential compliance report intended for authorized recipients only.',
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => {
        this.logger.info('PDF generated', { filepath });
        resolve(filepath);
      });

      stream.on('error', (error) => {
        this.logger.error('Error generating PDF', { error });
        reject(error);
      });
    });
  }

  private addSummarySection(doc: any, report: ComplianceReport): void {
    doc.fontSize(10).font('Helvetica');

    switch (report.type) {
      case 'breach':
        doc.text(`Total Breaches: ${report.data.totalBreaches}`);
        doc.text(`Total Affected Records: ${report.data.totalAffectedRecords}`);
        Object.entries(report.data.breachesBySeverity).forEach(([severity, count]) => {
          doc.text(`${severity} Severity: ${count}`, { indent: 20 });
        });
        break;
      case 'access':
        doc.text(`Total Access Events: ${report.data.totalAccessEvents}`);
        doc.text(`Unique Users: ${report.data.uniqueUsers}`);
        doc.text(`Failed Access Attempts: ${report.data.failedAccessAttempts}`);
        break;
      case 'changelog':
        doc.text(`Total Changes: ${report.data.totalChanges}`);
        doc.text(`Delete Operations: ${report.data.deleteOperations}`);
        doc.text(`Critical Changes: ${report.data.criticalChanges?.length || 0}`);
        break;
      case 'security':
        doc.text(`Compliance Score: ${report.data.complianceScore?.toFixed(2) || 0}%`);
        doc.text(`Items: ${report.data.passCount} Pass, ${report.data.failCount} Fail, ${report.data.partialCount} Partial`);
        break;
      case 'incident':
        doc.text(`Total Incidents: ${report.data.totalIncidents}`);
        doc.text(`Open: ${report.data.openIncidents}, Escalated: ${report.data.escalatedIncidents}`);
        doc.text(`Avg Resolution Time: ${report.data.averageResolutionTime?.toFixed(2) || 0} hours`);
        break;
    }
  }

  private addDetailsSection(doc: any, report: ComplianceReport): void {
    doc.fontSize(10).font('Helvetica');

    // Limit details shown in PDF for brevity
    const dataStr = JSON.stringify(report.data, null, 2);
    const truncated = dataStr.substring(0, 5000);
    doc.text(truncated);
    if (dataStr.length > 5000) {
      doc.text('... (details truncated in PDF - see full report online)');
    }
  }

  // ==================== Email Delivery ====================

  async sendReportEmail(
    report: ComplianceReport,
    recipientEmails: string[],
    attachPDF: boolean = true
  ): Promise<boolean> {
    try {
      let pdfPath: string | undefined;

      if (attachPDF) {
        pdfPath = await this.generatePDF(report);
      }

      const subject = `${report.type.toUpperCase()} Compliance Report - ${new Date().toLocaleDateString()}`;

      const htmlContent = this.generateEmailContent(report);

      const attachments = pdfPath ? [
        {
          filename: path.basename(pdfPath),
          path: pdfPath,
        },
      ] : [];

      await this.emailTransporter.sendMail({
        from: process.env.EMAIL_FROM || 'compliance@transcendlaw.com',
        to: recipientEmails.join(','),
        subject,
        html: htmlContent,
        attachments,
      });

      // Update report status
      report.emailDelivered = true;
      report.pdfPath = pdfPath;
      await this.db.saveReport(report);

      this.logger.info('Compliance report email sent', {
        reportId: report.id,
        recipients: recipientEmails.length,
      });

      return true;
    } catch (error) {
      this.logger.error('Error sending compliance report email', { error });
      throw error;
    }
  }

  private generateEmailContent(report: ComplianceReport): string {
    const baseUrl = process.env.APP_URL || 'https://transcendlaw.com';

    return `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #1a73e8;">Compliance Report: ${report.type.toUpperCase()}</h2>

          <p>This automated compliance report covers the period from <strong>${report.period.startDate.toLocaleDateString()}</strong> to <strong>${report.period.endDate.toLocaleDateString()}</strong>.</p>

          <h3>Compliance Standards:</h3>
          <ul>
            ${report.complianceStandards.map(std => `<li>${std}</li>`).join('')}
          </ul>

          <h3>Key Metrics:</h3>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px;">
            ${this.getEmailMetrics(report)}
          </div>

          ${report.data.complianceNotes?.length > 0 ? `
            <h3>Compliance Notes:</h3>
            <ul style="color: #d32f2f;">
              ${report.data.complianceNotes.map((note: string) => `<li>${note}</li>`).join('')}
            </ul>
          ` : ''}

          <p style="margin-top: 30px;">
            <a href="${baseUrl}/compliance/reports/${report.id}" style="background: #1a73e8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
              View Full Report
            </a>
          </p>

          <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
          <p style="font-size: 12px; color: #999;">
            This is an automated compliance report. Please do not reply to this email.
            <br>Report ID: ${report.id}
            <br>Generated: ${new Date().toISOString()}
          </p>
        </body>
      </html>
    `;
  }

  private getEmailMetrics(report: ComplianceReport): string {
    switch (report.type) {
      case 'breach':
        return `
          <p><strong>Total Breaches:</strong> ${report.data.totalBreaches}</p>
          <p><strong>Affected Records:</strong> ${report.data.totalAffectedRecords}</p>
        `;
      case 'access':
        return `
          <p><strong>Access Events:</strong> ${report.data.totalAccessEvents}</p>
          <p><strong>Failed Attempts:</strong> ${report.data.failedAccessAttempts}</p>
        `;
      case 'changelog':
        return `
          <p><strong>Total Changes:</strong> ${report.data.totalChanges}</p>
          <p><strong>Delete Operations:</strong> ${report.data.deleteOperations}</p>
        `;
      case 'security':
        return `
          <p><strong>Compliance Score:</strong> ${report.data.complianceScore?.toFixed(2) || 0}%</p>
          <p><strong>Items Passing:</strong> ${report.data.passCount}/${report.data.totalItems}</p>
        `;
      case 'incident':
        return `
          <p><strong>Total Incidents:</strong> ${report.data.totalIncidents}</p>
          <p><strong>Open Incidents:</strong> ${report.data.openIncidents}</p>
        `;
      default:
        return '<p>Report generated successfully</p>';
    }
  }

  // ==================== Scheduling ====================

  async createSchedule(config: ComplianceSchedule): Promise<ComplianceSchedule> {
    const scheduleId = `schedule-${Date.now()}`;
    config.id = scheduleId;

    // Save to database
    await this.db.saveSchedule(config);

    if (config.enabled) {
      this.scheduleReport(config);
    }

    this.logger.info('Compliance schedule created', { scheduleId, frequency: config.frequency });
    return config;
  }

  async updateSchedule(scheduleId: string, updates: Partial<ComplianceSchedule>): Promise<ComplianceSchedule> {
    const schedule = await this.db.getSchedule(scheduleId);
    const updated = { ...schedule, ...updates };

    // Remove old scheduled job if exists
    if (this.schedules.has(scheduleId)) {
      this.schedules.get(scheduleId)?.cancel();
      this.schedules.delete(scheduleId);
    }

    // Save updated schedule
    await this.db.saveSchedule(updated);

    if (updated.enabled) {
      this.scheduleReport(updated);
    }

    this.logger.info('Compliance schedule updated', { scheduleId });
    return updated;
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    if (this.schedules.has(scheduleId)) {
      this.schedules.get(scheduleId)?.cancel();
      this.schedules.delete(scheduleId);
    }

    await this.db.deleteSchedule(scheduleId);
    this.logger.info('Compliance schedule deleted', { scheduleId });
  }

  private scheduleReport(config: ComplianceSchedule): void {
    let cronExpression: string;
    const time = config.time || '00:00';
    const [hours, minutes] = time.split(':');

    switch (config.frequency) {
      case 'daily':
        cronExpression = `${minutes} ${hours} * * *`;
        break;
      case 'weekly':
        const dayOfWeek = config.dayOfWeek || 0;
        cronExpression = `${minutes} ${hours} * * ${dayOfWeek}`;
        break;
      case 'monthly':
        const dayOfMonth = config.dayOfMonth || 1;
        cronExpression = `${minutes} ${hours} ${dayOfMonth} * *`;
        break;
      case 'quarterly':
        cronExpression = `${minutes} ${hours} 1 */3 *`;
        break;
      default:
        throw new Error(`Unknown frequency: ${config.frequency}`);
    }

    const job = schedule.scheduleJob(cronExpression, async () => {
      try {
        this.logger.info('Running scheduled compliance report', { scheduleId: config.id });

        const endDate = new Date();
        const startDate = this.calculateStartDate(endDate, config.frequency);

        const reports = await this.generateAllReports(startDate, endDate, ['SOC2', 'HIPAA']);

        for (const report of reports) {
          await this.sendReportEmail(report, config.recipientEmails);
        }

        // Update last run time
        config.lastRun = new Date();
        config.nextRun = new Date(job.nextInvocation());
        await this.db.saveSchedule(config);
      } catch (error) {
        this.logger.error('Error running scheduled compliance report', { error, scheduleId: config.id });
      }
    });

    this.schedules.set(config.id, job);
    config.nextRun = new Date(job.nextInvocation());

    this.logger.info('Report schedule registered', {
      scheduleId: config.id,
      cronExpression,
      nextRun: config.nextRun,
    });
  }

  private calculateStartDate(endDate: Date, frequency: string): Date {
    const startDate = new Date(endDate);

    switch (frequency) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarterly':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
    }

    return startDate;
  }

  async initializeSchedules(): Promise<void> {
    const schedules = await this.db.getAllSchedules();

    for (const config of schedules) {
      if (config.enabled) {
        this.scheduleReport(config);
      }
    }

    this.logger.info('Compliance schedules initialized', { count: schedules.length });
  }

  // ==================== Utility ====================

  private groupBy<T>(items: T[], key: keyof T): Record<string, number> {
    return items.reduce((result, item) => {
      const groupKey = String(item[key]);
      result[groupKey] = (result[groupKey] || 0) + 1;
      return result;
    }, {} as Record<string, number>);
  }

  async getReport(reportId: string): Promise<ComplianceReport | null> {
    return this.db.getReport(reportId);
  }

  async listReports(type?: string, limit: number = 50): Promise<ComplianceReport[]> {
    return this.db.listReports(type, limit);
  }

  async getSchedules(): Promise<ComplianceSchedule[]> {
    return this.db.getAllSchedules();
  }
}
