/**
 * Deep Link Service
 * Features: Generate shareable deep links, track clicks/conversions, short URL management,
 * Analytics on link performance, Universal Links/App Links support
 */

import { query, transaction } from '../src/database/connection';
import { v4 as uuidv4 } from 'uuid';
import { auditLogger } from './auditLogger';
import * as crypto from 'crypto';

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

export interface DeepLink {
  id: string;
  userId: string;
  shortCode: string;
  fullUrl: string;
  appUrl: string;
  webUrl: string;
  screen: ScreenType;
  resourceId?: string;
  params: Record<string, any>;
  campaign?: string;
  medium?: string;
  source?: string;
  expiresAt?: Date;
  clicks: number;
  conversions: number;
  lastClickedAt?: Date;
  lastConvertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface DeepLinkClick {
  id: string;
  linkId: string;
  timestamp: Date;
  userAgent: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  appInstalled: boolean;
  referrer?: string;
  ipAddress?: string;
  userId?: string;
  converted: boolean;
  conversionValue?: number;
  conversionData?: Record<string, any>;
}

export interface DeepLinkAnalytics {
  linkId: string;
  totalClicks: number;
  uniqueClicks: number;
  conversions: number;
  conversionRate: number;
  iosPlatformClicks: number;
  androidPlatformClicks: number;
  webPlatformClicks: number;
  appInstalledClicks: number;
  averageTimeToConversion?: number;
  topReferrers: Array<{ referrer: string; clicks: number }>;
  clicksByDay: Array<{ date: string; clicks: number }>;
  conversionsByDay: Array<{ date: string; conversions: number }>;
}

export interface ShortUrlMapping {
  id: string;
  shortCode: string;
  fullUrl: string;
  redirectUrl: string;
  clicks: number;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

// ============================================
// DATABASE SCHEMA
// ============================================

export async function initializeDeepLinkSchema(): Promise<void> {
  try {
    // Deep links table
    await query(`
      CREATE TABLE IF NOT EXISTS deep_links (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        short_code VARCHAR(12) UNIQUE NOT NULL,
        full_url TEXT NOT NULL,
        app_url TEXT NOT NULL,
        web_url TEXT NOT NULL,
        screen VARCHAR(50) NOT NULL,
        resource_id VARCHAR(255),
        params JSONB DEFAULT '{}',
        campaign VARCHAR(255),
        medium VARCHAR(100),
        source VARCHAR(100),
        expires_at TIMESTAMP,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        last_clicked_at TIMESTAMP,
        last_converted_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_deep_links_user_id ON deep_links(user_id);
      CREATE INDEX IF NOT EXISTS idx_deep_links_short_code ON deep_links(short_code);
      CREATE INDEX IF NOT EXISTS idx_deep_links_resource_id ON deep_links(resource_id);
    `);

    // Deep link clicks table
    await query(`
      CREATE TABLE IF NOT EXISTS deep_link_clicks (
        id UUID PRIMARY KEY,
        link_id UUID NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT,
        platform VARCHAR(20),
        app_installed BOOLEAN DEFAULT FALSE,
        referrer TEXT,
        ip_address VARCHAR(45),
        user_id UUID,
        converted BOOLEAN DEFAULT FALSE,
        conversion_value NUMERIC,
        conversion_data JSONB,
        FOREIGN KEY (link_id) REFERENCES deep_links(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_deep_link_clicks_link_id ON deep_link_clicks(link_id);
      CREATE INDEX IF NOT EXISTS idx_deep_link_clicks_timestamp ON deep_link_clicks(timestamp);
      CREATE INDEX IF NOT EXISTS idx_deep_link_clicks_user_id ON deep_link_clicks(user_id);
      CREATE INDEX IF NOT EXISTS idx_deep_link_clicks_platform ON deep_link_clicks(platform);
    `);

    // Short URL mappings table
    await query(`
      CREATE TABLE IF NOT EXISTS short_url_mappings (
        id UUID PRIMARY KEY,
        short_code VARCHAR(12) UNIQUE NOT NULL,
        full_url TEXT NOT NULL,
        redirect_url TEXT NOT NULL,
        clicks INTEGER DEFAULT 0,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(short_code)
      );

      CREATE INDEX IF NOT EXISTS idx_short_url_mappings_short_code ON short_url_mappings(short_code);
    `);

    await auditLogger.log('DEEP_LINK_SCHEMA_INITIALIZED', {
      component: 'deepLinkService',
      status: 'success',
    });

    console.log('✅ Deep link schema initialized');
  } catch (error) {
    console.error('❌ Error initializing deep link schema:', error);
    throw error;
  }
}

// ============================================
// DEEP LINK GENERATION
// ============================================

/**
 * Generate a new deep link
 */
export async function generateDeepLink(
  userId: string,
  screen: ScreenType,
  options: {
    resourceId?: string;
    params?: Record<string, any>;
    campaign?: string;
    medium?: string;
    source?: string;
    expiresAt?: Date;
  }
): Promise<DeepLink> {
  try {
    const linkId = uuidv4();
    const shortCode = generateShortCode();

    // Build URLs
    const basePath = buildScreenPath(screen, options.resourceId);
    const queryParams = buildQueryString({
      ...options.params,
      campaign: options.campaign,
      medium: options.medium,
      source: options.source,
    });

    const appUrl = `transcendlaw://app.transcendlaw.com${basePath}${queryParams}`;
    const webUrl = `https://transcend-law.com${basePath}${queryParams}`;
    const fullUrl = `https://transcend-law.com${basePath}`;

    const deepLink: DeepLink = {
      id: linkId,
      userId,
      shortCode,
      fullUrl,
      appUrl,
      webUrl,
      screen,
      resourceId: options.resourceId,
      params: options.params || {},
      campaign: options.campaign,
      medium: options.medium,
      source: options.source,
      expiresAt: options.expiresAt,
      clicks: 0,
      conversions: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
    };

    // Store in database
    await query(
      `
        INSERT INTO deep_links (
          id, user_id, short_code, full_url, app_url, web_url, screen,
          resource_id, params, campaign, medium, source, expires_at,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `,
      [
        linkId,
        userId,
        shortCode,
        fullUrl,
        appUrl,
        webUrl,
        screen,
        options.resourceId,
        JSON.stringify(options.params || {}),
        options.campaign,
        options.medium,
        options.source,
        options.expiresAt,
        new Date(),
        new Date(),
      ]
    );

    await auditLogger.log('DEEP_LINK_CREATED', {
      linkId,
      userId,
      screen,
      resourceId: options.resourceId,
    });

    return deepLink;
  } catch (error) {
    console.error('Error generating deep link:', error);
    throw error;
  }
}

/**
 * Get a deep link by ID or short code
 */
export async function getDeepLink(identifier: string): Promise<DeepLink | null> {
  try {
    // Try by ID first, then by short code
    const result = await query(
      `
        SELECT * FROM deep_links
        WHERE id = $1 OR short_code = $2
        LIMIT 1
      `,
      [identifier, identifier]
    );

    if (result.rows.length === 0) return null;

    return formatDeepLinkRow(result.rows[0]);
  } catch (error) {
    console.error('Error getting deep link:', error);
    throw error;
  }
}

/**
 * Get all deep links for a user
 */
export async function getUserDeepLinks(
  userId: string,
  options?: {
    screen?: ScreenType;
    limit?: number;
    offset?: number;
    sortBy?: 'clicks' | 'created' | 'updated';
  }
): Promise<{ links: DeepLink[]; total: number }> {
  try {
    let whereClause = 'WHERE user_id = $1';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options?.screen) {
      whereClause += ` AND screen = $${paramIndex}`;
      params.push(options.screen);
      paramIndex++;
    }

    // Get total count
    const countResult = await query(`SELECT COUNT(*) FROM deep_links ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    let orderBy = 'created_at DESC';
    if (options?.sortBy === 'clicks') orderBy = 'clicks DESC';
    if (options?.sortBy === 'updated') orderBy = 'updated_at DESC';

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const result = await query(
      `
        SELECT * FROM deep_links
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    const links = result.rows.map(formatDeepLinkRow);

    return { links, total };
  } catch (error) {
    console.error('Error getting user deep links:', error);
    throw error;
  }
}

/**
 * Update deep link
 */
export async function updateDeepLink(
  linkId: string,
  updates: Partial<DeepLink>
): Promise<DeepLink> {
  try {
    const setClauses: string[] = [];
    const params: any[] = [linkId];
    let paramIndex = 2;

    if (updates.campaign !== undefined) {
      setClauses.push(`campaign = $${paramIndex++}`);
      params.push(updates.campaign);
    }

    if (updates.expiresAt !== undefined) {
      setClauses.push(`expires_at = $${paramIndex++}`);
      params.push(updates.expiresAt);
    }

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }

    if (updates.params !== undefined) {
      setClauses.push(`params = $${paramIndex++}`);
      params.push(JSON.stringify(updates.params));
    }

    setClauses.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());

    const result = await query(
      `
        UPDATE deep_links
        SET ${setClauses.join(', ')}
        WHERE id = $1
        RETURNING *
      `,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Deep link not found');
    }

    await auditLogger.log('DEEP_LINK_UPDATED', {
      linkId,
      updates,
    });

    return formatDeepLinkRow(result.rows[0]);
  } catch (error) {
    console.error('Error updating deep link:', error);
    throw error;
  }
}

/**
 * Delete deep link
 */
export async function deleteDeepLink(linkId: string): Promise<void> {
  try {
    await query(
      `
        DELETE FROM deep_links
        WHERE id = $1
      `,
      [linkId]
    );

    await auditLogger.log('DEEP_LINK_DELETED', { linkId });
  } catch (error) {
    console.error('Error deleting deep link:', error);
    throw error;
  }
}

// ============================================
// CLICK & CONVERSION TRACKING
// ============================================

/**
 * Track a deep link click
 */
export async function trackDeepLinkClick(
  linkId: string,
  clickData: {
    userAgent?: string;
    platform?: 'ios' | 'android' | 'web' | 'unknown';
    appInstalled?: boolean;
    referrer?: string;
    ipAddress?: string;
    userId?: string;
  }
): Promise<DeepLinkClick> {
  try {
    const clickId = uuidv4();

    // Store click
    await query(
      `
        INSERT INTO deep_link_clicks (
          id, link_id, user_agent, platform, app_installed,
          referrer, ip_address, user_id, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        clickId,
        linkId,
        clickData.userAgent,
        clickData.platform || 'unknown',
        clickData.appInstalled || false,
        clickData.referrer,
        clickData.ipAddress,
        clickData.userId,
        new Date(),
      ]
    );

    // Update deep link click count and last clicked time
    await query(
      `
        UPDATE deep_links
        SET clicks = clicks + 1,
            last_clicked_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [linkId]
    );

    const click: DeepLinkClick = {
      id: clickId,
      linkId,
      timestamp: new Date(),
      userAgent: clickData.userAgent,
      platform: clickData.platform || 'unknown',
      appInstalled: clickData.appInstalled || false,
      referrer: clickData.referrer,
      ipAddress: clickData.ipAddress,
      userId: clickData.userId,
      converted: false,
    };

    return click;
  } catch (error) {
    console.error('Error tracking deep link click:', error);
    throw error;
  }
}

/**
 * Track conversion from deep link
 */
export async function trackDeepLinkConversion(
  linkId: string,
  conversionData?: {
    value?: number;
    data?: Record<string, any>;
    clickId?: string;
  }
): Promise<void> {
  try {
    await transaction(async (client) => {
      // Update click record
      if (conversionData?.clickId) {
        await client.query(
          `
            UPDATE deep_link_clicks
            SET converted = TRUE,
                conversion_value = $1,
                conversion_data = $2
            WHERE id = $3
          `,
          [
            conversionData.value,
            JSON.stringify(conversionData.data),
            conversionData.clickId,
          ]
        );
      }

      // Update deep link conversion count
      await client.query(
        `
          UPDATE deep_links
          SET conversions = conversions + 1,
              last_converted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [linkId]
      );
    });

    await auditLogger.log('DEEP_LINK_CONVERSION', {
      linkId,
      value: conversionData?.value,
    });
  } catch (error) {
    console.error('Error tracking conversion:', error);
    throw error;
  }
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get analytics for a deep link
 */
export async function getDeepLinkAnalytics(
  linkId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
  }
): Promise<DeepLinkAnalytics> {
  try {
    const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: last 30 days
    const endDate = options?.endDate || new Date();

    // Get overall stats
    const statsResult = await query(
      `
        SELECT
          COUNT(DISTINCT id) as total_clicks,
          COUNT(DISTINCT user_id) as unique_clicks,
          SUM(CASE WHEN converted = TRUE THEN 1 ELSE 0 END) as conversions,
          SUM(CASE WHEN platform = 'ios' THEN 1 ELSE 0 END) as ios_clicks,
          SUM(CASE WHEN platform = 'android' THEN 1 ELSE 0 END) as android_clicks,
          SUM(CASE WHEN platform = 'web' THEN 1 ELSE 0 END) as web_clicks,
          SUM(CASE WHEN app_installed = TRUE THEN 1 ELSE 0 END) as app_installed_clicks,
          AVG(CASE WHEN converted = TRUE THEN EXTRACT(EPOCH FROM (timestamp - (
            SELECT timestamp FROM deep_link_clicks c2
            WHERE c2.id = deep_link_clicks.id
          ))) ELSE NULL END) as avg_time_to_conversion
        FROM deep_link_clicks
        WHERE link_id = $1
          AND timestamp BETWEEN $2 AND $3
      `,
      [linkId, startDate, endDate]
    );

    const stats = statsResult.rows[0];
    const totalClicks = parseInt(stats.total_clicks || '0');
    const conversions = parseInt(stats.conversions || '0');

    // Get top referrers
    const referrersResult = await query(
      `
        SELECT referrer, COUNT(*) as clicks
        FROM deep_link_clicks
        WHERE link_id = $1
          AND timestamp BETWEEN $2 AND $3
          AND referrer IS NOT NULL
        GROUP BY referrer
        ORDER BY clicks DESC
        LIMIT 10
      `,
      [linkId, startDate, endDate]
    );

    const topReferrers = referrersResult.rows.map((row) => ({
      referrer: row.referrer,
      clicks: parseInt(row.clicks),
    }));

    // Get clicks by day
    const clicksByDayResult = await query(
      `
        SELECT DATE(timestamp) as date, COUNT(*) as clicks
        FROM deep_link_clicks
        WHERE link_id = $1
          AND timestamp BETWEEN $2 AND $3
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `,
      [linkId, startDate, endDate]
    );

    const clicksByDay = clicksByDayResult.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      clicks: parseInt(row.clicks),
    }));

    // Get conversions by day
    const conversionsByDayResult = await query(
      `
        SELECT DATE(timestamp) as date, COUNT(*) as conversions
        FROM deep_link_clicks
        WHERE link_id = $1
          AND timestamp BETWEEN $2 AND $3
          AND converted = TRUE
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `,
      [linkId, startDate, endDate]
    );

    const conversionsByDay = conversionsByDayResult.rows.map((row) => ({
      date: row.date.toISOString().split('T')[0],
      conversions: parseInt(row.conversions),
    }));

    return {
      linkId,
      totalClicks,
      uniqueClicks: parseInt(stats.unique_clicks || '0'),
      conversions,
      conversionRate: totalClicks > 0 ? (conversions / totalClicks) * 100 : 0,
      iosPlatformClicks: parseInt(stats.ios_clicks || '0'),
      androidPlatformClicks: parseInt(stats.android_clicks || '0'),
      webPlatformClicks: parseInt(stats.web_clicks || '0'),
      appInstalledClicks: parseInt(stats.app_installed_clicks || '0'),
      averageTimeToConversion: stats.avg_time_to_conversion ? parseFloat(stats.avg_time_to_conversion) : undefined,
      topReferrers,
      clicksByDay,
      conversionsByDay,
    };
  } catch (error) {
    console.error('Error getting deep link analytics:', error);
    throw error;
  }
}

// ============================================
// SHORT URL MANAGEMENT
// ============================================

/**
 * Generate a short URL mapping
 */
export async function generateShortUrl(fullUrl: string, expiresAt?: Date): Promise<ShortUrlMapping> {
  try {
    const mappingId = uuidv4();
    const shortCode = generateShortCode();

    // In production, you might want to use a service like bit.ly or Firebase Dynamic Links
    const redirectUrl = fullUrl;

    const mapping: ShortUrlMapping = {
      id: mappingId,
      shortCode,
      fullUrl,
      redirectUrl,
      clicks: 0,
      createdAt: new Date(),
      expiresAt,
      isActive: true,
    };

    await query(
      `
        INSERT INTO short_url_mappings (
          id, short_code, full_url, redirect_url, expires_at
        ) VALUES ($1, $2, $3, $4, $5)
      `,
      [mappingId, shortCode, fullUrl, redirectUrl, expiresAt]
    );

    return mapping;
  } catch (error) {
    console.error('Error generating short URL:', error);
    throw error;
  }
}

/**
 * Resolve a short URL
 */
export async function resolveShortUrl(shortCode: string): Promise<ShortUrlMapping | null> {
  try {
    const result = await query(
      `
        SELECT * FROM short_url_mappings
        WHERE short_code = $1 AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `,
      [shortCode]
    );

    if (result.rows.length === 0) return null;

    // Increment clicks
    await query(
      `
        UPDATE short_url_mappings
        SET clicks = clicks + 1
        WHERE short_code = $1
      `,
      [shortCode]
    );

    return formatShortUrlRow(result.rows[0]);
  } catch (error) {
    console.error('Error resolving short URL:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a short code for URLs (6-12 characters)
 */
function generateShortCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Build screen path from screen type and resource ID
 */
function buildScreenPath(screen: ScreenType, resourceId?: string): string {
  const paths: Record<ScreenType, string> = {
    dashboard: '/dashboard',
    case: '/cases',
    'case-detail': `/cases/${resourceId}`,
    attorney: '/attorneys',
    firm: `/firms/${resourceId}`,
    services: '/services',
    'service-detail': `/services/${resourceId}`,
    notary: '/notary',
    'notary-detail': `/notary/${resourceId}`,
    intake: '/intake',
    documents: '/documents',
    payments: '/payments',
    messages: '/messages',
    profile: '/profile',
    'attorney-profile': `/attorney/${resourceId}`,
    'job-board': '/jobs',
    specialties: '/specialties',
    'specialty-detail': `/specialties/${resourceId}`,
  };

  return paths[screen] || '/';
}

/**
 * Build query string from parameters
 */
function buildQueryString(params: Record<string, any>): string {
  const filtered = Object.entries(params).filter(([_, v]) => v != null);
  if (filtered.length === 0) return '';

  const query = filtered
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `?${query}`;
}

/**
 * Format database row to DeepLink object
 */
function formatDeepLinkRow(row: any): DeepLink {
  return {
    id: row.id,
    userId: row.user_id,
    shortCode: row.short_code,
    fullUrl: row.full_url,
    appUrl: row.app_url,
    webUrl: row.web_url,
    screen: row.screen,
    resourceId: row.resource_id,
    params: row.params || {},
    campaign: row.campaign,
    medium: row.medium,
    source: row.source,
    expiresAt: row.expires_at,
    clicks: row.clicks,
    conversions: row.conversions,
    lastClickedAt: row.last_clicked_at,
    lastConvertedAt: row.last_converted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isActive: row.is_active,
  };
}

/**
 * Format database row to ShortUrlMapping object
 */
function formatShortUrlRow(row: any): ShortUrlMapping {
  return {
    id: row.id,
    shortCode: row.short_code,
    fullUrl: row.full_url,
    redirectUrl: row.redirect_url,
    clicks: row.clicks,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isActive: row.is_active,
  };
}

export default {
  generateDeepLink,
  getDeepLink,
  getUserDeepLinks,
  updateDeepLink,
  deleteDeepLink,
  trackDeepLinkClick,
  trackDeepLinkConversion,
  getDeepLinkAnalytics,
  generateShortUrl,
  resolveShortUrl,
  initializeDeepLinkSchema,
};
