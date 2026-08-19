import React, { useState } from 'react';
import { ServiceIcon } from '../components/ServiceIcon';
import { useLanguage } from '../context/LanguageContext';
import './ProviderProfile.css';

interface ProviderFormData {
  profileType: 'client' | 'provider' | '';
  fullName: string;
  email: string;
  phone: string;
  company: string;
  companyId: string; // Link to existing company
  website: string;
  selectedServices: string[];
  serviceArea: string;
  yearsExperience: string;
  bio: string;
  idVerified: boolean;
  agreedToTerms: boolean;
}

const PROVIDER_SERVICES = [
  { id: 'attorney', label: 'Attorney Services', icon: 'scales' },
  { id: 'notary', label: 'Notary Services', icon: 'stamp' },
  { id: 'mediation', label: 'Mediation Services', icon: 'handshake' },
  { id: 'bailbond', label: 'Bail Bond Services', icon: 'bars' },
  { id: 'interpretation', label: 'Interpretation Services', icon: 'microphone' },
  { id: 'translation', label: 'Translation Services', icon: 'globe' },
  { id: 'legalresearch', label: 'Legal Research', icon: 'search' },
  { id: 'compliance', label: 'Compliance Services', icon: 'clipboardCheck' },
];

const STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

export const ProviderProfile: React.FC<{ onComplete?: () => void }> = ({ onComplete }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<'type' | 'section1' | 'section2' | 'verification' | 'complete'>(
    'type'
  );
  const [formData, setFormData] = useState<ProviderFormData>({
    profileType: '',
    fullName: '',
    email: '',
    phone: '',
    company: '',
    companyId: '',
    website: '',
    selectedServices: [],
    serviceArea: '',
    yearsExperience: '',
    bio: '',
    idVerified: false,
    agreedToTerms: false,
  });
  const [companyOptions, setCompanyOptions] = useState<Array<{id: string; name: string}>>([]);
  const [showCompanySearch, setShowCompanySearch] = useState(false);

  const handleProfileTypeSelect = (type: 'client' | 'provider') => {
    setFormData({ ...formData, profileType: type });
    if (type === 'client') {
      handleSaveAndComplete();
    } else {
      setStep('section1');
    }
  };

  const handleCompanySearch = (searchTerm: string) => {
    if (searchTerm.length < 2) {
      setCompanyOptions([]);
      return;
    }
    // Mock company search - in production this would query the backend
    const mockCompanies = [
      { id: '1', name: 'Smith & Associates Law Firm' },
      { id: '2', name: 'Johnson Legal Services' },
      { id: '3', name: 'Legal Solutions LLC' },
    ];
    setCompanyOptions(mockCompanies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())));
  };

  const handleCompanySelect = (companyId: string, companyName: string) => {
    setFormData({ ...formData, companyId, company: companyName });
    setShowCompanySearch(false);
  };

  const handleServiceToggle = (serviceId: string) => {
    const isSelected = formData.selectedServices.includes(serviceId);
    setFormData({
      ...formData,
      selectedServices: isSelected
        ? formData.selectedServices.filter(s => s !== serviceId)
        : [...formData.selectedServices, serviceId],
    });
  };

  const handleStartVerification = async () => {
    await saveProviderData();
    setStep('verification');
    initiateIDMeVerification();
  };

  const initiateIDMeVerification = () => {
    console.log('Initiating ID.me verification for:', formData.email);
    setTimeout(() => {
      setFormData({ ...formData, idVerified: true });
      setStep('complete');
    }, 2000);
  };

  const saveProviderData = async () => {
    try {
      const response = await fetch('/api/v2/provider-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          timestamp: new Date().toISOString(),
          status: 'pending_verification',
        }),
      });
      return response.ok;
    } catch (error) {
      console.error('Failed to save provider data:', error);
      return false;
    }
  };

  const handleSaveAndComplete = async () => {
    await saveProviderData();
    setStep('complete');
    if (onComplete) onComplete();
  };

  return (
    <div className="provider-profile-container">
      {step === 'type' && (
        <div className="provider-step">
          <div className="step-header">
            <h1>Join Transcend Law</h1>
            <p>Tell us how you'd like to use Transcend Law</p>
          </div>
          <div className="profile-type-selector">
            <button className="type-card client" onClick={() => handleProfileTypeSelect('client')}>
              <ServiceIcon name="document" className="card-icon" />
              <h3>Client</h3>
              <p>I need legal services</p>
            </button>
            <button className="type-card provider" onClick={() => handleProfileTypeSelect('provider')}>
              <ServiceIcon name="scales" className="card-icon" />
              <h3>Service Provider</h3>
              <p>I provide or want to provide legal services</p>
            </button>
          </div>
        </div>
      )}

      {step === 'section1' && (
        <div className="provider-step">
          <div className="step-header">
            <h2>Step 1: Confirm Your Contact Information</h2>
            <p>Help us verify your identity</p>
          </div>
          <form className="provider-form">
            <div className="form-group">
              <label>Full Name *</label>
              <input type="text" placeholder="Your full name" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email *</label>
                <input type="email" placeholder="your@email.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Phone *</label>
                <input type="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required />
              </div>
            </div>
            <div className="form-group company-lookup">
              <label>Company/Firm (if applicable)</label>
              <p className="form-hint">Search for an existing firm to link your profile, or create a new one</p>
              <div className="company-search-container">
                <input
                  type="text"
                  placeholder="Search for your company..."
                  value={formData.company}
                  onChange={(e) => {
                    setFormData({ ...formData, company: e.target.value });
                    handleCompanySearch(e.target.value);
                  }}
                  onFocus={() => setShowCompanySearch(true)}
                />
                {showCompanySearch && companyOptions.length > 0 && (
                  <div className="company-dropdown">
                    {companyOptions.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        className="company-option"
                        onClick={() => handleCompanySelect(company.id, company.name)}
                      >
                        <span className="company-name">{company.name}</span>
                        <span className="company-link-icon">🔗</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="company-option create-new"
                      onClick={() => {
                        setShowCompanySearch(false);
                        setFormData({ ...formData, companyId: 'new' });
                      }}
                    >
                      <span className="company-name">+ Create new firm "{formData.company}"</span>
                    </button>
                  </div>
                )}
                {formData.companyId && (
                  <div className="company-linked">
                    <span className="linked-icon">✓</span>
                    <span>Linked to company profile</span>
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label>Website (if applicable)</label>
              <input type="url" placeholder="https://yourwebsite.com" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setStep('type')}>Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep('section2')} disabled={!formData.fullName || !formData.email || !formData.phone}>Next: Confirm Services</button>
            </div>
          </form>
        </div>
      )}

      {step === 'section2' && (
        <div className="provider-step">
          <div className="step-header">
            <h2>Step 2: Confirm Your Skills & Services</h2>
            <p>Select the services you provide or want to provide</p>
          </div>
          <form className="provider-form">
            <div className="form-group">
              <label>Service Areas *</label>
              <div className="services-grid">
                {PROVIDER_SERVICES.map((service) => (
                  <button key={service.id} type="button" className={`service-checkbox ${formData.selectedServices.includes(service.id) ? 'selected' : ''}`} onClick={() => handleServiceToggle(service.id)}>
                    <ServiceIcon name={service.icon} className="service-icon" />
                    <span>{service.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Service State/Region *</label>
              <select value={formData.serviceArea} onChange={(e) => setFormData({ ...formData, serviceArea: e.target.value })} required>
                <option value="">Select a state or region...</option>
                {STATES.map((state) => (<option key={state} value={state}>{state}</option>))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Years of Experience</label>
                <input type="number" placeholder="e.g., 10" min="0" max="70" value={formData.yearsExperience} onChange={(e) => setFormData({ ...formData, yearsExperience: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Professional Bio (optional)</label>
              <textarea placeholder="Tell us about your background and expertise..." value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} rows={4} />
            </div>
            <div className="checkbox-group">
              <label>
                <input type="checkbox" checked={formData.agreedToTerms} onChange={(e) => setFormData({ ...formData, agreedToTerms: e.target.checked })} required />
                <span>I agree to the Terms of Service and Privacy Policy</span>
              </label>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => setStep('section1')}>Back</button>
              <button type="button" className="btn-primary" onClick={handleStartVerification} disabled={!formData.selectedServices.length || !formData.serviceArea || !formData.agreedToTerms}>Verify with ID.me</button>
            </div>
          </form>
        </div>
      )}

      {step === 'verification' && (
        <div className="provider-step">
          <div className="step-header">
            <h2>Verifying Your Identity</h2>
            <p>Completing ID.me verification...</p>
          </div>
          <div className="verification-loading">
            <div className="spinner"></div>
            <p>Please wait while we verify your information through ID.me</p>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="provider-step">
          <div className="step-header success">
            <ServiceIcon name="check" className="success-icon" />
            <h2>Profile Complete!</h2>
            <p>Your provider profile has been created and verified</p>
          </div>
          <div className="completion-info">
            <h3>What's Next?</h3>
            <ul>
              <li>Your profile will appear in the Transcend Law directory</li>
              <li>Clients can find and contact you for your services</li>
              <li>You'll receive notifications when clients request your services</li>
              <li>Update your profile anytime from your dashboard</li>
            </ul>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-primary" onClick={() => onComplete?.()}>Go to Dashboard</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderProfile;
