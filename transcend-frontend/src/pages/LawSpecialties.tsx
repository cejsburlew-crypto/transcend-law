import React, { useState, useEffect } from 'react';
import './LawSpecialties.css';

export interface LawSpecialty {
  id: string;
  name: string;
  description: string;
  examples: string[];
  icon: string;
  avgCost: string;
  complexity: 'Low' | 'Medium' | 'High';
  statesAvailable: number;
  firmsCount: number;
  attorneysCount: number;
}

interface LawFirmStats {
  [specialtyId: string]: {
    firmsCount: number;
    attorneysCount: number;
    statesAvailable: number;
  };
}

const LAW_SPECIALTIES: LawSpecialty[] = [
  // HIGH-VISIBILITY, HIGH-CAPACITY SPECIALTIES (sorted by attorney count descending)
  { id: 'civilLitigation', name: 'Civil Litigation', description: 'General civil disputes and lawsuits', examples: ['Personal injury claims', 'Contract disputes', 'Commercial disputes', 'Debt collection'], icon: '⚔️', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 4567, attorneysCount: 13425 },
  { id: 'contracts', name: 'Contract Law', description: 'Contract drafting, review, and dispute resolution', examples: ['Service agreements', 'Lease agreements', 'Contract negotiation', 'Breach disputes'], icon: '📝', avgCost: '$150-300/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 4102, attorneysCount: 11856 },
  { id: 'criminalDefense', name: 'Criminal Defense', description: 'Defense representation in criminal matters', examples: ['DUI defense', 'Drug charges', 'Felony defense', 'Bail hearings'], icon: '⚖️', avgCost: '$200-500/hr', complexity: 'High', statesAvailable: 50, firmsCount: 3892, attorneysCount: 11240 },
  { id: 'divorce', name: 'Divorce & Separation', description: 'Divorce proceedings, asset division, and custody arrangements', examples: ['Divorce filing', 'Asset division', 'Spousal support', 'Mediation'], icon: '💔', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 3745, attorneysCount: 10932 },
  { id: 'realEstate', name: 'Real Estate Law', description: 'Property transactions, titles, and disputes', examples: ['Property purchase/sale', 'Title disputes', 'Landlord-tenant', 'Property disputes'], icon: '🏠', avgCost: '$200-350/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 3456, attorneysCount: 10284 },
  { id: 'employment', name: 'Employment Law', description: 'Workplace disputes, contracts, discrimination, and compliance', examples: ['Wrongful termination', 'Discrimination claims', 'Non-compete agreements', 'HR compliance'], icon: '👔', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 3156, attorneysCount: 9247 },
  { id: 'family', name: 'Family Law', description: 'Child custody, adoption, and family matters', examples: ['Custody arrangements', 'Adoption proceedings', 'Child support', 'Guardianship'], icon: '👨‍👩‍👧', avgCost: '$150-350/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 3298, attorneysCount: 9674 },
  { id: 'personalInjury', name: 'Personal Injury', description: 'Injury claims, accidents, and negligence', examples: ['Car accidents', 'Slip & fall', 'Medical malpractice', 'Product liability'], icon: '🤕', avgCost: '$150-300/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 3234, attorneysCount: 9567 },
  { id: 'dui', name: 'DUI Defense', description: 'Driving under influence defense and mitigation', examples: ['First-time DUI', 'Felony DUI', 'License reinstatement', 'Sentencing mitigation'], icon: '🚗', avgCost: '$1500-5000 flat', complexity: 'Medium', statesAvailable: 50, firmsCount: 2834, attorneysCount: 8102 },

  // TRAFFIC VIOLATIONS - HIGH-CAPACITY SPECIALTY
  { id: 'trafficViolations', name: 'Traffic Violations', description: 'Traffic tickets, speeding, and motor vehicle violations', examples: ['Speeding tickets', 'Reckless driving', 'License suspension', 'Traffic court representation'], icon: '🚦', avgCost: '$200-500 flat', complexity: 'Low', statesAvailable: 50, firmsCount: 3124, attorneysCount: 8945 },

  // WORKERS' COMPENSATION - CRITICAL HIGH-CAPACITY
  { id: 'workersComp', name: 'Workers\' Compensation', description: 'Workplace injury claims and workers comp benefits', examples: ['Injury claims', 'Benefit denial appeals', 'Permanent disability', 'Workers comp litigation'], icon: '⚙️', avgCost: '$150-300/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 3845, attorneysCount: 10234 },

  // SOCIAL SECURITY DISABILITY - CRITICAL HIGH-CAPACITY
  { id: 'socialSecurityDisability', name: 'Social Security Disability', description: 'SSD/SSI claims and disability benefits', examples: ['SSDI applications', 'SSI claims', 'Benefit appeals', 'Disability hearings'], icon: '📋', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 2934, attorneysCount: 8234 },

  // CORPORATE & BUSINESS LAW
  { id: 'corporate', name: 'Corporate Law', description: 'Business formation, contracts, M&A, and corporate governance', examples: ['LLC formation', 'Business acquisitions', 'Board resolutions', 'Shareholder disputes'], icon: '🏢', avgCost: '$300-500/hr', complexity: 'High', statesAvailable: 50, firmsCount: 2847, attorneysCount: 8294 },

  // PROBATE & ESTATE
  { id: 'probate', name: 'Probate & Estate', description: 'Will contests and estate administration', examples: ['Probate administration', 'Will contests', 'Heir disputes', 'Estate litigation'], icon: '📜', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 2456, attorneysCount: 7123 },
  { id: 'estateTax', name: 'Estate & Tax Planning', description: 'Wills, trusts, and estate tax planning', examples: ['Will drafting', 'Trust creation', 'Estate planning', 'Tax minimization'], icon: '📋', avgCost: '$300-500/hr', complexity: 'High', statesAvailable: 50, firmsCount: 2567, attorneysCount: 7340 },

  // DEBT & BANKRUPTCY
  { id: 'bankruptcy', name: 'Bankruptcy Law', description: 'Personal and business bankruptcy proceedings', examples: ['Chapter 7 bankruptcy', 'Chapter 13 bankruptcy', 'Debt restructuring', 'Creditor defense'], icon: '💸', avgCost: '$500-2000 flat', complexity: 'High', statesAvailable: 50, firmsCount: 2341, attorneysCount: 6890 },
  { id: 'taxLaw', name: 'Tax Law', description: 'Tax planning, compliance, and dispute resolution', examples: ['Tax planning', 'IRS audits', 'Tax returns', 'Trust taxation'], icon: '📊', avgCost: '$250-400/hr', complexity: 'High', statesAvailable: 50, firmsCount: 2341, attorneysCount: 6890 },

  // APPEALS & ADMIN
  { id: 'appeals', name: 'Appeals', description: 'Appellate representation and appeals', examples: ['Appeal filing', 'Brief writing', 'Oral arguments', 'Post-conviction appeals'], icon: '📜', avgCost: '$250-500/hr', complexity: 'High', statesAvailable: 50, firmsCount: 2156, attorneysCount: 6234 },
  { id: 'debtCollection', name: 'Debt Collection Defense', description: 'Defense against debt collection', examples: ['Collection lawsuits', 'FDCPA violations', 'Debt negotiation', 'Judgment defense'], icon: '📧', avgCost: '$100-250/hr', complexity: 'Low', statesAvailable: 50, firmsCount: 2134, attorneysCount: 5678 },

  // INTELLECTUAL PROPERTY
  { id: 'intellectual', name: 'Intellectual Property', description: 'Patents, trademarks, copyrights, and IP protection', examples: ['Patent filing', 'Trademark registration', 'Copyright protection', 'IP licensing'], icon: '💡', avgCost: '$250-450/hr', complexity: 'High', statesAvailable: 48, firmsCount: 1872, attorneysCount: 5634 },

  // LANDLORD & TENANT
  { id: 'landlord', name: 'Landlord & Tenant', description: 'Lease disputes, evictions, and rental agreements', examples: ['Eviction proceedings', 'Lease disputes', 'Deposit claims', 'Rental agreements'], icon: '🔑', avgCost: '$100-250/hr', complexity: 'Low', statesAvailable: 50, firmsCount: 2145, attorneysCount: 5789 },

  // INSURANCE & SPECIALIZED
  { id: 'insurance', name: 'Insurance Law', description: 'Insurance disputes and coverage matters', examples: ['Coverage disputes', 'Claim denial', 'Bad faith claims', 'Policy disputes'], icon: '🛡️', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 48, firmsCount: 1678, attorneysCount: 4890 },
  { id: 'medicalMalpractice', name: 'Medical Malpractice', description: 'Medical negligence and malpractice claims', examples: ['Surgical errors', 'Misdiagnosis', 'Birth injuries', 'Medication errors'], icon: '⚕️', avgCost: '$300-600/hr', complexity: 'High', statesAvailable: 48, firmsCount: 1678, attorneysCount: 4892 },
  { id: 'whiteCollar', name: 'White Collar Crime', description: 'Corporate crime, fraud, and financial crimes', examples: ['Fraud defense', 'Securities violations', 'Embezzlement', 'Money laundering'], icon: '💼', avgCost: '$400-800/hr', complexity: 'High', statesAvailable: 45, firmsCount: 1456, attorneysCount: 4230 },
  { id: 'construction', name: 'Construction Disputes', description: 'Construction defects and contract disputes', examples: ['Defective construction', 'Payment disputes', 'Mechanic liens', 'Performance bonds'], icon: '🏗️', avgCost: '$250-400/hr', complexity: 'High', statesAvailable: 46, firmsCount: 1456, attorneysCount: 4123 },
  { id: 'immigration', name: 'Immigration Law', description: 'Visa, green cards, citizenship, and deportation', examples: ['Visa applications', 'Green card', 'Citizenship', 'Deportation defense'], icon: '🌍', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 45, firmsCount: 1567, attorneysCount: 4234 },

  // SPECIALIZED & NICHE
  { id: 'administrative', name: 'Administrative Law', description: 'Government agencies and regulatory compliance', examples: ['Agency disputes', 'Regulatory compliance', 'Administrative appeals', 'License disputes'], icon: '🏛️', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 48, firmsCount: 1234, attorneysCount: 3456 },
  { id: 'propertyDispute', name: 'Property Disputes', description: 'Boundary disputes, easements, and property rights', examples: ['Boundary disputes', 'Easement rights', 'Encroachment claims', 'Title defects'], icon: '📍', avgCost: '$200-400/hr', complexity: 'High', statesAvailable: 47, firmsCount: 1203, attorneysCount: 3456 },
  { id: 'securities', name: 'Securities Law', description: 'Securities compliance and disputes', examples: ['SEC compliance', 'Stock disputes', 'IPO representation', 'Securities fraud'], icon: '📈', avgCost: '$300-600/hr', complexity: 'High', statesAvailable: 43, firmsCount: 1123, attorneysCount: 3456 },
  { id: 'elderLaw', name: 'Elder Law', description: 'Estate planning and elder issues', examples: ['Power of attorney', 'Guardianship', 'Elder abuse', 'Medicaid planning'], icon: '👴', avgCost: '$150-300/hr', complexity: 'Medium', statesAvailable: 47, firmsCount: 1123, attorneysCount: 3234 },
  { id: 'healthcare', name: 'Healthcare Law', description: 'Healthcare compliance and disputes', examples: ['HIPAA compliance', 'Medicare/Medicaid', 'Patient disputes', 'Facility licensing'], icon: '🏥', avgCost: '$250-400/hr', complexity: 'Medium', statesAvailable: 45, firmsCount: 1345, attorneysCount: 3890 },
  { id: 'deprecationDefense', name: 'Deportation Defense', description: 'Defense against removal proceedings', examples: ['Removal hearings', 'Asylum claims', 'Cancellation of removal', 'VAWA petitions'], icon: '✈️', avgCost: '$300-600/hr', complexity: 'High', statesAvailable: 42, firmsCount: 987, attorneysCount: 2567 },
  { id: 'publicDefender', name: 'Public Interest Law', description: 'Civil rights and social justice litigation', examples: ['Civil rights claims', 'Police misconduct', 'Discrimination suits', 'Wrongful conviction'], icon: '✊', avgCost: '$100-200/hr', complexity: 'High', statesAvailable: 42, firmsCount: 856, attorneysCount: 2340 },
  { id: 'adoption', name: 'Adoption Law', description: 'Domestic and international adoption proceedings', examples: ['Domestic adoption', 'International adoption', 'Stepparent adoption', 'Adoption records'], icon: '👶', avgCost: '$100-300/hr', complexity: 'Low', statesAvailable: 48, firmsCount: 856, attorneysCount: 2104 },
  { id: 'education', name: 'Education Law', description: 'Educational institutions and student matters', examples: ['Student discipline', 'Special education', 'Title IX issues', 'Discrimination'], icon: '🎓', avgCost: '$150-300/hr', complexity: 'Medium', statesAvailable: 44, firmsCount: 678, attorneysCount: 1956 },
  { id: 'entertainment', name: 'Entertainment Law', description: 'Entertainment contracts and disputes', examples: ['Contract negotiation', 'Copyright issues', 'Artist representation', 'Licensing disputes'], icon: '🎬', avgCost: '$300-600/hr', complexity: 'High', statesAvailable: 40, firmsCount: 567, attorneysCount: 1890 },
  { id: 'nonprofitLaw', name: 'Nonprofit Law', description: '501(c)(3) compliance and governance', examples: ['501(c)(3) formation', 'Nonprofit governance', 'Grant compliance', 'Tax exemption'], icon: '🤝', avgCost: '$200-350/hr', complexity: 'Medium', statesAvailable: 46, firmsCount: 834, attorneysCount: 2456 },
  { id: 'environmental', name: 'Environmental Law', description: 'Environmental compliance and remediation', examples: ['EPA compliance', 'Pollution claims', 'Land remediation', 'Environmental audits'], icon: '🌿', avgCost: '$250-450/hr', complexity: 'High', statesAvailable: 46, firmsCount: 934, attorneysCount: 2789 },
  { id: 'sports', name: 'Sports Law', description: 'Sports contracts and disputes', examples: ['Athlete contracts', 'Endorsement deals', 'Dispute resolution', 'League matters'], icon: '⚽', avgCost: '$250-500/hr', complexity: 'Medium', statesAvailable: 38, firmsCount: 423, attorneysCount: 1234 },
  { id: 'animal', name: 'Animal Law', description: 'Animal rights and animal-related disputes', examples: ['Pet injury claims', 'Animal cruelty', 'Wildlife law', 'Animal bites'], icon: '🐾', avgCost: '$100-250/hr', complexity: 'Low', statesAvailable: 35, firmsCount: 312, attorneysCount: 745 },

  // ADDITIONAL HIGH-DEMAND SPECIALTIES
  { id: 'wrongfulDeath', name: 'Wrongful Death', description: 'Death claims from accidents, medical malpractice, or negligence', examples: ['Accidental death', 'Medical negligence death', 'Vehicular fatality', 'Wrongful death suits'], icon: '💔', avgCost: '$200-400/hr', complexity: 'High', statesAvailable: 50, firmsCount: 2456, attorneysCount: 7123 },
  { id: 'productLiability', name: 'Product Liability', description: 'Defective product injury claims and litigation', examples: ['Defective products', 'Manufacturing defects', 'Product recall', 'Toxic exposure'], icon: '⚠️', avgCost: '$200-450/hr', complexity: 'High', statesAvailable: 50, firmsCount: 1834, attorneysCount: 5423 },
  { id: 'businessLitigation', name: 'Business Litigation', description: 'Commercial disputes and business lawsuits', examples: ['Partnership disputes', 'Shareholder disputes', 'Business tort claims', 'Commercial breach'], icon: '💼', avgCost: '$250-500/hr', complexity: 'High', statesAvailable: 50, firmsCount: 2567, attorneysCount: 7456 },
  { id: 'foreclosureDefense', name: 'Foreclosure Defense', description: 'Defense against home foreclosure and loan issues', examples: ['Foreclosure defense', 'Loan modification', 'Short sale', 'Mortgage disputes'], icon: '🏠', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 2134, attorneysCount: 6234 },
  { id: 'expungement', name: 'Expungement & Record Sealing', description: 'Criminal record expungement and sealing', examples: ['Criminal record expungement', 'Arrest record sealing', 'Conviction reduction', 'Record clearance'], icon: '🗑️', avgCost: '$500-2000 flat', complexity: 'Low', statesAvailable: 50, firmsCount: 2345, attorneysCount: 6789 },
  { id: 'domesticViolence', name: 'Domestic Violence Defense', description: 'Defense against domestic violence charges', examples: ['DV charge defense', 'Restraining order defense', 'DV appeal', 'Protective order challenge'], icon: '🛡️', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 1876, attorneysCount: 5432 },
  { id: 'juvenileDefense', name: 'Juvenile Delinquency', description: 'Representation of juveniles in criminal proceedings', examples: ['Juvenile charges', 'Delinquency hearings', 'Juvenile waiver defense', 'Juvenile detention'], icon: '👦', avgCost: '$150-300/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 1654, attorneysCount: 4789 },
  { id: 'drugCrimesDefense', name: 'Drug Crime Defense', description: 'Defense in drug possession and distribution charges', examples: ['Drug possession', 'Drug distribution', 'Drug manufacturing', 'Drug paraphernalia'], icon: '💊', avgCost: '$200-500/hr', complexity: 'High', statesAvailable: 50, firmsCount: 2234, attorneysCount: 6456 },
  { id: 'classActionLitigation', name: 'Class Action Litigation', description: 'Class action suits and multi-party litigation', examples: ['Class action suits', 'Mass tort litigation', 'Consumer class actions', 'Securities class actions'], icon: '👥', avgCost: '$300-600/hr', complexity: 'High', statesAvailable: 48, firmsCount: 1345, attorneysCount: 3890 },
  { id: 'hoaDisputes', name: 'HOA & Property Management', description: 'Homeowners association disputes and governance', examples: ['HOA disputes', 'Condo association issues', 'HOA enforcement', 'Assessment disputes'], icon: '🏘️', avgCost: '$150-300/hr', complexity: 'Medium', statesAvailable: 48, firmsCount: 1456, attorneysCount: 4123 },
  { id: 'smallClaimsCourt', name: 'Small Claims Court', description: 'Small claims litigation and collection', examples: ['Small claims suits', 'Debt collection', 'Damage claims', 'Small business disputes'], icon: '⚖️', avgCost: '$100-200/hr', complexity: 'Low', statesAvailable: 50, firmsCount: 2678, attorneysCount: 7234 },
  { id: 'employmentDiscrimination', name: 'Employment Discrimination', description: 'Discrimination and harassment in workplace', examples: ['Race discrimination', 'Gender discrimination', 'Age discrimination', 'Disability discrimination'], icon: '⚖️', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 50, firmsCount: 2156, attorneysCount: 6234 },
  { id: 'whistleblowerProtection', name: 'Whistleblower Protection', description: 'Retaliation and whistleblower claim defense', examples: ['Retaliation claims', 'Whistleblower protection', 'SEC complaints', 'Government whistleblower'], icon: '🔔', avgCost: '$250-450/hr', complexity: 'High', statesAvailable: 48, firmsCount: 987, attorneysCount: 2834 },
  { id: 'mediationArbitration', name: 'Mediation & Arbitration', description: 'Alternative dispute resolution and arbitration', examples: ['Arbitration representation', 'Mediation services', 'Dispute resolution', 'Contract arbitration'], icon: '🤝', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 48, firmsCount: 1234, attorneysCount: 3567 },
  { id: 'prenuptialAgreements', name: 'Prenuptial Agreements', description: 'Prenuptial and postnuptial agreement drafting', examples: ['Prenup drafting', 'Prenup negotiation', 'Postnup agreement', 'Prenup enforcement'], icon: '💍', avgCost: '$500-2000 flat', complexity: 'Medium', statesAvailable: 50, firmsCount: 1567, attorneysCount: 4234 },
  { id: 'zoning', name: 'Zoning & Land Use', description: 'Zoning appeals and land use disputes', examples: ['Zoning variances', 'Zoning appeals', 'Land use disputes', 'Zoning compliance'], icon: '🗺️', avgCost: '$200-400/hr', complexity: 'Medium', statesAvailable: 48, firmsCount: 1123, attorneysCount: 3234 },
  { id: 'eminent', name: 'Eminent Domain', description: 'Condemnation and eminent domain claims', examples: ['Condemnation defense', 'Fair market value', 'Taking compensation', 'Property seizure'], icon: '📍', avgCost: '$300-500/hr', complexity: 'High', statesAvailable: 48, firmsCount: 834, attorneysCount: 2456 },
];

interface LawSpecialtiesProps {
  onSelectSpecialty: (specialty: LawSpecialty) => void;
}

export const LawSpecialties: React.FC<LawSpecialtiesProps> = ({ onSelectSpecialty }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComplexity, setSelectedComplexity] = useState<'All' | 'Low' | 'Medium' | 'High'>('All');
  const [stats, setStats] = useState<LawFirmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [specialties, setSpecialties] = useState<LawSpecialty[]>(LAW_SPECIALTIES);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/v1/law-firms/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data.data);

          // Update specialties with real data
          const updatedSpecialties = LAW_SPECIALTIES.map(specialty => ({
            ...specialty,
            statesAvailable: data.data[specialty.id]?.statesAvailable || specialty.statesAvailable,
            firmsCount: data.data[specialty.id]?.firmsCount || specialty.firmsCount,
            attorneysCount: data.data[specialty.id]?.attorneysCount || specialty.attorneysCount,
          }));
          setSpecialties(updatedSpecialties);
        }
      } catch (error) {
        console.error('Failed to fetch law firm stats:', error);
        // Fall back to default data
        setSpecialties(LAW_SPECIALTIES);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const filtered = specialties.filter(specialty => {
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
              title={level === 'Low' ? 'Simpler cases with fewer requirements' : level === 'Medium' ? 'Moderate complexity cases' : level === 'High' ? 'Complex cases requiring expertise' : 'All complexity levels'}
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
              <div className="meta-item">
                <span className="meta-label">States:</span>
                <span className="meta-value">{specialty.statesAvailable}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Firms:</span>
                <span className="meta-value">{specialty.firmsCount.toLocaleString()}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Attorneys:</span>
                <span className="meta-value">{specialty.attorneysCount.toLocaleString()}</span>
              </div>
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
