import React, { useState } from 'react';
import './Messages.css';

interface Conversation {
  id: string;
  providerName: string;
  providerService: string;
  lastMessage: string;
  lastMessageTime: string;
  contactInfo?: { phone?: string; email?: string };
  messages: Array<{
    id: string;
    sender: 'client' | 'provider';
    text: string;
    timestamp: string;
  }>;
}

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    providerName: 'Sarah Johnson, Esq.',
    providerService: 'Family Law',
    lastMessage: 'I can help with your custody case. Let me share my contact info.',
    lastMessageTime: '2m ago',
    contactInfo: { phone: '(555) 123-4567', email: 'sarah@lawfirm.com' },
    messages: [
      { id: '1', sender: 'provider', text: 'Hi! I received your intake form for Family Law services.', timestamp: '10m ago' },
      { id: '2', sender: 'provider', text: 'I can help with your custody case. Let me share my contact info.', timestamp: '2m ago' },
      { id: '3', sender: 'provider', text: '📞 Phone: (555) 123-4567\n📧 Email: sarah@lawfirm.com', timestamp: '2m ago' },
    ],
  },
  {
    id: '2',
    providerName: 'James Miller, Esq.',
    providerService: 'Personal Injury',
    lastMessage: 'Happy to discuss your case further.',
    lastMessageTime: '1h ago',
    contactInfo: { phone: '(555) 987-6543', email: 'james@injurylaw.com' },
    messages: [
      { id: '1', sender: 'provider', text: 'I reviewed your intake form. This looks like a strong case.', timestamp: '1h ago' },
      { id: '2', sender: 'provider', text: 'Happy to discuss your case further.', timestamp: '1h ago' },
    ],
  },
];

export const Messages: React.FC = () => {
  const [selectedId, setSelectedId] = useState('1');
  const [messageText, setMessageText] = useState('');
  const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);

  const selected = conversations.find(c => c.id === selectedId);

  const handleSendMessage = () => {
    if (!messageText.trim() || !selected) return;

    const newMessage = {
      id: `msg-${Date.now()}`,
      sender: 'client' as const,
      text: messageText,
      timestamp: 'now',
    };

    setConversations(convs =>
      convs.map(c =>
        c.id === selectedId
          ? { ...c, messages: [...c.messages, newMessage], lastMessage: messageText, lastMessageTime: 'now' }
          : c
      )
    );

    setMessageText('');
  };

  return (
    <div className="messages-container">
      <div className="conversations-list">
        <h2>Messages</h2>
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`conversation-item ${selectedId === conv.id ? 'active' : ''}`}
            onClick={() => setSelectedId(conv.id)}
          >
            <div className="conv-header">
              <div className="conv-name">{conv.providerName}</div>
              <div className="conv-time">{conv.lastMessageTime}</div>
            </div>
            <div className="conv-service">{conv.providerService}</div>
            <div className="conv-preview">{conv.lastMessage}</div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="message-thread">
          <div className="thread-header">
            <div>
              <h2>{selected.providerName}</h2>
              <p>{selected.providerService}</p>
            </div>
            {selected.contactInfo && (
              <div className="contact-info">
                {selected.contactInfo.phone && <div>📞 {selected.contactInfo.phone}</div>}
                {selected.contactInfo.email && <div>📧 {selected.contactInfo.email}</div>}
              </div>
            )}
          </div>

          <div className="messages-list">
            {selected.messages.map(msg => (
              <div key={msg.id} className={`message ${msg.sender}`}>
                <div className="message-content">{msg.text}</div>
                <div className="message-time">{msg.timestamp}</div>
              </div>
            ))}
          </div>

          <div className="message-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage} disabled={!messageText.trim()}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messages;
