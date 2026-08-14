import React, { useState } from 'react'
import './ServiceIntakeForms.css'

interface IntakeFormData {
  [key: string]: string | number | boolean | string[]
}

interface ServiceIntakeFormProps {
  serviceName: string
  serviceIcon: string
  onSubmit: (data: IntakeFormData) => void
  onCancel: () => void
  providerName?: string
}

// Mock profile data
const MOCK_PROFILE = {
  clientName: 'John Smith',
  clientEmail: 'john.smith@email.com',
  clientPhone: '(555) 123-4567',
  clientAddress: '123 Main St, San Francisco, CA 94105',
}

const FORM_CONFIGS: Record<string, any> = {
  Lawyer: {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
          { name: 'clientAddress', label: 'Address', type: 'text', readOnly: true },
        ],
      },
      {
        title: 'Case Type',
        fields: [
          {
            name: 'caseType',
            label: 'Select Case Type',
            type: 'select',
            options: ['Corporate', 'Litigation', 'Family Law', 'Estate Planning', 'Employment', 'Real Estate'],
          },
        ],
      },
      {
        title: 'Case Details',
        fields: [
          { name: 'caseTitle', label: 'Case Title', type: 'text' },
          { name: 'description', label: 'Case Description', type: 'textarea' },
          { name: 'amount', label: 'Amount in Dispute (if applicable)', type: 'number' },
        ],
      },
      {
        title: 'Timeline & Budget',
        fields: [
          { name: 'deadline', label: 'When do you need this completed?', type: 'date' },
          { name: 'budget', label: 'Budget', type: 'select', options: ['Under $500', '$500-$2K', '$2K-$5K', '$5K+'] },
        ],
      },
    ],
  },
  Paralegal: {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Work Type',
        fields: [
          {
            name: 'workType',
            label: 'What type of support do you need?',
            type: 'select',
            options: ['Document Preparation', 'Legal Research', 'Case Management', 'Litigation Support', 'Deposition Preparation'],
          },
        ],
      },
      {
        title: 'Project Details',
        fields: [
          { name: 'projectDescription', label: 'Describe your project', type: 'textarea' },
          { name: 'documents', label: 'Number of documents to prepare/review', type: 'number' },
          { name: 'timeline', label: 'Timeline', type: 'select', options: ['Urgent (1-2 days)', 'Standard (1 week)', 'Flexible (2+ weeks)'] },
        ],
      },
    ],
  },
  'Private Investigator': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Investigation Type',
        fields: [
          {
            name: 'investigationType',
            label: 'Type of Investigation',
            type: 'select',
            options: ['Background Check', 'Fraud Investigation', 'Asset Search', 'Skip Tracing', 'Surveillance', 'Due Diligence'],
          },
        ],
      },
      {
        title: 'Subject Information',
        fields: [
          { name: 'subjectName', label: 'Subject Name', type: 'text' },
          { name: 'subjectInfo', label: 'Known Information (address, business, etc.)', type: 'textarea' },
          { name: 'scope', label: 'Scope of Investigation', type: 'textarea' },
        ],
      },
      {
        title: 'Timeline & Budget',
        fields: [
          { name: 'deadline', label: 'When do you need results?', type: 'date' },
          { name: 'budget', label: 'Budget Range', type: 'select', options: ['Under $1K', '$1K-$3K', '$3K-$5K', '$5K+'] },
        ],
      },
    ],
  },
  'Court Reporter': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Reporting Type',
        fields: [
          {
            name: 'reportingType',
            label: 'Type of Reporting Needed',
            type: 'select',
            options: ['Deposition', 'Trial', 'Hearing', 'Medical Testimony', 'Realtime Reporting', 'Transcript Only'],
          },
        ],
      },
      {
        title: 'Event Details',
        fields: [
          { name: 'eventDate', label: 'Date of Event', type: 'date' },
          { name: 'eventLocation', label: 'Location', type: 'text' },
          { name: 'estimatedDuration', label: 'Estimated Duration', type: 'select', options: ['1-2 hours', '2-4 hours', '4-8 hours', 'Full day', 'Multiple days'] },
          { name: 'specialRequirements', label: 'Special Requirements', type: 'textarea' },
        ],
      },
    ],
  },
  'Expert Witness': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Expertise Needed',
        fields: [
          {
            name: 'expertiseArea',
            label: 'Area of Expertise',
            type: 'select',
            options: ['Engineering', 'Medical', 'Financial', 'Accident Reconstruction', 'Construction', 'Manufacturing', 'Environmental'],
          },
        ],
      },
      {
        title: 'Case Details',
        fields: [
          { name: 'caseType', label: 'Type of Case', type: 'text' },
          { name: 'issueDescription', label: 'Issues Requiring Expert Opinion', type: 'textarea' },
          { name: 'deliverables', label: 'Deliverables Needed', type: 'select', options: ['Report Only', 'Deposition', 'Trial Testimony', 'All Services'] },
          { name: 'timeline', label: 'Timeline', type: 'select', options: ['Rush (1 week)', 'Standard (2-3 weeks)', 'Flexible'] },
        ],
      },
    ],
  },
  Mediator: {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Dispute Type',
        fields: [
          {
            name: 'disputeType',
            label: 'Type of Dispute',
            type: 'select',
            options: ['Family (Divorce)', 'Family (Custody)', 'Commercial', 'Partnership', 'Employment', 'Real Estate', 'Other'],
          },
        ],
      },
      {
        title: 'Mediation Details',
        fields: [
          { name: 'otherParty', label: 'Other Party Information', type: 'textarea' },
          { name: 'disputeDescription', label: 'Describe the Dispute', type: 'textarea' },
          { name: 'goals', label: 'Your Mediation Goals', type: 'textarea' },
          { name: 'participants', label: 'Number of Participants', type: 'select', options: ['1v1', '1v1 + attorneys', 'Multiple parties'] },
        ],
      },
    ],
  },
  'Legal Document Preparer': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Document Type',
        fields: [
          {
            name: 'documentType',
            label: 'What documents do you need?',
            type: 'select',
            options: ['Will', 'Trust', 'Power of Attorney', 'Living Will', 'Contract', 'Lease Agreement', 'NDA', 'Employment Agreement'],
          },
        ],
      },
      {
        title: 'Document Details',
        fields: [
          { name: 'purpose', label: 'Purpose of Document', type: 'textarea' },
          { name: 'parties', label: 'Parties Involved', type: 'textarea' },
          { name: 'specifics', label: 'Specific Terms/Requirements', type: 'textarea' },
          { name: 'deadline', label: 'When do you need this?', type: 'date' },
        ],
      },
    ],
  },
  'Process Server': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Service Type',
        fields: [
          {
            name: 'serviceType',
            label: 'Type of Service',
            type: 'select',
            options: ['Subpoena', 'Summons', 'Complaint', 'Notice', 'Eviction Notice', 'Collections', 'Other'],
          },
        ],
      },
      {
        title: 'Defendant Information',
        fields: [
          { name: 'defendantName', label: 'Defendant Name', type: 'text' },
          { name: 'defendantAddress', label: 'Last Known Address', type: 'textarea' },
          { name: 'defendantInfo', label: 'Additional Info (phone, workplace, etc.)', type: 'textarea' },
          { name: 'documentCount', label: 'Number of Copies Needed', type: 'number' },
        ],
      },
      {
        title: 'Service Details',
        fields: [
          { name: 'deadline', label: 'When is service needed?', type: 'date' },
          { name: 'urgency', label: 'Urgency Level', type: 'select', options: ['Standard', 'Rush', 'Expedited'] },
        ],
      },
    ],
  },
  'Title Agent': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Transaction Type',
        fields: [
          {
            name: 'transactionType',
            label: 'Type of Transaction',
            type: 'select',
            options: ['Purchase', 'Sale', 'Refinance', 'Title Search', 'Title Insurance', 'Transfer'],
          },
        ],
      },
      {
        title: 'Property Details',
        fields: [
          { name: 'propertyAddress', label: 'Property Address', type: 'textarea' },
          { name: 'propertyType', label: 'Property Type', type: 'select', options: ['Residential', 'Commercial', 'Land', 'Other'] },
          { name: 'purchasePrice', label: 'Purchase/Loan Amount', type: 'number' },
          { name: 'closingDate', label: 'Expected Closing Date', type: 'date' },
        ],
      },
    ],
  },
  'Bail Bondsman': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Defendant Information',
        fields: [
          { name: 'defendantName', label: 'Defendant Name', type: 'text' },
          { name: 'defendantAge', label: 'Age', type: 'number' },
          { name: 'charges', label: 'Charges', type: 'textarea' },
          { name: 'custodyLocation', label: 'Where is Defendant Held?', type: 'text' },
        ],
      },
      {
        title: 'Bail Information',
        fields: [
          { name: 'bailAmount', label: 'Bail Amount Set', type: 'number' },
          { name: 'relationshipToDefendant', label: 'Your Relationship to Defendant', type: 'select', options: ['Family', 'Friend', 'Employer', 'Other'] },
          { name: 'urgency', label: 'When do you need release?', type: 'select', options: ['Immediate', 'Within 24 hours', 'Within 48 hours'] },
        ],
      },
    ],
  },
  'Legal Researcher': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Research Scope',
        fields: [
          {
            name: 'researchType',
            label: 'Type of Research',
            type: 'select',
            options: ['Case Law', 'Statute Review', 'Regulatory Research', 'Contract Analysis', 'Precedent Research', 'Legislative History'],
          },
        ],
      },
      {
        title: 'Research Details',
        fields: [
          { name: 'topic', label: 'Research Topic', type: 'text' },
          { name: 'questions', label: 'Specific Questions', type: 'textarea' },
          { name: 'jurisdiction', label: 'Jurisdiction(s)', type: 'text' },
          { name: 'deliverable', label: 'Deliverable Format', type: 'select', options: ['Summary', 'Full Memo', 'Annotated', 'Presentation'] },
          { name: 'deadline', label: 'Deadline', type: 'date' },
        ],
      },
    ],
  },
  'Legal Consultant': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Consultation Topic',
        fields: [
          {
            name: 'consultationTopic',
            label: 'What do you need consultation on?',
            type: 'select',
            options: ['Business Formation', 'Contract Review', 'Risk Assessment', 'Compliance', 'General Legal Advice', 'Strategic Planning'],
          },
        ],
      },
      {
        title: 'Consultation Details',
        fields: [
          { name: 'background', label: 'Background/Context', type: 'textarea' },
          { name: 'objectives', label: 'Your Objectives', type: 'textarea' },
          { name: 'timeline', label: 'Timeline for Consultation', type: 'select', options: ['Urgent', '1-2 weeks', 'Flexible'] },
          { name: 'format', label: 'Preferred Format', type: 'select', options: ['Phone Call', 'Video Conference', 'In-Person', 'Email'] },
        ],
      },
    ],
  },
  'Contract Reviewer': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Contract Details',
        fields: [
          {
            name: 'contractType',
            label: 'Type of Contract',
            type: 'select',
            options: ['Employment', 'Purchase', 'Service', 'Lease', 'NDA', 'Partnership', 'License', 'Other'],
          },
        ],
      },
      {
        title: 'Review Focus',
        fields: [
          { name: 'party', label: 'Which party are you (if indicated)?', type: 'text' },
          { name: 'concerns', label: 'Your Main Concerns', type: 'textarea' },
          { name: 'reviewType', label: 'Type of Review Needed', type: 'select', options: ['Full Review', 'Clause Review', 'Risk Analysis', 'Negotiation Notes'] },
          { name: 'deadline', label: 'When do you need review?', type: 'date' },
        ],
      },
    ],
  },
  'Compliance Consultant': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Compliance Area',
        fields: [
          {
            name: 'complianceArea',
            label: 'Area of Compliance',
            type: 'select',
            options: ['Privacy/GDPR', 'Employment Law', 'Healthcare', 'Finance/Banking', 'Environmental', 'Industry-Specific'],
          },
        ],
      },
      {
        title: 'Compliance Needs',
        fields: [
          { name: 'businessType', label: 'Type of Business', type: 'text' },
          { name: 'currentState', label: 'Current Compliance Status', type: 'textarea' },
          { name: 'requirements', label: 'Specific Requirements/Concerns', type: 'textarea' },
          { name: 'scope', label: 'Scope of Engagement', type: 'select', options: ['Audit Only', 'Audit + Remediation', 'Ongoing Compliance'] },
        ],
      },
    ],
  },
  'Skip Tracer': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Person to Locate',
        fields: [
          { name: 'targetName', label: 'Name of Person to Locate', type: 'text' },
          { name: 'lastKnownInfo', label: 'Last Known Info (address, phone, etc.)', type: 'textarea' },
          { name: 'reason', label: 'Reason for Search', type: 'select', options: ['Debt Collection', 'Witness Location', 'Employment', 'Legal Service', 'Other'] },
          { name: 'timeframe', label: 'How long has it been since last contact?', type: 'text' },
        ],
      },
      {
        title: 'Timeline & Budget',
        fields: [
          { name: 'deadline', label: 'When do you need this information?', type: 'date' },
          { name: 'budget', label: 'Budget', type: 'select', options: ['Under $500', '$500-$1K', '$1K-$2K', '$2K+'] },
        ],
      },
    ],
  },
  'Insurance Adjuster': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Claim Details',
        fields: [
          {
            name: 'claimType',
            label: 'Type of Claim',
            type: 'select',
            options: ['Property Damage', 'Auto Accident', 'Workers Comp', 'Liability', 'Other'],
          },
        ],
      },
      {
        title: 'Incident Information',
        fields: [
          { name: 'incidentDate', label: 'Date of Incident', type: 'date' },
          { name: 'incidentDescription', label: 'Description of What Happened', type: 'textarea' },
          { name: 'damages', label: 'Damages/Injuries Incurred', type: 'textarea' },
          { name: 'claimAmount', label: 'Estimated Claim Amount', type: 'number' },
          { name: 'claimStatus', label: 'Claim Status', type: 'select', options: ['Recently Filed', 'Pending Review', 'Disputed', 'Appeal'] },
        ],
      },
    ],
  },
  Arbitrator: {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Dispute Details',
        fields: [
          {
            name: 'disputeType',
            label: 'Type of Dispute',
            type: 'select',
            options: ['Commercial', 'Employment', 'Real Estate', 'Construction', 'Partnership', 'Other'],
          },
        ],
      },
      {
        title: 'Arbitration Specifics',
        fields: [
          { name: 'otherParty', label: 'Other Party(ies)', type: 'textarea' },
          { name: 'issuesInDispute', label: 'Issues in Dispute', type: 'textarea' },
          { name: 'amountInDispute', label: 'Amount in Dispute', type: 'number' },
          { name: 'arbitrationClause', label: 'Do you have an arbitration agreement/clause?', type: 'select', options: ['Yes', 'No', 'Unsure'] },
        ],
      },
    ],
  },
  'Forensic Accountant': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Engagement Type',
        fields: [
          {
            name: 'engagementType',
            label: 'Type of Engagement',
            type: 'select',
            options: ['Fraud Investigation', 'Damage Calculation', 'Business Valuation', 'Divorce Support', 'Expert Witness', 'Litigation Support'],
          },
        ],
      },
      {
        title: 'Forensic Details',
        fields: [
          { name: 'subject', label: 'Subject of Investigation', type: 'text' },
          { name: 'scope', label: 'Scope of Work', type: 'textarea' },
          { name: 'documentsAvailable', label: 'What financial documents are available?', type: 'textarea' },
          { name: 'timeline', label: 'What time period to examine?', type: 'text' },
          { name: 'deliverable', label: 'Deliverable Needed', type: 'select', options: ['Report', 'Testimony', 'Both'] },
        ],
      },
    ],
  },
  'Background Check Service': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
        ],
      },
      {
        title: 'Check Type',
        fields: [
          {
            name: 'checkType',
            label: 'Type of Background Check',
            type: 'select',
            options: ['Criminal', 'Employment Verification', 'Credit Check', 'Comprehensive', 'International'],
          },
        ],
      },
      {
        title: 'Subject Information',
        fields: [
          { name: 'subjectName', label: 'Subject Full Name', type: 'text' },
          { name: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
          { name: 'addresses', label: 'Previous Addresses (if known)', type: 'textarea' },
          { name: 'purpose', label: 'Purpose of Background Check', type: 'select', options: ['Employment', 'Rental', 'Legal', 'Personal', 'Other'] },
          { name: 'urgency', label: 'Urgency', type: 'select', options: ['Standard', 'Rush', 'Expedited'] },
        ],
      },
    ],
  },
}

export const ServiceIntakeForms: React.FC<ServiceIntakeFormProps> = ({
  serviceName,
  onSubmit,
  onCancel,
  providerName,
}) => {
  const config = FORM_CONFIGS[serviceName] || FORM_CONFIGS.Lawyer
  const [formData, setFormData] = useState<IntakeFormData>({
    ...MOCK_PROFILE,
  })
  const [submitted, setSubmitted] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const actualValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    setFormData((prev) => ({
      ...prev,
      [name]: actualValue,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      onCancel()
    }, 2000)
  }

  if (submitted) {
    return (
      <div className="form-confirmation">
        <div className="confirmation-card">
          <div className="confirmation-icon">✅</div>
          <h2>Application Submitted!</h2>
          <p>We've received your {serviceName} intake form.</p>
          {providerName && <p>You'll be connected with <strong>{providerName}</strong> shortly.</p>}
          <p className="confirmation-subtext">Check your email for next steps.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="service-intake-form">
      <div className="form-header">
        <button className="close-btn" onClick={onCancel}>
          ✕
        </button>
        <h1>{serviceName} Intake Form</h1>
        {providerName && <p className="provider-name">With {providerName}</p>}
      </div>

      <form onSubmit={handleSubmit} className="intake-form">
        {config.sections.map((section: any, index: number) => (
          <div key={index} className="form-section">
            <h2>{section.title}</h2>
            <div className="section-fields">
              {section.fields.map((field: any, fieldIndex: number) => (
                <div key={fieldIndex} className="form-field">
                  <label htmlFor={field.name}>{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={field.name}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={handleInputChange}
                      readOnly={field.readOnly}
                      rows={4}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      id={field.name}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={handleInputChange}
                    >
                      <option value="">Select {field.label}</option>
                      {field.options.map((opt: string) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={field.name}
                      type={field.type}
                      name={field.name}
                      value={formData[field.name] || ''}
                      onChange={handleInputChange}
                      readOnly={field.readOnly}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="form-footer">
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-submit">
            Submit Application
          </button>
        </div>
      </form>
    </div>
  )
}
