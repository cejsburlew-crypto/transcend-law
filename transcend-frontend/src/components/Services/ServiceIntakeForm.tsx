// Service Intake Form
// Collect client details for legal service request

import React, { useState } from 'react';
import './ServiceIntakeForm.css';

interface Attorney {
  id: string;
  name: string;
  rating: number;
  specialty: string;
  yearsExperience: number;
  caseCount: number;
}

interface FormData {
  serviceType: string;
  title: string;
  description: string;
  budgetMin: number;
  budgetMax: number;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  location: string;
  documents: File[];
  termsAccepted: boolean;
  selectedAttorneys: string[];
}

interface ServiceIntakeFormProps {
  onSubmit?: (data: FormData) => void;
  onCancel?: () => void;
  selectedService?: string;
}

const SERVICES = [
  'Civil Litigation',
  'Criminal Defense',
  'DUI Defense',
  'Traffic Violations',
  'Family Law',
  'Divorce & Separation',
  'Employment Law',
  'Real Estate Law',
  'Personal Injury',
  'Medical Malpractice',
  'Contract Law',
  'Corporate Law',
  'Workers Compensation',
  'Social Security Disability',
  'Bankruptcy Law',
  'Immigration Law',
];

const URGENCY_LEVELS = [
  { value: 'low', label: '🟢 Low - Not urgent', desc: 'Can wait 2+ weeks' },
  { value: 'medium', label: '🟡 Medium - Some time', desc: 'Need resolution in 1-2 weeks' },
  { value: 'high', label: '🟠 High - Soon needed', desc: 'Need resolution in 3-7 days' },
  { value: 'urgent', label: '🔴 Urgent - ASAP', desc: 'Need resolution in 24-48 hours' },
];

const BUDGET_RANGES = [
  { min: 500, max: 1000, label: '$500 - $1,000' },
  { min: 1000, max: 2500, label: '$1,000 - $2,500' },
  { min: 2500, max: 5000, label: '$2,500 - $5,000' },
  { min: 5000, max: 10000, label: '$5,000 - $10,000' },
  { min: 10000, max: 25000, label: '$10,000 - $25,000' },
  { min: 25000, max: 50000, label: '$25,000 - $50,000' },
  { min: 50000, max: 100000, label: '$50,000+' },
];

const SAMPLE_ATTORNEYS: Attorney[] = [
  { id: '1', name: 'Sarah Johnson, Esq.', rating: 4.9, specialty: 'Employment Law', yearsExperience: 12, caseCount: 245 },
  { id: '2', name: 'James Miller, Esq.', rating: 4.7, specialty: 'Personal Injury', yearsExperience: 15, caseCount: 312 },
  { id: '3', name: 'Maria Garcia, Esq.', rating: 4.8, specialty: 'Family Law', yearsExperience: 10, caseCount: 198 },
  { id: '4', name: 'David Chen, Esq.', rating: 4.6, specialty: 'Contract Law', yearsExperience: 8, caseCount: 156 },
  { id: '5', name: 'Rebecca Williams, Esq.', rating: 4.9, specialty: 'Criminal Defense', yearsExperience: 18, caseCount: 367 },
  { id: '6', name: 'Miguel Rodriguez, Esq.', rating: 4.5, specialty: 'Real Estate', yearsExperience: 11, caseCount: 203 },
];

export const ServiceIntakeForm: React.FC<ServiceIntakeFormProps> = ({
  onSubmit,
  onCancel,
  selectedService,
}) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    serviceType: selectedService || '',
    title: '',
    description: '',
    budgetMin: 0,
    budgetMax: 0,
    urgency: 'medium',
    location: '',
    documents: [],
    termsAccepted: false,
    selectedAttorneys: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateStep1 = () => {
    if (!formData.serviceType) {
      setError('Please select a service type');
      return false;
    }
    if (!formData.title.trim() || formData.title.length < 5) {
      setError('Case title must be at least 5 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.description.trim() || formData.description.length < 20) {
      setError('Description must be at least 20 characters');
      return false;
    }
    if (formData.description.length > 5000) {
      setError('Description cannot exceed 5000 characters');
      return false;
    }
    if (formData.budgetMin === 0 || formData.budgetMax === 0) {
      setError('Please select a budget range');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.location.trim()) {
      setError('Please select or enter a location');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (formData.selectedAttorneys.length === 0) {
      setError('Please select at least one attorney to proceed');
      return false;
    }
    if (!formData.termsAccepted) {
      setError('You must accept the terms to continue');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      setStep(4);
    } else if (step === 4 && validateStep4()) {
      handleSubmit();
    }
  };

  const toggleAttorney = (attorneyId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedAttorneys: prev.selectedAttorneys.includes(attorneyId)
        ? prev.selectedAttorneys.filter(id => id !== attorneyId)
        : [...prev.selectedAttorneys, attorneyId],
    }));
  };

  const sendToAllAttorneys = () => {
    setFormData(prev => ({
      ...prev,
      selectedAttorneys: SAMPLE_ATTORNEYS.map(a => a.id),
    }));
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
    setError('');
  };

  const handleBudgetSelect = (min: number, max: number) => {
    setFormData({ ...formData, budgetMin: min, budgetMax: max });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData({
        ...formData,
        documents: [...formData.documents, ...newFiles],
      });
    }
  };

  const removeDocument = (index: number) => {
    setFormData({
      ...formData,
      documents: formData.documents.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      onSubmit?.(formData);
    } catch (err) {
      setError('Failed to submit form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="intake-form-container">
      <div className="intake-card">
        <div className="intake-header">
          <h1>Submit Your Case</h1>
          <p>Tell us about your legal needs</p>
        </div>

        {/* Progress Indicator */}
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>
        <div className="step-indicator">
          Step {step} of 4
        </div>

        {error && (
          <div className="error-alert">
            <span>⚠️ {error}</span>
          </div>
        )}

        <form className="intake-form">
          {/* Step 1: Service Selection */}
          {step === 1 && (
            <>
              <div className="form-section">
                <h2>What service do you need?</h2>

                <div className="form-group">
                  <label htmlFor="serviceType">Service Type</label>
                  <select
                    id="serviceType"
                    name="serviceType"
                    value={formData.serviceType}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">Select a service...</option>
                    {SERVICES.map(service => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="title">Case Title</label>
                  <input
                    id="title"
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g., Wrongful Termination Claim"
                    className="form-input"
                    maxLength={100}
                  />
                  <p className="char-count">{formData.title.length}/100 characters</p>
                </div>
              </div>
            </>
          )}

          {/* Step 2: Details */}
          {step === 2 && (
            <>
              <div className="form-section">
                <h2>Tell us more about your case</h2>

                <div className="form-group">
                  <label htmlFor="description">Case Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Provide details about your legal situation..."
                    className="form-input textarea"
                    rows={6}
                    maxLength={5000}
                  />
                  <p className="char-count">{formData.description.length}/5000 characters</p>
                </div>

                <div className="form-group">
                  <label>Budget Range</label>
                  <div className="budget-grid">
                    {BUDGET_RANGES.map(range => (
                      <button
                        key={range.label}
                        type="button"
                        className={`budget-option ${
                          formData.budgetMin === range.min && formData.budgetMax === range.max
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => handleBudgetSelect(range.min, range.max)}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Urgency Level</label>
                  <div className="urgency-grid">
                    {URGENCY_LEVELS.map(level => (
                      <label
                        key={level.value}
                        className={`urgency-option ${formData.urgency === level.value ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="urgency"
                          value={level.value}
                          checked={formData.urgency === level.value}
                          onChange={handleChange}
                        />
                        <span>
                          <strong>{level.label}</strong>
                          <span className="desc">{level.desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step 3: Location & Documents */}
          {step === 3 && (
            <>
              <div className="form-section">
                <h2>Where should we send your case?</h2>

                <div className="form-group">
                  <label htmlFor="location">Your Location (State)</label>
                  <input
                    id="location"
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="California"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Supporting Documents</label>
                  <div className="file-upload">
                    <input
                      type="file"
                      id="documents"
                      onChange={handleFileUpload}
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.png"
                      className="file-input"
                    />
                    <label htmlFor="documents" className="file-label">
                      📎 Upload documents (optional)
                    </label>
                    <p className="file-help">PDF, Word, Images (max 5MB each)</p>
                  </div>

                  {formData.documents.length > 0 && (
                    <div className="documents-list">
                      <h4>Uploaded files:</h4>
                      {formData.documents.map((doc, idx) => (
                        <div key={idx} className="document-item">
                          <span>📄 {doc.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDocument(idx)}
                            className="remove-doc"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Step 4: Attorney Selection */}
          {step === 4 && (
            <>
              <div className="form-section">
                <h2>Select attorneys to send your case</h2>
                <p className="section-subtitle">Choose attorneys who specialize in your case type, or send to all</p>

                <div className="form-group">
                  <button
                    type="button"
                    className="btn-send-all"
                    onClick={sendToAllAttorneys}
                  >
                    📤 Send to All Attorneys
                  </button>
                </div>

                <div className="attorneys-list">
                  {SAMPLE_ATTORNEYS.map(attorney => (
                    <div
                      key={attorney.id}
                      className={`attorney-card ${formData.selectedAttorneys.includes(attorney.id) ? 'selected' : ''}`}
                    >
                      <label className="attorney-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.selectedAttorneys.includes(attorney.id)}
                          onChange={() => toggleAttorney(attorney.id)}
                        />
                      </label>
                      <div className="attorney-info">
                        <h4>{attorney.name}</h4>
                        <p className="specialty">📚 {attorney.specialty}</p>
                        <div className="attorney-meta">
                          <span>⭐ {attorney.rating}</span>
                          <span>📋 {attorney.yearsExperience} yrs exp</span>
                          <span>✓ {attorney.caseCount} cases</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label className="checkbox-large">
                    <input
                      type="checkbox"
                      name="termsAccepted"
                      checked={formData.termsAccepted}
                      onChange={handleChange}
                    />
                    <span>
                      I agree to the <a href="/terms">Terms of Service</a> and{' '}
                      <a href="/privacy">Privacy Policy</a>
                    </span>
                  </label>
                </div>

                <div className="info-box">
                  <p>
                    ℹ️ Selected attorneys: <strong>{formData.selectedAttorneys.length}</strong>
                  </p>
                  <p>
                    Your case details will be sent to the attorneys you selected. They will review and provide quotes within 24 hours.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            {step > 1 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleBack}
                disabled={loading}
              >
                ← Back
              </button>
            )}
            <div className="action-spacer"></div>
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? '⏳ Submitting...' : step === 4 ? '✓ Send to Attorneys' : 'Next →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServiceIntakeForm;
