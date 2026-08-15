/**
 * NPS Survey Integration Examples
 * Quick reference for implementing NPS in your application
 */

// ============================================
// 1. BACKEND INTEGRATION (Express.js)
// ============================================

// In your main Express app file (e.g., server.ts or app.ts):

import express from 'express';
import { registerNPSRoutes } from './routes/npsRoutes';

const app = express();

// Initialize middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ... other routes ...

// Register NPS routes
registerNPSRoutes(app);

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('NPS routes registered');
});

// ============================================
// 2. FRONTEND INTEGRATION (React)
// ============================================

// Option A: Add to main App component
import React, { useEffect, useState } from 'react';
import NPSSurvey from './components/NPSSurvey';
import { useAuth } from './hooks/useAuth'; // Your auth hook

function App() {
  const { user, isAuthenticated } = useAuth();

  return (
    <>
      {/* Main app content */}
      <main>
        {/* Your app components */}
      </main>

      {/* NPS Survey - Show to authenticated users */}
      {isAuthenticated && user && (
        <NPSSurvey
          userId={user.id}
          userType={user.type as 'client' | 'provider' | 'admin'}
          autoShow={true}
          onComplete={(surveyId) => {
            console.log('Survey completed:', surveyId);
            // Optional: Track in analytics
          }}
          onDismiss={() => {
            console.log('Survey dismissed');
          }}
        />
      )}
    </>
  );
}

export default App;

// Option B: Add to dashboard page
import React from 'react';
import NPSSurvey from './components/NPSSurvey';

function Dashboard() {
  const user = useAuth();

  return (
    <div className="dashboard">
      <h1>Welcome back, {user.name}</h1>
      {/* Dashboard content */}

      {/* Optional: Show survey only on dashboard */}
      <NPSSurvey
        userId={user.id}
        userType={user.type}
        autoShow={false} // Manually control when to show
      />
    </div>
  );
}

// Option C: Manual trigger from button
import React, { useRef } from 'react';
import NPSSurvey from './components/NPSSurvey';

function HomePage() {
  const surveyRef = useRef<any>(null);
  const user = useAuth();

  const showSurvey = () => {
    // Note: NPSSurvey manages visibility via state
    // You might want to create a ref-based API for this
  };

  return (
    <div>
      <button onClick={showSurvey}>Give Feedback</button>
      <NPSSurvey ref={surveyRef} userId={user.id} userType={user.type} />
    </div>
  );
}

// ============================================
// 3. ADMIN DASHBOARD INTEGRATION (React)
// ============================================

import React from 'react';
import NPSDashboard from './components/Admin/NPSDashboard';
import { useAuth } from './hooks/useAuth';

function AdminPage() {
  const { user } = useAuth();

  // Only show to admins
  if (user?.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  return (
    <div className="admin-panel">
      <h1>Admin Dashboard</h1>

      {/* NPS Dashboard Component */}
      <NPSDashboard />
    </div>
  );
}

// ============================================
// 4. API USAGE EXAMPLES
// ============================================

// Submit NPS Survey
async function submitNPSSurvey(
  userId: string,
  score: number,
  comment: string,
  tags: string[]
) {
  const response = await fetch('/api/nps/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    },
    body: JSON.stringify({
      userId,
      userType: 'client', // or 'provider', 'admin'
      score,
      followUpComment: comment,
      tags,
    }),
  });

  const data = await response.json();
  console.log('Survey submitted:', data);
  return data;
}

// Check if user is eligible for survey
async function checkSurveyEligibility(userId: string) {
  const response = await fetch(
    `/api/nps/check-eligibility?userId=${userId}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      },
    }
  );

  const data = await response.json();
  console.log('Eligible for survey:', data.isEligible);
  return data.isEligible;
}

// Get NPS trends
async function getNPSTrends(period: 'daily' | 'weekly' | 'monthly') {
  const response = await fetch(`/api/nps/trends/${period}?limit=12`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    },
  });

  const data = await response.json();
  console.log(`${period} NPS trends:`, data.trends);
  return data.trends;
}

// Get user survey history
async function getUserSurveyHistory(userId: string) {
  const response = await fetch(
    `/api/nps/user/${userId}/history?limit=12`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      },
    }
  );

  const data = await response.json();
  console.log('User survey history:', data.surveys);
  return data.surveys;
}

// Get admin dashboard (admin only)
async function getNPSDashboard() {
  const response = await fetch('/api/nps/admin/dashboard', {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('authToken')}`,
    },
  });

  const data = await response.json();
  console.log('NPS Dashboard:', data);
  return data;
}

// Export NPS data
async function exportNPSData(
  startDate: string,
  endDate: string,
  format: 'json' | 'csv' = 'json'
) {
  const response = await fetch(
    `/api/nps/admin/export?startDate=${startDate}&endDate=${endDate}&format=${format}`,
    {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('authToken')}`,
      },
    }
  );

  if (format === 'csv') {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nps-export.csv';
    a.click();
  } else {
    const data = await response.json();
    console.log('Exported NPS data:', data);
    return data;
  }
}

// ============================================
// 5. CUSTOM CONFIGURATION EXAMPLES
// ============================================

// Customize survey component
function CustomSurveyExample() {
  const handleSurveyComplete = (surveyId: string) => {
    // Send to analytics
    window.gtag?.('event', 'nps_survey_completed', {
      survey_id: surveyId,
    });

    // Show success toast
    console.log('NPS survey completed successfully');
  };

  const handleSurveyDismiss = () => {
    // Track dismissal
    console.log('User dismissed NPS survey');
  };

  return (
    <NPSSurvey
      userId="user-123"
      userType="client"
      autoShow={true}
      onComplete={handleSurveyComplete}
      onDismiss={handleSurveyDismiss}
    />
  );
}

// Create scheduled survey reminder
function SurveyReminderJob() {
  // Run every day at 9 AM
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 9 && now.getMinutes() === 0) {
      // Check and schedule surveys
      console.log('Running NPS survey scheduling...');
      // This happens automatically on the backend
    }
  }, 60000); // Check every minute
}

// Monitor NPS with alerts
async function setupNPSAlerts() {
  const checkNPS = async () => {
    try {
      const dashboard = await getNPSDashboard();

      // Alert if NPS drops below threshold
      if (dashboard.monthlyNPS < 0) {
        console.error('CRITICAL: NPS is negative!', dashboard.monthlyNPS);
        // Send notification to admins
        notifyAdmins({
          title: 'Critical NPS Alert',
          message: `NPS score dropped to ${dashboard.monthlyNPS}`,
        });
      }

      // Alert if too many detractors
      if (dashboard.detractorPercentage > 40) {
        console.warn('WARNING: High detractor rate!', dashboard.detractorPercentage);
        notifyAdmins({
          title: 'High Detractor Rate',
          message: `${dashboard.detractorPercentage}% of users are detractors`,
        });
      }

      // Alert if low response rate
      if (dashboard.responseRate < 20) {
        console.warn('WARNING: Low survey response rate!', dashboard.responseRate);
        notifyAdmins({
          title: 'Low Survey Response Rate',
          message: `Only ${dashboard.responseRate}% of users have responded`,
        });
      }
    } catch (error) {
      console.error('Error checking NPS alerts:', error);
    }
  };

  // Run check every hour
  setInterval(checkNPS, 60 * 60 * 1000);
  // Initial check
  checkNPS();
}

// ============================================
// 6. ANALYTICS INTEGRATION
// ============================================

// Track NPS events to Google Analytics
function trackNPSToAnalytics(surveyId: string, score: number, sentiment: string) {
  if (window.gtag) {
    window.gtag('event', 'nps_survey_submitted', {
      survey_id: surveyId,
      nps_score: score,
      nps_sentiment: sentiment,
      timestamp: new Date().toISOString(),
    });
  }
}

// Track to Mixpanel
function trackNPSToMixpanel(userId: string, score: number, tags: string[]) {
  if (window.mixpanel) {
    window.mixpanel.track('NPS Survey Submitted', {
      user_id: userId,
      nps_score: score,
      feedback_tags: tags,
    });

    // Also update user profile
    window.mixpanel.people.set({
      'Last NPS Score': score,
      'Last NPS Date': new Date().toISOString(),
    });
  }
}

// ============================================
// 7. ERROR HANDLING & RETRY LOGIC
// ============================================

async function submitNPSSurveyWithRetry(
  userId: string,
  score: number,
  comment: string,
  maxRetries: number = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/nps/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId,
          userType: 'client',
          score,
          followUpComment: comment,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        throw new Error('Failed to submit survey after max retries');
      }

      // Wait before retrying (exponential backoff)
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}

// ============================================
// 8. TESTING UTILITIES
// ============================================

// Mock survey submission for testing
async function mockNPSSurveySubmission() {
  const mockData = {
    userId: 'test-user-123',
    userType: 'client',
    score: Math.floor(Math.random() * 11), // 0-10
    followUpComment: 'This is a test feedback comment.',
    tags: ['Easy to use', 'Fast'],
  };

  console.log('Mock survey:', mockData);
  return mockData;
}

// Generate test NPS data
function generateTestNPSData(count: number = 100) {
  const surveys = [];

  for (let i = 0; i < count; i++) {
    surveys.push({
      userId: `user-${i}`,
      userType: ['client', 'provider', 'admin'][Math.floor(Math.random() * 3)],
      score: Math.floor(Math.random() * 11),
      followUpComment: `Test comment ${i}`,
      tags: ['Easy to use', 'Fast'],
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    });
  }

  return surveys;
}

// Export for use in other files
export {
  submitNPSSurvey,
  checkSurveyEligibility,
  getNPSTrends,
  getUserSurveyHistory,
  getNPSDashboard,
  exportNPSData,
  trackNPSToAnalytics,
  trackNPSToMixpanel,
  submitNPSSurveyWithRetry,
  generateTestNPSData,
};
