// NPS Survey Component
// Features: Monthly NPS survey, follow-up questions, feedback submission

import React, { useState, useEffect } from 'react';
import './NPSSurvey.css';

interface NPSSurveyProps {
  userId: string;
  userType: 'client' | 'provider' | 'admin';
  onComplete?: (surveyId: string) => void;
  onDismiss?: () => void;
  autoShow?: boolean; // Show immediately when mounted
}

interface SurveyState {
  step: 'question' | 'followup' | 'tags' | 'submitted';
  score: number | null;
  followUpComment: string;
  selectedTags: string[];
  isSubmitting: boolean;
  error: string | null;
}

const TAG_OPTIONS: Record<string, string[]> = {
  client: ['Easy to use', 'Fast', 'Good support', 'Affordable', 'Feature rich', 'Other'],
  provider: ['Good matching', 'Fair pay', 'Reliable platform', 'Easy bookings', 'Good support', 'Other'],
  admin: ['Comprehensive dashboard', 'Good reporting', 'Easy to manage', 'Reliable system', 'Good support', 'Other'],
};

const SENTIMENT_LABELS = {
  0: 'Very Unlikely',
  1: 'Unlikely',
  2: 'Somewhat Unlikely',
  3: 'Neutral',
  4: 'Somewhat Likely',
  5: 'Likely',
  6: 'Likely',
  7: 'Very Likely',
  8: 'Promoter',
  9: 'Promoter',
  10: 'Strong Promoter',
};

export const NPSSurvey: React.FC<NPSSurveyProps> = ({
  userId,
  userType,
  onComplete,
  onDismiss,
  autoShow = false,
}) => {
  const [isVisible, setIsVisible] = useState(autoShow);
  const [surveyState, setSurveyState] = useState<SurveyState>({
    step: 'question',
    score: null,
    followUpComment: '',
    selectedTags: [],
    isSubmitting: false,
    error: null,
  });

  useEffect(() => {
    // Check if user has already responded this month
    checkSurveyStatus();
  }, [userId]);

  const checkSurveyStatus = async () => {
    try {
      const response = await fetch(`/api/nps/check-eligibility`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isEligible && autoShow) {
          setIsVisible(true);
        }
      }
    } catch (error) {
      console.error('Error checking survey eligibility:', error);
    }
  };

  const handleScoreSelect = (score: number) => {
    setSurveyState(prev => ({
      ...prev,
      score,
      step: 'followup',
      error: null,
    }));
  };

  const handleFollowupSubmit = () => {
    if (!surveyState.followUpComment.trim()) {
      setSurveyState(prev => ({
        ...prev,
        error: 'Please tell us why',
      }));
      return;
    }
    setSurveyState(prev => ({
      ...prev,
      step: 'tags',
      error: null,
    }));
  };

  const handleTagToggle = (tag: string) => {
    setSurveyState(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter(t => t !== tag)
        : [...prev.selectedTags, tag],
    }));
  };

  const handleSubmitSurvey = async () => {
    if (surveyState.score === null) return;

    setSurveyState(prev => ({
      ...prev,
      isSubmitting: true,
      error: null,
    }));

    try {
      const response = await fetch('/api/nps/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId,
          userType,
          score: surveyState.score,
          followUpComment: surveyState.followUpComment,
          tags: surveyState.selectedTags,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit survey');
      }

      const data = await response.json();

      setSurveyState(prev => ({
        ...prev,
        step: 'submitted',
        isSubmitting: false,
      }));

      if (onComplete) {
        onComplete(data.id);
      }

      // Auto-close after 3 seconds
      setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    } catch (error) {
      console.error('Error submitting NPS survey:', error);
      setSurveyState(prev => ({
        ...prev,
        isSubmitting: false,
        error: 'Failed to submit survey. Please try again.',
      }));
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="nps-survey-overlay">
      <div className="nps-survey-modal">
        {/* Header */}
        <div className="nps-survey-header">
          <h2>How likely are you to recommend us?</h2>
          <button
            className="nps-close-btn"
            onClick={handleDismiss}
            aria-label="Close survey"
          >
            ×
          </button>
        </div>

        {/* Survey Content */}
        <div className="nps-survey-content">
          {surveyState.step === 'question' && (
            <div className="nps-question-step">
              <p className="nps-question-subtitle">
                Rate your likelihood to recommend us on a scale of 0 to 10
              </p>

              {/* Score Scale */}
              <div className="nps-score-grid">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    className={`nps-score-btn ${surveyState.score === i ? 'active' : ''}`}
                    onClick={() => handleScoreSelect(i)}
                    style={{
                      backgroundColor: i <= 6 ? '#ef4444' : i <= 8 ? '#f59e0b' : '#10b981',
                    }}
                  >
                    <span className="nps-score-value">{i}</span>
                    <span className="nps-score-label">{SENTIMENT_LABELS[i as keyof typeof SENTIMENT_LABELS]}</span>
                  </button>
                ))}
              </div>

              {/* Legend */}
              <div className="nps-legend">
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#ef4444' }}></span>
                  <span>Detractors (0-6)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span>
                  <span>Passives (7-8)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: '#10b981' }}></span>
                  <span>Promoters (9-10)</span>
                </div>
              </div>
            </div>
          )}

          {surveyState.step === 'followup' && (
            <div className="nps-followup-step">
              <p className="nps-followup-title">
                {surveyState.score! <= 6 && 'What could we improve?'}
                {surveyState.score! >= 7 && surveyState.score! <= 8 && 'What would make us a 9 or 10?'}
                {surveyState.score! >= 9 && "What's your favorite feature?"}
              </p>

              <textarea
                className="nps-followup-textarea"
                placeholder="Please share your feedback..."
                value={surveyState.followUpComment}
                onChange={(e) =>
                  setSurveyState(prev => ({
                    ...prev,
                    followUpComment: e.target.value,
                  }))
                }
                rows={4}
              />

              {surveyState.error && (
                <div className="nps-error">{surveyState.error}</div>
              )}

              <button
                className="nps-next-btn"
                onClick={handleFollowupSubmit}
              >
                Next
              </button>
            </div>
          )}

          {surveyState.step === 'tags' && (
            <div className="nps-tags-step">
              <p className="nps-tags-title">
                Help us categorize your feedback (select all that apply)
              </p>

              <div className="nps-tags-grid">
                {TAG_OPTIONS[userType]?.map((tag) => (
                  <button
                    key={tag}
                    className={`nps-tag-btn ${surveyState.selectedTags.includes(tag) ? 'selected' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    <span className="nps-tag-checkbox">
                      {surveyState.selectedTags.includes(tag) && '✓'}
                    </span>
                    <span className="nps-tag-label">{tag}</span>
                  </button>
                ))}
              </div>

              <button
                className="nps-submit-btn"
                onClick={handleSubmitSurvey}
                disabled={surveyState.isSubmitting}
              >
                {surveyState.isSubmitting ? 'Submitting...' : 'Submit Survey'}
              </button>
            </div>
          )}

          {surveyState.step === 'submitted' && (
            <div className="nps-submitted-step">
              <div className="nps-success-icon">✓</div>
              <h3>Thank you for your feedback!</h3>
              <p>Your response helps us improve our platform.</p>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        {surveyState.step !== 'submitted' && (
          <div className="nps-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width:
                    surveyState.step === 'question'
                      ? '33%'
                      : surveyState.step === 'followup'
                      ? '66%'
                      : '100%',
                }}
              ></div>
            </div>
            <div className="progress-text">
              {surveyState.step === 'question' && 'Step 1 of 3'}
              {surveyState.step === 'followup' && 'Step 2 of 3'}
              {surveyState.step === 'tags' && 'Step 3 of 3'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NPSSurvey;
