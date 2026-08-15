import React, { useState, useRef } from 'react';
import './AdminBugFixPanel.css';

interface BugReport {
  id: string;
  title: string;
  description: string;
  screenshots: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'submitted' | 'auto-fixing' | 'fixed' | 'manual-review';
  createdAt: string;
  autoFixResult?: string;
}

export default function AdminBugFixPanel() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setScreenshots([...screenshots, ...files]);
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(screenshots.filter((_, i) => i !== index));
  };

  const handleCaptureScreenshot = async () => {
    try {
      // Use html2canvas if available, otherwise use native canvas
      const canvas = await (window as any).html2canvas?.(document.body);
      if (canvas) {
        canvas.toBlob((blob) => {
          const file = new File(
            [blob],
            `screenshot-${Date.now()}.png`,
            { type: 'image/png' }
          );
          setScreenshots([...screenshots, file]);
        });
      } else {
        // Fallback: try to use canvas API
        alert('Screenshot capture requires html2canvas library');
      }
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      alert('Failed to capture screenshot');
    }
  };

  const handleSubmitBug = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Please fill in title and description');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('severity', severity);

      screenshots.forEach((file) => {
        formData.append('screenshots', file);
      });

      // Submit to backend for auto-fix
      const response = await fetch('/api/admin/bug-reports', {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const newReport: BugReport = {
          id: result.id,
          title,
          description,
          screenshots: result.screenshotUrls || [],
          severity,
          status: 'auto-fixing',
          createdAt: new Date().toISOString(),
        };

        setReports([newReport, ...reports]);

        // Reset form
        setTitle('');
        setDescription('');
        setScreenshots([]);
        setSeverity('medium');

        // Auto-fix should be triggered on backend
        // Poll for status updates
        pollBugStatus(result.id);
      }
    } catch (error) {
      console.error('Failed to submit bug report:', error);
      alert('Failed to submit bug report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pollBugStatus = (reportId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/admin/bug-reports/${reportId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
        });

        if (response.ok) {
          const updated = await response.json();
          setReports(reports.map(r =>
            r.id === reportId
              ? { ...r, status: updated.status, autoFixResult: updated.result }
              : r
          ));

          if (updated.status === 'fixed' || updated.status === 'manual-review') {
            clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Failed to poll bug status:', error);
      }
    }, 5000); // Poll every 5 seconds

    // Clear after 10 minutes
    setTimeout(() => clearInterval(interval), 600000);
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical':
        return '#e74c3c';
      case 'high':
        return '#f39c12';
      case 'medium':
        return '#3498db';
      case 'low':
        return '#27ae60';
      default:
        return '#95a5a6';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'submitted':
        return '📝';
      case 'auto-fixing':
        return '🔧';
      case 'fixed':
        return '✅';
      case 'manual-review':
        return '👀';
      default:
        return '❓';
    }
  };

  return (
    <div className="admin-bug-fix-panel">
      <button
        className="panel-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title="Bug Report Panel"
      >
        🐛
      </button>

      {isOpen && (
        <div className="panel-content">
          <div className="panel-header">
            <h3>🐛 Bug Report & Auto-Fix</h3>
            <button
              className="close-btn"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>
          </div>

          <div className="panel-body">
            {/* Submit Form */}
            <div className="bug-form-section">
              <h4>Report a Bug</h4>

              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Brief description of the bug"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed explanation of what went wrong and how to reproduce it"
                  rows={4}
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label>Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="form-select"
                >
                  <option value="low">🟢 Low - Minor UI issue</option>
                  <option value="medium">🟡 Medium - Feature broken</option>
                  <option value="high">🔴 High - Major feature down</option>
                  <option value="critical">⚫ Critical - Site breaking</option>
                </select>
              </div>

              <div className="form-group">
                <label>Screenshots (Optional)</label>
                <div className="button-group">
                  <button
                    type="button"
                    className="upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📤 Upload File
                  </button>
                  <button
                    type="button"
                    className="capture-btn"
                    onClick={handleCaptureScreenshot}
                  >
                    📸 Capture Screenshot
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />

                {screenshots.length > 0 && (
                  <div className="screenshot-list">
                    {screenshots.map((file, idx) => (
                      <div key={idx} className="screenshot-item">
                        <span>{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeScreenshot(idx)}
                          className="remove-btn"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                className="submit-btn"
                onClick={handleSubmitBug}
                disabled={isSubmitting || !title.trim() || !description.trim()}
              >
                {isSubmitting ? '⏳ Submitting...' : '✓ Submit & Auto-Fix'}
              </button>
            </div>

            {/* Recent Reports */}
            {reports.length > 0 && (
              <div className="reports-section">
                <h4>Recent Reports</h4>
                <div className="reports-list">
                  {reports.slice(0, 10).map((report) => (
                    <div key={report.id} className="report-item">
                      <div className="report-header">
                        <span className="status-icon">
                          {getStatusIcon(report.status)}
                        </span>
                        <h5>{report.title}</h5>
                        <span
                          className="severity-badge"
                          style={{ backgroundColor: getSeverityColor(report.severity) }}
                        >
                          {report.severity.toUpperCase()}
                        </span>
                      </div>

                      <p className="report-description">{report.description}</p>

                      <div className="report-meta">
                        <span className="status-label">
                          Status: {report.status.replace('-', ' ')}
                        </span>
                        <span className="time">
                          {new Date(report.createdAt).toLocaleTimeString()}
                        </span>
                      </div>

                      {report.autoFixResult && (
                        <div className="fix-result">
                          <span>✓ Fix: </span>
                          <code>{report.autoFixResult.substring(0, 100)}...</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
