import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './ComplianceReports.css';

interface Report {
  id: string;
  type: 'breach' | 'access' | 'changelog' | 'security' | 'incident';
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  status: 'pending' | 'completed' | 'failed';
  complianceStandards: ('SOC2' | 'HIPAA')[];
  data: any;
  pdfPath?: string;
  emailDelivered?: boolean;
}

interface Schedule {
  id: string;
  reportType: 'breach' | 'access' | 'changelog' | 'security' | 'incident' | 'all';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  recipientEmails: string[];
  enabled: boolean;
  nextRun?: Date;
  lastRun?: Date;
}

export const ComplianceReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'reports' | 'schedules' | 'generate'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate report form state
  const [generateForm, setGenerateForm] = useState({
    reportTypes: ['breach', 'access', 'changelog', 'security', 'incident'] as const[],
    complianceStandards: ['SOC2', 'HIPAA'] as const[],
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    exportPDF: true,
    sendEmail: false,
    emailRecipients: '',
  });

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    reportType: 'all' as const,
    frequency: 'weekly' as const,
    time: '08:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
    recipientEmails: '',
    enabled: true,
  });

  // Load reports and schedules on mount
  useEffect(() => {
    loadReports();
    loadSchedules();
  }, []);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/compliance/reports');
      setReports(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      const response = await axios.get('/api/compliance/schedules');
      setSchedules(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load schedules');
    }
  }, []);

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const emailRecipients = generateForm.emailRecipients
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email);

      const response = await axios.post('/api/compliance/reports/generate', {
        reportTypes: generateForm.reportTypes,
        complianceStandards: generateForm.complianceStandards,
        startDate: generateForm.startDate,
        endDate: generateForm.endDate,
        exportPDF: generateForm.exportPDF,
        sendEmail: generateForm.sendEmail && emailRecipients.length > 0,
        emailRecipients,
      });

      setReports([response.data, ...reports]);
      setActiveTab('reports');

      // Reset form
      setGenerateForm({
        ...generateForm,
        emailRecipients: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const recipientEmails = scheduleForm.recipientEmails
        .split(',')
        .map((email: string) => email.trim())
        .filter((email: string) => email);

      if (recipientEmails.length === 0) {
        setError('Please provide at least one recipient email');
        return;
      }

      const response = await axios.post('/api/compliance/schedules', {
        reportType: scheduleForm.reportType,
        frequency: scheduleForm.frequency,
        time: scheduleForm.time,
        dayOfWeek: scheduleForm.dayOfWeek,
        dayOfMonth: scheduleForm.dayOfMonth,
        recipientEmails,
        enabled: scheduleForm.enabled,
      });

      setSchedules([response.data, ...schedules]);
      setActiveTab('schedules');

      // Reset form
      setScheduleForm({
        reportType: 'all',
        frequency: 'weekly',
        time: '08:00',
        dayOfWeek: 1,
        dayOfMonth: 1,
        recipientEmails: '',
        enabled: true,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (reportId: string) => {
    try {
      const response = await axios.get(`/api/compliance/reports/${reportId}/pdf`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `compliance-report-${reportId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (err: any) {
      setError('Failed to download PDF');
    }
  };

  const handleSendEmail = async (reportId: string) => {
    const emails = prompt('Enter recipient emails (comma-separated):');
    if (!emails) return;

    try {
      await axios.post(`/api/compliance/reports/${reportId}/email`, {
        recipientEmails: emails.split(',').map((e: string) => e.trim()),
      });
      alert('Report sent successfully');
    } catch (err: any) {
      setError('Failed to send report email');
    }
  };

  const handleUpdateSchedule = async (scheduleId: string, updates: Partial<Schedule>) => {
    try {
      setLoading(true);
      const response = await axios.put(`/api/compliance/schedules/${scheduleId}`, updates);
      setSchedules(schedules.map(s => s.id === scheduleId ? response.data : s));
    } catch (err: any) {
      setError('Failed to update schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;

    try {
      setLoading(true);
      await axios.delete(`/api/compliance/schedules/${scheduleId}`);
      setSchedules(schedules.filter(s => s.id !== scheduleId));
    } catch (err: any) {
      setError('Failed to delete schedule');
    } finally {
      setLoading(false);
    }
  };

  const getReportTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      breach: 'Data Breach Log',
      access: 'Access Log',
      changelog: 'Change Log',
      security: 'Security Checklist',
      incident: 'Incident Report',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string): string => {
    const badges: Record<string, string> = {
      pending: 'badge-pending',
      completed: 'badge-completed',
      failed: 'badge-failed',
    };
    return badges[status] || '';
  };

  return (
    <div className="compliance-reports-container">
      <header className="compliance-header">
        <h1>Compliance Reporting</h1>
        <p>Automated SOC 2 & HIPAA compliance reports</p>
      </header>

      {error && (
        <div className="error-alert">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
        <button
          className={`tab ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          Schedules
        </button>
        <button
          className={`tab ${activeTab === 'generate' ? 'active' : ''}`}
          onClick={() => setActiveTab('generate')}
        >
          Generate Report
        </button>
      </div>

      {activeTab === 'reports' && (
        <div className="tab-content">
          <div className="reports-grid">
            {reports.length === 0 ? (
              <div className="empty-state">
                <p>No reports generated yet</p>
                <button onClick={() => setActiveTab('generate')} className="btn-primary">
                  Generate First Report
                </button>
              </div>
            ) : (
              reports.map(report => (
                <div key={report.id} className="report-card">
                  <div className="report-header">
                    <h3>{getReportTypeLabel(report.type)}</h3>
                    <span className={`badge ${getStatusBadge(report.status)}`}>
                      {report.status}
                    </span>
                  </div>

                  <div className="report-meta">
                    <p>
                      <strong>Generated:</strong> {new Date(report.generatedAt).toLocaleString()}
                    </p>
                    <p>
                      <strong>Period:</strong> {new Date(report.period.startDate).toLocaleDateString()} -
                      {new Date(report.period.endDate).toLocaleDateString()}
                    </p>
                    <p>
                      <strong>Standards:</strong> {report.complianceStandards.join(', ')}
                    </p>
                  </div>

                  <div className="report-summary">
                    {report.type === 'breach' && (
                      <div>
                        <p>Breaches: <strong>{report.data.totalBreaches}</strong></p>
                        <p>Affected Records: <strong>{report.data.totalAffectedRecords}</strong></p>
                      </div>
                    )}
                    {report.type === 'access' && (
                      <div>
                        <p>Access Events: <strong>{report.data.totalAccessEvents}</strong></p>
                        <p>Failed Attempts: <strong>{report.data.failedAccessAttempts}</strong></p>
                      </div>
                    )}
                    {report.type === 'changelog' && (
                      <div>
                        <p>Total Changes: <strong>{report.data.totalChanges}</strong></p>
                        <p>Delete Operations: <strong>{report.data.deleteOperations}</strong></p>
                      </div>
                    )}
                    {report.type === 'security' && (
                      <div>
                        <p>Compliance Score: <strong>{report.data.complianceScore?.toFixed(1) || 0}%</strong></p>
                        <p>Status: {report.data.passCount} Pass / {report.data.failCount} Fail</p>
                      </div>
                    )}
                    {report.type === 'incident' && (
                      <div>
                        <p>Total Incidents: <strong>{report.data.totalIncidents}</strong></p>
                        <p>Open: {report.data.openIncidents}, Escalated: {report.data.escalatedIncidents}</p>
                      </div>
                    )}
                  </div>

                  {report.data.complianceNotes?.length > 0 && (
                    <div className="compliance-notes">
                      <strong>Notes:</strong>
                      <ul>
                        {report.data.complianceNotes.slice(0, 3).map((note: string, i: number) => (
                          <li key={i}>{note}</li>
                        ))}
                        {report.data.complianceNotes.length > 3 && (
                          <li>+{report.data.complianceNotes.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="report-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => setSelectedReport(report)}
                    >
                      View Details
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleDownloadPDF(report.id)}
                    >
                      Download PDF
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => handleSendEmail(report.id)}
                    >
                      Send via Email
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="tab-content">
          <div className="schedules-section">
            {schedules.length === 0 ? (
              <div className="empty-state">
                <p>No schedules configured</p>
                <button onClick={() => setActiveTab('generate')} className="btn-primary">
                  Create First Schedule
                </button>
              </div>
            ) : (
              <div className="schedules-list">
                {schedules.map(schedule => (
                  <div key={schedule.id} className="schedule-item">
                    <div className="schedule-header">
                      <h3>
                        {schedule.reportType === 'all' ? 'All Reports' : getReportTypeLabel(schedule.reportType)}
                      </h3>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={schedule.enabled}
                          onChange={(e) =>
                            handleUpdateSchedule(schedule.id, { enabled: e.target.checked })
                          }
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div className="schedule-details">
                      <p><strong>Frequency:</strong> {schedule.frequency}</p>
                      <p><strong>Time:</strong> {schedule.time || 'Not set'}</p>
                      <p><strong>Recipients:</strong> {schedule.recipientEmails.length}</p>
                      {schedule.nextRun && (
                        <p><strong>Next Run:</strong> {new Date(schedule.nextRun).toLocaleString()}</p>
                      )}
                      {schedule.lastRun && (
                        <p><strong>Last Run:</strong> {new Date(schedule.lastRun).toLocaleString()}</p>
                      )}
                    </div>

                    <div className="schedule-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => alert(schedule.recipientEmails.join('\n'))}
                      >
                        View Recipients
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => handleDeleteSchedule(schedule.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'generate' && (
        <div className="tab-content">
          <div className="form-container">
            <h2>Generate New Report</h2>

            <form onSubmit={handleGenerateReport} className="generate-form">
              <fieldset>
                <legend>Report Types</legend>
                <div className="checkbox-group">
                  {['breach', 'access', 'changelog', 'security', 'incident'].map(type => (
                    <label key={type} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={generateForm.reportTypes.includes(type as any)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGenerateForm({
                              ...generateForm,
                              reportTypes: [...generateForm.reportTypes, type as any],
                            });
                          } else {
                            setGenerateForm({
                              ...generateForm,
                              reportTypes: generateForm.reportTypes.filter(t => t !== type),
                            });
                          }
                        }}
                      />
                      {getReportTypeLabel(type)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Compliance Standards</legend>
                <div className="checkbox-group">
                  {['SOC2', 'HIPAA'].map(standard => (
                    <label key={standard} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={generateForm.complianceStandards.includes(standard as any)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGenerateForm({
                              ...generateForm,
                              complianceStandards: [...generateForm.complianceStandards, standard as any],
                            });
                          } else {
                            setGenerateForm({
                              ...generateForm,
                              complianceStandards: generateForm.complianceStandards.filter(s => s !== standard),
                            });
                          }
                        }}
                      />
                      {standard}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={generateForm.startDate.toISOString().split('T')[0]}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        startDate: new Date(e.target.value),
                      })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={generateForm.endDate.toISOString().split('T')[0]}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        endDate: new Date(e.target.value),
                      })
                    }
                    required
                  />
                </div>
              </div>

              <fieldset>
                <legend>Options</legend>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={generateForm.exportPDF}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        exportPDF: e.target.checked,
                      })
                    }
                  />
                  Export as PDF
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={generateForm.sendEmail}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        sendEmail: e.target.checked,
                      })
                    }
                  />
                  Send via Email
                </label>
              </fieldset>

              {generateForm.sendEmail && (
                <div className="form-group">
                  <label>Recipient Emails (comma-separated)</label>
                  <textarea
                    value={generateForm.emailRecipients}
                    onChange={(e) =>
                      setGenerateForm({
                        ...generateForm,
                        emailRecipients: e.target.value,
                      })
                    }
                    placeholder="auditor@example.com, compliance@example.com"
                    rows={3}
                  />
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Generating...' : 'Generate Report'}
                </button>
              </div>
            </form>
          </div>

          <div className="form-container">
            <h2>Create Scheduled Report</h2>

            <form onSubmit={handleCreateSchedule} className="schedule-form">
              <div className="form-group">
                <label>Report Type</label>
                <select
                  value={scheduleForm.reportType}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      reportType: e.target.value as any,
                    })
                  }
                >
                  <option value="all">All Reports</option>
                  <option value="breach">Data Breach Log</option>
                  <option value="access">Access Log</option>
                  <option value="changelog">Change Log</option>
                  <option value="security">Security Checklist</option>
                  <option value="incident">Incident Report</option>
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Frequency</label>
                  <select
                    value={scheduleForm.frequency}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        frequency: e.target.value as any,
                      })
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Time (HH:MM)</label>
                  <input
                    type="time"
                    value={scheduleForm.time}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        time: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {scheduleForm.frequency === 'weekly' && (
                <div className="form-group">
                  <label>Day of Week</label>
                  <select
                    value={scheduleForm.dayOfWeek}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        dayOfWeek: parseInt(e.target.value),
                      })
                    }
                  >
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </div>
              )}

              {scheduleForm.frequency === 'monthly' && (
                <div className="form-group">
                  <label>Day of Month</label>
                  <select
                    value={scheduleForm.dayOfMonth}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        dayOfMonth: parseInt(e.target.value),
                      })
                    }
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Recipient Emails (comma-separated)</label>
                <textarea
                  value={scheduleForm.recipientEmails}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      recipientEmails: e.target.value,
                    })
                  }
                  placeholder="auditor1@example.com, auditor2@example.com"
                  rows={3}
                  required
                />
              </div>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={scheduleForm.enabled}
                  onChange={(e) =>
                    setScheduleForm({
                      ...scheduleForm,
                      enabled: e.target.checked,
                    })
                  }
                />
                Enable Schedule
              </label>

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedReport && (
        <div className="modal-overlay" onClick={() => setSelectedReport(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{getReportTypeLabel(selectedReport.type)}</h2>
              <button className="btn-close" onClick={() => setSelectedReport(null)}>×</button>
            </div>

            <div className="modal-body">
              <pre>{JSON.stringify(selectedReport.data, null, 2)}</pre>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => handleDownloadPDF(selectedReport.id)}
              >
                Download PDF
              </button>
              <button
                className="btn-secondary"
                onClick={() => handleSendEmail(selectedReport.id)}
              >
                Send Email
              </button>
              <button
                className="btn-primary"
                onClick={() => setSelectedReport(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceReports;
