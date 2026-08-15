import React, { useState } from 'react';
import './LawyerWebsiteSetup.css';

interface WebsiteSetupForm {
  companyName: string;
  city: string;
  bio: string;
  phone: string;
  officeAddress: string;
  licenseNumber: string;
  yearsExperience: string;
  specializations: string[];
  excludedServices: string[];
  websiteColor: string;
  accentColor: string;
}

const AVAILABLE_SERVICES = [
  'Personal Injury',
  'Criminal Defense',
  'DUI/DWI',
  'Family Law',
  'Divorce',
  'Real Estate',
  'Business Law',
  'Contract Review',
  'Estate Planning',
  'Wills & Trusts',
  'Employment Law',
  'Bankruptcy',
  'Tax Law',
  'Immigration',
  'Intellectual Property',
];

export default function LawyerWebsiteSetup() {
  const [hasWebsite, setHasWebsite] = useState(false);
  const [formData, setFormData] = useState<WebsiteSetupForm>({
    companyName: '',
    city: '',
    bio: '',
    phone: '',
    officeAddress: '',
    licenseNumber: '',
    yearsExperience: '',
    specializations: [],
    excludedServices: [],
    websiteColor: '#ffffff',
    accentColor: '#667eea',
  });

  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [excludedServices, setExcludedServices] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSpecializationToggle = (service: string) => {
    setSelectedSpecializations((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  const handleExcludedServiceToggle = (service: string) => {
    setExcludedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  const handleSubmit = async () => {
    if (!formData.companyName.trim() || !formData.bio.trim() || !formData.phone.trim()) {
      setError('Please fill in company name, bio, and phone');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/lawyer-websites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          lawyerName: localStorage.getItem('lawyerName'),
          companyName: formData.companyName,
          city: formData.city,
          bio: formData.bio,
          email: localStorage.getItem('email'),
          phone: formData.phone,
          licenseNumber: formData.licenseNumber,
          yearsExperience: parseInt(formData.yearsExperience) || 0,
          specializations: selectedSpecializations,
          excludedServices,
          allAvailableServices: AVAILABLE_SERVICES,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(true);
        setHasWebsite(true);
        setTimeout(() => {
          window.location.href = `/website-dashboard/${result.website.subdomain}`;
        }, 2000);
      } else {
        setError('Failed to create website');
      }
    } catch (err) {
      setError('Error creating website. Please try again.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasWebsite) {
    return (
      <div className="website-setup-container">
        <div className="setup-card">
          <h2>🌐 Create Your Transcend Law Website</h2>
          <p className="subtitle">Get a professional lawyer website for just $25/month</p>

          {error && <div className="error-message">{error}</div>}
          {success && (
            <div className="success-message">
              ✅ Website created! Redirecting to your dashboard...
            </div>
          )}

          <div className="form-section">
            <h3>Company Information</h3>

            <div className="form-group">
              <label>Company/Entity Name *</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                placeholder="e.g., Smith & Associates Law Firm"
                className="form-input"
              />
              <small>Your website will be at: transcend-law.com/{formData.companyName.toLowerCase().replace(/\s+/g, '-')}</small>
            </div>

            <div className="form-group">
              <label>City/State</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="e.g., San Francisco, CA"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Professional Bio *</label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                placeholder="Tell potential clients about your background, experience, and approach..."
                rows={5}
                className="form-textarea"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="(555) 123-4567"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>License Number</label>
                <input
                  type="text"
                  name="licenseNumber"
                  value={formData.licenseNumber}
                  onChange={handleInputChange}
                  placeholder="e.g., CA Bar #123456"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Years of Experience</label>
                <select
                  name="yearsExperience"
                  value={formData.yearsExperience}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="">Select...</option>
                  <option value="0-5">0-5 years</option>
                  <option value="5-10">5-10 years</option>
                  <option value="10-20">10-20 years</option>
                  <option value="20+">20+ years</option>
                </select>
              </div>

              <div className="form-group">
                <label>Office Address</label>
                <input
                  type="text"
                  name="officeAddress"
                  value={formData.officeAddress}
                  onChange={handleInputChange}
                  placeholder="123 Main St, Suite 100"
                  className="form-input"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Practice Areas</h3>
            <p className="section-description">
              Select your specializations. Your website will show ALL available services except your competitors.
            </p>

            <div className="specializations-grid">
              {AVAILABLE_SERVICES.map((service) => (
                <button
                  key={service}
                  className={`service-checkbox ${
                    selectedSpecializations.includes(service) ? 'selected' : ''
                  }`}
                  onClick={() => handleSpecializationToggle(service)}
                >
                  {selectedSpecializations.includes(service) ? '✓' : '○'} {service}
                </button>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3>What Services NOT to Show?</h3>
            <p className="section-description">
              Select services where you have strong competitors. We'll hide those and show everything else.
            </p>

            <div className="services-grid">
              {AVAILABLE_SERVICES.map((service) => (
                <button
                  key={service}
                  className={`service-checkbox exclude ${
                    excludedServices.includes(service) ? 'selected' : ''
                  }`}
                  onClick={() => handleExcludedServiceToggle(service)}
                >
                  {excludedServices.includes(service) ? '✗' : '○'} {service}
                </button>
              ))}
            </div>
          </div>

          <div className="pricing-section">
            <h3>💰 Subscription Details</h3>
            <div className="pricing-box">
              <div className="price">$25/month</div>
              <ul className="features">
                <li>✓ Professional website at transcend-law.com/{formData.companyName.toLowerCase().replace(/\s+/g, '-')}</li>
                <li>✓ Display all your practice areas</li>
                <li>✓ Client testimonials & reviews</li>
                <li>✓ Contact form for inquiries</li>
                <li>✓ Mobile-responsive design</li>
                <li>✓ Basic analytics dashboard</li>
                <li>✓ Integration with Transcend Law</li>
                <li>✓ Cancel anytime (30-day notice)</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="submit-button"
          >
            {isSubmitting ? '⏳ Creating Your Website...' : '🚀 Launch My Website - $25/month'}
          </button>

          <div className="terms-note">
            By clicking Launch, you agree to Transcend Law's Website Terms of Service.
            Subscription charges monthly and will appear on your invoice.
          </div>
        </div>
      </div>
    );
  }

  return <div>Website created successfully!</div>;
}
