import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';

// ============================================
// TYPES
// ============================================

interface Message {
  id: string;
  conversationId: string;
  senderType: 'user' | 'bot' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    messageType?: string;
  };
}

interface Conversation {
  id: string;
  userId: string;
  startedAt: Date;
  status: 'active' | 'resolved' | 'escalated' | 'closed';
  messages: Message[];
  isEscalated: boolean;
  userSatisfaction?: number;
}

interface ChatbotState {
  isOpen: boolean;
  isMinimized: boolean;
  isLoading: boolean;
  hasUnread: boolean;
  currentConversation: Conversation | null;
}

// ============================================
// CHATBOT COMPONENT
// ============================================

export const Chatbot: React.FC = () => {
  const [state, setState] = useState<ChatbotState>({
    isOpen: false,
    isMinimized: false,
    isLoading: false,
    hasUnread: false,
    currentConversation: null,
  });

  const [messageInput, setMessageInput] = useState('');
  const [showSatisfactionRating, setShowSatisfactionRating] = useState(false);
  const [showEscalationForm, setShowEscalationForm] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    scrollToBottom();
  }, [state.currentConversation?.messages]);

  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isOpen]);

  // ============================================
  // HANDLERS
  // ============================================

  const openChatbot = async () => {
    setState((prev) => ({ ...prev, isOpen: true }));

    if (!state.currentConversation) {
      try {
        const response = await fetch('/api/chatbot/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const conversation = await response.json();
        setState((prev) => ({
          ...prev,
          currentConversation: conversation,
          hasUnread: false,
        }));
      } catch (error) {
        console.error('Error opening chatbot:', error);
      }
    }
  };

  const closeChatbot = () => {
    setState((prev) => ({ ...prev, isOpen: false }));
  };

  const minimizeChatbot = () => {
    setState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!messageInput.trim() || !state.currentConversation) {
      return;
    }

    const userMessage: Message = {
      id: generateId(),
      conversationId: state.currentConversation.id,
      senderType: 'user',
      content: messageInput,
      timestamp: new Date(),
    };

    // Add user message to UI
    setState((prev) => ({
      ...prev,
      currentConversation: prev.currentConversation
        ? {
            ...prev.currentConversation,
            messages: [...prev.currentConversation.messages, userMessage],
          }
        : null,
      isLoading: true,
    }));

    setMessageInput('');

    try {
      // Send message to API
      const response = await fetch('/api/chatbot/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: state.currentConversation.id,
          content: messageInput,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const botMessage = await response.json();

      setState((prev) => {
        if (!prev.currentConversation) return prev;

        const messages = [...prev.currentConversation.messages, botMessage];

        // Check if escalation is needed
        const shouldEscalate = botMessage.metadata?.shouldEscalate;

        return {
          ...prev,
          currentConversation: {
            ...prev.currentConversation,
            messages,
            isEscalated: shouldEscalate || prev.currentConversation.isEscalated,
          },
          isLoading: false,
        };
      });

      // Show escalation notification if needed
      if (botMessage.metadata?.shouldEscalate) {
        setShowEscalationForm(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setState((prev) => ({ ...prev, isLoading: false }));

      // Show error message
      const errorMessage: Message = {
        id: generateId(),
        conversationId: state.currentConversation.id,
        senderType: 'bot',
        content: 'Sorry, I encountered an error. Please try again or escalate to an agent.',
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        currentConversation: prev.currentConversation
          ? {
              ...prev.currentConversation,
              messages: [...prev.currentConversation.messages, errorMessage],
            }
          : null,
      }));
    }
  };

  const escalateToAgent = async () => {
    if (!state.currentConversation) return;

    try {
      const response = await fetch('/api/chatbot/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: state.currentConversation.id,
          reason: escalationReason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to escalate');
      }

      const escalationMessage: Message = {
        id: generateId(),
        conversationId: state.currentConversation.id,
        senderType: 'bot',
        content: 'I\'m connecting you with a human agent. They\'ll be with you shortly.',
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        currentConversation: prev.currentConversation
          ? {
              ...prev.currentConversation,
              messages: [...prev.currentConversation.messages, escalationMessage],
              isEscalated: true,
              status: 'escalated',
            }
          : null,
      }));

      setShowEscalationForm(false);
      setEscalationReason('');
    } catch (error) {
      console.error('Error escalating:', error);
    }
  };

  const submitSatisfactionRating = async (rating: number) => {
    if (!state.currentConversation) return;

    try {
      await fetch('/api/chatbot/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: state.currentConversation.id,
          rating,
        }),
      });

      setState((prev) => ({
        ...prev,
        currentConversation: prev.currentConversation
          ? {
              ...prev.currentConversation,
              userSatisfaction: rating,
              status: 'resolved',
            }
          : null,
      }));

      setShowSatisfactionRating(false);

      // Close chatbot after 2 seconds
      setTimeout(() => {
        setState((prev) => ({ ...prev, isOpen: false }));
      }, 2000);
    } catch (error) {
      console.error('Error submitting rating:', error);
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const renderMessage = (message: Message) => {
    const isUser = message.senderType === 'user';
    const confidence = message.metadata?.confidence;

    return (
      <div key={message.id} className={`chat-message ${isUser ? 'user' : 'bot'}`}>
        <div className="message-content">
          {message.content}
          {confidence && !isUser && (
            <span className="confidence-score">
              Confidence: {Math.round(confidence * 100)}%
            </span>
          )}
        </div>
        <span className="message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    );
  };

  if (!state.isOpen) {
    return (
      <button className="chatbot-trigger" onClick={openChatbot} title="Open Support Chat">
        <span className="chatbot-icon">💬</span>
        {state.hasUnread && <span className="unread-badge">!</span>}
      </button>
    );
  }

  return (
    <div className={`chatbot-container ${state.isMinimized ? 'minimized' : ''}`}>
      <div className="chatbot-header">
        <div className="header-content">
          <h3>Support Assistant</h3>
          {state.currentConversation?.isEscalated && (
            <span className="escalated-badge">Escalated to Agent</span>
          )}
        </div>
        <div className="header-controls">
          <button onClick={minimizeChatbot} className="minimize-btn" title="Minimize">
            {state.isMinimized ? '▲' : '▼'}
          </button>
          <button onClick={closeChatbot} className="close-btn" title="Close">
            ✕
          </button>
        </div>
      </div>

      {!state.isMinimized && (
        <>
          <div className="chatbot-messages">
            {state.currentConversation?.messages.length === 0 && (
              <div className="welcome-message">
                <h4>Hello! 👋</h4>
                <p>How can I help you today?</p>
                <div className="quick-actions">
                  <button onClick={() => setMessageInput('How do I create an account?')}>
                    Account Setup
                  </button>
                  <button onClick={() => setMessageInput('What services do you offer?')}>
                    Our Services
                  </button>
                  <button onClick={() => setMessageInput('How do I contact support?')}>
                    Contact Support
                  </button>
                </div>
              </div>
            )}

            {state.currentConversation?.messages.map(renderMessage)}

            {state.isLoading && (
              <div className="chat-message bot loading">
                <div className="message-content">
                  <span className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </div>
            )}

            {showEscalationForm && !state.currentConversation?.isEscalated && (
              <div className="escalation-form">
                <h4>Need more help?</h4>
                <textarea
                  placeholder="Tell us more about your issue..."
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  rows={3}
                />
                <div className="form-actions">
                  <button onClick={escalateToAgent} className="btn-primary">
                    Connect with Agent
                  </button>
                  <button
                    onClick={() => setShowEscalationForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showSatisfactionRating && (
              <div className="satisfaction-form">
                <h4>How helpful was this?</h4>
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className={`star ${star <= 3 ? 'interactive' : ''}`}
                      onClick={() => submitSatisfactionRating(star)}
                      title={`Rate ${star} stars`}
                    >
                      {star <= 3 ? '☆' : '★'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="chatbot-input-form">
            <input
              ref={inputRef}
              type="text"
              placeholder="Type your message..."
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              disabled={state.isLoading}
            />
            <button type="submit" disabled={state.isLoading || !messageInput.trim()}>
              {state.isLoading ? '...' : 'Send'}
            </button>
          </form>

          {state.currentConversation?.status === 'active' && !showEscalationForm && (
            <div className="chatbot-footer">
              <button
                onClick={() => setShowSatisfactionRating(true)}
                className="btn-small"
              >
                Rate this conversation
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Chatbot;
