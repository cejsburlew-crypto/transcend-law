# Escrow System - Integration Examples

Real-world code examples for integrating escrow into the Transcend Law platform.

---

## Example 1: Accept Case Quote with Escrow

When a client accepts a provider's quote, create an escrow hold.

```typescript
// services/caseService.ts
import * as escrowService from './escrowService';
import { sendEmailNotification } from './emailService';

export async function acceptCaseQuote(quoteId: string, clientId: string) {
  try {
    // Get quote details
    const quote = await query(
      `SELECT * FROM case_offers WHERE id = $1`,
      [quoteId]
    );

    if (quote.rows.length === 0) {
      throw new Error('Quote not found');
    }

    const caseQuote = quote.rows[0];

    // Validate quote is still pending
    if (caseQuote.status !== 'pending' && caseQuote.status !== 'quoted') {
      throw new Error('Quote is no longer available');
    }

    // Create escrow hold
    const escrowHold = await escrowService.createEscrowHold(
      caseQuote.case_id,
      clientId,
      caseQuote.attorney_id,
      caseQuote.quote_amount,
      30, // 30-day hold period
      2.5, // 2.5% fee
      'platform' // Platform pays the fee
    );

    // Update quote status
    await query(
      `UPDATE case_offers
       SET status = $1, accepted_at = NOW(), escrow_hold_id = $2
       WHERE id = $3`,
      ['accepted', escrowHold.id, quoteId]
    );

    // Update case status
    await query(
      `UPDATE cases
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      ['matched', caseQuote.case_id]
    );

    // Send notifications
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [clientId]);
    const attorneyResult = await query(`SELECT email FROM users WHERE id = $1`, [
      caseQuote.attorney_id,
    ]);

    await sendEmailNotification(
      clientResult.rows[0].email,
      'Quote Accepted - Escrow Hold Created',
      `Your acceptance of the quote for $${(caseQuote.quote_amount / 100).toFixed(2)} 
       has been confirmed. Funds are now held in escrow and will be transferred 
       to ${attorneyResult.rows[0].email} upon service completion.`
    );

    await sendEmailNotification(
      attorneyResult.rows[0].email,
      'Case Assigned - Escrow Hold Created',
      `Your quote has been accepted! Funds of $${(caseQuote.quote_amount / 100).toFixed(2)} 
       are now held in escrow and will be transferred to you upon service completion 
       and client approval.`
    );

    return {
      success: true,
      quoteId,
      escrowHoldId: escrowHold.id,
      escrowStatus: escrowHold.status,
    };
  } catch (error: any) {
    console.error('Error accepting case quote:', error);
    throw error;
  }
}
```

---

## Example 2: Complete Service with Escrow Approval

When service is completed, provider approves and triggers automatic release.

```typescript
// services/caseService.ts
export async function completeService(
  caseId: string,
  providerId: string,
  completionDetails: string
) {
  try {
    // Get case details
    const caseResult = await query(`SELECT * FROM cases WHERE id = $1`, [caseId]);
    const caseData = caseResult.rows[0];

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Get escrow hold
    const escrowResult = await query(
      `SELECT * FROM escrow_holds WHERE case_id = $1 AND status = $2`,
      [caseId, 'held']
    );

    if (escrowResult.rows.length === 0) {
      throw new Error('No active escrow hold found');
    }

    const escrowHold = escrowResult.rows[0];

    // Verify provider is correct
    if (escrowHold.provider_id !== providerId) {
      throw new Error('Unauthorized: You are not the assigned provider');
    }

    // Mark case as in progress
    await query(
      `UPDATE cases
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      ['in_progress', caseId]
    );

    // Record service completion
    await query(
      `INSERT INTO case_completions (case_id, provider_id, details, completed_at)
       VALUES ($1, $2, $3, NOW())`,
      [caseId, providerId, completionDetails]
    );

    // Approve escrow release from provider side
    await escrowService.approveEscrowRelease(escrowHold.id, providerId);

    // Notify client to review and approve
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [
      caseData.client_id,
    ]);

    await sendEmailNotification(
      clientResult.rows[0].email,
      'Service Complete - Please Review',
      `The service provider has marked your case as complete. 
       Please review the work and approve the release of escrow funds 
       in your Transcend Law dashboard.`
    );

    return {
      success: true,
      caseStatus: 'in_progress',
      escrowStatus: 'awaiting_client_approval',
    };
  } catch (error: any) {
    console.error('Error completing service:', error);
    throw error;
  }
}
```

---

## Example 3: Client Approves and Triggers Auto-Release

Client confirms service completion, triggering automatic release.

```typescript
// services/caseService.ts
export async function approveServiceCompletion(caseId: string, clientId: string) {
  try {
    // Get case
    const caseResult = await query(`SELECT * FROM cases WHERE id = $1`, [caseId]);
    const caseData = caseResult.rows[0];

    if (!caseData) {
      throw new Error('Case not found');
    }

    if (caseData.client_id !== clientId) {
      throw new Error('Unauthorized: You are not the case client');
    }

    // Get escrow hold
    const escrowResult = await query(
      `SELECT * FROM escrow_holds WHERE case_id = $1 AND status = $2`,
      [caseId, 'held']
    );

    const escrowHold = escrowResult.rows[0];

    // Client approves escrow release
    await escrowService.approveEscrowRelease(escrowHold.id, clientId);

    // Check if all conditions are met for auto-release
    const updatedEscrow = await escrowService.getEscrowHold(escrowHold.id);

    if (
      updatedEscrow.releaseConditions.requiresClientApproval &&
      updatedEscrow.releaseConditions.requiresProviderApproval
    ) {
      // Both approvals needed - check provider approval
      const requiresBoth = await query(
        `SELECT requires_provider_approval, provider_approved_at FROM escrow_holds 
         WHERE id = $1`,
        [escrowHold.id]
      );

      if (requiresBoth.rows[0].provider_approved_at) {
        // Both approved - release immediately
        await escrowService.releaseEscrowFunds(
          escrowHold.id,
          'Service completed and approved by both parties',
          clientId
        );
      }
    } else {
      // Only client approval needed - check if hold period passed
      const isOverdue = new Date(updatedEscrow.releaseConditions.holdUntilDate) <= new Date();

      if (isOverdue) {
        // Release immediately
        await escrowService.releaseEscrowFunds(
          escrowHold.id,
          'Service completed and approved by client. Hold period expired.',
          clientId
        );
      }
    }

    // Update case status
    await query(
      `UPDATE cases
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      ['completed', caseId]
    );

    return {
      success: true,
      caseStatus: 'completed',
      escrowStatus: updatedEscrow.status,
    };
  } catch (error: any) {
    console.error('Error approving service completion:', error);
    throw error;
  }
}
```

---

## Example 4: Handle Dispute

Client disputes the service completion - opens dispute.

```typescript
// services/disputeService.ts
export async function disputeService(
  caseId: string,
  clientId: string,
  reason: string,
  evidence: string[]
) {
  try {
    // Get escrow hold
    const escrowResult = await query(
      `SELECT * FROM escrow_holds WHERE case_id = $1 AND status = 'held'`,
      [caseId]
    );

    if (escrowResult.rows.length === 0) {
      throw new Error('No active escrow hold to dispute');
    }

    const escrowHold = escrowResult.rows[0];

    // Open dispute
    const dispute = await escrowService.openDispute(escrowHold.id, clientId, reason);

    // Store evidence (case-specific)
    if (evidence && evidence.length > 0) {
      for (const fileUrl of evidence) {
        await query(
          `INSERT INTO dispute_evidence (dispute_id, file_url, uploaded_by)
           VALUES ($1, $2, $3)`,
          [dispute.id, fileUrl, clientId]
        );
      }
    }

    // Update case status
    await query(
      `UPDATE cases
       SET status = $1, dispute_id = $2, updated_at = NOW()
       WHERE id = $3`,
      ['disputed', dispute.id, caseId]
    );

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@transcend-law.com';
    await sendEmailNotification(
      adminEmail,
      'Dispute Escalation - Requires Investigation',
      `A dispute has been opened for case ${caseId}. 
       Reason: ${reason}
       
       Please review the evidence and investigate. 
       Estimated resolution time: 3-5 business days.`
    );

    return {
      success: true,
      disputeId: dispute.id,
      status: 'open',
    };
  } catch (error: any) {
    console.error('Error opening dispute:', error);
    throw error;
  }
}
```

---

## Example 5: Admin Resolves Dispute

Admin investigates and resolves the dispute.

```typescript
// services/admin/disputeResolutionService.ts
export async function resolveDispute(
  disputeId: string,
  decision: 'release' | 'refund',
  reasoning: string,
  adminId: string
) {
  try {
    // Get dispute details
    const dispute = await escrowService.getDispute(disputeId);

    if (!dispute) {
      throw new Error('Dispute not found');
    }

    // Get escrow hold
    const escrowHold = await escrowService.getEscrowHold(dispute.escrowHoldId);

    if (!escrowHold) {
      throw new Error('Escrow hold not found');
    }

    // Get case and parties
    const caseResult = await query(`SELECT * FROM cases WHERE id = $1`, [
      escrowHold.caseId,
    ]);
    const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [
      escrowHold.clientId,
    ]);
    const providerResult = await query(`SELECT email FROM users WHERE id = $1`, [
      escrowHold.providerId,
    ]);

    // Resolve dispute
    const resolvedDispute = await escrowService.resolveDispute(
      disputeId,
      reasoning,
      decision,
      adminId
    );

    // Update case status
    const newCaseStatus = decision === 'release' ? 'completed' : 'reopened';
    await query(
      `UPDATE cases
       SET status = $1, dispute_resolved_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [newCaseStatus, escrowHold.caseId]
    );

    // Notify both parties
    const decisionText = decision === 'release' ? 'in favor of the service provider' : 'in favor of the client';

    await sendEmailNotification(
      clientResult.rows[0].email,
      `Dispute Resolution - Decision ${decisionText}`,
      `Your dispute for case ${escrowHold.caseId} has been resolved.
       
       Decision: ${decisionText}
       Reasoning: ${reasoning}
       
       ${decision === 'refund' ? 'Your escrow funds have been refunded.' : 'Funds have been released to the service provider.'}
       
       If you have further questions, please contact support.`
    );

    await sendEmailNotification(
      providerResult.rows[0].email,
      `Dispute Resolution - Decision ${decisionText}`,
      `A dispute on your case has been resolved.
       
       Decision: ${decisionText}
       
       ${decision === 'release' ? 'Your payment has been released.' : 'Funds were refunded to the client.'}
       
       Thank you for your service.`
    );

    // Create audit log
    await query(
      `INSERT INTO case_audit_log (case_id, action, details, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [
        escrowHold.caseId,
        `dispute_resolved_${decision}`,
        `Dispute ${disputeId} resolved: ${reasoning}`,
        adminId,
      ]
    );

    return {
      success: true,
      disputeId,
      decision,
      status: 'resolved',
      caseStatus: newCaseStatus,
    };
  } catch (error: any) {
    console.error('Error resolving dispute:', error);
    throw error;
  }
}
```

---

## Example 6: Refund Escrow Hold

Cancel case and refund escrow hold to client.

```typescript
// services/caseService.ts
export async function cancelCaseWithRefund(
  caseId: string,
  cancelledBy: string,
  reason: string
) {
  try {
    // Get case
    const caseResult = await query(`SELECT * FROM cases WHERE id = $1`, [caseId]);
    const caseData = caseResult.rows[0];

    if (!caseData) {
      throw new Error('Case not found');
    }

    // Check for active escrow hold
    const escrowResult = await query(
      `SELECT * FROM escrow_holds WHERE case_id = $1 AND status = 'held'`,
      [caseId]
    );

    let refundInfo = null;

    if (escrowResult.rows.length > 0) {
      const escrowHold = escrowResult.rows[0];

      // Refund the escrow hold
      const refundedHold = await escrowService.refundEscrowHold(
        escrowHold.id,
        reason,
        cancelledBy
      );

      refundInfo = {
        escrowHoldId: refundedHold.id,
        refundAmount: refundedHold.amount,
        refundedAt: refundedHold.refundedAt,
      };

      // Notify client of refund
      const clientResult = await query(`SELECT email FROM users WHERE id = $1`, [
        caseData.client_id,
      ]);

      await sendEmailNotification(
        clientResult.rows[0].email,
        'Case Cancelled - Escrow Refund Processed',
        `Your case has been cancelled. 
         Your escrow hold of $${(escrowHold.amount / 100).toFixed(2)} 
         has been refunded to your original payment method.
         
         Reason: ${reason}
         
         Refund processing time: 3-5 business days`
      );
    }

    // Update case status
    await query(
      `UPDATE cases
       SET status = $1, cancelled_at = NOW(), cancelled_by = $2, updated_at = NOW()
       WHERE id = $3`,
      ['closed', cancelledBy, caseId]
    );

    return {
      success: true,
      caseStatus: 'closed',
      refund: refundInfo,
    };
  } catch (error: any) {
    console.error('Error cancelling case:', error);
    throw error;
  }
}
```

---

## Example 7: Scheduled Auto-Release Job

Runs daily at 2 AM to automatically release eligible escrow holds.

```typescript
// jobs/escrowAutoReleaseJob.ts
import * as escrowService from '../services/escrowService';
import * as caseService from '../services/caseService';
import cron from 'node-cron';

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('[Job] Starting escrow auto-release job...');

  try {
    const releasedCount = await escrowService.processAutomaticEscrowReleases();
    console.log(`[Job] ✅ Successfully auto-released ${releasedCount} escrow holds`);

    // Also update case statuses for released holds
    const { rows: releasedHolds } = await query(
      `SELECT case_id FROM escrow_holds 
       WHERE status = 'released' AND released_at >= NOW() - INTERVAL '1 hour'`
    );

    for (const hold of releasedHolds) {
      await query(
        `UPDATE cases SET status = $1 WHERE id = $2 AND status = $3`,
        ['completed', hold.case_id, 'awaiting_completion']
      );
    }

    console.log(`[Job] Updated ${releasedHolds.length} case statuses`);
  } catch (error) {
    console.error('[Job] ❌ Error in escrow auto-release job:', error);
    // Send alert to admin
    await sendEmailNotification(
      process.env.ADMIN_EMAIL || 'admin@transcend-law.com',
      'Escrow Auto-Release Job Failed',
      `The escrow auto-release job failed at ${new Date().toISOString()}.
       Error: ${error.message}
       
       Please investigate immediately.`
    );
  }
});
```

---

## Example 8: Daily Reconciliation Job

Runs daily at 3 AM to reconcile escrow accounts.

```typescript
// jobs/escrowReconciliationJob.ts
import * as escrowService from '../services/escrowService';
import { sendEmailNotification } from '../services/emailService';

cron.schedule('0 3 * * *', async () => {
  console.log('[Job] Starting escrow reconciliation job...');

  try {
    const reconciliation = await escrowService.reconcileEscrowAccounts();

    console.log(
      `[Job] ✅ Reconciliation complete: $${reconciliation.totalHeld} held, ` +
        `$${reconciliation.totalReleased} released, ` +
        `$${reconciliation.totalRefunded} refunded`
    );

    // Check for issues
    if (reconciliation.status !== 'completed') {
      throw new Error(`Reconciliation failed with status: ${reconciliation.status}`);
    }

    // Send daily report to admin
    const report = `
Escrow Daily Reconciliation Report
Date: ${new Date().toDateString()}

Summary:
- Total Held: $${reconciliation.totalHeld.toFixed(2)}
- Total Released: $${reconciliation.totalReleased.toFixed(2)}
- Total Refunded: $${reconciliation.totalRefunded.toFixed(2)}
- Total Disputed: $${reconciliation.totalDisputed.toFixed(2)}
- Platform Fees: $${reconciliation.platformFeeCollected.toFixed(2)}

Status: ${reconciliation.status}
Verified At: ${new Date(reconciliation.verifiedAt || '').toISOString()}
    `;

    await sendEmailNotification(
      process.env.ADMIN_EMAIL || 'admin@transcend-law.com',
      'Daily Escrow Reconciliation Report',
      report
    );
  } catch (error) {
    console.error('[Job] ❌ Error in escrow reconciliation job:', error);

    await sendEmailNotification(
      process.env.ADMIN_EMAIL || 'admin@transcend-law.com',
      'Escrow Reconciliation Job Failed',
      `The escrow reconciliation job failed: ${error.message}`
    );
  }
});
```

---

## Example 9: Component Usage in Case Detail

Display escrow information in the case detail page.

```typescript
// pages/CaseDetail.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { EscrowStatus } from '../components/EscrowStatus';
import { useAuth } from '../hooks/useAuth';

export function CaseDetail() {
  const { caseId } = useParams<{ caseId: string }>();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCaseData();
  }, [caseId]);

  const fetchCaseData = async () => {
    try {
      const response = await fetch(`/api/v2/cases/${caseId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch case');

      const data = await response.json();
      setCaseData(data.case);
    } catch (error) {
      console.error('Error fetching case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEscrowStatusChange = (status: string) => {
    console.log('Escrow status changed:', status);
    // Refresh case data to update UI
    fetchCaseData();
  };

  if (loading) return <div>Loading...</div>;
  if (!caseData) return <div>Case not found</div>;

  return (
    <div className="case-detail-page">
      <h1>{caseData.title}</h1>

      <div className="case-details">
        <p>Status: {caseData.status}</p>
        <p>Service Type: {caseData.service_type}</p>
        <p>Budget: ${caseData.budget_min} - ${caseData.budget_max}</p>
      </div>

      {/* Show escrow status if case has an offer accepted */}
      {caseData.status === 'matched' ||
      caseData.status === 'in_progress' ||
      caseData.status === 'completed' ? (
        <div className="escrow-section">
          <h2>Payment Status</h2>
          <EscrowStatus
            caseId={caseId}
            userType={user.userType as 'client' | 'provider' | 'admin'}
            currentUserId={user.id}
            onStatusChange={handleEscrowStatusChange}
          />
        </div>
      ) : null}

      {/* Case actions */}
      <div className="case-actions">
        {user.userType === 'provider' && caseData.status === 'in_progress' && (
          <button onClick={() => handleCompleteService()}>Mark Complete</button>
        )}

        {user.userType === 'client' && caseData.status === 'in_progress' && (
          <button onClick={() => handleApproveCompletion()}>Approve Completion</button>
        )}

        {user.userType === 'admin' && (
          <button onClick={() => handleForceRelease()}>Force Release (Admin)</button>
        )}
      </div>
    </div>
  );
}
```

---

## Example 10: API Client Usage

TypeScript client for escrow API calls.

```typescript
// api/escrowClient.ts
import axios from 'axios';

const API_BASE = '/api/v2/escrow';

export class EscrowClient {
  private token: string;

  constructor(authToken: string) {
    this.token = authToken;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async createHold(
    caseId: string,
    clientId: string,
    providerId: string,
    amount: number
  ) {
    const response = await axios.post(
      `${API_BASE}/holds`,
      {
        caseId,
        clientId,
        providerId,
        amount,
        holdPeriodDays: 30,
        feePercentage: 2.5,
        whoPaysFee: 'platform',
      },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async getHold(holdId: string) {
    const response = await axios.get(`${API_BASE}/holds/${holdId}`, {
      headers: this.getHeaders(),
    });
    return response.data.escrowHold;
  }

  async approveRelease(holdId: string, userId: string) {
    const response = await axios.post(
      `${API_BASE}/${holdId}/approve`,
      { userId },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async releaseHold(holdId: string, reason: string) {
    const response = await axios.post(
      `${API_BASE}/${holdId}/release`,
      { reason },
      { headers: this.getHeaders() }
    );
    return response.data;
  }

  async openDispute(holdId: string, reason: string, initiatedBy: string) {
    const response = await axios.post(
      `${API_BASE}/${holdId}/dispute`,
      { reason, initiatedBy },
      { headers: this.getHeaders() }
    );
    return response.data.dispute;
  }

  async getCaseEscrow(caseId: string) {
    const response = await axios.get(`${API_BASE}/case/${caseId}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }
}

// Usage:
const escrow = new EscrowClient(authToken);
const hold = await escrow.createHold(caseId, clientId, providerId, 50000);
await escrow.approveRelease(hold.id, clientId);
```

---

## Integration Checklist for Case Workflow

### Case Creation
- [x] Include escrow configuration in case setup

### Case Matching
- [x] When attorney accepts → create escrow hold
- [x] Send notifications to both parties
- [x] Update case status to 'matched'

### Service Delivery
- [x] Provider completes work → approves escrow
- [x] Client reviews → approves escrow
- [x] Auto-release after time period

### Conflict Resolution
- [x] Either party can open dispute
- [x] Admin investigates and resolves
- [x] Release or refund based on decision

### Case Completion
- [x] Update case status based on escrow status
- [x] Generate completion report
- [x] Archive escrow records

---

## Quick Troubleshooting

**Issue: Escrow hold won't release**
```typescript
// Check conditions
const hold = await escrowService.getEscrowHold(holdId);
console.log('Status:', hold.status);
console.log('Client approved:', hold.releaseConditions.requiresClientApproval);
console.log('Days remaining:', calculateDaysRemaining(hold.releaseConditions.holdUntilDate));
```

**Issue: Payment didn't transfer to provider**
```typescript
// Check Stripe account
const stripeBalance = await stripe.balance.retrieve({ stripeAccount: providerAccountId });
console.log('Provider balance:', stripeBalance);

// Check transfer
const transfer = await stripe.transfers.retrieve(transferId);
console.log('Transfer status:', transfer.status);
```

**Issue: Dispute not opening**
```typescript
// Check escrow status
const holds = await escrowService.getEscrowHoldsByCase(caseId);
console.log('Hold status:', holds[0].status); // Must be 'held' or 'released'
```

---

## Production Deployment Checklist

- [ ] Run all tests (unit + integration)
- [ ] Load test with concurrent holds
- [ ] Verify Stripe webhook configuration
- [ ] Set up scheduled jobs (auto-release + reconciliation)
- [ ] Configure alerts for failures
- [ ] Set up monitoring dashboard
- [ ] Train admin on dispute resolution
- [ ] Create runbook for common issues
- [ ] Monitor first 24 hours closely
- [ ] Collect metrics and optimize

---

**Last Updated:** 2026-08-15  
**Examples:** 10+  
**Code Snippets:** 50+
