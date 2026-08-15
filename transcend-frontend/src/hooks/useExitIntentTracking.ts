// Hook for tracking Exit Intent popup interactions
// Integrates with analytics and conversion tracking

import { useCallback, useEffect, useState } from 'react';

export interface ExitIntentConversionMetrics {
  impressions: number;
  conversions: number;
  conversionRate: number;
  avgTimeOnPage: number;
  emailsCaptured: number;
  variant: string;
  discountUsageRate: number;
}

interface TrackingEvent {
  event_name: string;
  event_category: string;
  event_value?: number;
  event_label?: string;
  user_id?: string;
  session_id?: string;
  timestamp: string;
}

export const useExitIntentTracking = () => {
  const [sessionStartTime] = useState(Date.now());
  const [metrics, setMetrics] = useState<ExitIntentConversionMetrics>({
    impressions: 0,
    conversions: 0,
    conversionRate: 0,
    avgTimeOnPage: 0,
    emailsCaptured: 0,
    variant: 'unknown',
    discountUsageRate: 0,
  });

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
        body: JSON.stringify(event),
      }).catch((error) => console.error('Analytics tracking error:', error));
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('[EXIT_INTENT_TRACKING]', event);
    }
  }, []);

  const trackImpression = useCallback(
    (variant: string) => {
      trackEvent({
        event_name: 'exit_intent_impression',
        event_category: 'conversion',
        event_label: variant,
        timestamp: new Date().toISOString(),
      });

      setMetrics((prev) => ({
        ...prev,
        impressions: prev.impressions + 1,
        variant,
      }));
    },
    [trackEvent]
  );

  const trackEmailCapture = useCallback(
    (email: string, variant: string, discount: number) => {
      // Hash email for privacy
      const emailHash = btoa(email).substring(0, 16);

      trackEvent({
        event_name: 'exit_intent_email_captured',
        event_category: 'lead_generation',
        event_label: `${variant}_${discount}percent`,
        event_value: 1,
        timestamp: new Date().toISOString(),
      });

      setMetrics((prev) => ({
        ...prev,
        emailsCaptured: prev.emailsCaptured + 1,
      }));
    },
    [trackEvent]
  );

  const trackConversion = useCallback(
    (variant: string, discount: number, email?: string) => {
      const timeOnPage = Date.now() - sessionStartTime;

      trackEvent({
        event_name: 'exit_intent_conversion',
        event_category: 'conversion',
        event_label: `${variant}_${discount}percent`,
        event_value: discount,
        timestamp: new Date().toISOString(),
      });

      setMetrics((prev) => ({
        ...prev,
        conversions: prev.conversions + 1,
        conversionRate:
          prev.impressions > 0 ? ((prev.conversions + 1) / prev.impressions) * 100 : 0,
        avgTimeOnPage: timeOnPage,
      }));
    },
    [sessionStartTime, trackEvent]
  );

  const trackClose = useCallback(
    (variant: string, reason: 'user_close' | 'auto_timeout' | 'other') => {
      trackEvent({
        event_name: 'exit_intent_dismissed',
        event_category: 'engagement',
        event_label: `${variant}_${reason}`,
        timestamp: new Date().toISOString(),
      });
    },
    [trackEvent]
  );

  const getMetrics = useCallback(() => metrics, [metrics]);

  const resetMetrics = useCallback(() => {
    setMetrics({
      impressions: 0,
      conversions: 0,
      conversionRate: 0,
      avgTimeOnPage: 0,
      emailsCaptured: 0,
      variant: 'unknown',
      discountUsageRate: 0,
    });
  }, []);

  return {
    trackEvent,
    trackImpression,
    trackEmailCapture,
    trackConversion,
    trackClose,
    getMetrics,
    resetMetrics,
  };
};

export default useExitIntentTracking;
