# Exit Intent & Social Proof Widgets Integration Guide

## Overview

This guide covers the implementation of two high-impact conversion widgets:

1. **Exit Intent Popup** - Captures leaving visitors with targeted discount offers
2. **Social Proof Widget** - Displays real-time activity and FOMO messaging

Both components are production-ready with A/B testing, analytics tracking, and mobile optimization.

---

## 1. Exit Intent Popup

### Features

- **Three A/B Test Variants:**
  - `control`: Standard 2-button approach (Get Discount Code / No Thanks)
  - `variant_a`: Benefit-focused with emoji, features list, urgency messaging
  - `variant_b`: Compact, urgency-driven with stat emphasis

- **Mouse Exit Detection**: Triggers when user's mouse leaves toward top of page
- **Customizable Discount**: 20% by default, configurable per instance
- **Email Capture**: Collects email before offering discount code
- **Analytics Integration**: Tracks impressions, conversions, abandonment
- **Mobile Responsive**: Bottom-sheet style on mobile devices

### Basic Implementation

```typescript
import ExitIntent from '@/components/ExitIntent';

function App() {
  const handleConvert = (variant: string, discount: number) => {
    console.log(`Conversion: Variant ${variant}, ${discount}% discount`);
    // Track conversion, send email confirmation, etc.
  };

  const handleClose = () => {
    console.log('User closed exit intent popup');
  };

  return (
    <div>
      {/* Your app content */}
      <ExitIntent
        discount={20}
        enabled={true}
        delay={2000}
        threshold={50}
        onConvert={handleConvert}
        onClose={handleClose}
      />
    </div>
  );
}
```

### Props Reference

```typescript
interface ExitIntentProps {
  discount?: number;           // Default: 20
  onClose?: () => void;        // Called when user closes popup
  onConvert?: (variant: string, discount: number) => void;  // Called on conversion
  enabled?: boolean;           // Default: true
  delay?: number;              // Default: 2000ms - wait before showing
  threshold?: number;          // Default: 50px - y-position to trigger exit
}
```

### Advanced: A/B Testing Setup

```typescript
import ExitIntent from '@/components/ExitIntent';
import { useExitIntentTracking } from '@/hooks/useExitIntentTracking';

function HomePage() {
  const { trackImpression, trackConversion, getMetrics } = useExitIntentTracking();

  const handleConvert = (variant: string, discount: number) => {
    trackConversion(variant, discount);
    // Proceed with discount code delivery
  };

  useEffect(() => {
    // Log metrics every 5 minutes
    const interval = setInterval(() => {
      const metrics = getMetrics();
      console.log('Exit Intent Metrics:', metrics);
      
      if (metrics.impressions > 100) {
        const conversionRate = metrics.conversionRate;
        console.log(`Conversion Rate: ${conversionRate.toFixed(2)}%`);
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [getMetrics]);

  return (
    <ExitIntent
      discount={20}
      onConvert={handleConvert}
    />
  );
}
```

### Tracking Events

The component sends the following events to Google Analytics:

- `exit_intent_impression` - Popup was shown
- `exit_intent_click_cta` - User clicked the CTA button
- `exit_intent_close` - User closed the popup
- `exit_intent_convert` - Successful conversion (email captured)

### Customization: Custom Offers

```typescript
// For logged-in users vs. anonymous users
const discount = isLoggedIn ? 10 : 20;

// Time-based dynamic offers
const getDiscountByTime = () => {
  const hour = new Date().getHours();
  if (hour >= 20) return 25;  // Late night: higher discount
  if (hour < 9) return 15;    // Early morning: lower discount
  return 20;
};

<ExitIntent
  discount={getDiscountByTime()}
  onConvert={handleConvert}
/>
```

---

## 2. Social Proof Widget

### Features

- **Real-Time Activity Feed**: Simulates live user activities (bookings, reviews, signups)
- **Dynamic Statistics**: User count, bookings, ratings, reviews
- **Two Display Modes:**
  - `compact`: Fixed-size widget with rotating activity
  - `expanded`: Full modal with stats grid and activity feed
- **Position Flexibility**: bottom-right, bottom-left, top-right, top-left
- **Mobile Optimized**: Adapts to mobile screens
- **Auto-Scroll**: Automatically cycles through activities

### Basic Implementation

```typescript
import SocialProof from '@/components/SocialProof';

function App() {
  return (
    <div>
      {/* Your app content */}
      <SocialProof
        position="bottom-right"
        variant="compact"
        showStats={true}
      />
    </div>
  );
}
```

### Props Reference

```typescript
interface SocialProofProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';  // Default: 'bottom-right'
  variant?: 'compact' | 'expanded';  // Default: 'compact'
  autoScroll?: boolean;              // Default: true - auto-cycle activities
  showStats?: boolean;               // Default: true - show user/booking stats
  animationDuration?: number;        // Default: 4000ms - time between activity switches
  onImpression?: (position: string, variant: string) => void;
}
```

### Advanced: Custom Activity Feed

```typescript
// To use real API data instead of mock data, modify SocialProof.tsx:

const [activities, setActivities] = useState<ActivityItem[]>([]);

useEffect(() => {
  // Fetch real activities from your API
  const fetchActivities = async () => {
    const response = await fetch('/api/activities?limit=10');
    const data = await response.json();
    setActivities(data);
  };

  fetchActivities();

  // Poll for new activities every 5 seconds
  const interval = setInterval(fetchActivities, 5000);
  return () => clearInterval(interval);
}, []);
```

### Advanced: Tracking Setup

```typescript
import SocialProof from '@/components/SocialProof';
import { useSocialProofTracking } from '@/hooks/useSocialProofTracking';

function HomePage() {
  const {
    trackImpression,
    trackExpansion,
    trackCTAClick,
    trackActivityFeed,
    getMetrics,
  } = useSocialProofTracking();

  const handleImpression = (position: string, variant: string) => {
    trackImpression(position, variant);
  };

  useEffect(() => {
    // Log metrics periodically
    const interval = setInterval(() => {
      const metrics = getMetrics();
      console.log('Social Proof Metrics:', {
        impressions: metrics.impressions,
        expansions: metrics.expansions,
        engagement_rate: metrics.engagement_rate.toFixed(2) + '%',
        conversions: metrics.conversion_value,
      });
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [getMetrics]);

  return (
    <SocialProof
      position="bottom-right"
      variant="compact"
      onImpression={handleImpression}
    />
  );
}
```

### Tracking Events

- `social_proof_impression` - Widget loaded
- `social_proof_expanded` - User expanded widget
- `social_proof_click` - User clicked on activity
- `social_proof_cta_click` - User clicked CTA button
- `social_proof_activity_view` - Specific activity viewed
- `social_proof_stat_view` - Specific statistic viewed

---

## 3. Combined Implementation Example

```typescript
import React, { useState, useEffect } from 'react';
import ExitIntent from '@/components/ExitIntent';
import SocialProof from '@/components/SocialProof';
import { useExitIntentTracking } from '@/hooks/useExitIntentTracking';
import { useSocialProofTracking } from '@/hooks/useSocialProofTracking';

function HomePage() {
  const exitIntentTracking = useExitIntentTracking();
  const socialProofTracking = useSocialProofTracking();

  const handleExitIntentConvert = async (variant: string, discount: number) => {
    exitIntentTracking.trackConversion(variant, discount);

    // Send email capture to backend
    try {
      // API call to save lead
      console.log(`Discount code: SAVE${discount}`);
    } catch (error) {
      console.error('Failed to save lead:', error);
    }
  };

  const handleSocialProofExpansion = () => {
    socialProofTracking.trackExpansion('bottom-right', 'compact');
  };

  useEffect(() => {
    // Dashboard: Monitor both widgets' performance
    const metricsInterval = setInterval(() => {
      const exitMetrics = exitIntentTracking.getMetrics();
      const socialMetrics = socialProofTracking.getMetrics();

      console.log('Exit Intent Performance:', {
        rate: exitMetrics.conversionRate.toFixed(2) + '%',
        emails: exitMetrics.emailsCaptured,
      });

      console.log('Social Proof Performance:', {
        engagement: socialMetrics.engagement_rate.toFixed(2) + '%',
        conversions: socialMetrics.conversion_value,
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(metricsInterval);
  }, []);

  return (
    <main>
      {/* Page content */}
      <h1>Welcome to Transcend Law</h1>

      {/* Conversion Widgets */}
      <ExitIntent discount={20} onConvert={handleExitIntentConvert} />

      <SocialProof
        position="bottom-right"
        variant="compact"
        onImpression={handleSocialProofExpansion}
      />
    </main>
  );
}

export default HomePage;
```

---

## 4. Analytics & Conversion Tracking

### Google Analytics Integration

Both components integrate with Google Analytics (gtag). Ensure gtag is loaded:

```html
<!-- In public/index.html -->
<script
  async
  src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"
></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

### Custom Backend Integration

Set `REACT_APP_ANALYTICS_ENDPOINT` environment variable:

```bash
# .env
REACT_APP_ANALYTICS_ENDPOINT=https://your-api.com/analytics/events
```

Events are POST'd with this structure:

```json
{
  "source": "exit_intent" or "social_proof",
  "event_name": "exit_intent_impression",
  "event_category": "conversion",
  "event_label": "variant_a_20percent",
  "event_value": 1,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Dashboard Example Query (PostgreSQL)

```sql
-- Exit Intent Conversion Rate by Variant
SELECT
  event_label as variant,
  COUNT(*) as impressions,
  SUM(CASE WHEN event_name = 'exit_intent_convert' THEN 1 ELSE 0 END) as conversions,
  ROUND(100.0 * SUM(CASE WHEN event_name = 'exit_intent_convert' THEN 1 ELSE 0 END) / COUNT(*), 2) as conversion_rate
FROM analytics_events
WHERE event_name IN ('exit_intent_impression', 'exit_intent_convert')
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY variant
ORDER BY conversion_rate DESC;
```

---

## 5. Mobile Optimization

Both components are fully mobile-responsive:

### Exit Intent on Mobile

- Bottom-sheet style popup
- Full-width (95% with gutters)
- Touch-friendly buttons
- Automatic close on conversion

### Social Proof on Mobile

- Sticks to bottom-right corner
- Auto-collapses to compact form
- Full-width expanded view
- Swipe-friendly interaction

Test on mobile with:

```bash
npm start  # Starts dev server
# Then open Chrome DevTools > Toggle device toolbar
```

---

## 6. Performance & Best Practices

### Lazy Loading

Defer widget loading until after page paint:

```typescript
const ExitIntentLazy = React.lazy(() => import('@/components/ExitIntent'));

function App() {
  return (
    <Suspense fallback={null}>
      <ExitIntentLazy />
    </Suspense>
  );
}
```

### Debouncing Exit Intent

The component already includes debouncing:

```typescript
// Delay before showing (prevents accidental triggers)
delay={2000}

// Threshold for mouse position (prevents false positives)
threshold={50}
```

### Analytics Batching

The tracking hooks batch events to reduce network requests:

```typescript
// Modify hooks to batch events every 30 seconds
const BATCH_INTERVAL = 30000;
```

### CSS Performance

Both components use GPU-accelerated animations:

```css
/* Efficient transforms */
animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
transform: translateY(-2px);

/* Avoid repaints */
will-change: transform;
```

---

## 7. A/B Testing Workflow

### Step 1: Configure Variants

Currently 3 variants for Exit Intent:
- `control`: Standard (baseline)
- `variant_a`: Benefit-focused
- `variant_b`: Urgency-focused

### Step 2: Run Test (Minimum 2 weeks)

```typescript
// Monitor conversion rates across variants
const metrics = getMetrics();

console.log(`
Control: ${controlMetrics.conversionRate.toFixed(2)}%
Variant A: ${variantAMetrics.conversionRate.toFixed(2)}%
Variant B: ${variantBMetrics.conversionRate.toFixed(2)}%
`);
```

### Step 3: Analyze Results

Statistical significance calculator:

```typescript
const isSignificant = (control, variant, minDiff = 0.05) => {
  // Z-score test for proportions
  const pooled = (control.conversions + variant.conversions) /
                 (control.impressions + variant.impressions);
  const se = Math.sqrt(pooled * (1 - pooled) * 
             (1 / control.impressions + 1 / variant.impressions));
  const z = (variant.conversionRate - control.conversionRate) / se;
  return Math.abs(z) > 1.96; // 95% confidence
};
```

### Step 4: Scale Winner

```typescript
// Implement permanent change once winner is clear
const discount = variant === 'a' ? 25 : 20;
```

---

## 8. Troubleshooting

### Exit Intent Not Triggering

```typescript
// Check if enabled
console.log('Exit Intent Enabled:', enabled);

// Verify threshold is working
document.addEventListener('mouseleave', (e) => {
  console.log('Mouse Y:', e.clientY, 'Threshold:', threshold);
});
```

### Social Proof Not Updating

```typescript
// Check if interval is running
console.log('Activity Count:', activities.length);

// Verify position classes
console.log(document.querySelector('.social-proof-widget').className);
```

### Analytics Not Sending

```typescript
// Verify gtag is loaded
console.log('gtag available:', !!window.gtag);

// Check endpoint in .env
console.log('Endpoint:', process.env.REACT_APP_ANALYTICS_ENDPOINT);
```

---

## 9. Environment Variables

```bash
# .env.local
REACT_APP_ANALYTICS_ENDPOINT=https://api.example.com/analytics
REACT_APP_DISCOUNT_PERCENTAGE=20
REACT_APP_EXIT_INTENT_ENABLED=true
REACT_APP_SOCIAL_PROOF_ENABLED=true
```

---

## 10. Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile Safari 14+
- Chrome Android 90+

All animations use GPU acceleration for smooth performance on older devices.

---

## Quick Reference

### File Locations

```
src/components/
  ├── ExitIntent.tsx
  ├── ExitIntent.css
  ├── SocialProof.tsx
  ├── SocialProof.css
  └── CONVERSION_WIDGETS_INTEGRATION.md

src/hooks/
  ├── useExitIntentTracking.ts
  └── useSocialProofTracking.ts
```

### Import Examples

```typescript
// Exit Intent
import ExitIntent from '@/components/ExitIntent';
import { useExitIntentTracking } from '@/hooks/useExitIntentTracking';

// Social Proof
import SocialProof from '@/components/SocialProof';
import { useSocialProofTracking } from '@/hooks/useSocialProofTracking';
```

---

## Support & Contributing

For questions or improvements:

1. Check this guide first
2. Review component JSDoc comments
3. Check console for dev-only debug logs (process.env.NODE_ENV === 'development')
4. Monitor metrics in production

---

**Last Updated:** August 2026
**Version:** 1.0.0
