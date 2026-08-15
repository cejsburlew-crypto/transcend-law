// Exit Intent Popup Component
// Detects users about to leave and displays targeted discount offer

import React, { useState, useEffect, useRef } from 'react';
import './ExitIntent.css';

interface ExitIntentProps {
  discount?: number;
  onClose?: () => void;
  onConvert?: (variant: string, discount: number) => void;
  enabled?: boolean;
  delay?: number;
  threshold?: number;
}

type ABTestVariant = 'control' | 'variant_a' | 'variant_b';

interface ConversionEvent {
  timestamp: Date;
  variant: ABTestVariant;
  action: 'impression' | 'click_cta' | 'close' | 'convert';
  discount: number;
}

export const ExitIntent: React.FC<ExitIntentProps> = ({
  discount = 20,
  onClose,
  onConvert,
  enabled = true,
  delay = 2000,
  threshold = 50,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [variant, setVariant] = useState<ABTestVariant>('control');
  const [email, setEmail] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionEvents, setConversionEvents] = useState<ConversionEvent[]>([]);
  const mouseDownTimeRef = useRef<number>(0);
  const triggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize A/B test variant
  useEffect(() => {
    const selectedVariant: ABTestVariant = (['control', 'variant_a', 'variant_b'] as const)[
      Math.floor(Math.random() * 3)
    ];
    setVariant(selectedVariant);

    // Track impression
    trackEvent('impression', selectedVariant, discount);
  }, [discount]);

  const trackEvent = (
    action: ConversionEvent['action'],
    testVariant: ABTestVariant,
    value: number
  ) => {
    const event: ConversionEvent = {
      timestamp: new Date(),
      variant: testVariant,
      action,
      discount: value,
    };
    setConversionEvents((prev) => [...prev, event]);

    // Send to analytics
    if (window.gtag) {
      window.gtag('event', `exit_intent_${action}`, {
        variant: testVariant,
        discount: value,
        timestamp: event.timestamp.toISOString(),
      });
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    if (!enabled || hasTriggered) return;

    // Only trigger if mouse is leaving from top of page
    if (e.clientY <= threshold) {
      mouseDownTimeRef.current = Date.now();

      // Debounce trigger
      if (triggerTimeoutRef.current) {
        clearTimeout(triggerTimeoutRef.current);
      }

      triggerTimeoutRef.current = setTimeout(() => {
        if (!hasTriggered) {
          setIsVisible(true);
          setHasTriggered(true);
          trackEvent('impression', variant, discount);
        }
      }, delay);
    }
  };

  const handleMouseEnter = () => {
    // Cancel pending trigger if mouse comes back
    if (triggerTimeoutRef.current) {
      clearTimeout(triggerTimeoutRef.current);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    trackEvent('close', variant, discount);
    onClose?.();
  };

  const handleCTAClick = async () => {
    setIsConverting(true);
    trackEvent('click_cta', variant, discount);

    // Simulate email capture or redirect to offer page
    try {
      // Here you would typically send the email to your backend
      console.log('Capturing email:', email);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      trackEvent('convert', variant, discount);
      onConvert?.(variant, discount);

      // Show success message
      const successMsg = document.createElement('div');
      successMsg.className = 'exit-intent-success-message';
      successMsg.textContent = `Check your email for your ${discount}% discount code!`;
      document.body.appendChild(successMsg);

      setTimeout(() => {
        setIsVisible(false);
        successMsg.remove();
      }, 2000);
    } catch (error) {
      console.error('Conversion error:', error);
      setIsConverting(false);
    }
  };

  const renderVariant = () => {
    const commonOffer = `Save ${discount}% on your next booking`;

    switch (variant) {
      case 'variant_a':
        return (
          <div className="exit-intent-modal-variant-a">
            <div className="exit-intent-header">
              <h2>Wait! Don't miss out</h2>
              <button className="exit-intent-close-btn" onClick={handleClose}>
                ✕
              </button>
            </div>

            <div className="exit-intent-content">
              <div className="exit-intent-emoji">🎁</div>
              <p className="exit-intent-heading">{commonOffer}</p>
              <p className="exit-intent-subheading">
                Limited time offer - Use code <strong>SAVE{discount}</strong>
              </p>

              <div className="exit-intent-benefits">
                <div className="benefit-item">✓ Instant access to attorneys</div>
                <div className="benefit-item">✓ {discount}% off first service</div>
                <div className="benefit-item">✓ Money-back guarantee</div>
              </div>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="exit-intent-email-input"
                disabled={isConverting}
              />

              <button
                className="exit-intent-cta-btn"
                onClick={handleCTAClick}
                disabled={!email || isConverting}
              >
                {isConverting ? 'Processing...' : `Get ${discount}% Off Now`}
              </button>

              <p className="exit-intent-footer">No spam. Unsubscribe anytime.</p>
            </div>
          </div>
        );

      case 'variant_b':
        return (
          <div className="exit-intent-modal-variant-b">
            <div className="exit-intent-header-minimal">
              <button className="exit-intent-close-btn" onClick={handleClose}>
                ✕
              </button>
            </div>

            <div className="exit-intent-content-compact">
              <div className="exit-intent-stat">
                <div className="stat-number">{discount}%</div>
                <div className="stat-label">Off Your First Service</div>
              </div>

              <h3 className="exit-intent-heading-compact">Don't leave yet!</h3>

              <div className="exit-intent-urgency">
                <span className="urgency-badge">Limited Time</span>
                <p>500+ attorneys used Transcend this week</p>
              </div>

              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="exit-intent-email-input-compact"
                disabled={isConverting}
              />

              <button
                className="exit-intent-cta-btn-compact"
                onClick={handleCTAClick}
                disabled={!email || isConverting}
              >
                {isConverting ? '...' : 'Claim Offer'}
              </button>
            </div>
          </div>
        );

      default: // control
        return (
          <div className="exit-intent-modal-control">
            <div className="exit-intent-header">
              <h2>Before you go...</h2>
              <button className="exit-intent-close-btn" onClick={handleClose}>
                ✕
              </button>
            </div>

            <div className="exit-intent-content">
              <p className="exit-intent-main-copy">
                Get {discount}% off your first legal service with Transcend
              </p>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="exit-intent-email-input"
                disabled={isConverting}
              />

              <button
                className="exit-intent-cta-btn"
                onClick={handleCTAClick}
                disabled={!email || isConverting}
              >
                {isConverting ? 'Processing...' : 'Get Discount Code'}
              </button>

              <button className="exit-intent-skip-btn" onClick={handleClose}>
                No thanks
              </button>
            </div>
          </div>
        );
    }
  };

  if (!isVisible) {
    return (
      <div onMouseLeave={handleMouseLeave} onMouseEnter={handleMouseEnter}>
        {/* This empty div allows us to track mouse movement at document level */}
      </div>
    );
  }

  return (
    <>
      <div className="exit-intent-overlay" onClick={handleClose} />
      <div className="exit-intent-modal" role="dialog" aria-modal="true">
        {renderVariant()}

        {/* A/B Test Indicator (development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="exit-intent-debug" style={{ fontSize: '10px', padding: '8px' }}>
            Variant: {variant}
          </div>
        )}
      </div>
    </>
  );
};

export default ExitIntent;
