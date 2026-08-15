// Personalized UI Component
// Features: Segment-specific CTAs, personalized journeys, A/B testing, analytics

import React, { useEffect, useState } from 'react';
import './PersonalizedUI.css';

// ============================================
// TYPES & INTERFACES
// ============================================

interface UserSegment {
  id: string;
  lifecycle: 'new' | 'active' | 'at-risk' | 'loyal' | 'churned';
  value: 'high' | 'medium' | 'low';
  engagement: 'high' | 'medium' | 'low' | 'inactive';
  serviceTypes: string[];
}

interface CTA {
  id: string;
  action: string;
  text: string;
  priority: 'high' | 'medium' | 'low';
  conversionRate?: number;
  variant?: string;
}

interface PersonalizedJourney {
  journeyStage: string;
  recommendedContent: ContentRecommendation[];
  nextSteps: string[];
  estimatedTimeToConversion: number;
  successProbability: number;
}

interface ContentRecommendation {
  id: string;
  title: string;
  description: string;
  type: 'guide' | 'video' | 'case-study' | 'webinar' | 'resource';
  relevanceScore: number;
  estimatedReadTime: number;
}

interface PersonalizedUIProps {
  userId?: string;
  onCTAClick?: (cta: CTA) => void;
  variant?: 'card' | 'banner' | 'modal' | 'inline';
  showAnalytics?: boolean;
}

// ============================================
// PERSONALIZED UI COMPONENT
// ============================================

const PersonalizedUI: React.FC<PersonalizedUIProps> = ({
  userId,
  onCTAClick,
  variant = 'card',
  showAnalytics = true,
}) => {
  // State management
  const [segment, setSegment] = useState<UserSegment | null>(null);
  const [journey, setJourney] = useState<PersonalizedJourney | null>(null);
  const [ctas, setCTAs] = useState<CTA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCTA, setSelectedCTA] = useState<CTA | null>(null);
  const [showJourney, setShowJourney] = useState(false);
  const [analytics, setAnalytics] = useState({
    ctasShown: 0,
    ctasClicked: 0,
    conversionRate: 0,
  });

  // Fetch personalization data on mount
  useEffect(() => {
    if (!userId) {
      const storedUserId = localStorage.getItem('userId');
      if (!storedUserId) {
        setError('No user ID provided');
        setLoading(false);
        return;
      }
    }

    const currentUserId = userId || localStorage.getItem('userId') || '';
    fetchPersonalizationData(currentUserId);
  }, [userId]);

  /**
   * Fetch user segmentation and personalization data
   */
  const fetchPersonalizationData = async (currentUserId: string) => {
    try {
      setLoading(true);

      // Fetch user segment
      const segmentResponse = await fetch(
        `/api/v2/personalization/segment/${currentUserId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (!segmentResponse.ok) {
        throw new Error('Failed to fetch user segment');
      }

      const segmentData = await segmentResponse.json();
      setSegment(segmentData);

      // Fetch personalized CTAs
      const ctasResponse = await fetch(
        `/api/v2/personalization/ctas/${currentUserId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (ctasResponse.ok) {
        const ctasData = await ctasResponse.json();
        setCTAs(ctasData);

        // Track CTA impressions
        ctasData.forEach((cta: CTA) => {
          trackCTAInteraction(currentUserId, cta.id, 'shown');
        });
      }

      // Fetch personalized journey
      const journeyResponse = await fetch(
        `/api/v2/personalization/journey/${currentUserId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );

      if (journeyResponse.ok) {
        const journeyData = await journeyResponse.json();
        setJourney(journeyData);
      }

      // Fetch analytics
      if (showAnalytics) {
        const analyticsResponse = await fetch(
          `/api/v2/personalization/analytics/${currentUserId}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            },
          }
        );

        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          setAnalytics(analyticsData);
        }
      }

      setError(null);
    } catch (err) {
      console.error('Error fetching personalization data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Track CTA interactions
   */
  const trackCTAInteraction = async (
    currentUserId: string,
    ctaId: string,
    action: 'shown' | 'clicked' | 'converted'
  ) => {
    try {
      const response = await fetch('/api/v2/personalization/track-cta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          userId: currentUserId,
          ctaId,
          action,
          timestamp: new Date(),
        }),
      });

      if (response.ok && action === 'clicked') {
        setAnalytics((prev) => ({
          ...prev,
          ctasClicked: prev.ctasClicked + 1,
          conversionRate: (prev.ctasClicked + 1) / (prev.ctasShown || 1),
        }));
      }
    } catch (error) {
      console.error('Error tracking CTA interaction:', error);
    }
  };

  /**
   * Handle CTA click
   */
  const handleCTAClick = async (cta: CTA) => {
    const currentUserId = userId || localStorage.getItem('userId') || '';
    await trackCTAInteraction(currentUserId, cta.id, 'clicked');
    setSelectedCTA(cta);

    if (onCTAClick) {
      onCTAClick(cta);
    }

    // Navigate based on action
    navigateToCTA(cta.action);
  };

  /**
   * Navigate based on CTA action
   */
  const navigateToCTA = (action: string) => {
    const actionMap: Record<string, string> = {
      complete_onboarding: '/onboarding',
      upgrade_plan: '/upgrade',
      retention_offer: '/offers',
      vip_program: '/vip',
      explore_services: '/services',
      schedule_consultation: '/consultation',
      view_resources: '/resources',
    };

    if (actionMap[action]) {
      window.location.href = actionMap[action];
    }
  };

  /**
   * Get segment-specific styling
   */
  const getSegmentStyle = () => {
    if (!segment) return {};

    const styleMap: Record<string, React.CSSProperties> = {
      new: { borderLeft: '4px solid #3498db' },
      active: { borderLeft: '4px solid #2ecc71' },
      'at-risk': { borderLeft: '4px solid #e74c3c' },
      loyal: { borderLeft: '4px solid #f39c12' },
      churned: { borderLeft: '4px solid #95a5a6' },
    };

    return styleMap[segment.lifecycle] || {};
  };

  /**
   * Get segment badge color
   */
  const getSegmentBadgeColor = () => {
    if (!segment) return '';

    const colorMap: Record<string, string> = {
      new: 'badge-new',
      active: 'badge-active',
      'at-risk': 'badge-at-risk',
      loyal: 'badge-loyal',
      churned: 'badge-churned',
    };

    return colorMap[segment.lifecycle] || '';
  };

  /**
   * Render card variant
   */
  const renderCard = () => (
    <div className="personalized-card" style={getSegmentStyle()}>
      {segment && (
        <div className="card-header">
          <h3>Welcome Back, {segment.lifecycle === 'new' ? 'New Member' : 'Member'}!</h3>
          <span className={`segment-badge ${getSegmentBadgeColor()}`}>
            {segment.lifecycle.replace('-', ' ').toUpperCase()}
          </span>
        </div>
      )}

      {ctas.length > 0 && (
        <div className="ctas-section">
          <h4>Recommended Actions</h4>
          <div className="ctas-list">
            {ctas.map((cta) => (
              <button
                key={cta.id}
                className={`cta-button cta-${cta.priority}`}
                onClick={() => handleCTAClick(cta)}
              >
                <span className="cta-text">{cta.text}</span>
                {cta.conversionRate && (
                  <span className="conversion-rate">
                    {(cta.conversionRate * 100).toFixed(0)}% convert
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {journey && (
        <div className="journey-section">
          <button
            className="journey-toggle"
            onClick={() => setShowJourney(!showJourney)}
          >
            {showJourney ? 'Hide' : 'Show'} Your Journey
          </button>

          {showJourney && renderJourney()}
        </div>
      )}

      {showAnalytics && (
        <div className="analytics-section">
          <h4>Your Activity</h4>
          <div className="analytics-grid">
            <div className="metric">
              <span className="metric-label">CTAs Shown</span>
              <span className="metric-value">{analytics.ctasShown}</span>
            </div>
            <div className="metric">
              <span className="metric-label">CTAs Clicked</span>
              <span className="metric-value">{analytics.ctasClicked}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Conversion Rate</span>
              <span className="metric-value">
                {(analytics.conversionRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /**
   * Render banner variant
   */
  const renderBanner = () => (
    <div className="personalized-banner" style={getSegmentStyle()}>
      {segment && (
        <div className="banner-content">
          <div className="banner-text">
            <h4>{segment.lifecycle === 'new' ? 'Get Started' : 'Continue Your Journey'}</h4>
            <p>
              {segment.lifecycle === 'at-risk'
                ? 'We miss you! Check out our latest offer.'
                : segment.lifecycle === 'loyal'
                  ? 'Thanks for your loyalty! Explore premium options.'
                  : 'Discover what you can do next.'}
            </p>
          </div>

          {ctas.length > 0 && (
            <button
              className="banner-cta"
              onClick={() => handleCTAClick(ctas[0])}
            >
              {ctas[0].text}
            </button>
          )}
        </div>
      )}
    </div>
  );

  /**
   * Render journey details
   */
  const renderJourney = () => (
    <div className="journey-details">
      {journey && (
        <>
          <div className="journey-stage">
            <h5>Current Stage: {journey.journeyStage}</h5>
            <div className="stage-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${journey.successProbability}%`,
                  }}
                ></div>
              </div>
              <span className="progress-text">
                {journey.successProbability}% success probability
              </span>
            </div>
          </div>

          {journey.recommendedContent.length > 0 && (
            <div className="content-recommendations">
              <h5>Recommended Resources</h5>
              <div className="content-list">
                {journey.recommendedContent.slice(0, 3).map((content) => (
                  <div key={content.id} className="content-item">
                    <div className="content-header">
                      <h6>{content.title}</h6>
                      <span className="content-type">{content.type}</span>
                    </div>
                    <p>{content.description}</p>
                    <span className="read-time">
                      Est. {content.estimatedReadTime} min read
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {journey.nextSteps.length > 0 && (
            <div className="next-steps">
              <h5>Next Steps</h5>
              <ol>
                {journey.nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="conversion-estimate">
            <span>Est. time to conversion: {journey.estimatedTimeToConversion} days</span>
          </div>
        </>
      )}
    </div>
  );

  /**
   * Render modal variant
   */
  const renderModal = () => (
    <div className="personalized-modal-overlay">
      <div className="personalized-modal" style={getSegmentStyle()}>
        <button
          className="modal-close"
          onClick={() => {
            /* Close modal */
          }}
        >
          ×
        </button>

        {segment && (
          <div className="modal-content">
            <h2>Personalized Experience</h2>
            <p className="segment-description">
              {segment.lifecycle === 'new'
                ? 'Welcome! Get started with these recommended actions.'
                : segment.lifecycle === 'at-risk'
                  ? 'We noticed you have been less active. Check out these special offers.'
                  : 'Based on your activity, we recommend these next steps.'}
            </p>

            {renderCard()}
          </div>
        )}
      </div>
    </div>
  );

  /**
   * Render inline variant
   */
  const renderInline = () => (
    <div className="personalized-inline">
      {segment && (
        <>
          <div className="inline-segment">
            <span className={`badge ${getSegmentBadgeColor()}`}>
              {segment.lifecycle}
            </span>
          </div>

          {ctas.length > 0 && (
            <div className="inline-ctas">
              {ctas.slice(0, 2).map((cta) => (
                <button
                  key={cta.id}
                  className="inline-cta-button"
                  onClick={() => handleCTAClick(cta)}
                >
                  {cta.text}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="personalized-loading">
        <div className="spinner"></div>
        <p>Loading personalized experience...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="personalized-error">
        <p>Unable to load personalized experience: {error}</p>
      </div>
    );
  }

  // Render based on variant
  switch (variant) {
    case 'banner':
      return renderBanner();
    case 'modal':
      return renderModal();
    case 'inline':
      return renderInline();
    case 'card':
    default:
      return renderCard();
  }
};

export default PersonalizedUI;
