// Messaging System
// Real-time messaging between clients and attorneys

import React, { useState } from 'react';
import './Messaging.css';

interface Message {
  id: string;
  sender: string;
  senderRole: 'attorney' | 'client';
  content: string;
  timestamp: Date;
  read: boolean;
  attachments?: Array<{ id: string; name: string; type: string }>;
}

interface Conversation {
  id: string;
  participant: string;
  participantRole: 'attorney' | 'client';
  avatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  status: 'online' | 'offline';
}

interface MessagingProps {
  conversations?: Conversation[];
  onSendMessage?: (message: string) => void;
}

export const Messaging: React.FC<MessagingProps> = ({ onSendMessage }) => {
  const [selectedConversation, setSelectedConversation] = useState<string>('1');
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'Sarah Johnson',
      senderRole: 'attorney',
      content: 'Hello! I reviewed your case details. I have a few questions.',
      timestamp: new Date(Date.now() - 3600000),
      read: true,
    },
    {
      id: '2',
      sender: 'You',
      senderRole: 'client',
      content: 'Of course! I am available to discuss anytime.',
      timestamp: new Date(Date.now() - 1800000),
      read: true,
    },
    {
      id: '3',
      sender: 'Sarah Johnson',
      senderRole: 'attorney',
      content: 'Great! Can we schedule a call for tomorrow at 2 PM?',
      timestamp: new Date(Date.now() - 600000),
      read: true,
    },
  ]);

  const conversations: Conversation[] = [
    {
      id: '1',
      participant: 'Sarah Johnson, Esq.',
      participantRole: 'attorney',
      avatar: 'S',
      lastMessage: 'Great! Can we schedule a call for tomorrow at 2 PM?',
      lastMessageTime: new Date(Date.now() - 600000),
      unreadCount: 0,
      status: 'online',
    },
    {
      id: '2',
      participant: 'Maria Garcia, Esq.',
      participantRole: 'attorney',
      avatar: 'M',
      lastMessage: 'I can help with this case.',
      lastMessageTime: new Date(Date.now() - 86400000),
      unreadCount: 1,
      status: 'offline',
    },
    {
      id: '3',
      participant: 'Support Team',
      participantRole: 'client',
      avatar: '?',
      lastMessage: 'Your case has been updated.',
      lastMessageTime: new Date(Date.now() - 172800000),
      unreadCount: 0,
      status: 'online',
    },
  ];

  const handleSendMessage = () => {
    if (messageText.trim()) {
      setMessages([
        ...messages,
        {
          id: String(messages.length + 1),
          sender: 'You',
          senderRole: 'client',
          content: messageText,
          timestamp: new Date(),
          read: true,
        },
      ]);
      onSendMessage?.(messageText);
      setMessageText('');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div className="messaging-container">
      {/* Conversations List */}
      <div className="conversations-panel">
        <div className="conversations-header">
          <h2>Messages</h2>
          <button className="new-message-btn" title="New message">
            ✏️
          </button>
        </div>

        <div className="conversations-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${selectedConversation === conv.id ? 'active' : ''}`}
              onClick={() => setSelectedConversation(conv.id)}
            >
              <div className="avatar">
                <span>{conv.avatar}</span>
                <span className={`status-dot ${conv.status}`}></span>
              </div>
              <div className="conversation-info">
                <h4>{conv.participant}</h4>
                <p>{conv.lastMessage}</p>
              </div>
              <div className="conversation-meta">
                <time>{formatDate(conv.lastMessageTime)}</time>
                {conv.unreadCount > 0 && (
                  <span className="unread-badge">{conv.unreadCount}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Thread */}
      <div className="message-thread">
        {/* Thread Header */}
        <div className="thread-header">
          <div className="thread-participant">
            <div className="avatar-large">S</div>
            <div>
              <h3>Sarah Johnson, Esq.</h3>
              <p>Employment Law Specialist</p>
            </div>
          </div>
          <div className="thread-actions">
            <button className="action-btn" title="Call">
              ☎️
            </button>
            <button className="action-btn" title="Video call">
              📹
            </button>
            <button className="action-btn" title="Info">
              ℹ️
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="messages-area">
          {messages.map(msg => (
            <div key={msg.id} className={`message ${msg.senderRole}`}>
              <div className="message-content">
                <p>{msg.content}</p>
              </div>
              <time>{formatTime(msg.timestamp)}</time>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="message-input-area">
          <div className="input-controls">
            <button className="control-btn" title="Attach file">
              📎
            </button>
          </div>
          <textarea
            className="message-input"
            placeholder="Type your message..."
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyPress={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            title="Send"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Messaging;
