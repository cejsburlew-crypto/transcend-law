# Multi-Currency Support Implementation Guide

This guide covers the integration of the three-part multi-currency support system for the Transcend platform.

## Overview

The multi-currency implementation consists of:
1. **Frontend Hook** (`useCurrency.ts`) - React hook for client-side currency management
2. **Frontend Component** (`CurrencySelector.tsx` + `CurrencySelector.css`) - UI selector component
3. **Backend Service** (`currencyService.ts`) - Node.js service for currency operations

## Files Created

### 1. Frontend Hook: `/transcend-frontend/src/hooks/useCurrency.ts`

**Location:** `/transcend-frontend/src/hooks/useCurrency.ts`

**Purpose:** Provides React hook for currency management with auto-detection and real-time exchange rates.

**Features:**
- 20+ supported currencies
- Auto-detect user location using geolocation API
- Fetch real-time exchange rates from Open Exchange Rates API
- Local storage persistence
- Currency conversion utilities
- Fallback rates when API unavailable
- 6-hour cache refresh interval

**Usage Example:**
```typescript
import { useCurrency } from '../hooks/useCurrency';

function MyComponent() {
  const {
    currentCurrency,
    setCurrency,
    convertAmount,
    formatPrice,
    isLoading,
    error
  } = useCurrency();

  return (
    <div>
      <p>Current: {currentCurrency}</p>
      <p>50 USD in {currentCurrency}: {formatPrice(
        convertAmount(50, 'USD', currentCurrency)
      )}</p>
    </div>
  );
}
```

### 2. Frontend Component: `/transcend-frontend/src/components/CurrencySelector.tsx`

**Location:** `/transcend-frontend/src/components/CurrencySelector.tsx`

**Purpose:** Mobile-first UI component for currency selection with search and exchange rate display.

**Props:**
```typescript
interface CurrencySelectorProps {
  onCurrencyChange?: (currency: CurrencyCode) => void;
  showExchangeRates?: boolean;
  compact?: boolean;
}
```

**Features:**
- Dropdown selector with search functionality
- Display exchange rates in real-time
- Compact mode for headers/footers
- Full mode with detailed information
- Mobile-responsive design (44x44px touch targets)
- Dark mode support
- Accessibility features (ARIA labels, keyboard navigation)

**Usage Examples:**

Full Mode:
```tsx
import CurrencySelector from '../components/CurrencySelector';

function Header() {
  return (
    <CurrencySelector
      showExchangeRates={true}
      onCurrencyChange={(currency) => {
        console.log('Currency changed to:', currency);
      }}
    />
  );
}
```

Compact Mode:
```tsx
<CurrencySelector compact={true} />
```

### 3. Backend Service: `/transcend-api/services/currencyService.ts`

**Location:** `/transcend-api/services/currencyService.ts`

**Purpose:** Server-side service for currency operations, API integration, and caching.

**Features:**
- Real-time exchange rate fetching from Open Exchange Rates API
- Redis caching (6-hour TTL)
- Currency validation
- User preference storage
- Multiple currency conversion
- Auto-detection based on country code
- Fallback rates
- Currency formatting with Intl API

**Usage Example:**
```typescript
import Redis from 'ioredis';
import { createCurrencyService } from './services/currencyService';

const redis = new Redis();
const currencyService = createCurrencyService(redis);

// Convert currency
const result = await currencyService.convertCurrency(100, 'USD', 'EUR');
console.log(result); // { amount: 100, fromCurrency: 'USD', toCurrency: 'EUR', rate: 0.92, result: 92.00, timestamp: ... }

// Set user preference
await currencyService.setUserCurrencyPreference('user123', 'EUR');

// Get user preference
const pref = await currencyService.getUserCurrencyPreference('user123');

// Format price
const formatted = currencyService.formatPrice(100, 'USD');
console.log(formatted); // "$100.00"

// Convert to multiple currencies
const prices = await currencyService.convertToMultipleCurrencies(50, 'USD', ['EUR', 'GBP', 'JPY']);
```

## Environment Setup

### Required Environment Variables

**Frontend (.env):**
```env
REACT_APP_EXCHANGE_RATES_API_KEY=your_openexchangerates_api_key
```

**Backend (.env):**
```env
OPENEXCHANGERATES_API_KEY=your_openexchangerates_api_key
REDIS_URL=redis://localhost:6379
```

### OpenExchangeRates API Setup

1. Sign up at: https://openexchangerates.org/
2. Free tier includes:
   - Latest rates endpoint
   - ~1,500 requests/month
   - Base USD only
3. Get your API key from the dashboard
4. Add to environment variables

### Redis Setup

Required for caching exchange rates:
```bash
# Docker
docker run -d -p 6379:6379 redis:latest

# Or install locally
brew install redis  # macOS
sudo apt-get install redis-server  # Ubuntu
```

## Integration Steps

### Step 1: Add Dependencies

**Frontend:**
```bash
npm install axios
```

**Backend:**
```bash
npm install ioredis axios
npm install --save-dev @types/ioredis @types/node
```

### Step 2: Create Currency Context Provider (Optional but Recommended)

**File:** `/transcend-frontend/src/providers/CurrencyProvider.tsx`

```typescript
import React, { useMemo } from 'react';
import { CurrencyContext, useCurrency, CurrencyContextType } from '../hooks/useCurrency';

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currencyValue = useCurrency() as CurrencyContextType;

  const value = useMemo(() => currencyValue, [currencyValue]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};
```

### Step 3: Wrap Application with Provider

**File:** `/transcend-frontend/src/App.tsx`

```tsx
import { CurrencyProvider } from './providers/CurrencyProvider';

function App() {
  return (
    <CurrencyProvider>
      {/* Your app components */}
    </CurrencyProvider>
  );
}
```

### Step 4: Use in Components

**Example: Service Listing with Multi-Currency Display**

```tsx
import { useCurrency } from '../hooks/useCurrency';
import CurrencySelector from '../components/CurrencySelector';

function ServiceCard({ service }) {
  const { convertAmount, formatPrice, currentCurrency } = useCurrency();

  const priceInUserCurrency = convertAmount(
    service.priceUSD,
    'USD',
    currentCurrency
  );

  return (
    <div className="service-card">
      <h3>{service.name}</h3>
      <p className="price">
        {formatPrice(priceInUserCurrency, currentCurrency)}
      </p>
    </div>
  );
}

function ServiceDirectory() {
  return (
    <div>
      <CurrencySelector showExchangeRates={true} />
      <div className="services-grid">
        {/* Service cards */}
      </div>
    </div>
  );
}
```

### Step 5: Backend API Endpoint Integration

**Example: Express.js endpoint**

```typescript
import { Router, Request, Response } from 'express';
import { createCurrencyService } from './services/currencyService';
import redis from './config/redis';

const router = Router();
const currencyService = createCurrencyService(redis);

// Convert currency endpoint
router.post('/api/currency/convert', async (req: Request, res: Response) => {
  try {
    const { amount, fromCurrency, toCurrency } = req.body;

    const result = await currencyService.convertCurrency(
      amount,
      fromCurrency,
      toCurrency
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get exchange rates
router.get('/api/currency/rates', async (req: Request, res: Response) => {
  try {
    const { baseCurrency = 'USD' } = req.query;

    const rates = await currencyService.getExchangeRates(baseCurrency as string);

    res.json(rates);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Set user currency preference
router.post('/api/user/currency', async (req: Request, res: Response) => {
  try {
    const { userId, currency } = req.body;

    const preference = await currencyService.setUserCurrencyPreference(
      userId,
      currency
    );

    res.json(preference);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user currency preference
router.get('/api/user/currency/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const preference = await currencyService.getUserCurrencyPreference(userId);

    if (!preference) {
      return res.json({ currency: 'USD' });
    }

    res.json(preference);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

## Supported Currencies

All currency codes follow ISO 4217 standard:

| Code | Currency | Region |
|------|----------|--------|
| USD | US Dollar | US |
| EUR | Euro | EU |
| GBP | British Pound | GB |
| CAD | Canadian Dollar | CA |
| AUD | Australian Dollar | AU |
| JPY | Japanese Yen | JP |
| CHF | Swiss Franc | CH |
| CNY | Chinese Yuan | CN |
| INR | Indian Rupee | IN |
| AED | UAE Dirham | AE |
| SGD | Singapore Dollar | SG |
| HKD | Hong Kong Dollar | HK |
| NZD | New Zealand Dollar | NZ |
| MXN | Mexican Peso | MX |
| BRL | Brazilian Real | BR |
| ZAR | South African Rand | ZA |
| SEK | Swedish Krona | SE |
| NOK | Norwegian Krone | NO |
| KRW | South Korean Won | KR |
| THB | Thai Baht | TH |

## Key Features

### Auto-Detection
- Automatically detects user's location using IP geolocation
- Maps country to appropriate currency
- Falls back to USD if detection fails

### Caching Strategy
- Frontend: localStorage for user preference
- Frontend: 6-hour in-memory cache for exchange rates
- Backend: Redis cache for exchange rates (6-hour TTL)
- Reduces API calls and improves performance

### Error Handling
- Fallback rates when API unavailable
- Graceful degradation
- Comprehensive error logging
- User-friendly error messages

### Performance Optimizations
- Memoized conversion functions
- Rate limiting via caching
- Efficient currency conversion algorithm
- Optional batch conversions

### Accessibility
- ARIA labels for currency selector
- Keyboard navigation support
- Screen reader friendly
- Mobile-first design with adequate touch targets

### Mobile Support
- Responsive CSS with mobile breakpoints
- 44x44px minimum touch targets (WCAG compliant)
- Optimized dropdown positioning on mobile
- Dark mode support

## Testing

### Frontend Testing
```typescript
import { renderHook, act } from '@testing-library/react';
import { useCurrency } from '../hooks/useCurrency';

describe('useCurrency', () => {
  it('should initialize with USD', () => {
    const { result } = renderHook(() => useCurrency());
    expect(result.current.currentCurrency).toBe('USD');
  });

  it('should convert amounts correctly', async () => {
    const { result } = renderHook(() => useCurrency());
    await act(async () => {
      const converted = result.current.convertAmount(100, 'USD', 'EUR');
      expect(converted).toBeGreaterThan(0);
    });
  });

  it('should format prices with currency symbol', () => {
    const { result } = renderHook(() => useCurrency());
    const formatted = result.current.formatPrice(100);
    expect(formatted).toContain('$');
  });
});
```

### Backend Testing
```typescript
import { CurrencyService } from './currencyService';
import Redis from 'ioredis-mock';

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(() => {
    const redis = new Redis();
    service = new CurrencyService(redis);
  });

  it('should validate currencies', () => {
    expect(service.validateCurrency('USD')).toBe(true);
    expect(service.validateCurrency('INVALID')).toBe(false);
  });

  it('should convert currencies', async () => {
    const result = await service.convertCurrency(100, 'USD', 'EUR');
    expect(result.result).toBeGreaterThan(0);
    expect(result.fromCurrency).toBe('USD');
    expect(result.toCurrency).toBe('EUR');
  });
});
```

## Troubleshooting

### Issue: API key not working
- Verify key is correct in environment variables
- Check API key permissions at openexchangerates.org
- Ensure free tier limit not exceeded (1,500 requests/month)

### Issue: Fallback rates being used
- Check internet connectivity
- Verify CORS settings if frontend is making direct API calls
- Check API key configuration
- Monitor API response times

### Issue: Currency not persisting
- Verify localStorage is enabled
- Check for localStorage quota exceeded
- Verify Redis connection for backend

### Issue: Exchange rates stale
- Force cache clear by restarting service
- Check cache duration settings
- Verify Redis is running and accessible

## Production Checklist

- [ ] API key configured in environment variables
- [ ] Redis instance running and accessible
- [ ] Environment variables set in production
- [ ] SSL/TLS enabled for API endpoints
- [ ] Rate limiting configured
- [ ] Error logging and monitoring setup
- [ ] Cache invalidation strategy implemented
- [ ] User preference persistence tested
- [ ] Mobile responsiveness verified
- [ ] Accessibility audit completed
- [ ] Load testing completed
- [ ] Fallback rates tested

## Future Enhancements

- [ ] Cryptocurrency support (BTC, ETH)
- [ ] Historical exchange rate trends
- [ ] Advanced analytics for currency usage
- [ ] Custom rate markup for service providers
- [ ] Multi-currency payment processing
- [ ] Automated currency conversion on checkout
- [ ] Currency conversion notifications
- [ ] Rate alerts and monitoring

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review environment variable configuration
3. Verify API key and Redis setup
4. Check logs for detailed error information
5. Contact support team with logs and context
