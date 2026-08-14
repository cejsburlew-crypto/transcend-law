import React, { useState } from 'react';
import './ServiceIntakeForms.css';

interface NotaryFormData {
  // Client info (pre-filled from profile)
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;

  // Notarization details
  notarizationType: 'acknowledgment' | 'jurat' | 'affidavit' | 'loan-signing' | 'apostille' | 'other';
  documentType: string;
  documentCount: number;

  // Signing details
  signingLocation: 'notary-office' | 'client-location' | 'virtual';
  signingDate: string;
  signingTime: string;

  // Document info
  needsWitness: boolean;
  witnessCount: number;
  documentLanguage: string;

  // Additional info
  urgencyLevel: 'standard' | 'rush' | 'same-day';
  budget?: string;
  specialRequirements: string;
}

interface NotaryIntakeFormProps {
  providerId?: string;
  providerName?: string;
  onSubmit?: (formData: NotaryFormData) => void;
  onCancel?: () => void;
}

export const NotaryIntakeForm: React.FC<NotaryIntakeFormProps> = ({
  providerName,
  onSubmit,
  onCancel,
}) => {
  // Mock profile data - in real app, get from auth context
  const mockProfile = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '(555) 123-4567',
    address: '123 Main St, San Francisco, CA 94105',
  };

  const [formData, setFormData] = useState<NotaryFormData>({
    clientName: mockProfile.name,
    clientEmail: mockProfile.email,
    clientPhone: mockProfile.phone,
    clientAddress: mockProfile.address,
    notarizationType: 'acknowledgment',
    documentType: '',
    documentCount: 1,
    signingLocation: 'notary-office',
    signingDate: '',
    signingTime: '',
    needsWitness: false,
    witnessCount: 0,
    documentLanguage: 'english',
    urgencyLevel: 'standard',
    specialRequirements: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  return (
    <div className="intake-form-container">
      <div className="form-header">
        <h1>🔏 Notary Service Request</h1>
        {providerName && <p>With: {providerName}</p>}
      </div>

      <form onSubmit={handleSubmit} className="intake-form">
        {/* Client Information Section - Pre-filled from profile */}
        <section className="form-section">
          <h2>Your Information</h2>
          <p className="section-description">Pre-filled from your profile</p>

          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="clientName"
              value={formData.clientName}
              onChange={handleInputChange}
              readOnly
              className="form-input read-only"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="clientEmail"
                value={formData.clientEmail}
                onChange={handleInputChange}
                readOnly
                className="form-input read-only"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                name="clientPhone"
                value={formData.clientPhone}
                onChange={handleInputChange}
                readOnly
                className="form-input read-only"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              name="clientAddress"
              value={formData.clientAddress}
              onChange={handleInputChange}
              readOnly
              className="form-input read-only"
            />
          </div>
        </section>

        {/* Notarization Type */}
        <section className="form-section">
          <h2>Notarization Type</h2>
          <p className="section-description">Select the type of notarization needed</p>

          <div className="form-group">
            <label>Type of Notarization *</label>
            <select
              name="notarizationType"
              value={formData.notarizationType}
              onChange={handleInputChange}
              className="form-select"
              required
            >
              <option value="acknowledgment">Acknowledgment (Most Common)</option>
              <option value="jurat">Jurat (Affidavit)</option>
              <option value="affidavit">Affidavit</option>
              <option value="loan-signing">Loan Signing</option>
              <option value="apostille">Apostille</option>
              <option value="other">Other</option>
            </select>
            <p className="input-help">
              Not sure? Acknowledgments are used when someone signs a document and verifies their identity.
            </p>
          </div>

          <div className="form-group">
            <label>Type of Document *</label>
            <input
              type="text"
              name="documentType"
              placeholder="e.g., Power of Attorney, Deed, Affidavit"
              value={formData.documentType}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label>Number of Documents *</label>
            <input
              type="number"
              name="documentCount"
              min="1"
              max="100"
              value={formData.documentCount}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label>Document Language</label>
            <select
              name="documentLanguage"
              value={formData.documentLanguage}
              onChange={handleInputChange}
              className="form-select"
            >
              <option value="english">English</option>
              <option value="spanish">Spanish</option>
              <option value="chinese">Chinese</option>
              <option value="french">French</option>
              <option value="other">Other</option>
            </select>
          </div>
        </section>

        {/* Signing Details */}
        <section className="form-section">
          <h2>Signing Details</h2>
          <p className="section-description">When and where do you need this notarized?</p>

          <div className="form-group">
            <label>Signing Location *</label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  name="signingLocation"
                  value="notary-office"
                  checked={formData.signingLocation === 'notary-office'}
                  onChange={handleInputChange}
                />
                <span>At Notary's Office</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="signingLocation"
                  value="client-location"
                  checked={formData.signingLocation === 'client-location'}
                  onChange={handleInputChange}
                />
                <span>Mobile Notary (I'll come to you)</span>
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="signingLocation"
                  value="virtual"
                  checked={formData.signingLocation === 'virtual'}
                  onChange={handleInputChange}
                />
                <span>Virtual/Remote Notarization</span>
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Preferred Date *</label>
              <input
                type="date"
                name="signingDate"
                value={formData.signingDate}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>
            <div className="form-group">
              <label>Preferred Time</label>
              <input
                type="time"
                name="signingTime"
                value={formData.signingTime}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>
          </div>
        </section>

        {/* Witness & Signature */}
        <section className="form-section">
          <h2>Witness & Signature Details</h2>

          <label className="checkbox-label">
            <input
              type="checkbox"
              name="needsWitness"
              checked={formData.needsWitness}
              onChange={handleInputChange}
            />
            <span>Witnesses will be present during signing</span>
          </label>

          {formData.needsWitness && (
            <div className="form-group">
              <label>Number of Witnesses *</label>
              <input
                type="number"
                name="witnessCount"
                min="1"
                max="10"
                value={formData.witnessCount}
                onChange={handleInputChange}
                className="form-input"
                required
              />
            </div>
          )}
        </section>

        {/* Service Options */}
        <section className="form-section">
          <h2>Service Options</h2>

          <div className="form-group">
            <label>Urgency Level *</label>
            <select
              name="urgencyLevel"
              value={formData.urgencyLevel}
              onChange={handleInputChange}
              className="form-select"
              required
            >
              <option value="standard">Standard (3-5 business days)</option>
              <option value="rush">Rush (1-2 business days)</option>
              <option value="same-day">Same Day</option>
            </select>
          </div>

          <div className="form-group">
            <label>Budget (Optional)</label>
            <input
              type="text"
              name="budget"
              placeholder="e.g., $50-100"
              value={formData.budget || ''}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Special Requirements or Notes</label>
            <textarea
              name="specialRequirements"
              placeholder="Any special requirements, restrictions, or additional information..."
              value={formData.specialRequirements}
              onChange={handleInputChange}
              rows={4}
              className="form-textarea"
            />
          </div>
        </section>

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            Submit Notary Request
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="form-info-box">
        <h3>📋 What Happens Next</h3>
        <ol>
          <li>Your request is reviewed by {providerName || 'the notary'}</li>
          <li>You receive a confirmation and scheduling options</li>
          <li>Complete the notarization at your chosen location/time</li>
          <li>Signed documents are securely delivered to you</li>
        </ol>
      </div>
    </div>
  );
};
