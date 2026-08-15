import { useState, useCallback, useRef, useEffect } from 'react';

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

interface ChatbotHookState {
  conversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  isMinimized: boolean;
}

// ============================================
// HOOK
// ============================================

export const useChatbot = () => {
  const [state, setState] = useState<ChatbotHookState>({
    conversation: null,
    isLoading: false,
    error: null,
    isOpen: false,
    isMinimized: false,
  });

  const conversationCacheRef = useRef<Map<string, Conversation>>(new Map());
  const messageQueueRef = useRef<Array<{ content: string; timestamp: Date }>>(
    []
  );

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  const createConversation = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/chatbot/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const conversation = await response.json();
      conversationCacheRef.current.set(conversation.id, conversation);

      setState((prev) => ({
        ...prev,
        conversation: {
          ...conversation,
          startedAt: new Date(conversation.startedAt),
          messages: [],
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
    }
  }, []);

  const getConversation = useCallback(async (conversationId: string) => {
    // Check cache first
    if (conversationCacheRef.current.has(conversationId)) {
      setState((prev) => ({
        ...prev,
        conversation: conversationCacheRef.current.get(conversationId) || null,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/chatbot/conversations/${conversationId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }

      const conversation = await response.json();
      conversationCacheRef.current.set(conversationId, conversation);

      setState((prev) => ({
        ...prev,
        conversation: {
          ...conversation,
          startedAt: new Date(conversation.startedAt),
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
    }
  }, []);

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  const sendMessage = useCallback(
    async (content: string) => {
      if (!state.conversation) {
        setState((prev) => ({
          ...prev,
          error: 'No active conversation',
        }));
        return;
      }

      // Add to queue for batching
      messageQueueRef.current.push({
        content,
        timestamp: new Date(),
      });

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/chatbot/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: state.conversation.id,
            content,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const botMessage = await response.json();

        setState((prev) => {
          if (!prev.conversation) return prev;

          const updatedConversation: Conversation = {
            ...prev.conversation,
            messages: [...prev.conversation.messages, botMessage],
            isEscalated:
              botMessage.metadata?.shouldEscalate || prev.conversation.isEscalated,
          };

          conversationCacheRef.current.set(
            updatedConversation.id,
            updatedConversation
          );

          return {
            ...prev,
            conversation: updatedConversation,
            isLoading: false,
          };
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An error occurred';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
      }
    },
    [state.conversation]
  );

  // ============================================
  // ESCALATION
  // ============================================

  const escalate = useCallback(
    async (reason: string) => {
      if (!state.conversation) {
        setState((prev) => ({
          ...prev,
          error: 'No active conversation',
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/chatbot/escalate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: state.conversation.id,
            reason,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to escalate conversation');
        }

        const escalatedConversation = await response.json();
        conversationCacheRef.current.set(
          escalatedConversation.id,
          escalatedConversation
        );

        setState((prev) => ({
          ...prev,
          conversation: escalatedConversation,
          isLoading: false,
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An error occurred';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
      }
    },
    [state.conversation]
  );

  // ============================================
  // SATISFACTION & FEEDBACK
  // ============================================

  const submitRating = useCallback(
    async (rating: number, feedback?: string) => {
      if (!state.conversation) {
        setState((prev) => ({
          ...prev,
          error: 'No active conversation',
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/chatbot/satisfaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: state.conversation.id,
            rating,
            feedback,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to submit rating');
        }

        setState((prev) => {
          if (!prev.conversation) return prev;

          const updatedConversation: Conversation = {
            ...prev.conversation,
            userSatisfaction: rating,
            status: 'resolved',
          };

          conversationCacheRef.current.set(
            updatedConversation.id,
            updatedConversation
          );

          return {
            ...prev,
            conversation: updatedConversation,
            isLoading: false,
          };
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An error occurred';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
      }
    },
    [state.conversation]
  );

  const closeConversation = useCallback(
    async (resolution?: string) => {
      if (!state.conversation) {
        setState((prev) => ({
          ...prev,
          error: 'No active conversation',
        }));
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch('/api/chatbot/close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: state.conversation.id,
            resolution,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to close conversation');
        }

        setState((prev) => ({
          ...prev,
          conversation: prev.conversation
            ? {
                ...prev.conversation,
                status: 'closed',
              }
            : null,
          isLoading: false,
        }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'An error occurred';
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
      }
    },
    [state.conversation]
  );

  // ============================================
  // UI STATE
  // ============================================

  const open = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
    if (!state.conversation) {
      createConversation();
    }
  }, [state.conversation, createConversation]);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const toggle = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
    if (!state.conversation && !state.isOpen) {
      createConversation();
    }
  }, [state.conversation, state.isOpen, createConversation]);

  const minimize = useCallback(() => {
    setState((prev) => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  // ============================================
  // ANALYTICS
  // ============================================

  const searchKnowledgeBase = useCallback(
    async (query: string, limit: number = 5) => {
      try {
        const response = await fetch(
          `/api/chatbot/kb/search?q=${encodeURIComponent(query)}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error('Failed to search knowledge base');
        }

        return await response.json();
      } catch (error) {
        console.error('Error searching knowledge base:', error);
        return [];
      }
    },
    []
  );

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      // Cleanup message queue on unmount
      messageQueueRef.current = [];
    };
  }, []);

  // ============================================
  // PUBLIC API
  // ============================================

  return {
    // State
    conversation: state.conversation,
    isLoading: state.isLoading,
    error: state.error,
    isOpen: state.isOpen,
    isMinimized: state.isMinimized,

    // Conversation Management
    createConversation,
    getConversation,

    // Message Handling
    sendMessage,

    // Escalation
    escalate,

    // Feedback
    submitRating,
    closeConversation,

    // UI Control
    open,
    close,
    toggle,
    minimize,

    // Knowledge Base
    searchKnowledgeBase,

    // Utilities
    clearError: () => setState((prev) => ({ ...prev, error: null })),
  };
};

export default useChatbot;
