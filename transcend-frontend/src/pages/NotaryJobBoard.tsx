import React, { useState } from 'react'
import './NotaryJobBoard.css'

interface NotaryJob {
  id: string
  clientName: string
  serviceType: string
  location: string
  estimatedDuration: string
  urgency: 'low' | 'medium' | 'high' | 'urgent'
  postTime: string
  compensation: number
  details: string
  status: 'open' | 'matched' | 'in-progress' | 'completed'
}

interface NotaryProfile {
  id: string
  name: string
  avatar: string
  rating: number
  completedJobs: number
  availability: 'immediately' | 'in-5' | 'in-15' | 'in-30' | 'offline'
  availabilityLabel: string
  location: string
  specialties: string[]
  acceptanceRate: number
}

interface NotaryJobBoardProps {
  notaryProfile: NotaryProfile
  onBack: () => void
}

export const NotaryJobBoard: React.FC<NotaryJobBoardProps> = ({
  notaryProfile,
  onBack,
}) => {
  const [availability, setAvailability] = useState<'immediately' | 'in-5' | 'in-15' | 'in-30' | 'offline'>('offline')
  const [selectedTab, setSelectedTab] = useState('available')
  const [selectedJob, setSelectedJob] = useState<NotaryJob | null>(null)

  // Mock available jobs
  const availableJobs: NotaryJob[] = [
    {
      id: 'job-1',
      clientName: 'Sarah Thompson',
      serviceType: 'Loan Signing',
      location: '2.3 miles away',
      estimatedDuration: '45 minutes',
      urgency: 'urgent',
      postTime: '2 minutes ago',
      compensation: 150,
      details: 'Residential mortgage refinance documents need notarization',
      status: 'open',
    },
    {
      id: 'job-2',
      clientName: 'John Martinez',
      serviceType: 'Acknowledgment',
      location: '0.8 miles away',
      estimatedDuration: '20 minutes',
      urgency: 'high',
      postTime: '5 minutes ago',
      compensation: 75,
      details: 'Power of attorney document, single witness',
      status: 'open',
    },
    {
      id: 'job-3',
      clientName: 'Lisa Chen',
      serviceType: 'Jurat',
      location: '3.1 miles away',
      estimatedDuration: '30 minutes',
      urgency: 'medium',
      postTime: '8 minutes ago',
      compensation: 100,
      details: 'Affidavit for legal proceeding',
      status: 'open',
    },
  ]

  const acceptedJobs: NotaryJob[] = [
    {
      id: 'job-4',
      clientName: 'Michael Davis',
      serviceType: 'Apostille',
      location: 'Downtown',
      estimatedDuration: '25 minutes',
      urgency: 'medium',
      postTime: '1 hour ago',
      compensation: 120,
      details: 'International document certification',
      status: 'in-progress',
    },
  ]

  const completedJobs: NotaryJob[] = [
    {
      id: 'job-5',
      clientName: 'Jennifer Lee',
      serviceType: 'Loan Signing',
      location: 'Westside',
      estimatedDuration: '50 minutes',
      urgency: 'high',
      postTime: '3 hours ago',
      compensation: 180,
      details: 'Commercial property lease signing',
      status: 'completed',
    },
  ]

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return '#ef4444'
      case 'high':
        return '#f59e0b'
      case 'medium':
        return '#3b82f6'
      default:
        return '#10b981'
    }
  }

  const getAvailabilityLabel = () => {
    switch (availability) {
      case 'immediately':
        return '🟢 Available Now'
      case 'in-5':
        return '🟡 Available in 5 min'
      case 'in-15':
        return '🟡 Available in 15 min'
      case 'in-30':
        return '🟠 Available in 30 min'
      default:
        return '⚫ Offline'
    }
  }

  return (
    <div className="notary-job-board">
      {/* Header */}
      <div className="job-board-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1>🔏 Notary Job Board</h1>
      </div>

      {/* Notary Status Bar */}
      <div className="notary-status-bar">
        <div className="notary-info">
          <div className="notary-avatar">{notaryProfile.avatar}</div>
          <div className="notary-details">
            <h3>{notaryProfile.name}</h3>
            <p>⭐ {notaryProfile.rating} • {notaryProfile.completedJobs} jobs completed • {notaryProfile.acceptanceRate}% acceptance</p>
          </div>
        </div>

        <div className="availability-selector">
          <label>Your Availability:</label>
          <div className="availability-buttons">
            <button
              className={`avail-btn ${availability === 'immediately' ? 'active' : ''}`}
              onClick={() => setAvailability('immediately')}
            >
              🟢 Immediately
            </button>
            <button
              className={`avail-btn ${availability === 'in-5' ? 'active' : ''}`}
              onClick={() => setAvailability('in-5')}
            >
              5 min
            </button>
            <button
              className={`avail-btn ${availability === 'in-15' ? 'active' : ''}`}
              onClick={() => setAvailability('in-15')}
            >
              15 min
            </button>
            <button
              className={`avail-btn ${availability === 'in-30' ? 'active' : ''}`}
              onClick={() => setAvailability('in-30')}
            >
              30 min
            </button>
            <button
              className={`avail-btn offline ${availability === 'offline' ? 'active' : ''}`}
              onClick={() => setAvailability('offline')}
            >
              Offline
            </button>
          </div>
          <p className="current-status">{getAvailabilityLabel()}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="job-board-tabs">
        <button
          className={`tab-btn ${selectedTab === 'available' ? 'active' : ''}`}
          onClick={() => setSelectedTab('available')}
        >
          📋 Available Jobs ({availableJobs.length})
        </button>
        <button
          className={`tab-btn ${selectedTab === 'accepted' ? 'active' : ''}`}
          onClick={() => setSelectedTab('accepted')}
        >
          ✅ Accepted ({acceptedJobs.length})
        </button>
        <button
          className={`tab-btn ${selectedTab === 'completed' ? 'active' : ''}`}
          onClick={() => setSelectedTab('completed')}
        >
          🏁 Completed ({completedJobs.length})
        </button>
      </div>

      {/* Job Board Content */}
      <div className="job-board-content">
        {selectedTab === 'available' && (
          <div className="jobs-section">
            <p className="section-note">
              {availability === 'offline'
                ? '⚫ You are offline. Update your availability to see jobs.'
                : `🟢 Showing jobs for providers available ${getAvailabilityLabel().toLowerCase()}`}
            </p>
            <div className="jobs-list">
              {availableJobs.map((job) => (
                <div key={job.id} className="job-card">
                  <div className="job-header">
                    <div className="job-title-section">
                      <h3>{job.serviceType}</h3>
                      <span
                        className="urgency-badge"
                        style={{ backgroundColor: getUrgencyColor(job.urgency) }}
                      >
                        {job.urgency.toUpperCase()}
                      </span>
                    </div>
                    <div className="job-compensation">${job.compensation}</div>
                  </div>

                  <div className="job-client">
                    <strong>{job.clientName}</strong>
                    <span className="posted-time">{job.postTime}</span>
                  </div>

                  <div className="job-details-grid">
                    <div className="detail">
                      <span className="label">📍 Location:</span>
                      <span className="value">{job.location}</span>
                    </div>
                    <div className="detail">
                      <span className="label">⏱️ Duration:</span>
                      <span className="value">{job.estimatedDuration}</span>
                    </div>
                  </div>

                  <p className="job-description">{job.details}</p>

                  <div className="job-actions">
                    <button
                      className="btn-accept"
                      onClick={() => setSelectedJob(job)}
                      disabled={availability === 'offline'}
                    >
                      Accept Job
                    </button>
                    <button className="btn-details">View Details</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTab === 'accepted' && (
          <div className="jobs-section">
            <div className="jobs-list">
              {acceptedJobs.map((job) => (
                <div key={job.id} className="job-card accepted">
                  <div className="job-header">
                    <div className="job-title-section">
                      <h3>{job.serviceType}</h3>
                      <span className="status-badge">IN PROGRESS</span>
                    </div>
                    <div className="job-compensation">${job.compensation}</div>
                  </div>

                  <div className="job-client">
                    <strong>{job.clientName}</strong>
                  </div>

                  <div className="job-details-grid">
                    <div className="detail">
                      <span className="label">📍 Location:</span>
                      <span className="value">{job.location}</span>
                    </div>
                    <div className="detail">
                      <span className="label">⏱️ Duration:</span>
                      <span className="value">{job.estimatedDuration}</span>
                    </div>
                  </div>

                  <p className="job-description">{job.details}</p>

                  <div className="job-actions">
                    <button className="btn-primary">Complete Job</button>
                    <button className="btn-contact">Contact Client</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTab === 'completed' && (
          <div className="jobs-section">
            <div className="jobs-list">
              {completedJobs.map((job) => (
                <div key={job.id} className="job-card completed">
                  <div className="job-header">
                    <div className="job-title-section">
                      <h3>{job.serviceType}</h3>
                      <span className="status-badge completed">COMPLETED</span>
                    </div>
                    <div className="job-compensation">${job.compensation}</div>
                  </div>

                  <div className="job-client">
                    <strong>{job.clientName}</strong>
                  </div>

                  <div className="job-details-grid">
                    <div className="detail">
                      <span className="label">📍 Location:</span>
                      <span className="value">{job.location}</span>
                    </div>
                    <div className="detail">
                      <span className="label">⏱️ Duration:</span>
                      <span className="value">{job.estimatedDuration}</span>
                    </div>
                  </div>

                  <p className="job-description">{job.details}</p>

                  <div className="job-actions">
                    <button className="btn-secondary">Leave Review</button>
                    <button className="btn-secondary">Invoice</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Job Accept Modal */}
      {selectedJob && (
        <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedJob(null)}>
              ✕
            </button>
            <h2>Confirm Job Acceptance</h2>
            <div className="modal-content">
              <p>
                <strong>Job:</strong> {selectedJob.serviceType}
              </p>
              <p>
                <strong>Client:</strong> {selectedJob.clientName}
              </p>
              <p>
                <strong>Location:</strong> {selectedJob.location}
              </p>
              <p>
                <strong>Estimated Duration:</strong> {selectedJob.estimatedDuration}
              </p>
              <p>
                <strong>Compensation:</strong> ${selectedJob.compensation}
              </p>
              <p>
                <strong>Your ETA:</strong> {getAvailabilityLabel()}
              </p>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setSelectedJob(null)}>
                Cancel
              </button>
              <button className="btn-accept-job" onClick={() => {
                alert(`✅ Job accepted! Client will see you're arriving ${getAvailabilityLabel().toLowerCase()}`)
                setSelectedJob(null)
              }}>
                Accept & Notify Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
