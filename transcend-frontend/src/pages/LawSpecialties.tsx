import React, { useState } from 'react';
import './LawSpecialties.css';

export interface LawSpecialty {
  id: string;
  name: string;
  description: string;
  examples: string[];
  icon: string;
  avgCost: string;
  complexity: 'Low' | 'Medium' | 'High';
}

const LAW_SPECIALTIES: LawSpecialty[] = [
  // Corporate & Business Law
  { id: 'corporate', name: 'Corporate Law', description: 'Business formation, contracts, M&A, and corporate governance', examples: ['LLC formation', 'Business acquisitions', 'Board resolutions', 'Shareholder disputes'], icon: '🏢', avgCost: '$300-500/hr', complexity: 'High' },
  { id: 'employment', name: 'Employment Law', description: 'Workplace disputes, contracts, discrimination, and compliance', examples: ['Wrongful termination', 'Discrimination claims', 'Non-compete agreements', 'HR compliance'], icon: '👔', avgCost: '$200-400/hr', complexity: 'Medium' },
  { id: 'intellectual', name: 'Intellectual Property', description: 'Patents, trademarks, copyrights, and IP protection', examples: ['Patent filing', 'Trademark registration', 'Copyright protection', 'IP licensing'], icon: '💡', avgCost: '$250-450/hr', complexity: 'High' },
  { id: 'contracts', name: 'Contract Law', description: 'Contract drafting, review, and dispute resolution', examples: ['Service agreements', 'Lease agreements', 'Contract negotiation', 'Breach disputes'], icon: '📝', avgCost: '$150-300/hr', complexity: 'Medium' },

  // Family Law
  { id: 'divorce', name: 'Divorce & Separation', description: 'Divorce proceedings, asset division, and custody arrangements', examples: ['Divorce filing', 'Asset division', 'Spousal support', 'Mediation'], icon: '💔', avgCost: '$200-400/hr', complexity: 'Medium' },
  { id: 'family', name: 'Family Law', description: 'Child custody, adoption, and family matters', examples: ['Custody arrangements', 'Adoption proceedings', 'Child support', 'Guardianship'], icon: '👨‍👩‍👧', avgCost: '$150-350/hr', complexity: 'Medium' },
  { id: 'adoption', name: 'Adoption Law', description: 'Domestic and international adoption proceedings', examples: ['Domestic adoption', 'International adoption', 'Stepparent adoption', 'Adoption records'], icon: '👶', avgCost: '$100-300/hr', complexity: 'Low' },

  // Real Estate & Property
  { id: 'realEstate', name: 'Real Estate Law', description: 'Property transactions, titles, and disputes', examples: ['Property purchase/sale', 'Title disputes', 'Landlord-tenant', 'Property disputes'], icon: '🏠', avgCost: '$200-350/hr', complexity: 'Medium' },
  { id: 'landlord', name: 'Landlord & Tenant', description: 'Lease disputes, evictions, and rental agreements', examples: ['Eviction proceedings', 'Lease disputes', 'Deposit claims', 'Rental agreements'], icon: '🔑', avgCost: '$100-250/hr', complexity: 'Low' },
  { id: 'propertyDispute', name: 'Property Disputes', description: 'Boundary disputes, easements, and property rights', examples: ['Boundary disputes', 'Easement rights', 'Encroachment claims', 'Title defects'], icon: '📍', avgCost: '$200-400/hr', complexity: 'High' },

  // Tax Law
  { id: 'taxLaw', name: 'Tax Law', description: 'Tax planning, compliance, and dispute resolution', examples: ['Tax planning', 'IRS audits', 'Tax returns', 'Trust taxation'], icon: '📊', avgCost: '$250-400/hr', complexity: 'High' },
  { id: 'estateTax', name: 'Estate & Tax Planning', description: 'Wills, trusts, and estate tax planning', examples: ['Will drafting', 'Trust creation', 'Estate planning', 'Tax minimization'], icon: '📋', avgCost: '$300-500/hr', complexity: 'High' },

  // Criminal Law
  { id: 'criminalDefense', name: 'Criminal Defense', description: 'Defense representation in criminal matters', examples: ['DUI defense', 'Drug charges', 'Felony defense', 'Bail hearings'], icon: '⚖️', avgCost: '$200-500/hr', complexity: 'High' },
  { id: 'whiteCollar', name: 'White Collar Crime', description: 'Corporate crime, fraud, and financial crimes', examples: ['Fraud defense', 'Securities violations', 'Embezzlement', 'Money laundering'], icon: '💼', avgCost: '$400-800/hr', complexity: 'High' },
  { id: 'dui', name: 'DUI Defense', description: 'Driving under influence defense and mitigation', examples: ['First-time DUI', 'Felony DUI', 'License reinstatement', 'Sentencing mitigation'], icon: '🚗', avgCost: '$1500-5000 flat', complexity: 'Medium' },

  // Litigation & Disputes
  { id: 'civilLitigation', name: 'Civil Litigation', description: 'General civil disputes and lawsuits', examples: ['Personal injury claims', 'Contract disputes', 'Commercial disputes', 'Debt collection'], icon: '⚔️', avgCost: '$200-400/hr', complexity: 'Medium' },
  { id: 'personalInjury', name: 'Personal Injury', description: 'Injury claims, accidents, and negligence', examples: ['Car accidents', 'Slip & fall', 'Medical malpractice', 'Product liability'], icon: '🤕', avgCost: '$150-300/hr', complexity: 'Medium' },
  { id: 'medicalMalpractice', name: 'Medical Malpractice', description: 'Medical negligence and malpractice claims', examples: ['Surgical errors', 'Misdiagnosis', 'Birth injuries', 'Medication errors'], icon: '⚕️', avgCost: '$300-600/hr', complexity: 'High' },
  { id: 'construction', name: 'Construction Disputes', description: 'Construction defects and contract disputes', examples: ['Defective construction', 'Payment disputes', 'Mechanic liens', 'Performance bonds'], icon: '🏗️', avgCost: '$250-400/hr', complexity: 'High' },

  // Bankruptcy & Debt
  { id: 'bankruptcy', name: 'Bankruptcy Law', description: 'Personal and business bankruptcy proceedings', examples: ['Chapter 7 bankruptcy', 'Chapter 13 bankruptcy', 'Debt restructuring', 'Creditor defense'], icon: '💸', avgCost: '$500-2000 flat', complexity: 'High' },
  { id: 'debtCollection', name: 'Debt Collection Defense', description: 'Defense against debt collection', examples: ['Collection lawsuits', 'FDCPA violations', 'Debt negotiation', 'Judgment defense'], icon: '📧', avgCost: '$100-250/hr', complexity: 'Low' },

  // Immigration
  { id: 'immigration', name: 'Immigration Law', description: 'Visa, green cards, citizenship, and deportation', examples: ['Visa applications', 'Green card', 'Citizenship', 'Deportation defense'], icon: '🌍', avgCost: '$200-400/hr', complexity: 'Medium' },
  { id: 'deportation', name: 'Deportation Defense', description: 'Defense against removal proceedings', examples: ['Removal hearings', 'Asylum claims', 'Cancellation of removal', 'VAWA petitions'], icon: '✈️', avgCost: '$300-600/hr', complexity: 'High' },

  // Administrative & Government
  { id: 'administrative', name: 'Administrative Law', description: 'Government agencies and regulatory compliance', examples: ['Agency disputes', 'Regulatory compliance', 'Administrative appeals', 'License disputes'], icon: '🏛️', avgCost: '$200-400/hr', complexity: 'Medium' },
  { id: 'appeals', name: 'Appeals', description: 'Appellate representation and appeals', examples: ['Appeal filing', 'Brief writing', 'Oral arguments', 'Post-conviction appeals'], icon: '📜', avgCost: '$250-500/hr', complexity: 'High' },
  { id: 'publicDefender', name: 'Public Interest Law', description: 'Civil rights and social justice litigation', examples: ['Civil rights claims', 'Police misconduct', 'Discrimination suits', 'Wrongful conviction'], icon: '✊', avgCost: '$100-200/hr', complexity: 'High' },

  // Specialized Areas
  { id: 'bankruptcy', name: 'Bankruptcy & Insolvency', description: 'Complex bankruptcy and restructuring matters', examples: ['Chapter 11 reorganization', 'Creditor rights', 'Asset recovery', 'Workout strategies'], icon: '📉', avgCost: '$400-800/hr', complexity: 'High' },
  { id: 'environmental', name: 'Environmental Law', description: 'Environmental compliance and remediation', examples: ['EPA compliance', 'Pollution claims', 'Land remediation', 'Environmental audits'], icon: '🌿', avgCost: '$250-450/hr', complexity: 'High' },
  { id: 'securities', name: 'Securities Law', description: 'Securities compliance and disputes', examples: ['SEC compliance', 'Stock disputes', 'IPO representation', 'Securities fraud'], icon: '📈', avgCost: '$300-600/hr', complexity: 'High' },
  { id: 'insurance', name: 'Insurance Law', description: 'Insurance disputes and coverage matters', examples: ['Coverage disputes', 'Claim denial', 'Bad faith claims', 'Policy disputes'], icon: '🛡️', avgCost: '$200-400/hr', complexity: 'Medium' },
  { id: 'healthcare', name: 'Healthcare Law', description: 'Healthcare compliance and disputes', examples: ['HIPAA compliance', 'Medicare/Medicaid', 'Patient disputes', 'Facility licensing'], icon: '🏥', avgCost: '$250-400/hr', complexity: 'Medium' },
  { id: 'entertainment', name: 'Entertainment Law', description: 'Entertainment contracts and disputes', examples: ['Contract negotiation', 'Copyright issues', 'Artist representation', 'Licensing disputes'], icon: '🎬', avgCost: '$300-600/hr', complexity: 'High' },
  { id: 'sports', name: 'Sports Law', description: 'Sports contracts and disputes', examples: ['Athlete contracts', 'Endorsement deals', 'Dispute resolution', 'League matters'], icon: '⚽', avgCost: '$250-500/hr', complexity: 'Medium' },
  { id: 'animal', name: 'Animal Law', description: 'Animal rights and animal-related disputes', examples: ['Pet injury claims', 'Animal cruelty', 'Wildlife law', 'Animal bites'], icon: '🐾', avgCost: '$100-250/hr', complexity: 'Low' },
  { id: 'education', name: 'Education Law', description: 'Educational institutions and student matters', examples: ['Student discipline', 'Special education', 'Title IX issues', 'Discrimination'], icon: '🎓', avgCost: '$150-300/hr', complexity: 'Medium' },
  { id: 'nonprofitLaw', name: 'Nonprofit Law', description: '501(c)(3) compliance and governance', examples: ['501(c)(3) formation', 'Nonprofit governance', 'Grant compliance', 'Tax exemption'], icon: '🤝', avgCost: '$200-350/hr', complexity: 'Medium' },
  { id: 'elderLaw', name: 'Elder Law', description: 'Estate planning and elder issues', examples: ['Power of attorney', 'Guardianship', 'Elder abuse', 'Medicaid planning'], icon: '👴', avgCost: '$150-300/hr', complexity: 'Medium' },
  { id: 'probate', name: 'Probate & Estate', description: 'Will contests and estate administration', examples: ['Probate administration', 'Will contests', 'Heir disputes', 'Estate litigation'], icon: '📜', avgCost: '$200-400/hr', complexity: 'Medium' },
];

interface LawSpecialtiesProps {
  onSelectSpecialty: (specialty: LawSpecialty) => void;
}

export const LawSpecialties: React.FC<LawSpecialtiesProps> = ({ onSelectSpecialty }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComplexity, setSelectedComplexity] = useState<'All' | 'Low' | 'Medium' | 'High'>('All');

  const filtered = LAW_SPECIALTIES.filter(specialty => {
    const matchesSearch = specialty.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         specialty.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesComplexity = selectedComplexity === 'All' || specialty.complexity === selectedComplexity;
    return matchesSearch && matchesComplexity;
  });

  return (
    <div className="law-specialties-container">
      <div className="specialties-header">
        <h1>⚖️ Legal Specialties</h1>
        <p>Find the right legal expertise for your situation</p>
      </div>

      <div className="specialties-filters">
        <input
          type="text"
          placeholder="Search specialties..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="complexity-filters">
          {(['All', 'Low', 'Medium', 'High'] as const).map(level => (
            <button
              key={level}
              className={`complexity-btn ${selectedComplexity === level ? 'active' : ''}`}
              onClick={() => setSelectedComplexity(level)}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="specialties-grid">
        {filtered.map(specialty => (
          <button
            key={specialty.id}
            className="specialty-card"
            onClick={() => onSelectSpecialty(specialty)}
          >
            <div className="specialty-icon">{specialty.icon}</div>
            <h3>{specialty.name}</h3>
            <p className="description">{specialty.description}</p>
            <div className="specialty-meta">
              <span className={`complexity ${specialty.complexity.toLowerCase()}`}>
                {specialty.complexity}
              </span>
              <span className="cost">{specialty.avgCost}</span>
            </div>
            <div className="select-arrow">→</div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="no-results">
          <p>No specialties found matching your search</p>
        </div>
      )}
    </div>
  );
};
