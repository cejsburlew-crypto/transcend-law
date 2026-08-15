// Offer Display System
// Shows attorney responses, quotes, and offers for submitted cases

import React, { useState } from 'react';
import './OfferDisplay.css';

interface Attorney {
  id: string;
  name: string;
  firm: string;
  rating: number;
  specialty: string;
  yearsExperience: number;
  location: string;
  avatar?: string;
}

interface Offer {
  id: string;
  attorneyId: string;
  attorney: Attorney;
  status: 'pending' | 'quoted' | 'rejected' | 'accepted' | 'retained';
  quoteAmount?: number;
  quoteDate?: string;
  message?: string;
  responseTime?: string;
}

interface CaseDetail {
  id: string;
  title: string;
  service: string;
  description: string;
  budget: { min: number; max: number };
  urgency: string;
  location: string;
  createdAt: string;
  offers: Offer[];
  status: 'submitted' | 'in_review' | 'offers_received' | 'negotiating' | 'retained' | 'closed';
}

interface OfferDisplayProps {
  caseDetail: CaseDetail;
  onAcceptOffer?: (offerId: string) => void;
  onRejectOffer?: (offerId: string) => void;
  onContactAttorney?: (attorneyId: string) => void;
  onClose?: () => void;
}

const SAMPLE_OFFERS: Offer[] = [
  {
    id: 'o1',
    attorneyId: '1',
    attorney: {
      id: '1',
      name: 'Sarah Johnson, Esq.',
      firm: 'Johnson & Associates',
      rating: 4.9,
      specialty: 'Employment Law',
      yearsExperience: 12,
      location: 'San Francisco, CA',
    },
    status: 'quoted',
    quoteAmount: 2500,
    quoteDate: '2026-08-15',
    message: 'I have extensive experience with wrongful termination cases. Happy to discuss your situation.',
    responseTime: '2 hours',
  },
  {
    id: 'o2',
    attorneyId: '2',
    attorney: {
      id: '2',
      name: 'James Miller, Esq.',
      firm: 'Miller Law Group',
      rating: 4.7,
      specialty: 'Personal Injury',
      yearsExperience: 15,
      location: 'Los Angeles, CA',
    },
    status: 'rejected',
    message: 'This case falls outside my current focus areas.',
    responseTime: '1 hour',
  },
  {
    id: 'o3',
    attorneyId: '3',
    attorney: {
      id: '3',
      name: 'Maria Garcia, Esq.',
      firm: 'Garcia Legal Partners',
      rating: 4.8,
      specialty: 'Employment Law',
      yearsExperience: 10,
      location: 'San Jose, CA',
    },
    status: 'quoted',
    quoteAmount: 2000,
    quoteDate: '2026-08-15',
    message: 'I can help with this. My firm handles similar cases regularly.',
    responseTime: '4 hours',
  },
  {
    id: 'o4',
    attorneyId: '4',
    attorney: {
      id: '4',
      name: 'David Chen, Esq.',
      firm: 'Chen & Co Legal',
      rating: 4.6,
      specialty: 'Contract Law',
      yearsExperience: 8,
      location: 'Palo Alto, CA',
    },
    status: 'pending',
    responseTime: 'Pending...',
  },
  {
    id: 'o5',
    attorneyId: '5',
    attorney: {
      id: '5',
      name: 'Rebecca Williams, Esq.',
      firm: 'Williams Legal',
      rating: 4.9,
      specialty: 'Criminal Defense',
      yearsExperience: 18,
      location: 'Oakland, CA',
    },
    status: 'rejected',
    message: 'Not taking new cases at this time.',
    responseTime: '30 minutes',
  },
];

export const OfferDisplay: React.FC<OfferDisplayProps> = ({
  caseDetail,
  onAcceptOffer,
  onRejectOffer,
  onContactAttorney,
  onClose,
}) => {
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const offers = caseDetail.offers.length > 0 ? caseDetail.offers : SAMPLE_OFFERS;

  const stats = {
    total: offers.length,
    quoted: offers.filter(o => o.status === 'quoted').length,
    rejected: offers.filter(o => o.status === 'rejected').length,
    pending: offers.filter(o => o.status === 'pending').length,
    accepted: offers.filter(o => o.status === 'accepted' || o.status === 'retained').length,
  };

  const filteredOffers =
    filterStatus === 'all' ? offers : offers.filter(o => o.status === filterStatus);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'quoted':
        return { emoji: '💰', label: 'Quoted', color: 'quoted' };
      case 'rejected':
        return { emoji: '❌', label: 'Declined', color: 'rejected' };
      case 'pending':
        return { emoji: '⏳', label: 'Pending', color: 'pending' };
      case 'accepted':
        return { emoji: '✅', label: 'Accepted', color: 'accepted' };
      case 'retained':
        return { emoji: '🎯', label: 'Retained', color: 'retained' };
      default:
        return { emoji: '❓', label: status, color: 'default' };
    }
  };

  return (
    <div className="offer-display">
      {/* Case Header */}
      <div className="case-header">
        <div className="case-title-section">
          <h2>{caseDetail.title}</h2>
          <p className="case-service">{caseDetail.service}</p>
        </div>
        <div className="case-meta">
          <span className="case-status">{caseDetail.status.replace('_', ' ').toUpperCase()}</span>
          {onClose && (
            <button className="close-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="offers-stats">
        <div className="stat">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total Responses</span>
        </div>
        <div className="stat">
          <span className="stat-value" style={{ color: '#10b981' }}>
            {stats.quoted}
          </span>
          <span className="stat-label">Quoted</span>
        </div>
        <div className="stat">
          <span className="stat-value" style={{ color: '#3b82f6' }}>
            {stats.pending}
          </span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat">
          <span className="stat-value" style={{ color: '#ef4444' }}>
            {stats.rejected}
          </span>
          <span className="stat-label">Declined</span>
        </div>
        {stats.accepted > 0 && (
          <div className="stat">
            <span className="stat-value" style={{ color: '#8b5cf6' }}>
              {stats.accepted}
            </span>
            <span className="stat-label">Accepted</span>
          </div>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="filter-buttons">
        <button
          className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All ({stats.total})
        </button>
        <button
          className={`filter-btn ${filterStatus === 'quoted' ? 'active' : ''}`}
          onClick={() => setFilterStatus('quoted')}
        >
          Quoted ({stats.quoted})
        </button>
        <button
          className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          Pending ({stats.pending})
        </button>
        <button
          className={`filter-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilterStatus('rejected')}
        >
          Declined ({stats.rejected})
        </button>
      </div>

      {/* Offers List */}
      <div className="offers-list">
        {filteredOffers.map(offer => {
          const badge = getStatusBadge(offer.status);
          const isSelected = selectedOffer === offer.id;

          return (
            <div
              key={offer.id}
              className={`offer-card ${offer.status} ${isSelected ? 'expanded' : ''}`}
              onClick={() => setSelectedOffer(isSelected ? null : offer.id)}
            >
              {/* Offer Summary */}
              <div className="offer-summary">
                <div className="attorney-info">
                  <div className="attorney-avatar">{offer.attorney.name[0]}</div>
                  <div className="attorney-details">
                    <h4>{offer.attorney.name}</h4>
                    <p className="firm">{offer.attorney.firm}</p>
                    <p className="specialty">📚 {offer.attorney.specialty}</p>
                  </div>
                </div>

                <div className="offer-quick-info">
                  {offer.quoteAmount && (
                    <div className="quote-amount">
                      <span className="label">Quote:</span>
                      <span className="amount">${offer.quoteAmount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className={`status-badge ${badge.color}`}>
                    {badge.emoji} {badge.label}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isSelected && (
                <div className="offer-details">
                  <div className="attorney-card">
                    <div className="rating">⭐ {offer.attorney.rating}</div>
                    <div className="experience">{offer.attorney.yearsExperience} years experience</div>
                    <div className="location">📍 {offer.attorney.location}</div>
                  </div>

                  {offer.message && (
                    <div className="message">
                      <h5>Message:</h5>
                      <p>{offer.message}</p>
                    </div>
                  )}

                  <div className="response-time">
                    ⏱️ Responded in {offer.responseTime}
                  </div>

                  {offer.status === 'quoted' && (
                    <div className="offer-actions">
                      <button
                        className="btn-accept"
                        onClick={() => onAcceptOffer?.(offer.id)}
                      >
                        ✓ Accept This Offer
                      </button>
                      <button
                        className="btn-contact"
                        onClick={() => onContactAttorney?.(offer.attorney.id)}
                      >
                        💬 Send Message
                      </button>
                    </div>
                  )}

                  {offer.status === 'pending' && (
                    <div className="pending-info">
                      <p>⏳ Waiting for attorney response...</p>
                    </div>
                  )}

                  {offer.status === 'rejected' && (
                    <div className="rejected-info">
                      <p>❌ This attorney is not able to take on your case at this time.</p>
                      <button
                        className="btn-contact"
                        onClick={() => onContactAttorney?.(offer.attorney.id)}
                      >
                        💬 Ask for Referral
                      </button>
                    </div>
                  )}

                  {(offer.status === 'accepted' || offer.status === 'retained') && (
                    <div className="retained-info">
                      <p>🎯 You have retained this attorney for your case.</p>
                      <button
                        className="btn-contact"
                        onClick={() => onContactAttorney?.(offer.attorney.id)}
                      >
                        💬 Send Message
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredOffers.length === 0 && (
        <div className="empty-state">
          <p>No responses yet. Check back soon!</p>
        </div>
      )}
    </div>
  );
};

export default OfferDisplay;
