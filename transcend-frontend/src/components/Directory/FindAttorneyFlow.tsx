// Find Attorney Flow - Complete multi-step component
// Combines Step 1 (State Selection) and Step 2 (Firm Selection)

import React, { useState, useEffect } from 'react';
import FindAttorneyStep1 from './FindAttorneyStep1';
import FindAttorneyStep2 from './FindAttorneyStep2';
import './FindAttorney.css';

interface Firm {
  id: string;
  name: string;
  location: string;
  attorneyCount: number;
}

interface FindAttorneyFlowProps {
  onComplete?: (state: string, firmIds: string[], sendToAll: boolean) => void;
  onCancel?: () => void;
  initialState?: string;
}

export const FindAttorneyFlow: React.FC<FindAttorneyFlowProps> = ({
  onComplete,
  onCancel,
  initialState,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [selectedState, setSelectedState] = useState<string | undefined>(initialState);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch firms when state is selected
  useEffect(() => {
    if (selectedState && currentStep === 2) {
      fetchFirms(selectedState);
    }
  }, [selectedState, currentStep]);

  const fetchFirms = async (state: string) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/v2/directory/firms?state=${state}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch firms');
      }

      const data = await response.json();
      setFirms(data.firms || []);
    } catch (err) {
      setError('Failed to load firms. Please try again.');
      console.error('Error fetching firms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStateSelected = (state: string) => {
    setSelectedState(state);
    setCurrentStep(2);
  };

  const handleSendToAll = async () => {
    if (!selectedState) return;

    setLoading(true);
    try {
      const response = await fetch('/api/v2/intake/request/firms/all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          state: selectedState,
          clientId: localStorage.getItem('userId'),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send request');
      }

      const data = await response.json();
      onComplete?.(selectedState, [], true);
    } catch (err) {
      setError('Failed to send request. Please try again.');
      console.error('Error sending request:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToSelected = async (firmIds: string[]) => {
    if (!selectedState) return;

    setLoading(true);
    try {
      const response = await fetch('/api/v2/intake/request/firms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          firmIds,
          state: selectedState,
          clientId: localStorage.getItem('userId'),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send request');
      }

      const data = await response.json();
      onComplete?.(selectedState, firmIds, false);
    } catch (err) {
      setError('Failed to send request. Please try again.');
      console.error('Error sending request:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToStep1 = () => {
    setCurrentStep(1);
    setError('');
  };

  return (
    <div className="find-attorney-flow">
      {error && (
        <div className="flow-error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
          <button
            className="error-close"
            onClick={() => setError('')}
            aria-label="Close error"
          >
            ✕
          </button>
        </div>
      )}

      {currentStep === 1 ? (
        <FindAttorneyStep1
          onStateSelected={handleStateSelected}
          onCancel={onCancel}
          loading={loading}
          selectedState={selectedState}
        />
      ) : (
        <FindAttorneyStep2
          state={selectedState || ''}
          firms={firms}
          onSendToAll={handleSendToAll}
          onSendToSelected={handleSendToSelected}
          onBack={handleBackToStep1}
          loading={loading}
        />
      )}
    </div>
  );
};

export default FindAttorneyFlow;
