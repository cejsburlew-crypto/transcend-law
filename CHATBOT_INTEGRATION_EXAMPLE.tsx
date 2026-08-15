/**
 * AI Chatbot Integration Example
 *
 * This file demonstrates how to integrate the chatbot into your application
 * in different scenarios and configurations.
 */

// ============================================
// EXAMPLE 1: Simple Component Integration
// ============================================

import React from 'react';
import { Chatbot } from './src/components/Chatbot';

/**
 * Basic App setup - just add Chatbot to your layout
 */
export function AppWithChatbot() {
  return (
    <div className="app">
      <header>Your App Header</header>
      <main>Your App Content</main>
      <Chatbot />
    </div>
  );
}

// ============================================
// EXAMPLE 2: Using Custom Hook
// ============================================

import useChatbot from './src/hooks/useChatbot';

/**
 * Custom implementation with full control using the hook
 */
export function CustomChatbotComponent() {
  const {
    conversation,
    isLoading,
    error,
    isOpen,
    sendMessage,
    escalate,
    submitRating,
    open,
    close,
    searchKnowledgeBase,
  } = useChatbot();

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  const handleEscalate = async () => {
    await escalate('User needs human assistance');
  };

  const handleRating = async (rating: number) => {
    await submitRating(rating, 'Great support!');
  };

  if (!isOpen) {
    return (
      <button onClick={open}>
        Open Support Chat
      </button>
    );
  }

  return (
    <div className="custom-chatbot">
      <h2>Support Chat</h2>

      {error && <div className="error">{error}</div>}

      <div className="messages">
        {conversation?.messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.senderType}`}>
            {msg.content}
          </div>
        ))}
      </div>

      {isLoading && <div className="loading">Bot is typing...</div>}

      <input
        type="text"
        placeholder="Type your message..."
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSendMessage((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).value = '';
          }
        }}
      />

      <button onClick={handleEscalate}>Escalate to Agent</button>
      <button onClick={close}>Close</button>
    </div>
  );
}

// ============================================
// EXAMPLE 3: Context-based Chatbot
// ============================================

import React, { createContext, useContext } from 'react';

interface ChatbotContextType {
  openChatbot: () => void;
  closeChatbot: () => void;
  sendMessage: (message: string) => void;
}

const ChatbotContext = createContext<ChatbotContextType | null>(null);

/**
 * Provider component for app-wide chatbot access
 */
export function ChatbotProvider({ children }: { children: React.ReactNode }) {
  const chatbot = useChatbot();

  const value: ChatbotContextType = {
    openChatbot: chatbot.open,
    closeChatbot: chatbot.close,
    sendMessage: chatbot.sendMessage,
  };

  return (
    <ChatbotContext.Provider value={value}>
      {children}
      <Chatbot />
    </ChatbotContext.Provider>
  );
}

/**
 * Hook to use chatbot context from anywhere in app
 */
export function useChatbotContext() {
  const context = useContext(ChatbotContext);
  if (!context) {
    throw new Error('useChatbotContext must be used within ChatbotProvider');
  }
  return context;
}

// ============================================
// EXAMPLE 4: Page-specific Integration
// ============================================

/**
 * Use chatbot only on specific pages
 */
export function ContactPage() {
  const [showChatbot, setShowChatbot] = React.useState(false);

  return (
    <div className="contact-page">
      <h1>Contact Us</h1>
      <p>Need help? Try our AI chat support first.</p>

      <button onClick={() => setShowChatbot(true)}>
        Start Chat Support
      </button>

      {showChatbot && (
        <div className="chatbot-overlay">
          <Chatbot />
        </div>
      )}
    </div>
  );
}

// ============================================
// EXAMPLE 5: Service-specific Chatbot
// ============================================

/**
 * Pre-populate chatbot with service context
 */
export function ServiceChatbot({ serviceType }: { serviceType: string }) {
  const chatbot = useChatbot();
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (chatbot.isOpen && !initialized) {
      // Send initial context-aware message
      const contextMessage = `I'm here to help with ${serviceType} services. What can I assist you with?`;
      // Store this context in the conversation for the bot to reference
      setInitialized(true);
    }
  }, [chatbot.isOpen, initialized, serviceType]);

  return <Chatbot />;
}

// ============================================
// EXAMPLE 6: Knowledge Base Search Integration
// ============================================

/**
 * Show knowledge base results directly before escalating
 */
export function SmartChatbot() {
  const chatbot = useChatbot();
  const [kbResults, setKbResults] = React.useState<any[]>([]);

  const handleSearch = async (query: string) => {
    const results = await chatbot.searchKnowledgeBase(query);
    setKbResults(results);

    // If good results found, present them first
    if (results.length > 0) {
      const message = `I found these helpful articles:\n${results
        .map((r) => `- ${r.title}`)
        .join('\n')}\n\nWould you like me to explain any of these?`;

      await chatbot.sendMessage(message);
    }
  };

  return (
    <div>
      <Chatbot />
      {kbResults.length > 0 && (
        <div className="kb-results">
          {kbResults.map((result) => (
            <div key={result.id} className="kb-result">
              <h4>{result.title}</h4>
              <p>{result.content.substring(0, 100)}...</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// EXAMPLE 7: Admin Analytics Dashboard
// ============================================

import { useState, useEffect } from 'react';

/**
 * Admin dashboard showing chatbot analytics
 */
export function ChatbotAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        const response = await fetch(
          `/api/chatbot/analytics?startDate=${startDate.toISOString()}&endDate=${new Date().toISOString()}`,
          {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }
        );

        const data = await response.json();
        setAnalytics(data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) return <div>Loading analytics...</div>;
  if (!analytics) return <div>No data available</div>;

  return (
    <div className="analytics-dashboard">
      <h2>Chatbot Analytics</h2>

      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Conversations</h3>
          <p className="metric-value">{analytics.totalConversations}</p>
        </div>

        <div className="metric-card">
          <h3>Resolution Rate</h3>
          <p className="metric-value">{analytics.resolutionRate.toFixed(1)}%</p>
        </div>

        <div className="metric-card">
          <h3>Escalation Rate</h3>
          <p className="metric-value">{analytics.escalationRate.toFixed(1)}%</p>
        </div>

        <div className="metric-card">
          <h3>Avg Satisfaction</h3>
          <p className="metric-value">{analytics.avgUserSatisfaction.toFixed(1)}/5</p>
        </div>
      </div>

      <div className="analytics-section">
        <h3>Top Topics</h3>
        <ul>
          {analytics.topTopics.map((topic: any) => (
            <li key={topic.topic}>
              {topic.topic}: {topic.count} conversations
            </li>
          ))}
        </ul>
      </div>

      <div className="analytics-section">
        <h3>Common Questions</h3>
        <ul>
          {analytics.commonQuestions.map((q: any, i: number) => (
            <li key={i}>
              {q.question} ({q.count} times)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ============================================
// EXAMPLE 8: Conditional Rendering Based on User Type
// ============================================

/**
 * Show different chatbot features based on user role
 */
export function ConditionalChatbot({ userRole }: { userRole: 'user' | 'admin' | 'agent' }) {
  const chatbot = useChatbot();

  return (
    <div>
      <Chatbot />

      {userRole === 'agent' && (
        <div className="agent-controls">
          <h3>Agent Controls</h3>
          <button onClick={() => chatbot.escalate('Assigned to agent')}>
            Take Over Chat
          </button>
        </div>
      )}

      {userRole === 'admin' && (
        <div className="admin-controls">
          <h3>Admin Controls</h3>
          <button onClick={() => window.location.href = '/admin/chatbot-analytics'}>
            View Analytics
          </button>
          <button onClick={() => window.location.href = '/admin/knowledge-base'}>
            Manage Knowledge Base
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXAMPLE 9: Error Boundary with Chatbot Fallback
// ============================================

/**
 * Gracefully handle chatbot errors
 */
export function ChatbotErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);
  const chatbot = useChatbot();

  React.useEffect(() => {
    if (chatbot.error) {
      console.error('Chatbot error:', chatbot.error);
      // Optionally show user-friendly notification
    }
  }, [chatbot.error]);

  return (
    <div>
      {chatbot.error && (
        <div className="error-notification">
          <p>Support chat temporarily unavailable. Please try emailing support@transcend.com</p>
        </div>
      )}
      <Chatbot />
    </div>
  );
}

// ============================================
// EXAMPLE 10: Mobile-responsive Chatbot
// ============================================

/**
 * Responsive chatbot for mobile and desktop
 */
export function ResponsiveChatbot() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`chatbot-wrapper ${isMobile ? 'mobile' : 'desktop'}`}>
      <Chatbot />
    </div>
  );
}

// ============================================
// MAIN APP SETUP RECOMMENDATION
// ============================================

/**
 * Recommended setup for production app
 */
export function ProductionApp() {
  return (
    <ChatbotProvider>
      <div className="app">
        <header>
          <h1>Transcend</h1>
          {/* Your header content */}
        </header>

        <main>
          {/* Your main content */}
        </main>

        <footer>
          {/* Your footer content */}
        </footer>

        {/* Chatbot is automatically included via ChatbotProvider */}
      </div>
    </ChatbotProvider>
  );
}

export default ProductionApp;
