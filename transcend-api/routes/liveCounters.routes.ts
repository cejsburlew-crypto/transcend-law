/**
 * Live Counters API Routes
 * Endpoints for getting live user/provider counts
 */

import type { Request, Response } from 'express';
import { scrapingService } from '../services/continuousScrapingService';

/**
 * GET /api/platform/live-counts
 * Get current live counts
 */
export async function getLiveCounts(req: Request, res: Response) {
  try {
    const counts = scrapingService.getCounts();
    res.json(counts);
  } catch (error) {
    console.error('Error fetching live counts:', error);
    res.status(500).json({ error: 'Failed to fetch live counts' });
  }
}

/**
 * GET /api/platform/statistics
 * Get detailed scraping statistics
 */
export async function getStatistics(req: Request, res: Response) {
  try {
    const stats = scrapingService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
}

/**
 * POST /api/admin/scraping/start
 * Start continuous scraping (admin only)
 */
export async function startScraping(req: Request, res: Response) {
  try {
    // TODO: Check admin authorization
    const { intervalMinutes = 10 } = req.body;

    scrapingService.startContinuousScraping(intervalMinutes);

    res.json({
      message: 'Continuous scraping started',
      intervalMinutes,
      status: 'active',
    });
  } catch (error) {
    console.error('Error starting scraping:', error);
    res.status(500).json({ error: 'Failed to start scraping' });
  }
}

/**
 * POST /api/admin/scraping/stop
 * Stop continuous scraping (admin only)
 */
export async function stopScraping(req: Request, res: Response) {
  try {
    // TODO: Check admin authorization
    scrapingService.stopContinuousScraping();

    res.json({
      message: 'Continuous scraping stopped',
      status: 'stopped',
    });
  } catch (error) {
    console.error('Error stopping scraping:', error);
    res.status(500).json({ error: 'Failed to stop scraping' });
  }
}

/**
 * POST /api/admin/scraping/reset
 * Reset all counters (admin only)
 */
export async function resetCounters(req: Request, res: Response) {
  try {
    // TODO: Check admin authorization
    scrapingService.resetCounters();

    res.json({
      message: 'Counters reset',
      counts: scrapingService.getCounts(),
    });
  } catch (error) {
    console.error('Error resetting counters:', error);
    res.status(500).json({ error: 'Failed to reset counters' });
  }
}

/**
 * WebSocket handler for live count updates
 * Path: /ws/live-counts
 */
export function handleLiveCountsWebSocket(ws: any) {
  console.log('📡 WebSocket client connected for live counts');

  // Send initial counts
  ws.send(JSON.stringify(scrapingService.getCounts()));

  // Listen for counter updates
  const handleUpdate = (counts: any) => {
    try {
      ws.send(JSON.stringify(counts));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  };

  scrapingService.on('counters-updated', handleUpdate);

  // Handle client disconnect
  ws.on('close', () => {
    console.log('📡 WebSocket client disconnected');
    scrapingService.off('counters-updated', handleUpdate);
  });

  ws.on('error', (error: any) => {
    console.error('WebSocket error:', error);
  });
}

// Export routes for Express server
export const liveCountersRoutes = {
  'GET /api/platform/live-counts': getLiveCounts,
  'GET /api/platform/statistics': getStatistics,
  'POST /api/admin/scraping/start': startScraping,
  'POST /api/admin/scraping/stop': stopScraping,
  'POST /api/admin/scraping/reset': resetCounters,
};
