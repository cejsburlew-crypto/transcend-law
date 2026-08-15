/**
 * Admin Request Panel
 * Track feature requests and bug fixes in real-time
 * Shows in left admin menu with status, progress, and timestamps
 */

import React, { useState, useEffect } from 'react';
import './AdminRequestPanel.css';

export interface AdminRequest {
  id: string;
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'in_progress' | 'completed';
  estimatedCompletion: Date;
  completionPercentage: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'feature' | 'bug' | 'enhancement';
  attachments?: string[];
  completedAt?: Date;
}

interface AdminRequestPanelProps {
  onRequestCreated?: (request: AdminRequest) => void;
  isOpen?: boolean;
}

export const AdminRequestPanel: React.FC<AdminRequestPanelProps> = ({
  onRequestCreated,
  isOpen = true,
}) => {
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<AdminRequest | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    type: 'feature' as const,
  });

  // Load requests from API
  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await fetch('/api/admin/requests?status=pending,in_progress');
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
    }
  };

  const submitRequest = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/admin/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          requestedBy: localStorage.getItem('adminName') || 'Unknown',
          requestedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const newRequest = await response.json();
        setRequests([newRequest, ...requests]);
        setFormData({ title: '', description: '', priority: 'medium', type: 'feature' });
        setShowForm(false);

        if (onRequestCreated) {
          onRequestCreated(newRequest);
        }
      }
    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Failed to submit request');
    }
  };

  const updateRequestStatus = async (requestId: string, percentage: number) => {
    try {
      const response = await fetch(`/api/admin/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completionPercentage: percentage,
          status: percentage === 100 ? 'completed' : 'in_progress',
        }),
      });

      if (response.ok) {
        loadRequests();
      }
    } catch (error) {
      console.error('Failed to update request:', error);
    }
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'in_progress':
        return '⚙️';
      case 'completed':
        return '✅';
      default:
        return '📋';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return '#e74c3c';
      case 'high':
        return '#f39c12';
      case 'medium':
        return '#3498db';
      case 'low':
        return '#95a5a6';
      default:
        return '#bdc3c7';
    }
  };

  const getPriorityLabel = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  const activeRequests = requests.filter((r) => r.status !== 'completed');
  const completedCount = requests.filter((r) => r.status === 'completed').length;

  if (!isOpen) return null;

  return (
    <div className="admin-request-panel">
      <div className="request-panel-header">
        <h3>📋 Requests</h3>
        <div className="request-header-actions">
          <button className="header-btn" onClick={() => setShowForm(!showForm)} title="Add new request">
            ➕
          </button>
          <button className="header-btn" onClick={() => setShowHistory(true)} title="View request history">
            📜
          </button>
        </div>
      </div>

      {/* Add Request Form */}
      {showForm && (
        <div className="request-form">
          <div className="form-group">
            <label>What do you want to see?</label>
            <input
              type="text"
              placeholder="Feature title or bug description"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Details</label>
            <textarea
              placeholder="Describe what you need in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="form-select"
              >
                <option value="feature">✨ Feature</option>
                <option value="bug">🐛 Bug Fix</option>
                <option value="enhancement">📈 Enhancement</option>
              </select>
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="form-select"
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🟠 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-submit" onClick={submitRequest}>
              Submit Request
            </button>
            <button className="btn-cancel" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Request List */}
      <div className="request-list">
        {activeRequests.length === 0 && !showForm && (
          <div className="no-requests">
            <p>No active requests</p>
            <button className="btn-add-request" onClick={() => setShowForm(true)}>
              Create one
            </button>
          </div>
        )}

        {activeRequests.map((request) => (
          <div
            key={request.id}
            className={`request-item status-${request.status}`}
            onClick={() => setSelectedRequest(request)}
          >
            <div className="request-item-header">
              <div className="request-title-section">
                <span className="request-status-icon">{getStatusIcon(request.status)}</span>
                <span className="request-title">{request.title}</span>
              </div>
              <span
                className="request-priority-badge"
                style={{ backgroundColor: getPriorityColor(request.priority) }}
              >
                {getPriorityLabel(request.priority)[0]}
              </span>
            </div>

            <div className="request-timestamp">
              {formatTime(request.requestedAt)}
            </div>

            {request.status === 'in_progress' && (
              <div className="request-progress">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${request.completionPercentage}%` }}
                  />
                </div>
                <span className="progress-text">{request.completionPercentage}%</span>
              </div>
            )}

            <div className="request-meta">
              <span className="request-type">
                {request.type === 'feature' && '✨'}
                {request.type === 'bug' && '🐛'}
                {request.type === 'enhancement' && '📈'}
              </span>
              <span className="request-requestor">by {request.requestedBy}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Request Count */}
      {requests.length > 0 && (
        <div className="request-summary">
          <span>{activeRequests.length} active</span>
          {completedCount > 0 && <span>{completedCount} completed</span>}
        </div>
      )}

      {/* Request Detail Modal */}
      {selectedRequest && (
        <div className="request-detail-modal" onClick={() => setSelectedRequest(null)}>
          <div className="request-detail-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setSelectedRequest(null)}
            >
              ✕
            </button>

            <div className="detail-header">
              <div className="detail-title-section">
                <span className="detail-status-icon">
                  {getStatusIcon(selectedRequest.status)}
                </span>
                <h2>{selectedRequest.title}</h2>
              </div>
              <span
                className="detail-priority-badge"
                style={{ backgroundColor: getPriorityColor(selectedRequest.priority) }}
              >
                {getPriorityLabel(selectedRequest.priority)}
              </span>
            </div>

            <div className="detail-meta">
              <div className="meta-item">
                <strong>Status:</strong>
                <span className={`status-label status-${selectedRequest.status}`}>
                  {selectedRequest.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="meta-item">
                <strong>Type:</strong>
                <span>{selectedRequest.type.toUpperCase()}</span>
              </div>
              <div className="meta-item">
                <strong>Requested By:</strong>
                <span>{selectedRequest.requestedBy}</span>
              </div>
              <div className="meta-item">
                <strong>Requested At:</strong>
                <span>{formatTime(selectedRequest.requestedAt)}</span>
              </div>
            </div>

            {selectedRequest.status === 'in_progress' && (
              <div className="detail-progress-section">
                <div className="progress-header">
                  <strong>Progress</strong>
                  <span className="progress-percentage">
                    {selectedRequest.completionPercentage}%
                  </span>
                </div>
                <div className="progress-bar-large">
                  <div
                    className="progress-fill"
                    style={{ width: `${selectedRequest.completionPercentage}%` }}
                  />
                </div>

                <div className="progress-controls">
                  {[0, 25, 50, 75, 100].map((percent) => (
                    <button
                      key={percent}
                      className={`progress-btn ${
                        selectedRequest.completionPercentage === percent ? 'active' : ''
                      }`}
                      onClick={() => {
                        updateRequestStatus(selectedRequest.id, percent);
                        setSelectedRequest({
                          ...selectedRequest,
                          completionPercentage: percent,
                        });
                      }}
                    >
                      {percent}%
                    </button>
                  ))}
                </div>

                <div className="meta-item">
                  <strong>Est. Completion:</strong>
                  <span>{formatTime(selectedRequest.estimatedCompletion)}</span>
                </div>
              </div>
            )}

            {selectedRequest.status === 'completed' && selectedRequest.completedAt && (
              <div className="detail-completed-section">
                <strong>Completed:</strong>
                <span>{formatTime(selectedRequest.completedAt)}</span>
              </div>
            )}

            <div className="detail-description">
              <h4>Description</h4>
              <p>{selectedRequest.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="history-modal" onClick={() => setShowHistory(false)}>
          <div className="history-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowHistory(false)}
            >
              ✕
            </button>

            <h2>📜 Request History</h2>

            <div className="history-list">
              {requests.length === 0 ? (
                <p className="no-history">No requests yet</p>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="history-item">
                    <div className="history-status">
                      <span className="status-icon">
                        {getStatusIcon(request.status)}
                      </span>
                      <span className={`status-label status-${request.status}`}>
                        {request.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="history-details">
                      <h4>{request.title}</h4>
                      <div className="history-meta">
                        <span>By {request.requestedBy}</span>
                        <span>{formatTime(request.requestedAt)}</span>
                        {request.completedAt && (
                          <span>Completed {formatTime(request.completedAt)}</span>
                        )}
                      </div>
                    </div>

                    <button
                      className="history-expand-btn"
                      onClick={() => {
                        setShowHistory(false);
                        setSelectedRequest(request);
                      }}
                    >
                      View
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRequestPanel;
