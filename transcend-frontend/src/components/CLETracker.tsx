// CLE Tracker Component
// Displays CLE credits, compliance status, deadlines, and allows recording new credits

import React, { useState, useEffect } from 'react';
import './CLETracker.css';

// Types
interface CLECredit {
  id: string;
  attorneyId: string;
  providerId: string;
  courseName: string;
  courseDescription: string;
  creditType: 'Ethics' | 'Mandatory' | 'General';
  hoursEarned: number;
  state: string;
  credentialAccepted: boolean;
  completionDate: string;
  certificateUrl?: string;
  barReferenceNumber?: string;
  syncedWithBar: boolean;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CLECompliance {
  id: string;
  attorneyId: string;
  state: string;
  year: number;
  totalHours: number;
  ethicsHours: number;
  mandatoryHours: number;
  generalHours: number;
  carryoverHours: number;
  deficitHours: number;
  isCompliant: boolean;
  lastAuditDate: string;
  auditStatus: 'pending' | 'approved' | 'rejected';
  auditNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface CLEDeadline {
  id: string;
  attorneyId: string;
  state: string;
  reportingDeadline: string;
  requiredHours: number;
  earningDeadline: string;
  alarmAt30Days: boolean;
  alarmAt60Days: boolean;
  alarmAt90Days: boolean;
  status: 'upcoming' | 'warning' | 'critical' | 'met' | 'overdue';
  createdAt: string;
  updatedAt: string;
}

interface CLETrackerProps {
  attorneyId: string;
  userType: 'attorney' | 'admin' | 'bar-staff';
  onComplianceChange?: (state: string, compliant: boolean) => void;
}

export const CLETracker: React.FC<CLETrackerProps> = ({
  attorneyId,
  userType,
  onComplianceChange,
}) => {
  // State Management
  const [selectedState, setSelectedState] = useState('CA');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [credits, setCredits] = useState<CLECredit[]>([]);
  const [compliance, setCompliance] = useState<CLECompliance | null>(null);
  const [deadline, setDeadline] = useState<CLEDeadline | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'credits' | 'deadlines' | 'export'>(
    'overview'
  );
  const [showAddCreditDialog, setShowAddCreditDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Form state
  const [newCredit, setNewCredit] = useState({
    courseName: '',
    courseDescription: '',
    creditType: 'General' as const,
    hoursEarned: 1,
    providerId: '',
    certificateUrl: '',
    completionDate: new Date().toISOString().split('T')[0],
  });

  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');

  // Fetch data on mount and when state/year changes
  useEffect(() => {
    fetchCLEData();
  }, [selectedState, selectedYear, attorneyId]);

  const fetchCLEData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v2/cle/${attorneyId}?state=${selectedState}&year=${selectedYear}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch CLE data');
      }

      const data = await response.json();
      setCredits(data.credits || []);
      setCompliance(data.compliance || null);
      setDeadline(data.deadline || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load CLE data';
      setError(message);
      console.error('Error fetching CLE data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredit = async () => {
    try {
      if (!newCredit.courseName.trim()) {
        setError('Course name is required');
        return;
      }

      if (newCredit.hoursEarned <= 0 || newCredit.hoursEarned > 50) {
        setError('Credit hours must be between 1 and 50');
        return;
      }

      const response = await fetch(`/api/v2/cle/${attorneyId}/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          courseName: newCredit.courseName,
          courseDescription: newCredit.courseDescription,
          creditType: newCredit.creditType,
          hoursEarned: newCredit.hoursEarned,
          state: selectedState,
          providerId: newCredit.providerId,
          certificateUrl: newCredit.certificateUrl,
          completionDate: new Date(newCredit.completionDate),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add CLE credit');
      }

      setSuccessMessage(`${newCredit.hoursEarned} hours added for ${newCredit.courseName}`);
      setShowAddCreditDialog(false);
      resetNewCreditForm();
      fetchCLEData();
      onComplianceChange?.(selectedState, true);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add credit';
      setError(message);
    }
  };

  const handleExportReport = async () => {
    try {
      const response = await fetch(
        `/api/v2/cle/${attorneyId}/export?state=${selectedState}&year=${selectedYear}&format=${exportFormat}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CLE-Report-${selectedState}-${selectedYear}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setShowExportDialog(false);
      setSuccessMessage('Report exported successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export report';
      setError(message);
    }
  };

  const resetNewCreditForm = () => {
    setNewCredit({
      courseName: '',
      courseDescription: '',
      creditType: 'General',
      hoursEarned: 1,
      providerId: '',
      certificateUrl: '',
      completionDate: new Date().toISOString().split('T')[0],
    });
  };

  const calculateProgress = (): {
    current: number;
    required: number;
    percentage: number;
  } => {
    if (!compliance) {
      return { current: 0, required: 25, percentage: 0 };
    }

    const required = compliance.deficitHours > 0 ? compliance.totalHours + compliance.deficitHours : compliance.totalHours;
    const percentage = Math.min(100, (compliance.totalHours / required) * 100);

    return {
      current: compliance.totalHours,
      required,
      percentage,
    };
  };

  const getComplianceStatusClass = (): string => {
    if (!compliance) return 'status-unknown';
    if (compliance.isCompliant) return 'status-compliant';
    if (compliance.deficitHours > 0) return 'status-noncompliant';
    return 'status-pending';
  };

  const getDeadlineStatusClass = (): string => {
    if (!deadline) return 'deadline-unknown';
    switch (deadline.status) {
      case 'met':
        return 'deadline-met';
      case 'upcoming':
        return 'deadline-upcoming';
      case 'warning':
        return 'deadline-warning';
      case 'critical':
        return 'deadline-critical';
      case 'overdue':
        return 'deadline-overdue';
      default:
        return 'deadline-unknown';
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntilDeadline = (): number => {
    if (!deadline) return 0;
    const now = new Date();
    const deadlineDate = new Date(deadline.reportingDeadline);
    const diff = deadlineDate.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const progress = calculateProgress();

  if (loading) {
    return <div className="cle-tracker-container loading">Loading CLE tracking data...</div>;
  }

  return (
    <div className="cle-tracker-container">
      {error && (
        <div className="cle-error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>X</button>
        </div>
      )}

      {successMessage && (
        <div className="cle-success-banner">
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header and Controls */}
      <div className="cle-header">
        <h2>CLE Tracking & Compliance</h2>
        <div className="cle-controls">
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="state-select"
          >
            <option value="CA">California</option>
            <option value="TX">Texas</option>
            <option value="NY">New York</option>
            <option value="FL">Florida</option>
            <option value="IL">Illinois</option>
            <option value="PA">Pennsylvania</option>
            <option value="OH">Ohio</option>
            <option value="GA">Georgia</option>
            <option value="NC">North Carolina</option>
            <option value="MI">Michigan</option>
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="year-select"
          >
            {[2024, 2025, 2026].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>

          {userType === 'attorney' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowAddCreditDialog(true)}
            >
              Add Credit
            </button>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => setShowExportDialog(true)}
          >
            Export Report
          </button>
        </div>
      </div>

      {/* Compliance Status Overview */}
      {compliance && (
        <div className={`cle-status-card ${getComplianceStatusClass()}`}>
          <div className="status-content">
            <div className="status-badge">
              {compliance.isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
            </div>
            <div className="status-details">
              <h3>Compliance Status for {selectedState} ({selectedYear})</h3>
              <p>
                {compliance.totalHours} of {compliance.totalHours + compliance.deficitHours} hours
              </p>
            </div>
          </div>

          <div className="progress-section">
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <div className="progress-details">
              <span className="progress-current">{compliance.totalHours}h</span>
              <span className="progress-required">
                /{compliance.totalHours + compliance.deficitHours}h required
              </span>
            </div>
          </div>

          <div className="status-breakdown">
            <div className="breakdown-item">
              <label>Ethics</label>
              <span className="hours">{compliance.ethicsHours}h</span>
            </div>
            <div className="breakdown-item">
              <label>Mandatory</label>
              <span className="hours">{compliance.mandatoryHours}h</span>
            </div>
            <div className="breakdown-item">
              <label>General</label>
              <span className="hours">{compliance.generalHours}h</span>
            </div>
            {compliance.carryoverHours > 0 && (
              <div className="breakdown-item">
                <label>Carryover</label>
                <span className="hours">{compliance.carryoverHours}h</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Deadline Alert */}
      {deadline && (
        <div className={`cle-deadline-card ${getDeadlineStatusClass()}`}>
          <div className="deadline-header">
            <h3>Reporting Deadline</h3>
            <span className={`deadline-status-badge status-${deadline.status}`}>
              {getDaysUntilDeadline()} days
            </span>
          </div>
          <div className="deadline-details">
            <div className="deadline-item">
              <label>Deadline</label>
              <span className="date">{formatDate(deadline.reportingDeadline)}</span>
            </div>
            <div className="deadline-item">
              <label>Required Hours</label>
              <span className="hours">{deadline.requiredHours}h</span>
            </div>
            <div className="deadline-item">
              <label>Earning Deadline</label>
              <span className="date">{formatDate(deadline.earningDeadline)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="cle-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'credits' ? 'active' : ''}`}
          onClick={() => setActiveTab('credits')}
        >
          Credits ({credits.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'deadlines' ? 'active' : ''}`}
          onClick={() => setActiveTab('deadlines')}
        >
          Deadlines
        </button>
        <button
          className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="cle-tab-content">
          <div className="overview-grid">
            {compliance && (
              <>
                <div className="overview-card">
                  <h4>Total Hours</h4>
                  <div className="overview-value">{compliance.totalHours}h</div>
                  <div className="overview-subtext">
                    {compliance.deficitHours > 0
                      ? `${compliance.deficitHours}h needed`
                      : 'Compliant'}
                  </div>
                </div>

                <div className="overview-card">
                  <h4>Ethics Hours</h4>
                  <div className="overview-value">{compliance.ethicsHours}h</div>
                  <div className="overview-subtext">(1h required)</div>
                </div>

                <div className="overview-card">
                  <h4>Mandatory Hours</h4>
                  <div className="overview-value">{compliance.mandatoryHours}h</div>
                  <div className="overview-subtext">per state</div>
                </div>

                <div className="overview-card">
                  <h4>Audit Status</h4>
                  <div className="overview-value">{compliance.auditStatus}</div>
                  <div className="overview-subtext">
                    Last: {formatDate(compliance.lastAuditDate)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'credits' && (
        <div className="cle-tab-content">
          {credits.length === 0 ? (
            <div className="empty-state">
              <p>No CLE credits recorded for {selectedState} in {selectedYear}</p>
              {userType === 'attorney' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddCreditDialog(true)}
                >
                  Record Your First Credit
                </button>
              )}
            </div>
          ) : (
            <div className="credits-table">
              <div className="table-header">
                <div className="col-course">Course</div>
                <div className="col-type">Type</div>
                <div className="col-hours">Hours</div>
                <div className="col-date">Date</div>
                <div className="col-status">Status</div>
              </div>

              {credits.map((credit) => (
                <div key={credit.id} className="table-row">
                  <div className="col-course">
                    <div className="course-name">{credit.courseName}</div>
                    {credit.certificateUrl && (
                      <a href={credit.certificateUrl} className="cert-link">
                        View Certificate
                      </a>
                    )}
                  </div>
                  <div className="col-type">
                    <span className={`credit-type credit-${credit.creditType.toLowerCase()}`}>
                      {credit.creditType}
                    </span>
                  </div>
                  <div className="col-hours">{credit.hoursEarned}h</div>
                  <div className="col-date">{formatDate(credit.completionDate)}</div>
                  <div className="col-status">
                    <span
                      className={`sync-status ${credit.syncedWithBar ? 'synced' : 'pending'}`}
                    >
                      {credit.syncedWithBar ? '✓ Synced' : '⏳ Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'deadlines' && (
        <div className="cle-tab-content">
          {deadline ? (
            <div className="deadline-details-section">
              <div className="deadline-item-full">
                <label>Reporting Deadline</label>
                <div className="deadline-value">
                  {formatDate(deadline.reportingDeadline)}
                </div>
              </div>

              <div className="deadline-item-full">
                <label>Earning Deadline</label>
                <div className="deadline-value">
                  {formatDate(deadline.earningDeadline)}
                </div>
              </div>

              <div className="deadline-item-full">
                <label>Days Remaining</label>
                <div className="deadline-value" style={{ color: getDaysUntilDeadline() <= 30 ? '#e74c3c' : '#27ae60' }}>
                  {getDaysUntilDeadline()} days
                </div>
              </div>

              <div className="deadline-item-full">
                <label>Deadline Status</label>
                <div className="deadline-value">
                  <span className={`deadline-badge status-${deadline.status}`}>
                    {deadline.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="deadline-alerts-section">
                <h4>Alert History</h4>
                <ul className="alerts-list">
                  <li className={deadline.alarmAt90Days ? 'completed' : 'pending'}>
                    90-day alert {deadline.alarmAt90Days ? 'sent' : 'pending'}
                  </li>
                  <li className={deadline.alarmAt60Days ? 'completed' : 'pending'}>
                    60-day alert {deadline.alarmAt60Days ? 'sent' : 'pending'}
                  </li>
                  <li className={deadline.alarmAt30Days ? 'completed' : 'pending'}>
                    30-day alert {deadline.alarmAt30Days ? 'sent' : 'pending'}
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>No deadline information available</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'export' && (
        <div className="cle-tab-content">
          <div className="export-section">
            <h3>Export Compliance Report</h3>
            <p>Generate a report for bar application or record keeping</p>

            <div className="export-options">
              <div className="option-group">
                <label>Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'csv' | 'json')}
                >
                  <option value="pdf">PDF</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
              </div>

              <button
                className="btn btn-primary export-btn"
                onClick={handleExportReport}
              >
                Download Report
              </button>
            </div>

            {compliance && (
              <div className="export-preview">
                <h4>Report Preview</h4>
                <div className="preview-item">
                  <span>State:</span>
                  <strong>{selectedState}</strong>
                </div>
                <div className="preview-item">
                  <span>Year:</span>
                  <strong>{selectedYear}</strong>
                </div>
                <div className="preview-item">
                  <span>Total Credits:</span>
                  <strong>{compliance.totalHours}h</strong>
                </div>
                <div className="preview-item">
                  <span>Status:</span>
                  <strong>{compliance.isCompliant ? 'Compliant' : 'Non-Compliant'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Credit Dialog */}
      {showAddCreditDialog && (
        <div className="modal-overlay" onClick={() => setShowAddCreditDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Record CLE Credit</h3>

            <div className="form-group">
              <label>Course Name *</label>
              <input
                type="text"
                value={newCredit.courseName}
                onChange={(e) => setNewCredit({ ...newCredit, courseName: e.target.value })}
                placeholder="e.g., Legal Ethics Update"
              />
            </div>

            <div className="form-group">
              <label>Course Description</label>
              <textarea
                value={newCredit.courseDescription}
                onChange={(e) => setNewCredit({ ...newCredit, courseDescription: e.target.value })}
                placeholder="Brief description of the course..."
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Credit Type *</label>
                <select
                  value={newCredit.creditType}
                  onChange={(e) => setNewCredit({ ...newCredit, creditType: e.target.value as any })}
                >
                  <option value="Ethics">Ethics</option>
                  <option value="Mandatory">Mandatory</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="form-group">
                <label>Hours Earned *</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={newCredit.hoursEarned}
                  onChange={(e) => setNewCredit({ ...newCredit, hoursEarned: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Completion Date *</label>
                <input
                  type="date"
                  value={newCredit.completionDate}
                  onChange={(e) => setNewCredit({ ...newCredit, completionDate: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Provider ID</label>
                <input
                  type="text"
                  value={newCredit.providerId}
                  onChange={(e) => setNewCredit({ ...newCredit, providerId: e.target.value })}
                  placeholder="Provider ID"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Certificate URL</label>
              <input
                type="url"
                value={newCredit.certificateUrl}
                onChange={(e) => setNewCredit({ ...newCredit, certificateUrl: e.target.value })}
                placeholder="https://example.com/certificate"
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddCreditDialog(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddCredit}
              >
                Record Credit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="modal-overlay" onClick={() => setShowExportDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Export Compliance Report</h3>
            <p>Download your CLE compliance report for {selectedState} ({selectedYear})</p>

            <div className="form-group">
              <label>File Format</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'csv' | 'json')}
              >
                <option value="pdf">PDF - For bar applications</option>
                <option value="csv">CSV - For spreadsheet analysis</option>
                <option value="json">JSON - For system integration</option>
              </select>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowExportDialog(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleExportReport}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CLETracker;
