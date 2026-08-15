import React, { useState } from 'react';
import './ClientIntake.css';

export interface ServiceFormData {
  serviceType: string;
  title: string;
  description: string;
  state: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  budget?: string;
}

interface CaseFormData extends ServiceFormData {
  caseType: string;
}

interface CaseCategory {
  name: string;
  icon: string;
  types: string[];
}

const CASE_CATEGORIES: CaseCategory[] = [
  {
    name: 'Business & Corporate Law',
    icon: '🏢',
    types: [
      'Antitrust Litigation',
      'Business Dissolution',
      'Business Formation',
      'Commercial Litigation',
      'Contract Negotiation',
      'Corporate Governance',
      'Intellectual Property',
      'Mergers & Acquisitions',
      'Securities Law',
    ],
  },
  {
    name: 'Real Estate & Property Law',
    icon: '🏠',
    types: [
      'Eminent Domain',
      'Eviction',
      'HOA Disputes',
      'Landlord/Tenant',
      'Property Management',
      'Real Estate Financing',
      'Real Estate Purchase/Sale',
      'Zoning & Land Use',
    ],
  },
  {
    name: 'Employment & Labor Law',
    icon: '👔',
    types: [
      'Discrimination',
      'Employment Contracts',
      'Harassment & Hostile Work',
      'Non-Compete Agreements',
      'OSHA Compliance',
      'Wage & Hour',
      'Wrongful Termination',
    ],
  },
  {
    name: 'Litigation & Dispute Resolution',
    icon: '⚖️',
    types: [
      'Appellate Law',
      'Class Action',
      'Construction Litigation',
      'Environmental Litigation',
      'Franchise Dispute',
      'General Civil Litigation',
      'Insurance Litigation',
      'Patent Litigation',
      'Securities Litigation',
      'Trademark Infringement',
    ],
  },
  {
    name: 'Intellectual Property',
    icon: '💡',
    types: [
      'Copyright Infringement',
      'Patent Law',
      'Trademark Law',
    ],
  },
  {
    name: 'Family & Matrimonial Law',
    icon: '👨‍👩‍👧‍👦',
    types: [
      'Adoption',
      'Child Custody',
      'Child Support',
      'Divorce',
      'Domestic Violence',
      'Paternity',
      'Prenuptial Agreements',
      'Spousal Support/Alimony',
    ],
  },
  {
    name: 'Personal Injury & Tort Law',
    icon: '🚑',
    types: [
      'Asbestos Litigation',
      'Automobile Accidents',
      'Mass Torts',
      'Medical Malpractice',
      'Personal Injury',
      'Premises Liability',
      'Product Liability',
      'Toxic Tort',
      'Wrongful Death',
      'Workers Compensation',
    ],
  },
  {
    name: 'Criminal Defense',
    icon: '⚔️',
    types: [
      'Criminal Defense',
      'Drug Offenses',
      'DUI/DWI Defense',
      'Expungement',
      'Felony Defense',
      'Misdemeanor Defense',
      'Post-Conviction Relief',
      'White Collar Crime',
    ],
  },
  {
    name: 'Immigration & Nationality Law',
    icon: '🌍',
    types: [
      'Asylum & Refugee Law',
      'Citizenship & Naturalization',
      'Employment-Based Immigration',
      'Family-Based Immigration',
      'Green Card',
      'Visa Applications',
    ],
  },
  {
    name: 'Tax Law',
    icon: '💰',
    types: [
      'Estate Tax',
      'International Tax',
      'IRS Audit Defense',
      'Tax Dispute Resolution',
      'Tax Planning',
    ],
  },
  {
    name: 'Bankruptcy & Insolvency',
    icon: '📋',
    types: [
      'Chapter 7 Bankruptcy',
      'Chapter 11 Bankruptcy',
      'Chapter 13 Bankruptcy',
      'Creditor Rights',
    ],
  },
];

export const ClientIntake: React.FC = () => {
  const [step, setStep] = useState<'select' | 'details' | 'confirm' | 'saved'>('select');
  const [savedIntakes, setSavedIntakes] = useState<CaseFormData[]>([]);
  const [currentIntakeId, setCurrentIntakeId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CaseFormData>({
    serviceType: 'lawyer',
    caseType: '',
    title: '',
    description: '',
    state: 'CA',
    urgency: 'medium',
  });

  const handleCaseTypeSelect = (caseType: string) => {
    setFormData({ ...formData, caseType });
    setStep('details');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveIntake = () => {
    if (!formData.title || !formData.description) {
      alert('Please fill in title and description');
      return;
    }

    if (!currentIntakeId) {
      const id = Date.now().toString();
      setSavedIntakes([...savedIntakes, { ...formData }]);
      setCurrentIntakeId(id);
    } else {
      setSavedIntakes(savedIntakes.map(intake =>
        intake === savedIntakes.find(i => i.title === formData.title) ? formData : intake
      ));
    }

    setStep('saved');
    setIsEditing(false);
  };

  const handleSubmitIntake = async () => {
    try {
      const response = await fetch('https://transcend-law.com/api/intake/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStep('confirm');
        setTimeout(() => {
          setStep('select');
          setFormData({ serviceType: 'lawyer', caseType: '', title: '', description: '', state: 'CA', urgency: 'medium' });
          setSavedIntakes([]);
          setCurrentIntakeId(null);
        }, 3000);
      }
    } catch (error) {
      console.error('Intake submission error:', error);
    }
  };

  const handleDeleteIntake = () => {
    if (confirm('Delete this intake? This action cannot be undone.')) {
      setSavedIntakes(savedIntakes.filter(intake => intake.title !== formData.title));
      setStep('select');
      setFormData({ serviceType: 'lawyer', caseType: '', title: '', description: '', state: 'CA', urgency: 'medium' });
      setCurrentIntakeId(null);
    }
  };

  return (
    <div className="client-intake-container">
      <div className="intake-header">
        <h1>📋 Let's Get Started</h1>
        <p>Tell us about your legal matter</p>
      </div>

      {step === 'select' && (
        <div className="intake-step">
          <h2>What type of case do you need help with?</h2>
          <div className="case-categories-container">
            {CASE_CATEGORIES.map((category) => (
              <div key={category.name} className="category-section">
                <div className="category-header">
                  <span className="category-icon">{category.icon}</span>
                  <h3 className="category-name">{category.name}</h3>
                </div>
                <div className="case-types-grid">
                  {category.types.map((type) => (
                    <button
                      key={type}
                      className="case-type-card"
                      onClick={() => handleCaseTypeSelect(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'details' && (
        <div className="intake-step">
          <div className="step-header">
            <button className="back-btn" onClick={() => setStep('select')}>← Back</button>
            <h2>Tell us more about your {formData.caseType}</h2>
          </div>

          <form className="intake-form">
            <div className="form-group">
              <label>Case Title *</label>
              <input
                type="text"
                name="title"
                placeholder="e.g., Contract Dispute with ABC Corp"
                value={formData.title}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                name="description"
                placeholder="Describe your legal matter in detail..."
                rows={5}
                value={formData.description}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>State *</label>
                <select name="state" value={formData.state} onChange={handleInputChange}>
                  <option value="AL">Alabama</option>
                  <option value="AK">Alaska</option>
                  <option value="AZ">Arizona</option>
                  <option value="AR">Arkansas</option>
                  <option value="CA">California</option>
                  <option value="CO">Colorado</option>
                  <option value="CT">Connecticut</option>
                  <option value="DE">Delaware</option>
                  <option value="FL">Florida</option>
                  <option value="GA">Georgia</option>
                  <option value="HI">Hawaii</option>
                  <option value="ID">Idaho</option>
                  <option value="IL">Illinois</option>
                  <option value="IN">Indiana</option>
                  <option value="IA">Iowa</option>
                  <option value="KS">Kansas</option>
                  <option value="KY">Kentucky</option>
                  <option value="LA">Louisiana</option>
                  <option value="ME">Maine</option>
                  <option value="MD">Maryland</option>
                  <option value="MA">Massachusetts</option>
                  <option value="MI">Michigan</option>
                  <option value="MN">Minnesota</option>
                  <option value="MS">Mississippi</option>
                  <option value="MO">Missouri</option>
                  <option value="MT">Montana</option>
                  <option value="NE">Nebraska</option>
                  <option value="NV">Nevada</option>
                  <option value="NH">New Hampshire</option>
                  <option value="NJ">New Jersey</option>
                  <option value="NM">New Mexico</option>
                  <option value="NY">New York</option>
                  <option value="NC">North Carolina</option>
                  <option value="ND">North Dakota</option>
                  <option value="OH">Ohio</option>
                  <option value="OK">Oklahoma</option>
                  <option value="OR">Oregon</option>
                  <option value="PA">Pennsylvania</option>
                  <option value="RI">Rhode Island</option>
                  <option value="SC">South Carolina</option>
                  <option value="SD">South Dakota</option>
                  <option value="TN">Tennessee</option>
                  <option value="TX">Texas</option>
                  <option value="UT">Utah</option>
                  <option value="VT">Vermont</option>
                  <option value="VA">Virginia</option>
                  <option value="WA">Washington</option>
                  <option value="WV">West Virginia</option>
                  <option value="WI">Wisconsin</option>
                  <option value="WY">Wyoming</option>
                </select>
              </div>

              <div className="form-group">
                <label>Urgency *</label>
                <select name="urgency" value={formData.urgency} onChange={handleInputChange}>
                  <option value="low">Low - Not time-sensitive</option>
                  <option value="medium">Medium - Needs attention soon</option>
                  <option value="high">High - Urgent matter</option>
                  <option value="urgent">Urgent - Immediate action needed</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Budget (Optional)</label>
              <input
                type="text"
                name="budget"
                placeholder="e.g., $5,000 - $10,000"
                value={formData.budget || ''}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={() => {
                setStep('select');
                setFormData({ serviceType: 'lawyer', caseType: '', title: '', description: '', state: 'CA', urgency: 'medium' });
                setIsEditing(false);
              }}>
                Back
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveIntake}>
                {isEditing ? 'Update & Save' : 'Save Draft'}
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'saved' && (
        <div className="intake-step">
          <div className="saved-intake-card">
            <h2>📝 Draft Saved</h2>
            <div className="saved-details">
              <div className="detail-row">
                <span className="label">Case Type:</span>
                <span className="value">{formData.caseType}</span>
              </div>
              <div className="detail-row">
                <span className="label">Title:</span>
                <span className="value">{formData.title}</span>
              </div>
              <div className="detail-row">
                <span className="label">State:</span>
                <span className="value">{formData.state}</span>
              </div>
              <div className="detail-row">
                <span className="label">Urgency:</span>
                <span className="value">{formData.urgency}</span>
              </div>
            </div>

            <div className="saved-actions">
              <button type="button" className="btn-secondary" onClick={() => {
                setStep('details');
                setIsEditing(true);
              }}>
                ✏️ Edit
              </button>
              <button type="button" className="btn-danger" onClick={handleDeleteIntake}>
                🗑️ Delete
              </button>
              <button type="button" className="btn-primary" onClick={handleSubmitIntake}>
                ✓ Submit to Attorneys
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="intake-step confirm-step">
          <div className="confirm-card">
            <div className="confirm-icon">✅</div>
            <h2>Thank you for your submission!</h2>
            <p>We've received your legal matter details.</p>
            <p className="confirm-subtext">Our team will review your case and connect you with the best legal professionals within 24 hours.</p>

            <div className="confirm-details">
              <div className="detail-row">
                <span className="label">Case Type:</span>
                <span className="value">{formData.caseType}</span>
              </div>
              <div className="detail-row">
                <span className="label">Title:</span>
                <span className="value">{formData.title}</span>
              </div>
              <div className="detail-row">
                <span className="label">State:</span>
                <span className="value">{formData.state}</span>
              </div>
              <div className="detail-row">
                <span className="label">Urgency:</span>
                <span className="value">{formData.urgency}</span>
              </div>
            </div>

            <button className="btn-primary" onClick={() => setStep('select')}>
              Submit Another Case
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
