import React, { useState, useEffect } from 'react';
import './BroadcastComposer.css';

// ============================================
// TYPES
// ============================================

interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  htmlContent?: string;
  templateId?: string;
  segments: string[];
  targetAudience: 'all_users' | 'segment' | 'custom';
  targetFilters?: {
    lifecycles?: string[];
    valueSegments?: string[];
    engagementLevels?: string[];
    serviceTypes?: string[];
  };
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'multi';
  scheduledFor?: Date;
  sentAt?: Date;
  expiresAt?: Date;
  cta?: {
    text: string;
    url: string;
    action?: string;
  };
  totalRecipients?: number;
  deliveredCount?: number;
  openCount?: number;
  clickCount?: number;
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
}

interface SegmentTarget {
  id: string;
  name: string;
  recipientCount?: number;
}

interface BroadcastAnalytics {
  messageId: string;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  openRate: number;
  clickRate: number;
}

interface BroadcastComposerProps {
  onMessageSend?: (message: BroadcastMessage) => void;
  adminId?: string;
}

// ============================================
// BROADCAST COMPOSER COMPONENT
// ============================================

export const BroadcastComposer: React.FC<BroadcastComposerProps> = ({
  onMessageSend,
  adminId,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'compose' | 'templates' | 'history' | 'analytics'>('compose');
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [segments, setSegments] = useState<SegmentTarget[]>([]);
  const [analytics, setAnalytics] = useState<BroadcastAnalytics[]>([]);
  const [loading, setLoading] = useState(false);

  // Compose form state
  const [formData, setFormData] = useState<Partial<BroadcastMessage>>({
    title: '',
    content: '',
    targetAudience: 'all_users',
    priority: 'medium',
    channel: 'multi',
    status: 'draft',
    cta: { text: '', url: '', action: '' },
  });

  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [recipientPreview, setRecipientPreview] = useState<number>(0);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch messages
      const messagesRes = await fetch('/api/broadcasts/messages');
      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setMessages(data.messages || []);
      }

      // Fetch templates
      const templatesRes = await fetch('/api/broadcasts/templates');
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data || []);
      }

      // Fetch segments
      const segmentsRes = await fetch('/api/broadcasts/segments');
      if (segmentsRes.ok) {
        const data = await segmentsRes.json();
        setSegments(data || []);
      }

      // Fetch analytics
      const analyticsRes = await fetch('/api/broadcasts/analytics');
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data || []);
      }
    } catch (error) {
      console.error('Error fetching broadcast data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle form input
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name.startsWith('cta.')) {
      const ctaField = name.split('.')[1];
      setFormData({
        ...formData,
        cta: {
          ...formData.cta,
          [ctaField]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Handle template selection
  const handleSelectTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      ...formData,
      templateId: template.id,
      title: template.name,
      content: template.content,
    });
  };

  // Handle segment selection
  const handleToggleSegment = (segmentId: string) => {
    const updated = selectedSegments.includes(segmentId)
      ? selectedSegments.filter((s) => s !== segmentId)
      : [...selectedSegments, segmentId];

    setSelectedSegments(updated);
    setFormData({
      ...formData,
      segments: updated,
      targetAudience: updated.length > 0 ? 'segment' : 'all_users',
    });

    // Calculate recipient preview
    const count = updated.reduce(
      (sum, segId) => sum + (segments.find((s) => s.id === segId)?.recipientCount || 0),
      0
    );
    setRecipientPreview(count);
  };

  // Handle save as draft
  const handleSaveDraft = async () => {
    try {
      setLoading(true);

      const messageData = {
        ...formData,
        status: 'draft' as const,
      };

      const url = editingMessageId
        ? `/api/broadcasts/messages/${editingMessageId}`
        : '/api/broadcasts/messages';

      const method = editingMessageId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        const saved = await response.json();
        alert('Message saved as draft');
        setEditingMessageId(saved.id);
        fetchData();
      } else {
        alert('Error saving draft');
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      alert('Error saving draft');
    } finally {
      setLoading(false);
    }
  };

  // Handle schedule message
  const handleScheduleMessage = async () => {
    if (!scheduleDate) {
      alert('Please select a schedule date');
      return;
    }

    try {
      setLoading(true);

      const messageData = {
        ...formData,
        status: 'scheduled' as const,
        scheduledFor: new Date(scheduleDate),
      };

      const url = editingMessageId
        ? `/api/broadcasts/messages/${editingMessageId}`
        : '/api/broadcasts/messages';

      const method = editingMessageId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        alert('Message scheduled successfully');
        setFormData({
          title: '',
          content: '',
          targetAudience: 'all_users',
          priority: 'medium',
          channel: 'multi',
          status: 'draft',
          cta: { text: '', url: '', action: '' },
        });
        setScheduleDate('');
        setSelectedSegments([]);
        setEditingMessageId(null);
        fetchData();
      } else {
        alert('Error scheduling message');
      }
    } catch (error) {
      console.error('Error scheduling message:', error);
      alert('Error scheduling message');
    } finally {
      setLoading(false);
    }
  };

  // Handle send message immediately
  const handleSendMessage = async () => {
    if (!formData.title || !formData.content) {
      alert('Please fill in title and content');
      return;
    }

    if (!confirm('Send message to ' + (recipientPreview || 'all') + ' users?')) {
      return;
    }

    try {
      setLoading(true);

      const messageData = {
        ...formData,
        status: 'sending' as const,
      };

      const url = editingMessageId
        ? `/api/broadcasts/messages/${editingMessageId}/send`
        : '/api/broadcasts/messages/send';

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        alert('Message sent successfully');
        onMessageSend?.(messageData as BroadcastMessage);
        setFormData({
          title: '',
          content: '',
          targetAudience: 'all_users',
          priority: 'medium',
          channel: 'multi',
          status: 'draft',
          cta: { text: '', url: '', action: '' },
        });
        setSelectedSegments([]);
        setEditingMessageId(null);
        fetchData();
      } else {
        alert('Error sending message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) {
      return;
    }

    try {
      const response = await fetch(`/api/broadcasts/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
      } else {
        alert('Error deleting message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Error deleting message');
    }
  };

  // Handle view message details
  const handleViewMessage = (message: BroadcastMessage) => {
    setFormData(message);
    setEditingMessageId(message.id);
    setActiveTab('compose');
  };

  // Render compose tab
  const renderComposeTab = () => (
    <div className="compose-container">
      <div className="composer-section">
        <h3>Message Details</h3>

        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title || ''}
            onChange={handleFormChange}
            placeholder="Enter message title"
            maxLength={100}
          />
          <span className="char-count">{(formData.title || '').length}/100</span>
        </div>

        <div className="form-group">
          <label>Content *</label>
          <textarea
            name="content"
            value={formData.content || ''}
            onChange={handleFormChange}
            placeholder="Enter message content"
            rows={6}
            maxLength={2000}
          />
          <span className="char-count">{(formData.content || '').length}/2000</span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Priority</label>
            <select name="priority" value={formData.priority || 'medium'} onChange={handleFormChange}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="form-group">
            <label>Channel</label>
            <select name="channel" value={formData.channel || 'multi'} onChange={handleFormChange}>
              <option value="in_app">In-App</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push</option>
              <option value="multi">Multi-Channel</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Expiration Date (Optional)</label>
          <input
            type="datetime-local"
            name="expiresAt"
            onChange={(e) => setFormData({ ...formData, expiresAt: new Date(e.target.value) })}
          />
        </div>

        <div className="form-group">
          <label>CTA Button (Optional)</label>
          <div className="cta-input-group">
            <input
              type="text"
              name="cta.text"
              value={formData.cta?.text || ''}
              onChange={handleFormChange}
              placeholder="Button text"
            />
            <input
              type="url"
              name="cta.url"
              value={formData.cta?.url || ''}
              onChange={handleFormChange}
              placeholder="Button URL"
            />
          </div>
        </div>
      </div>

      <div className="composer-section">
        <h3>Target Audience</h3>

        <div className="form-group">
          <label>
            <input
              type="radio"
              value="all_users"
              checked={formData.targetAudience === 'all_users'}
              onChange={() => setFormData({ ...formData, targetAudience: 'all_users' })}
            />
            All Users
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="radio"
              value="segment"
              checked={formData.targetAudience === 'segment'}
              onChange={() => setFormData({ ...formData, targetAudience: 'segment' })}
            />
            Specific Segments
          </label>
        </div>

        {formData.targetAudience === 'segment' && (
          <div className="segment-selector">
            <h4>Select Segments</h4>
            {segments.length > 0 ? (
              <div className="segment-list">
                {segments.map((segment) => (
                  <label key={segment.id} className="segment-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSegments.includes(segment.id)}
                      onChange={() => handleToggleSegment(segment.id)}
                    />
                    <span>
                      {segment.name} ({segment.recipientCount || 0} users)
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p>No segments available</p>
            )}
          </div>
        )}

        {recipientPreview > 0 && (
          <div className="recipient-preview">
            This message will be sent to <strong>{recipientPreview}</strong> users
          </div>
        )}
      </div>

      <div className="composer-section">
        <h3>Template Library</h3>
        {templates.length > 0 ? (
          <div className="template-grid">
            {templates.map((template) => (
              <div
                key={template.id}
                className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="template-name">{template.name}</div>
                <div className="template-category">{template.category}</div>
                <button className="select-btn">Select</button>
              </div>
            ))}
          </div>
        ) : (
          <p>No templates available</p>
        )}
      </div>

      <div className="composer-actions">
        <button
          className="btn btn-secondary"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? 'Hide Preview' : 'Preview'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={handleSaveDraft}
          disabled={loading}
        >
          Save Draft
        </button>

        <div className="schedule-group">
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            placeholder="Schedule date"
          />
          <button
            className="btn btn-info"
            onClick={handleScheduleMessage}
            disabled={loading || !scheduleDate}
          >
            Schedule
          </button>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSendMessage}
          disabled={loading || !formData.title || !formData.content}
        >
          {loading ? 'Sending...' : 'Send Now'}
        </button>
      </div>

      {showPreview && (
        <div className="message-preview">
          <div className="preview-header">
            <h4>Message Preview</h4>
            <button onClick={() => setShowPreview(false)}>×</button>
          </div>
          <div className="preview-content">
            <h2>{formData.title}</h2>
            <p>{formData.content}</p>
            {formData.cta?.text && (
              <a href={formData.cta.url} className="cta-button">
                {formData.cta.text}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Render templates tab
  const renderTemplatesTab = () => (
    <div className="templates-container">
      <div className="templates-header">
        <h3>Message Templates</h3>
        <p>{templates.length} templates available</p>
      </div>

      <div className="templates-grid">
        {templates.map((template) => (
          <div key={template.id} className="template-card-large">
            <div className="template-header">
              <h4>{template.name}</h4>
              <span className="template-category-badge">{template.category}</span>
            </div>
            <div className="template-content">{template.content.substring(0, 150)}...</div>
            <div className="template-footer">
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleSelectTemplate(template)}
              >
                Use Template
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render history tab
  const renderHistoryTab = () => (
    <div className="history-container">
      <div className="history-header">
        <h3>Message History</h3>
        <p>{messages.length} messages</p>
      </div>

      <div className="messages-table">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Recipients</th>
              <th>Delivered</th>
              <th>Opened</th>
              <th>Clicked</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {messages.map((msg) => (
              <tr key={msg.id} className={`status-${msg.status}`}>
                <td className="title-cell">{msg.title}</td>
                <td>
                  <span className={`status-badge status-${msg.status}`}>{msg.status}</span>
                </td>
                <td>{msg.totalRecipients || 0}</td>
                <td>{msg.deliveredCount || 0}</td>
                <td>{msg.openCount || 0}</td>
                <td>{msg.clickCount || 0}</td>
                <td>{new Date(msg.createdAt).toLocaleDateString()}</td>
                <td className="actions-cell">
                  <button
                    className="btn btn-sm btn-info"
                    onClick={() => handleViewMessage(msg)}
                  >
                    View
                  </button>
                  {msg.status === 'draft' && (
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteMessage(msg.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render analytics tab
  const renderAnalyticsTab = () => (
    <div className="analytics-container">
      <div className="analytics-header">
        <h3>Campaign Analytics</h3>
      </div>

      <div className="analytics-grid">
        {analytics.map((analytic) => (
          <div key={analytic.messageId} className="analytics-card">
            <div className="analytics-metric">
              <div className="metric-label">Total Sent</div>
              <div className="metric-value">{analytic.totalSent.toLocaleString()}</div>
            </div>

            <div className="analytics-metric">
              <div className="metric-label">Delivered</div>
              <div className="metric-value">{analytic.delivered.toLocaleString()}</div>
            </div>

            <div className="analytics-metric">
              <div className="metric-label">Open Rate</div>
              <div className="metric-value">{analytic.openRate.toFixed(1)}%</div>
              <div className="metric-detail">{analytic.opened} opens</div>
            </div>

            <div className="analytics-metric">
              <div className="metric-label">Click Rate</div>
              <div className="metric-value">{analytic.clickRate.toFixed(1)}%</div>
              <div className="metric-detail">{analytic.clicked} clicks</div>
            </div>

            <div className="analytics-chart">
              <div className="chart-bar">
                <div className="bar-segment delivered" style={{ width: `${(analytic.delivered / analytic.totalSent) * 100}%` }}>
                  Delivered
                </div>
                <div className="bar-segment opened" style={{ width: `${(analytic.opened / analytic.totalSent) * 100}%` }}>
                  Opened
                </div>
                <div className="bar-segment clicked" style={{ width: `${(analytic.clicked / analytic.totalSent) * 100}%` }}>
                  Clicked
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="broadcast-composer">
      <div className="composer-header">
        <h2>In-App Broadcast Messaging</h2>
        <p>Create and manage targeted broadcast messages for your users</p>
      </div>

      <div className="composer-tabs">
        <button
          className={`tab-btn ${activeTab === 'compose' ? 'active' : ''}`}
          onClick={() => setActiveTab('compose')}
        >
          Compose
        </button>
        <button
          className={`tab-btn ${activeTab === 'templates' ? 'active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'compose' && renderComposeTab()}
        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default BroadcastComposer;
