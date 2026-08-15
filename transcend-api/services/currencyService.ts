import axios, { AxiosInstance } from 'axios';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Supported currency codes
 */
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'CNY', 'INR', 'AED',
  'SGD', 'HKD', 'NZD', 'MXN', 'BRL', 'ZAR', 'SEK', 'NOK', 'KRW', 'THB',
];

export interface ExchangeRates {
  base: string;
  timestamp: number;
  rates: { [key: string]: number };
}

export interface CurrencyConversion {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  result: number;
  timestamp: number;
}

export interface UserCurrencyPreference {
  userId: string;
  currency: string;
  updatedAt: Date;
}

/**
 * Service for handling multi-currency operations
 * Integrates with Open Exchange Rates API and caches rates in Redis
 */
export class CurrencyService {
  private apiClient: AxiosInstance;
  private redisClient: Redis;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openexchangerates.org/api/latest.json';
  private readonly baseCurrency = 'USD';
  private readonly cacheDuration = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
  private readonly cacheKeyPrefix = 'currency:rates:';

  constructor(redisClient: Redis, apiKey?: string) {
    this.redisClient = redisClient;
    this.apiKey = apiKey || process.env.OPENEXCHANGERATES_API_KEY || '';

    this.apiClient = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Transcend-SSP/1.0',
      },
    });
  }

  /**
   * Validate if a currency code is supported
   */
  public validateCurrency(currency: string): boolean {
    return SUPPORTED_CURRENCIES.includes(currency.toUpperCase());
  }

  /**
   * Get all supported currencies
   */
  public getSupportedCurrencies(): string[] {
    return SUPPORTED_CURRENCIES;
  }

  /**
   * Fetch latest exchange rates from API
   * Caches results in Redis for performance
   */
  public async getExchangeRates(baseCurrency = this.baseCurrency): Promise<ExchangeRates> {
    // Validate base currency
    if (!this.validateCurrency(baseCurrency)) {
      throw new Error(`Invalid base currency: ${baseCurrency}`);
    }

    const cacheKey = `${this.cacheKeyPrefix}${baseCurrency}`;

    try {
      // Check Redis cache first
      const cachedRates = await this.redisClient.get(cacheKey);
      if (cachedRates) {
        logger.info(`Cache hit for exchange rates: ${baseCurrency}`);
        return JSON.parse(cachedRates);
      }

      // Fetch from API if not in cache
      logger.info(`Fetching exchange rates from API for base: ${baseCurrency}`);
      const rates = await this.fetchFromAPI(baseCurrency);

      // Cache the rates
      await this.redisClient.setex(
        cacheKey,
        this.cacheDuration / 1000, // Convert to seconds for Redis
        JSON.stringify(rates)
      );

      return rates;
    } catch (error) {
      logger.error(`Error fetching exchange rates: ${error}`);
      throw new Error(`Failed to fetch exchange rates: ${error}`);
    }
  }

  /**
   * Fetch rates from Open Exchange Rates API
   */
  private async fetchFromAPI(baseCurrency: string): Promise<ExchangeRates> {
    if (!this.apiKey) {
      logger.warn('OpenExchangeRates API key not configured, using fallback rates');
      return this.getFallbackRates(baseCurrency);
    }

    try {
      const response = await this.apiClient.get(this.baseUrl, {
        params: {
          app_id: this.apiKey,
          base: baseCurrency,
          symbols: SUPPORTED_CURRENCIES.join(','),
        },
      });

      return {
        base: response.data.base,
        timestamp: response.data.timestamp,
        rates: response.data.rates,
      };
    } catch (error) {
      logger.error(`API call failed: ${error}`);
      // Return fallback rates if API fails
      return this.getFallbackRates(baseCurrency);
    }
  }

  /**
   * Fallback rates for when API is unavailable
   * Approximate rates as of the knowledge cutoff
   */
  private getFallbackRates(baseCurrency: string): ExchangeRates {
    const fallbackRates: { [key: string]: { [key: string]: number } } = {
      USD: {
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
      },
    };

    const rates = fallbackRates[baseCurrency];
    if (!rates) {
      throw new Error(`No fallback rates available for base currency: ${baseCurrency}`);
    }

    return {
      base: baseCurrency,
      timestamp: Date.now(),
      rates,
    };
  }

  /**
   * Convert amount from one currency to another
   */
  public async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<CurrencyConversion> {
    // Validate inputs
    if (!this.validateCurrency(fromCurrency)) {
      throw new Error(`Invalid source currency: ${fromCurrency}`);
    }
    if (!this.validateCurrency(toCurrency)) {
      throw new Error(`Invalid target currency: ${toCurrency}`);
    }
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    // If converting to same currency, no conversion needed
    if (fromCurrency === toCurrency) {
      return {
        amount,
        fromCurrency,
        toCurrency,
        rate: 1,
        result: amount,
        timestamp: Date.now(),
      };
    }

    try {
      // Get exchange rates with source currency as base
      const rates = await this.getExchangeRates(fromCurrency);

      // Get the rate for target currency
      const rate = rates.rates[toCurrency];
      if (!rate) {
        throw new Error(`Exchange rate not available for ${toCurrency}`);
      }

      // Calculate result
      const result = amount * rate;

      return {
        amount,
        fromCurrency,
        toCurrency,
        rate,
        result: parseFloat(result.toFixed(2)),
        timestamp: Date.now(),
      };
    } catch (error) {
      logger.error(`Currency conversion failed: ${error}`);
      throw new Error(`Failed to convert currency: ${error}`);
    }
  }

  /**
   * Get conversion rate between two currencies
   */
  public async getConversionRate(fromCurrency: string, toCurrency: string): Promise<number> {
    // Validate inputs
    if (!this.validateCurrency(fromCurrency)) {
      throw new Error(`Invalid source currency: ${fromCurrency}`);
    }
    if (!this.validateCurrency(toCurrency)) {
      throw new Error(`Invalid target currency: ${toCurrency}`);
    }

    // If same currency, rate is 1
    if (fromCurrency === toCurrency) {
      return 1;
    }

    try {
      const rates = await this.getExchangeRates(fromCurrency);
      const rate = rates.rates[toCurrency];

      if (!rate) {
        throw new Error(`Exchange rate not available for ${toCurrency}`);
      }

      return rate;
    } catch (error) {
      logger.error(`Failed to get conversion rate: ${error}`);
      throw new Error(`Failed to get conversion rate: ${error}`);
    }
  }

  /**
   * Store user's currency preference
   */
  public async setUserCurrencyPreference(
    userId: string,
    currency: string
  ): Promise<UserCurrencyPreference> {
    // Validate currency
    if (!this.validateCurrency(currency)) {
      throw new Error(`Invalid currency: ${currency}`);
    }

    try {
      const preference: UserCurrencyPreference = {
        userId,
        currency: currency.toUpperCase(),
        updatedAt: new Date(),
      };

      // Store in cache with longer TTL (30 days)
      const cacheKey = `user:currency:${userId}`;
      await this.redisClient.setex(
        cacheKey,
        30 * 24 * 60 * 60, // 30 days in seconds
        JSON.stringify(preference)
      );

      logger.info(`Set currency preference for user ${userId}: ${currency}`);
      return preference;
    } catch (error) {
      logger.error(`Failed to set currency preference: ${error}`);
      throw new Error(`Failed to set currency preference: ${error}`);
    }
  }

  /**
   * Get user's currency preference
   */
  public async getUserCurrencyPreference(userId: string): Promise<UserCurrencyPreference | null> {
    try {
      const cacheKey = `user:currency:${userId}`;
      const cached = await this.redisClient.get(cacheKey);

      if (cached) {
        return JSON.parse(cached);
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get currency preference: ${error}`);
      return null;
    }
  }

  /**
   * Auto-detect currency based on country code
   */
  public autoDetectCurrency(countryCode: string): string {
    const countryToCurrency: { [key: string]: string } = {
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
      // EU countries
      DE: 'EUR',
      FR: 'EUR',
      IT: 'EUR',
      ES: 'EUR',
      BE: 'EUR',
      NL: 'EUR',
      AT: 'EUR',
      PT: 'EUR',
      GR: 'EUR',
      IE: 'EUR',
      CY: 'EUR',
      LU: 'EUR',
      MT: 'EUR',
      SK: 'EUR',
      SI: 'EUR',
    };

    const normalizedCode = countryCode.toUpperCase();
    return countryToCurrency[normalizedCode] || 'USD';
  }

  /**
   * Format price with currency information
   */
  public formatPrice(
    amount: number,
    currency: string,
    locale = 'en-US'
  ): string {
    if (!this.validateCurrency(currency)) {
      throw new Error(`Invalid currency: ${currency}`);
    }

    const normalizedCurrency = currency.toUpperCase();

    // JPY and KRW typically don't use decimals
    const decimals = ['JPY', 'KRW'].includes(normalizedCurrency) ? 0 : 2;

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: normalizedCurrency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount);
    } catch (error) {
      logger.warn(`Formatting failed for currency ${currency}, using fallback`);
      return `${normalizedCurrency} ${amount.toFixed(decimals)}`;
    }
  }

  /**
   * Convert price in base currency to multiple currencies
   * Useful for displaying prices in multiple currencies
   */
  public async convertToMultipleCurrencies(
    amount: number,
    fromCurrency: string,
    toCurrencies: string[]
  ): Promise<{ [key: string]: number }> {
    const results: { [key: string]: number } = {};

    try {
      for (const toCurrency of toCurrencies) {
        const conversion = await this.convertCurrency(amount, fromCurrency, toCurrency);
        results[toCurrency] = conversion.result;
      }

      return results;
    } catch (error) {
      logger.error(`Failed to convert to multiple currencies: ${error}`);
      throw new Error(`Failed to convert to multiple currencies: ${error}`);
    }
  }

  /**
   * Clear exchange rate cache
   * Useful for testing or forcing a refresh
   */
  public async clearRateCache(baseCurrency = this.baseCurrency): Promise<void> {
    try {
      const cacheKey = `${this.cacheKeyPrefix}${baseCurrency}`;
      await this.redisClient.del(cacheKey);
      logger.info(`Cleared cache for exchange rates: ${baseCurrency}`);
    } catch (error) {
      logger.error(`Failed to clear rate cache: ${error}`);
      throw new Error(`Failed to clear rate cache: ${error}`);
    }
  }

  /**
   * Get currency metadata
   */
  public getCurrencyMetadata(currency: string): {
    code: string;
    symbol: string;
    decimals: number;
  } | null {
    const metadata: {
      [key: string]: { code: string; symbol: string; decimals: number };
    } = {
      USD: { code: 'USD', symbol: '$', decimals: 2 },
      EUR: { code: 'EUR', symbol: '€', decimals: 2 },
      GBP: { code: 'GBP', symbol: '£', decimals: 2 },
      CAD: { code: 'CAD', symbol: 'C$', decimals: 2 },
      AUD: { code: 'AUD', symbol: 'A$', decimals: 2 },
      JPY: { code: 'JPY', symbol: '¥', decimals: 0 },
      CHF: { code: 'CHF', symbol: 'CHF', decimals: 2 },
      CNY: { code: 'CNY', symbol: '¥', decimals: 2 },
      INR: { code: 'INR', symbol: '₹', decimals: 2 },
      AED: { code: 'AED', symbol: 'د.إ', decimals: 2 },
      SGD: { code: 'SGD', symbol: 'S$', decimals: 2 },
      HKD: { code: 'HKD', symbol: 'HK$', decimals: 2 },
      NZD: { code: 'NZD', symbol: 'NZ$', decimals: 2 },
      MXN: { code: 'MXN', symbol: '$', decimals: 2 },
      BRL: { code: 'BRL', symbol: 'R$', decimals: 2 },
      ZAR: { code: 'ZAR', symbol: 'R', decimals: 2 },
      SEK: { code: 'SEK', symbol: 'kr', decimals: 2 },
      NOK: { code: 'NOK', symbol: 'kr', decimals: 2 },
      KRW: { code: 'KRW', symbol: '₩', decimals: 0 },
      THB: { code: 'THB', symbol: '฿', decimals: 2 },
    };

    const normalizedCurrency = currency.toUpperCase();
    return metadata[normalizedCurrency] || null;
  }
}

/**
 * Factory function to create currency service instance
 */
export function createCurrencyService(redisClient: Redis, apiKey?: string): CurrencyService {
  return new CurrencyService(redisClient, apiKey);
}
