// Find Attorney Step 2 - Firm Selection
// Allow selection of one or more firms, or send to all

import React, { useState } from 'react';
import './FindAttorney.css';

interface Firm {
  id: string;
  name: string;
  location: string;
  attorneyCount: number;
}

interface FindAttorneyStep2Props {
  state: string;
  firms: Firm[];
  onSendToAll?: () => void;
  onSendToSelected?: (selectedFirmIds: string[]) => void;
  onBack?: () => void;
  loading?: boolean;
}

export const FindAttorneyStep2: React.FC<FindAttorneyStep2Props> = ({
  state,
  firms,
  onSendToAll,
  onSendToSelected,
  onBack,
  loading = false,
}) => {
  const [selectedFirms, setSelectedFirms] = useState<Set<string>>(new Set());
  const [sendingMode, setSendingMode] = useState<'all' | 'selected' | null>(null);

  const handleSelectFirm = (firmId: string) => {
    const newSelected = new Set(selectedFirms);
    if (newSelected.has(firmId)) {
      newSelected.delete(firmId);
    } else {
      newSelected.add(firmId);
    }
    setSelectedFirms(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFirms.size === firms.length) {
      setSelectedFirms(new Set());
    } else {
      setSelectedFirms(new Set(firms.map(f => f.id)));
    }
  };

  const handleSendToAll = () => {
    setSendingMode('all');
    onSendToAll?.();
  };

  const handleSendToSelected = () => {
    if (selectedFirms.size === 0) return;
    setSendingMode('selected');
    onSendToSelected?.(Array.from(selectedFirms));
  };

  const isAllSelected = selectedFirms.size === firms.length;
  const hasSomeSelected = selectedFirms.size > 0;

  return (
    <div className="find-attorney-step-2">
      <div className="step-header">
        <div className="step-number">2</div>
        <div className="step-info">
          <h2>Select Firm(s) in {state}</h2>
          <p className="step-subtitle">
            Choose specific firms to contact, or send your request to all {firms.length} firms for consideration
          </p>
        </div>
      </div>

      {/* Send to All Option */}
      <div className="send-to-all-section">
        <button
          className="send-to-all-button"
          onClick={handleSendToAll}
          disabled={loading || sendingMode === 'selected'}
          data-testid="btn-send-to-all"
        >
          <span className="button-icon">📤</span>
          <div className="button-content">
            <span className="button-label">Send to All Firms</span>
            <span className="button-desc">
              Send your request to all {firms.length} firms at once
            </span>
          </div>
          {sendingMode === 'all' && <span className="sending-indicator">🔄</span>}
        </button>
      </div>

      <div className="divider">
        <span className="divider-text">or</span>
      </div>

      {/* Firm Selection */}
      <div className="firm-selection-section">
        <div className="selection-header">
          <h3>Select Specific Firms</h3>
          <label className="select-all-checkbox">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              disabled={loading}
              aria-label="Select all firms"
            />
            <span>Select All ({firms.length})</span>
          </label>
        </div>

        <div className="firms-grid">
          {firms.map((firm) => (
            <div
              key={firm.id}
              className={`firm-card ${selectedFirms.has(firm.id) ? 'selected' : ''}`}
              onClick={() => handleSelectFirm(firm.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectFirm(firm.id);
                }
              }}
              data-testid={`firm-card-${firm.id}`}
            >
              <input
                type="checkbox"
                checked={selectedFirms.has(firm.id)}
                onChange={() => handleSelectFirm(firm.id)}
                disabled={loading}
                className="firm-checkbox"
                aria-label={`Select ${firm.name}`}
              />

              <div className="firm-details">
                <h4 className="firm-name">{firm.name}</h4>
                <p className="firm-location">📍 {firm.location}</p>
                <p className="firm-attorneys">
                  👥 {firm.attorneyCount} attorney{firm.attorneyCount !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="selection-checkmark">✓</div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Count */}
      {hasSomeSelected && (
        <div className="selected-count">
          <span className="count-badge">{selectedFirms.size}</span>
          <span className="count-text">
            firm{selectedFirms.size !== 1 ? 's' : ''} selected
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="form-actions">
        <button
          className="btn-secondary"
          onClick={onBack}
          disabled={loading}
          data-testid="btn-back"
        >
          ← Back
        </button>

        <button
          className="btn-primary"
          onClick={handleSendToSelected}
          disabled={!hasSomeSelected || loading || sendingMode === 'all'}
          data-testid="btn-send-selected"
        >
          {loading && sendingMode === 'selected' ? (
            <>🔄 Sending...</>
          ) : (
            <>Send to {selectedFirms.size} Firm{selectedFirms.size !== 1 ? 's' : ''}</>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="info-box">
        <p className="info-text">
          💡 <strong>Tip:</strong> All selected firms will receive your intake request and can
          provide quotes for your legal services.
        </p>
      </div>
    </div>
  );
};

export default FindAttorneyStep2;
