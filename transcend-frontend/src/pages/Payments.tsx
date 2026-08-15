import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PrimaryButton, Toast, ProgressBar } from '@/components/UI';
import './Payments.css';

interface PaymentForm {
  caseId: string;
  amount: string;
  clientName: string;
  clientEmail: string;
  description: string;
}

interface DisbursementForm {
  professionalId: string;
  amount: string;
  caseId: string;
  description: string;
}

export const Payments: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<any>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message, duration: 4000, onClose: () => setToast(null) });
  };

  const [paymentForm, setPaymentForm] = useState<PaymentForm>({
    caseId: '',
    amount: '',
    clientName: '',
    clientEmail: '',
    description: ''
  });

  const [disbursementForm, setDisbursementForm] = useState<DisbursementForm>({
    professionalId: '',
    amount: '',
    caseId: '',
    description: ''
  });

  // ============================================================================
  // INBOUND PAYMENTS - Create payment link for clients
  // ============================================================================

  const handleCreatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('https://transcend-law.com/api/payments/create-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          caseId: paymentForm.caseId,
          amount: parseFloat(paymentForm.amount),
          clientName: paymentForm.clientName,
          clientEmail: paymentForm.clientEmail,
          description: paymentForm.description
        })
      });

      if (!response.ok) throw new Error('Failed to create payment link');

      const data = await response.json();

      showToast('success', `Payment link created! $${data.amount.toFixed(2)} | Commission: $${data.commission.toFixed(2)}`);

      // Copy link to clipboard
      navigator.clipboard.writeText(data.paymentLink);
      showToast('info', 'Payment link copied to clipboard');

      // Reset form
      setPaymentForm({
        caseId: '',
        amount: '',
        clientName: '',
        clientEmail: '',
        description: ''
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error creating payment link';
      showToast('error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // OUTBOUND PAYMENTS - Pay professionals
  // ============================================================================

  const handleCreateDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('https://transcend-law.com/api/payments/disbursement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          professionalId: disbursementForm.professionalId,
          amount: parseFloat(disbursementForm.amount),
          caseId: disbursementForm.caseId,
          description: disbursementForm.description
        })
      });

      if (!response.ok) throw new Error('Failed to create disbursement');

      const data = await response.json();

      showToast('success', `Disbursement sent to ${data.professional} for $${data.amount.toFixed(2)}`);

      // Reset form
      setDisbursementForm({
        professionalId: '',
        amount: '',
        caseId: '',
        description: ''
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error creating disbursement';
      showToast('error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payments-container">
      <h2>💰 Payment & Commissions</h2>

      <div className="payment-tabs">
        <button
          className={`tab-btn ${activeTab === 'inbound' ? 'active' : ''}`}
          onClick={() => setActiveTab('inbound')}
        >
          📥 Inbound Payments (Clients)
        </button>
        <button
          className={`tab-btn ${activeTab === 'outbound' ? 'active' : ''}`}
          onClick={() => setActiveTab('outbound')}
        >
          📤 Outbound Payments (Professionals)
        </button>
      </div>

      {activeTab === 'inbound' && (
        <div className="payment-form">
          <h3>Create Client Payment Link</h3>
          <p>Generate a payment link for clients to pay for case referrals via LawPay</p>

          <form onSubmit={handleCreatePaymentLink}>
            <div className="form-row">
              <div className="form-group">
                <label>Case ID *</label>
                <input
                  type="text"
                  value={paymentForm.caseId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, caseId: e.target.value })}
                  placeholder="Case-2026-001"
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Amount (USD) *</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="500.00"
                  step="0.01"
                  min="1"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Client Name *</label>
                <input
                  type="text"
                  value={paymentForm.clientName}
                  onChange={(e) => setPaymentForm({ ...paymentForm, clientName: e.target.value })}
                  placeholder="John Smith"
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Client Email *</label>
                <input
                  type="email"
                  value={paymentForm.clientEmail}
                  onChange={(e) => setPaymentForm({ ...paymentForm, clientEmail: e.target.value })}
                  placeholder="john@example.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={paymentForm.description}
                onChange={(e) => setPaymentForm({ ...paymentForm, description: e.target.value })}
                placeholder="Case referral for property dispute..."
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="form-info">
              <p>📊 Platform Commission: 15% of payment amount</p>
              {paymentForm.amount && (
                <p>💵 Your commission: ${(parseFloat(paymentForm.amount) * 0.15).toFixed(2)}</p>
              )}
            </div>

            <div style={{ marginTop: '16px', marginBottom: '12px' }}>
              <ProgressBar
                progress={paymentForm.caseId && paymentForm.amount && paymentForm.clientName ? 75 : 25}
                label="Form Progress"
                showPercentage={true}
              />
            </div>

            <PrimaryButton type="submit" loading={loading} style={{ width: '100%' }}>
              {loading ? 'Creating Link...' : 'Create Payment Link'}
            </PrimaryButton>
          </form>
        </div>
      )}

      {activeTab === 'outbound' && (
        <div className="payment-form">
          <h3>Disburse Payment to Professional</h3>
          <p>Send payment to a professional for completed work via LawPay</p>

          <form onSubmit={handleCreateDisbursement}>
            <div className="form-row">
              <div className="form-group">
                <label>Professional ID *</label>
                <input
                  type="text"
                  value={disbursementForm.professionalId}
                  onChange={(e) => setDisbursementForm({ ...disbursementForm, professionalId: e.target.value })}
                  placeholder="PROF-12345"
                  required
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label>Amount (USD) *</label>
                <input
                  type="number"
                  value={disbursementForm.amount}
                  onChange={(e) => setDisbursementForm({ ...disbursementForm, amount: e.target.value })}
                  placeholder="425.00"
                  step="0.01"
                  min="1"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Case ID *</label>
              <input
                type="text"
                value={disbursementForm.caseId}
                onChange={(e) => setDisbursementForm({ ...disbursementForm, caseId: e.target.value })}
                placeholder="Case-2026-001"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={disbursementForm.description}
                onChange={(e) => setDisbursementForm({ ...disbursementForm, description: e.target.value })}
                placeholder="Payment for successful case referral..."
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="form-info">
              <p>⏱️ Payment Method: Direct bank transfer via LawPay</p>
              <p>✅ Status: Real-time processing</p>
            </div>

            <div style={{ marginTop: '16px', marginBottom: '12px' }}>
              <ProgressBar
                progress={disbursementForm.professionalId && disbursementForm.amount && disbursementForm.caseId ? 75 : 25}
                label="Form Progress"
                showPercentage={true}
              />
            </div>

            <PrimaryButton type="submit" loading={loading} style={{ width: '100%' }}>
              {loading ? 'Processing...' : 'Send Disbursement'}
            </PrimaryButton>
          </form>
        </div>
      )}

      <div className="payment-info">
        <h4>💳 LawPay Integration Details</h4>
        <div className="info-grid">
          <div className="info-card">
            <h5>Inbound Payments</h5>
            <p>Clients pay for case referrals</p>
            <ul>
              <li>Secure payment links</li>
              <li>Multiple payment methods</li>
              <li>Instant verification</li>
              <li>15% platform commission</li>
            </ul>
          </div>
          <div className="info-card">
            <h5>Outbound Payments</h5>
            <p>Pay professionals for services</p>
            <ul>
              <li>Direct bank transfers</li>
              <li>Real-time processing</li>
              <li>Secure disbursements</li>
              <li>Compliance tracking</li>
            </ul>
          </div>
          <div className="info-card">
            <h5>Security</h5>
            <p>Enterprise-grade protection</p>
            <ul>
              <li>PCI DSS compliant</li>
              <li>Webhook verification</li>
              <li>Full audit trail</li>
              <li>Encrypted storage</li>
            </ul>
          </div>
          <div className="info-card">
            <h5>Fees</h5>
            <p>Transparent pricing</p>
            <ul>
              <li>2.9% + $0.30 (inbound)</li>
              <li>1.0% (outbound)</li>
              <li>No setup fees</li>
              <li>No monthly fees</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
          <Toast {...toast} />
        </div>
      )}
    </div>
  );
};
