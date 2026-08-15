// Opportunity Board
// Law firm dashboard showing available cases

import React, { useState } from 'react';
import './OpportunityBoard.css';

interface CaseOpportunity {
  id: string;
  title: string;
  service: string;
  description: string;
  budget: { min: number; max: number };
  urgency: string;
  location: string;
  clientRating?: number;
  submittedAt: Date;
  status: 'new' | 'responded' | 'matched' | 'accepted';
  attorneys?: number;
}

export const OpportunityBoard: React.FC = () => {
  const [cases, setCases] = useState<CaseOpportunity[]>([
    {
      id: 'case_1',
      title: 'Wrongful Termination Claim',
      service: 'Employment Law',
      description: 'Client was terminated without cause after 8 years of employment. Looking for representation.',
      budget: { min: 2500, max: 5000 },
      urgency: 'high',
      location: 'California',
      clientRating: 4.8,
      submittedAt: new Date(Date.now() - 3600000),
      status: 'new',
      attorneys: 0,
    },
    {
      id: 'case_2',
      title: 'Divorce & Custody Agreement',
      service: 'Family Law',
      description: 'Amicable divorce with one child. Need help with custody arrangement and asset division.',
      budget: { min: 1500, max: 3000 },
      urgency: 'medium',
      location: 'California',
      clientRating: 4.9,
      submittedAt: new Date(Date.now() - 7200000),
      status: 'new',
      attorneys: 0,
    },
    {
      id: 'case_3',
      title: 'Contract Review & Negotiation',
      service: 'Contract Law',
      description: 'Need legal review of commercial lease before signing. May require negotiation.',
      budget: { min: 500, max: 1500 },
      urgency: 'low',
      location: 'California',
      clientRating: 4.6,
      submittedAt: new Date(Date.now() - 86400000),
      status: 'new',
      attorneys: 2,
    },
  ]);

  const [selectedCase, setSelectedCase] = useState<CaseOpportunity | null>(null);
  const [filterUrgency, setFilterUrgency] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('new');

  const filteredCases = cases.filter(c => {
    const urgencyMatch = filterUrgency === 'all' || c.urgency === filterUrgency;
    const statusMatch = filterStatus === 'all' || c.status === filterStatus;
    return urgencyMatch && statusMatch;
  });

  const handleRespond = (caseId: string) => {
    // Open response form
    setSelectedCase(cases.find(c => c.id === caseId) || null);
  };

  return (
    <div className="opportunity-board">
      <div className="board-header">
        <h1>⭐ Opportunity Board</h1>
        <p>New cases waiting for attorney response</p>
      </div>

      {/* Filters */}
      <div className="board-filters">
        <div className="filter-group">
          <label>Urgency:</label>
          <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)}>
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="responded">Responded</option>
            <option value="matched">Matched</option>
          </select>
        </div>

        <div className="case-count">
          📊 {filteredCases.length} cases available
        </div>
      </div>

      {/* Cases Grid */}
      <div className="cases-grid">
        {filteredCases.map(caseItem => (
          <div key={caseItem.id} className={`case-card ${caseItem.urgency}`}>
            <div className="case-header">
              <h3>{caseItem.title}</h3>
              <span className={`urgency-badge ${caseItem.urgency}`}>
                {caseItem.urgency.toUpperCase()}
              </span>
            </div>

            <div className="case-meta">
              <p className="service">{caseItem.service}</p>
              <p className="location">📍 {caseItem.location}</p>
            </div>

            <p className="description">{caseItem.description}</p>

            <div className="case-details">
              <div className="detail">
                <span className="label">Budget:</span>
                <span className="value">
                  ${caseItem.budget.min.toLocaleString()} - ${caseItem.budget.max.toLocaleString()}
                </span>
              </div>
              <div className="detail">
                <span className="label">Client Info:</span>
                <span className="value privacy-notice">
                  🔒 Revealed after acceptance
                </span>
              </div>
              <div className="detail">
                <span className="label">Responses:</span>
                <span className="value">{caseItem.attorneys} attorney(s)</span>
              </div>
            </div>

            <div className="privacy-notice-box">
              ℹ️ Client identity and rating protected until you accept the case. This prevents unauthorized tracking or contact attempts.
            </div>

            <div className="case-actions">
              <button
                className="btn-respond"
                onClick={() => handleRespond(caseItem.id)}
              >
                📝 Respond
              </button>
              <button className="btn-details">View Details</button>
            </div>

            <p className="time-ago">
              🕐 {Math.floor((Date.now() - caseItem.submittedAt.getTime()) / 60000)} minutes ago
            </p>
          </div>
        ))}
      </div>

      {/* Response Modal */}
      {selectedCase && (
        <div className="modal-overlay" onClick={() => setSelectedCase(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedCase(null)}>✕</button>
            <h2>Respond to Case</h2>
            <p className="case-title">{selectedCase.title}</p>

            <form className="response-form">
              <div className="form-group">
                <label>Your Response</label>
                <textarea
                  placeholder="Share your experience with similar cases and why you'd be a good fit..."
                  rows={6}
                />
              </div>

              <div className="form-group">
                <label>Your Quote ($)</label>
                <input type="number" placeholder="Enter your fee estimate" />
              </div>

              <div className="form-group">
                <label>Timeline</label>
                <select>
                  <option>Select timeline...</option>
                  <option>1-2 weeks</option>
                  <option>2-4 weeks</option>
                  <option>1-2 months</option>
                  <option>2+ months</option>
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setSelectedCase(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-send">
                  ✓ Send Response
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpportunityBoard;
