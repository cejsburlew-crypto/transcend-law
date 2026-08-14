import React from 'react';
import './ServiceSelection.css';

export interface ServiceSelectionProps {
  onSelectService: (service: string) => void;
}

const SERVICES = [
  { icon: '⚖️', name: 'Lawyer', description: 'Legal representation and counsel' },
  { icon: '🔏', name: 'Notary', description: 'Document notarization services' },
  { icon: '🔍', name: 'Private Investigator', description: 'Investigative services' },
  { icon: '📋', name: 'Paralegal', description: 'Legal assistance and support' },
  { icon: '📄', name: 'Legal Document Preparer', description: 'Document drafting and preparation' },
  { icon: '🎙️', name: 'Court Reporter', description: 'Court transcription services' },
  { icon: '📮', name: 'Process Server', description: 'Legal document service' },
  { icon: '👨‍💼', name: 'Expert Witness', description: 'Expert testimony services' },
  { icon: '💡', name: 'Legal Consultant', description: 'Legal advice and consultation' },
  { icon: '🤝', name: 'Mediator', description: 'Dispute mediation services' },
  { icon: '🔗', name: 'Bail Bondsman', description: 'Bail and bond services' },
  { icon: '🏠', name: 'Title Agent', description: 'Property title services' },
  { icon: '💰', name: 'Forensic Accountant', description: 'Accounting and forensic analysis' },
  { icon: '🔐', name: 'Background Check Service', description: 'Background verification' },
  { icon: '🎯', name: 'Skip Tracer', description: 'Asset and person location services' },
  { icon: '📊', name: 'Insurance Adjuster', description: 'Claims adjustment services' },
  { icon: '⚡', name: 'Arbitrator', description: 'Dispute resolution and arbitration' },
  { icon: '📚', name: 'Legal Researcher', description: 'Legal research services' },
  { icon: '📑', name: 'Contract Reviewer', description: 'Contract analysis and review' },
  { icon: '✅', name: 'Compliance Consultant', description: 'Regulatory compliance services' },
];

export const ServiceSelection: React.FC<ServiceSelectionProps> = ({ onSelectService }) => {
  return (
    <div className="service-selection-container">
      <div className="service-header">
        <h1>📚 What Service Do You Need?</h1>
        <p>Select a service category to get started</p>
      </div>

      <div className="services-grid">
        {SERVICES.map((service) => (
          <button
            key={service.name}
            className="service-card"
            onClick={() => onSelectService(service.name)}
            title={service.description}
          >
            <div className="service-icon">{service.icon}</div>
            <h3 className="service-name">{service.name}</h3>
            <p className="service-desc">{service.description}</p>
            <div className="service-arrow">→</div>
          </button>
        ))}
      </div>

      <div className="service-info">
        <p>
          💡 <strong>Not sure which service you need?</strong> Contact our support team and we'll help you find the right professional.
        </p>
      </div>
    </div>
  );
};
