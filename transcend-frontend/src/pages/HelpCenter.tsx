// Help Center / Knowledge Base
// Searchable documentation, FAQs, video tutorials, admin editing, feedback system

import React, { useState, useEffect, useCallback } from 'react';
import { PrimaryButton, SecondaryButton, Toast } from '@/components/UI';
import './HelpCenter.css';

// ============================================
// TYPES & INTERFACES
// ============================================

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  content: string;
  excerpt: string;
  userTypes: string[]; // 'client', 'provider', 'admin', 'notary'
  videoUrl?: string;
  relatedArticles: string[];
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  isFaq: boolean;
  order?: number;
}

interface HelpCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  articleCount: number;
  order: number;
}

interface SearchResult {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  relevance: number;
  isFaq: boolean;
}

interface ArticleFeedback {
  id: string;
  articleId: string;
  helpful: boolean;
  comment?: string;
  email?: string;
  timestamp: string;
}

interface AdminArticleForm {
  title: string;
  category: string;
  tags: string[];
  content: string;
  excerpt: string;
  userTypes: string[];
  videoUrl: string;
  isFaq: boolean;
  order: number;
}

type ViewMode = 'search' | 'categories' | 'faqs' | 'videos' | 'article' | 'admin';

// ============================================
// MAIN COMPONENT
// ============================================

export const HelpCenter: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [currentArticle, setCurrentArticle] = useState<HelpArticle | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedUserType, setSelectedUserType] = useState<string>('all');
  const [filteredFaqs, setFilteredFaqs] = useState<HelpArticle[]>([]);
  const [videos, setVideos] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | null>(null);
  const [formData, setFormData] = useState<AdminArticleForm>({
    title: '',
    category: '',
    tags: [],
    content: '',
    excerpt: '',
    userTypes: [],
    videoUrl: '',
    isFaq: false,
    order: 0,
  });
  const [tagInput, setTagInput] = useState('');

  const userType = localStorage.getItem('userType') || 'client';
  const userEmail = localStorage.getItem('userEmail');

  // ============================================
  // INITIALIZATION & DATA LOADING
  // ============================================

  useEffect(() => {
    const adminStatus = localStorage.getItem('isAdmin') === 'true';
    setIsAdmin(adminStatus);
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [articlesRes, categoriesRes] = await Promise.all([
        fetch('/api/help/articles'),
        fetch('/api/help/categories'),
      ]);

      if (articlesRes.ok && categoriesRes.ok) {
        const articlesData = await articlesRes.json();
        const categoriesData = await categoriesRes.json();

        setArticles(articlesData);
        setCategories(categoriesData);

        // Filter FAQs and videos
        const faqArticles = articlesData.filter((a: HelpArticle) => a.isFaq);
        const videoArticles = articlesData.filter((a: HelpArticle) => a.videoUrl);

        setFilteredFaqs(faqArticles);
        setVideos(videoArticles);
      }
    } catch (error) {
      showToast('error', 'Failed to load help center content');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SEARCH FUNCTIONALITY
  // ============================================

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/help/search?q=${encodeURIComponent(query)}&userType=${userType}`
      );

      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
        setViewMode('search');

        // Track search analytics
        trackSearch(query);
      }
    } catch (error) {
      showToast('error', 'Search failed');
    }
  }, [userType]);

  const trackSearch = async (query: string) => {
    try {
      await fetch('/api/help/analytics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          userType,
          userEmail,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to track search:', error);
    }
  };

  // ============================================
  // ARTICLE VIEWING
  // ============================================

  const handleViewArticle = async (article: HelpArticle) => {
    setCurrentArticle(article);
    setViewMode('article');

    // Track view
    try {
      await fetch(`/api/help/articles/${article.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userType,
          userEmail,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to track view:', error);
    }
  };

  const handleSubmitFeedback = async (helpful: boolean, comment?: string) => {
    if (!currentArticle) return;

    try {
      const response = await fetch(`/api/help/articles/${currentArticle.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          helpful,
          comment,
          email: userEmail,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        showToast('success', 'Thank you for your feedback!');
      }
    } catch (error) {
      showToast('error', 'Failed to submit feedback');
    }
  };

  // ============================================
  // ADMIN FUNCTIONS
  // ============================================

  const handleEditArticle = (article: HelpArticle) => {
    setEditingArticle(article);
    setFormData({
      title: article.title,
      category: article.category,
      tags: article.tags,
      content: article.content,
      excerpt: article.excerpt,
      userTypes: article.userTypes,
      videoUrl: article.videoUrl || '',
      isFaq: article.isFaq,
      order: article.order || 0,
    });
    setViewMode('admin');
  };

  const handleNewArticle = () => {
    setEditingArticle(null);
    setFormData({
      title: '',
      category: '',
      tags: [],
      content: '',
      excerpt: '',
      userTypes: [],
      videoUrl: '',
      isFaq: false,
      order: 0,
    });
    setViewMode('admin');
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((t) => t !== tag),
    });
  };

  const handleToggleUserType = (type: string) => {
    setFormData({
      ...formData,
      userTypes: formData.userTypes.includes(type)
        ? formData.userTypes.filter((t) => t !== type)
        : [...formData.userTypes, type],
    });
  };

  const handleSaveArticle = async () => {
    if (!formData.title || !formData.category || !formData.content) {
      showToast('error', 'Please fill in all required fields');
      return;
    }

    try {
      const method = editingArticle ? 'PUT' : 'POST';
      const url = editingArticle
        ? `/api/help/articles/${editingArticle.id}`
        : '/api/help/articles';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        showToast('success', editingArticle ? 'Article updated' : 'Article created');
        await loadData();
        setViewMode('categories');
      } else {
        showToast('error', 'Failed to save article');
      }
    } catch (error) {
      showToast('error', 'Error saving article');
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      const response = await fetch(`/api/help/articles/${articleId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showToast('success', 'Article deleted');
        await loadData();
        setViewMode('categories');
      }
    } catch (error) {
      showToast('error', 'Failed to delete article');
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ type, message, duration: 3000, onClose: () => setToast(null) });
  };

  const filterArticlesByCategory = (categorySlug: string) => {
    return articles.filter(
      (a) =>
        a.category === categorySlug &&
        (selectedUserType === 'all' || a.userTypes.includes(selectedUserType))
    );
  };

  // ============================================
  // RENDER: SEARCH VIEW
  // ============================================

  const renderSearchView = () => (
    <div className="help-search-view">
      <div className="help-search-results-header">
        <h2>Search Results</h2>
        <p className="search-query-display">
          {searchResults.length > 0
            ? `${searchResults.length} result(s) for "${searchQuery}"`
            : `No results found for "${searchQuery}"`}
        </p>
      </div>

      <div className="help-search-results-list">
        {searchResults.map((result) => (
          <div
            key={result.id}
            className="help-search-result-item"
            onClick={() => {
              const article = articles.find((a) => a.id === result.id);
              if (article) handleViewArticle(article);
            }}
          >
            <div className="result-header">
              <h3>{result.title}</h3>
              {result.isFaq && <span className="faq-badge">FAQ</span>}
            </div>
            <p className="result-excerpt">{result.excerpt}</p>
            <div className="result-meta">
              <span className="result-category">{result.category}</span>
              <span className="result-relevance">
                {Math.round(result.relevance * 100)}% match
              </span>
            </div>
          </div>
        ))}
      </div>

      {searchResults.length === 0 && (
        <div className="help-empty-state">
          <p>Try different keywords or browse by category</p>
          <SecondaryButton onClick={() => setViewMode('categories')}>
            Browse Categories
          </SecondaryButton>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: CATEGORIES VIEW
  // ============================================

  const renderCategoriesView = () => (
    <div className="help-categories-view">
      <div className="help-categories-grid">
        {categories.map((category) => (
          <div
            key={category.id}
            className="help-category-card"
            onClick={() => {
              setSelectedCategory(category.slug);
              setViewMode('categories');
            }}
          >
            <div className="category-icon">{category.icon}</div>
            <h3>{category.name}</h3>
            <p>{category.description}</p>
            <span className="article-count">{category.articleCount} articles</span>
          </div>
        ))}
      </div>

      {selectedCategory && (
        <div className="help-category-articles">
          <div className="category-articles-header">
            <h2>{categories.find((c) => c.slug === selectedCategory)?.name}</h2>
            <button
              className="close-button"
              onClick={() => setSelectedCategory(null)}
            >
              ✕
            </button>
          </div>

          <div className="category-articles-list">
            {filterArticlesByCategory(selectedCategory).map((article) => (
              <div
                key={article.id}
                className="help-article-preview"
                onClick={() => handleViewArticle(article)}
              >
                <h4>{article.title}</h4>
                <p>{article.excerpt}</p>
                <div className="article-tags">
                  {article.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: FAQs VIEW
  // ============================================

  const renderFaqsView = () => (
    <div className="help-faqs-view">
      <div className="help-faqs-header">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-filter">
          <label>Filter by user type:</label>
          <select
            value={selectedUserType}
            onChange={(e) => setSelectedUserType(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="client">Client</option>
            <option value="provider">Service Provider</option>
            <option value="notary">Notary</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="help-faq-list">
        {filteredFaqs
          .filter(
            (faq) =>
              selectedUserType === 'all' || faq.userTypes.includes(selectedUserType)
          )
          .map((faq) => (
            <div key={faq.id} className="help-faq-item">
              <button
                className="faq-question"
                onClick={() => handleViewArticle(faq)}
              >
                <span className="faq-icon">Q:</span>
                <span>{faq.title}</span>
                <span className="faq-arrow">›</span>
              </button>
            </div>
          ))}
      </div>

      {filteredFaqs.filter(
        (faq) => selectedUserType === 'all' || faq.userTypes.includes(selectedUserType)
      ).length === 0 && (
        <div className="help-empty-state">
          <p>No FAQs available for this user type</p>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: VIDEOS VIEW
  // ============================================

  const renderVideosView = () => (
    <div className="help-videos-view">
      <h2>Video Tutorials</h2>
      <div className="help-videos-grid">
        {videos.map((video) => (
          <div
            key={video.id}
            className="help-video-card"
            onClick={() => handleViewArticle(video)}
          >
            <div className="video-thumbnail">
              {video.videoUrl && (
                <img
                  src={`${video.videoUrl.replace(/\?.*$/, '')}?sddefault=1`}
                  alt={video.title}
                  loading="lazy"
                />
              )}
              <div className="video-play-icon">▶</div>
            </div>
            <h4>{video.title}</h4>
            <p>{video.excerpt}</p>
          </div>
        ))}
      </div>

      {videos.length === 0 && (
        <div className="help-empty-state">
          <p>No video tutorials available yet</p>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: ARTICLE VIEW
  // ============================================

  const renderArticleView = () => {
    if (!currentArticle) return null;

    return (
      <div className="help-article-view">
        <button className="back-button" onClick={() => setViewMode('categories')}>
          ← Back
        </button>

        <article className="help-article-content">
          <div className="article-header">
            <h1>{currentArticle.title}</h1>
            <div className="article-meta">
              <span className="category-label">{currentArticle.category}</span>
              {currentArticle.isFaq && <span className="faq-badge">FAQ</span>}
              <span className="view-count">{currentArticle.viewCount} views</span>
            </div>
          </div>

          {currentArticle.videoUrl && (
            <div className="article-video">
              <iframe
                src={currentArticle.videoUrl.replace('watch?v=', 'embed/')}
                title={currentArticle.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          <div className="article-body">
            {currentArticle.content.split('\n\n').map((paragraph, idx) => (
              <p key={idx}>{paragraph}</p>
            ))}
          </div>

          {currentArticle.tags.length > 0 && (
            <div className="article-tags">
              {currentArticle.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>

        {currentArticle.relatedArticles.length > 0 && (
          <div className="related-articles">
            <h3>Related Articles</h3>
            <div className="related-articles-list">
              {currentArticle.relatedArticles.map((relatedId) => {
                const relatedArticle = articles.find((a) => a.id === relatedId);
                if (!relatedArticle) return null;

                return (
                  <button
                    key={relatedId}
                    className="related-article-link"
                    onClick={() => handleViewArticle(relatedArticle)}
                  >
                    {relatedArticle.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="article-feedback">
          <p>Was this article helpful?</p>
          <div className="feedback-buttons">
            <button
              className="feedback-btn yes"
              onClick={() => handleSubmitFeedback(true)}
            >
              👍 Yes
            </button>
            <button
              className="feedback-btn no"
              onClick={() => handleSubmitFeedback(false)}
            >
              👎 No
            </button>
          </div>
          <textarea
            className="feedback-comment"
            placeholder="Any additional feedback?"
            onBlur={(e) => {
              if (e.target.value.trim()) {
                handleSubmitFeedback(false, e.target.value);
              }
            }}
          />
        </div>

        {isAdmin && (
          <div className="admin-actions">
            <SecondaryButton onClick={() => handleEditArticle(currentArticle)}>
              Edit Article
            </SecondaryButton>
            <SecondaryButton onClick={() => handleDeleteArticle(currentArticle.id)}>
              Delete Article
            </SecondaryButton>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER: ADMIN VIEW
  // ============================================

  const renderAdminView = () => (
    <div className="help-admin-view">
      <div className="admin-header">
        <h2>{editingArticle ? 'Edit Article' : 'Create New Article'}</h2>
        <button className="close-button" onClick={() => setViewMode('categories')}>
          ✕
        </button>
      </div>

      <form className="admin-article-form">
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Article title"
          />
        </div>

        <div className="form-group">
          <label>Category *</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="">Select category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Excerpt (Short description)</label>
          <textarea
            value={formData.excerpt}
            onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
            placeholder="Brief summary for search results"
            rows={2}
          />
        </div>

        <div className="form-group">
          <label>Content *</label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Article content (use paragraphs separated by blank lines)"
            rows={10}
          />
        </div>

        <div className="form-group">
          <label>Video URL (YouTube)</label>
          <input
            type="url"
            value={formData.videoUrl}
            onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>

        <div className="form-group">
          <label>Tags</label>
          <div className="tag-input-group">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="Type tag and press Enter"
            />
            <button type="button" onClick={handleAddTag}>
              Add
            </button>
          </div>
          <div className="tags-display">
            {formData.tags.map((tag) => (
              <span key={tag} className="tag-item">
                {tag}
                <button type="button" onClick={() => handleRemoveTag(tag)}>
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Visible to User Types</label>
          <div className="checkbox-group">
            {['client', 'provider', 'notary', 'admin'].map((type) => (
              <label key={type} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.userTypes.includes(type)}
                  onChange={() => handleToggleUserType(type)}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={formData.isFaq}
              onChange={(e) => setFormData({ ...formData, isFaq: e.target.checked })}
            />
            Mark as FAQ
          </label>
        </div>

        <div className="form-group">
          <label>Display Order</label>
          <input
            type="number"
            value={formData.order}
            onChange={(e) =>
              setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
            }
          />
        </div>

        <div className="admin-form-actions">
          <PrimaryButton onClick={handleSaveArticle}>
            {editingArticle ? 'Update Article' : 'Create Article'}
          </PrimaryButton>
          <SecondaryButton onClick={() => setViewMode('categories')}>
            Cancel
          </SecondaryButton>
        </div>
      </form>
    </div>
  );

  // ============================================
  // RENDER: MAIN LAYOUT
  // ============================================

  return (
    <div className="help-center-container">
      {/* Header & Navigation */}
      <div className="help-center-header">
        <h1>Help Center</h1>
        <div className="help-search-bar">
          <input
            type="text"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="help-nav-tabs">
        <button
          className={`nav-tab ${viewMode === 'categories' ? 'active' : ''}`}
          onClick={() => setViewMode('categories')}
        >
          Categories
        </button>
        <button
          className={`nav-tab ${viewMode === 'faqs' ? 'active' : ''}`}
          onClick={() => setViewMode('faqs')}
        >
          FAQs
        </button>
        <button
          className={`nav-tab ${viewMode === 'videos' ? 'active' : ''}`}
          onClick={() => setViewMode('videos')}
        >
          Videos
        </button>
        {isAdmin && (
          <button
            className={`nav-tab admin-tab ${viewMode === 'admin' ? 'active' : ''}`}
            onClick={handleNewArticle}
          >
            ➕ New Article
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="help-center-content">
        {loading && <div className="help-loading">Loading...</div>}

        {!loading && viewMode === 'search' && renderSearchView()}
        {!loading && viewMode === 'categories' && renderCategoriesView()}
        {!loading && viewMode === 'faqs' && renderFaqsView()}
        {!loading && viewMode === 'videos' && renderVideosView()}
        {!loading && viewMode === 'article' && renderArticleView()}
        {!loading && viewMode === 'admin' && isAdmin && renderAdminView()}
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          duration={toast.duration}
          onClose={toast.onClose}
        />
      )}
    </div>
  );
};

export default HelpCenter;
