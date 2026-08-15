/**
 * Provider-to-Provider (P2P) Messaging Component
 * Attorney-to-attorney messaging for referrals, sub-contracting, and dispute resolution
 * Features: Real-time messaging, file attachments, referral tracking, negotiation context
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ProviderMessaging.css';

// ============================================
// TYPES & INTERFACES
// ============================================

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  messageType: 'referral' | 'subcontract' | 'dispute' | 'general' | 'negotiation';
  content: string;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }>;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Conversation {
  id: string;
  attorneyId1: string;
  attorneyId2: string;
  attorney1Name: string;
  attorney2Name: string;
  status: 'active' | 'archived' | 'resolved' | 'disputed';
  subject: string;
  messageType: 'referral' | 'subcontract' | 'dispute' | 'general' | 'negotiation';
  messageCount: number;
  unreadCount: number;
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
  referralId?: string;
  subcontractId?: string;
  disputeId?: string;
}

interface Referral {
  id: string;
  conversationId: string;
  referrerId: string;
  referredAttorneyId: string;
  referralFee?: number;
  feePercentage?: number;
  status: 'pending' | 'accepted' | 'completed' | 'declined';
  caseId: string;
  notes?: string;
}

interface Subcontract {
  id: string;
  conversationId: string;
  principalAttorneyId: string;
  subcontractorId: string;
  serviceScope: string;
  proposedRate: number;
  estimatedHours?: number;
  status: 'proposal' | 'counter_offer' | 'accepted' | 'rejected' | 'completed';
  caseId: string;
  timeline?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ProviderMessagingProps {
  currentUserId: string;
  currentUserName: string;
  onSendMessage?: (message: Message) => void;
}

export const ProviderMessaging: React.FC<ProviderMessagingProps> = ({
  currentUserId,
  currentUserName,
  onSendMessage,
}) => {
  // State management
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [selectedMessageType, setSelectedMessageType] = useState<Message['messageType']>('general');
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showReferralForm, setShowReferralForm] = useState(false);
  const [showSubcontractForm, setShowSubcontractForm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [conversationSubject, setConversationSubject] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'disputed' | 'resolved'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalConversations: 0,
    unreadMessages: 0,
    activeReferrals: 0,
    activeSubcontracts: 0,
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ============================================
  // API CALLS
  // ============================================

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/p2p/conversations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setConversations(data);
      setLoading(false);

      // Update stats
      const stats = {
        totalConversations: data.length,
        unreadMessages: data.reduce((sum: number, conv: Conversation) => sum + conv.unreadCount, 0),
        activeReferrals: 0,
        activeSubcontracts: 0,
      };
      setStats(stats);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/p2p/conversations/${conversationId}/messages`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedConversation || !messageText.trim()) {
      return;
    }

    try {
      // Upload attachments if any
      const uploadedAttachments = [];
      for (const file of attachments) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/p2p/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData,
        });

        const uploadedFile = await uploadResponse.json();
        uploadedAttachments.push(uploadedFile);
      }

      // Send message
      const response = await fetch(`/api/p2p/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          content: messageText,
          messageType: selectedMessageType,
          attachments: uploadedAttachments,
        }),
      });

      const newMessage = await response.json();
      setMessages([...messages, newMessage]);
      setMessageText('');
      setAttachments([]);
      onSendMessage?.(newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientId || !conversationSubject) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/p2p/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          recipientId,
          subject: conversationSubject,
          messageType: selectedMessageType,
        }),
      });

      const newConversation = await response.json();
      setConversations([newConversation, ...conversations]);
      setSelectedConversation(newConversation);
      setShowNewConversation(false);
      setRecipientId('');
      setConversationSubject('');
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedConversation) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const referralData = {
      conversationId: selectedConversation.id,
      fee: formData.get('fee') ? parseFloat(formData.get('fee') as string) : undefined,
      feePercentage: formData.get('feePercentage')
        ? parseFloat(formData.get('feePercentage') as string)
        : undefined,
      notes: formData.get('notes'),
    };

    try {
      const response = await fetch('/api/p2p/referrals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(referralData),
      });

      const referral = await response.json();
      console.log('Referral created:', referral);
      setShowReferralForm(false);
      (e.currentTarget as HTMLFormElement).reset();

      // Add system message
      const systemMessage: Message = {
        id: Math.random().toString(),
        conversationId: selectedConversation.id,
        senderId: currentUserId,
        senderName: currentUserName,
        recipientId: selectedConversation.attorneyId1 === currentUserId ? selectedConversation.attorneyId2 : selectedConversation.attorneyId1,
        messageType: 'referral',
        content: `Created a referral with terms: ${referralData.feePercentage ? `${referralData.feePercentage}%` : `$${referralData.fee}`} ${referralData.notes ? `- ${referralData.notes}` : ''}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setMessages([...messages, systemMessage]);
    } catch (error) {
      console.error('Error creating referral:', error);
    }
  };

  const handleCreateSubcontract = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedConversation) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const subcontractData = {
      conversationId: selectedConversation.id,
      serviceScope: formData.get('serviceScope'),
      proposedRate: parseFloat(formData.get('proposedRate') as string),
      estimatedHours: formData.get('estimatedHours')
        ? parseInt(formData.get('estimatedHours') as string)
        : undefined,
      timeline: formData.get('timeline'),
    };

    try {
      const response = await fetch('/api/p2p/subcontracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(subcontractData),
      });

      const subcontract = await response.json();
      console.log('Subcontract created:', subcontract);
      setShowSubcontractForm(false);
      (e.currentTarget as HTMLFormElement).reset();

      // Add system message
      const systemMessage: Message = {
        id: Math.random().toString(),
        conversationId: selectedConversation.id,
        senderId: currentUserId,
        senderName: currentUserName,
        recipientId: selectedConversation.attorneyId1 === currentUserId ? selectedConversation.attorneyId2 : selectedConversation.attorneyId1,
        messageType: 'subcontract',
        content: `Proposed subcontract: ${subcontractData.serviceScope} @ $${subcontractData.proposedRate}/hr${subcontractData.timeline ? ` - Timeline: ${subcontractData.timeline}` : ''}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setMessages([...messages, systemMessage]);
    } catch (error) {
      console.error('Error creating subcontract:', error);
    }
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedConversation) return;

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const disputeData = {
      conversationId: selectedConversation.id,
      disputeReason: formData.get('disputeReason'),
    };

    try {
      const response = await fetch('/api/p2p/disputes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(disputeData),
      });

      const dispute = await response.json();
      console.log('Dispute created:', dispute);
      setShowDisputeForm(false);
      (e.currentTarget as HTMLFormElement).reset();

      // Update conversation status
      if (selectedConversation) {
        setSelectedConversation({
          ...selectedConversation,
          status: 'disputed',
        });
      }
    } catch (error) {
      console.error('Error creating dispute:', error);
    }
  };

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleArchiveConversation = async () => {
    if (!selectedConversation) return;

    try {
      await fetch(`/api/p2p/conversations/${selectedConversation.id}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      setConversations(conversations.filter(c => c.id !== selectedConversation.id));
      setSelectedConversation(null);
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  // ============================================
  // FILTERING & SEARCH
  // ============================================

  const filteredConversations = conversations.filter(conv => {
    const matchesStatus = filterStatus === 'all' || conv.status === filterStatus;
    const matchesSearch =
      searchTerm === '' ||
      conv.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.attorney1Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conv.attorney2Name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return d.toLocaleDateString();
    }
  };

  const getMessageTypeIcon = (type: Message['messageType']) => {
    switch (type) {
      case 'referral':
        return '📞';
      case 'subcontract':
        return '📋';
      case 'dispute':
        return '⚠️';
      case 'negotiation':
        return '💼';
      default:
        return '💬';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'disputed':
        return 'status-disputed';
      case 'resolved':
        return 'status-resolved';
      case 'archived':
        return 'status-archived';
      default:
        return '';
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="provider-messaging-container">
        <div className="loading">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="provider-messaging-container">
      {/* Sidebar */}
      <div className="messaging-sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <h2>Provider Messages</h2>
          <button className="new-conversation-btn" onClick={() => setShowNewConversation(true)}>
            ➕ New
          </button>
        </div>

        {/* Stats */}
        <div className="messaging-stats">
          <div className="stat-item">
            <span className="stat-number">{stats.totalConversations}</span>
            <span className="stat-label">Conversations</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.unreadMessages}</span>
            <span className="stat-label">Unread</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{stats.activeReferrals}</span>
            <span className="stat-label">Referrals</span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="sidebar-controls">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <div className="filter-tabs">
            {(['all', 'active', 'disputed', 'resolved'] as const).map(status => (
              <button
                key={status}
                className={`filter-tab ${filterStatus === status ? 'active' : ''}`}
                onClick={() => setFilterStatus(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div className="conversations-list">
          {filteredConversations.length === 0 ? (
            <div className="empty-state">
              <p>No conversations found</p>
              <button onClick={() => setShowNewConversation(true)} className="primary-btn">
                Start Conversation
              </button>
            </div>
          ) : (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${selectedConversation?.id === conv.id ? 'selected' : ''}`}
                onClick={() => setSelectedConversation(conv)}
              >
                <div className="conversation-header">
                  <div className="conversation-names">
                    <h4>{conv.attorney1Name === currentUserName ? conv.attorney2Name : conv.attorney1Name}</h4>
                    <span className={`status-badge ${getStatusColor(conv.status)}`}>{conv.status}</span>
                  </div>
                  <span className="message-type-icon">{getMessageTypeIcon(conv.messageType)}</span>
                </div>
                <p className="conversation-subject">{conv.subject}</p>
                {conv.lastMessage && <p className="last-message">{conv.lastMessage.content.substring(0, 50)}...</p>}
                <div className="conversation-meta">
                  {conv.lastMessage && <time>{formatDate(conv.lastMessage.createdAt)}</time>}
                  {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="messaging-main">
        {selectedConversation ? (
          <>
            {/* Conversation Header */}
            <div className="conversation-header-bar">
              <div className="header-info">
                <h3>{selectedConversation.subject}</h3>
                <p>
                  {selectedConversation.attorney1Name === currentUserName
                    ? selectedConversation.attorney2Name
                    : selectedConversation.attorney1Name}
                </p>
              </div>
              <div className="header-actions">
                <span className={`status-badge ${getStatusColor(selectedConversation.status)}`}>
                  {selectedConversation.status}
                </span>
                <button className="action-btn" title="Mark as read">
                  ✓
                </button>
                <button
                  className="action-btn"
                  title="Archive"
                  onClick={handleArchiveConversation}
                >
                  📦
                </button>
                <button className="action-btn" title="Options">
                  ⋯
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="messages-area">
              {messages.length === 0 ? (
                <div className="empty-messages">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`message ${msg.senderId === currentUserId ? 'sent' : 'received'}`}
                  >
                    <div className="message-badge">{getMessageTypeIcon(msg.messageType)}</div>
                    <div className="message-content">
                      <div className="message-header">
                        <strong>{msg.senderName}</strong>
                        <time>{formatTime(msg.createdAt)}</time>
                      </div>
                      <p>{msg.content}</p>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="attachments">
                          {msg.attachments.map(att => (
                            <a key={att.id} href={att.fileUrl} className="attachment" target="_blank" rel="noopener noreferrer">
                              📎 {att.fileName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Action Buttons */}
            {selectedConversation.status === 'active' && (
              <div className="action-buttons">
                <button
                  className="action-btn-large"
                  onClick={() => setShowReferralForm(!showReferralForm)}
                >
                  📞 Send Referral
                </button>
                <button
                  className="action-btn-large"
                  onClick={() => setShowSubcontractForm(!showSubcontractForm)}
                >
                  📋 Propose Subcontract
                </button>
                <button
                  className="action-btn-large warning"
                  onClick={() => setShowDisputeForm(!showDisputeForm)}
                >
                  ⚠️ Report Dispute
                </button>
              </div>
            )}

            {/* Referral Form */}
            {showReferralForm && (
              <form onSubmit={handleCreateReferral} className="form-panel referral-form">
                <h4>Send Referral</h4>
                <div className="form-group">
                  <label>Fee Type</label>
                  <div className="radio-group">
                    <label>
                      <input type="radio" name="feeType" value="fixed" defaultChecked />
                      Fixed Amount
                    </label>
                    <label>
                      <input type="radio" name="feeType" value="percentage" />
                      Percentage
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label>Fee</label>
                  <input type="number" name="fee" placeholder="Amount" step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label>Fee Percentage</label>
                  <input type="number" name="feePercentage" placeholder="%" step="0.1" min="0" max="100" />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea name="notes" placeholder="Additional notes about this referral..." rows={3} />
                </div>
                <div className="form-actions">
                  <button type="submit" className="primary-btn">
                    Send Referral
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => setShowReferralForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Subcontract Form */}
            {showSubcontractForm && (
              <form onSubmit={handleCreateSubcontract} className="form-panel subcontract-form">
                <h4>Propose Subcontract</h4>
                <div className="form-group">
                  <label>Service Scope *</label>
                  <input type="text" name="serviceScope" placeholder="Describe the work needed" required />
                </div>
                <div className="form-group">
                  <label>Proposed Rate ($/hr) *</label>
                  <input type="number" name="proposedRate" placeholder="0.00" step="0.01" min="0" required />
                </div>
                <div className="form-group">
                  <label>Estimated Hours</label>
                  <input type="number" name="estimatedHours" placeholder="0" min="0" />
                </div>
                <div className="form-group">
                  <label>Timeline</label>
                  <input type="text" name="timeline" placeholder="e.g., 2 weeks" />
                </div>
                <div className="form-actions">
                  <button type="submit" className="primary-btn">
                    Send Proposal
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => setShowSubcontractForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Dispute Form */}
            {showDisputeForm && (
              <form onSubmit={handleCreateDispute} className="form-panel dispute-form">
                <h4>Report Dispute</h4>
                <div className="form-group">
                  <label>Dispute Reason *</label>
                  <textarea
                    name="disputeReason"
                    placeholder="Describe the issue in detail..."
                    rows={5}
                    required
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="primary-btn warning">
                    Report Dispute
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => setShowDisputeForm(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="message-input-form">
              <div className="input-row">
                <select value={selectedMessageType} onChange={e => setSelectedMessageType(e.target.value as Message['messageType'])} className="message-type-select">
                  <option value="general">💬 General</option>
                  <option value="referral">📞 Referral</option>
                  <option value="subcontract">📋 Subcontract</option>
                  <option value="negotiation">💼 Negotiation</option>
                  <option value="dispute">⚠️ Dispute</option>
                </select>
              </div>

              {attachments.length > 0 && (
                <div className="attachments-preview">
                  {attachments.map((file, idx) => (
                    <div key={idx} className="attachment-chip">
                      <span>{file.name}</span>
                      <button type="button" onClick={() => handleRemoveAttachment(idx)}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="input-controls">
                <button
                  type="button"
                  className="control-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                >
                  📎
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>

              <textarea
                className="message-input"
                placeholder="Type your message..."
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                onKeyPress={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
              />

              <button type="submit" className="send-btn" disabled={!messageText.trim()}>
                Send Message
              </button>
            </form>
          </>
        ) : showNewConversation ? (
          <div className="new-conversation-panel">
            <h2>Start New Conversation</h2>
            <form onSubmit={handleCreateConversation} className="new-conversation-form">
              <div className="form-group">
                <label>Recipient Attorney ID *</label>
                <input
                  type="text"
                  value={recipientId}
                  onChange={e => setRecipientId(e.target.value)}
                  placeholder="Enter attorney ID"
                  required
                />
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <input
                  type="text"
                  value={conversationSubject}
                  onChange={e => setConversationSubject(e.target.value)}
                  placeholder="Conversation subject"
                  required
                />
              </div>
              <div className="form-group">
                <label>Message Type</label>
                <select value={selectedMessageType} onChange={e => setSelectedMessageType(e.target.value as Message['messageType'])}>
                  <option value="general">General Inquiry</option>
                  <option value="referral">Referral</option>
                  <option value="subcontract">Subcontract Proposal</option>
                  <option value="negotiation">Negotiation</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-btn">
                  Start Conversation
                </button>
                <button type="button" className="secondary-btn" onClick={() => setShowNewConversation(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="empty-state-main">
            <div className="empty-icon">💬</div>
            <h3>No Conversation Selected</h3>
            <p>Select a conversation from the list or start a new one</p>
            <button className="primary-btn" onClick={() => setShowNewConversation(true)}>
              Start Conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderMessaging;
