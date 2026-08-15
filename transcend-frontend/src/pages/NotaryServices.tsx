import React, { useState } from 'react';
import './NotaryServices.css';

export interface NotaryService {
  id: string;
  name: string;
  description: string;
  examples: string[];
  icon: string;
  avgTime: string;
  avgCost: string;
  availability: 'Same Day' | '24/7' | 'Next Day';
}

const NOTARY_SERVICES: NotaryService[] = [
  {
    id: 'mobile-notary',
    name: 'Mobile Notary',
    description: 'Notary comes to you - home, office, or anywhere convenient',
    examples: ['Document signing at home', 'Office document notarization', 'Remote location services', 'Hospital/care facility visits'],
    icon: '🚗',
    avgTime: '30-60 minutes',
    avgCost: '$50-150',
    availability: 'Same Day',
  },
  {
    id: 'enotary',
    name: 'Electronic Notary (eNotary)',
    description: 'Remote online notarization via video conference',
    examples: ['Remote document signing', 'Video conference notarization', 'Digital signature witnessing', 'Multi-state RON services'],
    icon: '💻',
    avgTime: '5-15 minutes',
    avgCost: '$25-75',
    availability: '24/7',
  },
  {
    id: 'loan-signing',
    name: 'Loan Signing Agent',
    description: 'Specialized notary for real estate and mortgage documents',
    examples: ['Mortgage signing', 'Refinance closing', 'Home purchase closing', 'Construction loan documents'],
    icon: '🏠',
    avgTime: '60-120 minutes',
    avgCost: '$75-200',
    availability: 'Same Day',
  },
  {
    id: 'certified-signing',
    name: 'Certified Signing Agent',
    description: 'Advanced notary with loan closing expertise and liability insurance',
    examples: ['Complex loan closings', 'Commercial transactions', 'Trust deed signings', 'High-value closings'],
    icon: '📋',
    avgTime: '90-150 minutes',
    avgCost: '$150-350',
    availability: 'Same Day',
  },
  {
    id: 'power-of-attorney',
    name: 'Power of Attorney Witness',
    description: 'Notary services for power of attorney documents',
    examples: ['Healthcare power of attorney', 'Financial power of attorney', 'Durable power of attorney', 'Limited power of attorney'],
    icon: '✍️',
    avgTime: '30-45 minutes',
    avgCost: '$50-100',
    availability: 'Same Day',
  },
  {
    id: 'affidavit',
    name: 'Affidavit Notarization',
    description: 'Witness and notarize sworn statements and affidavits',
    examples: ['Legal affidavits', 'Court documents', 'Sworn statements', 'Declaration notarization'],
    icon: '📜',
    avgTime: '15-30 minutes',
    avgCost: '$25-75',
    availability: 'Same Day',
  },
  {
    id: 'real-estate',
    name: 'Real Estate Closing Coordinator',
    description: 'Full-service real estate closing coordination and notarization',
    examples: ['Title company closings', 'Escrow coordination', 'Multi-party signings', 'Title transfer documents'],
    icon: '🏢',
    avgTime: '120-180 minutes',
    avgCost: '$200-500',
    availability: 'Same Day',
  },
  {
    id: 'apostille',
    name: 'Apostille & Document Authentication',
    description: 'International document authentication and Hague apostille services',
    examples: ['Apostille certification', 'International document auth', 'Travel documents', 'Educational credentials'],
    icon: '🌍',
    avgTime: '24-48 hours',
    avgCost: '$25-75',
    availability: 'Next Day',
  },
];

interface NotaryServicesProps {
  onSelectService: (service: NotaryService) => void;
}

export const NotaryServices: React.FC<NotaryServicesProps> = ({ onSelectService }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState<'All' | 'Same Day' | '24/7' | 'Next Day'>('All');
  const [selectedCategory, setSelectedCategory] = useState<'Mobile' | 'Online' | 'BrickMortar'>('Online');

  const getCategoryServices = () => {
    let categoryServices = NOTARY_SERVICES;
    if (selectedCategory === 'Mobile') {
      categoryServices = NOTARY_SERVICES.filter(s =>
        s.id === 'mobile-notary' || s.id === 'loan-signing' || s.id === 'certified-signing' ||
        s.id === 'real-estate' || s.id === 'power-of-attorney' || s.id === 'affidavit'
      );
    } else if (selectedCategory === 'Online') {
      categoryServices = NOTARY_SERVICES.filter(s =>
        s.id === 'enotary' || s.id === 'apostille'
      );
    } else {
      // Brick-and-Mortar - future expansion for physical office locations
      categoryServices = [];
    }
    return categoryServices;
  };

  const filtered = getCategoryServices().filter(service => {
    const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAvailability = selectedAvailability === 'All' || service.availability === selectedAvailability;
    return matchesSearch && matchesAvailability;
  });

  return (
    <div className="notary-services-container">
      <div className="services-header">
        <h1>🔏 On-Demand Notary Services</h1>
        <p>Get notarized instantly - mobile, online, or in-person</p>
      </div>

      <div className="category-tabs">
        <button
          className={`category-tab ${selectedCategory === 'Mobile' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Mobile')}
        >
          🚗 Mobile Notary
        </button>
        <button
          className={`category-tab ${selectedCategory === 'Online' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('Online')}
        >
          💻 Online (eNotary)
        </button>
        <button
          className={`category-tab ${selectedCategory === 'BrickMortar' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('BrickMortar')}
        >
          🏢 Brick-and-Mortar
        </button>
      </div>

      <div className="services-filters">
        <input
          type="text"
          placeholder="Search notary services..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="availability-filters">
          {(['All', 'Same Day', '24/7', 'Next Day'] as const).map(level => (
            <button
              key={level}
              className={`availability-btn ${selectedAvailability === level ? 'active' : ''}`}
              onClick={() => setSelectedAvailability(level)}
            >
              {level === '24/7' ? '24/7 Available' : level}
            </button>
          ))}
        </div>
      </div>

      <div className="services-grid">
        {filtered.map(service => (
          <button
            key={service.id}
            className="service-card"
            onClick={() => onSelectService(service)}
          >
            <div className="service-icon">{service.icon}</div>
            <h3>{service.name}</h3>
            <p className="description">{service.description}</p>
            <div className="service-meta">
              <span className="time">⏱️ {service.avgTime}</span>
              <span className={`availability ${service.availability.toLowerCase().replace('/', '-')}`}>
                {service.availability === '24/7' ? '🌙' : '⚡'} {service.availability}
              </span>
            </div>
            <div className="price">{service.avgCost}</div>
            <div className="select-arrow">→</div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="no-results">
          <p>No services found matching your search</p>
        </div>
      )}
    </div>
  );
};
