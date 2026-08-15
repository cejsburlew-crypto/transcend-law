/**
 * NPS Survey API Routes
 * Endpoints for NPS survey submission, tracking, and admin dashboard
 */

import type { Request, Response } from 'express';
import { npsService, NPSDashboardMetrics } from '../services/npsService';
import { logAction } from '../services/auditLogger';

/**
 * POST /api/nps/submit
 * Submit an NPS survey response
 */
export async function submitNPSSurvey(req: Request, res: Response) {
  try {
    const { userId, userType, score, followUpComment, tags } = req.body;

    // Validate input
    if (!userId || typeof score !== 'number' || score < 0 || score > 10) {
      return res.status(400).json({ error: 'Invalid survey data' });
    }

    const survey = await npsService.submitSurvey(
      userId,
      score,
      followUpComment,
      tags
    );

    res.json({
      id: survey.id,
      message: 'Survey submitted successfully',
      survey,
    });
  } catch (error) {
    console.error('Error submitting NPS survey:', error);
    res.status(500).json({ error: 'Failed to submit survey' });
  }
}

/**
 * GET /api/nps/check-eligibility
 * Check if user is eligible for a survey (not already responded this month)
 */
export async function checkSurveyEligibility(req: Request, res: Response) {
  try {
    const userId = req.user?.id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const history = await npsService.getUserSurveyHistory(userId as string, 1);

    // Check if survey was submitted this month
    const isEligible = history.length === 0 || !isCurrentMonth(history[0].createdAt);

    res.json({ isEligible, lastSurveyDate: history[0]?.createdAt });
  } catch (error) {
    console.error('Error checking survey eligibility:', error);
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
}

/**
 * GET /api/nps/survey/:id
 * Get a specific survey response
 */
export async function getNPSSurvey(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const survey = await npsService.getSurvey(id);

    if (!survey) {
      return res.status(404).json({ error: 'Survey not found' });
    }

    res.json(survey);
  } catch (error) {
    console.error('Error fetching survey:', error);
    res.status(500).json({ error: 'Failed to fetch survey' });
  }
}

/**
 * GET /api/nps/user/:userId/history
 * Get user's survey history
 */
export async function getUserSurveyHistory(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;

    const history = await npsService.getUserSurveyHistory(userId, limit);

    res.json({
      userId,
      count: history.length,
      surveys: history,
    });
  } catch (error) {
    console.error('Error fetching survey history:', error);
    res.status(500).json({ error: 'Failed to fetch survey history' });
  }
}

/**
 * GET /api/nps/trends/:period
 * Get NPS trends for a specific period
 * @param period - 'daily', 'weekly', or 'monthly'
 */
export async function getNPSTrends(req: Request, res: Response) {
  try {
    const { period } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;

    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ error: 'Invalid period' });
    }

    const trends = await npsService.getTrends(
      period as 'daily' | 'weekly' | 'monthly',
      limit
    );

    res.json({
      period,
      count: trends.length,
      trends,
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
}

/**
 * GET /api/nps/admin/dashboard
 * Get NPS dashboard metrics (admin only)
 */
export async function getNPSDashboard(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin) {
      await logAction(userId, 'access', 'nps_dashboard', userId, { denied: true });
      return res.status(403).json({ error: 'Admin access required' });
    }

    const metrics = await npsService.getDashboardMetrics(userId, isAdmin);

    await logAction(userId, 'view', 'nps_dashboard', userId);

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching NPS dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
}

/**
 * GET /api/nps/admin/action-items
 * Get NPS action items (admin only)
 */
export async function getNPSActionItems(req: Request, res: Response) {
  try {
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { trendId, status } = req.query;

    const actionItems = await npsService.getActionItems(
      trendId as string | undefined,
      status as string | undefined
    );

    res.json({
      count: actionItems.length,
      actionItems,
    });
  } catch (error) {
    console.error('Error fetching action items:', error);
    res.status(500).json({ error: 'Failed to fetch action items' });
  }
}

/**
 * PATCH /api/nps/admin/action-items/:id
 * Update action item status (admin only)
 */
export async function updateNPSActionItem(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    await npsService.updateActionItemStatus(id, status);

    await logAction(userId, 'update', 'nps_action_item', id, { status });

    res.json({
      message: 'Action item updated',
      id,
      status,
    });
  } catch (error) {
    console.error('Error updating action item:', error);
    res.status(500).json({ error: 'Failed to update action item' });
  }
}

/**
 * GET /api/nps/admin/export
 * Export NPS data (admin only)
 */
export async function exportNPSData(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { startDate, endDate, format = 'json' } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    // Get trends for the period
    const trends = await npsService.getTrends('daily', 365);
    const actionItems = await npsService.getActionItems();

    const exportData = {
      exportDate: new Date(),
      period: { start, end },
      trends,
      actionItems,
    };

    await logAction(userId, 'export', 'nps_data', userId, { format, period: { start, end } });

    if (format === 'csv') {
      const csv = convertToCSV(exportData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="nps-export.csv"');
      res.send(csv);
    } else {
      res.json(exportData);
    }
  } catch (error) {
    console.error('Error exporting NPS data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isCurrentMonth(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth()
  );
}

function convertToCSV(data: any): string {
  const lines: string[] = [];

  // Header
  lines.push('NPS Survey Export');
  lines.push(`Export Date: ${data.exportDate}`);
  lines.push(`Period: ${data.period.start} to ${data.period.end}`);
  lines.push('');

  // Trends
  lines.push('NPS Trends');
  lines.push('Period,Start Date,End Date,NPS Score,Promoters,Passives,Detractors,Total Responses,Average Score');

  for (const trend of data.trends) {
    lines.push(
      `"${trend.period}","${trend.startDate}","${trend.endDate}","${trend.npsScore}","${trend.promoterCount}","${trend.passiveCount}","${trend.detractorCount}","${trend.totalResponses}","${trend.averageScore}"`
    );
  }

  lines.push('');

  // Action Items
  lines.push('Action Items');
  lines.push('ID,Category,Priority,Description,Status,Created At,Resolved At');

  for (const item of data.actionItems) {
    lines.push(
      `"${item.id}","${item.category}","${item.priority}","${item.description}","${item.status}","${item.createdAt}","${item.resolvedAt || 'N/A'}"`
    );
  }

  return lines.join('\n');
}

// ============================================
// ROUTE REGISTRATION
// ============================================

export function registerNPSRoutes(app: any) {
  // Survey submission and retrieval
  app.post('/api/nps/submit', submitNPSSurvey);
  app.get('/api/nps/check-eligibility', checkSurveyEligibility);
  app.get('/api/nps/survey/:id', getNPSSurvey);
  app.get('/api/nps/user/:userId/history', getUserSurveyHistory);

  // Trend analysis
  app.get('/api/nps/trends/:period', getNPSTrends);

  // Admin dashboard
  app.get('/api/nps/admin/dashboard', getNPSDashboard);
  app.get('/api/nps/admin/action-items', getNPSActionItems);
  app.patch('/api/nps/admin/action-items/:id', updateNPSActionItem);
  app.get('/api/nps/admin/export', exportNPSData);
}
