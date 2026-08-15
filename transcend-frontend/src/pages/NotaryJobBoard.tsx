import React, { useState, useEffect } from 'react';
import './NotaryJobBoard.css';

export interface NotaryJob {
  id: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceType: string;
  location: string;
  dateNeeded: string;
  timeNeeded: string;
  urgency: 'routine' | 'urgent' | 'emergency';
  estimatedDuration: string;
  description: string;
  specialtiesRequired: string[];
  postedAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'completed';
  offerAmount?: number;
  competingNotaries?: number;
}

interface ExpeditedFeeModalProps {
  job: NotaryJob;
  onConfirm: (jobId: string) => void;
  onCancel: () => void;
}

const ExpeditedFeeModal: React.FC<ExpeditedFeeModalProps> = ({ job, onConfirm, onCancel }) => {
  const baseAmount = job.offerAmount || 100;
  const expeditedFee = baseAmount * 0.5;
  const totalAmount = baseAmount + expeditedFee;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>⚡ Expedited Service Fee</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body">
          <p className="modal-message">
            This {job.urgency.toUpperCase()} job requires expedited service. A 50% expedited fee applies.
          </p>

          <div className="fee-breakdown">
            <div className="fee-item">
              <span>Base Service Fee:</span>
              <span className="fee-amount">${baseAmount.toFixed(2)}</span>
            </div>
            <div className="fee-item">
              <span>Expedited Fee (50%):</span>
              <span className="fee-amount fee-expedited">${expeditedFee.toFixed(2)}</span>
            </div>
            <div className="fee-item total">
              <span>Total Amount:</span>
              <span className="fee-amount">${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="job-details-preview">
            <h4>Job Details</h4>
            <p><strong>Service:</strong> {job.serviceType}</p>
            <p><strong>Location:</strong> {job.location}</p>
            <p><strong>Time Needed:</strong> {job.dateNeeded} at {job.timeNeeded}</p>
            <p><strong>Client:</strong> {job.clientName}</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-confirm" onClick={() => onConfirm(job.id)}>
            Confirm & Pay ${totalAmount.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
};

export const NotaryJobBoard: React.FC = () => {
  const [jobs, setJobs] = useState<NotaryJob[]>([
    {
      id: 'job-001',
      clientName: 'Sarah Chen',
      clientEmail: 'sarah.chen@email.com',
      clientPhone: '(555) 123-4567',
      serviceType: 'Loan Signing',
      location: 'Downtown Los Angeles, CA',
      dateNeeded: 'Today',
      timeNeeded: '2:00 PM - 4:00 PM',
      urgency: 'urgent',
      estimatedDuration: '90 minutes',
      description: 'Mortgage refinance closing documents for residential property',
      specialtiesRequired: ['Loan Signing', 'Mortgage Documents'],
      postedAt: new Date(Date.now() - 15 * 60000),
      status: 'pending',
      offerAmount: 200,
      competingNotaries: 3,
    },
    {
      id: 'job-002',
      clientName: 'Michael Rodriguez',
      clientEmail: 'mrodriguez@business.com',
      clientPhone: '(555) 234-5678',
      serviceType: 'Power of Attorney',
      location: 'Virtual (Video Conference)',
      dateNeeded: 'Tomorrow',
      timeNeeded: '10:00 AM - 10:30 AM',
      urgency: 'routine',
      estimatedDuration: '30 minutes',
      description: 'Healthcare power of attorney witness for durable POA',
      specialtiesRequired: ['Power of Attorney'],
      postedAt: new Date(Date.now() - 45 * 60000),
      status: 'pending',
      offerAmount: 85,
      competingNotaries: 2,
    },
    {
      id: 'job-003',
      clientName: 'Jennifer Martinez',
      clientEmail: 'jmartinez@legal.com',
      clientPhone: '(555) 345-6789',
      serviceType: 'Affidavit Notarization',
      location: 'Santa Monica, CA',
      dateNeeded: 'Today',
      timeNeeded: '4:30 PM - 5:00 PM',
      urgency: 'emergency',
      estimatedDuration: '30 minutes',
      description: 'Court affidavit - URGENT - needed for emergency hearing tomorrow',
      specialtiesRequired: ['General Notarization', 'Affidavits'],
      postedAt: new Date(Date.now() - 5 * 60000),
      status: 'pending',
      offerAmount: 120,
      competingNotaries: 1,
    },
  ]);

  const [filter, setFilter] = useState<'all' | 'pending' | 'urgent' | 'accepted'>('pending');
  const [selectedJob, setSelectedJob] = useState<NotaryJob | null>(null);
  const [jobNeedingFeeConfirmation, setJobNeedingFeeConfirmation] = useState<NotaryJob | null>(null);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'emergency': return '#d32f2f';
      case 'urgent': return '#f57c00';
      case 'routine': return '#388e3c';
      default: return '#666';
    }
  };

  const handleAccept = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (job && (job.urgency === 'urgent' || job.urgency === 'emergency')) {
      // Show expedited fee confirmation modal
      setJobNeedingFeeConfirmation(job);
    } else {
      // Accept immediately for routine jobs
      acceptJob(jobId);
    }
  };

  const acceptJob = (jobId: string) => {
    setJobs(jobs.map(job =>
      job.id === jobId ? { ...job, status: 'accepted' as const } : job
    ));
    setJobNeedingFeeConfirmation(null);
  };

  const handleDecline = (jobId: string) => {
    setJobs(jobs.map(job =>
      job.id === jobId ? { ...job, status: 'declined' as const } : job
    ));
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    if (filter === 'pending') return job.status === 'pending';
    if (filter === 'urgent') return job.urgency === 'urgent' || job.urgency === 'emergency';
    if (filter === 'accepted') return job.status === 'accepted';
    return true;
  });

  return (
    <div className="notary-job-board">
      <div className="job-board-header">
        <h1>📋 Job Board</h1>
        <p>Pending notarization requests from clients</p>
      </div>

      <div className="job-filters">
        <button className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          📩 Pending ({jobs.filter(j => j.status === 'pending').length})
        </button>
        <button className={`filter-btn ${filter === 'urgent' ? 'active' : ''}`} onClick={() => setFilter('urgent')}>
          🔴 Urgent/Emergency
        </button>
        <button className={`filter-btn ${filter === 'accepted' ? 'active' : ''}`} onClick={() => setFilter('accepted')}>
          ✅ Accepted
        </button>
      </div>

      <div className="job-board-layout">
        <div className="jobs-list">
          {filteredJobs.map(job => (
            <div key={job.id} className={`job-card ${job.status} ${job.urgency}`} onClick={() => setSelectedJob(job)}>
              <div className="job-card-header">
                <h3>{job.serviceType}</h3>
                <span className="urgency-badge" style={{ color: getUrgencyColor(job.urgency) }}>
                  {job.urgency.toUpperCase()}
                </span>
              </div>
              <p className="client-name">{job.clientName}</p>
              <p className="location">{job.location}</p>
              {job.offerAmount && <p className="offer">${job.offerAmount}</p>}
              <div className="job-actions">
                {job.status === 'pending' && (
                  <>
                    <button className="btn-accept" onClick={() => handleAccept(job.id)}>✅ Accept</button>
                    <button className="btn-decline" onClick={() => handleDecline(job.id)}>❌ Decline</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {jobNeedingFeeConfirmation && (
        <ExpeditedFeeModal
          job={jobNeedingFeeConfirmation}
          onConfirm={acceptJob}
          onCancel={() => setJobNeedingFeeConfirmation(null)}
        />
      )}
    </div>
  );
};
