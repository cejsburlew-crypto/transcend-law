// Deep Linking Utility
// Features: Shareable deep links for all major screens, app/web fallback,
// Universal Links/App Links support, analytics tracking, short URL generation

import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES & INTERFACES
// ============================================

export type ScreenType =
  | 'dashboard'
  | 'case'
  | 'case-detail'
  | 'attorney'
  | 'firm'
  | 'services'
  | 'service-detail'
  | 'notary'
  | 'notary-detail'
  | 'intake'
  | 'documents'
  | 'payments'
  | 'messages'
  | 'profile'
  | 'attorney-profile'
  | 'job-board'
  | 'specialties'
  | 'specialty-detail';

export interface DeepLinkParams {
  screen: ScreenType;
  id?: string;
  params?: Record<string, string | number | boolean>;
  referrer?: string;
  campaign?: string;
  medium?: string;
  source?: string;
}

export interface DeepLink {
  id: string;
  url: string;
  shortUrl: string;
  appUrl: string;
  webUrl: string;
  screen: ScreenType;
  params: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
  clicks: number;
  lastClickedAt?: Date;
  metadata?: {
    campaign?: string;
    medium?: string;
    source?: string;
    referrer?: string;
    userId?: string;
  };
}

export interface DeepLinkAnalytics {
  linkId: string;
  timestamp: Date;
  userAgent: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  appInstalled: boolean;
  clickedAt: Date;
  referrer?: string;
  ipAddress?: string;
  conversionOccurred: boolean;
  conversionData?: Record<string, any>;
}

export interface DeepLinkConfig {
  appScheme: string;
  appHost: string;
  appBundleId: string;
  appPackageName: string;
  webDomain: string;
  appleTeamId: string;
  androidPublisher: string;
  shortUrlDomain: string;
  shortUrlPath: string;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_CONFIG: DeepLinkConfig = {
  appScheme: 'transcendlaw://',
  appHost: 'app.transcendlaw.com',
  appBundleId: 'com.transcendlaw.app',
  appPackageName: 'com.transcendlaw',
  webDomain: 'transcend-law.com',
  appleTeamId: process.env.REACT_APP_APPLE_TEAM_ID || '',
  androidPublisher: process.env.REACT_APP_ANDROID_PUBLISHER || '',
  shortUrlDomain: 'tl.sh',
  shortUrlPath: '/link',
};

const SCREEN_PATHS: Record<ScreenType, string> = {
  dashboard: '/dashboard',
  case: '/cases',
  'case-detail': '/cases/:id',
  attorney: '/attorneys',
  firm: '/firms',
  services: '/services',
  'service-detail': '/services/:id',
  notary: '/notary',
  'notary-detail': '/notary/:id',
  intake: '/intake',
  documents: '/documents',
  payments: '/payments',
  messages: '/messages',
  profile: '/profile',
  'attorney-profile': '/attorney/:id',
  'job-board': '/jobs',
  specialties: '/specialties',
  'specialty-detail': '/specialties/:id',
};

// ============================================
// DEEP LINK BUILDER
// ============================================

export class DeepLinkBuilder {
  private config: DeepLinkConfig;

  constructor(config: Partial<DeepLinkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a deep link for a given screen
   */
  generateDeepLink(params: DeepLinkParams): DeepLink {
    const id = uuidv4();
    const path = this.buildPath(params.screen, params.id);
    const query = this.buildQueryString({
      ...params.params,
      ...(params.campaign && { campaign: params.campaign }),
      ...(params.medium && { medium: params.medium }),
      ...(params.source && { source: params.source }),
      ...(params.referrer && { referrer: params.referrer }),
    });

    const appUrl = this.buildAppUrl(path, query);
    const webUrl = this.buildWebUrl(path, query);
    const shortUrl = this.generateShortUrl(id);

    return {
      id,
      url: appUrl, // Default to app URL
      shortUrl,
      appUrl,
      webUrl,
      screen: params.screen,
      params: params.params || {},
      createdAt: new Date(),
      clicks: 0,
      metadata: {
        campaign: params.campaign,
        medium: params.medium,
        source: params.source,
        referrer: params.referrer,
      },
    };
  }

  /**
   * Build app-specific deep link URL
   */
  private buildAppUrl(path: string, query: string): string {
    return `${this.config.appScheme}${this.config.appHost}${path}${query}`;
  }

  /**
   * Build web URL for app-not-installed fallback
   */
  private buildWebUrl(path: string, query: string): string {
    const protocol = 'https://';
    return `${protocol}${this.config.webDomain}${path}${query}`;
  }

  /**
   * Generate short URL
   */
  private generateShortUrl(linkId: string): string {
    // In production, this would call a short URL service
    return `https://${this.config.shortUrlDomain}${this.config.shortUrlPath}/${linkId}`;
  }

  /**
   * Build path from screen type and ID
   */
  private buildPath(screen: ScreenType, id?: string): string {
    let path = SCREEN_PATHS[screen] || '';
    if (id && path.includes(':id')) {
      path = path.replace(':id', id);
    }
    return path;
  }

  /**
   * Build query string from params
   */
  private buildQueryString(params: Record<string, any>): string {
    const filtered = Object.entries(params).filter(([_, v]) => v != null);
    if (filtered.length === 0) return '';

    const query = filtered
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    return `?${query}`;
  }

  /**
   * Generate Universal Link for iOS
   */
  generateUniversalLink(params: DeepLinkParams): string {
    return this.buildWebUrl(this.buildPath(params.screen, params.id), '');
  }

  /**
   * Generate App Link for Android
   */
  generateAppLink(params: DeepLinkParams): string {
    return `intent://${this.config.appHost}${this.buildPath(params.screen, params.id)}#Intent;scheme=${this.config.appScheme};package=${this.config.appPackageName};end`;
  }
}

// ============================================
// DEEP LINK HANDLER
// ============================================

export class DeepLinkHandler {
  private config: DeepLinkConfig;

  constructor(config: Partial<DeepLinkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle incoming deep link and route to appropriate screen
   */
  handleDeepLink(url: string): { screen: ScreenType; id?: string; params: Record<string, any> } | null {
    try {
      const parsedUrl = new URL(url);
      const pathname = parsedUrl.pathname;
      const searchParams = parsedUrl.searchParams;

      // Extract screen and ID from pathname
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length === 0) return null;

      const screenType = this.getScreenType(pathname);
      if (!screenType) return null;

      // Extract ID if present
      let id: string | undefined;
      if (SCREEN_PATHS[screenType].includes(':id')) {
        id = segments[segments.length - 1];
      }

      // Convert search params to object
      const params: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return {
        screen: screenType,
        id,
        params,
      };
    } catch (error) {
      console.error('Error handling deep link:', error);
      return null;
    }
  }

  /**
   * Determine screen type from pathname
   */
  private getScreenType(pathname: string): ScreenType | null {
    for (const [screen, path] of Object.entries(SCREEN_PATHS)) {
      const regex = this.pathToRegex(path);
      if (regex.test(pathname)) {
        return screen as ScreenType;
      }
    }
    return null;
  }

  /**
   * Convert path pattern to regex for matching
   */
  private pathToRegex(path: string): RegExp {
    const escaped = path.replace(/\//g, '\\/').replace(/:\w+/g, '[^/]+');
    return new RegExp(`^${escaped}$`);
  }

  /**
   * Extract parameters from deep link
   */
  extractParams(url: string): Record<string, any> {
    try {
      const parsedUrl = new URL(url);
      const params: Record<string, any> = {};

      parsedUrl.searchParams.forEach((value, key) => {
        // Try to parse as JSON for complex types
        if (value === 'true') params[key] = true;
        else if (value === 'false') params[key] = false;
        else if (!isNaN(Number(value))) params[key] = Number(value);
        else params[key] = value;
      });

      return params;
    } catch (error) {
      console.error('Error extracting params:', error);
      return {};
    }
  }
}

// ============================================
// PLATFORM DETECTION
// ============================================

export class PlatformDetector {
  /**
   * Detect current platform
   */
  static detectPlatform(): 'ios' | 'android' | 'web' | 'unknown' {
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    if (/windows|mac|linux/.test(ua)) return 'web';

    return 'unknown';
  }

  /**
   * Check if app is installed (heuristic)
   */
  static isAppInstalled(): boolean {
    const platform = this.detectPlatform();

    if (platform === 'ios') {
      // iOS detection: try to launch app, fallback to web if not installed
      return this.iosAppInstallCheck();
    }

    if (platform === 'android') {
      // Android detection: check if app package is available
      return this.androidAppInstallCheck();
    }

    return false;
  }

  /**
   * iOS app install check
   */
  private static iosAppInstallCheck(): boolean {
    // This is a heuristic - in production use proper app linking
    const start = Date.now();
    const timeout = setTimeout(() => {
      // If app doesn't respond within 100ms, it's not installed
    }, 100);

    try {
      window.location.href = 'transcendlaw://app-install-check';
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Android app install check
   */
  private static androidAppInstallCheck(): boolean {
    // On Android, we typically use intent or check navigator capabilities
    return (window as any).android?.isAppInstalled?.() || false;
  }

  /**
   * Get device info
   */
  static getDeviceInfo(): {
    platform: string;
    osVersion?: string;
    browser: string;
  } {
    const ua = navigator.userAgent;
    const platform = this.detectPlatform();

    let osVersion: string | undefined;
    if (platform === 'ios') {
      const match = ua.match(/OS (\d+_\d+)/);
      osVersion = match ? match[1].replace('_', '.') : undefined;
    } else if (platform === 'android') {
      const match = ua.match(/Android (\d+\.?\d*)/);
      osVersion = match ? match[1] : undefined;
    }

    return {
      platform,
      osVersion,
      browser: this.getBrowserName(),
    };
  }

  /**
   * Get browser name
   */
  private static getBrowserName(): string {
    const ua = navigator.userAgent;
    if (ua.indexOf('Chrome') > -1) return 'Chrome';
    if (ua.indexOf('Safari') > -1) return 'Safari';
    if (ua.indexOf('Firefox') > -1) return 'Firefox';
    if (ua.indexOf('Edge') > -1) return 'Edge';
    return 'Unknown';
  }
}

// ============================================
// ANALYTICS TRACKER
// ============================================

export class DeepLinkAnalytics {
  private apiEndpoint: string;

  constructor(apiEndpoint: string = '/api/deep-links/analytics') {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Track deep link click
   */
  async trackClick(
    linkId: string,
    params?: {
      campaign?: string;
      medium?: string;
      source?: string;
      referrer?: string;
      userId?: string;
    }
  ): Promise<void> {
    try {
      const deviceInfo = PlatformDetector.getDeviceInfo();

      const analytics: DeepLinkAnalytics = {
        linkId,
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        platform: deviceInfo.platform as any,
        appInstalled: PlatformDetector.isAppInstalled(),
        clickedAt: new Date(),
        referrer: params?.referrer || document.referrer,
        conversionOccurred: false,
      };

      await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analytics),
      });
    } catch (error) {
      console.error('Error tracking deep link click:', error);
    }
  }

  /**
   * Track conversion event
   */
  async trackConversion(
    linkId: string,
    conversionData: Record<string, any>
  ): Promise<void> {
    try {
      await fetch(`${this.apiEndpoint}/conversion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          conversionData,
          timestamp: new Date(),
        }),
      });
    } catch (error) {
      console.error('Error tracking conversion:', error);
    }
  }
}

// ============================================
// HOOKS & UTILITIES
// ============================================

/**
 * React hook for deep linking
 */
export function useDeepLink(config?: Partial<DeepLinkConfig>) {
  const builder = new DeepLinkBuilder(config);
  const handler = new DeepLinkHandler(config);

  return {
    generateDeepLink: (params: DeepLinkParams) => builder.generateDeepLink(params),
    generateUniversalLink: (params: DeepLinkParams) => builder.generateUniversalLink(params),
    generateAppLink: (params: DeepLinkParams) => builder.generateAppLink(params),
    handleDeepLink: (url: string) => handler.handleDeepLink(url),
    extractParams: (url: string) => handler.extractParams(url),
    detectPlatform: () => PlatformDetector.detectPlatform(),
    isAppInstalled: () => PlatformDetector.isAppInstalled(),
    getDeviceInfo: () => PlatformDetector.getDeviceInfo(),
  };
}

// ============================================
// URL SCHEMES
// ============================================

/**
 * Generate custom URL scheme link
 */
export function generateCustomScheme(
  screen: ScreenType,
  id?: string,
  params?: Record<string, string>
): string {
  const builder = new DeepLinkBuilder();
  const deepLink = builder.generateDeepLink({ screen, id, params });
  return deepLink.appUrl;
}

/**
 * Open deep link with fallback
 */
export async function openDeepLink(
  deepLink: string,
  webFallback?: string,
  analytics?: DeepLinkAnalytics
): Promise<void> {
  try {
    // Track the click
    if (analytics) {
      const linkId = deepLink.split('/').pop() || '';
      await analytics.trackClick(linkId);
    }

    // Try to open app
    const platform = PlatformDetector.detectPlatform();

    if (platform === 'ios' || platform === 'android') {
      const start = Date.now();
      const timeout = setTimeout(() => {
        // If app doesn't open within 1.5 seconds, try web fallback
        if (webFallback) {
          window.location.href = webFallback;
        }
      }, 1500);

      window.location.href = deepLink;

      // Clear timeout if app opens successfully
      window.addEventListener('blur', () => clearTimeout(timeout));
    } else if (webFallback) {
      window.location.href = webFallback;
    }
  } catch (error) {
    console.error('Error opening deep link:', error);
    if (webFallback) {
      window.location.href = webFallback;
    }
  }
}

/**
 * Copy deep link to clipboard
 */
export async function copyDeepLinkToClipboard(deepLink: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(deepLink);
      return true;
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = deepLink;
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    }
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
}

export default DeepLinkBuilder;
