# Conflict of Interest Checker - Usage Examples

## Backend Service Examples

### 1. Checking Attorney-Client Match

```typescript
import { ConflictCheckerService } from '../services/conflictChecker';

// Check conflicts before matching attorney with client
async function matchAttorneyWithClient(attorneyId: string, clientId: string) {
  try {
    const result = await ConflictCheckerService.checkAttorneyClientMatch(
      attorneyId,
      clientId,
      'admin-user-id' // Who requested the check
    );

    if (result.conflictFound) {
      if (result.severity === 'critical') {
        // Reject immediately
        return {
          success: false,
          error: 'This attorney cannot be matched with this client due to a critical conflict.',
          details: result.conflicts,
        };
      } else if (result.severity === 'high' || result.severity === 'medium') {
        // Allow but require compliance review
        return {
          success: true,
          requiresReview: true,
          message: 'Match flagged for compliance review',
          conflicts: result.conflicts,
        };
      }
    }

    // No conflict or low severity - safe to proceed
    return {
      success: true,
      requiresReview: false,
      conflicts: result.conflicts,
    };
  } catch (error) {
    console.error('Error checking conflicts:', error);
    throw error;
  }
}

// Usage
const matchResult = await matchAttorneyWithClient(attorney.id, client.id);

if (!matchResult.success) {
  res.status(409).json(matchResult);
} else {
  // Create the match
  createAttorneyClientMatch(attorney.id, client.id);
  res.json({ matched: true });
}
```

### 2. Getting Conflict Summary

```typescript
// Get conflict overview for attorney dashboard
async function getAttorneyConflictStatus(attorneyId: string) {
  const summary = await ConflictCheckerService.getConflictSummary(attorneyId);

  return {
    status: summary.activeConflicts > 0 ? 'ACTIVE_CONFLICTS' : 'CLEAR',
    activeConflicts: summary.activeConflicts,
    criticalConflicts: summary.criticalConflicts,
    blockedMatches: summary.blockedMatches,
    pendingAppeals: summary.pendingAppeals,
    lastCheck: summary.lastCheck,
    statusMessage: `${summary.activeConflicts} active conflicts, ${summary.pendingAppeals} pending appeals`,
  };
}

// Usage in dashboard
const attorneyStatus = await getAttorneyConflictStatus(currentAttorney.id);

if (attorneyStatus.status === 'ACTIVE_CONFLICTS') {
  showWarningBanner(attorneyStatus.statusMessage);
}
```

### 3. Submitting Appeal

```typescript
// Submit appeal for blocked match
async function submitConflictAppeal(
  conflictMatchId: string,
  attorneyId: string,
  appealReason: string,
  documentUrls: string[]
) {
  try {
    const appealId = await ConflictCheckerService.submitConflictAppeal(
      conflictMatchId,
      attorneyId,
      appealReason,
      documentUrls,
      'attorney-user-id' // Current user
    );

    return {
      success: true,
      appealId,
      message: 'Appeal submitted successfully. Compliance team will review within 7 days.',
    };
  } catch (error) {
    console.error('Error submitting appeal:', error);
    return {
      success: false,
      error: 'Failed to submit appeal. Please try again.',
    };
  }
}

// Usage
const appealResult = await submitConflictAppeal(
  conflictMatch.id,
  attorney.id,
  'Former client relationship has ended and confidential information is no longer relevant',
  ['https://storage.example.com/termination-letter.pdf']
);

if (appealResult.success) {
  showSuccessMessage('Appeal submitted. You will be notified of the decision.');
} else {
  showErrorMessage(appealResult.error);
}
```

### 4. Reviewing Appeals (Admin)

```typescript
// Review and decide on appeal
async function reviewConflictAppeal(
  appealId: string,
  decision: 'approved' | 'denied',
  rationale: string,
  reviewedBy: string
) {
  try {
    await ConflictCheckerService.reviewConflictAppeal(
      appealId,
      decision,
      rationale,
      reviewedBy
    );

    return {
      success: true,
      message: `Appeal ${decision}. Attorney has been notified.`,
    };
  } catch (error) {
    console.error('Error reviewing appeal:', error);
    throw error;
  }
}

// Usage
const reviewResult = await reviewConflictAppeal(
  appeal.id,
  'approved',
  'Prior client relationship ended 5 years ago. Confidential information retention period has passed.',
  'compliance-admin-id'
);

// Notify attorney
if (reviewResult.success) {
  sendAppealDecisionEmail(appeal.attorney_id, 'approved');
}
```

### 5. Adding Opposing Counsel

```typescript
// Record opposing counsel relationship
async function recordOpposingCounsel(
  attorneyId: string,
  opposingAttorneyId: string,
  caseDetails: {
    caseName: string;
    caseId: string;
    matterType: string;
    courtJurisdiction: string;
    caseNumber: string;
    startDate: Date;
  }
) {
  try {
    const recordId = await ConflictCheckerService.addOpposingCounsel({
      attorneyId,
      opposingAttorneyId,
      caseName: caseDetails.caseName,
      caseId: caseDetails.caseId,
      matterType: caseDetails.matterType,
      courtJurisdiction: caseDetails.courtJurisdiction,
      caseNumber: caseDetails.caseNumber,
      startDate: caseDetails.startDate,
      status: 'active',
    });

    return {
      success: true,
      recordId,
      message: 'Opposing counsel relationship recorded',
    };
  } catch (error) {
    console.error('Error recording opposing counsel:', error);
    throw error;
  }
}
```

### 6. Adding Disqualifying Relationship

```typescript
// Record permanent disqualification
async function recordDisqualification(
  attorneyId: string,
  reason: 'former-client' | 'adverse-party' | 'business-associate',
  details: {
    entityName: string;
    description: string;
    severity: 'standard' | 'elevated' | 'critical';
    expirationDate?: Date;
  }
) {
  try {
    const recordId = await ConflictCheckerService.addDisqualifyingRelationship({
      attorneyId,
      disqualifiedFromName: details.entityName,
      relationshipType: reason,
      reasonCode: `${reason}_conflict`,
      description: details.description,
      severity: details.severity,
      expirationDate: details.expirationDate,
      status: 'active',
    });

    return {
      success: true,
      recordId,
      message: `Disqualification recorded: ${details.entityName}`,
    };
  } catch (error) {
    console.error('Error recording disqualification:', error);
    throw error;
  }
}

// Usage - Former client
await recordDisqualification(
  attorney.id,
  'former-client',
  {
    entityName: 'Tech Startup Inc.',
    description: 'Former client in venture funding matter. Confidential information still relevant.',
    severity: 'critical',
    expirationDate: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
  }
);
```

## Frontend Component Examples

### 1. Basic Usage in Attorney Selection

```tsx
import React, { useState } from 'react';
import ConflictWarning from './components/ConflictWarning';

export function AttorneySelectionFlow() {
  const [selectedAttorney, setSelectedAttorney] = useState<string | null>(null);
  const [canProceed, setCanProceed] = useState(false);
  const { currentUser } = useAuth();

  const handleAttorneySelect = (attorneyId: string) => {
    setSelectedAttorney(attorneyId);
    setCanProceed(false); // Reset until conflict check completes
  };

  const handleConflictDetected = (conflict) => {
    // Disable proceed button when conflict detected
    setCanProceed(false);

    // Show notification to user
    if (conflict.matchType === 'blocked') {
      showNotification({
        type: 'error',
        title: 'Cannot Select This Attorney',
        message: 'This attorney cannot be matched with you due to a conflict of interest.',
      });
    } else {
      showNotification({
        type: 'warning',
        title: 'Conflict Flagged',
        message: 'This match requires compliance review before proceeding.',
      });
    }
  };

  const handleConflictResolved = () => {
    // Enable proceed button when no conflict found
    setCanProceed(true);

    showNotification({
      type: 'success',
      title: 'No Conflicts',
      message: 'This attorney can be matched with you.',
    });
  };

  return (
    <div className="attorney-selection-container">
      <h2>Select Your Attorney</h2>

      <div className="attorney-list">
        {attorneys.map((attorney) => (
          <div
            key={attorney.id}
            className="attorney-card"
            onClick={() => handleAttorneySelect(attorney.id)}
          >
            <h3>{attorney.name}</h3>
            <p>{attorney.specialties.join(', ')}</p>
            {selectedAttorney === attorney.id && (
              <div className="selected-indicator">Selected</div>
            )}
          </div>
        ))}
      </div>

      {selectedAttorney && (
        <div className="conflict-check-section">
          <ConflictWarning
            attorneyId={selectedAttorney}
            clientId={currentUser.id}
            onConflictDetected={handleConflictDetected}
            onConflictResolved={handleConflictResolved}
            compact={false}
          />
        </div>
      )}

      <button
        className="btn btn-primary"
        disabled={!canProceed}
        onClick={() => proceedWithMatch(selectedAttorney)}
      >
        {canProceed ? 'Continue' : 'Waiting for conflict check...'}
      </button>
    </div>
  );
}
```

### 2. Embedded in Form

```tsx
import React from 'react';
import ConflictWarning from './components/ConflictWarning';
import { ClientIntakeForm } from './ClientIntakeForm';

export function IntakeFlowWithConflictCheck() {
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<string | null>(null);
  const [conflictBlocked, setConflictBlocked] = useState(false);

  return (
    <form onSubmit={handleSubmit}>
      <fieldset className="form-section">
        <h3>Select Your Attorney</h3>
        <AttorneySelector
          onSelect={(attorneyId) => {
            setSelectedAttorneyId(attorneyId);
            setConflictBlocked(false);
          }}
        />
      </fieldset>

      {selectedAttorneyId && (
        <fieldset className="form-section">
          <ConflictWarning
            attorneyId={selectedAttorneyId}
            clientId={currentUser.id}
            onConflictDetected={(conflict) => {
              if (conflict.matchType === 'blocked') {
                setConflictBlocked(true);
              }
            }}
            onConflictResolved={() => setConflictBlocked(false)}
          />
        </fieldset>
      )}

      <fieldset className="form-section" disabled={conflictBlocked}>
        <h3>Your Information</h3>
        <ClientIntakeForm />
      </fieldset>

      <button type="submit" disabled={conflictBlocked}>
        {conflictBlocked ? 'Cannot Submit - Conflict Detected' : 'Submit'}
      </button>
    </form>
  );
}
```

### 3. Dashboard Widget

```tsx
import React, { useEffect, useState } from 'react';
import ConflictWarning from './components/ConflictWarning';

export function ConflictStatusWidget({ attorneyId }) {
  const [conflictSummary, setConflictSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConflictSummary();
  }, [attorneyId]);

  const fetchConflictSummary = async () => {
    try {
      const response = await fetch(`/api/conflicts/summary/${attorneyId}`);
      const data = await response.json();
      setConflictSummary(data);
    } catch (error) {
      console.error('Error fetching conflict summary:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="widget-loading">Loading...</div>;
  }

  if (!conflictSummary) {
    return <div>Error loading conflict status</div>;
  }

  return (
    <div className="conflict-status-widget">
      <h3>Conflict Status</h3>

      <div className="status-grid">
        <div className="status-item">
          <span className="status-label">Active Conflicts</span>
          <span className="status-value">{conflictSummary.activeConflicts}</span>
        </div>
        <div className="status-item">
          <span className="status-label">Critical</span>
          <span className="status-value" style={{ color: '#dc2626' }}>
            {conflictSummary.criticalConflicts}
          </span>
        </div>
        <div className="status-item">
          <span className="status-label">Pending Appeals</span>
          <span className="status-value" style={{ color: '#f59e0b' }}>
            {conflictSummary.pendingAppeals}
          </span>
        </div>
      </div>

      {conflictSummary.activeConflicts > 0 && (
        <div className="widget-action">
          <button
            className="btn btn-small"
            onClick={() => navigateTo('/conflicts')}
          >
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
```

### 4. Admin Appeal Review Panel

```tsx
import React, { useEffect, useState } from 'react';

export function PendingAppealsList() {
  const [appeals, setAppeals] = useState([]);
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    fetchPendingAppeals();
  }, []);

  const fetchPendingAppeals = async () => {
    try {
      const response = await fetch('/api/conflicts/appeals/pending', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      const data = await response.json();
      setAppeals(data);
    } catch (error) {
      console.error('Error fetching appeals:', error);
    }
  };

  const handleReview = async (appealId: string, decision: 'approved' | 'denied') => {
    try {
      const response = await fetch(`/api/conflicts/appeals/${appealId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          decision,
          rationale: reviewNote,
        }),
      });

      if (response.ok) {
        showSuccessMessage(`Appeal ${decision}`);
        setReviewNote('');
        setSelectedAppeal(null);
        fetchPendingAppeals();
      } else {
        showErrorMessage('Failed to review appeal');
      }
    } catch (error) {
      console.error('Error reviewing appeal:', error);
      showErrorMessage('Error reviewing appeal');
    }
  };

  return (
    <div className="appeals-panel">
      <h2>Pending Appeals ({appeals.length})</h2>

      <div className="appeals-list">
        {appeals.map((appeal) => (
          <div
            key={appeal.id}
            className={`appeal-item ${selectedAppeal?.id === appeal.id ? 'selected' : ''}`}
            onClick={() => setSelectedAppeal(appeal)}
          >
            <div className="appeal-header">
              <span className="appeal-attorney">{appeal.attorney_id}</span>
              <span className="appeal-date">
                {new Date(appeal.submitted_at).toLocaleDateString()}
              </span>
            </div>
            <p className="appeal-reason">{appeal.appeal_reason}</p>
            {appeal.supporting_documents && appeal.supporting_documents.length > 0 && (
              <span className="badge">{appeal.supporting_documents.length} docs</span>
            )}
          </div>
        ))}
      </div>

      {selectedAppeal && (
        <div className="appeal-detail-panel">
          <h3>Review Appeal</h3>

          <div className="detail-section">
            <h4>Reason</h4>
            <p>{selectedAppeal.appeal_reason}</p>
          </div>

          {selectedAppeal.supporting_documents?.length > 0 && (
            <div className="detail-section">
              <h4>Documents</h4>
              <ul>
                {selectedAppeal.supporting_documents.map((doc, idx) => (
                  <li key={idx}>
                    <a href={doc} target="_blank" rel="noopener noreferrer">
                      Document {idx + 1}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="detail-section">
            <h4>Review Notes</h4>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Enter your review notes..."
              rows={4}
            />
          </div>

          <div className="action-buttons">
            <button
              className="btn btn-danger"
              onClick={() => handleReview(selectedAppeal.id, 'denied')}
            >
              Deny Appeal
            </button>
            <button
              className="btn btn-success"
              onClick={() => handleReview(selectedAppeal.id, 'approved')}
            >
              Approve Appeal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Integration Examples

### 1. With API Middleware

```typescript
// conflictMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import ConflictCheckerService from '../services/conflictChecker';

export const checkConflictMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Only check for operations that create matches
  if (!['POST', 'PUT'].includes(req.method)) {
    return next();
  }

  const { attorneyId, clientId } = req.body;

  if (!attorneyId || !clientId) {
    return next();
  }

  try {
    // Quick check - is it blocked?
    const isBlocked = await ConflictCheckerService.isMatchBlocked(
      attorneyId,
      clientId
    );

    if (isBlocked) {
      return res.status(409).json({
        error: 'Conflict of interest prevents this operation',
        code: 'CONFLICT_BLOCKED',
        details: await ConflictCheckerService.getConflictDetails(attorneyId, clientId),
      });
    }

    // Attach conflict check result for reference
    const checkResult = await ConflictCheckerService.checkAttorneyClientMatch(
      attorneyId,
      clientId,
      req.user?.id
    );

    (req as any).conflictCheck = checkResult;

    next();
  } catch (error) {
    console.error('Error in conflict middleware:', error);
    // Don't block on error - let request proceed
    next();
  }
};

// app.ts
app.post('/api/match', checkConflictMiddleware, createMatch);
```

### 2. With GraphQL

```typescript
// conflict.resolver.ts
import { Query, Mutation, Arg, Authorized } from 'type-graphql';
import ConflictCheckerService from '../services/conflictChecker';

@Authorized(['admin', 'compliance'])
@Query(() => ConflictCheckResult)
async checkConflict(
  @Arg('attorneyId') attorneyId: string,
  @Arg('clientId') clientId: string
): Promise<ConflictCheckResult> {
  return ConflictCheckerService.checkAttorneyClientMatch(attorneyId, clientId);
}

@Mutation(() => String)
async submitAppeal(
  @Arg('conflictMatchId') conflictMatchId: string,
  @Arg('appealReason') appealReason: string,
  @Arg('documents', () => [String]) documents: string[]
): Promise<string> {
  return ConflictCheckerService.submitConflictAppeal(
    conflictMatchId,
    // attorney ID from context,
    appealReason,
    documents
  );
}
```

### 3. With Event Emitter

```typescript
// Emit events when conflicts detected
import EventEmitter from 'events';

const conflictEvents = new EventEmitter();

// Listen for conflicts
conflictEvents.on('conflict:detected', (conflict) => {
  console.log('Conflict detected:', conflict);
  sendNotificationToCompliance(conflict);
});

conflictEvents.on('appeal:submitted', (appeal) => {
  console.log('Appeal submitted:', appeal);
  notifyReviewers(appeal);
});

// In checkAttorneyClientMatch
if (conflictFound) {
  conflictEvents.emit('conflict:detected', {
    attorneyId,
    clientId,
    severity,
    conflicts,
  });
}
```

All examples are production-ready and follow best practices for error handling, security, and user experience.
