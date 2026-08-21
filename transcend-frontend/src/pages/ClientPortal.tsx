import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import './ClientPortal.css';

interface CaseDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedDate: string;
  access: 'public' | 'confidential';
}

interface CaseMessage {
  id: string;
  from: string;
  date: string;
  time: string;
  message: string;
  type: 'email' | 'message';
}

interface ClientCase {
  id: string;
  service: string;
  status: string;
  attorney: {
    name: string;
    email: string;
    phone: string;
  };
  createdAt: string;
  cost: number;
  description: string;
}

const ClientPortal: React.FC = () => {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'messages'>('overview');
  const [cases, setCases] = useState<ClientCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<ClientCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');

  // Mock case data
  useEffect(() => {
    const mockCases: ClientCase[] = [
      {
        id: '1',
        service: 'Employment Law - Wrongful Termination',
        status: 'In Progress',
        attorney: {
          name: 'Sarah Johnson, Esq.',
          email: 'sarah@lawfirm.com',
          phone: '(555) 123-4567',
        },
        createdAt: '2026-07-31',
        cost: 2150,
        description: 'Wrongful termination case. Our team is actively working on your case to secure the best possible outcome.',
      },
    ];
    setCases(mockCases);
    if (mockCases.length > 0) {
      setSelectedCase(mockCases[0]);
    }
    setLoading(false);
  }, []);

  const mockDocuments: CaseDocument[] = [
    { id: '1', name: 'Case Summary.pdf', type: 'pdf', size: '1.2 MB', uploadedDate: '2026-08-15', access: 'public' },
    { id: '2', name: 'Settlement Offer.pdf', type: 'pdf', size: '0.8 MB', uploadedDate: '2026-08-18', access: 'public' },
    { id: '3', name: 'Legal Strategy.pdf', type: 'pdf', size: '2.1 MB', uploadedDate: '2026-08-10', access: 'confidential' },
  ];

  const mockMessages: CaseMessage[] = [
    {
      id: '1',
      from: 'Sarah Johnson',
      date: '2026-08-18',
      time: '10:30 AM',
      message: 'Hi! We have received the opposing counsel\'s response. I\'ll review it and provide you with a detailed analysis by end of week.',
      type: 'message',
    },
    {
      id: '2',
      from: 'You',
      date: '2026-08-15',
      time: '2:15 PM',
      message: 'Thank you for the update. I\'m prepared to discuss settlement options if you think it\'s appropriate.',
      type: 'message',
    },
    {
      id: '3',
      from: 'Sarah Johnson',
      date: '2026-08-12',
      time: '11:00 AM',
      message: 'Initial review is complete. The case looks strong. I\'ll prepare a detailed strategy memo for you.',
      type: 'message',
    },
  ];

  const publicDocuments = mockDocuments.filter(d => d.access === 'public');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setNewMessage('');
      alert('Message sent to your attorney');
    }
  };

  if (loading) {
    return <div className="client-portal-loading">Loading...</div>;
  }

  if (!selectedCase) {
    return <div className="client-portal-error">No cases found</div>;
  }

  return (
    <div className="client-portal-container">
      {/* Header */}
      <div className="client-header">
        <div className="client-greeting">
          <h1>Welcome, {user?.email?.split('@')[0] || 'Client'}!</h1>
          <p>Your case details and communication with your attorney are below.</p>
        </div>
      </div>

      {/* Case Overview Cards */}
      <div className="case-cards-grid">
        <div className="case-card">
          <div className="card-label">Your Attorney</div>
          <div className="card-value">{selectedCase.attorney.name}</div>
          <div className="card-meta">⭐ Trusted Professional</div>
        </div>
        <div className="case-card">
          <div className="card-label">Case Status</div>
          <div className={`card-value status-${selectedCase.status.toLowerCase()}`}>{selectedCase.status}</div>
          <div className="card-meta">Active</div>
        </div>
        <div className="case-card">
          <div className="card-label">Total Spent</div>
          <div className="card-value">${selectedCase.cost.toLocaleString()}</div>
          <div className="card-meta">Since {new Date(selectedCase.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      {/* Case Details Section */}
      <div className="case-details-section">
        <div className="section-header">
          <h2>{selectedCase.service}</h2>
          <span className="status-badge">{selectedCase.status.toUpperCase()}</span>
        </div>

        <div className="attorney-contact">
          <h3>Your Attorney</h3>
          <div className="attorney-card">
            <div className="attorney-info">
              <div className="attorney-name">{selectedCase.attorney.name}</div>
              <div className="attorney-phone">📞 {selectedCase.attorney.phone}</div>
              <div className="attorney-email">✉️ {selectedCase.attorney.email}</div>
            </div>
          </div>
        </div>

        <div className="case-description">
          <h3>Case Summary</h3>
          <p>{selectedCase.description}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="client-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          Documents ({publicDocuments.length})
        </button>
        <button
          className={`tab ${activeTab === 'messages' ? 'active' : ''}`}
          onClick={() => setActiveTab('messages')}
        >
          Messages
        </button>
      </div>

      {/* Tab Content */}
      <div className="client-content">
        {activeTab === 'overview' && (
          <div className="tab-pane">
            <div className="info-section">
              <h3>About Your Case</h3>
              <p>
                {selectedCase.description}
              </p>
              <div className="important-note">
                <strong>📌 Important:</strong> All communication with your attorney is confidential and privileged.
                Please keep this portal secure and do not share your login credentials.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="tab-pane">
            <div className="documents-section">
              <h3>Case Documents</h3>
              <p className="docs-note">You have access to the following documents shared by your attorney:</p>

              {publicDocuments.length === 0 ? (
                <div className="no-documents">No documents available yet. Your attorney will share documents as the case progresses.</div>
              ) : (
                <div className="documents-list">
                  {publicDocuments.map((doc) => (
                    <div key={doc.id} className="document-item">
                      <div className="doc-icon">📄</div>
                      <div className="doc-info">
                        <div className="doc-name">{doc.name}</div>
                        <div className="doc-meta">Uploaded {doc.uploadedDate} • {doc.size}</div>
                      </div>
                      <button className="download-btn">Download</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="tab-pane">
            <div className="messages-section">
              <h3>Communication</h3>
              <div className="messages-list">
                {mockMessages.map((msg) => (
                  <div key={msg.id} className={`message-item ${msg.from === 'You' ? 'from-client' : 'from-attorney'}`}>
                    <div className="message-header">
                      <div className="message-from">{msg.from}</div>
                      <div className="message-date">{msg.date} at {msg.time}</div>
                    </div>
                    <div className="message-body">{msg.message}</div>
                  </div>
                ))}
              </div>

              <div className="message-compose">
                <h4>Send a Message</h4>
                <textarea
                  className="message-input"
                  placeholder="Type your message here..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                />
                <button
                  className="send-btn"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  Send Message
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="security-notice">
        <strong>🔒 Security Notice:</strong> This portal is encrypted and secure. Never share your password with anyone,
        including your attorney's office.
      </div>
    </div>
  );
};

export default ClientPortal;
