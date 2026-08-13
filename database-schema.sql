-- TRANSCEND LAW COMPREHENSIVE DATABASE SCHEMA
-- PostgreSQL Database Design with Attorney Verification & Firm Management

-- ==================== CORE TABLES ====================

-- Clients
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    state VARCHAR(2),
    county VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active' -- active, inactive, suspended
);

-- Firms (Law Firms)
CREATE TABLE firms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    website VARCHAR(255),
    description TEXT,
    logo_url VARCHAR(500),
    founded_year INTEGER,
    headquarters_state VARCHAR(2),
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, suspended

    -- Ratings & Reviews
    overall_rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_cases_won INTEGER DEFAULT 0,
    total_cases_handled INTEGER DEFAULT 0,
    average_settlement_amount DECIMAL(15,2) DEFAULT 0,

    -- Verification Status
    verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP,
    bar_verified BOOLEAN DEFAULT FALSE,

    -- Compliance
    has_complaints BOOLEAN DEFAULT FALSE,
    complaint_count INTEGER DEFAULT 0,
    has_disciplinary_actions BOOLEAN DEFAULT FALSE,
    disciplinary_count INTEGER DEFAULT 0,

    -- Subscription/Billing
    subscription_tier VARCHAR(50) DEFAULT 'basic', -- basic, featured, premium
    subscription_status VARCHAR(50) DEFAULT 'active', -- active, inactive, past_due, cancelled
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    next_billing_date TIMESTAMP,
    monthly_cost DECIMAL(10,2),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Attorneys (Licensed Attorneys)
CREATE TABLE attorneys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    bio TEXT,
    profile_photo_url VARCHAR(500),

    -- BAR Information
    bar_license_number VARCHAR(50) NOT NULL,
    bar_state VARCHAR(2) NOT NULL,
    bar_admission_date DATE,
    bar_license_status VARCHAR(50), -- active, inactive, suspended, revoked
    bar_verified BOOLEAN DEFAULT FALSE,
    bar_verification_date TIMESTAMP,

    -- Years & Experience
    years_practicing INTEGER,
    total_cases_handled INTEGER DEFAULT 0,
    cases_won INTEGER DEFAULT 0,
    win_rate DECIMAL(5,2),

    -- Education
    law_school VARCHAR(255),
    graduation_year INTEGER,
    bar_exam_year INTEGER,

    -- Specialties (practice areas)
    specialties VARCHAR(255)[], -- Array of practice areas: ['personal-injury', 'estate-planning', etc.]

    -- Ratings & Reviews
    attorney_rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    average_settlement_amount DECIMAL(15,2),

    -- Disciplinary Information
    has_complaints BOOLEAN DEFAULT FALSE,
    complaint_count INTEGER DEFAULT 0,
    complaint_details TEXT,
    has_disciplinary_actions BOOLEAN DEFAULT FALSE,
    disciplinary_actions TEXT, -- JSON array of actions

    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verification_status VARCHAR(50), -- pending, verified, failed
    verified_by_admin UUID REFERENCES admins(id),
    verification_date TIMESTAMP,

    -- Role in Firm
    role VARCHAR(50) DEFAULT 'associate', -- partner, associate, counsel, of_counsel
    is_lead_attorney BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active' -- active, inactive, suspended
);

-- ==================== INTAKE & CASE TABLES ====================

-- Intakes (Client intake forms)
CREATE TABLE intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    firm_id UUID REFERENCES firms(id) ON DELETE SET NULL,

    -- Case Information
    case_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    state VARCHAR(2) NOT NULL,
    county VARCHAR(100),

    -- Case Details (JSON - flexible for different case types)
    case_details JSONB,

    -- Status Tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, opened, engaged, proposal_sent, retained, declined, archived

    -- Firm Assignment
    submitted_to_firm_ids UUID[] DEFAULT '{}',
    primary_firm_id UUID REFERENCES firms(id),

    -- Documents
    document_count INTEGER DEFAULT 0,

    -- Timeline
    submitted_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    first_opened_date TIMESTAMP,
    first_message_date TIMESTAMP,
    proposal_sent_date TIMESTAMP,
    retention_date TIMESTAMP,

    -- Urgency
    urgency_level VARCHAR(50) DEFAULT 'standard', -- low, standard, urgent, critical

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cases (Retained cases after intake is accepted)
CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    intake_id UUID NOT NULL REFERENCES intakes(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE RESTRICT,

    -- Case Information
    case_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    state VARCHAR(2) NOT NULL,
    county VARCHAR(100),

    -- Attorney Assignment
    lead_attorney_id UUID NOT NULL REFERENCES attorneys(id),
    co_counsel_ids UUID[] DEFAULT '{}', -- Array of additional attorney IDs

    -- Case Status
    status VARCHAR(50) DEFAULT 'open', -- open, discovery, settlement, trial, closed

    -- Retainer Information
    retainer_amount DECIMAL(15,2),
    retainer_agreement TEXT,
    retainer_signed_date TIMESTAMP,

    -- Case Outcomes
    outcome VARCHAR(50), -- won, settled, dismissed, closed
    settlement_amount DECIMAL(15,2),
    verdict_amount DECIMAL(15,2),

    -- Timeline
    filed_date TIMESTAMP,
    closed_date TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== COMMUNICATION TABLES ====================

-- Messages (Attorney-Client communication)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    intake_id UUID REFERENCES intakes(id) ON DELETE CASCADE,

    from_type VARCHAR(50) NOT NULL, -- client, attorney, system
    from_id UUID NOT NULL,
    to_id UUID NOT NULL,

    subject VARCHAR(255),
    body TEXT NOT NULL,

    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== VERIFICATION & COMPLIANCE TABLES ====================

-- Attorney Verification Records
CREATE TABLE attorney_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attorney_id UUID NOT NULL REFERENCES attorneys(id) ON DELETE CASCADE,

    -- BAR Verification
    bar_license_verified BOOLEAN DEFAULT FALSE,
    bar_status_verified BOOLEAN DEFAULT FALSE,
    bar_verification_source VARCHAR(100), -- state_bar_website, stripe_verified, manual
    bar_verification_date TIMESTAMP,

    -- Disciplinary Check
    state_bar_checked BOOLEAN DEFAULT FALSE,
    state_bar_check_date TIMESTAMP,
    complaints_found INTEGER DEFAULT 0,
    disciplinary_actions_found INTEGER DEFAULT 0,

    -- Admin Verification
    verified_by_admin_id UUID REFERENCES admins(id),
    admin_notes TEXT,
    verification_status VARCHAR(50), -- pending, approved, rejected, flagged
    verification_date TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints & Disciplinary Records
CREATE TABLE attorney_complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attorney_id UUID NOT NULL REFERENCES attorneys(id) ON DELETE CASCADE,

    complaint_type VARCHAR(50), -- client_complaint, state_bar_complaint, disciplinary_action
    complaint_source VARCHAR(100), -- internal, state_bar, public_record
    complaint_date DATE,

    title VARCHAR(255),
    description TEXT,

    status VARCHAR(50), -- filed, investigating, resolved, dismissed
    resolution TEXT,
    resolution_date DATE,

    severity VARCHAR(50), -- minor, moderate, serious, critical
    public_record BOOLEAN DEFAULT FALSE,

    verified BOOLEAN DEFAULT FALSE,
    verified_date TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Firm Reviews & Ratings
CREATE TABLE firm_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,

    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    review_text TEXT,

    would_recommend BOOLEAN,

    verified_case BOOLEAN DEFAULT FALSE,

    helpful_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attorney Reviews & Ratings
CREATE TABLE attorney_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attorney_id UUID NOT NULL REFERENCES attorneys(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,

    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    review_text TEXT,

    would_recommend BOOLEAN,

    verified_case BOOLEAN DEFAULT FALSE,

    helpful_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== SUBSCRIPTION & BILLING TABLES ====================

-- Subscription Plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- basic, featured, premium
    price DECIMAL(10,2) NOT NULL,
    billing_cycle VARCHAR(50) DEFAULT 'monthly', -- monthly, annual

    -- Features
    max_active_cases INTEGER,
    max_attorneys INTEGER,
    featured_listing BOOLEAN DEFAULT FALSE,
    priority_support BOOLEAN DEFAULT FALSE,
    advanced_analytics BOOLEAN DEFAULT FALSE,
    custom_branding BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Billing History
CREATE TABLE billing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,

    billing_date TIMESTAMP,
    amount DECIMAL(10,2),
    status VARCHAR(50), -- pending, paid, failed, refunded

    stripe_invoice_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),

    description TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== ADMIN TABLES ====================

-- Admins (System Administrators)
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),

    role VARCHAR(50) DEFAULT 'moderator', -- superadmin, admin, moderator, verifier

    permissions JSONB, -- JSON array of permissions

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active'
);

-- Admin Activity Log
CREATE TABLE admin_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,

    action VARCHAR(100),
    entity_type VARCHAR(100), -- attorney, firm, complaint, review
    entity_id UUID,

    old_values JSONB,
    new_values JSONB,

    ip_address VARCHAR(50),
    user_agent VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES ====================

CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_state ON clients(state);
CREATE INDEX idx_firms_email ON firms(email);
CREATE INDEX idx_firms_state ON firms(headquarters_state);
CREATE INDEX idx_firms_tier ON firms(subscription_tier);
CREATE INDEX idx_attorneys_firm_id ON attorneys(firm_id);
CREATE INDEX idx_attorneys_bar_license ON attorneys(bar_license_number, bar_state);
CREATE INDEX idx_attorneys_verified ON attorneys(verified);
CREATE INDEX idx_intakes_client_id ON intakes(client_id);
CREATE INDEX idx_intakes_firm_id ON intakes(firm_id);
CREATE INDEX idx_intakes_status ON intakes(status);
CREATE INDEX idx_cases_client_id ON cases(client_id);
CREATE INDEX idx_cases_firm_id ON cases(firm_id);
CREATE INDEX idx_cases_attorney_id ON cases(lead_attorney_id);
CREATE INDEX idx_messages_case_id ON messages(case_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_complaints_attorney_id ON attorney_complaints(attorney_id);
CREATE INDEX idx_reviews_firm_id ON firm_reviews(firm_id);
CREATE INDEX idx_reviews_attorney_id ON attorney_reviews(attorney_id);
CREATE INDEX idx_billing_firm_id ON billing_history(firm_id);
