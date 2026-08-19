import React, { useState, useEffect } from 'react';
import { generateMockNotaries, getNotaryCountForState, NOTARY_COUNTS } from '../data/notaries-loader';
import { ServiceIcon } from '../components/ServiceIcon';
import { useLanguage } from '../context/LanguageContext';
import './ServicesDirectory.css';

interface Professional {
  id: string;
  name: string;
  specializations: string[];
  rating: string;
  reviews: number;
  yearsExperience: number;
  hourlyRate: number;
  phone: string;
  verified: boolean;
  type: 'attorney' | 'notary';
  tier?: 'tier1' | 'tier2' | 'tier3';
}

// Maps the canonical (English) service name stored on provider records to its
// translation key. Records keep their raw English values — only the label the
// user reads is translated, so filtering and matching are unaffected.
const SPEC_KEYS: Record<string, string> = {
  'Administrative Law': 'administrativeLaw',
  'Adoption Law': 'adoptionLaw',
  'Antitrust Law': 'antitrustLaw',
  'Arbitration': 'arbitration',
  'Bankruptcy': 'bankruptcy',
  'Business Law': 'businessLaw',
  'Civil Rights': 'civilRights',
  'Commercial Leasing': 'commercialLeasing',
  'Construction Law': 'constructionLaw',
  'Contracts': 'contracts',
  'Copyright Law': 'copyrightLaw',
  'Corporate Law': 'corporateLaw',
  'Criminal Law': 'criminalLaw',
  'Disability Law': 'disabilityLaw',
  'Discrimination Law': 'discriminationLaw',
  'DUI/DWI': 'dui',
  'Education Law': 'educationLaw',
  'Employment Law': 'employmentLaw',
  'Entertainment Law': 'entertainmentLaw',
  'Environmental Law': 'environmentalLaw',
  'Estate Planning': 'estatePlanning',
  'Estate Tax': 'estateTax',
  'Family Law': 'familyLaw',
  'Franchise Law': 'franchiseLaw',
  'Healthcare Law': 'healthcareLaw',
  'Immigration Law': 'immigrationLaw',
  'Insurance Law': 'insuranceLaw',
  'Intellectual Property': 'intellectualProperty',
  'International Law': 'internationalLaw',
  'Land Use & Zoning': 'landUseZoning',
  'Medical Malpractice': 'medicalMalpractice',
  'Mergers & Acquisitions': 'mergerAcquisitions',
  'Patent Law': 'patentLaw',
  'Personal Injury': 'personalInjury',
  'Probate Law': 'probateLaw',
  'Product Liability': 'productLiability',
  'Real Estate': 'realEstate',
  'Real Estate Development': 'realEstateDevelopment',
  'Regulatory Compliance': 'regulatoryCompliance',
  'Securities Law': 'securitiesLaw',
  'Social Security': 'socialSecurity',
  'Sports Law': 'sportsLaw',
  'Trademark Law': 'trademarkLaw',
  'Trust Law': 'trustLaw',
  'White Collar Crime': 'whiteCollarCrime',
  'Workers Compensation': 'workersCompensation',
  'Notary Services': 'notaryServices',
  'Mobile Notary': 'mobileNotary',
  'eNotary': 'eNotary',
  'Document Preparation': 'documentPreparation',
  'Family Mediation': 'familyMediation',
  'Business Mediation': 'businessMediation',
  'Divorce Mediation': 'divorceMediation',
  'Conflict Resolution': 'conflictResolution',
  'Felony Bonds': 'felonyBonds',
  'Misdemeanor Bonds': 'misdemeanorBonds',
  'Immigration Bonds': 'immigrationBonds',
  'Court Interpretation': 'courtInterpretation',
  'Certified Translation': 'certifiedTranslation',
  'Legal Documents': 'legalDocuments',
  'Legal Research': 'legalResearch',
  'Compliance': 'compliance',
};

// Max notaries rendered at once in the directory preview.
const NOTARY_PREVIEW_LIMIT = 200;

interface IntakeFormData {
  name: string;
  email: string;
  phone: string;
  caseDescription: string;
  specialization: string;
  preferredTier: string;
}

const MOCK_ATTORNEYS: Record<string, Professional[]> = {
  CA: [
    { id: 'CA-001', name: 'Smith & Johnson Law Group', specializations: ['Corporate Law', 'Real Estate'], rating: '4.8', reviews: 245, yearsExperience: 22, hourlyRate: 350, phone: '(510) 555-1000', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'CA-002', name: 'Jones Attorneys', specializations: ['Intellectual Property', 'Corporate Law'], rating: '4.7', reviews: 189, yearsExperience: 18, hourlyRate: 325, phone: '(650) 555-1001', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'CA-003', name: 'Williams & Associates', specializations: ['Family Law', 'Personal Injury', 'Estate Planning'], rating: '4.9', reviews: 312, yearsExperience: 25, hourlyRate: 300, phone: '(408) 555-1002', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'CA-004', name: 'Brown Law Office', specializations: ['Personal Injury', 'Real Estate'], rating: '4.6', reviews: 156, yearsExperience: 15, hourlyRate: 275, phone: '(415) 555-1003', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'CA-005', name: 'Martinez Legal Group', specializations: ['Real Estate', 'Family Law', 'Estate Planning'], rating: '4.7', reviews: 203, yearsExperience: 20, hourlyRate: 290, phone: '(619) 555-1004', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'CA-006', name: 'Silicon Valley IP Law', specializations: ['Intellectual Property', 'Corporate Law'], rating: '4.9', reviews: 287, yearsExperience: 24, hourlyRate: 400, phone: '(650) 555-1005', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'CA-007', name: 'Bay Area Family Law', specializations: ['Family Law', 'Personal Injury'], rating: '4.8', reviews: 198, yearsExperience: 19, hourlyRate: 310, phone: '(510) 555-1006', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'CA-008', name: 'Los Angeles Real Estate', specializations: ['Real Estate', 'Corporate Law'], rating: '4.7', reviews: 223, yearsExperience: 21, hourlyRate: 340, phone: '(213) 555-1007', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'CA-009', name: 'San Diego Personal Injury', specializations: ['Personal Injury', 'Family Law'], rating: '4.6', reviews: 167, yearsExperience: 16, hourlyRate: 295, phone: '(619) 555-1008', verified: true, type: 'attorney', tier: 'tier3' },
    { id: 'CA-010', name: 'Sacramento Corporate Law', specializations: ['Corporate Law', 'Intellectual Property', 'Estate Planning'], rating: '4.8', reviews: 201, yearsExperience: 20, hourlyRate: 330, phone: '(916) 555-1009', verified: true, type: 'attorney', tier: 'tier3' },
  ],
  TX: [
    { id: 'TX-001', name: 'Houston Energy Law', specializations: ['Corporate Law', 'Real Estate'], rating: '4.9', reviews: 267, yearsExperience: 25, hourlyRate: 360, phone: '(713) 555-2001', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'TX-002', name: 'Dallas Personal Injury', specializations: ['Personal Injury', 'Family Law'], rating: '4.7', reviews: 198, yearsExperience: 18, hourlyRate: 310, phone: '(214) 555-2002', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'TX-003', name: 'Austin Tech Law', specializations: ['Intellectual Property', 'Corporate Law'], rating: '4.8', reviews: 234, yearsExperience: 21, hourlyRate: 345, phone: '(512) 555-2003', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'TX-004', name: 'San Antonio Real Estate', specializations: ['Real Estate', 'Family Law', 'Estate Planning'], rating: '4.6', reviews: 156, yearsExperience: 16, hourlyRate: 295, phone: '(210) 555-2004', verified: true, type: 'attorney', tier: 'tier3' },
    { id: 'TX-005', name: 'Fort Worth Law Partners', specializations: ['Corporate Law', 'Personal Injury'], rating: '4.7', reviews: 189, yearsExperience: 19, hourlyRate: 320, phone: '(817) 555-2005', verified: true, type: 'attorney', tier: 'tier2' },
  ],
  NY: [
    { id: 'NY-001', name: 'Manhattan Corporate Law', specializations: ['Corporate Law', 'Real Estate'], rating: '4.9', reviews: 312, yearsExperience: 28, hourlyRate: 450, phone: '(212) 555-3001', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'NY-002', name: 'Brooklyn Family Law', specializations: ['Family Law', 'Personal Injury'], rating: '4.8', reviews: 267, yearsExperience: 23, hourlyRate: 380, phone: '(718) 555-3002', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'NY-003', name: 'New York IP Law', specializations: ['Intellectual Property', 'Corporate Law'], rating: '4.7', reviews: 234, yearsExperience: 22, hourlyRate: 420, phone: '(212) 555-3003', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'NY-004', name: 'Queens Real Estate Law', specializations: ['Real Estate', 'Family Law', 'Estate Planning'], rating: '4.6', reviews: 189, yearsExperience: 18, hourlyRate: 340, phone: '(718) 555-3004', verified: true, type: 'attorney', tier: 'tier2' },
  ],
  FL: [
    { id: 'FL-001', name: 'Miami Personal Injury', specializations: ['Personal Injury', 'Family Law'], rating: '4.8', reviews: 245, yearsExperience: 21, hourlyRate: 330, phone: '(305) 555-4001', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'FL-002', name: 'Orlando Corporate Law', specializations: ['Corporate Law', 'Real Estate'], rating: '4.7', reviews: 203, yearsExperience: 20, hourlyRate: 310, phone: '(407) 555-4002', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'FL-003', name: 'Tampa Family Law', specializations: ['Family Law', 'Intellectual Property', 'Estate Planning'], rating: '4.9', reviews: 267, yearsExperience: 25, hourlyRate: 340, phone: '(813) 555-4003', verified: true, type: 'attorney', tier: 'tier1' },
  ],
  PA: [
    { id: 'PA-001', name: 'Philadelphia Corporate Law', specializations: ['Corporate Law', 'Real Estate', 'Estate Planning'], rating: '4.8', reviews: 234, yearsExperience: 23, hourlyRate: 370, phone: '(215) 555-5001', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'PA-002', name: 'Pittsburgh Personal Injury', specializations: ['Personal Injury', 'Family Law'], rating: '4.7', reviews: 198, yearsExperience: 19, hourlyRate: 310, phone: '(412) 555-5002', verified: true, type: 'attorney', tier: 'tier2' },
  ],
  GA: [
    { id: 'GA-001', name: 'Atlanta Legal Associates', specializations: ['Personal Injury', 'Corporate Law'], rating: '4.8', reviews: 234, yearsExperience: 20, hourlyRate: 320, phone: '(404) 555-6001', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'GA-002', name: 'Georgia Law Partners', specializations: ['Family Law', 'Intellectual Property'], rating: '4.7', reviews: 178, yearsExperience: 17, hourlyRate: 310, phone: '(678) 555-6002', verified: true, type: 'attorney', tier: 'tier3' },
    { id: 'GA-003', name: 'Savannah Legal Firm', specializations: ['Real Estate', 'Corporate Law', 'Estate Planning'], rating: '4.9', reviews: 290, yearsExperience: 28, hourlyRate: 340, phone: '(912) 555-6003', verified: true, type: 'attorney', tier: 'tier1' },
  ],
  IL: [
    { id: 'IL-001', name: 'Chicago Corporate Law', specializations: ['Corporate Law', 'Real Estate'], rating: '4.8', reviews: 267, yearsExperience: 24, hourlyRate: 380, phone: '(312) 555-7001', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'IL-002', name: 'Chicago Family Law Center', specializations: ['Family Law', 'Personal Injury', 'Estate Planning'], rating: '4.9', reviews: 298, yearsExperience: 26, hourlyRate: 340, phone: '(312) 555-7002', verified: true, type: 'attorney', tier: 'tier1' },
  ],
  WA: [
    { id: 'WA-001', name: 'Seattle Tech Law', specializations: ['Intellectual Property', 'Corporate Law'], rating: '4.8', reviews: 245, yearsExperience: 21, hourlyRate: 360, phone: '(206) 555-8001', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'WA-002', name: 'Seattle Family Law', specializations: ['Family Law', 'Personal Injury', 'Estate Planning'], rating: '4.7', reviews: 201, yearsExperience: 19, hourlyRate: 310, phone: '(206) 555-8002', verified: true, type: 'attorney', tier: 'tier2' },
  ],
  MA: [
    { id: 'MA-001', name: 'Boston Corporate Law', specializations: ['Corporate Law', 'Real Estate', 'Estate Planning'], rating: '4.9', reviews: 289, yearsExperience: 26, hourlyRate: 420, phone: '(617) 555-9001', verified: true, type: 'attorney', tier: 'tier1' },
    { id: 'MA-002', name: 'Boston IP Law', specializations: ['Intellectual Property', 'Corporate Law'], rating: '4.8', reviews: 267, yearsExperience: 24, hourlyRate: 410, phone: '(617) 555-9002', verified: true, type: 'attorney', tier: 'tier1' },
  ],
  CO: [
    { id: 'CO-001', name: 'Denver Corporate Law', specializations: ['Corporate Law', 'Real Estate', 'Estate Planning'], rating: '4.7', reviews: 212, yearsExperience: 20, hourlyRate: 340, phone: '(303) 555-10001', verified: true, type: 'attorney', tier: 'tier2' },
    { id: 'CO-002', name: 'Denver Personal Injury', specializations: ['Personal Injury', 'Family Law'], rating: '4.8', reviews: 234, yearsExperience: 21, hourlyRate: 320, phone: '(303) 555-10002', verified: true, type: 'attorney', tier: 'tier2' },
  ],
};

export const ServicesDirectory: React.FC = () => {
  const { t } = useLanguage();
  const [selectedState, setSelectedState] = useState('CA');
  const [selectedCounty, setSelectedCounty] = useState('');
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>(MOCK_ATTORNEYS.CA);
  const [filteredProfessionals, setFilteredProfessionals] = useState<Professional[]>(MOCK_ATTORNEYS.CA);
  const [loading, setLoading] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [showNotaries, setShowNotaries] = useState(false);
  const [serviceIsAttorney, setServiceIsAttorney] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [intakeFormType, setIntakeFormType] = useState<'service' | 'attorney' | 'notary' | 'professional' | null>(null);
  const [formData, setFormData] = useState<IntakeFormData>({
    name: '',
    email: '',
    phone: '',
    caseDescription: '',
    specialization: '',
    preferredTier: '',
  });

  // Grouped by who delivers the service. `attorney: false` categories are
  // non-attorney providers, so their copy and CTAs never say "lawyer".
  const categories = [
    {
      id: 'attorney-services',
      tKey: 'attorneyServices',
      icon: 'scales',
      attorney: true,
      specializations: ['Administrative Law', 'Adoption Law', 'Antitrust Law', 'Arbitration', 'Bankruptcy', 'Business Law', 'Civil Rights', 'Commercial Leasing', 'Construction Law', 'Contracts', 'Copyright Law', 'Corporate Law', 'Criminal Law', 'Disability Law', 'Discrimination Law', 'DUI/DWI', 'Education Law', 'Employment Law', 'Entertainment Law', 'Environmental Law', 'Estate Planning', 'Estate Tax', 'Family Law', 'Franchise Law', 'Healthcare Law', 'Immigration Law', 'Insurance Law', 'Intellectual Property', 'International Law', 'Land Use & Zoning', 'Medical Malpractice', 'Mergers & Acquisitions', 'Patent Law', 'Personal Injury', 'Probate Law', 'Product Liability', 'Real Estate', 'Real Estate Development', 'Regulatory Compliance', 'Securities Law', 'Social Security', 'Sports Law', 'Trademark Law', 'Trust Law', 'White Collar Crime', 'Workers Compensation'],
    },
    {
      id: 'documentation-services',
      tKey: 'documentationServices',
      icon: 'stamp',
      attorney: false,
      specializations: ['Notary Services', 'Mobile Notary', 'eNotary', 'Document Preparation'],
    },
    {
      id: 'dispute-resolution',
      tKey: 'disputeResolution',
      icon: 'converge',
      attorney: false,
      specializations: ['Family Mediation', 'Business Mediation', 'Divorce Mediation', 'Conflict Resolution'],
    },
    {
      id: 'bail-bond-services',
      tKey: 'bailBondServices',
      icon: 'bars',
      attorney: false,
      specializations: ['Felony Bonds', 'Misdemeanor Bonds', 'Immigration Bonds'],
    },
    {
      id: 'language-services',
      tKey: 'languageServices',
      icon: 'globe',
      attorney: false,
      specializations: ['Court Interpretation', 'Certified Translation', 'Legal Documents'],
    },
    {
      id: 'legal-support-services',
      tKey: 'legalSupportServices',
      icon: 'documents',
      attorney: false,
      specializations: ['Legal Research', 'Compliance'],
    },
  ] as const;

  const states = [
    { code: 'CA', name: 'California' },
    { code: 'TX', name: 'Texas' },
    { code: 'NY', name: 'New York' },
    { code: 'FL', name: 'Florida' },
    { code: 'PA', name: 'Pennsylvania' },
    { code: 'GA', name: 'Georgia' },
    { code: 'IL', name: 'Illinois' },
    { code: 'WA', name: 'Washington' },
    { code: 'MA', name: 'Massachusetts' },
    { code: 'CO', name: 'Colorado' },
  ];

  // Load professionals by state
  useEffect(() => {
    setLoading(true);
    setTimeout(() => {
      let items: Professional[] = MOCK_ATTORNEYS[selectedState] || [];

      // Add notaries if enabled - load ALL notaries for the state
      if (showNotaries) {
        // Cap the preview: CA alone has 136,747 notaries and the list is rendered
        // once per category section, which locks up the browser if uncapped.
        const notaryCount = Math.min(getNotaryCountForState(selectedState), NOTARY_PREVIEW_LIMIT);
        if (notaryCount > 0) {
          const mockNotaries = generateMockNotaries(selectedState, notaryCount).map((n: any) => ({
            ...n,
            type: 'notary' as const,
            tier: Math.random() > 0.7 ? 'tier1' : Math.random() > 0.6 ? 'tier2' : 'tier3'
          }));
          items = [...items, ...mockNotaries];
        }
      }

      setProfessionals(items);
      setLoading(false);
    }, 300);
  }, [selectedState, showNotaries]);

  // Apply filters to professionals
  useEffect(() => {
    let filtered = professionals.filter(p => p.specializations && Array.isArray(p.specializations));

    if (selectedCounty) {
      filtered = filtered.filter(p => (p as any).county === selectedCounty);
    }

    if (selectedSpecializations.length > 0) {
      filtered = filtered.filter(p => p.specializations && p.specializations.some(spec => selectedSpecializations.includes(spec)));
    }

    setFilteredProfessionals(filtered);
  }, [professionals, selectedCounty, selectedSpecializations]);

  // Get unique values for filter dropdowns
  const counties = [...new Set(professionals.filter((p: any) => p.county).map((p: any) => p.county))].sort();

  // Specialization icons and descriptions
  const specializationDetails: Record<string, { icon: string; description: string }> = {
    'Administrative Law': { icon: 'clipboardCheck', description: 'Government regulations and compliance' },
    'Adoption Law': { icon: 'people', description: 'Adoption and guardianship proceedings' },
    'Antitrust Law': { icon: 'search', description: 'Competition and monopoly laws' },
    'Arbitration': { icon: 'handshake', description: 'Dispute resolution and arbitration' },
    'Bankruptcy': { icon: 'chartDown', description: 'Chapter 7, 11, 13 filings' },
    'Business Law': { icon: 'briefcase', description: 'Business formation and operations' },
    'Civil Rights': { icon: 'heart', description: 'Constitutional and civil rights protection' },
    'Commercial Leasing': { icon: 'building', description: 'Business property leases' },
    'Construction Law': { icon: 'hammer', description: 'Construction contracts and disputes' },
    'Contracts': { icon: 'documentPen', description: 'Contract drafting and review' },
    'Copyright Law': { icon: 'circle', description: 'Copyright registration and protection' },
    'Corporate Law': { icon: 'stamp', description: 'Formation, contracts, partnerships' },
    'Criminal Law': { icon: 'gavel', description: 'Criminal defense and prosecution' },
    'Disability Law': { icon: 'wheelchair', description: 'ADA and disability rights' },
    'Discrimination Law': { icon: 'shield', description: 'Employment and civil discrimination' },
    'DUI/DWI': { icon: 'warning', description: 'Drunk driving defense' },
    'Education Law': { icon: 'book', description: 'School and education law' },
    'Employment Law': { icon: 'microphone', description: 'Employment contracts and disputes' },
    'Entertainment Law': { icon: 'star', description: 'Media, music, film, and entertainment' },
    'Environmental Law': { icon: 'leaf', description: 'Environmental regulations and compliance' },
    'Estate Planning': { icon: 'sealedDocument', description: 'Wills, trusts, probate, succession' },
    'Estate Tax': { icon: 'calculator', description: 'Estate tax planning and returns' },
    'Family Law': { icon: 'separatedRings', description: 'Divorce, custody, adoption, child support' },
    'Franchise Law': { icon: 'store', description: 'Franchise agreements and operations' },
    'Healthcare Law': { icon: 'hospital', description: 'Medical practice and healthcare regulation' },
    'Immigration Law': { icon: 'passport', description: 'Visas, green cards, citizenship' },
    'Insurance Law': { icon: 'certificate', description: 'Insurance claims and coverage disputes' },
    'Intellectual Property': { icon: 'bulb', description: 'Patents, trademarks, copyrights' },
    'International Law': { icon: 'globe', description: 'Cross-border transactions and disputes' },
    'Land Use & Zoning': { icon: 'map', description: 'Zoning, planning, and land use' },
    'Medical Malpractice': { icon: 'stethoscope', description: 'Medical negligence claims' },
    'Mergers & Acquisitions': { icon: 'chartUp', description: 'Business mergers and acquisitions' },
    'Patent Law': { icon: 'lock', description: 'Patent registration and protection' },
    'Personal Injury': { icon: 'falling', description: 'Slip & fall, auto accidents, liability' },
    'Probate Law': { icon: 'documents', description: 'Estate administration and probate' },
    'Product Liability': { icon: 'bubbles', description: 'Defective product claims' },
    'Real Estate': { icon: 'house', description: 'Property disputes, contracts, title issues' },
    'Real Estate Development': { icon: 'chartUp', description: 'Real estate development projects' },
    'Regulatory Compliance': { icon: 'clipboard', description: 'Regulatory and compliance matters' },
    'Securities Law': { icon: 'chart', description: 'Securities and investment law' },
    'Social Security': { icon: 'clock', description: 'Social Security and benefits' },
    'Sports Law': { icon: 'trophy', description: 'Sports contracts and athlete representation' },
    'Trademark Law': { icon: 'tag', description: 'Trademark registration and protection' },
    'Trust Law': { icon: 'document', description: 'Trust creation and administration' },
    'White Collar Crime': { icon: 'converge', description: 'Fraud, embezzlement, and financial crimes' },
    'Workers Compensation': { icon: 'bandage', description: 'Workers compensation claims' },
    'Notary Services': { icon: 'signedDocument', description: 'Document signing, acknowledgments' },
    'Mobile Notary': { icon: 'pin', description: 'Notary travels to your location' },
    'eNotary': { icon: 'monitorCheck', description: 'Remote online notarization' },
    'Family Mediation': { icon: 'mediation', description: 'Family dispute resolution' },
    'Business Mediation': { icon: 'briefcase', description: 'Commercial conflict resolution' },
    'Divorce Mediation': { icon: 'separatedRings', description: 'Negotiated dissolution agreements' },
    'Conflict Resolution': { icon: 'converge', description: 'General dispute mediation' },
    'Felony Bonds': { icon: 'bars', description: 'Serious charge bail bonds' },
    'Misdemeanor Bonds': { icon: 'key', description: 'Minor offense bonds' },
    'Immigration Bonds': { icon: 'globe', description: 'Immigration detention bonds' },
    '24/7 Service': { icon: 'clock', description: 'Round-the-clock availability' },
    'Legal Documents': { icon: 'documents', description: 'Document translation' },
    'Court Interpretation': { icon: 'microphone', description: 'In-court interpretation' },
    'Certified Translation': { icon: 'certificate', description: 'Certified, sworn translations' },
    'Legal Research': { icon: 'search', description: 'Case law and statutory research' },
    'Document Preparation': { icon: 'documentPen', description: 'Prepare and file legal documents' },
    'Compliance': { icon: 'clipboardCheck', description: 'Regulatory compliance' },
  };

  const toggleSpecialization = (spec: string) => {
    setSelectedSpecializations(prev =>
      prev.includes(spec)
        ? prev.filter(s => s !== spec)
        : [...prev, spec]
    );
  };

  // Translated display label for a canonical service name. Falls back to the
  // raw record value when the taxonomy has no entry, so unknown data still shows.
  const specName = (spec: string) => {
    const key = SPEC_KEYS[spec];
    return key ? t(`servicesDirectory.specs.${key}.name`) : spec;
  };

  const specDescription = (spec: string) => {
    const key = SPEC_KEYS[spec];
    return key ? t(`servicesDirectory.specs.${key}.description`) : '';
  };

  // Providers offering at least one service in the given category.
  const categoryProfessionals = (specs: readonly string[]) =>
    filteredProfessionals.filter(p =>
      p.specializations?.some(spec => specs.includes(spec))
    );

  const getAllSpecializations = () => {
    const allSpecs = new Set<string>();
    categories.forEach(cat => {
      cat.specializations.forEach(spec => allSpecs.add(spec));
    });
    return Array.from(allSpecs).sort();
  };

  return (
    <div className="services-directory-container">
      <div className="services-header">
        <h1><ServiceIcon name="courthouse" className="page-title-icon" /> {t('servicesDirectory.title')}</h1>
        <p>{t('servicesDirectory.subtitle')}</p>
      </div>

      {/* GLOBAL FILTERS */}
      <div className="filters-bar">
        <div className="filter-group">
          <label htmlFor="state-select">{t('servicesDirectory.state')}</label>
          <select
            id="state-select"
            value={selectedState}
            onChange={(e) => {
              setSelectedState(e.target.value);
              setSelectedCounty('');
            }}
            className="filter-select"
          >
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
          <span className="filter-badge">{t('servicesDirectory.notariesAvailable', { count: getNotaryCountForState(selectedState).toLocaleString() })}</span>
        </div>

        {counties.length > 0 && (
          <div className="filter-group">
            <label htmlFor="county-select">{t('servicesDirectory.county')}</label>
            <select
              id="county-select"
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="filter-select"
            >
              <option value="">{t('servicesDirectory.allCounties', { count: String(counties.length) })}</option>
              {counties.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={showNotaries}
              onChange={(e) => setShowNotaries(e.target.checked)}
              className="filter-checkbox"
            />
            {t('servicesDirectory.notaryToggle')}
          </label>
        </div>
      </div>

      {/* BACK BUTTON — shows when a service is selected */}
      {selectedSpecializations.length > 0 && (
        <div className="services-back-button-container">
          <button
            className="services-back-button"
            onClick={() => setSelectedSpecializations([])}
          >
            ← {t('common.back')}
          </button>
        </div>
      )}

      {/* ONLY SHOW SPECIALIZATION CARDS IF NO SELECTION MADE */}
      {selectedSpecializations.length === 0 && categories.map((category) => (
        <div key={category.id} className="category-section">
          <div className="category-heading">
            <h2 className="category-header">
              <ServiceIcon name={category.icon} className="category-icon" />
              {t(`servicesDirectory.categories.${category.tKey}.name`)}
              <span className={`provider-type-badge ${category.attorney ? 'is-attorney' : ''}`}>
                {category.attorney ? t('servicesDirectory.attorneyBadge') : t('servicesDirectory.nonAttorneyBadge')}
              </span>
            </h2>
            <p className="category-subtitle">{t(`servicesDirectory.categories.${category.tKey}.subtitle`)}</p>
          </div>

          {/* SPECIALIZATION CARDS FOR THIS CATEGORY - ALPHABETICAL */}
          <div className="specialization-cards">
            <div className="specialization-grid">
              {[...category.specializations]
                .sort((a, b) => specName(a).localeCompare(specName(b)))
                .map((spec) => {
                const details = specializationDetails[spec] || { icon: 'scales', description: '' };
                const count = professionals.filter(p => p.specializations && p.specializations.includes(spec)).length;
                return (
                  <div key={spec} className="spec-card-wrapper">
                    <button
                      className={`spec-card ${selectedSpecializations.includes(spec) ? 'active' : ''}`}
                      onClick={() => toggleSpecialization(spec)}
                    >
                      <ServiceIcon name={details.icon} className="spec-icon" />
                      <span className="spec-name">{specName(spec)}</span>
                      <span className="spec-description">{specDescription(spec)}</span>
                      <span className="spec-count">{t('servicesDirectory.available', { count: String(count) })}</span>
                    </button>
                    <button
                      className="intake-btn"
                      onClick={() => {
                        setSelectedService(spec);
                        setServiceIsAttorney(category.attorney);
                        setIntakeFormType('service');
                        setFormData({...formData, specialization: spec});
                      }}
                    >
                      {t(`servicesDirectory.categories.${category.tKey}.cta`)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PROFESSIONAL CARDS FOR THIS CATEGORY — only show when a specialization is selected */}
          {selectedSpecializations.length > 0 && categoryProfessionals(category.specializations).length > 0 && (
            <div className="attorneys-grid">
              {categoryProfessionals(category.specializations).map((professional) => (
                <div key={professional.id} className="attorney-card">
                  <div className="attorney-header">
                    <h3 className="attorney-name">{professional.name}</h3>
                    <div className="card-badges">
                      {professional.verified && <span className="verified-badge">✓ {t('servicesDirectory.verified')}</span>}
                      {professional.type === 'notary' && <span className="notary-badge"><ServiceIcon name="stamp" className="badge-icon" /> {t('servicesDirectory.notary')}</span>}
                      {professional.tier && <span className="tier-badge">{professional.tier === 'tier1' ? t('servicesDirectory.tierPremium') : professional.tier === 'tier2' ? t('servicesDirectory.tierStandard') : t('servicesDirectory.tierBasic')}</span>}
                    </div>
                  </div>
                  <p className="specialization">{professional.specializations && professional.specializations.length > 0 ? professional.specializations.map(specName).join(', ') : t('servicesDirectory.generalServices')}</p>
                  <div className="attorney-info">
                    <div className="info-item">
                      <span className="label">{t('servicesDirectory.rating')}:</span>
                      <span className="value">⭐ {professional.rating}/5.0</span>
                    </div>
                    <div className="info-item">
                      <span className="label">{t('servicesDirectory.reviews')}:</span>
                      <span className="value">{professional.reviews}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">{t('servicesDirectory.experience')}:</span>
                      <span className="value">{professional.yearsExperience} {t('servicesDirectory.yearsSuffix')}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">{t('servicesDirectory.rate')}:</span>
                      <span className="value">${professional.hourlyRate}{t('servicesDirectory.perHour')}</span>
                    </div>
                  </div>
                  <button className="contact-btn" onClick={() => {
                    setSelectedProfessional(professional);
                    setIntakeFormType(professional.type === 'notary' ? 'notary' : 'attorney');
                    setFormData({...formData, specialization: professional.specializations?.[0] || '', preferredTier: professional.tier || ''});
                  }}>{t('servicesDirectory.requestService')}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="services-footer">
        <h2>{t('servicesDirectory.aboutTitle')}</h2>
        <p>{t('servicesDirectory.aboutBody')}</p>
      </div>

      {/* SERVICE INTAKE FORM */}
      {intakeFormType === 'service' && selectedService && (
        <div className="intake-form-modal">
          <div className="intake-form-overlay" onClick={() => { setIntakeFormType(null); setSelectedService(null); }}></div>
          <div className="intake-form-container">
            <button className="close-btn" onClick={() => { setIntakeFormType(null); setSelectedService(null); }}>✕</button>
            <h2><ServiceIcon name="clipboardCheck" className="modal-icon" /> {t('servicesDirectory.intake.heading', { service: specName(selectedService) })}</h2>
            <p className="form-subtitle">
              {serviceIsAttorney
                ? t('servicesDirectory.intake.attorneySubtitle', { service: specName(selectedService) })
                : t('servicesDirectory.intake.providerSubtitle', { service: specName(selectedService) })}
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              alert(serviceIsAttorney
                ? t('servicesDirectory.intake.attorneySuccess', { service: specName(selectedService) })
                : t('servicesDirectory.intake.providerSuccess', { service: specName(selectedService) }));
              setIntakeFormType(null);
              setSelectedService(null);
              setFormData({ name: '', email: '', phone: '', caseDescription: '', specialization: '', preferredTier: '' });
            }}>
              <div className="form-group">
                <label>{t('servicesDirectory.intake.fullName')}</label>
                <input type="text" placeholder={t('servicesDirectory.intake.fullNamePlaceholder')} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('servicesDirectory.intake.email')}</label>
                  <input type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>{t('servicesDirectory.intake.phone')}</label>
                  <input type="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label>{serviceIsAttorney ? t('servicesDirectory.intake.attorneyDescLabel') : t('servicesDirectory.intake.providerDescLabel')}</label>
                <textarea
                  placeholder={serviceIsAttorney
                    ? t('servicesDirectory.intake.attorneyDescPlaceholder')
                    : t('servicesDirectory.intake.providerDescPlaceholder', { service: specName(selectedService) })}
                  value={formData.caseDescription}
                  onChange={(e) => setFormData({...formData, caseDescription: e.target.value})}
                  rows={6}
                  required
                ></textarea>
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => { setIntakeFormType(null); setSelectedService(null); }}>{t('common.cancel')}</button>
                <button type="submit" className="submit-btn">{t('servicesDirectory.intake.submit', { service: specName(selectedService) })}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ATTORNEY INTAKE FORM */}
      {intakeFormType === 'attorney' && selectedProfessional && (
        <div className="intake-form-modal">
          <div className="intake-form-overlay" onClick={() => { setIntakeFormType(null); setSelectedProfessional(null); }}></div>
          <div className="intake-form-container">
            <button className="close-btn" onClick={() => { setIntakeFormType(null); setSelectedProfessional(null); }}>✕</button>
            <h2><ServiceIcon name="scales" className="modal-icon" /> {t('servicesDirectory.attorneyRequest.heading')}</h2>
            <p className="form-subtitle">{t('servicesDirectory.attorneyRequest.requesting')} <strong>{selectedProfessional.name}</strong></p>

            <form onSubmit={(e) => {
              e.preventDefault();
              alert(t('servicesDirectory.attorneyRequest.success', { name: selectedProfessional.name }));
              setIntakeFormType(null);
              setSelectedProfessional(null);
              setFormData({ name: '', email: '', phone: '', caseDescription: '', specialization: '', preferredTier: '' });
            }}>
              <div className="form-group">
                <label>{t('servicesDirectory.intake.fullName')}</label>
                <input type="text" placeholder={t('servicesDirectory.intake.fullNamePlaceholder')} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('servicesDirectory.intake.email')}</label>
                  <input type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>{t('servicesDirectory.intake.phone')}</label>
                  <input type="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label>{t('servicesDirectory.attorneyRequest.descLabel')}</label>
                <textarea placeholder={t('servicesDirectory.attorneyRequest.descPlaceholder')} value={formData.caseDescription} onChange={(e) => setFormData({...formData, caseDescription: e.target.value})} rows={6} required></textarea>
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => { setIntakeFormType(null); setSelectedProfessional(null); }}>{t('common.cancel')}</button>
                <button type="submit" className="submit-btn">{t('servicesDirectory.attorneyRequest.submit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOTARY INTAKE FORM */}
      {intakeFormType === 'notary' && selectedProfessional && (
        <div className="intake-form-modal">
          <div className="intake-form-overlay" onClick={() => { setIntakeFormType(null); setSelectedProfessional(null); }}></div>
          <div className="intake-form-container">
            <button className="close-btn" onClick={() => { setIntakeFormType(null); setSelectedProfessional(null); }}>✕</button>
            <h2><ServiceIcon name="stamp" className="modal-icon" /> {t('servicesDirectory.notaryRequest.heading')}</h2>
            <p className="form-subtitle">{t('servicesDirectory.notaryRequest.booking')} <strong>{selectedProfessional.name}</strong></p>

            <form onSubmit={(e) => {
              e.preventDefault();
              alert(t('servicesDirectory.notaryRequest.success', { name: selectedProfessional.name }));
              setIntakeFormType(null);
              setSelectedProfessional(null);
              setFormData({ name: '', email: '', phone: '', caseDescription: '', specialization: '', preferredTier: '' });
            }}>
              <div className="form-group">
                <label>{t('servicesDirectory.intake.fullName')}</label>
                <input type="text" placeholder={t('servicesDirectory.intake.fullNamePlaceholder')} value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>{t('servicesDirectory.intake.email')}</label>
                  <input type="email" placeholder="john@example.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>{t('servicesDirectory.intake.phone')}</label>
                  <input type="tel" placeholder="(555) 123-4567" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} required />
                </div>
              </div>
              <div className="form-group">
                <label>{t('servicesDirectory.notaryRequest.descLabel')}</label>
                <textarea placeholder={t('servicesDirectory.notaryRequest.descPlaceholder')} value={formData.caseDescription} onChange={(e) => setFormData({...formData, caseDescription: e.target.value})} rows={6} required></textarea>
              </div>
              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={() => { setIntakeFormType(null); setSelectedProfessional(null); }}>{t('common.cancel')}</button>
                <button type="submit" className="submit-btn">{t('servicesDirectory.notaryRequest.submit')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicesDirectory;
