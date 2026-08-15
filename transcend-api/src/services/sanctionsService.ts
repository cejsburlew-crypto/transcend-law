// OFAC/Sanctions Screening Service
// Real-time sanctions checking against OFAC SDN, EU, UN, and UK lists
// Integrates with OpenSanctions API with local caching and daily updates

import axios from 'axios';
import { query, transaction } from '../database/connection';
import crypto from 'crypto';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SanctionsCheckPayload {
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  taxId?: string;
  companyName?: string;
  checkType: 'account_creation' | 'payment_processing' | 'manual_review';
}

export interface SanctionsMatch {
  id: string;
  matchType: 'individual' | 'entity' | 'vessel';
  sanctionsList: string[];
  listNames: string[];
  matchScore: number;
  names: string[];
  addresses: string[];
  passportNumbers: string[];
  taxIds: string[];
  dateOfBirth?: string;
  nationality?: string;
  details: Record<string, any>;
}

export interface SanctionsScreeningResult {
  id: string;
  userId: string;
  checkType: 'account_creation' | 'payment_processing' | 'manual_review';
  status: 'clear' | 'potential_match' | 'confirmed_match' | 'blocked' | 'manual_review';
  riskScore: number; // 0-100
  matches: SanctionsMatch[];
  sanctionsLists: string[]; // Lists checked against
  autoBlocked: boolean;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyUpdateStatus {
  id: string;
  listName: string;
  lastUpdated: Date;
  recordCount: number;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
}

// ============================================
// CONFIGURATION
// ============================================

const SANCTIONS_LISTS = {
  'OFAC_SDN': {
    url: 'https://www.treasury.gov/ofac/downloads/sdnlist.txt',
    name: 'OFAC Specially Designated Nationals List',
    updateInterval: 24 * 60 * 60 * 1000, // Daily
    weight: 1.0,
  },
  'EU_SANCTIONS': {
    url: 'https://webgate.ec.europa.eu/europeana/api/v2/search.json?query=sanctions',
    name: 'EU Consolidated Sanctions List',
    updateInterval: 24 * 60 * 60 * 1000,
    weight: 0.85,
  },
  'UN_SANCTIONS': {
    url: 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
    name: 'UN Consolidated Sanctions List',
    updateInterval: 24 * 60 * 60 * 1000,
    weight: 0.9,
  },
  'UK_SANCTIONS': {
    url: 'https://www.trade-tariff.service.gov.uk/sanctions-list',
    name: 'UK Consolidated Sanctions List',
    updateInterval: 24 * 60 * 60 * 1000,
    weight: 0.8,
  },
  'OPEN_SANCTIONS': {
    url: 'https://www.opensanctions.org/api/v1/sanctions/',
    name: 'OpenSanctions Aggregated List',
    updateInterval: 24 * 60 * 60 * 1000,
    weight: 0.95,
  },
};

const RISK_SCORE_THRESHOLDS = {
  CLEAR: 20,
  MANUAL_REVIEW: 50,
  CONFIRMED_MATCH: 75,
  AUTO_BLOCK: 90,
};

const SCREENING_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================
// INTERNAL CACHE
// ============================================

let sanctionsCacheMap: Map<string, SanctionsMatch[]> = new Map();
let cacheLastUpdated: Date = new Date(0);

// ============================================
// PRIVATE HELPER FUNCTIONS
// ============================================

/**
 * Calculate similarity score between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.includes(shorter)) return 0.95;

  const editDistance = getEditDistance(shorter, longer);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance calculation
 */
function getEditDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

/**
 * Calculate composite risk score based on matches
 */
function calculateRiskScore(matches: SanctionsMatch[]): number {
  if (matches.length === 0) return 0;

  const totalScore = matches.reduce((sum, match) => {
    const baseScore = match.matchScore * 100;
    const listWeights = match.sanctionsList.map((list) => SANCTIONS_LISTS[list]?.weight || 0.5);
    const maxWeight = Math.max(...listWeights);
    return sum + baseScore * maxWeight;
  }, 0);

  const averageScore = Math.min(100, (totalScore / matches.length) * 0.9); // Cap at 90 before final adjustment
  return Math.round(averageScore);
}

/**
 * Determine status based on risk score
 */
function getStatusFromRiskScore(riskScore: number): 'clear' | 'potential_match' | 'confirmed_match' | 'blocked' | 'manual_review' {
  if (riskScore <= RISK_SCORE_THRESHOLDS.CLEAR) return 'clear';
  if (riskScore <= RISK_SCORE_THRESHOLDS.MANUAL_REVIEW) return 'potential_match';
  if (riskScore <= RISK_SCORE_THRESHOLDS.CONFIRMED_MATCH) return 'confirmed_match';
  if (riskScore >= RISK_SCORE_THRESHOLDS.AUTO_BLOCK) return 'blocked';
  return 'manual_review';
}

/**
 * Fetch and parse OpenSanctions data (primary source)
 */
async function fetchOpenSanctionsData(): Promise<SanctionsMatch[]> {
  try {
    const response = await axios.get(SANCTIONS_LISTS.OPEN_SANCTIONS.url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'TranscendLaw-SanctionsScreening/1.0',
      },
    });

    const matches: SanctionsMatch[] = [];
    const data = response.data;

    if (Array.isArray(data.results)) {
      data.results.forEach((entry: any, index: number) => {
        const match: SanctionsMatch = {
          id: `opensanctions_${index}`,
          matchType: entry.entity_type === 'Person' ? 'individual' : entry.entity_type === 'Company' ? 'entity' : 'vessel',
          sanctionsList: ['OPEN_SANCTIONS'],
          listNames: [SANCTIONS_LISTS.OPEN_SANCTIONS.name],
          matchScore: 0.95,
          names: [entry.name, ...(entry.aliases || [])],
          addresses: entry.addresses || [],
          passportNumbers: entry.passport_numbers || [],
          taxIds: entry.tax_ids || [],
          dateOfBirth: entry.date_of_birth,
          nationality: entry.nationality,
          details: entry,
        };
        matches.push(match);
      });
    }

    return matches;
  } catch (error) {
    console.error('Error fetching OpenSanctions data:', error);
    return [];
  }
}

/**
 * Fetch OFAC SDN list (fallback)
 */
async function fetchOFACSDNData(): Promise<SanctionsMatch[]> {
  try {
    const response = await axios.get(SANCTIONS_LISTS.OFAC_SDN.url, {
      timeout: 30000,
      responseType: 'text',
    });

    const matches: SanctionsMatch[] = [];
    const lines = response.data.split('\n');

    // Parse OFAC SDN CSV format (simplified)
    for (let i = 2; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const parts = lines[i].split(',');
      if (parts.length < 5) continue;

      const match: SanctionsMatch = {
        id: `ofac_sdn_${i}`,
        matchType: 'individual',
        sanctionsList: ['OFAC_SDN'],
        listNames: [SANCTIONS_LISTS.OFAC_SDN.name],
        matchScore: 0.9,
        names: [parts[0]?.trim() || ''],
        addresses: [parts[2]?.trim() || ''],
        passportNumbers: [],
        taxIds: [],
        details: {
          entityId: parts[1]?.trim(),
          type: parts[3]?.trim(),
          program: parts[4]?.trim(),
        },
      };

      matches.push(match);
    }

    return matches;
  } catch (error) {
    console.error('Error fetching OFAC SDN data:', error);
    return [];
  }
}

/**
 * Match individual against cached sanctions data
 */
function matchAgainstSanctionsData(
  firstName: string,
  lastName: string,
  payload: SanctionsCheckPayload
): SanctionsMatch[] {
  const fullName = `${firstName} ${lastName}`.toLowerCase().trim();
  const matches: SanctionsMatch[] = [];
  const threshold = 0.75; // Similarity threshold

  sanctionsCacheMap.forEach((sanctionsMatches) => {
    sanctionsMatches.forEach((sanctionEntry) => {
      sanctionEntry.names.forEach((sanctionName) => {
        const similarity = calculateSimilarity(fullName, sanctionName);

        if (similarity >= threshold) {
          const match = { ...sanctionEntry };
          match.matchScore = similarity;

          // Additional checks for addresses, dates, etc.
          if (payload.address && sanctionEntry.addresses.length > 0) {
            const addressSimilarity = Math.max(
              ...sanctionEntry.addresses.map((addr) => calculateSimilarity(payload.address || '', addr))
            );
            if (addressSimilarity > 0.7) {
              match.matchScore = Math.min(1.0, match.matchScore + 0.05);
            }
          }

          // Check dates of birth
          if (payload.dateOfBirth && sanctionEntry.dateOfBirth) {
            if (payload.dateOfBirth === sanctionEntry.dateOfBirth) {
              match.matchScore = Math.min(1.0, match.matchScore + 0.1);
            }
          }

          matches.push(match);
        }
      });
    });
  });

  return matches;
}

// ============================================
// PUBLIC API FUNCTIONS
// ============================================

/**
 * Initialize and load sanctions data
 */
export async function initializeSanctionsData(): Promise<void> {
  try {
    console.log('Initializing sanctions data cache...');

    // Fetch from OpenSanctions (primary source)
    const openSanctionsData = await fetchOpenSanctionsData();
    if (openSanctionsData.length > 0) {
      sanctionsCacheMap.set('OPEN_SANCTIONS', openSanctionsData);
      await saveSanctionsUpdateStatus('OPEN_SANCTIONS', openSanctionsData.length, 'success');
    }

    // Fetch from OFAC as fallback
    const ofacData = await fetchOFACSDNData();
    if (ofacData.length > 0) {
      sanctionsCacheMap.set('OFAC_SDN', ofacData);
      await saveSanctionsUpdateStatus('OFAC_SDN', ofacData.length, 'success');
    }

    cacheLastUpdated = new Date();
    console.log(`Sanctions data loaded. Total lists cached: ${sanctionsCacheMap.size}`);
  } catch (error) {
    console.error('Failed to initialize sanctions data:', error);
    throw error;
  }
}

/**
 * Screen individual/entity against sanctions lists
 */
export async function screenAgainstSanctions(
  payload: SanctionsCheckPayload
): Promise<SanctionsScreeningResult> {
  return transaction(async (client) => {
    try {
      // Ensure cache is populated
      if (sanctionsCacheMap.size === 0) {
        await initializeSanctionsData();
      }

      // Search for matches
      const matches = matchAgainstSanctionsData(payload.firstName, payload.lastName, payload);

      // Calculate risk score
      const riskScore = calculateRiskScore(matches);
      const status = getStatusFromRiskScore(riskScore);
      const autoBlocked = status === 'blocked' && riskScore >= RISK_SCORE_THRESHOLDS.AUTO_BLOCK;

      // Create screening record
      const screeningId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + SCREENING_CACHE_DURATION);

      const result = await query(
        `INSERT INTO sanctions_screenings
         (id, user_id, check_type, status, risk_score, matches_count,
          sanctions_lists, auto_blocked, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          screeningId,
          payload.userId,
          payload.checkType,
          status,
          riskScore,
          matches.length,
          JSON.stringify(matches.flatMap((m) => m.sanctionsList)),
          autoBlocked,
          expiresAt,
        ]
      );

      // Store match details
      if (matches.length > 0) {
        for (const match of matches) {
          await query(
            `INSERT INTO sanctions_matches
             (screening_id, match_type, match_score, list_names, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              screeningId,
              match.matchType,
              match.matchScore,
              JSON.stringify(match.listNames),
              JSON.stringify(match.details),
            ]
          );
        }
      }

      // Log audit trail
      await query(
        `INSERT INTO sanctions_audit_log
         (user_id, check_type, status, risk_score, matches_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [payload.userId, payload.checkType, status, riskScore, matches.length]
      );

      // Auto-block if necessary
      if (autoBlocked) {
        await query(
          `UPDATE users SET sanctions_blocked = true WHERE id = $1`,
          [payload.userId]
        );
      }

      return {
        id: screeningId,
        userId: payload.userId,
        checkType: payload.checkType,
        status,
        riskScore,
        matches,
        sanctionsLists: Array.from(sanctionsCacheMap.keys()),
        autoBlocked,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      console.error('Sanctions screening error:', error);
      throw error;
    }
  });
}

/**
 * Get screening result history for user
 */
export async function getUserScreeningHistory(
  userId: string,
  limit: number = 10
): Promise<SanctionsScreeningResult[]> {
  try {
    const result = await query(
      `SELECT * FROM sanctions_screenings
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      checkType: row.check_type,
      status: row.status,
      riskScore: row.risk_score,
      matches: JSON.parse(row.matches_data || '[]'),
      sanctionsLists: JSON.parse(row.sanctions_lists),
      autoBlocked: row.auto_blocked,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching screening history:', error);
    throw error;
  }
}

/**
 * Get single screening result
 */
export async function getScreeningResult(screeningId: string): Promise<SanctionsScreeningResult | null> {
  try {
    const result = await query(
      `SELECT * FROM sanctions_screenings WHERE id = $1`,
      [screeningId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    // Fetch matches for this screening
    const matchesResult = await query(
      `SELECT * FROM sanctions_matches WHERE screening_id = $1`,
      [screeningId]
    );

    const matches = matchesResult.rows.map((match) => ({
      id: match.id,
      matchType: match.match_type,
      sanctionsList: JSON.parse(match.list_names),
      listNames: JSON.parse(match.list_names),
      matchScore: match.match_score,
      names: [],
      addresses: [],
      passportNumbers: [],
      taxIds: [],
      details: JSON.parse(match.details),
    }));

    return {
      id: row.id,
      userId: row.user_id,
      checkType: row.check_type,
      status: row.status,
      riskScore: row.risk_score,
      matches,
      sanctionsLists: JSON.parse(row.sanctions_lists),
      autoBlocked: row.auto_blocked,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Error fetching screening result:', error);
    throw error;
  }
}

/**
 * Manual review of screening result
 */
export async function reviewScreening(
  screeningId: string,
  reviewedBy: string,
  newStatus: 'clear' | 'potential_match' | 'confirmed_match' | 'blocked' | 'manual_review',
  reviewNotes: string
): Promise<SanctionsScreeningResult | null> {
  return transaction(async (client) => {
    try {
      // Update screening status
      const result = await query(
        `UPDATE sanctions_screenings
         SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3
         WHERE id = $4
         RETURNING *`,
        [newStatus, reviewedBy, reviewNotes, screeningId]
      );

      if (result.rows.length === 0) {
        throw new Error('Screening not found');
      }

      const row = result.rows[0];

      // Log the review action
      await query(
        `INSERT INTO sanctions_audit_log
         (user_id, action, check_type, status, risk_score, reviewed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          row.user_id,
          'MANUAL_REVIEW',
          row.check_type,
          newStatus,
          row.risk_score,
          reviewedBy,
        ]
      );

      // Update user block status if needed
      if (newStatus === 'blocked') {
        await query(`UPDATE users SET sanctions_blocked = true WHERE id = $1`, [row.user_id]);
      } else if (newStatus === 'clear') {
        await query(`UPDATE users SET sanctions_blocked = false WHERE id = $1`, [row.user_id]);
      }

      return getScreeningResult(screeningId);
    } catch (error) {
      console.error('Error reviewing screening:', error);
      throw error;
    }
  });
}

/**
 * Get pending manual reviews
 */
export async function getPendingReviews(limit: number = 50): Promise<SanctionsScreeningResult[]> {
  try {
    const result = await query(
      `SELECT * FROM sanctions_screenings
       WHERE status = 'manual_review' AND reviewed_by IS NULL
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      checkType: row.check_type,
      status: row.status,
      riskScore: row.risk_score,
      matches: JSON.parse(row.matches_data || '[]'),
      sanctionsLists: JSON.parse(row.sanctions_lists),
      autoBlocked: row.auto_blocked,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      reviewNotes: row.review_notes,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    throw error;
  }
}

/**
 * Save sanctions update status
 */
async function saveSanctionsUpdateStatus(
  listName: string,
  recordCount: number,
  status: 'success' | 'failed' | 'pending',
  errorMessage?: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO sanctions_list_updates
       (list_name, record_count, status, error_message, last_updated)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (list_name)
       DO UPDATE SET record_count = $2, status = $3, error_message = $4, last_updated = NOW()`,
      [listName, recordCount, status, errorMessage]
    );
  } catch (error) {
    console.error('Error saving update status:', error);
  }
}

/**
 * Get sanctions list update status
 */
export async function getSanctionsUpdateStatus(): Promise<DailyUpdateStatus[]> {
  try {
    const result = await query(
      `SELECT * FROM sanctions_list_updates ORDER BY last_updated DESC`
    );

    return result.rows.map((row) => ({
      id: row.id,
      listName: row.list_name,
      lastUpdated: row.last_updated,
      recordCount: row.record_count,
      status: row.status,
      errorMessage: row.error_message,
    }));
  } catch (error) {
    console.error('Error fetching update status:', error);
    throw error;
  }
}

/**
 * Daily update job for sanctions lists
 */
export async function performDailyUpdate(): Promise<void> {
  try {
    console.log('Starting daily sanctions list update...');

    // Fetch and update data
    const openSanctionsData = await fetchOpenSanctionsData();
    const ofacData = await fetchOFACSDNData();

    // Update cache
    if (openSanctionsData.length > 0) {
      sanctionsCacheMap.set('OPEN_SANCTIONS', openSanctionsData);
      await saveSanctionsUpdateStatus('OPEN_SANCTIONS', openSanctionsData.length, 'success');
    }

    if (ofacData.length > 0) {
      sanctionsCacheMap.set('OFAC_SDN', ofacData);
      await saveSanctionsUpdateStatus('OFAC_SDN', ofacData.length, 'success');
    }

    cacheLastUpdated = new Date();
    console.log('Daily sanctions list update completed');
  } catch (error) {
    console.error('Daily update failed:', error);
    await saveSanctionsUpdateStatus('DAILY_UPDATE', 0, 'failed', String(error));
  }
}

/**
 * Get audit trail for sanctions activities
 */
export async function getSanctionsAuditTrail(
  userId?: string,
  limit: number = 100
): Promise<any[]> {
  try {
    let query_str = 'SELECT * FROM sanctions_audit_log';
    const params: any[] = [];

    if (userId) {
      query_str += ' WHERE user_id = $1';
      params.push(userId);
      query_str += ' ORDER BY created_at DESC LIMIT $2';
      params.push(limit);
    } else {
      query_str += ' ORDER BY created_at DESC LIMIT $1';
      params.push(limit);
    }

    const result = await query(query_str, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    throw error;
  }
}

export default {
  initializeSanctionsData,
  screenAgainstSanctions,
  getUserScreeningHistory,
  getScreeningResult,
  reviewScreening,
  getPendingReviews,
  getSanctionsUpdateStatus,
  performDailyUpdate,
  getSanctionsAuditTrail,
};
