// Threat Detection & Security Scan Service
// Integrates with Google Safe Browsing, AWS, and VirusTotal for comprehensive threat detection
// Implements threat isolation and reporting mechanisms

import axios, { AxiosError } from 'axios';
import { query } from '../database/connection';
import { sendEmail } from './emailService';
import * as AWS from 'aws-sdk';

// Types
export interface ThreatReport {
  id: string;
  resourceId: string;
  resourceType: 'file' | 'url' | 'ip' | 'domain';
  threatLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  detectedThreats: Threat[];
  scanDate: Date;
  isolated: boolean;
  isolationReason?: string;
  reportedTo: string[];
  status: 'pending' | 'scanned' | 'isolated' | 'resolved';
  metadata?: Record<string, any>;
}

export interface Threat {
  name: string;
  type: 'malware' | 'phishing' | 'suspicious' | 'blocked' | 'malicious-url';
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: 'google-safe-browsing' | 'virustotal' | 'aws-inspector' | 'internal';
  details?: string;
}

export interface ScanError {
  timestamp: Date;
  service: 'google' | 'aws' | 'virustotal' | 'internal';
  error: string;
  resourceId?: string;
  retryable: boolean;
  retryCount: number;
}

// Configuration
const GOOGLE_SAFE_BROWSING_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY || '';
const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY || '';
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const MAX_RETRIES = 3;
const THREAT_ISOLATION_BUCKET = 'transcend-isolated-threats';
const SECURITY_ALERT_EMAIL = process.env.SECURITY_ALERT_EMAIL || 'security@transcend-law.com';

// Initialize AWS services
const s3 = new AWS.S3({
  accessKeyId: AWS_ACCESS_KEY,
  secretAccessKey: AWS_SECRET_KEY,
  region: AWS_REGION,
});

// Google Safe Browsing Integration
async function scanWithGoogleSafeBrowsing(url: string): Promise<Threat[]> {
  if (!GOOGLE_SAFE_BROWSING_API_KEY) {
    throw new Error('Google Safe Browsing API key not configured');
  }

  try {
    const response = await axios.post(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${GOOGLE_SAFE_BROWSING_API_KEY}`,
      {
        client: {
          clientId: 'transcend-law-security',
          clientVersion: '1.0.0',
        },
        threatInfo: {
          threatTypes: [
            'MALWARE',
            'SOCIAL_ENGINEERING',
            'UNWANTED_SOFTWARE',
            'POTENTIALLY_HARMFUL_APPLICATION',
          ],
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      },
      { timeout: 5000 }
    );

    if (response.data.matches) {
      return response.data.matches.map((match: any) => ({
        name: match.threat?.threatType || 'Unknown Threat',
        type: 'blocked' as const,
        severity: 'high' as const,
        source: 'google-safe-browsing' as const,
        details: `Platform: ${match.platformType}, URL: ${match.threat?.url || 'N/A'}, Cache: ${match.cacheDuration}`,
      }));
    }

    return [];
  } catch (error) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status || 0;
    await logScanError({
      timestamp: new Date(),
      service: 'google',
      error: axiosError.message,
      retryable: statusCode !== 403 && statusCode !== 401,
      retryCount: 0,
    });
    throw error;
  }
}

// VirusTotal Integration
async function scanWithVirusTotal(fileHash: string): Promise<Threat[]> {
  if (!VIRUSTOTAL_API_KEY) {
    throw new Error('VirusTotal API key not configured');
  }

  try {
    const response = await axios.get(
      `https://www.virustotal.com/api/v3/files/${fileHash}`,
      {
        headers: {
          'x-apikey': VIRUSTOTAL_API_KEY,
        },
        timeout: 5000,
      }
    );

    const threats: Threat[] = [];
    const stats = response.data?.data?.attributes?.last_analysis_stats;

    if (!stats) {
      throw new Error('Invalid VirusTotal API response: missing analysis stats');
    }

    if ((stats.malicious || 0) > 0) {
      threats.push({
        name: 'Detected Malware',
        type: 'malware',
        severity: stats.malicious > 5 ? 'critical' : 'high',
        source: 'virustotal',
        details: `${stats.malicious} vendors detected malware`,
      });
    }

    if ((stats.suspicious || 0) > 0) {
      threats.push({
        name: 'Suspicious File',
        type: 'suspicious',
        severity: 'medium',
        source: 'virustotal',
        details: `${stats.suspicious} vendors marked as suspicious`,
      });
    }

    return threats;
  } catch (error) {
    const axiosError = error as AxiosError;
    const statusCode = axiosError.response?.status || 0;
    await logScanError({
      timestamp: new Date(),
      service: 'virustotal',
      error: axiosError.message,
      retryable: statusCode !== 404 && statusCode !== 401,
      retryCount: 0,
    });
    throw error;
  }
}

// AWS Inspector Integration
async function scanWithAWSInspector(imageId: string): Promise<Threat[]> {
  try {
    // AWS Inspector v2 uses a different SDK - for now, return empty array
    // In production, implement actual AWS Inspector v2 findings API calls
    const threats: Threat[] = [];

    // TODO: Implement AWS Inspector v2 integration
    // const inspector = new AWS.Inspector2({ region: AWS_REGION });
    // const findings = await inspector.listFindings({ filterCriteria: { resourceId: [imageId] } }).promise();

    return threats;
  } catch (error) {
    const err = error as Error;
    await logScanError({
      timestamp: new Date(),
      service: 'aws',
      error: err.message,
      retryable: true,
      retryCount: 0,
    });
    throw error;
  }
}

// Scan URL for threats
export async function scanUrl(url: string): Promise<ThreatReport> {
  const reportId = `url-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const threats: Threat[] = [];
  const reportedTo: string[] = [];
  let threatLevel: 'critical' | 'high' | 'medium' | 'low' | 'none' = 'none';

  try {
    // Scan with Google Safe Browsing
    try {
      const googleThreats = await scanWithGoogleSafeBrowsing(url);
      threats.push(...googleThreats);
      reportedTo.push('google-safe-browsing');
    } catch (error) {
      console.error('Google Safe Browsing scan failed:', error);
    }

    // Determine threat level
    if (threats.some((t) => t.severity === 'critical')) {
      threatLevel = 'critical';
    } else if (threats.some((t) => t.severity === 'high')) {
      threatLevel = 'high';
    } else if (threats.some((t) => t.severity === 'medium')) {
      threatLevel = 'medium';
    } else if (threats.some((t) => t.severity === 'low')) {
      threatLevel = 'low';
    }

    const report: ThreatReport = {
      id: reportId,
      resourceId: url,
      resourceType: 'url',
      threatLevel,
      detectedThreats: threats,
      scanDate: new Date(),
      isolated: threatLevel === 'critical',
      status: threatLevel === 'critical' ? 'isolated' : 'scanned',
      reportedTo,
    };

    // Store report
    await storeThreatReport(report);

    // If critical, isolate
    if (threatLevel === 'critical') {
      await isolateThreat(reportId, url, 'url', threats);
    }

    return report;
  } catch (error) {
    console.error('URL scan failed:', error);
    throw new Error(`Failed to scan URL: ${error}`);
  }
}

// Scan file hash for threats
export async function scanFileHash(fileHash: string): Promise<ThreatReport> {
  const reportId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const threats: Threat[] = [];
  const reportedTo: string[] = [];
  let threatLevel: 'critical' | 'high' | 'medium' | 'low' | 'none' = 'none';

  try {
    // Scan with VirusTotal
    try {
      const vtThreats = await scanWithVirusTotal(fileHash);
      threats.push(...vtThreats);
      reportedTo.push('virustotal');
    } catch (error) {
      console.error('VirusTotal scan failed:', error);
    }

    // Determine threat level
    if (threats.some((t) => t.severity === 'critical')) {
      threatLevel = 'critical';
    } else if (threats.some((t) => t.severity === 'high')) {
      threatLevel = 'high';
    } else if (threats.some((t) => t.severity === 'medium')) {
      threatLevel = 'medium';
    } else if (threats.some((t) => t.severity === 'low')) {
      threatLevel = 'low';
    }

    const report: ThreatReport = {
      id: reportId,
      resourceId: fileHash,
      resourceType: 'file',
      threatLevel,
      detectedThreats: threats,
      scanDate: new Date(),
      isolated: threatLevel === 'critical',
      status: threatLevel === 'critical' ? 'isolated' : 'scanned',
      reportedTo,
    };

    // Store report
    await storeThreatReport(report);

    // If critical, isolate
    if (threatLevel === 'critical') {
      await isolateThreat(reportId, fileHash, 'file', threats);
    }

    return report;
  } catch (error) {
    console.error('File scan failed:', error);
    throw new Error(`Failed to scan file: ${error}`);
  }
}

// Isolate threat
async function isolateThreat(
  reportId: string,
  resourceId: string,
  resourceType: string,
  threats: Threat[]
): Promise<void> {
  try {
    // Move file to isolated bucket
    if (resourceType === 'file') {
      const isolationData = JSON.stringify({
        reportId,
        resourceId,
        threats,
        isolatedAt: new Date().toISOString(),
      });

      await s3
        .putObject({
          Bucket: THREAT_ISOLATION_BUCKET,
          Key: `${reportId}.json`,
          Body: isolationData,
          ServerSideEncryption: 'AES256',
          Metadata: {
            'threat-level': threats[0]?.severity || 'unknown',
          },
        })
        .promise();
    }

    // Update report status
    await query(
      `UPDATE threat_reports
       SET isolated = true, isolation_reason = 'Critical threat detected'
       WHERE id = $1`,
      [reportId]
    );

    // Alert security team
    await sendThreatAlert(reportId, resourceId, threats);
  } catch (error) {
    console.error('Failed to isolate threat:', error);
    throw new Error('Failed to isolate threat');
  }
}

// Store threat report
async function storeThreatReport(report: ThreatReport): Promise<void> {
  try {
    await query(
      `INSERT INTO threat_reports
       (id, resource_id, resource_type, threat_level, detected_threats, scan_date, isolated, status, reported_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        report.id,
        report.resourceId,
        report.resourceType,
        report.threatLevel,
        JSON.stringify(report.detectedThreats),
        report.scanDate,
        report.isolated,
        report.status,
        JSON.stringify(report.reportedTo),
      ]
    );
  } catch (error) {
    console.error('Failed to store threat report:', error);
  }
}

// Log scan errors
export async function logScanError(error: ScanError): Promise<void> {
  try {
    await query(
      `INSERT INTO scan_errors
       (service, error, resource_id, retryable, retry_count, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [error.service, error.error, error.resourceId || null, error.retryable, error.retryCount]
    );
  } catch (dbError) {
    console.error('Failed to log scan error:', dbError);
  }
}

// Send threat alert email
async function sendThreatAlert(reportId: string, resourceId: string, threats: Threat[]): Promise<void> {
  try {
    await sendEmail(SECURITY_ALERT_EMAIL, 'threat-detected', {
      reportId,
      resourceId,
      threatCount: threats.length,
      // EmailContext is scalar-only; serialise the detail.
      threats: JSON.stringify(
        threats.map((t) => ({ name: t.name, type: t.type, severity: t.severity }))
      ),
      alertTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to send threat alert:', error);
  }
}

// Get threat reports
export async function getThreatReports(
  filters?: {
    threatLevel?: string;
    status?: string;
    limit?: number;
  }
): Promise<ThreatReport[]> {
  try {
    let sql = 'SELECT * FROM threat_reports WHERE 1=1';
    const params: any[] = [];

    if (filters?.threatLevel) {
      sql += ` AND threat_level = $${params.length + 1}`;
      params.push(filters.threatLevel);
    }

    if (filters?.status) {
      sql += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    sql += ` ORDER BY scan_date DESC LIMIT $${params.length + 1}`;
    params.push(filters?.limit || 100);

    const result = await query(sql, params);

    return result.rows.map((row: any) => ({
      id: row.id,
      resourceId: row.resource_id,
      resourceType: row.resource_type,
      threatLevel: row.threat_level,
      detectedThreats: JSON.parse(row.detected_threats),
      scanDate: row.scan_date,
      isolated: row.isolated,
      isolationReason: row.isolation_reason,
      reportedTo: JSON.parse(row.reported_to),
      status: row.status,
    }));
  } catch (error) {
    console.error('Failed to retrieve threat reports:', error);
    return [];
  }
}

// Get scan errors
export async function getScanErrors(limit = 50): Promise<ScanError[]> {
  try {
    const result = await query(
      `SELECT * FROM scan_errors
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => ({
      timestamp: row.created_at,
      service: row.service,
      error: row.error,
      resourceId: row.resource_id,
      retryable: row.retryable,
      retryCount: row.retry_count,
    }));
  } catch (error) {
    console.error('Failed to retrieve scan errors:', error);
    return [];
  }
}

// Perform comprehensive system scan
export async function performSystemScan(): Promise<{
  totalScans: number;
  threatsDetected: number;
  itemsIsolated: number;
  errors: number;
}> {
  try {
    const reports = await getThreatReports({ limit: 1000 });
    const errors = await getScanErrors(1000);

    const stats = {
      totalScans: reports.length,
      threatsDetected: reports.filter((r) => r.threatLevel !== 'none').length,
      itemsIsolated: reports.filter((r) => r.isolated).length,
      errors: errors.length,
    };

    return stats;
  } catch (error) {
    console.error('Failed to perform system scan:', error);
    throw error;
  }
}

// Generate security report
export async function generateSecurityReport(): Promise<string> {
  try {
    const reports = await getThreatReports({ limit: 1000 });
    const errors = await getScanErrors(100);

    const criticalThreats = reports.filter((r) => r.threatLevel === 'critical');
    const highThreats = reports.filter((r) => r.threatLevel === 'high');

    const report = `
SECURITY SCAN REPORT
Generated: ${new Date().toISOString()}

SUMMARY:
- Total Scans: ${reports.length}
- Critical Threats: ${criticalThreats.length}
- High Threats: ${highThreats.length}
- Items Isolated: ${reports.filter((r) => r.isolated).length}
- Recent Errors: ${errors.length}

CRITICAL THREATS:
${criticalThreats.map((t) => `- ${t.resourceId}: ${t.detectedThreats.length} threats detected`).join('\n')}

HIGH PRIORITY THREATS:
${highThreats.slice(0, 10).map((t) => `- ${t.resourceId}: ${t.threatLevel}`).join('\n')}

RECENT ERRORS:
${errors.slice(0, 10).map((e) => `- [${e.service}] ${e.error}`).join('\n')}
    `;

    return report;
  } catch (error) {
    console.error('Failed to generate security report:', error);
    throw error;
  }
}

export default {
  scanUrl,
  scanFileHash,
  getThreatReports,
  getScanErrors,
  performSystemScan,
  generateSecurityReport,
  logScanError,
};
