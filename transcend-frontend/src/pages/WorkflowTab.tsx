import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import './Workflow.css';

interface WorkflowState {
  name: string;
  display_name: string;
  color: string;
  order_index: number;
  is_terminal?: boolean;
}

interface CaseStatus {
  status: string;
  display_name: string;
  color: string;
}

interface StatusHistoryItem {
  id: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  reason?: string;
  created_at: string;
}

interface WorkflowTabProps {
  caseId: string;
}

const WorkflowTab: React.FC<WorkflowTabProps> = ({ caseId }) => {
  const { token } = useAuth();
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [currentStatus, setCurrentStatus] = useState<CaseStatus | null>(null);
  const [history, setHistory] = useState<StatusHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchWorkflowData();
  }, [caseId]);

  const fetchWorkflowData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [statesData, statusData, historyData] = await Promise.all([
        api.getWorkflowStates(token),
        api.getCaseStatus(caseId, token),
        api.getCaseStatusHistory(caseId, token),
      ]);
      setStates(statesData);
      setCurrentStatus(statusData);
      setHistory(historyData || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow data');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedStatus || !token) return;
    try {
      setUpdating(true);
      const result = await api.updateCaseStatus(caseId, selectedStatus, reason, token);
      setCurrentStatus({
        status: selectedStatus,
        display_name: states.find(s => s.name === selectedStatus)?.display_name || selectedStatus,
        color: states.find(s => s.name === selectedStatus)?.color || '#667eea',
      });
      setHistory([result, ...history]);
      setSelectedStatus(null);
      setReason('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return <div className="workflow-loading">Loading workflow states...</div>;
  }

  return (
    <div className="workflow-container">
      {error && <div className="workflow-error">{error}</div>}

      {/* Current Status Section */}
      <div className="workflow-section">
        <h3>Current Status</h3>
        {currentStatus && (
          <div className="current-status">
            <div
              className="status-indicator"
              style={{ backgroundColor: currentStatus.color }}
            />
            <div className="status-info">
              <div className="status-name">{currentStatus.display_name}</div>
              <div className="status-label">{currentStatus.status}</div>
            </div>
          </div>
        )}
      </div>

      {/* Status Transition Section */}
      <div className="workflow-section">
        <h3>Change Status</h3>
        <div className="status-selector">
          <div className="workflow-states-list">
            {states.map((state) => (
              <button
                key={state.name}
                className={`state-button ${selectedStatus === state.name ? 'selected' : ''}`}
                onClick={() => setSelectedStatus(state.name)}
                style={{
                  borderLeftColor: state.color,
                  opacity: selectedStatus && selectedStatus !== state.name ? 0.5 : 1,
                }}
              >
                <span
                  className="state-color"
                  style={{ backgroundColor: state.color }}
                />
                <span>{state.display_name}</span>
              </button>
            ))}
          </div>

          {selectedStatus && selectedStatus !== currentStatus?.status && (
            <div className="transition-form">
              <textarea
                className="reason-input"
                placeholder="Enter reason for status change (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              <div className="action-buttons">
                <button
                  className="confirm-btn"
                  onClick={handleStatusChange}
                  disabled={updating}
                >
                  {updating ? 'Updating...' : 'Confirm Change'}
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setSelectedStatus(null);
                    setReason('');
                  }}
                  disabled={updating}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status History Section */}
      {history.length > 0 && (
        <div className="workflow-section">
          <h3>Status History</h3>
          <div className="history-timeline">
            {history.map((item) => (
              <div key={item.id} className="history-item">
                <div className="history-date">{formatDate(item.created_at)}</div>
                <div className="history-transition">
                  {item.from_status && (
                    <>
                      <span className="from-status">{item.from_status}</span>
                      <span className="arrow">→</span>
                    </>
                  )}
                  <span className="to-status">{item.to_status}</span>
                </div>
                {item.reason && <div className="history-reason">{item.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowTab;
