/**
 * Conflict of Interest Checker Service
 *
 * Features:
 * - Checks attorney against opposing counsel list
 * - Validates prior representations
 * - Detects family connections with conflict potential
 * - Identifies disqualifying relationships
 * - Auto-checks before attorney-client match
 * - Blocks matches if conflict found
 * - Flags potential conflicts for review
 * - Maintains conflict database
 * - Logs all conflict checks
 * - Provides appeal process
 */

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { auditLogger } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface OpposingCounsel {
  id: string;
  attorneyId: string;
  opposingAttorneyId?: string;
  caseId: string;
  caseName: string;
  matterType: string;
  courtJurisdiction: string;
  caseNumber: string;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'closed' | 'settled' | 'dismissed';
  notes?: string;
}

export interface PriorRepresentation {
  id: string;
  attorneyId: string;
  clientId?: string;
  clientName: string;
  caseType: string;
  caseDescription: string;
  caseOutcome?: 'won' | 'lost' | 'settled' | 'dismissed';
  representationStart: Date;
  representationEnd?: Date;
  conflictPotential: boolean;
}

export interface FamilyConnection {
  id: string;
  attorneyId: string;
  relatedPersonId?: string;
  relatedPersonName: string;
  relationshipType: string;
  relationshipStatus: 'current' | 'former' | 'estranged';
  potentialConflict: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  notes?: string;
}

export interface DisqualifyingRelationship {
  id: string;
  attorneyId: string;
  disqualifiedFromId?: string;
  disqualifiedFromName: string;
  relationshipType: string;
  reasonCode: string;
  description: string;
  severity: 'standard' | 'elevated' | 'critical';
  expirationDate?: Date;
  status: 'active' | 'inactive' | 'appealed' | 'expired';
}

export interface ConflictCheck {
  id: string;
  attorneyId: string;
  clientId?: string;
  checkType: string;
  conflictFound: boolean;
  conflictSeverity?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  conflictsIdentified: ConflictDetail[];
  checkStatus: 'completed' | 'under-review' | 'appealed' | 'resolved';
  requestedBy?: string;
  checkedAt: Date;
  notes?: string;
}

export interface ConflictDetail {
  type: string;
  severity: string;
  description: string;
  source?: string;
  resolutionPath?: string;
}

export interface ConflictMatch {
  id: string;
  attorneyId: string;
  clientId: string;
  conflictCheckId: string;
  matchType: 'blocked' | 'flagged-for-review' | 'pending-appeal';
  conflictDetails: ConflictDetail[];
  blockReason: string;
  blockedAt: Date;
  blocksUntil?: Date;
  metadata?: Record<string, any>;
}

export interface ConflictAppeal {
  id: string;
  conflictMatchId: string;
  attorneyId: string;
  appealStatus: 'pending' | 'under-review' | 'approved' | 'denied' | 'withdrawn';
  appealReason: string;
  supportingDocuments?: string[];
  submittedBy: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  decision?: string;
  decisionRationale?: string;
}

export interface ConflictCheckResult {
  conflictFound: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  conflicts: ConflictDetail[];
  recommendedAction: 'allow' | 'review' | 'block';
  blockedUntil?: Date;
}

export interface ConflictSummary {
  totalConflicts: number;
  activeConflicts: number;
  criticalConflicts: number;
  blockedMatches: number;
  pendingAppeals: number;
  lastCheck?: Date;
}

// ============================================
// CONFLICT CHECKER SERVICE
// ============================================

export class ConflictCheckerService {
  /**
   * Comprehensive conflict check for attorney-client match
   */
  static async checkAttorneyClientMatch(
    attorneyId: string,
    clientId: string,
    requestedBy?: string
  ): Promise<ConflictCheckResult> {
    try {
      // Run parallel conflict checks
      const [
        opposingCounselConflict,
        priorRepresentationConflict,
        familyConnectionConflict,
        disqualifyingRelationshipConflict,
      ] = await Promise.all([
        this.checkOpposingCounsel(attorneyId, clientId),
        this.checkPriorRepresentations(attorneyId, clientId),
        this.checkFamilyConnections(attorneyId, clientId),
        this.checkDisqualifyingRelationships(attorneyId, clientId),
      ]);

      // Aggregate results
      const conflicts: ConflictDetail[] = [];
      let severity: 'none' | 'low' | 'medium' | 'high' | 'critical' = 'none';

      if (opposingCounselConflict) {
        conflicts.push(opposingCounselConflict);
        severity = this.determineSeverity(severity, 'high');
      }

      if (priorRepresentationConflict) {
        conflicts.push(priorRepresentationConflict);
        severity = this.determineSeverity(severity, 'medium');
      }

      if (familyConnectionConflict) {
        conflicts.push(familyConnectionConflict);
        severity = this.determineSeverity(severity, 'medium');
      }

      if (disqualifyingRelationshipConflict) {
        conflicts.push(disqualifyingRelationshipConflict);
        severity = this.determineSeverity(severity, 'critical');
      }

      const conflictFound = conflicts.length > 0;
      const recommendedAction = conflictFound
        ? severity === 'critical'
          ? 'block'
          : 'review'
        : 'allow';

      // Record the check
      const checkId = await this.recordConflictCheck(
        attorneyId,
        clientId,
        'attorney-client-match',
        conflictFound,
        severity,
        conflicts,
        requestedBy
      );

      // Create block if needed
      if (conflictFound) {
        await this.createConflictMatch(
          attorneyId,
          clientId,
          checkId,
          severity === 'critical' ? 'blocked' : 'flagged-for-review',
          conflicts
        );
      }

      // Log audit trail
      await auditLogger.log({
        userId: requestedBy || attorneyId,
        action: 'conflict_check',
        entityType: 'conflict_match',
        entityId: checkId,
        status: conflictFound ? 'failure' : 'success',
        changes: {
          before: {},
          after: { conflictFound, severity, conflicts },
          fields_modified: ['conflict_status'],
        },
        metadata: {
          attorneyId,
          clientId,
          severity,
          conflicts: conflicts.length,
        },
      });

      return {
        conflictFound,
        severity,
        conflicts,
        recommendedAction,
      };
    } catch (error) {
      console.error('Error checking attorney-client conflict:', error);
      throw error;
    }
  }

  /**
   * Check against opposing counsel list
   */
  private static async checkOpposingCounsel(
    attorneyId: string,
    clientId: string
  ): Promise<ConflictDetail | null> {
    try {
      const result = await query(
        `
        SELECT oc.* FROM opposing_counsel oc
        WHERE (oc.attorney_id = $1 OR oc.opposing_attorney_id = $1)
        AND oc.status = 'active'
        AND (
          SELECT COUNT(*) FROM opposing_counsel
          WHERE attorney_id = $1
          AND opposing_attorney_id = $2
        ) > 0
        LIMIT 1
        `,
        [attorneyId, clientId]
      );

      if (result.rows.length > 0) {
        const record = result.rows[0];
        return {
          type: 'opposing_counsel',
          severity: 'high',
          description: `Attorney previously opposed in case: ${record.case_name} (${record.case_number})`,
          source: record.case_id,
          resolutionPath: 'appeal_process',
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking opposing counsel:', error);
      return null;
    }
  }

  /**
   * Check prior representations for conflicts
   */
  private static async checkPriorRepresentations(
    attorneyId: string,
    clientId: string
  ): Promise<ConflictDetail | null> {
    try {
      const result = await query(
        `
        SELECT pr.* FROM prior_representations pr
        WHERE pr.attorney_id = $1
        AND pr.conflict_potential = TRUE
        AND pr.representation_end > (NOW() - INTERVAL '7 years')
        LIMIT 1
        `,
        [attorneyId]
      );

      if (result.rows.length > 0) {
        const record = result.rows[0];
        return {
          type: 'prior_representation',
          severity: 'medium',
          description: `Prior representation may create conflict: ${record.client_name} (${record.case_type})`,
          source: record.id,
          resolutionPath: 'review_process',
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking prior representations:', error);
      return null;
    }
  }

  /**
   * Check family connections for conflicts
   */
  private static async checkFamilyConnections(
    attorneyId: string,
    clientId: string
  ): Promise<ConflictDetail | null> {
    try {
      const result = await query(
        `
        SELECT fc.* FROM family_connections fc
        WHERE (fc.attorney_id = $1 OR fc.related_person_id = $1)
        AND fc.potential_conflict = TRUE
        AND fc.relationship_status IN ('current', 'former')
        LIMIT 1
        `,
        [attorneyId]
      );

      if (result.rows.length > 0) {
        const record = result.rows[0];
        return {
          type: 'family_connection',
          severity: 'medium',
          description: `Family relationship may create conflict: ${record.relationship_type} - ${record.related_person_name}`,
          source: record.id,
          resolutionPath: 'disclosure_review',
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking family connections:', error);
      return null;
    }
  }

  /**
   * Check disqualifying relationships
   */
  private static async checkDisqualifyingRelationships(
    attorneyId: string,
    clientId: string
  ): Promise<ConflictDetail | null> {
    try {
      const result = await query(
        `
        SELECT dr.* FROM disqualifying_relationships dr
        WHERE dr.attorney_id = $1
        AND (dr.disqualified_from_id = $2 OR dr.disqualified_from_id IS NULL)
        AND dr.status = 'active'
        AND (dr.expiration_date IS NULL OR dr.expiration_date > NOW())
        LIMIT 1
        `,
        [attorneyId, clientId]
      );

      if (result.rows.length > 0) {
        const record = result.rows[0];
        return {
          type: 'disqualifying_relationship',
          severity: record.severity,
          description: `Disqualifying relationship: ${record.relationship_type} - ${record.description}`,
          source: record.id,
          resolutionPath:
            record.severity === 'critical'
              ? 'escalation_required'
              : 'appeal_process',
        };
      }

      return null;
    } catch (error) {
      console.error('Error checking disqualifying relationships:', error);
      return null;
    }
  }

  /**
   * Record conflict check in database
   */
  private static async recordConflictCheck(
    attorneyId: string,
    clientId: string,
    checkType: string,
    conflictFound: boolean,
    severity: string,
    conflicts: ConflictDetail[],
    requestedBy?: string
  ): Promise<string> {
    const checkId = uuidv4();

    await query(
      `
      INSERT INTO conflict_checks (
        id,
        attorney_id,
        client_id,
        check_type,
        conflict_found,
        conflict_severity,
        conflicts_identified,
        check_status,
        requested_by,
        checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `,
      [
        checkId,
        attorneyId,
        clientId,
        checkType,
        conflictFound,
        severity,
        JSON.stringify(conflicts),
        'completed',
        requestedBy || null,
      ]
    );

    return checkId;
  }

  /**
   * Create conflict match record (block or flag)
   */
  private static async createConflictMatch(
    attorneyId: string,
    clientId: string,
    checkId: string,
    matchType: 'blocked' | 'flagged-for-review' | 'pending-appeal',
    conflicts: ConflictDetail[]
  ): Promise<string> {
    const matchId = uuidv4();
    const blockedUntil =
      matchType === 'blocked'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null; // 30 days default

    await query(
      `
      INSERT INTO conflict_matches (
        id,
        attorney_id,
        client_id,
        conflict_check_id,
        match_type,
        conflict_details,
        block_reason,
        blocks_until
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (attorney_id, client_id) DO UPDATE
      SET
        conflict_check_id = $4,
        conflict_details = $6,
        updated_at = NOW()
      `,
      [
        matchId,
        attorneyId,
        clientId,
        checkId,
        matchType,
        JSON.stringify(conflicts),
        `Conflict detected: ${conflicts.map((c) => c.type).join(', ')}`,
        blockedUntil,
      ]
    );

    return matchId;
  }

  /**
   * Check if attorney-client match is blocked
   */
  static async isMatchBlocked(attorneyId: string, clientId: string): Promise<boolean> {
    try {
      const result = await query(
        `
        SELECT id FROM conflict_matches
        WHERE attorney_id = $1
        AND client_id = $2
        AND match_type = 'blocked'
        AND (blocks_until IS NULL OR blocks_until > NOW())
        LIMIT 1
        `,
        [attorneyId, clientId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking if match is blocked:', error);
      return false;
    }
  }

  /**
   * Get conflict details for attorney-client pair
   */
  static async getConflictDetails(
    attorneyId: string,
    clientId: string
  ): Promise<ConflictMatch | null> {
    try {
      const result = await query(
        `
        SELECT * FROM conflict_matches
        WHERE attorney_id = $1
        AND client_id = $2
        LIMIT 1
        `,
        [attorneyId, clientId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        attorneyId: row.attorney_id,
        clientId: row.client_id,
        conflictCheckId: row.conflict_check_id,
        matchType: row.match_type,
        conflictDetails: JSON.parse(row.conflict_details),
        blockReason: row.block_reason,
        blockedAt: new Date(row.blocked_at),
        blocksUntil: row.blocks_until ? new Date(row.blocks_until) : undefined,
        metadata: row.metadata,
      };
    } catch (error) {
      console.error('Error getting conflict details:', error);
      return null;
    }
  }

  /**
   * Submit conflict appeal
   */
  static async submitConflictAppeal(
    conflictMatchId: string,
    attorneyId: string,
    appealReason: string,
    supportingDocuments?: string[],
    submittedBy?: string
  ): Promise<string> {
    const appealId = uuidv4();

    try {
      await query(
        `
        INSERT INTO conflict_appeals (
          id,
          conflict_match_id,
          attorney_id,
          appeal_reason,
          supporting_documents,
          submitted_by,
          appeal_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          appealId,
          conflictMatchId,
          attorneyId,
          appealReason,
          JSON.stringify(supportingDocuments || []),
          submittedBy || attorneyId,
          'pending',
        ]
      );

      // Update conflict match status
      await query(
        `
        UPDATE conflict_matches
        SET match_type = 'pending-appeal', updated_at = NOW()
        WHERE id = $1
        `,
        [conflictMatchId]
      );

      return appealId;
    } catch (error) {
      console.error('Error submitting conflict appeal:', error);
      throw error;
    }
  }

  /**
   * Get pending appeals
   */
  static async getPendingAppeals(): Promise<ConflictAppeal[]> {
    try {
      const result = await query(
        `
        SELECT * FROM conflict_appeals
        WHERE appeal_status IN ('pending', 'under-review')
        ORDER BY submitted_at ASC
        `
      );

      return result.rows.map((row) => ({
        id: row.id,
        conflictMatchId: row.conflict_match_id,
        attorneyId: row.attorney_id,
        appealStatus: row.appeal_status,
        appealReason: row.appeal_reason,
        supportingDocuments: JSON.parse(row.supporting_documents || '[]'),
        submittedBy: row.submitted_by,
        submittedAt: new Date(row.submitted_at),
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
        reviewNotes: row.review_notes,
        decision: row.decision,
        decisionRationale: row.decision_rationale,
      }));
    } catch (error) {
      console.error('Error getting pending appeals:', error);
      throw error;
    }
  }

  /**
   * Review conflict appeal
   */
  static async reviewConflictAppeal(
    appealId: string,
    decision: 'approved' | 'denied',
    rationale: string,
    reviewedBy: string
  ): Promise<void> {
    try {
      const appeal = await query(
        `
        SELECT * FROM conflict_appeals WHERE id = $1
        `,
        [appealId]
      );

      if (appeal.rows.length === 0) {
        throw new Error('Appeal not found');
      }

      const appealData = appeal.rows[0];

      // Update appeal
      await query(
        `
        UPDATE conflict_appeals
        SET
          appeal_status = $1,
          decision = $2,
          decision_rationale = $3,
          reviewed_by = $4,
          reviewed_at = NOW()
        WHERE id = $5
        `,
        [
          decision === 'approved' ? 'approved' : 'denied',
          decision,
          rationale,
          reviewedBy,
          appealId,
        ]
      );

      // If approved, update conflict match
      if (decision === 'approved') {
        await query(
          `
          UPDATE conflict_matches
          SET match_type = 'pending-appeal', updated_at = NOW()
          WHERE id = $1
          `,
          [appealData.conflict_match_id]
        );
      }

      // Log audit
      await auditLogger.log({
        userId: reviewedBy,
        action: decision === 'approved' ? 'appeal_approved' : 'appeal_denied',
        entityType: 'conflict_appeal',
        entityId: appealId,
        status: 'success',
        changes: {
          before: { status: 'pending' },
          after: { status: decision === 'approved' ? 'approved' : 'denied' },
          fields_modified: ['appeal_status'],
        },
        metadata: {
          attorneyId: appealData.attorney_id,
          rationale,
        },
      });
    } catch (error) {
      console.error('Error reviewing conflict appeal:', error);
      throw error;
    }
  }

  /**
   * Add opposing counsel
   */
  static async addOpposingCounsel(opposing: Partial<OpposingCounsel>): Promise<string> {
    const id = uuidv4();

    try {
      await query(
        `
        INSERT INTO opposing_counsel (
          id,
          attorney_id,
          opposing_attorney_id,
          case_id,
          case_name,
          matter_type,
          court_jurisdiction,
          case_number,
          start_date,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          id,
          opposing.attorneyId,
          opposing.opposingAttorneyId,
          opposing.caseId,
          opposing.caseName,
          opposing.matterType,
          opposing.courtJurisdiction,
          opposing.caseNumber,
          opposing.startDate,
          opposing.status || 'active',
        ]
      );

      return id;
    } catch (error) {
      console.error('Error adding opposing counsel:', error);
      throw error;
    }
  }

  /**
   * Add family connection
   */
  static async addFamilyConnection(connection: Partial<FamilyConnection>): Promise<string> {
    const id = uuidv4();

    try {
      await query(
        `
        INSERT INTO family_connections (
          id,
          attorney_id,
          related_person_id,
          related_person_name,
          relationship_type,
          relationship_status,
          potential_conflict
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          id,
          connection.attorneyId,
          connection.relatedPersonId,
          connection.relatedPersonName,
          connection.relationshipType,
          connection.relationshipStatus || 'current',
          connection.potentialConflict || false,
        ]
      );

      return id;
    } catch (error) {
      console.error('Error adding family connection:', error);
      throw error;
    }
  }

  /**
   * Add disqualifying relationship
   */
  static async addDisqualifyingRelationship(
    relationship: Partial<DisqualifyingRelationship>
  ): Promise<string> {
    const id = uuidv4();

    try {
      await query(
        `
        INSERT INTO disqualifying_relationships (
          id,
          attorney_id,
          disqualified_from_id,
          disqualified_from_name,
          relationship_type,
          reason_code,
          description,
          severity,
          expiration_date,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          id,
          relationship.attorneyId,
          relationship.disqualifiedFromId,
          relationship.disqualifiedFromName,
          relationship.relationshipType,
          relationship.reasonCode,
          relationship.description,
          relationship.severity || 'standard',
          relationship.expirationDate,
          relationship.status || 'active',
        ]
      );

      return id;
    } catch (error) {
      console.error('Error adding disqualifying relationship:', error);
      throw error;
    }
  }

  /**
   * Get conflict summary for attorney
   */
  static async getConflictSummary(attorneyId: string): Promise<ConflictSummary> {
    try {
      const result = await query(
        `
        SELECT * FROM get_conflict_summary($1)
        `,
        [attorneyId]
      );

      if (result.rows.length === 0) {
        return {
          totalConflicts: 0,
          activeConflicts: 0,
          criticalConflicts: 0,
          blockedMatches: 0,
          pendingAppeals: 0,
        };
      }

      const row = result.rows[0];
      return {
        totalConflicts: row.total_conflicts || 0,
        activeConflicts: row.active_conflicts || 0,
        criticalConflicts: row.critical_conflicts || 0,
        blockedMatches: row.blocked_matches || 0,
        pendingAppeals: row.pending_appeals || 0,
        lastCheck: row.last_check ? new Date(row.last_check) : undefined,
      };
    } catch (error) {
      console.error('Error getting conflict summary:', error);
      return {
        totalConflicts: 0,
        activeConflicts: 0,
        criticalConflicts: 0,
        blockedMatches: 0,
        pendingAppeals: 0,
      };
    }
  }

  /**
   * Determine severity level (helper)
   */
  private static determineSeverity(
    current: string,
    proposed: string
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const severity_order = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const current_score = severity_order[current as keyof typeof severity_order] || 0;
    const proposed_score = severity_order[proposed as keyof typeof severity_order] || 0;

    const result_score = Math.max(current_score, proposed_score);
    const severity_keys = Object.keys(severity_order) as Array<
      'none' | 'low' | 'medium' | 'high' | 'critical'
    >;
    return severity_keys[result_score] as 'none' | 'low' | 'medium' | 'high' | 'critical';
  }
}

export default ConflictCheckerService;
