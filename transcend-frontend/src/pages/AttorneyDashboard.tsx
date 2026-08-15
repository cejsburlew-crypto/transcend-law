/**
 * Attorney Dashboard - Psychology Optimized
 * Displays attorney earnings, case metrics, and performance indicators
 */

import React, { useState } from 'react';
import {
  EarningsDisplay,
  CaseStatusCard,
  StatusBadge,
  PrimaryButton,
  Toast,
  SupportButton,
} from '@/components/UI';
import '../styles/psychology-design-system.css';

interface AttorneyCase {
  id: string;
  clientName: string;
  caseType: string;
  status: 'pending' | 'active' | 'completed';
  progress: number;
  earnings: number;
  createdAt: string;
}

export const AttorneyDashboard: React.FC = () => {
  const [toast, setToast] = useState<any>(null);
  const [activeCases] = useState<AttorneyCase[]>([
    {
      id: 'case-1',
      clientName: 'John Smith',
      caseType: 'Family Law - Divorce',
      status: 'active',
      progress: 65,
      earnings: 1500,
      createdAt: '2026-08-01',
    },
    {
      id: 'case-2',
      clientName: 'Sarah Johnson',
      caseType: 'Employment Law - Wrongful Termination',
      status: 'active',
      progress: 40,
      earnings: 2000,
      createdAt: '2026-08-05',
    },
    {
      id: 'case-3',
      clientName: 'Mike Davis',
      caseType: 'Contract Review',
      status: 'completed',
      progress: 100,
      earnings: 800,
      createdAt: '2026-07-15',
    },
  ]);

  const showToast = (type: 'success' | 'info', message: string) => {
    setToast({ type, message, duration: 3000, onClose: () => setToast(null) });
  };

  const statusMap: { [key: string]: 'pending' | 'in-progress' | 'review' | 'complete' } = {
    'pending': 'pending',
    'active': 'in-progress',
    'completed': 'complete',
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', fontWeight: '700' }}>
          Attorney Dashboard
        </h1>
        <p style={{ margin: '0', color: 'var(--color-text-gray)', fontSize: '16px' }}>
          Your cases, earnings, and performance metrics
        </p>
      </div>

      {/* Earnings Display - Accomplishment + Fairness Psychology */}
      <div style={{ marginBottom: '32px' }}>
        <EarningsDisplay
          totalEarnings={15400}
          monthlyEarnings={4200}
          casesCompleted={47}
          percentileRank={82}
        />
      </div>

      {/* Performance Metrics */}
      <div
        style={{
          backgroundColor: 'var(--color-primary-light)',
          padding: '24px',
          borderRadius: '8px',
          marginBottom: '32px',
        }}
      >
        <h2 style={{ margin: '0 0 16px 0' }}>This Month's Performance</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--color-text-gray)', fontWeight: '600' }}>
              CASES COMPLETED
            </p>
            <p style={{ margin: '0', fontSize: '28px', fontWeight: '700', color: 'var(--color-primary)' }}>
              5
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--color-text-gray)', fontWeight: '600' }}>
              AVERAGE RATING
            </p>
            <p style={{ margin: '0', fontSize: '28px', fontWeight: '700', color: 'var(--color-primary)' }}>
              4.9 ⭐
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--color-text-gray)', fontWeight: '600' }}>
              RESPONSE TIME
            </p>
            <p style={{ margin: '0', fontSize: '28px', fontWeight: '700', color: 'var(--color-primary)' }}>
              &lt; 2 hrs
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--color-text-gray)', fontWeight: '600' }}>
              CLIENT SATISFACTION
            </p>
            <p style={{ margin: '0', fontSize: '28px', fontWeight: '700', color: 'var(--color-primary)' }}>
              98%
            </p>
          </div>
        </div>
      </div>

      {/* Active Cases Section - Psychology Optimized */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2>Your Active Cases</h2>
          <StatusBadge status="success">{activeCases.length} cases</StatusBadge>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '16px',
          }}
        >
          {activeCases.map((caseItem) => (
            <div key={caseItem.id}>
              <CaseStatusCard
                title={caseItem.caseType}
                status={statusMap[caseItem.status]}
                progress={caseItem.progress}
                lastUpdate={new Date(caseItem.createdAt).toLocaleDateString()}
                nextStep={
                  caseItem.status === 'completed'
                    ? 'Closed successfully'
                    : caseItem.status === 'active'
                    ? 'Waiting for client documents'
                    : 'Pending initial consultation'
                }
              />

              {/* Case Earnings & Actions */}
              <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--color-success-light)', borderRadius: '8px' }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '600', color: 'var(--color-text-gray)' }}>
                  EXPECTED EARNINGS
                </p>
                <p style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '700', color: 'var(--color-success)' }}>
                  ${caseItem.earnings}
                </p>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <PrimaryButton
                    onClick={() => showToast('info', `Opening case: ${caseItem.caseType}...`)}
                    style={{ flex: 1, fontSize: '14px', padding: '8px' }}
                  >
                    View Case
                  </PrimaryButton>
                  <button
                    className="btn-secondary"
                    onClick={() => showToast('info', `Messaging ${caseItem.clientName}...`)}
                    style={{ flex: 1, padding: '8px' }}
                  >
                    Message
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ backgroundColor: 'var(--color-neutral-lightest)', padding: '24px', borderRadius: '8px', marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 16px 0' }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <PrimaryButton onClick={() => showToast('info', 'Opening profile...')}>
            👤 Update Profile
          </PrimaryButton>
          <button className="btn-secondary" onClick={() => showToast('info', 'Loading availability...')}>
            📅 Set Availability
          </button>
          <button className="btn-secondary" onClick={() => showToast('info', 'Opening rates...')}>
            💰 Manage Rates
          </button>
          <button className="btn-secondary" onClick={() => showToast('info', 'Opening settings...')}>
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
          <Toast {...toast} />
        </div>
      )}

      {/* Support Button */}
      <SupportButton onClick={() => showToast('info', 'Opening support...')} />
    </div>
  );
};

export default AttorneyDashboard;
