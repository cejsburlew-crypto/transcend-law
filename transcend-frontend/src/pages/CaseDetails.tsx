import React, { useState } from 'react';
import { PrimaryButton } from '@/components/UI';
import TasksTab from '@/pages/TasksTab';
import NotesTab from '@/pages/NotesTab';
import AppointmentsTab from '@/pages/AppointmentsTab';
import WorkflowTab from '@/pages/WorkflowTab';
import './CaseDetails.css';

interface CaseDetailsPageProps {
  caseId: string;
  onBack: () => void;
}

interface Communication {
  id: string;
  from: string;
  to: string;
  date: string;
  time: string;
  message: string;
  type: 'email' | 'sms' | 'call' | 'note';
}

interface Document {
  id: string;
  name: string;
  type: string;
  uploadedDate: string;
  size: string;
}

export const CaseDetails: React.FC<CaseDetailsPageProps> = ({ caseId, onBack }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'intake' | 'communications' | 'documents' | 'timeline' | 'appointments' | 'workflow' | 'tasks' | 'notes'>('overview');

  // Mock case data
  const caseData = {
    id: caseId,
    service: 'Employment Law - Wrongful Termination',
    status: 'active',
    createdAt: '2026-08-01',
    cost: 2150,
    provider: { name: 'Sarah Johnson, Esq.', rating: 4.9, phone: '(555) 123-4567', email: 'sarah@lawfirm.com' },
    client: {
      name: 'Alex Thompson',
      email: 'alex.thompson@email.com',
      phone: '(555) 987-6543',
      company: 'Tech Corp Inc.',
      position: 'Senior Developer'
    },
    intake: {
      caseDescription: 'Terminated from Tech Corp after 8 years of service without cause. Believe this was retaliation for reporting safety concerns.',
      employmentType: 'Full-time',
      yearsEmployed: 8,
      salary: '$125,000',
      severanceOffered: 'None',
      witnesses: 'Multiple colleagues present at termination meeting',
      desiredOutcome: 'Reinstatement or substantial severance package'
    },
    communications: [
      {
        id: '1',
        from: 'Sarah Johnson',
        to: 'Alex Thompson',
        date: '2026-08-15',
        time: '10:30 AM',
        message: 'Initial consultation call completed. Reviewing employment contract and gathering documentation.',
        type: 'note'
      },
      {
        id: '2',
        from: 'Alex Thompson',
        to: 'Sarah Johnson',
        date: '2026-08-16',
        time: '2:15 PM',
        message: 'Sent employment contract and email correspondence with HR',
        type: 'email'
      },
      {
        id: '3',
        from: 'Sarah Johnson',
        to: 'Alex Thompson',
        date: '2026-08-17',
        time: '11:00 AM',
        message: 'Follow-up call to discuss strategy. Have identified potential claims.',
        type: 'call'
      },
      {
        id: '4',
        from: 'Sarah Johnson',
        to: 'Alex Thompson',
        date: '2026-08-18',
        time: '3:45 PM',
        message: 'Demand letter drafted and ready for review. Scheduling meeting to finalize.',
        type: 'note'
      }
    ] as Communication[],
    documents: [
      { id: '1', name: 'Employment Contract.pdf', type: 'pdf', uploadedDate: '2026-08-16', size: '2.3 MB' },
      { id: '2', name: 'Termination Letter.pdf', type: 'pdf', uploadedDate: '2026-08-16', size: '0.5 MB' },
      { id: '3', name: 'Email Correspondence.pdf', type: 'pdf', uploadedDate: '2026-08-16', size: '1.8 MB' },
      { id: '4', name: 'Performance Reviews.pdf', type: 'pdf', uploadedDate: '2026-08-17', size: '3.2 MB' },
      { id: '5', name: 'Demand Letter - Draft.docx', type: 'docx', uploadedDate: '2026-08-18', size: '0.8 MB' }
    ] as Document[]
  };

  const timeline = [
    { date: '2026-08-01', event: 'Case created', type: 'milestone' },
    { date: '2026-08-15', event: 'Initial consultation completed', type: 'communication' },
    { date: '2026-08-16', event: 'Documents received and reviewed', type: 'document' },
    { date: '2026-08-17', event: 'Strategy discussion with client', type: 'communication' },
    { date: '2026-08-18', event: 'Demand letter drafted', type: 'document' }
  ];

  return (
    <div className="case-details-container">
      {/* Header */}
      <div className="case-details-header">
        <button className="back-button" onClick={onBack}>← Back to Cases</button>
        <div className="case-title-section">
          <h1>{caseData.service}</h1>
          <div className="case-meta">
            <span className={`status-badge ${caseData.status}`}>{caseData.status.toUpperCase()}</span>
            <span className="case-id">Case #{caseData.id}</span>
          </div>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="case-quick-info">
        <div className="info-card">
          <div className="info-label">Provider</div>
          <div className="info-value">{caseData.provider.name}</div>
          <div className="info-subtext">⭐ {caseData.provider.rating}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Cost to Date</div>
          <div className="info-value">${caseData.cost.toLocaleString()}</div>
          <div className="info-subtext">Since {new Date(caseData.createdAt).toLocaleDateString()}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Contact</div>
          <div className="info-value">{caseData.provider.phone}</div>
          <div className="info-subtext">{caseData.provider.email}</div>
        </div>
        <div className="info-card">
          <div className="info-label">Client</div>
          <div className="info-value">{caseData.client.name}</div>
          <div className="info-subtext">{caseData.client.phone}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="case-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'intake' ? 'active' : ''}`}
          onClick={() => setActiveTab('intake')}
        >
          Intake
        </button>
        <button
          className={`tab ${activeTab === 'communications' ? 'active' : ''}`}
          onClick={() => setActiveTab('communications')}
        >
          Communications
        </button>
        <button
          className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Documents
        </button>
        <button
          className={`tab ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={`tab ${activeTab === 'appointments' ? 'active' : ''}`}
          onClick={() => setActiveTab('appointments')}
        >
          Appointments
        </button>
        <button
          className={`tab ${activeTab === 'workflow' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflow')}
        >
          Workflow
        </button>
        <button
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          Notes
        </button>
      </div>

      {/* Tab Content */}
      <div className="case-content">
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <div className="section">
              <h2>Client Information</h2>
              <div className="info-grid">
                <div className="info-item">
                  <label>Name</label>
                  <p>{caseData.client.name}</p>
                </div>
                <div className="info-item">
                  <label>Email</label>
                  <p>{caseData.client.email}</p>
                </div>
                <div className="info-item">
                  <label>Phone</label>
                  <p>{caseData.client.phone}</p>
                </div>
                <div className="info-item">
                  <label>Company</label>
                  <p>{caseData.client.company}</p>
                </div>
                <div className="info-item">
                  <label>Position</label>
                  <p>{caseData.client.position}</p>
                </div>
                <div className="info-item">
                  <label>Case Started</label>
                  <p>{new Date(caseData.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="section">
              <h2>Provider Information</h2>
              <div className="info-grid">
                <div className="info-item">
                  <label>Attorney</label>
                  <p>{caseData.provider.name}</p>
                </div>
                <div className="info-item">
                  <label>Rating</label>
                  <p>⭐ {caseData.provider.rating} / 5.0</p>
                </div>
                <div className="info-item">
                  <label>Phone</label>
                  <p>{caseData.provider.phone}</p>
                </div>
                <div className="info-item">
                  <label>Email</label>
                  <p>{caseData.provider.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'intake' && (
          <div className="tab-pane">
            <div className="section">
              <h2>Case Intake Information</h2>
              <div className="info-grid">
                <div className="info-item full-width">
                  <label>Case Description</label>
                  <p>{caseData.intake.caseDescription}</p>
                </div>
                <div className="info-item">
                  <label>Employment Type</label>
                  <p>{caseData.intake.employmentType}</p>
                </div>
                <div className="info-item">
                  <label>Years Employed</label>
                  <p>{caseData.intake.yearsEmployed} years</p>
                </div>
                <div className="info-item">
                  <label>Salary</label>
                  <p>{caseData.intake.salary}</p>
                </div>
                <div className="info-item">
                  <label>Severance Offered</label>
                  <p>{caseData.intake.severanceOffered}</p>
                </div>
                <div className="info-item full-width">
                  <label>Witnesses</label>
                  <p>{caseData.intake.witnesses}</p>
                </div>
                <div className="info-item full-width">
                  <label>Desired Outcome</label>
                  <p>{caseData.intake.desiredOutcome}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'communications' && (
          <div className="tab-pane">
            <div className="section">
              <div className="section-header">
                <h2>Communications</h2>
                <PrimaryButton onClick={() => {}}>+ New Message</PrimaryButton>
              </div>
              <div className="communications-list">
                {caseData.communications.map((comm) => (
                  <div key={comm.id} className={`communication-item ${comm.type}`}>
                    <div className="comm-header">
                      <div>
                        <div className="comm-type">{comm.type.toUpperCase()}</div>
                        <div className="comm-participants">{comm.from} → {comm.to}</div>
                      </div>
                      <div className="comm-datetime">
                        <div>{comm.date}</div>
                        <div>{comm.time}</div>
                      </div>
                    </div>
                    <div className="comm-message">{comm.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="tab-pane">
            <div className="section">
              <div className="section-header">
                <h2>Documents</h2>
                <PrimaryButton onClick={() => {}}>+ Upload Document</PrimaryButton>
              </div>
              <div className="documents-list">
                {caseData.documents.map((doc) => (
                  <div key={doc.id} className="document-item">
                    <div className="doc-icon">{doc.type === 'pdf' ? '📄' : '📝'}</div>
                    <div className="doc-info">
                      <div className="doc-name">{doc.name}</div>
                      <div className="doc-meta">Uploaded {doc.uploadedDate} • {doc.size}</div>
                    </div>
                    <button className="doc-action">Download</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="tab-pane">
            <div className="section">
              <h2>Case Timeline</h2>
              <div className="timeline">
                {timeline.map((item, index) => (
                  <div key={index} className={`timeline-item ${item.type}`}>
                    <div className="timeline-dot"></div>
                    <div className="timeline-content">
                      <div className="timeline-date">{item.date}</div>
                      <div className="timeline-event">{item.event}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appointments' && (
          <AppointmentsTab caseId={caseId} />
        )}

        {activeTab === 'workflow' && (
          <WorkflowTab caseId={caseId} />
        )}

        {activeTab === 'tasks' && (
          <TasksTab caseId={caseId} />
        )}

        {activeTab === 'notes' && (
          <NotesTab caseId={caseId} />
        )}
      </div>
    </div>
  );
};

export default CaseDetails;
