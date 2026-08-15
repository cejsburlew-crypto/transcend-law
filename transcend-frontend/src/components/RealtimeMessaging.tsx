// Real-Time Messaging Component
// Socket.io powered live chat with typing indicators

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { StatusIndicator, Toast } from '@/components/UI';
import './RealtimeMessaging.css';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  read: boolean;
}

interface RealtimeMessagingProps {
  conversationId: string;
  currentUserId: string;
  otherUserName: string;
  otherUserId: string;
  token: string;
}

export const RealtimeMessaging: React.FC<RealtimeMessagingProps> = ({
  conversationId,
  currentUserId,
  otherUserName,
  otherUserId,
  token,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [toast, setToast] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (type: 'success' | 'info', message: string) => {
    setToast({ type, message, duration: 3000, onClose: () => setToast(null) });
  };

  const {
    isConnected,
    joinConversation,
    leaveConversation,
    sendMessage,
    setTyping,
    markMessageAsRead,
    onMessage,
    onUserTyping,
    onUserOnline,
    onUserOffline,
  } = useSocket({ token });

  // Initialize conversation
  useEffect(() => {
    if (isConnected) {
      joinConversation(conversationId);

      // Register message handler
      const unsubscribe = onMessage((message: Message) => {
        setMessages((prev) => [...prev, message]);

        // Mark as read if from other user
        if (message.senderId !== currentUserId) {
          markMessageAsRead(message.id);
          showToast('info', `New message from ${otherUserName}`);
        }
      });

      // Register typing handler
      const unsubscribeTyping = onUserTyping((data: any) => {
        if (data.userId === otherUserId) {
          setIsOtherUserTyping(data.typing !== false);
          clearTimeout(typingTimeout || undefined);

          // Auto-stop typing after 3 seconds
          const timeout = setTimeout(() => {
            setIsOtherUserTyping(false);
          }, 3000);
          setTypingTimeout(timeout);
        }
      });

      // Register online handler
      const unsubscribeOnline = onUserOnline((userId: string) => {
        if (userId === otherUserId) {
          setIsOtherUserOnline(true);
        }
      });

      // Register offline handler
      const unsubscribeOffline = onUserOffline((userId: string) => {
        if (userId === otherUserId) {
          setIsOtherUserOnline(false);
        }
      });

      return () => {
        unsubscribe();
        unsubscribeTyping();
        unsubscribeOnline();
        unsubscribeOffline();
        leaveConversation(conversationId);
        if (typingTimeout) clearTimeout(typingTimeout);
      };
    }
  }, [
    isConnected,
    conversationId,
    currentUserId,
    otherUserId,
    joinConversation,
    leaveConversation,
    onMessage,
    onUserTyping,
    onUserOnline,
    onUserOffline,
    markMessageAsRead,
    typingTimeout,
  ]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || !isConnected) {
      return;
    }

    sendMessage(conversationId, inputValue);
    showToast('success', 'Message sent');
    setInputValue('');
    setTyping(conversationId, false);
  };

  // Handle typing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Send typing indicator
    if (e.target.value.length > 0) {
      setTyping(conversationId, true);
    } else {
      setTyping(conversationId, false);
    }
  };

  return (
    <div className="realtime-messaging">
      {/* Header */}
      <div className="messaging-header">
        <div className="header-content">
          <h2>{otherUserName}</h2>
          <StatusIndicator
            status={isOtherUserOnline ? 'success' : 'pending'}
            label={isOtherUserOnline ? 'Online now' : 'Typically responds within 2 hours'}
          />
        </div>
        <span className="connection-status">
          {isConnected ? '✅ Connected' : '⏳ Connecting...'}
        </span>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>📝 No messages yet</p>
            <p>Start a conversation by sending a message below</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`message ${
                message.senderId === currentUserId ? 'sent' : 'received'
              }`}
            >
              <div className="message-bubble">
                <p>{message.content}</p>
                <span className="message-time">
                  {new Date(message.timestamp).toLocaleTimeString()}
                  {message.read && message.senderId === currentUserId && (
                    <span className="read-receipt">✓✓</span>
                  )}
                </span>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isOtherUserTyping && (
          <div className="message received">
            <div className="message-bubble typing">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="messaging-form" onSubmit={handleSendMessage}>
        <textarea
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type a message..."
          disabled={!isConnected}
          className="message-input"
          rows={3}
        />
        <button
          type="submit"
          disabled={!isConnected || inputValue.trim() === ''}
          className="send-button"
        >
          {isConnected ? '📤 Send' : '⏳ Connecting...'}
        </button>
      </form>

      {/* Connection warning */}
      {!isConnected && (
        <div className="connection-warning">
          🔌 Reconnecting to messaging service...
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
          <Toast {...toast} />
        </div>
      )}
    </div>
  );
};

export default RealtimeMessaging;
