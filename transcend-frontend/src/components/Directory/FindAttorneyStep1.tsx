// Find Attorney Step 1 - State Selection
// Allow users to select a state to browse attorneys/firms

import React, { useState } from 'react';
import './FindAttorney.css';

interface FindAttorneyStep1Props {
  onStateSelected?: (state: string) => void;
  onCancel?: () => void;
  loading?: boolean;
  selectedState?: string;
}

const STATES = [
  { code: 'CA', name: 'California' },
  { code: 'NY', name: 'New York' },
  { code: 'TX', name: 'Texas' },
  { code: 'FL', name: 'Florida' },
  { code: 'IL', name: 'Illinois' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'OH', name: 'Ohio' },
  { code: 'GA', name: 'Georgia' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'WA', name: 'Washington' },
  { code: 'CO', name: 'Colorado' },
  { code: 'MI', name: 'Michigan' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'VA', name: 'Virginia' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MD', name: 'Maryland' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'CO', name: 'Colorado' },
  { code: 'IN', name: 'Indiana' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'OR', name: 'Oregon' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'UT', name: 'Utah' },
  { code: 'AL', name: 'Alabama' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'NV', name: 'Nevada' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'KS', name: 'Kansas' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'ID', name: 'Idaho' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'ME', name: 'Maine' },
  { code: 'MT', name: 'Montana' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'DE', name: 'Delaware' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'AK', name: 'Alaska' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'VT', name: 'Vermont' },
];

export const FindAttorneyStep1: React.FC<FindAttorneyStep1Props> = ({
  onStateSelected,
  onCancel,
  loading = false,
  selectedState,
}) => {
  const [selected, setSelected] = useState<string | undefined>(selectedState);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStates = STATES.filter(
    (state) =>
      state.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      state.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectState = (stateCode: string) => {
    setSelected(stateCode);
  };

  const handleContinue = () => {
    if (selected) {
      onStateSelected?.(selected);
    }
  };

  const isContinueDisabled = !selected || loading;

  return (
    <div className="find-attorney-step-1">
      <div className="step-header">
        <div className="step-number">1</div>
        <div className="step-info">
          <h2>Select Your State</h2>
          <p className="step-subtitle">
            Choose your state to find available attorneys and law firms
          </p>
        </div>
      </div>

      {/* Search Box */}
      <div className="state-search-container">
        <input
          type="text"
          className="state-search-input"
          placeholder="Search state (e.g., California, CA)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={loading}
          data-testid="state-search-input"
        />
        {searchQuery && (
          <button
            className="search-clear-button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* States Grid */}
      <div className="states-grid">
        {filteredStates.length > 0 ? (
          filteredStates.map((state) => (
            <button
              key={state.code}
              className={`state-button ${selected === state.code ? 'active' : ''}`}
              onClick={() => handleSelectState(state.code)}
              disabled={loading}
              data-testid={`state-button-${state.code}`}
              aria-pressed={selected === state.code}
              title={state.name}
            >
              <span className="state-code">{state.code}</span>
              <span className="state-name">{state.name}</span>
            </button>
          ))
        ) : (
          <div className="no-results">
            <p>No states found matching "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="info-box">
        <p className="info-text">
          💡 <strong>Tip:</strong> We have attorneys and law firms available in all 50 states.
          Select your state to see providers in your area.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="form-actions">
        <button
          className="btn-secondary"
          onClick={onCancel}
          disabled={loading}
          data-testid="btn-cancel"
        >
          Cancel
        </button>

        <button
          className="btn-primary"
          onClick={handleContinue}
          disabled={isContinueDisabled}
          data-testid="btn-continue"
        >
          {loading ? '🔄 Loading...' : `Continue with ${selected || 'State'} →`}
        </button>
      </div>

      {/* Selected State Summary */}
      {selected && (
        <div className="selected-state-summary">
          <span className="summary-label">Selected:</span>
          <span className="summary-value">
            {STATES.find((s) => s.code === selected)?.name} ({selected})
          </span>
        </div>
      )}
    </div>
  );
};

export default FindAttorneyStep1;
