// Social Proof Widget Component
// Displays real-time activity feed and FOMO-driven statistics

import React, { useState, useEffect } from 'react';
import './SocialProof.css';

interface ActivityItem {
  id: string;
  type: 'booking' | 'review' | 'signup';
  firstName: string;
  service: string;
  timeAgo: string;
  timestamp: Date;
}

interface SocialProofStats {
  totalUsers: number;
  weeklyBookings: number;
  averageRating: number;
  totalReviews: number;
}

interface SocialProofProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  variant?: 'compact' | 'expanded';
  autoScroll?: boolean;
  showStats?: boolean;
  animationDuration?: number;
  onImpression?: (position: string, variant: string) => void;
}

const MOCK_ACTIVITIES: Omit<ActivityItem, 'id'>[] = [
  {
    type: 'booking',
    firstName: 'Sarah',
    service: 'Legal Consultation',
    timeAgo: '2 minutes ago',
    timestamp: new Date(Date.now() - 2 * 60000),
  },
  {
    type: 'booking',
    firstName: 'Michael',
    service: 'Contract Review',
    timeAgo: '5 minutes ago',
    timestamp: new Date(Date.now() - 5 * 60000),
  },
  {
    type: 'review',
    firstName: 'Jennifer',
    service: '5-star review',
    timeAgo: '12 minutes ago',
    timestamp: new Date(Date.now() - 12 * 60000),
  },
  {
    type: 'signup',
    firstName: 'David',
    service: 'just joined',
    timeAgo: '18 minutes ago',
    timestamp: new Date(Date.now() - 18 * 60000),
  },
  {
    type: 'booking',
    firstName: 'Amanda',
    service: 'Notary Service',
    timeAgo: '24 minutes ago',
    timestamp: new Date(Date.now() - 24 * 60000),
  },
];

const MOCK_STATS: SocialProofStats = {
  totalUsers: 15283,
  weeklyBookings: 2847,
  averageRating: 4.8,
  totalReviews: 1924,
};

export const SocialProof: React.FC<SocialProofProps> = ({
  position = 'bottom-right',
  variant = 'compact',
  autoScroll = true,
  showStats = true,
  animationDuration = 4000,
  onImpression,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [displayedIndex, setDisplayedIndex] = useState(0);
  const [stats, setStats] = useState<SocialProofStats>(MOCK_STATS);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Initialize activity feed
  useEffect(() => {
    const initialActivities: ActivityItem[] = MOCK_ACTIVITIES.map((activity, index) => ({
      ...activity,
      id: `activity-${index}`,
    }));
    setActivities(initialActivities);

    // Track impression
    onImpression?.(position, variant);

    // Simulate real-time activity updates
    const interval = setInterval(() => {
      const newActivity: ActivityItem = {
        id: `activity-${Date.now()}`,
        type: ['booking', 'review', 'signup'][Math.floor(Math.random() * 3)] as ActivityItem['type'],
        firstName: ['Sarah', 'Michael', 'Jennifer', 'David', 'Amanda', 'Chris', 'Emma'][
          Math.floor(Math.random() * 7)
        ],
        service: ['Legal Consultation', 'Contract Review', 'Notary Service', '5-star review', 'just joined'][
          Math.floor(Math.random() * 5)
        ],
        timeAgo: 'just now',
        timestamp: new Date(),
      };

      setActivities((prev) => [newActivity, ...prev.slice(0, 9)]);

      // Update stats
      setStats((prev) => ({
        ...prev,
        weeklyBookings: prev.weeklyBookings + (Math.random() > 0.5 ? 1 : 0),
        totalUsers: prev.totalUsers + (Math.random() > 0.9 ? 1 : 0),
      }));
    }, 8000 + Math.random() * 4000);

    return () => clearInterval(interval);
  }, [position, variant, onImpression]);

  // Auto-scroll through activities
  useEffect(() => {
    if (!autoScroll || isExpanded || !activities.length) return;

    const interval = setInterval(() => {
      setDisplayedIndex((prev) => (prev + 1) % activities.length);
    }, animationDuration);

    return () => clearInterval(interval);
  }, [autoScroll, isExpanded, activities, animationDuration]);

  const handleInteraction = () => {
    setHasInteracted(true);
    if (variant === 'compact') {
      setIsExpanded(true);
    }
  };

  const currentActivity = activities[displayedIndex];

  const getActivityEmoji = (type: ActivityItem['type']) => {
    switch (type) {
      case 'booking':
        return '📅';
      case 'review':
        return '⭐';
      case 'signup':
        return '🎉';
      default:
        return '👤';
    }
  };

  const getActivityMessage = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'booking':
        return `${activity.firstName} booked ${activity.service}`;
      case 'review':
        return `${activity.firstName} left ${activity.service}`;
      case 'signup':
        return `${activity.firstName} ${activity.service}`;
      default:
        return `${activity.firstName} - ${activity.service}`;
    }
  };

  const renderCompact = () => {
    if (!currentActivity) return null;

    return (
      <div className="social-proof-compact">
        <div className="social-proof-header">
          <span className="social-proof-title">Social Proof</span>
          <button
            className="social-proof-expand-btn"
            onClick={handleInteraction}
            aria-label="Expand social proof"
          >
            +
          </button>
        </div>

        <div className="social-proof-activity-compact">
          <div className="activity-emoji">{getActivityEmoji(currentActivity.type)}</div>
          <div className="activity-content">
            <p className="activity-message">{getActivityMessage(currentActivity)}</p>
            <p className="activity-time">{currentActivity.timeAgo}</p>
          </div>
        </div>

        {showStats && (
          <div className="social-proof-stat-mini">
            <span className="stat-highlight">{stats.weeklyBookings}+</span> bookings this week
          </div>
        )}
      </div>
    );
  };

  const renderExpanded = () => {
    return (
      <div className="social-proof-expanded">
        <div className="social-proof-expanded-header">
          <h3>Real-Time Activity</h3>
          <button
            className="social-proof-close-btn"
            onClick={() => setIsExpanded(false)}
            aria-label="Close social proof"
          >
            ✕
          </button>
        </div>

        {/* Stats Section */}
        {showStats && (
          <div className="social-proof-stats-grid">
            <div className="stat-card">
              <div className="stat-value">{(stats.totalUsers / 1000).toFixed(1)}K+</div>
              <div className="stat-description">Total Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.averageRating}</div>
              <div className="stat-description">Average Rating</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{(stats.weeklyBookings / 100).toFixed(1)}K</div>
              <div className="stat-description">Weekly Bookings</div>
            </div>
          </div>
        )}

        {/* Activity Feed */}
        <div className="social-proof-feed">
          <div className="feed-label">Just Now:</div>
          {activities.slice(0, 5).map((activity, index) => (
            <div key={activity.id} className="feed-item" style={{ animationDelay: `${index * 0.1}s` }}>
              <span className="feed-emoji">{getActivityEmoji(activity.type)}</span>
              <div className="feed-content">
                <p className="feed-message">{getActivityMessage(activity)}</p>
                <p className="feed-time">{activity.timeAgo}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="social-proof-cta">
          <p className="cta-text">Join thousands of satisfied users</p>
          <button className="cta-btn">Get Started Free</button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`social-proof-widget social-proof-${position} ${hasInteracted ? 'interacted' : ''}`}
      data-variant={variant}
    >
      {isExpanded ? renderExpanded() : renderCompact()}

      {/* Animation dots for compact view */}
      {variant === 'compact' && !isExpanded && activities.length > 0 && (
        <div className="social-proof-dots">
          {activities.slice(0, 3).map((_, index) => (
            <div
              key={index}
              className={`dot ${index === displayedIndex ? 'active' : ''}`}
              onClick={() => setDisplayedIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SocialProof;
