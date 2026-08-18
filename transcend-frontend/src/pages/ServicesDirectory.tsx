import React from 'react';
import './ServicesDirectory.css';

interface Service {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: string;
}

const LEGAL_SERVICES: Service[] = [
  { id: 'family-law', name: 'Family Law', icon: '👨‍👩‍👧‍👦', description: 'Divorce, custody, adoption, child support' },
  { id: 'criminal', name: 'Criminal Defense', icon: '⚖️', description: 'DUI, felony, misdemeanor defense' },
  { id: 'immigration', name: 'Immigration Law', icon: '🌍', description: 'Visas, green cards, citizenship' },
  { id: 'bankruptcy', name: 'Bankruptcy', icon: '💰', description: 'Chapter 7, Chapter 13 protection' },
  { id: 'personal-injury', name: 'Personal Injury', icon: '🏥', description: 'Auto accidents, slip & fall' },
  { id: 'employment', name: 'Employment Law', icon: '💼', description: 'Wrongful termination, discrimination' },
  { id: 'real-estate', name: 'Real Estate', icon: '🏠', description: 'Property disputes, contracts, title issues' },
  { id: 'estate-planning', name: 'Estate Planning', icon: '📋', description: 'Wills, trusts, probate' },
  { id: 'business', name: 'Business Law', icon: '🏢', description: 'Formation, contracts, partnerships' },
  { id: 'intellectual-property', name: 'Intellectual Property', icon: '💡', description: 'Patents, trademarks, copyrights' },
  { id: 'tax-law', name: 'Tax Law', icon: '📊', description: 'Tax planning, IRS issues' },
  { id: 'medical-malpractice', name: 'Medical Malpractice', icon: '⚕️', description: 'Healthcare negligence claims' },
  { id: 'securities', name: 'Securities Law', icon: '📈', description: 'Investment disputes, securities fraud' },
  { id: 'healthcare', name: 'Healthcare Law', icon: '🏥', description: 'HIPAA, licensing, regulations' },
  { id: 'environmental', name: 'Environmental Law', icon: '🌱', description: 'EPA compliance, pollution' },
  { id: 'labor', name: 'Labor Law', icon: '🤝', description: 'Unions, workers rights' },
  { id: 'landlord-tenant', name: 'Landlord & Tenant', icon: '🔑', description: 'Eviction, lease disputes' },
  { id: 'intellectual-property', name: 'Contract Law', icon: '📝', description: 'Drafting, disputes, enforcement' },
  { id: 'litigation', name: 'Civil Litigation', icon: '⚔️', description: 'Lawsuits, disputes, appeals' },
  { id: 'entertainment', name: 'Entertainment Law', icon: '🎬', description: 'Contracts, copyright, licensing' },
  { id: 'consumer-protection', name: 'Consumer Protection', icon: '🛡️', description: 'Fraud, debt, rights' },
  { id: 'animal-law', name: 'Animal Law', icon: '🐕', description: 'Pet ownership, abuse, liability' },
];

export const ServicesDirectory: React.FC<{ onSelectService?: (service: Service) => void }> = ({ onSelectService }) => {
  return (
    <div className="services-directory-container">
      <div className="services-header">
        <h1>📚 Legal Services Directory</h1>
        <p>Browse our comprehensive range of legal services. Select a service to find qualified attorneys in your area.</p>
      </div>

      <div className="services-grid">
        {LEGAL_SERVICES.map((service) => (
          <div
            key={service.id}
            className="service-card"
            onClick={() => onSelectService?.(service)}
          >
            <div className="service-icon">{service.icon}</div>
            <h3 className="service-name">{service.name}</h3>
            <p className="service-description">{service.description}</p>
            <button className="service-button">
              Find Attorneys →
            </button>
          </div>
        ))}
      </div>

      <div className="services-footer">
        <h2>Need Help Finding the Right Service?</h2>
        <p>Contact our support team or browse by service above. All attorneys are verified and have privacy protection enabled.</p>
      </div>
    </div>
  );
};

export default ServicesDirectory;
