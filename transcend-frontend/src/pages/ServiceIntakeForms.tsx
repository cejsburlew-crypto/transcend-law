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
  'Generic Service': {
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
        title: 'What You Need',
        fields: [
          { name: 'requestTitle', label: 'Brief summary of your request', type: 'text' },
          { name: 'description', label: 'Describe what you need', type: 'textarea' },
        ],
      },
      {
        title: 'Timeline & Budget',
        fields: [
          { name: 'deadline', label: 'When do you need this completed?', type: 'date' },
          { name: 'budget', label: 'Budget', type: 'select', options: ['Under $250', '$250-$1K', '$1K-$3K', '$3K+', 'Not sure yet'] },
        ],
      },
    ],
  },
  'FAFSA Assistance': {
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
        title: 'Student Details',
        fields: [
          { name: 'studentName', label: 'Student name', type: 'text' },
          { name: 'awardYear', label: 'Aid year', type: 'select', options: ['2026-2027', '2025-2026', 'Renewal', 'Not sure'] },
          { name: 'dependency', label: 'Dependency status', type: 'select', options: ['Dependent', 'Independent', 'Not sure'] },
          { name: 'schools', label: 'Schools to receive the FAFSA', type: 'textarea' },
        ],
      },
      {
        title: 'Filing Situation',
        fields: [
          { name: 'filedBefore', label: 'Have you filed a FAFSA before?', type: 'select', options: ['No, first time', 'Yes, renewing', 'Yes, needs correction'] },
          { name: 'householdSize', label: 'Household size', type: 'number' },
          { name: 'specialCircumstances', label: 'Special circumstances (job loss, separation, etc.)', type: 'textarea' },
        ],
      },
      {
        title: 'Deadline',
        fields: [
          { name: 'deadline', label: 'Priority filing deadline', type: 'date' },
        ],
      },
    ],
  },
  'Bookkeeping': {
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
        title: 'Business Details',
        fields: [
          { name: 'businessName', label: 'Business name', type: 'text' },
          { name: 'entityType', label: 'Entity type', type: 'select', options: ['Sole proprietor', 'LLC', 'S-Corp', 'C-Corp', 'Partnership', 'Nonprofit'] },
          { name: 'accountingSoftware', label: 'Accounting software in use', type: 'select', options: ['QuickBooks', 'Xero', 'Wave', 'Spreadsheets', 'None yet', 'Other'] },
          { name: 'monthlyTransactions', label: 'Approximate transactions per month', type: 'number' },
        ],
      },
      {
        title: 'Scope of Work',
        fields: [
          { name: 'services', label: 'What do you need?', type: 'select', options: ['Monthly bookkeeping', 'Catch-up / cleanup', 'Reconciliation only', 'Financial statements', 'Full-service'] },
          { name: 'monthsBehind', label: 'Months of records to catch up (if any)', type: 'number' },
          { name: 'description', label: 'Anything else we should know', type: 'textarea' },
        ],
      },
      {
        title: 'Timeline & Budget',
        fields: [
          { name: 'deadline', label: 'Target start date', type: 'date' },
          { name: 'budget', label: 'Monthly budget', type: 'select', options: ['Under $250', '$250-$500', '$500-$1K', '$1K+'] },
        ],
      },
    ],
  },
  'Payroll Services': {
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
        title: 'Business Details',
        fields: [
          { name: 'businessName', label: 'Business name', type: 'text' },
          { name: 'employeeCount', label: 'Number of employees', type: 'number' },
          { name: 'contractorCount', label: 'Number of 1099 contractors', type: 'number' },
          { name: 'statesOperating', label: 'States where employees work', type: 'text' },
        ],
      },
      {
        title: 'Payroll Setup',
        fields: [
          { name: 'payFrequency', label: 'Pay frequency', type: 'select', options: ['Weekly', 'Bi-weekly', 'Semi-monthly', 'Monthly'] },
          { name: 'currentProvider', label: 'Current payroll provider (if any)', type: 'text' },
          { name: 'needsTaxFiling', label: 'Include payroll tax filing?', type: 'select', options: ['Yes', 'No', 'Not sure'] },
          { name: 'description', label: 'Benefits, garnishments, or other specifics', type: 'textarea' },
        ],
      },
      {
        title: 'Timeline',
        fields: [
          { name: 'deadline', label: 'First payroll date needed', type: 'date' },
        ],
      },
    ],
  },
  'Tax Preparation': {
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
        title: 'Return Details',
        fields: [
          { name: 'returnType', label: 'Return type', type: 'select', options: ['Individual (1040)', 'Business (1120/1120-S)', 'Partnership (1065)', 'Nonprofit (990)', 'Both personal and business'] },
          { name: 'taxYear', label: 'Tax year', type: 'select', options: ['2025', '2024', 'Prior year / amended', 'Multiple years'] },
          { name: 'filingStatus', label: 'Filing status', type: 'select', options: ['Single', 'Married filing jointly', 'Married filing separately', 'Head of household', 'N/A - business return'] },
          { name: 'statesFiling', label: 'States to file in', type: 'text' },
        ],
      },
      {
        title: 'Situation',
        fields: [
          { name: 'hasSelfEmployment', label: 'Self-employment or rental income?', type: 'select', options: ['No', 'Yes - self-employment', 'Yes - rental', 'Yes - both'] },
          { name: 'description', label: 'Anything unusual this year', type: 'textarea' },
        ],
      },
      {
        title: 'Timeline',
        fields: [
          { name: 'deadline', label: 'Filing deadline', type: 'date' },
        ],
      },
    ],
  },
  'Cover Letters': {
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
        title: 'Target Role',
        fields: [
          { name: 'targetRole', label: 'Role or job title', type: 'text' },
          { name: 'targetCompany', label: 'Company', type: 'text' },
          { name: 'jobPosting', label: 'Job posting link or text', type: 'textarea' },
          { name: 'industry', label: 'Industry', type: 'text' },
        ],
      },
      {
        title: 'Your Background',
        fields: [
          { name: 'yearsExperience', label: 'Years of relevant experience', type: 'number' },
          { name: 'keyAchievements', label: 'Achievements you want highlighted', type: 'textarea' },
          { name: 'tone', label: 'Preferred tone', type: 'select', options: ['Formal', 'Professional', 'Conversational'] },
        ],
      },
      {
        title: 'Timeline',
        fields: [
          { name: 'deadline', label: 'Application deadline', type: 'date' },
        ],
      },
    ],
  },
  'Resume Writing': {
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
        title: 'Career Details',
        fields: [
          { name: 'targetRole', label: 'Target role', type: 'text' },
          { name: 'industry', label: 'Industry', type: 'text' },
          { name: 'careerLevel', label: 'Career level', type: 'select', options: ['Entry level', 'Mid-career', 'Senior', 'Executive', 'Career change'] },
          { name: 'yearsExperience', label: 'Years of experience', type: 'number' },
        ],
      },
      {
        title: 'Scope',
        fields: [
          { name: 'services', label: 'What do you need?', type: 'select', options: ['New resume', 'Resume rewrite', 'Resume + cover letter', 'Resume + LinkedIn', 'Full package'] },
          { name: 'hasExisting', label: 'Do you have a current resume?', type: 'select', options: ['Yes', 'No', 'Outdated'] },
          { name: 'description', label: 'Anything you want emphasised or left out', type: 'textarea' },
        ],
      },
      {
        title: 'Timeline',
        fields: [
          { name: 'deadline', label: 'When do you need it?', type: 'date' },
        ],
      },
    ],
  },
  'Business Formation': {
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
        title: 'Entity Details',
        fields: [
          { name: 'businessName', label: 'Proposed business name', type: 'text' },
          { name: 'entityType', label: 'Entity type', type: 'select', options: ['LLC', 'S-Corp', 'C-Corp', 'Partnership', 'Nonprofit', 'Not sure'] },
          { name: 'stateOfFormation', label: 'State of formation', type: 'text' },
          { name: 'ownerCount', label: 'Number of owners / members', type: 'number' },
        ],
      },
      {
        title: 'Filings Needed',
        fields: [
          { name: 'needsEIN', label: 'Need an EIN?', type: 'select', options: ['Yes', 'No', 'Not sure'] },
          { name: 'needsRegisteredAgent', label: 'Need a registered agent?', type: 'select', options: ['Yes', 'No', 'Not sure'] },
          { name: 'needsOperatingAgreement', label: 'Need an operating agreement?', type: 'select', options: ['Yes', 'No', 'Not sure'] },
          { name: 'description', label: 'Business activity and anything else', type: 'textarea' },
        ],
      },
      {
        title: 'Timeline',
        fields: [
          { name: 'deadline', label: 'Target formation date', type: 'date' },
        ],
      },
    ],
  },
  'Grant Writing': {
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
        title: 'Organization',
        fields: [
          { name: 'organizationName', label: 'Organization name', type: 'text' },
          { name: 'organizationType', label: 'Organization type', type: 'select', options: ['501(c)(3) nonprofit', 'For-profit small business', 'Educational institution', 'Individual / researcher', 'Other'] },
          { name: 'annualBudget', label: 'Annual operating budget', type: 'number' },
        ],
      },
      {
        title: 'Grant Details',
        fields: [
          { name: 'grantName', label: 'Grant or funder (if known)', type: 'text' },
          { name: 'requestAmount', label: 'Amount you plan to request', type: 'number' },
          { name: 'projectSummary', label: 'Project summary', type: 'textarea' },
          { name: 'services', label: 'What do you need?', type: 'select', options: ['Funder research', 'Full proposal writing', 'Proposal review / edit', 'Budget narrative', 'Full package'] },
        ],
      },
      {
        title: 'Deadline',
        fields: [
          { name: 'deadline', label: 'Submission deadline', type: 'date' },
        ],
      },
    ],
  },
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

  // Law-Specific Intake Forms
  'Family Law': {
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
        title: 'Matter Type',
        fields: [
          {
            name: 'matterType',
            label: 'What is your family law matter?',
            type: 'select',
            options: ['Divorce', 'Custody/Visitation', 'Child Support', 'Spousal Support', 'Adoption', 'Paternity', 'Prenuptial Agreement', 'Domestic Violence'],
          },
        ],
      },
      {
        title: 'Family Details',
        fields: [
          { name: 'spouseName', label: 'Spouse/Partner Name (if applicable)', type: 'text' },
          { name: 'childrenCount', label: 'Number of Children', type: 'number' },
          { name: 'childrenAges', label: 'Children Ages', type: 'text' },
          { name: 'marriageDate', label: 'Marriage/Partnership Date', type: 'date' },
          { name: 'separationDate', label: 'Separation Date (if applicable)', type: 'date' },
        ],
      },
      {
        title: 'Case Details',
        fields: [
          { name: 'assets', label: 'Approximate Total Assets', type: 'select', options: ['Under $50K', '$50K-$250K', '$250K-$1M', '$1M+'] },
          { name: 'custody', label: 'Custody Arrangement Sought', type: 'select', options: ['Joint Custody', 'Primary Custody', 'Visitation Rights', 'To Be Determined'] },
          { name: 'description', label: 'Case Description', type: 'textarea' },
        ],
      },
      {
        title: 'Timeline & Budget',
        fields: [
          { name: 'deadline', label: 'When do you need resolution?', type: 'date' },
          { name: 'budget', label: 'Budget', type: 'select', options: ['Under $2K', '$2K-$5K', '$5K-$10K', '$10K+'] },
        ],
      },
    ],
  },

  'Criminal Law': {
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
        title: 'Charge Information',
        fields: [
          { name: 'chargeType', label: 'Type of Charge', type: 'select', options: ['Felony', 'Misdemeanor', 'Infraction', 'DUI/DWI', 'Drug Offense', 'Violent Crime', 'White Collar', 'Other'] },
          { name: 'charges', label: 'Specific Charges', type: 'textarea' },
          { name: 'courtName', label: 'Court Name/Location', type: 'text' },
          { name: 'caseNumber', label: 'Case Number (if available)', type: 'text' },
        ],
      },
      {
        title: 'Case Status',
        fields: [
          { name: 'arrestDate', label: 'Date of Arrest', type: 'date' },
          { name: 'firstAppearance', label: 'First Appearance Date', type: 'date' },
          { name: 'bailStatus', label: 'Bail/Release Status', type: 'select', options: ['In Custody', 'Released on Own Recognizance', 'Bail Set', 'Already Released'] },
          { name: 'bailAmount', label: 'Bail Amount (if set)', type: 'number' },
        ],
      },
      {
        title: 'Your Needs',
        fields: [
          { name: 'immediateHelp', label: 'What immediate help do you need?', type: 'select', options: ['Bail/Release Assistance', 'Court Representation', 'Legal Advice', 'Plea Negotiation', 'Trial Defense'] },
          { name: 'description', label: 'Additional Details', type: 'textarea' },
        ],
      },
    ],
  },

  'Employment Law': {
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
        title: 'Employment Details',
        fields: [
          { name: 'employerName', label: 'Employer Name', type: 'text' },
          { name: 'employmentType', label: 'Employment Status', type: 'select', options: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Freelance'] },
          { name: 'yearsEmployed', label: 'Years at Company', type: 'number' },
          { name: 'position', label: 'Job Position', type: 'text' },
        ],
      },
      {
        title: 'Issue Details',
        fields: [
          {
            name: 'issueType',
            label: 'What is your employment issue?',
            type: 'select',
            options: ['Wrongful Termination', 'Discrimination', 'Harassment', 'Wage Dispute', 'Non-Compete Agreement', 'Contract Dispute', 'Retaliation', 'Unsafe Work Environment'],
          },
          { name: 'description', label: 'Describe the Issue', type: 'textarea' },
          { name: 'startDate', label: 'When did the issue begin?', type: 'date' },
          { name: 'witnesses', label: 'Were there witnesses?', type: 'select', options: ['Yes', 'No', 'Unsure'] },
        ],
      },
      {
        title: 'Desired Resolution',
        fields: [
          { name: 'relief', label: 'What relief are you seeking?', type: 'select', options: ['Reinstatement', 'Severance Negotiation', 'Damages', 'Policy Change', 'References', 'Other'] },
          { name: 'budget', label: 'Budget', type: 'select', options: ['Under $2K', '$2K-$5K', '$5K-$10K', '$10K+'] },
        ],
      },
    ],
  },

  'Estate Planning': {
    sections: [
      {
        title: 'Your Information',
        fields: [
          { name: 'clientName', label: 'Full Name', type: 'text', readOnly: true },
          { name: 'clientEmail', label: 'Email', type: 'email', readOnly: true },
          { name: 'clientPhone', label: 'Phone', type: 'tel', readOnly: true },
          { name: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
        ],
      },
      {
        title: 'Estate Planning Documents',
        fields: [
          {
            name: 'documentsNeeded',
            label: 'Which documents do you need?',
            type: 'select',
            options: ['Will', 'Trust (Living)', 'Trust (Testamentary)', 'Power of Attorney', 'Healthcare Directive', 'HIPAA Authorization', 'All of the Above'],
          },
        ],
      },
      {
        title: 'Family & Assets',
        fields: [
          { name: 'spouseStatus', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed'] },
          { name: 'childrenCount', label: 'Number of Children/Beneficiaries', type: 'number' },
          { name: 'estimatedEstate', label: 'Estimated Estate Value', type: 'select', options: ['Under $500K', '$500K-$1M', '$1M-$5M', '$5M+'] },
          { name: 'propertyStates', label: 'States where you own property', type: 'text' },
        ],
      },
      {
        title: 'Your Wishes',
        fields: [
          { name: 'executor', label: 'Preferred Executor/Trustee', type: 'text' },
          { name: 'guardianship', label: 'Guardians for minor children (if applicable)', type: 'text' },
          { name: 'specialConcerns', label: 'Special Concerns or Wishes', type: 'textarea' },
        ],
      },
    ],
  },

  'Personal Injury': {
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
        title: 'Accident Details',
        fields: [
          {
            name: 'injuryType',
            label: 'Type of Injury',
            type: 'select',
            options: ['Motor Vehicle Accident', 'Slip & Fall', 'Product Liability', 'Medical Malpractice', 'Workplace Injury', 'Assault/Battery', 'Other'],
          },
          { name: 'accidentDate', label: 'Date of Incident', type: 'date' },
          { name: 'accidentLocation', label: 'Location of Incident', type: 'text' },
          { name: 'accidentDescription', label: 'Description of What Happened', type: 'textarea' },
        ],
      },
      {
        title: 'Injuries & Medical Care',
        fields: [
          { name: 'injuries', label: 'Describe Your Injuries', type: 'textarea' },
          { name: 'medicalTreatment', label: 'Medical Treatment Received', type: 'textarea' },
          { name: 'medicalExpenses', label: 'Approximate Medical Expenses', type: 'number' },
          { name: 'ongoing', label: 'Ongoing Treatment Needed?', type: 'select', options: ['Yes', 'No', 'Unsure'] },
        ],
      },
      {
        title: 'Liability & Damages',
        fields: [
          { name: 'liability', label: 'Who was at fault?', type: 'textarea' },
          { name: 'insurance', label: 'Is insurance involved?', type: 'select', options: ['Yes', 'No', 'Unknown'] },
          { name: 'damages', label: 'Lost Wages / Other Damages', type: 'number' },
        ],
      },
    ],
  },

  'Real Estate': {
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
            label: 'Type of Real Estate Matter',
            type: 'select',
            options: ['Purchase', 'Sale', 'Lease/Rental', 'Boundary Dispute', 'Title Issue', 'Easement', 'Deed Question', 'Other'],
          },
        ],
      },
      {
        title: 'Property Details',
        fields: [
          { name: 'propertyAddress', label: 'Property Address', type: 'textarea' },
          { name: 'propertyType', label: 'Property Type', type: 'select', options: ['Residential', 'Commercial', 'Land', 'Multi-Unit', 'Other'] },
          { name: 'purchasePrice', label: 'Purchase/Sale Price (if applicable)', type: 'number' },
          { name: 'squareFootage', label: 'Square Footage', type: 'number' },
        ],
      },
      {
        title: 'Your Issue',
        fields: [
          { name: 'issueDescription', label: 'Describe Your Concern/Issue', type: 'textarea' },
          { name: 'otherParties', label: 'Other Parties Involved', type: 'textarea' },
          { name: 'deadline', label: 'Timeline for Resolution', type: 'date' },
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
  // An unmapped service must NOT inherit the Lawyer form - that asked FAFSA and
  // bookkeeping clients for "Case Type" and "Amount in Dispute". Unknown
  // services get a neutral service-request form instead.
  const config = FORM_CONFIGS[serviceName] || FORM_CONFIGS['Generic Service']
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
