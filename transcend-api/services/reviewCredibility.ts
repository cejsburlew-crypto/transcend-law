// Review Credibility Scoring Service
// Detects fake reviews, analyzes credibility patterns, and maintains reputation integrity
// Integrates AI-generated text detection, timing analysis, and statistical anomalies

import { query } from '../database/connection';
import { sendEmailNotification } from './emailService';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface Review {
  id: string;
  providerId: string;
  userId: string;
  rating: number;
  title: string;
  content: string;
  serviceType: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'approved' | 'pending' | 'flagged' | 'rejected' | 'archived';
  isVerifiedUser: boolean;
  userPurchaseHistory: number;
  caseRelated: boolean;
  caseId?: string;
}

export interface ReviewCredibilityScore {
  reviewId: string;
  providerId: string;
  overallScore: number; // 0-100
  scoreComponents: {
    verifiedUserScore: number; // 0-100
    timingScore: number; // 0-100
    textAnalysisScore: number; // 0-100
    ratingClusteringScore: number; // 0-100
    userHistoryScore: number; // 0-100
    contentConsistencyScore: number; // 0-100
  };
  flags: CredibilityFlag[];
  isLikelyFake: boolean;
  recommendedAction: 'approve' | 'flag' | 'reject' | 'manual_review';
  aiTextProbability: number; // 0-100: likelihood of AI generation
  createdAt: Date;
  analyzedAt: Date;
}

export interface CredibilityFlag {
  id: string;
  type: 'ai_generated' | 'timing_anomaly' | 'rating_clustering' | 'duplicate_pattern' |
         'suspicious_keywords' | 'language_mismatch' | 'extreme_sentiment' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number; // 0-100
  evidence?: string;
}

export interface ProviderReputation {
  providerId: string;
  averageRating: number;
  totalReviews: number;
  verifiedReviews: number;
  credibilityScore: number; // 0-100 (weighted average of all review scores)
  suspiciousReviews: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trustScore: number; // 0-100
  lastUpdated: Date;
  trend: 'improving' | 'stable' | 'declining' | 'volatile';
}

export interface AdminReviewQueue {
  id: string;
  reviewId: string;
  providerId: string;
  reviewerId: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'resolved';
  createdAt: Date;
  reviewedAt?: Date;
  resolution?: string;
  actionTaken?: 'approved' | 'rejected' | 'modified' | 'escalated';
}

export interface CredibilityAnalysisResult {
  reviewId: string;
  analysisType: string;
  result: {
    score: number;
    details: {
      [key: string]: any;
    };
  };
}

export interface ReviewTrend {
  providerId: string;
  date: Date;
  averageCredibilityScore: number;
  flaggedCount: number;
  approvedCount: number;
  rejectedCount: number;
  averageRating: number;
  ratingDistribution: {
    oneStar: number;
    twoStar: number;
    threeStar: number;
    fourStar: number;
    fiveStar: number;
  };
}

// ============================================
// CONSTANTS
// ============================================

const AI_TEXT_KEYWORDS = [
  'in conclusion', 'furthermore', 'it is imperative', 'it can be argued',
  'one might say', 'notably', 'it would appear', 'allegedly', 'supposedly',
  'purportedly', 'in a nutshell', 'to summarize', 'as mentioned',
  'in the context of', 'provide an exhaustive', 'comprehensive analysis',
];

const SUSPICIOUS_PATTERNS = {
  perfectRatings: 0.95, // 95%+ 5-star reviews
  rapidReviews: 3, // 3+ reviews in 24 hours from same user
  identicalPhrasing: 0.85, // 85%+ similarity in phrasing
  excessiveLength: 5000, // reviews over 5000 chars
  excessiveDetails: 20, // 20+ specific details that might be fabricated
};

const CREDIBILITY_WEIGHTS = {
  verifiedUser: 0.25,
  timing: 0.15,
  textAnalysis: 0.25,
  ratingClustering: 0.15,
  userHistory: 0.10,
  contentConsistency: 0.10,
};

// ============================================
// REVIEW SUBMISSION & CREDIBILITY ANALYSIS
// ============================================

export async function submitReviewForAnalysis(
  providerId: string,
  userId: string,
  rating: number,
  title: string,
  content: string,
  serviceType: string,
  isVerifiedUser: boolean,
  caseId?: string
): Promise<{ reviewId: string; credibilityScore: ReviewCredibilityScore }> {
  try {
    // Create review entry
    const reviewResult = await query(
      `INSERT INTO reviews
       (provider_id, user_id, rating, title, content, service_type, is_verified_user, case_id, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, created_at`,
      [providerId, userId, rating, title, content, serviceType, isVerifiedUser, caseId || null, 'pending']
    );

    const reviewId = reviewResult.rows[0].id;

    // Analyze credibility
    const credibilityScore = await analyzeReviewCredibility(
      reviewId,
      providerId,
      userId,
      rating,
      content,
      isVerifiedUser
    );

    // Determine initial status based on credibility
    const initialStatus = getInitialReviewStatus(credibilityScore);

    // Update review status
    await query(
      `UPDATE reviews SET status = $1, credibility_score = $2 WHERE id = $3`,
      [initialStatus, credibilityScore.overallScore, reviewId]
    );

    // Add to admin queue if needed
    if (initialStatus === 'flagged' || initialStatus === 'rejected') {
      await addToAdminReviewQueue(
        reviewId,
        providerId,
        'Automatic flagging based on credibility analysis',
        credibilityScore.overallScore < 40 ? 'critical' : 'high'
      );
    }

    return { reviewId, credibilityScore };
  } catch (error) {
    console.error('Failed to submit review for analysis:', error);
    throw error;
  }
}

export async function analyzeReviewCredibility(
  reviewId: string,
  providerId: string,
  userId: string,
  rating: number,
  content: string,
  isVerifiedUser: boolean
): Promise<ReviewCredibilityScore> {
  try {
    // Get user history
    const userHistory = await getUserReviewHistory(userId);
    const providerReviews = await getProviderReviewHistory(providerId);

    // Calculate individual scores
    const verifiedUserScore = calculateVerifiedUserScore(isVerifiedUser, userHistory);
    const timingScore = await calculateTimingScore(userId, providerId);
    const textAnalysisScore = await analyzeTextCredibility(content);
    const ratingClusteringScore = calculateRatingClusteringScore(rating, providerReviews);
    // Awaited: this function is async, and without it a Promise entered the
    // weighted sum below and made every overall score NaN.
    const userHistoryScore = await calculateUserHistoryScore(userHistory);
    const contentConsistencyScore = await checkContentConsistency(userId, content);

    // Detect flags and AI-generated text
    const flags = await detectCredibilityFlags(
      reviewId,
      content,
      rating,
      userHistory,
      providerReviews,
      isVerifiedUser
    );

    const aiTextProbability = await detectAIGeneratedText(content);

    // Calculate weighted overall score
    const overallScore = Math.round(
      (verifiedUserScore * CREDIBILITY_WEIGHTS.verifiedUser +
        timingScore * CREDIBILITY_WEIGHTS.timing +
        textAnalysisScore * CREDIBILITY_WEIGHTS.textAnalysis +
        ratingClusteringScore * CREDIBILITY_WEIGHTS.ratingClustering +
        userHistoryScore * CREDIBILITY_WEIGHTS.userHistory +
        contentConsistencyScore * CREDIBILITY_WEIGHTS.contentConsistency
    );

    // Determine if likely fake
    const isLikelyFake =
      overallScore < 40 ||
      (aiTextProbability > 70 && flags.length > 2) ||
      flags.filter((f) => f.severity === 'critical').length > 0;

    // Recommend action
    const recommendedAction = getRecommendedAction(overallScore, flags, aiTextProbability);

    const credibilityScore: ReviewCredibilityScore = {
      reviewId,
      providerId,
      overallScore,
      scoreComponents: {
        verifiedUserScore,
        timingScore,
        textAnalysisScore,
        ratingClusteringScore,
        userHistoryScore,
        contentConsistencyScore,
      },
      flags,
      isLikelyFake,
      recommendedAction,
      aiTextProbability,
      createdAt: new Date(),
      analyzedAt: new Date(),
    };

    // Store credibility score
    await query(
      `INSERT INTO review_credibility_scores
       (review_id, provider_id, overall_score, score_components, flags, is_likely_fake, ai_text_probability, recommended_action)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (review_id) DO UPDATE SET
         overall_score = $3,
         score_components = $4,
         flags = $5,
         is_likely_fake = $6,
         ai_text_probability = $7,
         recommended_action = $8,
         analyzed_at = NOW()`,
      [
        reviewId,
        providerId,
        overallScore,
        JSON.stringify(credibilityScore.scoreComponents),
        JSON.stringify(flags),
        isLikelyFake,
        aiTextProbability,
        recommendedAction,
      ]
    );

    return credibilityScore;
  } catch (error) {
    console.error('Failed to analyze review credibility:', error);
    throw error;
  }
}

// ============================================
// SCORING COMPONENTS
// ============================================

function calculateVerifiedUserScore(
  isVerifiedUser: boolean,
  userHistory: { reviewCount: number; averageRating: number; suspiciousCount: number }
): number {
  if (!isVerifiedUser) return 30; // Low score for unverified users

  let score = 75;

  // Bonus for consistent review history
  if (userHistory.reviewCount > 5) score += 10;
  if (userHistory.reviewCount > 10) score += 5;

  // Penalty for suspicious history
  if (userHistory.suspiciousCount > 0) {
    score -= Math.min(userHistory.suspiciousCount * 10, 30);
  }

  return Math.min(100, Math.max(0, score));
}

async function calculateTimingScore(userId: string, providerId: string): Promise<number> {
  try {
    // Get user's recent review activity
    const result = await query(
      `SELECT COUNT(*) as count, MAX(created_at) as last_review
       FROM reviews
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    const recentReviewCount = parseInt(result.rows[0].count);

    // Check for suspicious timing patterns
    if (recentReviewCount > 5) return 20; // Multiple reviews in 24 hours
    if (recentReviewCount > 3) return 35;
    if (recentReviewCount === 1) return 65;
    if (recentReviewCount === 0) return 85;

    // Check review spacing
    const spacingResult = await query(
      `SELECT AVG(EXTRACT(EPOCH FROM (LAG(created_at) OVER (ORDER BY created_at) - created_at)))::numeric as avg_spacing
       FROM reviews
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'
       LIMIT 10`,
      [userId]
    );

    const avgSpacing = spacingResult.rows[0]?.avg_spacing || 0;

    // Natural spacing is typically hours to days apart
    if (avgSpacing < 3600) return 25; // Less than 1 hour apart
    if (avgSpacing < 86400) return 50; // Less than 1 day apart
    return 85; // Normal spacing

    return Math.min(100, Math.max(0, 85));
  } catch (error) {
    console.error('Failed to calculate timing score:', error);
    return 50; // Default to neutral if analysis fails
  }
}

async function analyzeTextCredibility(content: string): Promise<number> {
  try {
    let score = 70;

    // Analyze text properties
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgSentenceLength = content.split(/\s+/).length / sentences.length;

    // Natural language has varied sentence length (10-25 words average)
    if (avgSentenceLength < 8 || avgSentenceLength > 35) {
      score -= 15;
    }

    // Check vocabulary complexity (very high complexity suggests AI)
    const complexWords = content.match(/\b[a-z]{10,}\b/gi) || [];
    const complexityRatio = complexWords.length / content.split(/\s+/).length;

    if (complexityRatio > 0.15) {
      score -= 10; // Suspiciously complex
    }

    // Check for personal pronouns (humans use more)
    const personalPronouns = content.match(/\b(I|me|my|we|us|our)\b/gi) || [];
    const pronounRatio = personalPronouns.length / content.split(/\s+/).length;

    if (pronounRatio < 0.02) {
      score -= 15; // Too few personal pronouns
    }

    // Check for specific details and examples
    const specificity = (content.match(/[0-9]|specific|detail|example/gi) || []).length;
    if (specificity > 5) {
      score += 10; // More specific details = higher credibility
    }

    // Check for excessive length (might indicate template)
    if (content.length > 2000) {
      score -= 10;
    }

    return Math.min(100, Math.max(0, score));
  } catch (error) {
    console.error('Failed to analyze text credibility:', error);
    return 50;
  }
}

function calculateRatingClusteringScore(
  rating: number,
  providerReviews: { ratings: number[]; count: number }
): number {
  if (providerReviews.count < 5) return 75; // Not enough data

  const ratingCounts = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  providerReviews.ratings.forEach((r) => {
    ratingCounts[r as keyof typeof ratingCounts]++;
  });

  const total = Object.values(ratingCounts).reduce((a, b) => a + b, 0);
  const ratingPercentage = (ratingCounts[rating as keyof typeof ratingCounts] / total) * 100;

  // Extremely high clustering is suspicious
  if (ratingPercentage > 80) return 25;
  if (ratingPercentage > 60) return 40;
  if (ratingPercentage > 40) return 60;

  return 85; // Natural distribution
}

async function calculateUserHistoryScore(userHistory: {
  reviewCount: number;
  averageRating: number;
  suspiciousCount: number;
}): Promise<number> {
  let score = 50;

  // More reviews = higher credibility (but with diminishing returns)
  if (userHistory.reviewCount > 20) score = 90;
  else if (userHistory.reviewCount > 10) score = 80;
  else if (userHistory.reviewCount > 5) score = 70;
  else if (userHistory.reviewCount > 1) score = 60;

  // Penalty for suspicious reviews in history
  if (userHistory.suspiciousCount > 0) {
    score -= Math.min(userHistory.suspiciousCount * 5, 30);
  }

  // Check rating consistency
  if (userHistory.averageRating >= 4.0 || userHistory.averageRating <= 2.0) {
    score -= 10; // Extreme average ratings are suspicious
  }

  return Math.min(100, Math.max(0, score));
}

async function checkContentConsistency(userId: string, content: string): Promise<number> {
  try {
    // Get user's previous reviews
    const result = await query(
      `SELECT content FROM reviews WHERE user_id = $1 AND created_at > NOW() - INTERVAL '6 months' LIMIT 10`,
      [userId]
    );

    if (result.rows.length === 0) return 70; // First review

    let score = 70;

    // Check for duplicate or very similar content
    const contentWords = new Set(content.toLowerCase().split(/\s+/));

    for (const row of result.rows) {
      const prevWords = new Set(row.content.toLowerCase().split(/\s+/));
      const intersection = new Set([...contentWords].filter((x) => prevWords.has(x)));
      const similarity = intersection.size / Math.max(contentWords.size, prevWords.size);

      if (similarity > 0.7) {
        score -= 20; // Too similar to previous review
      }
    }

    return Math.min(100, Math.max(0, score));
  } catch (error) {
    console.error('Failed to check content consistency:', error);
    return 50;
  }
}

// ============================================
// FAKE REVIEW DETECTION
// ============================================

async function detectAIGeneratedText(content: string): Promise<number> {
  try {
    let aiScore = 0;
    let indicators = 0;

    // Check for AI-typical keywords
    const aiKeywordMatches = content.match(
      new RegExp(AI_TEXT_KEYWORDS.join('|'), 'gi')
    ) || [];
    if (aiKeywordMatches.length > 0) {
      aiScore += Math.min(aiKeywordMatches.length * 5, 30);
      indicators++;
    }

    // Check for perfect grammar and structure (humans often make small errors)
    const grammarQuality = checkGrammarQuality(content);
    if (grammarQuality > 0.95) {
      aiScore += 15;
      indicators++;
    }

    // Check for filler phrases
    const fillerPhrases = content.match(
      /\b(in conclusion|to summarize|it should be noted|furthermore|moreover|notably)\b/gi
    ) || [];
    if (fillerPhrases.length > 2) {
      aiScore += 20;
      indicators++;
    }

    // Check for excessive use of adjectives
    const adjectives = content.match(/\b(very|extremely|incredibly|amazing|wonderful|terrible)\b/gi) || [];
    if (adjectives.length > (content.split(/\s+/).length / 20)) {
      aiScore += 10;
      indicators++;
    }

    // Check pattern: if multiple indicators present, increase probability
    if (indicators > 2) {
      aiScore = Math.min(100, aiScore * 1.2);
    }

    return Math.min(100, Math.max(0, aiScore));
  } catch (error) {
    console.error('Failed to detect AI-generated text:', error);
    return 0;
  }
}

function checkGrammarQuality(content: string): number {
  // Simplified grammar check - in production, use a proper grammar library
  const sentences = content.split(/[.!?]+/);
  let correctSentences = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) continue;

    // Check for basic grammar patterns
    if (/^[A-Z]/.test(trimmed) && /[a-z]/.test(trimmed)) {
      correctSentences++;
    }
  }

  return correctSentences / sentences.length;
}

async function detectCredibilityFlags(
  reviewId: string,
  content: string,
  rating: number,
  userHistory: { reviewCount: number; averageRating: number; suspiciousCount: number },
  providerReviews: { ratings: number[]; count: number },
  isVerifiedUser: boolean
): Promise<CredibilityFlag[]> {
  const flags: CredibilityFlag[] = [];

  // Flag 1: AI-generated text detection
  const aiProbability = await detectAIGeneratedText(content);
  if (aiProbability > 60) {
    flags.push({
      id: `flag_${reviewId}_ai_1`,
      type: 'ai_generated',
      severity: aiProbability > 80 ? 'critical' : aiProbability > 70 ? 'high' : 'medium',
      description: `Text analysis suggests AI-generated content (${aiProbability.toFixed(0)}% probability)`,
      confidence: aiProbability,
      evidence: 'Detected AI-typical keywords, filler phrases, and excessive formality',
    });
  }

  // Flag 2: Timing anomalies
  if (userHistory.reviewCount > 3) {
    flags.push({
      id: `flag_${reviewId}_timing_1`,
      type: 'timing_anomaly',
      severity: 'high',
      description: 'User submitted multiple reviews in rapid succession',
      confidence: Math.min(90, userHistory.reviewCount * 15),
    });
  }

  // Flag 3: Rating clustering
  if (providerReviews.count > 10) {
    const ratingCounts = { 5: 0 };
    providerReviews.ratings.forEach((r) => {
      if (r === 5) ratingCounts[5]++;
    });
    const fiveStarPercentage = (ratingCounts[5] / providerReviews.count) * 100;

    if (fiveStarPercentage > 85) {
      flags.push({
        id: `flag_${reviewId}_cluster_1`,
        type: 'rating_clustering',
        severity: 'high',
        description: `Provider has ${fiveStarPercentage.toFixed(0)}% five-star reviews (unusually high)`,
        confidence: Math.min(90, fiveStarPercentage - 80),
      });
    }
  }

  // Flag 4: Duplicate pattern
  const duplicateCheck = await query(
    `SELECT COUNT(*) as count FROM reviews
     WHERE provider_id = $1 AND user_id != $2 AND content LIKE $3 AND created_at > NOW() - INTERVAL '30 days'`,
    [providerReviews.count, userHistory.reviewCount, `%${content.substring(0, 50)}%`]
  );

  if (parseInt(duplicateCheck.rows[0].count) > 0) {
    flags.push({
      id: `flag_${reviewId}_dup_1`,
      type: 'duplicate_pattern',
      severity: 'critical',
      description: 'Very similar reviews from multiple users detected',
      confidence: 85,
    });
  }

  // Flag 5: Extreme sentiment
  if (rating === 5 && content.length < 50) {
    flags.push({
      id: `flag_${reviewId}_sentiment_1`,
      type: 'extreme_sentiment',
      severity: 'medium',
      description: 'Perfect rating with minimal explanation',
      confidence: 60,
    });
  }

  // Flag 6: Unverified user with high rating
  if (!isVerifiedUser && rating >= 4) {
    flags.push({
      id: `flag_${reviewId}_unverified_1`,
      type: 'suspicious_keywords',
      severity: 'low',
      description: 'Unverified user leaving positive review',
      confidence: 40,
    });
  }

  return flags;
}

// ============================================
// PROVIDER REPUTATION MANAGEMENT
// ============================================

export async function calculateProviderReputation(providerId: string): Promise<ProviderReputation> {
  try {
    // Get all approved reviews for provider
    const reviewsResult = await query(
      `SELECT rating, credibility_score FROM reviews
       WHERE provider_id = $1 AND status = 'approved'
       ORDER BY created_at DESC`,
      [providerId]
    );

    const reviews = reviewsResult.rows;

    if (reviews.length === 0) {
      return {
        providerId,
        averageRating: 0,
        totalReviews: 0,
        verifiedReviews: 0,
        credibilityScore: 0,
        suspiciousReviews: 0,
        riskLevel: 'low',
        trustScore: 50,
        lastUpdated: new Date(),
        trend: 'stable',
      };
    }

    const averageRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const averageCredibilityScore =
      reviews.reduce((sum, r) => sum + (r.credibility_score || 0), 0) / reviews.length;

    // Get verified reviews count
    const verifiedResult = await query(
      `SELECT COUNT(*) as count FROM reviews
       WHERE provider_id = $1 AND is_verified_user = true AND status = 'approved'`,
      [providerId]
    );

    const verifiedReviews = parseInt(verifiedResult.rows[0].count);

    // Get flagged/rejected count
    const suspiciousResult = await query(
      `SELECT COUNT(*) as count FROM reviews
       WHERE provider_id = $1 AND status IN ('flagged', 'rejected')`,
      [providerId]
    );

    const suspiciousReviews = parseInt(suspiciousResult.rows[0].count);

    // Calculate risk level
    const riskLevel = calculateRiskLevel(
      averageCredibilityScore,
      suspiciousReviews,
      reviews.length
    );

    // Calculate trend
    const trend = await calculateReputationTrend(providerId);

    // Calculate trust score
    const trustScore = Math.round(
      (averageCredibilityScore * 0.6 + (1 - suspiciousReviews / Math.max(reviews.length, 1)) * 40) as number
    );

    const reputation: ProviderReputation = {
      providerId,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: reviews.length,
      verifiedReviews,
      credibilityScore: Math.round(averageCredibilityScore),
      suspiciousReviews,
      riskLevel,
      trustScore: Math.min(100, Math.max(0, trustScore)),
      lastUpdated: new Date(),
      trend,
    };

    // Store reputation score
    await query(
      `INSERT INTO provider_reputation
       (provider_id, average_rating, total_reviews, verified_reviews, credibility_score, suspicious_reviews, risk_level, trust_score, trend)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (provider_id) DO UPDATE SET
         average_rating = $2,
         total_reviews = $3,
         verified_reviews = $4,
         credibility_score = $5,
         suspicious_reviews = $6,
         risk_level = $7,
         trust_score = $8,
         trend = $9,
         last_updated = NOW()`,
      [
        providerId,
        reputation.averageRating,
        reputation.totalReviews,
        reputation.verifiedReviews,
        reputation.credibilityScore,
        reputation.suspiciousReviews,
        reputation.riskLevel,
        reputation.trustScore,
        reputation.trend,
      ]
    );

    return reputation;
  } catch (error) {
    console.error('Failed to calculate provider reputation:', error);
    throw error;
  }
}

function calculateRiskLevel(
  credibilityScore: number,
  suspiciousReviews: number,
  totalReviews: number
): 'low' | 'medium' | 'high' | 'critical' {
  const suspiciousRatio = totalReviews > 0 ? suspiciousReviews / totalReviews : 0;

  if (credibilityScore < 30 || suspiciousRatio > 0.5) return 'critical';
  if (credibilityScore < 50 || suspiciousRatio > 0.3) return 'high';
  if (credibilityScore < 70 || suspiciousRatio > 0.15) return 'medium';
  return 'low';
}

async function calculateReputationTrend(
  providerId: string
): Promise<'improving' | 'stable' | 'declining' | 'volatile'> {
  try {
    const result = await query(
      `SELECT
         (SELECT AVG(credibility_score) FROM reviews
          WHERE provider_id = $1 AND created_at > NOW() - INTERVAL '7 days') as recent_score,
         (SELECT AVG(credibility_score) FROM reviews
          WHERE provider_id = $1 AND created_at > NOW() - INTERVAL '30 days' AND created_at <= NOW() - INTERVAL '7 days') as previous_score`,
      [providerId]
    );

    const recentScore = result.rows[0].recent_score || 0;
    const previousScore = result.rows[0].previous_score || 0;

    const difference = recentScore - previousScore;

    if (Math.abs(difference) < 5) return 'stable';
    if (difference > 10) return 'improving';
    if (difference < -10) return 'declining';
    return 'volatile';
  } catch (error) {
    console.error('Failed to calculate reputation trend:', error);
    return 'stable';
  }
}

// ============================================
// ADMIN REVIEW QUEUE
// ============================================

export async function addToAdminReviewQueue(
  reviewId: string,
  providerId: string,
  reason: string,
  priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
): Promise<AdminReviewQueue> {
  try {
    const result = await query(
      `INSERT INTO admin_review_queue
       (review_id, provider_id, reason, priority, status, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [reviewId, providerId, reason, priority, 'pending']
    );

    // Notify admins
    await sendEmailNotification({
      to: process.env.ADMIN_EMAIL || 'admin@transcend-law.com',
      subject: `Review Flagged for Manual Review - Priority: ${priority}`,
      template: 'review-flagged-admin',
      context: {
        reviewId,
        providerId,
        reason,
        priority,
      },
    });

    return {
      id: result.rows[0].id,
      reviewId,
      providerId,
      reviewerId: '',
      reason,
      priority,
      status: 'pending',
      createdAt: new Date(result.rows[0].created_at),
    };
  } catch (error) {
    console.error('Failed to add review to admin queue:', error);
    throw error;
  }
}

export async function getAdminReviewQueue(
  status?: string,
  priority?: string,
  limit: number = 50
): Promise<AdminReviewQueue[]> {
  try {
    let query_text = `SELECT * FROM admin_review_queue WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      query_text += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (priority) {
      query_text += ` AND priority = $${params.length + 1}`;
      params.push(priority);
    }

    query_text += ` ORDER BY priority DESC, created_at ASC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query(query_text, params);

    return result.rows.map((row) => ({
      id: row.id,
      reviewId: row.review_id,
      providerId: row.provider_id,
      reviewerId: row.reviewer_id,
      reason: row.reason,
      priority: row.priority,
      status: row.status,
      createdAt: new Date(row.created_at),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      resolution: row.resolution,
      actionTaken: row.action_taken,
    }));
  } catch (error) {
    console.error('Failed to get admin review queue:', error);
    throw error;
  }
}

export async function resolveAdminReview(
  queueId: string,
  reviewerId: string,
  action: 'approved' | 'rejected' | 'modified' | 'escalated',
  resolution: string
): Promise<void> {
  try {
    const status = action === 'escalated' ? 'pending' : 'resolved';

    await query(
      `UPDATE admin_review_queue
       SET status = $1, reviewer_id = $2, action_taken = $3, resolution = $4, reviewed_at = NOW()
       WHERE id = $5`,
      [status, reviewerId, action, resolution, queueId]
    );

    // If action is approved, update review status
    if (action === 'approved') {
      const queueResult = await query(
        `SELECT review_id FROM admin_review_queue WHERE id = $1`,
        [queueId]
      );

      if (queueResult.rows.length > 0) {
        const reviewId = queueResult.rows[0].review_id;
        await query(`UPDATE reviews SET status = 'approved' WHERE id = $1`, [reviewId]);
      }
    }
  } catch (error) {
    console.error('Failed to resolve admin review:', error);
    throw error;
  }
}

// ============================================
// HISTORICAL TRACKING
// ============================================

export async function trackReviewTrend(providerId: string): Promise<ReviewTrend> {
  try {
    const result = await query(
      `SELECT
         DATE(created_at) as date,
         AVG(credibility_score) as avg_credibility,
         COUNT(CASE WHEN status = 'flagged' OR status = 'rejected' THEN 1 END) as flagged_count,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
         AVG(rating) as avg_rating,
         COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
         COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
         COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
         COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
         COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star
       FROM reviews
       WHERE provider_id = $1 AND created_at > NOW() - INTERVAL '90 days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 1`,
      [providerId]
    );

    if (result.rows.length === 0) {
      return {
        providerId,
        date: new Date(),
        averageCredibilityScore: 0,
        flaggedCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
        averageRating: 0,
        ratingDistribution: { oneStar: 0, twoStar: 0, threeStar: 0, fourStar: 0, fiveStar: 0 },
      };
    }

    const row = result.rows[0];

    return {
      providerId,
      date: new Date(row.date),
      averageCredibilityScore: Math.round(row.avg_credibility || 0),
      flaggedCount: parseInt(row.flagged_count),
      approvedCount: parseInt(row.approved_count),
      rejectedCount: 0,
      averageRating: Math.round((row.avg_rating || 0) * 10) / 10,
      ratingDistribution: {
        oneStar: parseInt(row.one_star),
        twoStar: parseInt(row.two_star),
        threeStar: parseInt(row.three_star),
        fourStar: parseInt(row.four_star),
        fiveStar: parseInt(row.five_star),
      },
    };
  } catch (error) {
    console.error('Failed to track review trend:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUserReviewHistory(userId: string): Promise<{
  reviewCount: number;
  averageRating: number;
  suspiciousCount: number;
}> {
  try {
    const result = await query(
      `SELECT
         COUNT(*) as count,
         AVG(rating) as avg_rating,
         COUNT(CASE WHEN status IN ('flagged', 'rejected') THEN 1 END) as suspicious_count
       FROM reviews
       WHERE user_id = $1`,
      [userId]
    );

    return {
      reviewCount: parseInt(result.rows[0].count || 0),
      averageRating: parseFloat(result.rows[0].avg_rating || 0),
      suspiciousCount: parseInt(result.rows[0].suspicious_count || 0),
    };
  } catch (error) {
    console.error('Failed to get user review history:', error);
    return { reviewCount: 0, averageRating: 0, suspiciousCount: 0 };
  }
}

async function getProviderReviewHistory(providerId: string): Promise<{
  ratings: number[];
  count: number;
}> {
  try {
    const result = await query(
      `SELECT rating FROM reviews
       WHERE provider_id = $1 AND status = 'approved'
       ORDER BY created_at DESC
       LIMIT 100`,
      [providerId]
    );

    return {
      ratings: result.rows.map((r) => r.rating),
      count: result.rows.length,
    };
  } catch (error) {
    console.error('Failed to get provider review history:', error);
    return { ratings: [], count: 0 };
  }
}

function getInitialReviewStatus(
  credibilityScore: ReviewCredibilityScore
): 'approved' | 'pending' | 'flagged' | 'rejected' {
  if (credibilityScore.isLikelyFake) {
    return 'rejected';
  }

  if (credibilityScore.overallScore < 40) {
    return 'rejected';
  }

  if (credibilityScore.overallScore < 60 || credibilityScore.flags.length > 2) {
    return 'flagged';
  }

  if (credibilityScore.recommendedAction === 'manual_review') {
    return 'pending';
  }

  return 'approved';
}

function getRecommendedAction(
  score: number,
  flags: CredibilityFlag[],
  aiProbability: number
): 'approve' | 'flag' | 'reject' | 'manual_review' {
  const criticalFlags = flags.filter((f) => f.severity === 'critical').length;

  if (score < 30 || criticalFlags > 0 || aiProbability > 85) {
    return 'reject';
  }

  if (score < 55 || flags.length > 3 || aiProbability > 65) {
    return 'flag';
  }

  if (score < 70 || flags.length > 1) {
    return 'manual_review';
  }

  return 'approve';
}

export async function filterOutFakeReviews(providerId: string): Promise<number> {
  try {
    const result = await query(
      `UPDATE reviews
       SET status = 'rejected'
       WHERE provider_id = $1
         AND status IN ('pending', 'flagged')
         AND credibility_score < $2
       RETURNING id`,
      [providerId, 35]
    );

    return result.rows.length;
  } catch (error) {
    console.error('Failed to filter fake reviews:', error);
    throw error;
  }
}

export async function getReviewCredibilityTrends(
  providerId: string,
  days: number = 30
): Promise<ReviewTrend[]> {
  try {
    const result = await query(
      `SELECT
         DATE(created_at) as date,
         AVG(credibility_score) as avg_credibility,
         COUNT(CASE WHEN status = 'flagged' OR status = 'rejected' THEN 1 END) as flagged_count,
         COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
         AVG(rating) as avg_rating,
         COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
         COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
         COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
         COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
         COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star
       FROM reviews
       WHERE provider_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      [providerId]
    );

    return result.rows.map((row) => ({
      providerId,
      date: new Date(row.date),
      averageCredibilityScore: Math.round(row.avg_credibility || 0),
      flaggedCount: parseInt(row.flagged_count),
      approvedCount: parseInt(row.approved_count),
      rejectedCount: 0,
      averageRating: Math.round((row.avg_rating || 0) * 10) / 10,
      ratingDistribution: {
        oneStar: parseInt(row.one_star),
        twoStar: parseInt(row.two_star),
        threeStar: parseInt(row.three_star),
        fourStar: parseInt(row.four_star),
        fiveStar: parseInt(row.five_star),
      },
    }));
  } catch (error) {
    console.error('Failed to get review credibility trends:', error);
    throw error;
  }
}
