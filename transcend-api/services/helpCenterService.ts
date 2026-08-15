// Help Center / Knowledge Base Service
// Features: Searchable documentation, categories, FAQs, video tutorials, admin editing, analytics, feedback

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  content: string;
  excerpt: string;
  userTypes: string[];
  videoUrl?: string;
  relatedArticles: string[];
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  isFaq: boolean;
  order: number;
}

export interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  articleCount: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  relevance: number;
  isFaq: boolean;
}

export interface ArticleFeedback {
  id: string;
  articleId: string;
  helpful: boolean;
  comment?: string;
  email?: string;
  userType?: string;
  timestamp: Date;
}

export interface SearchAnalytics {
  id: string;
  query: string;
  resultCount: number;
  userType: string;
  userEmail?: string;
  timestamp: Date;
  clickedArticleId?: string;
}

export interface ArticleAnalytics {
  id: string;
  articleId: string;
  viewCount: number;
  uniqueViewers: number;
  avgTimeOnPage: number;
  helpfulCount: number;
  unhelpfulCount: number;
  feedbackComments: number;
  lastUpdated: Date;
}

// ============================================
// ARTICLE MANAGEMENT
// ============================================

/**
 * Create a new help article
 */
export async function createArticle(
  article: Omit<HelpArticle, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>
): Promise<HelpArticle> {
  const id = uuidv4();
  const now = new Date();
  const slug = generateSlug(article.title);

  const q = `
    INSERT INTO help_articles
    (id, title, slug, category, tags, content, excerpt, user_types, video_url,
     related_articles, view_count, created_at, updated_at, is_faq, "order")
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `;

  const result = await query(q, [
    id,
    article.title,
    slug,
    article.category,
    JSON.stringify(article.tags),
    article.content,
    article.excerpt,
    JSON.stringify(article.userTypes),
    article.videoUrl || null,
    JSON.stringify(article.relatedArticles),
    0,
    now,
    now,
    article.isFaq,
    article.order,
  ]);

  if (result.rows.length === 0) {
    throw new Error('Failed to create article');
  }

  await logAction('HELP_ARTICLE_CREATED', { articleId: id, title: article.title });

  return parseArticleRow(result.rows[0]);
}

/**
 * Get article by ID
 */
export async function getArticle(articleId: string): Promise<HelpArticle | null> {
  const q = `
    SELECT * FROM help_articles
    WHERE id = $1
  `;

  const result = await query(q, [articleId]);

  if (result.rows.length === 0) {
    return null;
  }

  return parseArticleRow(result.rows[0]);
}

/**
 * Get all articles (with optional filters)
 */
export async function getArticles(filters?: {
  category?: string;
  userType?: string;
  isFaq?: boolean;
  limit?: number;
  offset?: number;
}): Promise<HelpArticle[]> {
  let q = 'SELECT * FROM help_articles WHERE 1=1';
  const params: any[] = [];
  let paramCount = 1;

  if (filters?.category) {
    q += ` AND category = $${paramCount}`;
    params.push(filters.category);
    paramCount++;
  }

  if (filters?.isFaq !== undefined) {
    q += ` AND is_faq = $${paramCount}`;
    params.push(filters.isFaq);
    paramCount++;
  }

  if (filters?.userType) {
    q += ` AND user_types @> $${paramCount}`;
    params.push(JSON.stringify([filters.userType]));
    paramCount++;
  }

  q += ' ORDER BY "order" ASC, created_at DESC';

  if (filters?.limit) {
    q += ` LIMIT $${paramCount}`;
    params.push(filters.limit);
    paramCount++;

    if (filters?.offset) {
      q += ` OFFSET $${paramCount}`;
      params.push(filters.offset);
    }
  }

  const result = await query(q, params);

  return result.rows.map((row) => parseArticleRow(row));
}

/**
 * Update article
 */
export async function updateArticle(
  articleId: string,
  updates: Partial<Omit<HelpArticle, 'id' | 'createdAt'>>
): Promise<HelpArticle> {
  const allowed = [
    'title',
    'category',
    'tags',
    'content',
    'excerpt',
    'userTypes',
    'videoUrl',
    'relatedArticles',
    'isFaq',
    'order',
  ];

  const setClauses: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;

    const dbKey = key === 'videoUrl' ? 'video_url' :
                  key === 'userTypes' ? 'user_types' :
                  key === 'relatedArticles' ? 'related_articles' :
                  key === 'isFaq' ? 'is_faq' : key;

    if (Array.isArray(value) || typeof value === 'object') {
      params.push(JSON.stringify(value));
    } else {
      params.push(value);
    }

    setClauses.push(`${dbKey} = $${paramCount}`);
    paramCount++;
  }

  params.push(new Date());
  setClauses.push(`updated_at = $${paramCount}`);

  params.push(articleId);

  const q = `
    UPDATE help_articles
    SET ${setClauses.join(', ')}
    WHERE id = $${paramCount + 1}
    RETURNING *
  `;

  const result = await query(q, params);

  if (result.rows.length === 0) {
    throw new Error('Article not found');
  }

  await logAction('HELP_ARTICLE_UPDATED', { articleId });

  return parseArticleRow(result.rows[0]);
}

/**
 * Delete article
 */
export async function deleteArticle(articleId: string): Promise<void> {
  const q = 'DELETE FROM help_articles WHERE id = $1';

  await query(q, [articleId]);
  await logAction('HELP_ARTICLE_DELETED', { articleId });
}

// ============================================
// CATEGORY MANAGEMENT
// ============================================

/**
 * Create help category
 */
export async function createCategory(
  category: Omit<HelpCategory, 'id' | 'createdAt' | 'updatedAt' | 'articleCount'>
): Promise<HelpCategory> {
  const id = uuidv4();
  const now = new Date();

  const q = `
    INSERT INTO help_categories
    (id, name, slug, description, icon, article_count, "order", created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const result = await query(q, [
    id,
    category.name,
    category.slug,
    category.description,
    category.icon,
    0,
    category.order,
    now,
    now,
  ]);

  if (result.rows.length === 0) {
    throw new Error('Failed to create category');
  }

  return parseCategoryRow(result.rows[0]);
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<HelpCategory[]> {
  const q = `
    SELECT hc.*, COUNT(ha.id) as article_count
    FROM help_categories hc
    LEFT JOIN help_articles ha ON ha.category = hc.slug
    GROUP BY hc.id
    ORDER BY hc."order" ASC
  `;

  const result = await query(q, []);

  return result.rows.map((row) => parseCategoryRow(row));
}

/**
 * Update category
 */
export async function updateCategory(
  categoryId: string,
  updates: Partial<Omit<HelpCategory, 'id' | 'createdAt' | 'articleCount'>>
): Promise<HelpCategory> {
  const allowed = ['name', 'slug', 'description', 'icon', 'order'];

  const setClauses: string[] = [];
  const params: any[] = [];
  let paramCount = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (!allowed.includes(key)) continue;
    params.push(value);
    setClauses.push(`${key} = $${paramCount}`);
    paramCount++;
  }

  params.push(new Date());
  setClauses.push(`updated_at = $${paramCount}`);

  params.push(categoryId);

  const q = `
    UPDATE help_categories
    SET ${setClauses.join(', ')}
    WHERE id = $${paramCount + 1}
    RETURNING *
  `;

  const result = await query(q, params);

  if (result.rows.length === 0) {
    throw new Error('Category not found');
  }

  return parseCategoryRow(result.rows[0]);
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

/**
 * Full-text search across articles
 */
export async function searchArticles(
  searchQuery: string,
  userType?: string
): Promise<SearchResult[]> {
  let q = `
    SELECT
      id, title, excerpt, category, is_faq,
      ts_rank(
        to_tsvector('english', title || ' ' || content),
        plainto_tsquery('english', $1)
      ) as relevance
    FROM help_articles
    WHERE
      to_tsvector('english', title || ' ' || content) @@
      plainto_tsquery('english', $1)
  `;

  const params: any[] = [searchQuery];

  if (userType) {
    q += ` AND user_types @> $2`;
    params.push(JSON.stringify([userType]));
  }

  q += ` ORDER BY relevance DESC LIMIT 20`;

  const result = await query(q, params);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    relevance: parseFloat(row.relevance) || 0,
    isFaq: row.is_faq,
  }));
}

/**
 * Track search query
 */
export async function trackSearch(analytics: {
  query: string;
  resultCount: number;
  userType: string;
  userEmail?: string;
  clickedArticleId?: string;
}): Promise<void> {
  const q = `
    INSERT INTO search_analytics
    (id, query, result_count, user_type, user_email, clicked_article_id, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `;

  await query(q, [
    uuidv4(),
    analytics.query,
    analytics.resultCount,
    analytics.userType,
    analytics.userEmail || null,
    analytics.clickedArticleId || null,
    new Date(),
  ]);
}

/**
 * Get top search queries (admin analytics)
 */
export async function getTopSearches(days: number = 30): Promise<any[]> {
  const q = `
    SELECT
      query,
      COUNT(*) as search_count,
      COUNT(DISTINCT user_email) as unique_users,
      COUNT(clicked_article_id) as click_through_count,
      ROUND(100.0 * COUNT(clicked_article_id) / COUNT(*), 2) as ctr
    FROM search_analytics
    WHERE timestamp > NOW() - INTERVAL '${days} days'
    GROUP BY query
    ORDER BY search_count DESC
    LIMIT 50
  `;

  const result = await query(q, []);
  return result.rows;
}

// ============================================
// ARTICLE VIEWS & ANALYTICS
// ============================================

/**
 * Track article view
 */
export async function trackArticleView(articleId: string): Promise<void> {
  const q = `
    UPDATE help_articles
    SET view_count = view_count + 1
    WHERE id = $1
  `;

  await query(q, [articleId]);
}

/**
 * Get article analytics
 */
export async function getArticleAnalytics(articleId: string): Promise<ArticleAnalytics | null> {
  const q = `
    SELECT
      ha.id as article_id,
      ha.view_count,
      COUNT(DISTINCT af.email) as unique_viewers,
      AVG(EXTRACT(EPOCH FROM (af.timestamp - af.created_at)))::int as avg_time_on_page,
      SUM(CASE WHEN af.helpful = true THEN 1 ELSE 0 END) as helpful_count,
      SUM(CASE WHEN af.helpful = false THEN 1 ELSE 0 END) as unhelpful_count,
      COUNT(af.comment) as feedback_comments,
      NOW() as last_updated
    FROM help_articles ha
    LEFT JOIN article_feedback af ON af.article_id = ha.id
    WHERE ha.id = $1
    GROUP BY ha.id, ha.view_count
  `;

  const result = await query(q, [articleId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: uuidv4(),
    articleId: row.article_id,
    viewCount: parseInt(row.view_count),
    uniqueViewers: parseInt(row.unique_viewers) || 0,
    avgTimeOnPage: parseInt(row.avg_time_on_page) || 0,
    helpfulCount: parseInt(row.helpful_count) || 0,
    unhelpfulCount: parseInt(row.unhelpful_count) || 0,
    feedbackComments: parseInt(row.feedback_comments) || 0,
    lastUpdated: new Date(row.last_updated),
  };
}

// ============================================
// FEEDBACK MANAGEMENT
// ============================================

/**
 * Submit article feedback
 */
export async function submitFeedback(feedback: Omit<ArticleFeedback, 'id' | 'timestamp'>): Promise<ArticleFeedback> {
  const q = `
    INSERT INTO article_feedback
    (id, article_id, helpful, comment, email, user_type, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const result = await query(q, [
    uuidv4(),
    feedback.articleId,
    feedback.helpful,
    feedback.comment || null,
    feedback.email || null,
    feedback.userType || null,
    new Date(),
  ]);

  if (result.rows.length === 0) {
    throw new Error('Failed to submit feedback');
  }

  return parseFeedbackRow(result.rows[0]);
}

/**
 * Get article feedback
 */
export async function getArticleFeedback(articleId: string): Promise<ArticleFeedback[]> {
  const q = `
    SELECT * FROM article_feedback
    WHERE article_id = $1
    ORDER BY timestamp DESC
  `;

  const result = await query(q, [articleId]);

  return result.rows.map((row) => parseFeedbackRow(row));
}

/**
 * Get feedback analytics
 */
export async function getFeedbackAnalytics(days: number = 30): Promise<any> {
  const q = `
    SELECT
      COUNT(*) as total_feedback,
      SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END) as helpful_count,
      SUM(CASE WHEN helpful = false THEN 1 ELSE 0 END) as unhelpful_count,
      ROUND(100.0 * SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END) / COUNT(*), 2) as helpful_percentage,
      COUNT(DISTINCT article_id) as articles_with_feedback,
      COUNT(comment) as comments_count
    FROM article_feedback
    WHERE timestamp > NOW() - INTERVAL '${days} days'
  `;

  const result = await query(q, []);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    totalFeedback: parseInt(row.total_feedback),
    helpfulCount: parseInt(row.helpful_count) || 0,
    unhelpfulCount: parseInt(row.unhelpful_count) || 0,
    helpfulPercentage: parseFloat(row.helpful_percentage) || 0,
    articlesWithFeedback: parseInt(row.articles_with_feedback) || 0,
    commentsCount: parseInt(row.comments_count) || 0,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse article database row
 */
function parseArticleRow(row: any): HelpArticle {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || '[]'),
    content: row.content,
    excerpt: row.excerpt,
    userTypes: Array.isArray(row.user_types) ? row.user_types : JSON.parse(row.user_types || '[]'),
    videoUrl: row.video_url,
    relatedArticles: Array.isArray(row.related_articles) ? row.related_articles : JSON.parse(row.related_articles || '[]'),
    viewCount: parseInt(row.view_count),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    isFaq: row.is_faq,
    order: row.order || 0,
  };
}

/**
 * Parse category database row
 */
function parseCategoryRow(row: any): HelpCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    articleCount: parseInt(row.article_count) || 0,
    order: row.order || 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Parse feedback database row
 */
function parseFeedbackRow(row: any): ArticleFeedback {
  return {
    id: row.id,
    articleId: row.article_id,
    helpful: row.helpful,
    comment: row.comment,
    email: row.email,
    userType: row.user_type,
    timestamp: new Date(row.timestamp),
  };
}
