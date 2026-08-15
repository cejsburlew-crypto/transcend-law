// Help Center Routes
// API endpoints for help center article management, search, and analytics

import { Router, Request, Response } from 'express';
import { authMiddleware, adminAuthMiddleware } from '../middleware/auth';
import * as helpCenterService from '../services/helpCenterService';

const router = Router();

// ============================================
// ARTICLES ENDPOINTS
// ============================================

/**
 * GET /api/help/articles
 * Get all articles (with optional filters)
 */
router.get('/articles', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { category, userType, isFaq, limit, offset } = req.query;
    const currentUserType = req.user?.userType || 'client';

    const articles = await helpCenterService.getArticles({
      category: category as string,
      userType: userType as string || currentUserType,
      isFaq: isFaq === 'true',
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json(articles);
  } catch (error) {
    console.error('Failed to get articles:', error);
    res.status(500).json({ error: 'Failed to get articles' });
  }
});

/**
 * GET /api/help/articles/:id
 * Get single article by ID
 */
router.get('/articles/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const article = await helpCenterService.getArticle(req.params.id);

    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(article);
  } catch (error) {
    console.error('Failed to get article:', error);
    res.status(500).json({ error: 'Failed to get article' });
  }
});

/**
 * POST /api/help/articles
 * Create new article (admin only)
 */
router.post('/articles', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      title,
      category,
      tags,
      content,
      excerpt,
      userTypes,
      videoUrl,
      isFaq,
      order,
      relatedArticles,
    } = req.body;

    if (!title || !category || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const article = await helpCenterService.createArticle({
      title,
      category,
      tags: tags || [],
      content,
      excerpt: excerpt || content.substring(0, 150),
      userTypes: userTypes || ['client'],
      videoUrl,
      isFaq: isFaq || false,
      order: order || 0,
      relatedArticles: relatedArticles || [],
    });

    res.status(201).json(article);
  } catch (error) {
    console.error('Failed to create article:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

/**
 * PUT /api/help/articles/:id
 * Update article (admin only)
 */
router.put('/articles/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const article = await helpCenterService.updateArticle(req.params.id, req.body);
    res.json(article);
  } catch (error) {
    console.error('Failed to update article:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

/**
 * DELETE /api/help/articles/:id
 * Delete article (admin only)
 */
router.delete('/articles/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    await helpCenterService.deleteArticle(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

// ============================================
// CATEGORIES ENDPOINTS
// ============================================

/**
 * GET /api/help/categories
 * Get all categories
 */
router.get('/categories', authMiddleware, async (req: Request, res: Response) => {
  try {
    const categories = await helpCenterService.getCategories();
    res.json(categories);
  } catch (error) {
    console.error('Failed to get categories:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * POST /api/help/categories
 * Create category (admin only)
 */
router.post('/categories', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, slug, description, icon, order } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const category = await helpCenterService.createCategory({
      name,
      slug,
      description: description || '',
      icon: icon || '📚',
      order: order || 0,
    });

    res.status(201).json(category);
  } catch (error) {
    console.error('Failed to create category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

/**
 * PUT /api/help/categories/:id
 * Update category (admin only)
 */
router.put('/categories/:id', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const category = await helpCenterService.updateCategory(req.params.id, req.body);
    res.json(category);
  } catch (error) {
    console.error('Failed to update category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// ============================================
// SEARCH ENDPOINTS
// ============================================

/**
 * GET /api/help/search
 * Search articles
 */
router.get('/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { q, userType } = req.query;
    const currentUserType = req.user?.userType || 'client';

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query required' });
    }

    const results = await helpCenterService.searchArticles(
      q,
      userType as string || currentUserType
    );

    // Track search
    await helpCenterService.trackSearch({
      query: q,
      resultCount: results.length,
      userType: currentUserType,
      userEmail: req.user?.email,
    });

    res.json(results);
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================
// ARTICLE VIEWS & ANALYTICS
// ============================================

/**
 * POST /api/help/articles/:id/view
 * Track article view
 */
router.post('/articles/:id/view', authMiddleware, async (req: Request, res: Response) => {
  try {
    await helpCenterService.trackArticleView(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to track view:', error);
    res.status(500).json({ error: 'Failed to track view' });
  }
});

/**
 * GET /api/help/articles/:id/analytics
 * Get article analytics (admin only)
 */
router.get('/articles/:id/analytics', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const analytics = await helpCenterService.getArticleAnalytics(req.params.id);

    if (!analytics) {
      return res.status(404).json({ error: 'Article not found' });
    }

    res.json(analytics);
  } catch (error) {
    console.error('Failed to get analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ============================================
// FEEDBACK ENDPOINTS
// ============================================

/**
 * POST /api/help/articles/:id/feedback
 * Submit article feedback
 */
router.post('/articles/:id/feedback', async (req: Request, res: Response) => {
  try {
    const { helpful, comment, email, userType } = req.body;

    const feedback = await helpCenterService.submitFeedback({
      articleId: req.params.id,
      helpful: helpful === true || helpful === 'true',
      comment,
      email,
      userType,
    });

    res.status(201).json(feedback);
  } catch (error) {
    console.error('Failed to submit feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

/**
 * GET /api/help/articles/:id/feedback
 * Get article feedback (admin only)
 */
router.get('/articles/:id/feedback', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const feedback = await helpCenterService.getArticleFeedback(req.params.id);
    res.json(feedback);
  } catch (error) {
    console.error('Failed to get feedback:', error);
    res.status(500).json({ error: 'Failed to get feedback' });
  }
});

// ============================================
// ANALYTICS ENDPOINTS (ADMIN ONLY)
// ============================================

/**
 * POST /api/help/analytics/search
 * Track search query
 */
router.post('/analytics/search', async (req: Request, res: Response) => {
  try {
    const { query, userType, userEmail, clickedArticleId } = req.body;

    await helpCenterService.trackSearch({
      query,
      resultCount: 0,
      userType,
      userEmail,
      clickedArticleId,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to track search:', error);
    res.status(500).json({ error: 'Failed to track search' });
  }
});

/**
 * GET /api/help/analytics/searches
 * Get top searches (admin only)
 */
router.get('/analytics/searches', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const searches = await helpCenterService.getTopSearches(
      days ? parseInt(days as string) : 30
    );

    res.json(searches);
  } catch (error) {
    console.error('Failed to get search analytics:', error);
    res.status(500).json({ error: 'Failed to get search analytics' });
  }
});

/**
 * GET /api/help/analytics/feedback
 * Get feedback analytics (admin only)
 */
router.get('/analytics/feedback', adminAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const analytics = await helpCenterService.getFeedbackAnalytics(
      days ? parseInt(days as string) : 30
    );

    res.json(analytics);
  } catch (error) {
    console.error('Failed to get feedback analytics:', error);
    res.status(500).json({ error: 'Failed to get feedback analytics' });
  }
});

export default router;
