// Video Call Component
// Video conferencing for attorney-client consultations

import React, { useState } from 'react';
import './VideoCall.css';

interface Participant {
  id: string;
  name: string;
  role: 'attorney' | 'client';
  avatar?: string;
  isOnline: boolean;
  videoEnabled: boolean;
  audioEnabled: boolean;
}

interface VideoCallProps {
  caseId: string;
  participants: Participant[];
  onEndCall?: () => void;
  onScheduleCall?: (time: Date) => void;
}

export const VideoCall: React.FC<VideoCallProps> = ({
  caseId,
  participants,
  onEndCall,
  onScheduleCall,
}) => {
  const [isCallActive, setIsCallActive] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; user: string; text: string; time: string }>>([
    { id: '1', user: 'Sarah Johnson', text: 'Hello! Thanks for meeting with me today.', time: '2:15 PM' },
    { id: '2', user: 'You', text: 'Thanks for taking the time. I appreciate it.', time: '2:16 PM' },
  ]);
  const [newMessage, setNewMessage] = useState('');

  const handleEndCall = () => {
    setIsCallActive(false);
    onEndCall?.();
  };

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      setMessages([
        ...messages,
        {
          id: String(messages.length + 1),
          user: 'You',
          text: newMessage,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setNewMessage('');
    }
  };

  if (!isCallActive) {
    return (
      <div className="video-call-ended">
        <div className="ended-content">
          <h2>Call Ended</h2>
          <p>Thank you for meeting with Sarah Johnson, Esq.</p>
          <div className="call-summary">
            <div className="summary-item">
              <span className="label">Duration:</span>
              <span className="value">12 minutes</span>
            </div>
            <div className="summary-item">
              <span className="label">Recording:</span>
              <span className="value">✓ Saved</span>
            </div>
            <div className="summary-item">
              <span className="label">Follow-up:</span>
              <span className="value">Check your messages</span>
            </div>
          </div>
          <div className="post-call-actions">
            <button className="btn-primary">Leave Feedback</button>
            <button className="btn-secondary">Schedule Next Meeting</button>
            <button className="btn-secondary" onClick={onEndCall}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="video-call-container">
      {/* Video Grid */}
      <div className={`video-grid ${chatOpen ? 'chat-open' : ''}`}>
        {/* Main Video */}
        <div className="video-main">
          <div className="video-placeholder">
            <div className="participant-name">Sarah Johnson, Esq.</div>
            <div className="participant-role">Attorney</div>
          </div>
        </div>

        {/* Local Video */}
        <div className="video-local">
          <div className="video-placeholder-small">
            <div className="participant-name-small">You</div>
          </div>
        </div>

        {/* Control Bar */}
        <div className="control-bar">
          <button
            className={`control-btn ${!videoEnabled ? 'disabled' : ''}`}
            onClick={() => setVideoEnabled(!videoEnabled)}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {videoEnabled ? '📹' : '📹‍'}
            {videoEnabled ? 'Video On' : 'Video Off'}
          </button>

          <button
            className={`control-btn ${!audioEnabled ? 'disabled' : ''}`}
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? 'Mute' : 'Unmute'}
          >
            {audioEnabled ? '🎙️' : '🔇'}
            {audioEnabled ? 'Mute' : 'Unmute'}
          </button>

          <button
            className={`control-btn ${screenSharing ? 'active' : ''}`}
            onClick={() => setScreenSharing(!screenSharing)}
            title="Share screen"
          >
            🖥️ {screenSharing ? 'Stop' : 'Share'}
          </button>

          <button
            className={`control-btn ${recordingActive ? 'recording' : ''}`}
            onClick={() => setRecordingActive(!recordingActive)}
            title="Record call"
          >
            ⏺️ {recordingActive ? 'Recording' : 'Record'}
          </button>

          <button
            className="control-btn"
            onClick={() => setChatOpen(!chatOpen)}
            title="Open chat"
          >
            💬 Chat
          </button>

          <button className="control-btn danger" onClick={handleEndCall} title="End call">
            ☎️ End
          </button>
        </div>

        {/* Call Info */}
        <div className="call-info">
          <span className="call-duration">⏱️ 12:34</span>
          <span className="connection-status">✓ Connected</span>
        </div>
      </div>

      {/* Chat Panel */}
      {chatOpen && (
        <div className="chat-panel">
          <div className="chat-header">
            <h3>Chat with Sarah Johnson</h3>
            <button className="close-btn" onClick={() => setChatOpen(false)}>
              ✕
            </button>
          </div>

          <div className="chat-messages">
            {messages.map(msg => (
              <div key={msg.id} className={`message ${msg.user === 'You' ? 'sent' : 'received'}`}>
                <div className="message-user">{msg.user}</div>
                <div className="message-text">{msg.text}</div>
                <div className="message-time">{msg.time}</div>
              </div>
            ))}
          </div>

          <div className="chat-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage} className="send-btn">
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
