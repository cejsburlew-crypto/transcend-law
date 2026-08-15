// IntakeForm Component
// Client submits service request with details, budget, and timeline

import React, { useState } from 'react';
import './IntakeForm.css';

interface IntakeFormData {
  service_id: number;
  title: string;
  description: string;
  practice_area_id?: number;
  preferred_date?: string;
  budget_min?: number;
  budget_max?: number;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
}

interface IntakeFormProps {
  serviceId: number;
  serviceName: string;
  serviceIcon: string;
  onSubmit?: (data: IntakeFormData) => void;
  onCancel?: () => void;
}

export const IntakeForm: React.FC<IntakeFormProps> = ({
  serviceId,
  serviceName,
  serviceIcon,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<IntakeFormData>({
    service_id: serviceId,
    title: '',
    description: '',
    urgency: 'medium',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    field: keyof IntakeFormData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }

    if (formData.budget_min && formData.budget_max && formData.budget_min > formData.budget_max) {
      newErrors.budget = 'Minimum budget cannot exceed maximum budget';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Call onSubmit callback
      onSubmit?.(formData);

      // If no callback, you would typically make an API call here
      // const response = await fetch('/api/v2/intake-forms', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // });
    } catch (error) {
      console.error('Failed to submit intake form:', error);
      setErrors((prev) => ({
        ...prev,
        submit: 'Failed to submit form. Please try again.',
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="intake-form-container">
      {/* Header */}
      <div className="intake-header">
        <div className="intake-icon">{serviceIcon}</div>
        <div className="intake-title-section">
          <h2 className="intake-title">Request {serviceName} Service</h2>
          <p className="intake-subtitle">Tell us what you need and providers will submit offers</p>
        </div>
        {onCancel && (
          <button className="intake-close-btn" onClick={onCancel} title="Close">
            ✕
          </button>
        )}
      </div>

      {/* Form */}
      <form className="intake-form" onSubmit={handleSubmit}>
        {/* Title Field */}
        <div className="form-group">
          <label className="form-label">
            Service Request Title
            <span className="required-star">*</span>
          </label>
          <input
            type="text"
            className={`form-input ${errors.title ? 'error' : ''}`}
            placeholder="e.g., Contract Review for Merger Agreement"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            maxLength={255}
          />
          {errors.title && <span className="form-error">{errors.title}</span>}
          <span className="form-hint">{formData.title.length}/255 characters</span>
        </div>

        {/* Description Field */}
        <div className="form-group">
          <label className="form-label">
            Detailed Description
            <span className="required-star">*</span>
          </label>
          <textarea
            className={`form-textarea ${errors.description ? 'error' : ''}`}
            placeholder="Describe the service you need, any specific requirements, relevant documents, etc."
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={6}
            maxLength={5000}
          />
          {errors.description && <span className="form-error">{errors.description}</span>}
          <span className="form-hint">{formData.description.length}/5000 characters</span>
        </div>

        {/* Budget Fields */}
        <div className="form-group form-row">
          <div className="form-col">
            <label className="form-label">Minimum Budget</label>
            <div className="currency-input">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                value={formData.budget_min || ''}
                onChange={(e) => handleChange('budget_min', e.target.value ? parseFloat(e.target.value) : undefined)}
                min="0"
                step="100"
              />
            </div>
            <span className="form-hint">Optional</span>
          </div>

          <div className="form-col">
            <label className="form-label">Maximum Budget</label>
            <div className="currency-input">
              <span className="currency-symbol">$</span>
              <input
                type="number"
                className={`form-input ${errors.budget ? 'error' : ''}`}
                placeholder="0.00"
                value={formData.budget_max || ''}
                onChange={(e) => handleChange('budget_max', e.target.value ? parseFloat(e.target.value) : undefined)}
                min="0"
                step="100"
              />
            </div>
            {errors.budget && <span className="form-error">{errors.budget}</span>}
          </div>
        </div>

        {/* Preferred Date */}
        <div className="form-group">
          <label className="form-label">Preferred Start Date</label>
          <input
            type="date"
            className="form-input"
            value={formData.preferred_date || ''}
            onChange={(e) => handleChange('preferred_date', e.target.value || undefined)}
          />
          <span className="form-hint">Optional - providers will consider availability</span>
        </div>

        {/* Urgency */}
        <div className="form-group">
          <label className="form-label">How Urgent Is This?</label>
          <div className="urgency-options">
            {(['low', 'medium', 'high', 'urgent'] as const).map((level) => (
              <button
                key={level}
                type="button"
                className={`urgency-btn ${formData.urgency === level ? 'active' : ''}`}
                onClick={() => handleChange('urgency', level)}
              >
                {level === 'low' && '🟢'}
                {level === 'medium' && '🟡'}
                {level === 'high' && '🟠'}
                {level === 'urgent' && '🔴'}
                <span>{level.charAt(0).toUpperCase() + level.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit Error */}
        {errors.submit && <div className="form-error-box">{errors.submit}</div>}

        {/* Actions */}
        <div className="form-actions">
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </div>

        {/* Legal Notice */}
        <p className="form-legal">
          By submitting this request, you agree to our{' '}
          <a href="/terms">Terms of Service</a> and{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </form>
    </div>
  );
};

export default IntakeForm;
