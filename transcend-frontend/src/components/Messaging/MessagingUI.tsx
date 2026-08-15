// MessagingUI Component
// Real-time messaging between client and provider

import React, { useState, useEffect, useRef } from 'react';
import './MessagingUI.css';

interface Message {
  id: number;
  senderId: number;
  senderName: string;
  senderType: 'client' | 'provider';
  messageBody: string;
  messageType: 'text' | 'file' | 'image';
  fileUrl?: string;
  fileName?: string;
  isRead: boolean;
  createdAt: Date;
}

interface MessagingUIProps {
  hireAgreementId: number;
  currentUserId: number;
  currentUserType: 'client' | 'provider';
  currentUserName: string;
  otherUserName: string;
  className?: string;
}

export const MessagingUI: React.FC<MessagingUIProps> = ({
  hireAgreementId,
  currentUserId,
  currentUserType,
  currentUserName,
  otherUserName,
  className = '',
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [hireAgreementId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await fetch(
        `/api/v2/messages/conversation/${hireAgreementId}`
      );
      const data = await response.json();

      if (data.success) {
        setMessages(data.data);
        // Mark as read
        markConversationRead();
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markConversationRead = async () => {
    try {
      await fetch(
        `/api/v2/messages/conversation/${hireAgreementId}/read-all`,
        { method: 'PATCH' }
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() && !selectedFile) return;

    setSending(true);

    try {
      if (selectedFile) {
        // Upload file
        const formData = new FormData();
        formData.append('hire_agreement_id', hireAgreementId.toString());
        formData.append('sender_id', currentUserId.toString());
        formData.append('sender_type', currentUserType);
        formData.append('file', selectedFile);

        const response = await fetch('/api/v2/messages/send-file', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          setSelectedFile(null);
          fetchMessages();
        }
      } else if (inputValue.trim()) {
        // Send text message
        const response = await fetch('/api/v2/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hire_agreement_id: hireAgreementId,
            sender_id: currentUserId,
            sender_type: currentUserType,
            message_body: inputValue,
          }),
        });

        if (response.ok) {
          setInputValue('');
          fetchMessages();
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        // 10MB limit
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredMessages = messages.filter((m) =>
    m.messageBody.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (date: Date) => {
    const now = new Date();
    const msgDate = new Date(date);

    if (msgDate.toDateString() === now.toDateString()) {
      return msgDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return msgDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className={`messaging-ui ${className}`}>
        <div className="messaging-loading">Loading messages...</div>
      </div>
    );
  }

  return (
    <div className={`messaging-ui ${className}`}>
      {/* Header */}
      <div className="messaging-header">
        <div className="header-content">
          <h2 className="header-title">💬 Messages</h2>
          <p className="header-subtitle">with {otherUserName}</p>
        </div>
        <button
          className="search-toggle"
          onClick={() => setShowSearch(!showSearch)}
          title="Search messages"
        >
          🔍
        </button>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button
            className="search-close"
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Messages Container */}
      <div className="messages-container">
        {filteredMessages.length === 0 ? (
          <div className="messages-empty">
            <p className="empty-icon">💭</p>
            <p className="empty-text">
              {searchQuery
                ? 'No messages match your search'
                : 'No messages yet. Start the conversation!'}
            </p>
          </div>
        ) : (
          <div className="messages-list">
            {filteredMessages.map((message, index) => {
              const isCurrentUser = message.senderId === currentUserId;
              const showAvatar =
                index === 0 ||
                filteredMessages[index - 1].senderId !== message.senderId;

              return (
                <div
                  key={message.id}
                  className={`message-group ${
                    isCurrentUser ? 'current-user' : 'other-user'
                  }`}
                >
                  {showAvatar && (
                    <div className="message-avatar">
                      {message.senderType === 'client' ? '👤' : '💼'}
                    </div>
                  )}
                  <div className="message-content">
                    <div className={`message-bubble ${message.messageType}`}>
                      {message.messageType === 'text' && (
                        <p className="message-text">{message.messageBody}</p>
                      )}
                      {message.messageType === 'file' && (
                        <a href={message.fileUrl} className="file-link">
                          📎 {message.fileName}
                        </a>
                      )}
                      {message.messageType === 'image' && (
                        <img
                          src={message.fileUrl}
                          alt="Shared"
                          className="message-image"
                        />
                      )}
                    </div>
                    <div className="message-meta">
                      <span className="message-time">
                        {formatDate(message.createdAt)}
                      </span>
                      {isCurrentUser && message.isRead && (
                        <span className="read-status">✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <form className="messaging-input-form" onSubmit={handleSendMessage}>
        {selectedFile && (
          <div className="file-preview">
            <span className="file-icon">📎</span>
            <span className="file-name">{selectedFile.name}</span>
            <button
              type="button"
              className="file-remove"
              onClick={() => setSelectedFile(null)}
            >
              ✕
            </button>
          </div>
        )}

        <div className="input-row">
          <input
            type="text"
            className="message-input"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={sending}
          />

          <label className="file-upload-btn" title="Attach file">
            <input
              type="file"
              onChange={handleFileSelect}
              disabled={sending}
              style={{ display: 'none' }}
            />
            📎
          </label>

          <button
            type="submit"
            className="send-btn"
            disabled={
              sending || (!inputValue.trim() && !selectedFile)
            }
            title="Send message"
          >
            {sending ? '⏳' : '➤'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessagingUI;
