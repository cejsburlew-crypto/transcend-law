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
  { id: 'family-law', name: 'Family Law', icon: '👨‍👩‍👧‍👦', description: 'Divorce, custody, adoption, child support', category: 'legal' },
  { id: 'criminal', name: 'Criminal Defense', icon: '⚖️', description: 'DUI, felony, misdemeanor defense', category: 'legal' },
  { id: 'immigration', name: 'Immigration Law', icon: '🌍', description: 'Visas, green cards, citizenship', category: 'legal' },
  { id: 'bankruptcy', name: 'Bankruptcy', icon: '💰', description: 'Chapter 7, Chapter 13 protection', category: 'legal' },
  { id: 'personal-injury', name: 'Personal Injury', icon: '🏥', description: 'Auto accidents, slip & fall', category: 'legal' },
  { id: 'employment', name: 'Employment Law', icon: '💼', description: 'Wrongful termination, discrimination', category: 'legal' },
  { id: 'real-estate', name: 'Real Estate', icon: '🏠', description: 'Property disputes, contracts, title issues', category: 'legal' },
  { id: 'estate-planning', name: 'Estate Planning', icon: '📋', description: 'Wills, trusts, probate', category: 'legal' },
  { id: 'business', name: 'Business Law', icon: '🏢', description: 'Formation, contracts, partnerships', category: 'legal' },
  { id: 'intellectual-property', name: 'Intellectual Property', icon: '💡', description: 'Patents, trademarks, copyrights', category: 'legal' },
  { id: 'tax-law', name: 'Tax Law', icon: '📊', description: 'Tax planning, IRS issues', category: 'legal' },
  { id: 'medical-malpractice', name: 'Medical Malpractice', icon: '⚕️', description: 'Healthcare negligence claims', category: 'legal' },
  { id: 'securities', name: 'Securities Law', icon: '📈', description: 'Investment disputes, securities fraud', category: 'legal' },
  { id: 'healthcare', name: 'Healthcare Law', icon: '🏥', description: 'HIPAA, licensing, regulations', category: 'legal' },
  { id: 'environmental', name: 'Environmental Law', icon: '🌱', description: 'EPA compliance, pollution', category: 'legal' },
  { id: 'labor', name: 'Labor Law', icon: '🤝', description: 'Unions, workers rights', category: 'legal' },
  { id: 'landlord-tenant', name: 'Landlord & Tenant', icon: '🔑', description: 'Eviction, lease disputes', category: 'legal' },
  { id: 'contract-law', name: 'Contract Law', icon: '📝', description: 'Drafting, disputes, enforcement', category: 'legal' },
  { id: 'litigation', name: 'Civil Litigation', icon: '⚔️', description: 'Lawsuits, disputes, appeals', category: 'legal' },
  { id: 'entertainment', name: 'Entertainment Law', icon: '🎬', description: 'Contracts, copyright, licensing', category: 'legal' },
  { id: 'consumer-protection', name: 'Consumer Protection', icon: '🛡️', description: 'Fraud, debt, rights', category: 'legal' },
  { id: 'animal-law', name: 'Animal Law', icon: '🐕', description: 'Pet ownership, abuse, liability', category: 'legal' },
  { id: 'notary', name: 'Notary Services', icon: '📝', description: '951K+ notaries, document signing, mobile notary', category: 'services' },
  { id: 'bail-bondsman', name: 'Bail Bondsman', icon: '🔓', description: 'Bail bonds, bond reduction, release assistance', category: 'services' },
  { id: 'mediator', name: 'Mediator', icon: '🤝', description: 'Dispute resolution, family mediation, conflict resolution', category: 'services' },
  { id: 'process-server', name: 'Process Server', icon: '📬', description: 'Serve legal documents, court filings', category: 'services' },
  { id: 'paralegal', name: 'Paralegal Services', icon: '📋', description: 'Document preparation, legal research, case support', category: 'services' },
  { id: 'legal-translator', name: 'Legal Translator', icon: '🌐', description: 'Document translation, certified interpretation', category: 'services' },
  { id: 'court-reporting', name: 'Court Reporting', icon: '🎙️', description: 'Deposition transcripts, real-time reporting', category: 'services' },
  { id: 'arbitrator', name: 'Arbitrator', icon: '⚖️', description: 'Binding arbitration, dispute resolution', category: 'services' },
  { id: 'investigator', name: 'Private Investigator', icon: '🔍', description: 'Background checks, case investigation, surveillance', category: 'services' },
  { id: 'expert-witness', name: 'Expert Witness', icon: '👨‍🎓', description: 'Professional expertise testimony, report writing', category: 'services' },
  { id: 'document-prep', name: 'Document Preparation', icon: '📄', description: 'Legal forms, contracts, agreements', category: 'services' },
  { id: 'legal-aid', name: 'Legal Aid', icon: '🆘', description: 'Low-cost legal services, pro bono assistance', category: 'services' },
  { id: 'compliance', name: 'Compliance Consulting', icon: '✅', description: 'Regulatory compliance, audit preparation', category: 'services' },
  { id: 'mediation-center', name: 'Mediation Center', icon: '🏛️', description: 'Community mediation, restorative justice', category: 'services' },
  { id: 'legal-accounting', name: 'Legal Accounting', icon: '💼', description: 'Forensic accounting, financial analysis', category: 'services' },
];

export const ServicesDirectory: React.FC<{ onSelectService?: (service: Service) => void }> = ({ onSelectService }) => {
  return (
    <div className="services-directory-container">
      <div className="services-header">
        <h1>🏛️ Complete Services Directory</h1>
        <p>Access 37+ legal services, notaries, mediators, bail bondsmen, and professional service providers. Find verified, vetted professionals for all your needs.</p>
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
