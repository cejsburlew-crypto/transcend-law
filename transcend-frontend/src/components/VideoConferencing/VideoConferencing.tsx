// VideoConferencing Component
// One-click Zoom/Teams/Google Meet integration for client-provider calls

import React, { useState, useEffect } from 'react';
import './VideoConferencing.css';

type PlatformType = 'zoom' | 'teams' | 'google_meet';
type ConnectionStatus = 'disconnected' | 'connected' | 'in_call' | 'error';

interface Platform {
  type: PlatformType;
  name: string;
  icon: string;
  isConnected: boolean;
  accountEmail?: string;
  status: ConnectionStatus;
}

interface CallSession {
  id: number;
  platform: PlatformType;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recordingUrl?: string;
  transcriptUrl?: string;
  participantsCount: number;
}

interface VideoConferencingProps {
  hireAgreementId: number;
  clientName: string;
  providerName: string;
  clientEmail: string;
  providerEmail: string;
  isHost?: boolean;
  onCallStart?: (platform: PlatformType, meetingUrl: string) => void;
  onCallEnd?: (platform: PlatformType, duration: number) => void;
  className?: string;
}

export const VideoConferencing: React.FC<VideoConferencingProps> = ({
  hireAgreementId,
  clientName,
  providerName,
  clientEmail,
  providerEmail,
  isHost = false,
  onCallStart,
  onCallEnd,
  className = '',
}) => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<PlatformType | null>(null);
  const [callInProgress, setCallInProgress] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callHistory, setCallHistory] = useState<CallSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlatforms();
    fetchCallHistory();
  }, [hireAgreementId]);

  useEffect(() => {
    if (!callInProgress) return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callInProgress]);

  const fetchPlatforms = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v2/video/platforms`);
      const data = await response.json();

      if (data.success) {
        setPlatforms(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch platforms:', err);
      setError('Failed to load video platforms');
    } finally {
      setLoading(false);
    }
  };

  const fetchCallHistory = async () => {
    try {
      const response = await fetch(
        `/api/v2/video/hire-agreement/${hireAgreementId}/history`
      );
      const data = await response.json();

      if (data.success) {
        setCallHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch call history:', err);
    }
  };

  const handleLaunchCall = async (platform: PlatformType) => {
    const selectedPlatform = platforms.find((p) => p.type === platform);

    if (!selectedPlatform?.isConnected) {
      setError(
        `Please connect your ${selectedPlatform?.name} account first`
      );
      return;
    }

    setActivePlatform(platform);
    setCallInProgress(true);
    setCallDuration(0);
    setError(null);

    try {
      // Create meeting
      const response = await fetch('/api/v2/video/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hire_agreement_id: hireAgreementId,
          platform_type: platform,
          initiator_email: clientEmail,
          participant_emails: [providerEmail],
          meeting_title: `${clientName} - ${providerName}`,
          is_recorded: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const meetingUrl = data.data.meeting_url;
        onCallStart?.(platform, meetingUrl);

        // Open platform in new window (in real scenario)
        // window.open(meetingUrl, `${platform}_meeting`, 'width=1000,height=800');
      } else {
        setError(data.error || 'Failed to start call');
        setCallInProgress(false);
      }
    } catch (err) {
      console.error('Failed to launch call:', err);
      setError('Failed to launch call');
      setCallInProgress(false);
    }
  };

  const handleEndCall = async () => {
    if (!activePlatform) return;

    try {
      const response = await fetch('/api/v2/video/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hire_agreement_id: hireAgreementId,
          platform_type: activePlatform,
          duration_minutes: Math.floor(callDuration / 60),
        }),
      });

      const data = await response.json();

      if (data.success) {
        onCallEnd?.(activePlatform, callDuration);
        setCallInProgress(false);
        setActivePlatform(null);
        fetchCallHistory();
      }
    } catch (err) {
      console.error('Failed to end call:', err);
      setError('Failed to end call');
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className={`video-conferencing ${className}`}>
        <div className="video-loading">Loading video platforms...</div>
      </div>
    );
  }

  return (
    <div className={`video-conferencing ${className}`}>
      {/* Header */}
      <div className="video-header">
        <div className="header-icon">📞</div>
        <div className="header-content">
          <h2 className="header-title">Start a Video Call</h2>
          <p className="header-subtitle">
            Connect with {isHost ? providerName : clientName} instantly
          </p>
        </div>
      </div>

      {/* Active Call Display */}
      {callInProgress && activePlatform && (
        <div className="active-call">
          <div className="call-info">
            <div className="platform-icon">
              {activePlatform === 'zoom' && '📹'}
              {activePlatform === 'teams' && '💬'}
              {activePlatform === 'google_meet' && '🎥'}
            </div>
            <div className="call-details">
              <p className="call-status">
                Call in progress with{' '}
                <strong>{isHost ? providerName : clientName}</strong>
              </p>
              <p className="call-duration">{formatDuration(callDuration)}</p>
            </div>
          </div>
          <button className="end-call-btn" onClick={handleEndCall}>
            End Call
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="error-box">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
          <button
            className="error-close"
            onClick={() => setError(null)}
            title="Close"
          >
            ✕
          </button>
        </div>
      )}

      {/* Platform Options */}
      <div className="platforms-container">
        <h3 className="platforms-title">Choose Video Platform</h3>

        <div className="platforms-grid">
          {platforms.map((platform) => (
            <button
              key={platform.type}
              className={`platform-card ${
                platform.isConnected ? 'connected' : 'disconnected'
              } ${callInProgress && activePlatform === platform.type ? 'active' : ''}`}
              onClick={() => !callInProgress && handleLaunchCall(platform.type)}
              disabled={!platform.isConnected || callInProgress}
              title={
                platform.isConnected
                  ? `Launch ${platform.name}`
                  : `Connect ${platform.name} account`
              }
            >
              <div className="platform-icon-large">{platform.icon}</div>
              <div className="platform-info">
                <h4 className="platform-name">{platform.name}</h4>
                {platform.isConnected ? (
                  <>
                    <p className="platform-email">{platform.accountEmail}</p>
                    <span className="connection-badge connected">
                      ✓ Connected
                    </span>
                  </>
                ) : (
                  <span className="connection-badge disconnected">
                    Connect Account
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Connect Notice */}
        {platforms.some((p) => !p.isConnected) && (
          <div className="connect-notice">
            <p>
              To use a platform, connect your account in{' '}
              <a href="/settings/integrations">Settings</a>
            </p>
          </div>
        )}
      </div>

      {/* Call History */}
      <div className="call-history-section">
        <button
          className="history-toggle"
          onClick={() => setShowHistory(!showHistory)}
        >
          <span className="toggle-icon">{showHistory ? '▼' : '▶'}</span>
          <span className="toggle-text">
            Call History ({callHistory.length})
          </span>
        </button>

        {showHistory && (
          <div className="history-list">
            {callHistory.length === 0 ? (
              <p className="no-history">No calls yet</p>
            ) : (
              callHistory.map((call) => (
                <div key={call.id} className="history-item">
                  <div className="history-icon">
                    {call.platform === 'zoom' && '📹'}
                    {call.platform === 'teams' && '💬'}
                    {call.platform === 'google_meet' && '🎥'}
                  </div>
                  <div className="history-info">
                    <p className="history-time">
                      {formatDate(call.startTime)}
                    </p>
                    <p className="history-duration">
                      {call.duration ? `${Math.floor(call.duration / 60)} min` : 'In progress'}
                    </p>
                  </div>
                  <div className="history-actions">
                    {call.recordingUrl && (
                      <a
                        href={call.recordingUrl}
                        className="history-link"
                        title="View recording"
                      >
                        📹
                      </a>
                    )}
                    {call.transcriptUrl && (
                      <a
                        href={call.transcriptUrl}
                        className="history-link"
                        title="View transcript"
                      >
                        📄
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="features-section">
        <h4 className="features-title">Call Features</h4>
        <ul className="features-list">
          <li>✓ Screen sharing</li>
          <li>✓ Recording & transcripts</li>
          <li>✓ Participant list</li>
          <li>✓ Chat & messages</li>
          <li>✓ Schedule for later</li>
        </ul>
      </div>
    </div>
  );
};

export default VideoConferencing;
