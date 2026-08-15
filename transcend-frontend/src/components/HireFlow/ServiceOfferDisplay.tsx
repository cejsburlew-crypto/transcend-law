// ServiceOfferDisplay Component
// Shows provider offers to client - accept/reject flow

import React, { useState, useEffect } from 'react';
import './ServiceOfferDisplay.css';

interface ServiceOffer {
  id: number;
  intake_form_id: number;
  provider_company_id: number;
  provider_name: string;
  provider_rating?: number;
  provider_review_count?: number;
  hourly_rate?: number;
  estimated_hours?: number;
  estimated_total?: number;
  mandatory_retention?: boolean;
  retention_amount?: number;
  retention_due_date?: string;
  has_spending_limit?: boolean;
  spending_limit?: number;
  spending_limit_date?: string;
  offer_message?: string;
  status: 'pending' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  expires_at?: string;
  created_at: string;
}

interface ServiceOfferDisplayProps {
  intakeFormId: number;
  serviceName: string;
  onOfferAccepted?: (offerId: number, providerId: number) => void;
  onOfferRejected?: (offerId: number) => void;
  className?: string;
}

export const ServiceOfferDisplay: React.FC<ServiceOfferDisplayProps> = ({
  intakeFormId,
  serviceName,
  onOfferAccepted,
  onOfferRejected,
  className = '',
}) => {
  const [offers, setOffers] = useState<ServiceOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    fetchOffers();
    const interval = setInterval(fetchOffers, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [intakeFormId]);

  const fetchOffers = async () => {
    try {
      const response = await fetch(
        `/api/v2/intake-forms/${intakeFormId}/offers`
      );
      const data = await response.json();

      if (data.success) {
        setOffers(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch offers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offer: ServiceOffer) => {
    setProcessingId(offer.id);

    try {
      onOfferAccepted?.(offer.id, offer.provider_company_id);

      // Optionally call API
      // await fetch(`/api/v2/service-offers/${offer.id}/accept`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to accept offer:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectOffer = async (offerId: number) => {
    setProcessingId(offerId);

    try {
      onOfferRejected?.(offerId);

      // Optionally call API
      // await fetch(`/api/v2/service-offers/${offerId}/reject`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to reject offer:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="status-badge pending">Pending Review</span>;
      case 'viewed':
        return <span className="status-badge viewed">Viewed</span>;
      case 'accepted':
        return <span className="status-badge accepted">✓ Accepted</span>;
      case 'rejected':
        return <span className="status-badge rejected">✗ Rejected</span>;
      case 'expired':
        return <span className="status-badge expired">Expired</span>;
      default:
        return null;
    }
  };

  const getTimeRemaining = (expiresAt: string | undefined) => {
    if (!expiresAt) return null;

    const expireDate = new Date(expiresAt);
    const now = new Date();
    const diff = expireDate.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);

    if (days > 0) return `${days} day${days !== 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} left`;

    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} left`;
  };

  if (loading) {
    return (
      <div className={`offers-container ${className}`}>
        <div className="offers-loading">Loading offers...</div>
      </div>
    );
  }

  const activeOffers = offers.filter((o) => !['rejected', 'expired'].includes(o.status));
  const acceptedOffers = offers.filter((o) => o.status === 'accepted');
  const rejectedOffers = offers.filter((o) => ['rejected', 'expired'].includes(o.status));

  return (
    <div className={`offers-container ${className}`}>
      {/* Header */}
      <div className="offers-header">
        <div className="offers-title-section">
          <h2 className="offers-title">Service Offers</h2>
          <p className="offers-subtitle">
            {activeOffers.length} provider{activeOffers.length !== 1 ? 's' : ''} submitted
            offer{activeOffers.length !== 1 ? 's' : ''} for {serviceName}
          </p>
        </div>
        <div className="offers-count">
          <span className="count-badge">{activeOffers.length}</span>
        </div>
      </div>

      {/* Active Offers */}
      {activeOffers.length > 0 ? (
        <div className="offers-section">
          <h3 className="section-title">Active Offers</h3>
          <div className="offers-list">
            {activeOffers.map((offer) => (
              <div
                key={offer.id}
                className={`offer-card ${selectedOfferId === offer.id ? 'selected' : ''}`}
                onClick={() => setSelectedOfferId(offer.id)}
              >
                {/* Provider Info */}
                <div className="offer-header">
                  <div className="provider-info">
                    <h4 className="provider-name">{offer.provider_name}</h4>
                    {offer.provider_rating && (
                      <div className="provider-rating">
                        <span className="stars">
                          {'★'.repeat(Math.floor(offer.provider_rating))}
                        </span>
                        <span className="rating-value">
                          {offer.provider_rating.toFixed(1)} ({offer.provider_review_count || 0})
                        </span>
                      </div>
                    )}
                  </div>
                  {getStatusBadge(offer.status)}
                </div>

                {/* Price & Terms */}
                <div className="offer-pricing">
                  {offer.hourly_rate && (
                    <div className="pricing-line">
                      <span className="label">Hourly Rate:</span>
                      <span className="value">{formatCurrency(offer.hourly_rate)}/hr</span>
                    </div>
                  )}

                  {offer.estimated_hours && (
                    <div className="pricing-line">
                      <span className="label">Estimated Hours:</span>
                      <span className="value">{offer.estimated_hours} hrs</span>
                    </div>
                  )}

                  {offer.estimated_total && (
                    <div className="pricing-line highlight">
                      <span className="label">Estimated Total:</span>
                      <span className="value total">
                        {formatCurrency(offer.estimated_total)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Requirements */}
                {(offer.mandatory_retention || offer.has_spending_limit) && (
                  <div className="offer-requirements">
                    {offer.mandatory_retention && (
                      <div className="requirement">
                        <span className="requirement-label">💰 Mandatory Retention:</span>
                        <span className="requirement-value">
                          {formatCurrency(offer.retention_amount || 0)} due{' '}
                          {offer.retention_due_date ? formatDate(offer.retention_due_date) : 'TBD'}
                        </span>
                      </div>
                    )}

                    {offer.has_spending_limit && (
                      <div className="requirement">
                        <span className="requirement-label">🎯 Spending Limit:</span>
                        <span className="requirement-value">
                          {formatCurrency(offer.spending_limit || 0)}{' '}
                          {offer.spending_limit_date ? `by ${formatDate(offer.spending_limit_date)}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Message */}
                {offer.offer_message && (
                  <div className="offer-message">
                    <p className="message-label">Provider Message:</p>
                    <p className="message-text">{offer.offer_message}</p>
                  </div>
                )}

                {/* Expiration */}
                {offer.expires_at && (
                  <div className="offer-expiration">
                    ⏰ {getTimeRemaining(offer.expires_at)}
                  </div>
                )}

                {/* Actions */}
                <div className="offer-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRejectOffer(offer.id);
                    }}
                    disabled={processingId === offer.id}
                  >
                    Decline
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAcceptOffer(offer);
                    }}
                    disabled={processingId === offer.id}
                  >
                    {processingId === offer.id ? 'Processing...' : 'Accept Offer'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="offers-empty">
          <p>⏳ No offers yet. Providers will see your request and submit offers shortly.</p>
          <p className="empty-hint">Check back in a few minutes or refresh this page.</p>
        </div>
      )}

      {/* Accepted Offers */}
      {acceptedOffers.length > 0 && (
        <div className="offers-section">
          <h3 className="section-title">Accepted</h3>
          <div className="offers-list">
            {acceptedOffers.map((offer) => (
              <div key={offer.id} className="offer-card accepted-card">
                <div className="offer-header">
                  <h4 className="provider-name">{offer.provider_name}</h4>
                  {getStatusBadge(offer.status)}
                </div>
                <div className="offer-pricing">
                  <div className="pricing-line highlight">
                    <span className="label">Total:</span>
                    <span className="value total">
                      {offer.estimated_total ? formatCurrency(offer.estimated_total) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected/Expired Offers */}
      {rejectedOffers.length > 0 && (
        <div className="offers-section collapsed">
          <h3 className="section-title">Declined/Expired ({rejectedOffers.length})</h3>
          <div className="offers-list">
            {rejectedOffers.map((offer) => (
              <div key={offer.id} className="offer-card rejected-card">
                <div className="offer-header">
                  <h4 className="provider-name">{offer.provider_name}</h4>
                  {getStatusBadge(offer.status)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceOfferDisplay;
