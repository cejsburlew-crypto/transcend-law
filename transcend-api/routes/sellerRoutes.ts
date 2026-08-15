// Seller Routes - Metrics, Dashboard & Performance Endpoints
// Provides comprehensive seller performance tracking and optimization

import { Router, Request, Response } from 'express';
import * as sellerMetrics from '../services/sellerMetrics';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

// ============================================
// SELLER METRICS ROUTES
// ============================================

/**
 * GET /api/seller/dashboard/:providerId
 * Get complete dashboard data for a seller
 */
router.get(
  '/dashboard/:providerId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      // Verify seller access (seller viewing own data, or admin)
      if (req.user?.role !== 'admin' && req.user?.id !== providerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const dashboardData = await sellerMetrics.getSellerDashboardData(providerId);

      if (!dashboardData) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      res.json(dashboardData);
    } catch (error) {
      console.error('Error fetching seller dashboard:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
  }
);

/**
 * GET /api/seller/metrics/:providerId
 * Get current metrics for a seller
 */
router.get(
  '/metrics/:providerId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      // Verify seller access
      if (req.user?.role !== 'admin' && req.user?.id !== providerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const metrics = await sellerMetrics.getSellerMetrics(providerId);

      if (!metrics) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching seller metrics:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  }
);

/**
 * GET /api/seller/benchmarks/:providerId
 * Get benchmarking comparison for a seller
 */
router.get(
  '/benchmarks/:providerId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      // Get seller metrics first to get service type
      const metrics = await sellerMetrics.getSellerMetrics(providerId);
      if (!metrics) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      const benchmarks = await sellerMetrics.getBenchmarkComparison(
        providerId,
        metrics.serviceType
      );

      res.json({ benchmarks });
    } catch (error) {
      console.error('Error fetching benchmarks:', error);
      res.status(500).json({ error: 'Failed to fetch benchmarks' });
    }
  }
);

/**
 * GET /api/seller/alerts/:providerId
 * Get performance alerts for a seller
 */
router.get(
  '/alerts/:providerId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      // Verify seller access
      if (req.user?.role !== 'admin' && req.user?.id !== providerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const alerts = await sellerMetrics.getPerformanceAlerts(providerId);

      res.json({ alerts });
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  }
);

/**
 * POST /api/seller/alerts/:alertId/acknowledge
 * Acknowledge a performance alert
 */
router.post(
  '/alerts/:alertId/acknowledge',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const providerId = req.user?.id;

      if (!providerId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const success = await sellerMetrics.acknowledgeAlert(alertId, providerId);

      if (!success) {
        return res.status(404).json({ error: 'Alert not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  }
);

/**
 * GET /api/seller/trends/:providerId
 * Get historical trends for a seller
 */
router.get(
  '/trends/:providerId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      // Verify seller access
      if (req.user?.role !== 'admin' && req.user?.id !== providerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const trends = await sellerMetrics.getHistoricalTrends(providerId);

      res.json({ trends });
    } catch (error) {
      console.error('Error fetching trends:', error);
      res.status(500).json({ error: 'Failed to fetch trends' });
    }
  }
);

/**
 * GET /api/seller/suggestions/:providerId
 * Get improvement suggestions for a seller
 */
router.get(
  '/suggestions/:providerId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      // Verify seller access
      if (req.user?.role !== 'admin' && req.user?.id !== providerId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const metrics = await sellerMetrics.getSellerMetrics(providerId);
      if (!metrics) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      const suggestions = await sellerMetrics.generateImprovementSuggestions(
        providerId,
        metrics
      );

      res.json({ suggestions });
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      res.status(500).json({ error: 'Failed to fetch suggestions' });
    }
  }
);

/**
 * GET /api/seller/ranking/:providerId
 * Get category ranking for a seller
 */
router.get(
  '/ranking/:providerId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      const metrics = await sellerMetrics.getSellerMetrics(providerId);
      if (!metrics) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      const ranking = await sellerMetrics.getCategoryRanking(
        providerId,
        metrics.serviceType
      );

      res.json(ranking);
    } catch (error) {
      console.error('Error fetching ranking:', error);
      res.status(500).json({ error: 'Failed to fetch ranking' });
    }
  }
);

/**
 * GET /api/seller/top-performers
 * Get top performers by service type (admin only)
 */
router.get(
  '/top-performers',
  authenticateToken,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { serviceType, limit = '5' } = req.query;

      if (!serviceType || typeof serviceType !== 'string') {
        return res.status(400).json({ error: 'Service type required' });
      }

      const topPerformers = await sellerMetrics.getTopPerformers(
        serviceType,
        parseInt(limit as string)
      );

      res.json({ topPerformers });
    } catch (error) {
      console.error('Error fetching top performers:', error);
      res.status(500).json({ error: 'Failed to fetch top performers' });
    }
  }
);

/**
 * GET /api/seller/performance-score/:providerId
 * Get calculated performance score for a seller
 */
router.get(
  '/performance-score/:providerId',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;

      const metrics = await sellerMetrics.getSellerMetrics(providerId);
      if (!metrics) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      const performanceScore = sellerMetrics.calculatePerformanceScore(metrics);

      res.json({
        performanceScore,
        metrics: {
          rating: metrics.ratingScore,
          defectRate: metrics.defectRate,
          onTimeDeliveryRate: metrics.onTimeDeliveryRate,
          cancellationRate: metrics.cancellationRate,
          responseRate: metrics.responseRatePercent,
        },
      });
    } catch (error) {
      console.error('Error calculating performance score:', error);
      res.status(500).json({ error: 'Failed to calculate performance score' });
    }
  }
);

/**
 * GET /api/seller/category-stats
 * Get category statistics (admin only)
 */
router.get(
  '/category-stats',
  authenticateToken,
  requireRole(['admin']),
  async (req: Request, res: Response) => {
    try {
      const { serviceType } = req.query;

      if (!serviceType || typeof serviceType !== 'string') {
        return res.status(400).json({ error: 'Service type required' });
      }

      // Get top performers as category reference
      const topPerformers = await sellerMetrics.getTopPerformers(serviceType, 10);

      // Calculate category statistics
      const avgRating =
        topPerformers.reduce((sum, p) => sum + p.ratingScore, 0) /
        (topPerformers.length || 1);
      const avgDefectRate =
        topPerformers.reduce((sum, p) => sum + p.defectRate, 0) /
        (topPerformers.length || 1);
      const avgOnTimeRate =
        topPerformers.reduce((sum, p) => sum + p.onTimeDeliveryRate, 0) /
        (topPerformers.length || 1);
      const avgResponseRate =
        topPerformers.reduce((sum, p) => sum + p.responseRatePercent, 0) /
        (topPerformers.length || 1);

      res.json({
        serviceType,
        categoryStats: {
          averageRating: parseFloat(avgRating.toFixed(2)),
          averageDefectRate: parseFloat(avgDefectRate.toFixed(2)),
          averageOnTimeRate: parseFloat(avgOnTimeRate.toFixed(2)),
          averageResponseRate: parseFloat(avgResponseRate.toFixed(2)),
          topProviderCount: topPerformers.length,
        },
        topPerformers: topPerformers.slice(0, 5),
      });
    } catch (error) {
      console.error('Error fetching category stats:', error);
      res.status(500).json({ error: 'Failed to fetch category statistics' });
    }
  }
);

export default router;
