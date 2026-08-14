import React, { useState } from 'react'
import './ServiceContractNegotiation.css'

interface ContractRequest {
  id: string
  clientName: string
  clientAvatar: string
  serviceName: string
  serviceIcon: string
  requestedDate: string
  projectDescription: string
  clientBudget: number
  contractStatus: 'pending' | 'negotiating' | 'accepted' | 'declined'
  messages: Message[]
  proposedTerms: ProposedTerms | null
}

interface Message {
  id: string
  sender: 'client' | 'provider'
  senderName: string
  message: string
  timestamp: string
  isTermsUpdate?: boolean
}

interface ProposedTerms {
  scope: string
  rate: number
  timeline: string
  payment: string
}

interface ServiceContractNegotiationProps {
  provider: { name: string; avatar: string; id: string }
  onBack: () => void
}

export const ServiceContractNegotiation: React.FC<ServiceContractNegotiationProps> = ({
  provider,
  onBack,
}) => {
  const [selectedRequest, setSelectedRequest] = useState<ContractRequest | null>(null)
  const [messageText, setMessageText] = useState('')
  const [activeTab, setActiveTab] = useState('pending')

  const pendingRequests: ContractRequest[] = [
    {
      id: 'req-1',
      clientName: 'ABC Corp',
      clientAvatar: '🏢',
      serviceName: 'Contract Reviewer',
      serviceIcon: '📑',
      requestedDate: 'Today',
      projectDescription: 'Review and negotiate vendor contract for software services',
      clientBudget: 1500,
      contractStatus: 'pending',
      messages: [],
      proposedTerms: null,
    },
    {
      id: 'req-2',
      clientName: 'Sarah Chen',
      clientAvatar: '👩‍💼',
      serviceName: 'Legal Consultant',
      serviceIcon: '⚖️',
      requestedDate: 'Tomorrow',
      projectDescription: 'Consultation on business formation and LLC setup',
      clientBudget: 800,
      contractStatus: 'pending',
      messages: [],
      proposedTerms: null,
    },
  ]

  const negotiatingRequests: ContractRequest[] = [
    {
      id: 'req-3',
      clientName: 'John Davis',
      clientAvatar: '👨‍💼',
      serviceName: 'Compliance Consultant',
      serviceIcon: '✓',
      requestedDate: '2 days ago',
      projectDescription: 'GDPR compliance audit and remediation plan',
      clientBudget: 2500,
      contractStatus: 'negotiating',
      messages: [
        {
          id: 'msg-1',
          sender: 'client',
          senderName: 'John Davis',
          message: 'Hi! We need help with GDPR compliance. Can you provide an audit?',
          timestamp: '2 hours ago',
        },
        {
          id: 'msg-2',
          sender: 'provider',
          senderName: 'You',
          message: 'Yes, I can help! Let me send you a proposal with terms.',
          timestamp: '1 hour ago',
          isTermsUpdate: true,
        },
      ],
      proposedTerms: {
        scope: 'Full GDPR audit, risk assessment, and remediation roadmap',
        rate: 2200,
        timeline: '3-4 weeks',
        payment: '50% upfront, 50% on completion',
      },
    },
  ]

  const acceptedRequests: ContractRequest[] = [
    {
      id: 'req-4',
      clientName: 'TechStart Inc',
      clientAvatar: '💻',
      serviceName: 'Contract Reviewer',
      serviceIcon: '📑',
      requestedDate: '1 week ago',
      projectDescription: 'Review employment agreements for new hires',
      clientBudget: 1200,
      contractStatus: 'accepted',
      messages: [
        {
          id: 'msg-3',
          sender: 'client',
          senderName: 'TechStart Inc',
          message: '✅ Contract accepted! Ready to start whenever you are.',
          timestamp: '3 days ago',
        },
      ],
      proposedTerms: {
        scope: 'Review 10 employment agreements',
        rate: 1200,
        timeline: '1 week',
        payment: 'Full payment due on completion',
      },
    },
  ]

  const handleSendMessage = () => {
    if (!messageText.trim() || !selectedRequest) return

    const updatedRequest = {
      ...selectedRequest,
      messages: [
        ...selectedRequest.messages,
        {
          id: `msg-${Date.now()}`,
          sender: 'provider',
          senderName: 'You',
          message: messageText,
          timestamp: 'just now',
        },
      ],
    }

    setSelectedRequest(updatedRequest)
    setMessageText('')
  }

  const handleAcceptContract = () => {
    if (!selectedRequest) return
    alert(`✅ Contract accepted! Referral fee will be collected when client confirms completion.`)
    setSelectedRequest(null)
  }

  const handleDeclineContract = () => {
    if (!selectedRequest) return
    alert(`❌ Contract declined. Client will be notified.`)
    setSelectedRequest(null)
  }

  const handleProposeTerms = () => {
    if (!selectedRequest) return
    alert('📝 Proposal sent to client! They can review and negotiate or accept.')
  }

  const getRequests = () => {
    switch (activeTab) {
      case 'pending':
        return pendingRequests
      case 'negotiating':
        return negotiatingRequests
      case 'accepted':
        return acceptedRequests
      default:
        return pendingRequests
    }
  }

  const requests = getRequests()

  return (
    <div className="contract-negotiation">
      {/* Header */}
      <div className="contract-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>💼 Contract Negotiations</h1>
        <p>Communicate with clients and negotiate service terms</p>
      </div>

      {/* Provider Info Bar */}
      <div className="provider-info-bar">
        <div className="provider-info">
          <div className="provider-avatar">{provider.avatar}</div>
          <div>
            <h3>{provider.name}</h3>
            <p>Review and accept service requests • Earn referral fees</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="contract-tabs">
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          📬 Pending ({pendingRequests.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'negotiating' ? 'active' : ''}`}
          onClick={() => setActiveTab('negotiating')}
        >
          💬 Negotiating ({negotiatingRequests.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'accepted' ? 'active' : ''}`}
          onClick={() => setActiveTab('accepted')}
        >
          ✅ Accepted ({acceptedRequests.length})
        </button>
      </div>

      <div className="contract-content">
        {/* Requests List */}
        <div className="requests-list">
          {requests.map((request) => (
            <div
              key={request.id}
              className={`request-card ${request.contractStatus} ${
                selectedRequest?.id === request.id ? 'selected' : ''
              }`}
              onClick={() => setSelectedRequest(request)}
            >
              <div className="request-header">
                <div className="client-info">
                  <div className="client-avatar">{request.clientAvatar}</div>
                  <div>
                    <h4>{request.clientName}</h4>
                    <p>{request.serviceName} • {request.requestedDate}</p>
                  </div>
                </div>
                <div className="budget-badge">${request.clientBudget}</div>
              </div>

              <p className="request-description">{request.projectDescription}</p>

              <div className="request-status">
                {request.contractStatus === 'pending' && (
                  <span className="status-badge pending">Awaiting Response</span>
                )}
                {request.contractStatus === 'negotiating' && (
                  <span className="status-badge negotiating">In Discussion</span>
                )}
                {request.contractStatus === 'accepted' && (
                  <span className="status-badge accepted">✅ Accepted</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Details Panel */}
        {selectedRequest ? (
          <div className="details-panel">
            <div className="details-header">
              <h2>
                {selectedRequest.serviceIcon} {selectedRequest.serviceName}
              </h2>
              <button className="close-btn" onClick={() => setSelectedRequest(null)}>
                ✕
              </button>
            </div>

            <div className="client-card">
              <div className="client-info-detailed">
                <div className="client-avatar-lg">{selectedRequest.clientAvatar}</div>
                <div>
                  <h3>{selectedRequest.clientName}</h3>
                  <p>Client Budget: ${selectedRequest.clientBudget}</p>
                </div>
              </div>
            </div>

            <div className="project-details">
              <h4>Project Details</h4>
              <p>{selectedRequest.projectDescription}</p>
            </div>

            {/* Proposed Terms */}
            {selectedRequest.proposedTerms && (
              <div className="proposed-terms">
                <h4>📋 Your Proposed Terms</h4>
                <div className="terms-grid">
                  <div className="term">
                    <span className="term-label">Scope:</span>
                    <span className="term-value">{selectedRequest.proposedTerms.scope}</span>
                  </div>
                  <div className="term">
                    <span className="term-label">Rate:</span>
                    <span className="term-value">${selectedRequest.proposedTerms.rate}</span>
                  </div>
                  <div className="term">
                    <span className="term-label">Timeline:</span>
                    <span className="term-value">{selectedRequest.proposedTerms.timeline}</span>
                  </div>
                  <div className="term">
                    <span className="term-label">Payment:</span>
                    <span className="term-value">{selectedRequest.proposedTerms.payment}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="messages-section">
              <h4>💬 Messages</h4>
              <div className="messages-list">
                {selectedRequest.messages.map((msg) => (
                  <div key={msg.id} className={`message ${msg.sender}`}>
                    <div className="message-meta">
                      <strong>{msg.senderName}</strong>
                      <span className="message-time">{msg.timestamp}</span>
                    </div>
                    <p className="message-text">{msg.message}</p>
                    {msg.isTermsUpdate && (
                      <div className="terms-notification">📋 Proposed terms sent</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Message Input */}
              {selectedRequest.contractStatus !== 'accepted' && (
                <div className="message-input-section">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                  />
                  <button
                    className="btn-send"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim()}
                  >
                    Send Message
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="action-buttons">
              {selectedRequest.contractStatus === 'pending' && (
                <>
                  <button className="btn-propose" onClick={handleProposeTerms}>
                    📋 Propose Terms
                  </button>
                  <button className="btn-decline" onClick={handleDeclineContract}>
                    Decline Request
                  </button>
                </>
              )}

              {selectedRequest.contractStatus === 'negotiating' && (
                <>
                  <button className="btn-accept" onClick={handleAcceptContract}>
                    ✅ Accept Contract
                  </button>
                  <button className="btn-decline" onClick={handleDeclineContract}>
                    Decline & Withdraw
                  </button>
                </>
              )}

              {selectedRequest.contractStatus === 'accepted' && (
                <div className="accepted-info">
                  <p>✅ Contract accepted! You'll earn your referral fee when the client confirms completion.</p>
                  <p className="fee-info">💰 Referral Fee: {Math.round((selectedRequest.proposedTerms?.rate || selectedRequest.clientBudget) * 0.15)}% of service amount</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <p>Select a request to view details and communicate with the client</p>
          </div>
        )}
      </div>
    </div>
  )
}
