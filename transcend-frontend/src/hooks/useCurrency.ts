import { useState, useEffect, useCallback, useContext, createContext } from 'react';

// Supported currencies with metadata
export const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', region: 'US' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', region: 'EU' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', region: 'GB' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', region: 'CA' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', region: 'AU' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', region: 'JP' },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', region: 'CH' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', region: 'CN' },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', region: 'IN' },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', region: 'AE' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', region: 'SG' },
  HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', region: 'HK' },
  NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', region: 'NZ' },
  MXN: { code: 'MXN', symbol: '$', name: 'Mexican Peso', region: 'MX' },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', region: 'BR' },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', region: 'ZA' },
  SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', region: 'SE' },
  NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', region: 'NO' },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', region: 'KR' },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', region: 'TH' },
};

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

export interface ExchangeRate {
  [key: string]: number;
}

export interface CurrencyContextType {
  currentCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  exchangeRates: ExchangeRate;
  isLoading: boolean;
  error: string | null;
  setCurrency: (currency: CurrencyCode) => void;
  convertAmount: (amount: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode) => number;
  formatPrice: (amount: number, currency?: CurrencyCode) => string;
  getRate: (fromCurrency: CurrencyCode, toCurrency: CurrencyCode) => number;
}

// Create context
export const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

// Custom hook for currency operations
export const useCurrency = () => {
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyCode>('USD');
  const [baseCurrency] = useState<CurrencyCode>('USD');
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect user location and currency on mount
  useEffect(() => {
    const loadUserCurrency = async () => {
      try {
        // First, try to load from localStorage
        const savedCurrency = localStorage.getItem('userCurrency') as CurrencyCode;
        if (savedCurrency && SUPPORTED_CURRENCIES[savedCurrency]) {
          setCurrentCurrency(savedCurrency);
          return;
        }

        // Auto-detect from geolocation
        await autoDetectCurrency();
      } catch (err) {
        console.error('Error loading user currency:', err);
        setError('Failed to detect currency preference');
      }
    };

    loadUserCurrency();
  }, []);

  // Fetch exchange rates on mount and periodically
  useEffect(() => {
    const fetchExchangeRates = async () => {
      setIsLoading(true);
      try {
        const rates = await fetchExchangeRatesFromAPI();
        setExchangeRates(rates);
        setError(null);
      } catch (err) {
        console.error('Error fetching exchange rates:', err);
        setError('Failed to fetch exchange rates');
        // Use fallback rates
        setExchangeRates(getFallbackRates());
      } finally {
        setIsLoading(false);
      }
    };

    fetchExchangeRates();

    // Refresh rates every 6 hours
    const interval = setInterval(fetchExchangeRates, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-detect currency based on user's location
  const autoDetectCurrency = useCallback(async () => {
    try {
      // Use IP geolocation API (free tier)
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();

      // Map country code to currency
      const countryToCurrency: { [key: string]: CurrencyCode } = {
        US: 'USD',
        GB: 'GBP',
        CA: 'CAD',
        AU: 'AUD',
        JP: 'JPY',
        CH: 'CHF',
        CN: 'CNY',
        IN: 'INR',
        AE: 'AED',
        SG: 'SGD',
        HK: 'HKD',
        NZ: 'NZD',
        MX: 'MXN',
        BR: 'BRL',
        ZA: 'ZAR',
        SE: 'SEK',
        NO: 'NOK',
        KR: 'KRW',
        TH: 'THB',
        DE: 'EUR',
        FR: 'EUR',
        IT: 'EUR',
        ES: 'EUR',
        BE: 'EUR',
        NL: 'EUR',
      };

      const detectedCurrency = countryToCurrency[data.country_code] || 'USD';
      setCurrentCurrency(detectedCurrency as CurrencyCode);
    } catch (err) {
      console.warn('Could not auto-detect currency, using default USD:', err);
      setCurrentCurrency('USD');
    }
  }, []);

  // Fetch exchange rates from API
  const fetchExchangeRatesFromAPI = useCallback(async (): Promise<ExchangeRate> => {
    const apiKey = process.env.REACT_APP_EXCHANGE_RATES_API_KEY;

    if (!apiKey) {
      console.warn('Exchange rates API key not configured, using fallback rates');
      return getFallbackRates();
    }

    try {
      const response = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=${baseCurrency}`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.statusCode}`);
      }

      const data = await response.json();
      return data.rates || getFallbackRates();
    } catch (err) {
      console.error('Error fetching exchange rates:', err);
      return getFallbackRates();
    }
  }, [baseCurrency]);

  // Fallback exchange rates (approximate, for when API is unavailable)
  const getFallbackRates = useCallback((): ExchangeRate => {
    return {
      USD: 1.0,
      EUR: 0.92,
      GBP: 0.79,
      CAD: 1.36,
      AUD: 1.53,
      JPY: 149.5,
      CHF: 0.88,
      CNY: 7.24,
      INR: 83.12,
      AED: 3.67,
      SGD: 1.35,
      HKD: 7.81,
      NZD: 1.66,
      MXN: 17.05,
      BRL: 4.97,
      ZAR: 18.45,
      SEK: 10.94,
      NOK: 10.73,
      KRW: 1319.5,
      THB: 36.15,
    };
  }, []);

  // Convert amount from one currency to another
  const convertAmount = useCallback(
    (amount: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode): number => {
      if (fromCurrency === toCurrency) {
        return amount;
      }

      const fromRate = exchangeRates[fromCurrency] || 1;
      const toRate = exchangeRates[toCurrency] || 1;

      if (!fromRate || !toRate) {
        console.warn(`Missing exchange rate for ${fromCurrency} or ${toCurrency}`);
        return amount;
      }

      // Convert to base currency first, then to target currency
      const amountInBase = amount / fromRate;
      const amountInTarget = amountInBase * toRate;

      return amountInTarget;
    },
    [exchangeRates]
  );

  // Get exchange rate between two currencies
  const getRate = useCallback(
    (fromCurrency: CurrencyCode, toCurrency: CurrencyCode): number => {
      if (fromCurrency === toCurrency) {
        return 1;
      }

      const fromRate = exchangeRates[fromCurrency] || 1;
      const toRate = exchangeRates[toCurrency] || 1;

      return toRate / fromRate;
    },
    [exchangeRates]
  );

  // Format price with currency symbol and proper decimal places
  const formatPrice = useCallback(
    (amount: number, currency: CurrencyCode = currentCurrency): string => {
      const currencyInfo = SUPPORTED_CURRENCIES[currency];
      if (!currencyInfo) {
        return `${amount.toFixed(2)} ${currency}`;
      }

      // JPY and KRW typically don't use decimals
      const decimals = ['JPY', 'KRW'].includes(currency) ? 0 : 2;
      const formatted = amount.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

      return `${currencyInfo.symbol}${formatted}`;
    },
    [currentCurrency]
  );

  // Set currency and save to localStorage
  const setCurrency = useCallback((currency: CurrencyCode) => {
    if (SUPPORTED_CURRENCIES[currency]) {
      setCurrentCurrency(currency);
      localStorage.setItem('userCurrency', currency);
    } else {
      console.warn(`Invalid currency code: ${currency}`);
    }
  }, []);

  return {
    currentCurrency,
    baseCurrency,
    exchangeRates,
    isLoading,
    error,
    setCurrency,
    convertAmount,
    formatPrice,
    getRate,
  };
};

// Hook to use context (convenience hook)
export const useCurrencyContext = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrencyContext must be used within CurrencyProvider');
  }
  return context;
};
