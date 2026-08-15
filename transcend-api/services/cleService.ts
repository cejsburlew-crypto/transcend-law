// CLE (Continuing Legal Education) Tracking Service
// Manages CLE credit tracking, state requirements, compliance, and bar association sync

import { query } from '../database/connection';
import { sendEmailNotification } from './emailService';

// ============================================
// STATE REQUIREMENTS DATABASE
// ============================================

export const STATE_CLE_REQUIREMENTS: Record<
  string,
  {
    stateCode: string;
    stateName: string;
    annualHours: number;
    ethicsHours: number;
    mandatoryHours: Record<string, number>;
    reportingDeadline: string;
    carryoverHours: number;
    carryoverYears: number;
    barAssociationId: string;
    barAssociationAPI: string;
  }
> = {
  CA: {
    stateCode: 'CA',
    stateName: 'California',
    annualHours: 25,
    ethicsHours: 1,
    mandatoryHours: { 'Elimination of Bias': 1 },
    reportingDeadline: '2024-12-31',
    carryoverHours: 5,
    carryoverYears: 3,
    barAssociationId: 'state-bar-of-california',
    barAssociationAPI: 'https://api.calbar.ca.gov/cle',
  },
  TX: {
    stateCode: 'TX',
    stateName: 'Texas',
    annualHours: 15,
    ethicsHours: 1,
    mandatoryHours: { Professional: 1 },
    reportingDeadline: '2024-06-30',
    carryoverHours: 0,
    carryoverYears: 0,
    barAssociationId: 'texas-bar',
    barAssociationAPI: 'https://api.texasbar.com/cle',
  },
  NY: {
    stateCode: 'NY',
    stateName: 'New York',
    annualHours: 24,
    ethicsHours: 4,
    mandatoryHours: { 'Legal Ethics': 2, 'Professionalism': 1 },
    reportingDeadline: '2024-05-15',
    carryoverHours: 6,
    carryoverYears: 3,
    barAssociationId: 'new-york-bar',
    barAssociationAPI: 'https://api.nycourts.gov/cle',
  },
  FL: {
    stateCode: 'FL',
    stateName: 'Florida',
    annualHours: 33,
    ethicsHours: 3,
    mandatoryHours: { Ethics: 3, 'Professionalism': 1 },
    reportingDeadline: '2024-01-31',
    carryoverHours: 0,
    carryoverYears: 0,
    barAssociationId: 'florida-bar',
    barAssociationAPI: 'https://api.floridabar.org/cle',
  },
  IL: {
    stateCode: 'IL',
    stateName: 'Illinois',
    annualHours: 30,
    ethicsHours: 2,
    mandatoryHours: { 'Legal Ethics': 1, 'Diversity': 1 },
    reportingDeadline: '2024-12-31',
    carryoverHours: 10,
    carryoverYears: 1,
    barAssociationId: 'illinois-bar',
    barAssociationAPI: 'https://api.isba.org/cle',
  },
  PA: {
    stateCode: 'PA',
    stateName: 'Pennsylvania',
    annualHours: 12,
    ethicsHours: 2,
    mandatoryHours: { 'Legal Ethics': 2 },
    reportingDeadline: '2024-12-31',
    carryoverHours: 0,
    carryoverYears: 0,
    barAssociationId: 'pennsylvania-bar',
    barAssociationAPI: 'https://api.pabar.org/cle',
  },
  OH: {
    stateCode: 'OH',
    stateName: 'Ohio',
    annualHours: 24,
    ethicsHours: 1,
    mandatoryHours: { Professionalism: 1 },
    reportingDeadline: '2024-01-15',
    carryoverHours: 0,
    carryoverYears: 0,
    barAssociationId: 'ohio-bar',
    barAssociationAPI: 'https://api.ohiobar.org/cle',
  },
  GA: {
    stateCode: 'GA',
    stateName: 'Georgia',
    annualHours: 12,
    ethicsHours: 1,
    mandatoryHours: { Ethics: 1 },
    reportingDeadline: '2024-12-31',
    carryoverHours: 0,
    carryoverYears: 0,
    barAssociationId: 'georgia-bar',
    barAssociationAPI: 'https://api.gabar.org/cle',
  },
  NC: {
    stateCode: 'NC',
    stateName: 'North Carolina',
    annualHours: 12,
    ethicsHours: 1,
    mandatoryHours: { Ethics: 1 },
    reportingDeadline: '2024-06-30',
    carryoverHours: 0,
    carryoverYears: 0,
    barAssociationId: 'north-carolina-bar',
    barAssociationAPI: 'https://api.ncbar.org/cle',
  },
  MI: {
    stateCode: 'MI',
    stateName: 'Michigan',
    annualHours: 18,
    ethicsHours: 1,
    mandatoryHours: { Professionalism: 1 },
    reportingDeadline: '2024-09-30',
    carryoverHours: 0,
    carryoverYears: 0,
    barAssociationId: 'michigan-bar',
    barAssociationAPI: 'https://api.michbar.org/cle',
  },
};

// ============================================
// TYPES & INTERFACES
// ============================================

export interface CLECredit {
  id: string;
  attorneyId: string;
  providerId: string;
  courseName: string;
  courseDescription: string;
  creditType: 'Ethics' | 'Mandatory' | 'General';
  hoursEarned: number;
  state: string;
  credentialAccepted: boolean;
  completionDate: Date;
  certificateUrl?: string;
  barReferenceNumber?: string;
  syncedWithBar: boolean;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CLEDeadline {
  id: string;
  attorneyId: string;
  state: string;
  reportingDeadline: Date;
  requiredHours: number;
  earningDeadline: Date;
  alarmAt30Days: boolean;
  alarmAt60Days: boolean;
  alarmAt90Days: boolean;
  status: 'upcoming' | 'warning' | 'critical' | 'met' | 'overdue';
  createdAt: Date;
  updatedAt: Date;
}

export interface CLECompliance {
  id: string;
  attorneyId: string;
  state: string;
  year: number;
  totalHours: number;
  ethicsHours: number;
  mandatoryHours: number;
  generalHours: number;
  carryoverHours: number;
  deficitHours: number;
  isCompliant: boolean;
  lastAuditDate: Date;
  auditStatus: 'pending' | 'approved' | 'rejected';
  auditNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CLEProvider {
  id: string;
  providerName: string;
  providerType: 'law-firm' | 'bar-association' | 'university' | 'online-platform' | 'conference';
  statesApproved: string[];
  approvalNumber?: string;
  barAssociationId?: string;
  apiIntegration: boolean;
  lastSyncDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CLEExportReport {
  id: string;
  attorneyId: string;
  state: string;
  reportYear: number;
  totalCredits: number;
  creditBreakdown: {
    ethics: number;
    mandatory: number;
    general: number;
  };
  compliant: boolean;
  generatedAt: Date;
  fileFormat: 'pdf' | 'csv' | 'json';
  fileUrl: string;
}

// ============================================
// CLE CREDIT MANAGEMENT
// ============================================

export async function recordCLECredit(
  attorneyId: string,
  providerId: string,
  courseName: string,
  courseDescription: string,
  creditType: 'Ethics' | 'Mandatory' | 'General',
  hoursEarned: number,
  state: string,
  completionDate: Date,
  certificateUrl?: string
): Promise<CLECredit> {
  try {
    // Validate state requirements
    if (!STATE_CLE_REQUIREMENTS[state]) {
      throw new Error(`CLE requirements not found for state: ${state}`);
    }

    // Validate credit hours
    if (hoursEarned <= 0 || hoursEarned > 50) {
      throw new Error('Credit hours must be between 0 and 50');
    }

    // Verify provider is approved for this state
    const providerResult = await query(
      `SELECT * FROM cle_providers WHERE id = $1`,
      [providerId]
    );

    if (providerResult.rows.length === 0) {
      throw new Error('CLE provider not found');
    }

    const provider = providerResult.rows[0];
    if (!provider.states_approved?.includes(state)) {
      console.warn(
        `Warning: Provider ${providerId} is not officially approved for ${state}`
      );
    }

    // Insert CLE credit
    const result = await query(
      `INSERT INTO cle_credits
       (attorney_id, provider_id, course_name, course_description, credit_type,
        hours_earned, state, credential_accepted, completion_date, certificate_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        attorneyId,
        providerId,
        courseName,
        courseDescription,
        creditType,
        hoursEarned,
        state,
        true,
        completionDate,
        certificateUrl,
      ]
    );

    // Update attorney's CLE totals
    await updateCLEComplianceStatus(attorneyId, state, new Date().getFullYear());

    // Check if should sync with bar association
    await syncWithBarAssociation(attorneyId, state);

    return {
      id: result.rows[0].id,
      attorneyId,
      providerId,
      courseName,
      courseDescription,
      creditType,
      hoursEarned,
      state,
      credentialAccepted: true,
      completionDate: new Date(result.rows[0].completion_date),
      certificateUrl,
      barReferenceNumber: result.rows[0].bar_reference_number,
      syncedWithBar: result.rows[0].synced_with_bar || false,
      syncedAt: result.rows[0].synced_at
        ? new Date(result.rows[0].synced_at)
        : undefined,
      createdAt: new Date(result.rows[0].created_at),
      updatedAt: new Date(result.rows[0].updated_at),
    };
  } catch (error) {
    console.error('Failed to record CLE credit:', error);
    throw error;
  }
}

export async function getCLECredits(
  attorneyId: string,
  state?: string,
  year?: number
): Promise<CLECredit[]> {
  try {
    let sql = `SELECT * FROM cle_credits WHERE attorney_id = $1`;
    const params: (string | number)[] = [attorneyId];

    if (state) {
      sql += ` AND state = $${params.length + 1}`;
      params.push(state);
    }

    if (year) {
      sql += ` AND EXTRACT(YEAR FROM completion_date) = $${params.length + 1}`;
      params.push(year);
    }

    sql += ` ORDER BY completion_date DESC`;

    const result = await query(sql, params);

    return result.rows.map((row) => ({
      id: row.id,
      attorneyId: row.attorney_id,
      providerId: row.provider_id,
      courseName: row.course_name,
      courseDescription: row.course_description,
      creditType: row.credit_type,
      hoursEarned: parseFloat(row.hours_earned),
      state: row.state,
      credentialAccepted: row.credential_accepted,
      completionDate: new Date(row.completion_date),
      certificateUrl: row.certificate_url,
      barReferenceNumber: row.bar_reference_number,
      syncedWithBar: row.synced_with_bar,
      syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (error) {
    console.error('Failed to get CLE credits:', error);
    throw error;
  }
}

// ============================================
// COMPLIANCE TRACKING
// ============================================

export async function updateCLEComplianceStatus(
  attorneyId: string,
  state: string,
  year: number
): Promise<CLECompliance> {
  try {
    const stateReqs = STATE_CLE_REQUIREMENTS[state];
    if (!stateReqs) {
      throw new Error(`CLE requirements not found for state: ${state}`);
    }

    // Get all credits for this attorney in this state for this year
    const creditsResult = await query(
      `SELECT * FROM cle_credits
       WHERE attorney_id = $1 AND state = $2
       AND EXTRACT(YEAR FROM completion_date) = $3`,
      [attorneyId, state, year]
    );

    // Calculate totals by credit type
    let totalHours = 0;
    let ethicsHours = 0;
    let mandatoryHours = 0;
    let generalHours = 0;

    creditsResult.rows.forEach((row) => {
      const hours = parseFloat(row.hours_earned);
      totalHours += hours;

      if (row.credit_type === 'Ethics') {
        ethicsHours += hours;
      } else if (row.credit_type === 'Mandatory') {
        mandatoryHours += hours;
      } else {
        generalHours += hours;
      }
    });

    // Check for carryover hours from previous years
    let carryoverHours = 0;
    if (stateReqs.carryoverYears > 0) {
      const carryoverResult = await query(
        `SELECT COALESCE(SUM(carryover_hours), 0) as total_carryover
         FROM cle_compliance
         WHERE attorney_id = $1 AND state = $2 AND year >= $3`,
        [attorneyId, state, year - stateReqs.carryoverYears]
      );

      if (carryoverResult.rows.length > 0) {
        carryoverHours = parseFloat(carryoverResult.rows[0].total_carryover);
      }
    }

    // Calculate compliance
    const totalWithCarryover = Math.min(
      totalHours + carryoverHours,
      totalHours + stateReqs.carryoverHours
    );
    const deficitHours = Math.max(0, stateReqs.annualHours - totalWithCarryover);
    const isCompliant =
      totalHours >= stateReqs.annualHours &&
      ethicsHours >= stateReqs.ethicsHours &&
      mandatoryHours >= stateReqs.mandatoryHours.Professional;

    // Upsert compliance record
    const complianceResult = await query(
      `INSERT INTO cle_compliance
       (attorney_id, state, year, total_hours, ethics_hours, mandatory_hours,
        general_hours, carryover_hours, deficit_hours, is_compliant, audit_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (attorney_id, state, year)
       DO UPDATE SET
         total_hours = $4, ethics_hours = $5, mandatory_hours = $6,
         general_hours = $7, carryover_hours = $8, deficit_hours = $9,
         is_compliant = $10, audit_status = $11, updated_at = NOW()
       RETURNING *`,
      [
        attorneyId,
        state,
        year,
        totalHours,
        ethicsHours,
        mandatoryHours,
        generalHours,
        carryoverHours,
        deficitHours,
        isCompliant,
        isCompliant ? 'approved' : 'pending',
      ]
    );

    return {
      id: complianceResult.rows[0].id,
      attorneyId,
      state,
      year,
      totalHours,
      ethicsHours,
      mandatoryHours,
      generalHours,
      carryoverHours,
      deficitHours,
      isCompliant,
      lastAuditDate: new Date(complianceResult.rows[0].last_audit_date),
      auditStatus: complianceResult.rows[0].audit_status,
      auditNotes: complianceResult.rows[0].audit_notes,
      createdAt: new Date(complianceResult.rows[0].created_at),
      updatedAt: new Date(complianceResult.rows[0].updated_at),
    };
  } catch (error) {
    console.error('Failed to update CLE compliance status:', error);
    throw error;
  }
}

export async function getCLECompliance(
  attorneyId: string,
  state: string,
  year: number
): Promise<CLECompliance | null> {
  try {
    const result = await query(
      `SELECT * FROM cle_compliance
       WHERE attorney_id = $1 AND state = $2 AND year = $3`,
      [attorneyId, state, year]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      attorneyId: row.attorney_id,
      state: row.state,
      year: row.year,
      totalHours: parseFloat(row.total_hours),
      ethicsHours: parseFloat(row.ethics_hours),
      mandatoryHours: parseFloat(row.mandatory_hours),
      generalHours: parseFloat(row.general_hours),
      carryoverHours: parseFloat(row.carryover_hours),
      deficitHours: parseFloat(row.deficit_hours),
      isCompliant: row.is_compliant,
      lastAuditDate: new Date(row.last_audit_date),
      auditStatus: row.audit_status,
      auditNotes: row.audit_notes,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error('Failed to get CLE compliance:', error);
    throw error;
  }
}

// ============================================
// DEADLINE TRACKING & ALERTS
// ============================================

export async function createOrUpdateCLEDeadline(
  attorneyId: string,
  state: string,
  year?: number
): Promise<CLEDeadline> {
  try {
    const stateReqs = STATE_CLE_REQUIREMENTS[state];
    if (!stateReqs) {
      throw new Error(`CLE requirements not found for state: ${state}`);
    }

    const currentYear = year || new Date().getFullYear();
    const reportingDeadline = new Date(
      `${currentYear}-${stateReqs.reportingDeadline.split('-').slice(1).join('-')}`
    );
    const earningDeadline = new Date(reportingDeadline);
    earningDeadline.setDate(earningDeadline.getDate() - 1);

    const result = await query(
      `INSERT INTO cle_deadlines
       (attorney_id, state, reporting_deadline, earning_deadline, required_hours, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (attorney_id, state, reporting_deadline)
       DO UPDATE SET status = $6, updated_at = NOW()
       RETURNING *`,
      [
        attorneyId,
        state,
        reportingDeadline,
        earningDeadline,
        stateReqs.annualHours,
        'upcoming',
      ]
    );

    return {
      id: result.rows[0].id,
      attorneyId,
      state,
      reportingDeadline: new Date(result.rows[0].reporting_deadline),
      requiredHours: parseFloat(result.rows[0].required_hours),
      earningDeadline: new Date(result.rows[0].earning_deadline),
      alarmAt30Days: result.rows[0].alarm_at_30_days || false,
      alarmAt60Days: result.rows[0].alarm_at_60_days || false,
      alarmAt90Days: result.rows[0].alarm_at_90_days || false,
      status: result.rows[0].status,
      createdAt: new Date(result.rows[0].created_at),
      updatedAt: new Date(result.rows[0].updated_at),
    };
  } catch (error) {
    console.error('Failed to create/update CLE deadline:', error);
    throw error;
  }
}

export async function checkAndSendDeadlineAlerts(): Promise<number> {
  try {
    let alertsSent = 0;

    // Get all upcoming deadlines
    const deadlineResult = await query(
      `SELECT * FROM cle_deadlines
       WHERE status IN ('upcoming', 'warning')
       AND reporting_deadline > NOW()`
    );

    for (const deadline of deadlineResult.rows) {
      const reportingDate = new Date(deadline.reporting_deadline);
      const now = new Date();
      const daysUntilDeadline = Math.ceil(
        (reportingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check for 90-day alert
      if (daysUntilDeadline <= 90 && !deadline.alarm_at_90_days) {
        await sendDeadlineAlert(deadline.attorney_id, deadline.state, 90, daysUntilDeadline);
        await query(
          `UPDATE cle_deadlines SET alarm_at_90_days = true WHERE id = $1`,
          [deadline.id]
        );
        alertsSent++;
      }

      // Check for 60-day alert
      if (daysUntilDeadline <= 60 && !deadline.alarm_at_60_days) {
        await sendDeadlineAlert(deadline.attorney_id, deadline.state, 60, daysUntilDeadline);
        await query(
          `UPDATE cle_deadlines SET alarm_at_60_days = true WHERE id = $1`,
          [deadline.id]
        );
        alertsSent++;
      }

      // Check for 30-day alert
      if (daysUntilDeadline <= 30 && !deadline.alarm_at_30_days) {
        await sendDeadlineAlert(deadline.attorney_id, deadline.state, 30, daysUntilDeadline);
        await query(
          `UPDATE cle_deadlines SET alarm_at_30_days = true WHERE id = $1`,
          [deadline.id]
        );
        alertsSent++;
      }

      // Check for overdue
      if (daysUntilDeadline < 0) {
        await query(
          `UPDATE cle_deadlines SET status = 'overdue' WHERE id = $1`,
          [deadline.id]
        );
      } else if (daysUntilDeadline <= 30) {
        await query(
          `UPDATE cle_deadlines SET status = 'critical' WHERE id = $1`,
          [deadline.id]
        );
      }
    }

    console.log(`✅ Sent ${alertsSent} CLE deadline alerts`);
    return alertsSent;
  } catch (error) {
    console.error('Failed to check and send deadline alerts:', error);
    throw error;
  }
}

async function sendDeadlineAlert(
  attorneyId: string,
  state: string,
  daysThreshold: number,
  daysRemaining: number
): Promise<void> {
  try {
    const userResult = await query(`SELECT email, first_name FROM users WHERE id = $1`, [
      attorneyId,
    ]);

    if (userResult.rows.length === 0) return;

    const user = userResult.rows[0];
    const stateReqs = STATE_CLE_REQUIREMENTS[state];

    const subject = `CLE Deadline Alert - ${daysRemaining} days remaining for ${state}`;
    const message = `Hi ${user.first_name}, you have ${daysRemaining} days until your ${stateReqs.stateName} CLE deadline (${stateReqs.reportingDeadline}). You need ${stateReqs.annualHours} hours to comply.`;

    await sendEmailNotification(user.email, subject, message);
  } catch (error) {
    console.error('Failed to send deadline alert:', error);
  }
}

// ============================================
// BAR ASSOCIATION SYNC
// ============================================

export async function syncWithBarAssociation(
  attorneyId: string,
  state: string
): Promise<boolean> {
  try {
    const stateReqs = STATE_CLE_REQUIREMENTS[state];
    if (!stateReqs) {
      throw new Error(`CLE requirements not found for state: ${state}`);
    }

    // Get attorney's CLE credits
    const creditsResult = await query(
      `SELECT * FROM cle_credits
       WHERE attorney_id = $1 AND state = $2 AND synced_with_bar = false`,
      [attorneyId, state]
    );

    if (creditsResult.rows.length === 0) {
      return true; // Nothing to sync
    }

    // In production, this would call the actual bar association API
    console.log(
      `Syncing ${creditsResult.rows.length} credits with ${stateReqs.stateName} bar association`
    );

    // Mark credits as synced
    for (const credit of creditsResult.rows) {
      await query(
        `UPDATE cle_credits
         SET synced_with_bar = true, synced_at = NOW(),
             bar_reference_number = $1
         WHERE id = $2`,
        [`BAR-${state}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, credit.id]
      );
    }

    return true;
  } catch (error) {
    console.error('Failed to sync with bar association:', error);
    return false;
  }
}

// ============================================
// COMPLIANCE REPORTING
// ============================================

export async function generateComplianceReport(
  attorneyId: string,
  state: string,
  year: number
): Promise<CLEExportReport> {
  try {
    const compliance = await getCLECompliance(attorneyId, state, year);
    if (!compliance) {
      throw new Error('No compliance record found for this period');
    }

    const credits = await getCLECredits(attorneyId, state, year);

    // Create report object
    const report: CLEExportReport = {
      id: `report-${attorneyId}-${state}-${year}`,
      attorneyId,
      state,
      reportYear: year,
      totalCredits: compliance.totalHours,
      creditBreakdown: {
        ethics: compliance.ethicsHours,
        mandatory: compliance.mandatoryHours,
        general: compliance.generalHours,
      },
      compliant: compliance.isCompliant,
      generatedAt: new Date(),
      fileFormat: 'json',
      fileUrl: '',
    };

    // Save report to database
    await query(
      `INSERT INTO cle_export_reports
       (attorney_id, state, report_year, total_credits, credit_breakdown, compliant, file_format)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        attorneyId,
        state,
        year,
        compliance.totalHours,
        JSON.stringify(report.creditBreakdown),
        compliance.isCompliant,
        'json',
      ]
    );

    return report;
  } catch (error) {
    console.error('Failed to generate compliance report:', error);
    throw error;
  }
}

export async function exportForBarApplication(
  attorneyId: string,
  state: string,
  year: number,
  format: 'pdf' | 'csv' | 'json' = 'pdf'
): Promise<string> {
  try {
    const credits = await getCLECredits(attorneyId, state, year);
    const compliance = await getCLECompliance(attorneyId, state, year);

    if (!compliance) {
      throw new Error('No compliance record found for export');
    }

    let exportData = '';

    if (format === 'json') {
      exportData = JSON.stringify(
        {
          attorney: attorneyId,
          state,
          year,
          compliance,
          credits: credits.map((c) => ({
            course: c.courseName,
            type: c.creditType,
            hours: c.hoursEarned,
            date: c.completionDate,
            provider: c.providerId,
            barReference: c.barReferenceNumber,
          })),
        },
        null,
        2
      );
    } else if (format === 'csv') {
      const header = 'Course Name,Credit Type,Hours Earned,Completion Date,Provider,Bar Reference\n';
      const rows = credits
        .map(
          (c) =>
            `"${c.courseName}","${c.creditType}",${c.hoursEarned},"${c.completionDate.toISOString()}","${c.providerId}","${c.barReferenceNumber || ''}"`
        )
        .join('\n');
      exportData = header + rows;
    } else {
      // PDF export would use a library like pdfkit or use external service
      exportData = `CLE Compliance Report\nAttorney: ${attorneyId}\nState: ${state}\nYear: ${year}\n\nTotal Hours: ${compliance.totalHours}\nCompliant: ${compliance.isCompliant}`;
    }

    // Store export in database
    const result = await query(
      `INSERT INTO cle_export_reports
       (attorney_id, state, report_year, total_credits, file_format)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [attorneyId, state, year, compliance.totalHours, format]
    );

    return exportData;
  } catch (error) {
    console.error('Failed to export for bar application:', error);
    throw error;
  }
}

// ============================================
// CLE PROVIDER MANAGEMENT
// ============================================

export async function registerCLEProvider(
  providerName: string,
  providerType: 'law-firm' | 'bar-association' | 'university' | 'online-platform' | 'conference',
  statesApproved: string[],
  approvalNumber?: string,
  apiIntegration: boolean = false
): Promise<CLEProvider> {
  try {
    const result = await query(
      `INSERT INTO cle_providers
       (provider_name, provider_type, states_approved, approval_number, api_integration)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [providerName, providerType, JSON.stringify(statesApproved), approvalNumber, apiIntegration]
    );

    return {
      id: result.rows[0].id,
      providerName: result.rows[0].provider_name,
      providerType: result.rows[0].provider_type,
      statesApproved: result.rows[0].states_approved,
      approvalNumber: result.rows[0].approval_number,
      barAssociationId: result.rows[0].bar_association_id,
      apiIntegration: result.rows[0].api_integration,
      lastSyncDate: result.rows[0].last_sync_date
        ? new Date(result.rows[0].last_sync_date)
        : undefined,
      createdAt: new Date(result.rows[0].created_at),
      updatedAt: new Date(result.rows[0].updated_at),
    };
  } catch (error) {
    console.error('Failed to register CLE provider:', error);
    throw error;
  }
}

export async function getCLEProvider(providerId: string): Promise<CLEProvider | null> {
  try {
    const result = await query(`SELECT * FROM cle_providers WHERE id = $1`, [providerId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      providerName: row.provider_name,
      providerType: row.provider_type,
      statesApproved: row.states_approved,
      approvalNumber: row.approval_number,
      barAssociationId: row.bar_association_id,
      apiIntegration: row.api_integration,
      lastSyncDate: row.last_sync_date ? new Date(row.last_sync_date) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  } catch (error) {
    console.error('Failed to get CLE provider:', error);
    throw error;
  }
}

export default {
  STATE_CLE_REQUIREMENTS,
  recordCLECredit,
  getCLECredits,
  updateCLEComplianceStatus,
  getCLECompliance,
  createOrUpdateCLEDeadline,
  checkAndSendDeadlineAlerts,
  syncWithBarAssociation,
  generateComplianceReport,
  exportForBarApplication,
  registerCLEProvider,
  getCLEProvider,
};
