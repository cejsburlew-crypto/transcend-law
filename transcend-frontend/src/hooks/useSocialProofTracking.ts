// Hook for tracking Social Proof widget interactions
// Measures engagement, CTR, and conversion impact

import { useCallback, useState, useEffect } from 'react';

export interface SocialProofMetrics {
  impressions: number;
  expansions: number;
  clicks: number;
  engagement_rate: number;
  avg_time_engaged: number;
  position: string;
  variant: string;
  conversion_value: number;
}

interface TrackingEvent {
  event_name: string;
  event_category: string;
  event_value?: number;
  event_label?: string;
  timestamp: string;
}

export const useSocialProofTracking = () => {
  const [metrics, setMetrics] = useState<SocialProofMetrics>({
    impressions: 0,
    expansions: 0,
    clicks: 0,
    engagement_rate: 0,
    avg_time_engaged: 0,
    position: 'unknown',
    variant: 'unknown',
    conversion_value: 0,
  });

  const [engagementStartTime, setEngagementStartTime] = useState<number | null>(null);

  const trackEvent = useCallback((event: TrackingEvent) => {
    // Send to Google Analytics
    if (window.gtag) {
      window.gtag('event', event.event_name, {
        event_category: event.event_category,
        event_value: event.event_value,
        event_label: event.event_label,
      });
    }

    // Send to custom backend
    if (process.env.REACT_APP_ANALYTICS_ENDPOINT) {
      fetch(process.env.REACT_APP_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: 'social_proof',
          ...event,
        }),
      }).catch((error) => console.error('Analytics tracking error:', error));
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[SOCIAL_PROOF_TRACKING]', event);
    }
  }, []);

  const trackImpression = useCallback(
    (position: string, variant: string) => {
      trackEvent({
        event_name: 'social_proof_impression',
        event_category: 'engagement',
        event_label: `${position}_${variant}`,
        timestamp: new Date().toISOString(),
      });

      setMetrics((prev) => ({
        ...prev,
        impressions: prev.impressions + 1,
        position,
        variant,
      }));
    },
    [trackEvent]
  );

  const trackExpansion = useCallback(
    (position: string, variant: string) => {
      setEngagementStartTime(Date.now());

      trackEvent({
        event_name: 'social_proof_expanded',
        event_category: 'engagement',
        event_label: `${position}_${variant}`,
        event_value: 1,
        timestamp: new Date().toISOString(),
      });

      setMetrics((prev) => ({
        ...prev,
        expansions: prev.expansions + 1,
        engagement_rate:
          prev.impressions > 0 ? ((prev.expansions + 1) / prev.impressions) * 100 : 0,
      }));
    },
    [trackEvent]
  );

  const trackClick = useCallback(
    (position: string, variant: string, action: string) => {
      trackEvent({
        event_name: 'social_proof_click',
        event_category: 'interaction',
        event_label: `${position}_${variant}_${action}`,
        event_value: 1,
        timestamp: new Date().toISOString(),
      });

      setMetrics((prev) => ({
        ...prev,
        clicks: prev.clicks + 1,
      }));
    },
    [trackEvent]
  );

  const trackCTAClick = useCallback(
    (position: string, variant: string) => {
      trackEvent({
        event_name: 'social_proof_cta_click',
        event_category: 'conversion',
        event_label: `${position}_${variant}`,
        event_value: 1,
        timestamp: new Date().toISOString(),
      });

      setMetrics((prev) => ({
        ...prev,
        clicks: prev.clicks + 1,
        conversion_value: prev.conversion_value + 1,
      }));
    },
    [trackEvent]
  );

  const recordEngagementTime = useCallback(() => {
    if (engagementStartTime) {
      const timeEngaged = Date.now() - engagementStartTime;

      setMetrics((prev) => ({
        ...prev,
        avg_time_engaged: Math.round(timeEngaged / 1000), // Convert to seconds
      }));

      setEngagementStartTime(null);
    }
  }, [engagementStartTime]);

  const trackActivityFeed = useCallback(
    (activity_type: string, position: string) => {
      trackEvent({
        event_name: 'social_proof_activity_view',
        event_category: 'engagement',
        event_label: `${activity_type}_${position}`,
        timestamp: new Date().toISOString(),
      });
    },
    [trackEvent]
  );

  const trackStatView = useCallback(
    (stat_name: string, stat_value: string, position: string) => {
      trackEvent({
        event_name: 'social_proof_stat_view',
        event_category: 'engagement',
        event_label: `${stat_name}_${stat_value}_${position}`,
        timestamp: new Date().toISOString(),
      });
    },
    [trackEvent]
  );

  const getMetrics = useCallback(() => metrics, [metrics]);

  const resetMetrics = useCallback(() => {
    setMetrics({
      impressions: 0,
      expansions: 0,
      clicks: 0,
      engagement_rate: 0,
      avg_time_engaged: 0,
      position: 'unknown',
      variant: 'unknown',
      conversion_value: 0,
    });
  }, []);

  return {
    trackEvent,
    trackImpression,
    trackExpansion,
    trackClick,
    trackCTAClick,
    trackActivityFeed,
    trackStatView,
    recordEngagementTime,
    getMetrics,
    resetMetrics,
  };
};

export default useSocialProofTracking;
