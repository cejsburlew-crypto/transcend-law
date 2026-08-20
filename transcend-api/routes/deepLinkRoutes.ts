/**
 * Deep Link Routes
 * Endpoints for generating, tracking, and managing deep links
 */

import { Router, Request, Response } from 'express';
import * as deepLinkService from '../services/deepLinkService';
import { authenticateToken, requireRole } from '../middleware/auth';
import { queryParam, routeParam } from '../src/utils/httpParams';

const router = Router();

// ============================================
// DEEP LINK GENERATION ROUTES
// ============================================

/**
 * POST /api/deep-links/generate
 * Generate a new deep link
 * Body: { screen, resourceId?, params?, campaign?, medium?, source?, expiresAt? }
 */
router.post('/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { screen, resourceId, params, campaign, medium, source, expiresAt } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!screen) {
      return res.status(400).json({ error: 'Screen type is required' });
    }

    const deepLink = await deepLinkService.generateDeepLink(userId, screen, {
      resourceId,
      params,
      campaign,
      medium,
      source,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.json({
      success: true,
      data: deepLink,
      shortUrl: deepLink.fullUrl,
      appUrl: deepLink.appUrl,
      webUrl: deepLink.webUrl,
    });
  } catch (error) {
    console.error('Error generating deep link:', error);
    res.status(500).json({ error: 'Failed to generate deep link' });
  }
});

/**
 * GET /api/deep-links/:linkId
 * Get a deep link by ID
 */
router.get('/:linkId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const linkId = routeParam(req.params.linkId);

    const deepLink = await deepLinkService.getDeepLink(linkId);

    if (!deepLink) {
      return res.status(404).json({ error: 'Deep link not found' });
    }

    // Verify access: user owns the link or is admin
    if (deepLink.userId !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json({
      success: true,
      data: deepLink,
    });
  } catch (error) {
    console.error('Error fetching deep link:', error);
    res.status(500).json({ error: 'Failed to fetch deep link' });
  }
});

/**
 * GET /api/deep-links
 * Get all deep links for the current user
 * Query: { screen?, sortBy?, limit?, offset? }
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const screen = queryParam(req.query.screen); const sortBy = queryParam(req.query.sortBy); const limit = queryParam(req.query.limit); const offset = queryParam(req.query.offset);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { links, total } = await deepLinkService.getUserDeepLinks(userId, {
      screen: screen as any,
      sortBy: (sortBy as any) || 'created',
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({
      success: true,
      data: links,
      pagination: {
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching user deep links:', error);
    res.status(500).json({ error: 'Failed to fetch deep links' });
  }
});

/**
 * PATCH /api/deep-links/:linkId
 * Update a deep link
 */
router.patch('/:linkId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const linkId = routeParam(req.params.linkId);
    const { campaign, expiresAt, isActive, params } = req.body;

    // Verify access
    const deepLink = await deepLinkService.getDeepLink(linkId);
    if (!deepLink) {
      return res.status(404).json({ error: 'Deep link not found' });
    }

    if (deepLink.userId !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await deepLinkService.updateDeepLink(linkId, {
      campaign,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      isActive,
      params,
    } as any);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating deep link:', error);
    res.status(500).json({ error: 'Failed to update deep link' });
  }
});

/**
 * DELETE /api/deep-links/:linkId
 * Delete a deep link
 */
router.delete('/:linkId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const linkId = routeParam(req.params.linkId);

    // Verify access
    const deepLink = await deepLinkService.getDeepLink(linkId);
    if (!deepLink) {
      return res.status(404).json({ error: 'Deep link not found' });
    }

    if (deepLink.userId !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await deepLinkService.deleteDeepLink(linkId);

    res.json({
      success: true,
      message: 'Deep link deleted',
    });
  } catch (error) {
    console.error('Error deleting deep link:', error);
    res.status(500).json({ error: 'Failed to delete deep link' });
  }
});

// ============================================
// ANALYTICS ROUTES
// ============================================

/**
 * GET /api/deep-links/:linkId/analytics
 * Get analytics for a deep link
 * Query: { startDate?, endDate? }
 */
router.get('/:linkId/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const linkId = routeParam(req.params.linkId);
    const startDate = queryParam(req.query.startDate); const endDate = queryParam(req.query.endDate);

    // Verify access
    const deepLink = await deepLinkService.getDeepLink(linkId);
    if (!deepLink) {
      return res.status(404).json({ error: 'Deep link not found' });
    }

    if (deepLink.userId !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const analytics = await deepLinkService.getDeepLinkAnalytics(linkId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error fetching deep link analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============================================
// TRACKING ROUTES
// ============================================

/**
 * POST /api/deep-links/:linkId/click
 * Track a deep link click
 * Body: { userAgent?, platform?, appInstalled?, referrer?, ipAddress? }
 */
router.post('/:linkId/click', async (req: Request, res: Response) => {
  try {
    const linkId = routeParam(req.params.linkId);
    const { userAgent, platform, appInstalled, referrer, ipAddress } = req.body;

    const click = await deepLinkService.trackDeepLinkClick(linkId, {
      userAgent,
      platform,
      appInstalled,
      referrer,
      ipAddress,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: click,
    });
  } catch (error) {
    console.error('Error tracking deep link click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

/**
 * POST /api/deep-links/:linkId/conversion
 * Track a conversion from a deep link
 * Body: { value?, data?, clickId? }
 */
router.post('/:linkId/conversion', async (req: Request, res: Response) => {
  try {
    const linkId = routeParam(req.params.linkId);
    const { value, data, clickId } = req.body;

    await deepLinkService.trackDeepLinkConversion(linkId, {
      value,
      data,
      clickId,
    });

    res.json({
      success: true,
      message: 'Conversion tracked',
    });
  } catch (error) {
    console.error('Error tracking conversion:', error);
    res.status(500).json({ error: 'Failed to track conversion' });
  }
});

// ============================================
// SHORT URL ROUTES
// ============================================

/**
 * POST /api/deep-links/short-url/generate
 * Generate a short URL
 * Body: { fullUrl, expiresAt? }
 */
router.post('/short-url/generate', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { fullUrl, expiresAt } = req.body;

    if (!fullUrl) {
      return res.status(400).json({ error: 'Full URL is required' });
    }

    const shortUrl = await deepLinkService.generateShortUrl(
      fullUrl,
      expiresAt ? new Date(expiresAt) : undefined
    );

    res.json({
      success: true,
      data: shortUrl,
    });
  } catch (error) {
    console.error('Error generating short URL:', error);
    res.status(500).json({ error: 'Failed to generate short URL' });
  }
});

/**
 * GET /api/deep-links/short-url/:shortCode/redirect
 * Redirect to the full URL for a short code
 */
router.get('/short-url/:shortCode/redirect', async (req: Request, res: Response) => {
  try {
    const shortCode = routeParam(req.params.shortCode);

    const mapping = await deepLinkService.resolveShortUrl(shortCode);

    if (!mapping) {
      return res.status(404).json({ error: 'Short URL not found or expired' });
    }

    // Redirect to the full URL
    res.redirect(301, mapping.redirectUrl);
  } catch (error) {
    console.error('Error resolving short URL:', error);
    res.status(500).json({ error: 'Failed to resolve short URL' });
  }
});

/**
 * GET /api/deep-links/short-url/:shortCode
 * Get short URL info (without redirecting)
 */
router.get('/short-url/:shortCode', authenticateToken, async (req: Request, res: Response) => {
  try {
    const shortCode = routeParam(req.params.shortCode);

    const mapping = await deepLinkService.resolveShortUrl(shortCode);

    if (!mapping) {
      return res.status(404).json({ error: 'Short URL not found or expired' });
    }

    res.json({
      success: true,
      data: mapping,
    });
  } catch (error) {
    console.error('Error fetching short URL:', error);
    res.status(500).json({ error: 'Failed to fetch short URL' });
  }
});

// ============================================
// UNIVERSAL LINKS & APP LINKS
// ============================================

/**
 * GET /.well-known/apple-app-site-association
 * Apple Universal Links configuration
 */
router.get('/.well-known/apple-app-site-association', (req: Request, res: Response) => {
  const config = {
    applinks: {
      apps: [],
      details: [
        {
          appID: `${process.env.APPLE_TEAM_ID}.com.transcendlaw.app`,
          paths: ['*'],
        },
      ],
    },
    webcredentials: {
      apps: [`${process.env.APPLE_TEAM_ID}.com.transcendlaw.app`],
    },
  };

  res.json(config);
});

/**
 * GET /.well-known/assetlinks.json
 * Android App Links configuration
 */
router.get('/.well-known/assetlinks.json', (req: Request, res: Response) => {
  const config = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: process.env.ANDROID_PACKAGE_NAME || 'com.transcendlaw',
        sha256_cert_fingerprints: [
          process.env.ANDROID_SHA256_FINGERPRINT || '',
        ].filter(Boolean),
      },
    },
  ];

  res.json(config);
});

export default router;
