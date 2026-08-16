import React, { useState } from 'react';
import type { LawSpecialty } from './LawSpecialties';
import { ContactCard, type ContactProfile } from '../components/ContactCard';
import { ContactsGrid } from '../components/ContactsGrid';
import { ATTORNEYS_BY_STATE } from '../data/contacts';
import './LawSpecialtyDetail.css';

interface Attorney {
  id: string;
  name: string;
  specialization: string;
  rating: number;
  reviews: number;
  yearsExperience: number;
  firmId: string;
  hourlyRate?: number;
}

interface Firm {
  id: string;
  name: string;
  location: string;
  state: string;
  attorneys: Attorney[];
  averageHourlyRate?: number;
}

// Sample data - in production this would come from backend
const FIRMS_BY_STATE: Record<string, Firm[]> = {
  CA: [
    {
      id: 'f1',
      name: 'California Legal Partners',
      location: 'San Francisco, CA',
      state: 'CA',
      averageHourlyRate: 350,
      attorneys: [
        { id: 'a1', name: 'Sarah Johnson', specialization: 'Family Law', rating: 4.9, reviews: 127, yearsExperience: 15, firmId: 'f1', hourlyRate: 350 },
        { id: 'a2', name: 'Michael Chen', specialization: 'Litigation', rating: 4.7, reviews: 98, yearsExperience: 12, firmId: 'f1', hourlyRate: 300 },
      ],
    },
    {
      id: 'f2',
      name: 'West Coast Law Group',
      location: 'Los Angeles, CA',
      state: 'CA',
      averageHourlyRate: 275,
      attorneys: [
        { id: 'a3', name: 'Emily Rodriguez', specialization: 'Corporate Law', rating: 4.8, reviews: 156, yearsExperience: 18, firmId: 'f2', hourlyRate: 400 },
      ],
    },
  ],
  NY: [
    {
      id: 'f3',
      name: 'Manhattan Legal Associates',
      location: 'New York, NY',
      state: 'NY',
      averageHourlyRate: 450,
      attorneys: [
        { id: 'a4', name: 'David Thompson', specialization: 'Securities Law', rating: 4.9, reviews: 203, yearsExperience: 20, firmId: 'f3', hourlyRate: 500 },
        { id: 'a5', name: 'Jennifer Lee', specialization: 'Tax Law', rating: 4.8, reviews: 145, yearsExperience: 16, firmId: 'f3', hourlyRate: 400 },
      ],
    },
  ],
  TX: [
    {
      id: 'f4',
      name: 'Texas Legal Center',
      location: 'Houston, TX',
      state: 'TX',
      averageHourlyRate: 225,
      attorneys: [
        { id: 'a6', name: 'James Wilson', specialization: 'Personal Injury', rating: 4.7, reviews: 189, yearsExperience: 14, firmId: 'f4', hourlyRate: 225 },
      ],
    },
  ],
};

const STATES = ['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'AZ'];

interface LawSpecialtyDetailProps {
  specialty: LawSpecialty;
  onBack: () => void;
}

export const LawSpecialtyDetail: React.FC<LawSpecialtyDetailProps> = ({ specialty, onBack }) => {
  const [selectedState, setSelectedState] = useState<string>('CA');
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null);
  const [showIntakeForm, setShowIntakeForm] = useState(false);
  const [costFilter, setCostFilter] = useState<'all' | 'budget' | 'moderate' | 'premium'>('all');
  const [publicProfiles, setPublicProfiles] = useState<Set<string>>(new Set());
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedState) return;

    setLoading(true);
    setError(null);

    try {
      const stateAttorneys = ATTORNEYS_BY_STATE[selectedState] || [];
      setAttorneys(stateAttorneys);
    } catch (err) {
      console.error('Error loading attorneys:', err);
      setError('Failed to load attorneys');
      setAttorneys([]);
    } finally {
      setLoading(false);
    }
  }, [selectedState]);

  const availableFirms = selectedState ? (FIRMS_BY_STATE[selectedState] || []) : [];

  const getCostRange = (filter: string): { min: number; max: number } | null => {
    switch (filter) {
      case 'budget': return { min: 0, max: 200 };
      case 'moderate': return { min: 200, max: 400 };
      case 'premium': return { min: 400, max: 10000 };
      default: return null;
    }
  };

  const filterAttorneysByCost = (attorneys: Attorney[]) => {
    if (costFilter === 'all') return attorneys;
    const range = getCostRange(costFilter);
    if (!range) return attorneys;
    return attorneys.filter(a => {
      const rate = a.hourlyRate || 250;
      return rate >= range.min && rate <= range.max;
    });
  };

  return (
    <div className="specialty-detail-container">
      <button className="back-btn" onClick={onBack}>← Back to Specialties</button>

      {/* Header Section */}
      <div className="specialty-detail-header">
        <div className="header-content">
          <h1>
            <span className="icon">{specialty.icon}</span>
            {specialty.name}
          </h1>
          <p className="main-description">{specialty.description}</p>

          <div className="specialty-info">
            <span className="info-item">
              <strong>Complexity:</strong>
              <span className={`badge ${specialty.complexity.toLowerCase()}`}>
                {specialty.complexity}
              </span>
            </span>
            <span className="info-item">
              <strong>Average Cost:</strong> {specialty.avgCost}
            </span>
          </div>
        </div>
      </div>

      {/* Examples Section */}
      <div className="examples-section">
        <h2>📋 Common Situations We Handle</h2>
        <div className="examples-grid">
          {specialty.examples.map((example, idx) => (
            <div key={idx} className="example-card">
              <span className="example-icon">✓</span>
              <p>{example}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Intake Form Button */}
      <div className="intake-section">
        <button
          className="intake-btn"
          onClick={() => setShowIntakeForm(!showIntakeForm)}
        >
          {showIntakeForm ? '✕ Close' : '📝'} {specialty.name} Intake Form
        </button>

        {showIntakeForm && (
          <div className="intake-form-container">
            <form className="intake-form">
              <div className="form-group">
                <label>Brief Description of Your Situation *</label>
                <textarea
                  placeholder="Tell us about your legal matter..."
                  rows={4}
                />
              </div>
              <div className="form-group">
                <label>Preferred State *</label>
                <select>
                  <option value="">Select State...</option>
                  {STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Timeline Urgency</label>
                <select>
                  <option value="low">Not Urgent</option>
                  <option value="medium">Within 2-4 weeks</option>
                  <option value="high">Urgent (within 1 week)</option>
                </select>
              </div>
              <button type="submit" className="submit-btn">Continue to Attorney Selection</button>
            </form>
          </div>
        )}
      </div>

      {/* Attorney Filtering System */}
      <div className="filtering-section">
        <h2>🔍 Find an Attorney</h2>

        {/* Step 1: Select State */}
        <div className="filter-step">
          <div className="step-header">
            <span className="step-number">1</span>
            <h3>✓ SELECT YOUR STATE (DEPLOYED TEST)</h3>
          </div>
          <div className="state-grid">
            {STATES.map(state => (
              <button
                key={state}
                className={`state-btn ${selectedState === state ? 'active' : ''}`}
                onClick={() => {
                  setSelectedState(state);
                  setSelectedFirm(null);
                }}
              >
                {state}
              </button>
            ))}
          </div>
        </div>

        {/* Cost Filter */}
        {selectedState && (
          <div className="filter-step">
            <div className="step-header">
              <h3>💰 Filter by Hourly Rate</h3>
            </div>
            <div className="cost-filter-buttons">
              <button
                className={`cost-btn ${costFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCostFilter('all')}
              >
                All Rates
              </button>
              <button
                className={`cost-btn budget ${costFilter === 'budget' ? 'active' : ''}`}
                onClick={() => setCostFilter('budget')}
              >
                💰 Budget-Friendly ($0-$200/hr)
              </button>
              <button
                className={`cost-btn moderate ${costFilter === 'moderate' ? 'active' : ''}`}
                onClick={() => setCostFilter('moderate')}
              >
                💵 Moderate ($200-$400/hr)
              </button>
              <button
                className={`cost-btn premium ${costFilter === 'premium' ? 'active' : ''}`}
                onClick={() => setCostFilter('premium')}
              >
                💎 Premium ($400+/hr)
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Firm */}
        {selectedState && availableFirms.length > 0 && (
          <div className="filter-step">
            <div className="step-header">
              <span className="step-number">2</span>
              <h3>Select Firm in {selectedState}</h3>
            </div>
            <div className="firms-list">
              {availableFirms.map(firm => (
                <div
                  key={firm.id}
                  className={`firm-card ${selectedFirm?.id === firm.id ? 'selected' : ''}`}
                  onClick={() => setSelectedFirm(firm)}
                >
                  <div className="firm-info">
                    <h4>{firm.name}</h4>
                    <p>{firm.location}</p>
                    <span className="attorneys-count">
                      {firm.attorneys.length} attorney{firm.attorneys.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="expand-icon">→</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: View Attorneys - from API or Firm */}
        <div className="filter-step">
          <div className="step-header">
            <span className="step-number">3</span>
            <h3>{selectedState ? (selectedFirm ? `Available Attorneys at ${selectedFirm.name}` : `Available Attorneys in ${selectedState}`) : 'Select a state first'}</h3>
          </div>
          <p style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>DEBUG: loading={loading}, attorneys.length={attorneys.length}, selectedState={selectedState}</p>
          {loading && <p style={{ textAlign: 'center', color: '#666' }}>Loading attorneys...</p>}
          {error && <p style={{ textAlign: 'center', color: '#d32f2f' }}>Error: {error}</p>}
          {!loading && attorneys.length > 0 && selectedState && (
            <ContactsGrid
              contacts={filterAttorneysByCost(
                selectedFirm
                  ? selectedFirm.attorneys
                  : attorneys.map(a => ({
                      id: a.id || '',
                      name: a.name,
                      specialization: a.specialization,
                      rating: a.rating,
                      reviews: a.reviews,
                      yearsExperience: a.yearsExperience,
                      firmId: '',
                      hourlyRate: a.hourlyRate,
                    }))
              ).map(attorney => ({
                id: attorney.id,
                name: attorney.name,
                title: 'Attorney',
                specialization: attorney.specialization,
                state: selectedState,
                rating: attorney.rating,
                reviews: attorney.reviews,
                yearsExperience: attorney.yearsExperience,
                hourlyRate: attorney.hourlyRate,
                verified: attorney.rating >= 4.7,
                badges: attorney.rating >= 4.8 ? ['Top Rated'] : [],
              } as ContactProfile))}
              publicProfiles={publicProfiles}
              onProfileToggle={(contactId) => {
                const newPublic = new Set(publicProfiles);
                if (newPublic.has(contactId)) {
                  newPublic.delete(contactId);
                } else {
                  newPublic.add(contactId);
                }
                setPublicProfiles(newPublic);
              }}
              onCommunicate={(contactId) => {
                console.log('Starting communication with attorney:', contactId);
              }}
            />
          )}
          {!loading && attorneys.length === 0 && selectedState && !selectedFirm && (
            <p style={{ textAlign: 'center', color: '#666' }}>No attorneys found for {selectedState} in this practice area.</p>
          )}
        </div>

      </div>
    </div>
  );
};
