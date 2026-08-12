export type AgencyType =
  | 'k12_district' | 'community_college' | 'university'
  | 'city' | 'county' | 'water_district' | 'hospital_district'
  | 'transit' | 'airport' | 'port' | 'special_district';

export type OpportunityStage =
  | 'bond_passed' | 'bond_failed_retry' | 'bond_issued'
  | 'master_plan_active' | 'rfq_expected' | 'rfq_active'
  | 'consultant_awarded' | 'construction_active' | 'closeout';

export type BondResult = 'passed' | 'failed' | 'pending' | 'cancelled';

export interface Agency {
  id: number;
  name: string;
  normalized_name: string;
  agency_type: AgencyType;
  state: string;
  county: string;
  city: string;
  website: string;
  population?: number;
  created_at?: string;
  updated_at?: string;
  bond_measures?: BondMeasure[];
  contacts?: Contact[];
  consultants?: Consultant[];
  procurement_events?: ProcurementEvent[];
  lead_score?: LeadScore;
  source_documents?: SourceDocument[];
}

export interface BondMeasure {
  id: number;
  agency_id: number;
  measure_name: string;
  measure_letter?: string;
  measure_number?: string;
  election_date: string;
  election_type?: string;
  result: BondResult;
  vote_pct: number;
  required_threshold?: number;
  bond_amount: number;
  bond_purpose?: string;
  project_categories?: string[];
  authorized_amount?: number;
  issued_amount?: number;
  unissued_amount?: number;
  state?: string;
  opportunity_stage?: string;
  source_url?: string;
  source_document_title?: string;
  source_date?: string;
  bond_series?: BondSeries[];
}

export interface BondSeries {
  id: number;
  bond_measure_id: number;
  series_name: string;
  sale_date: string;
  par_amount: number;
  use_of_proceeds?: string;
  cdiac_number?: string;
  official_statement_url?: string;
  rating_sp?: string;
  rating_moody?: string;
  notes?: string;
}

export interface Contact {
  id: number;
  agency_id: number;
  role: 'superintendent' | 'ceo' | 'city_manager' | 'facilities_director'
      | 'cbo' | 'cfo' | 'purchasing_director' | 'bond_program_manager'
      | 'construction_director' | 'board_president' | 'board_member' | 'other';
  contact_type?: string;
  name: string;
  title?: string;
  email: string;
  phone: string;
  linkedin_url: string;
  verified_at: string;
  source_url: string;
}

export interface Consultant {
  id: number;
  agency_id: number;
  service_type: 'program_manager' | 'construction_manager' | 'architect'
              | 'geotechnical' | 'materials_testing' | 'inspector'
              | 'safety_consultant' | 'pmis_vendor' | 'owner_rep' | 'other';
  firm_name: string;
  contract_amount: number;
  contract_date: string;
  source_url: string;
}

export interface ProcurementEvent {
  id: number;
  agency_id: number;
  bond_measure_id?: number;
  event_type: 'rfq_issued' | 'rfp_issued' | 'award' | 'contract_executed'
            | 'board_approval' | 'notice_of_intent';
  service_type: string;
  title: string;
  issue_date: string;
  due_date: string;
  award_date: string;
  awarded_to: string;
  estimated_value: number;
  source_url: string;
  source_document_title: string;
}

export interface ScoringFactor {
  key: string;
  points: number;
  reason: string;
}

export interface LeadScore {
  id: number;
  agency_id: number;
  score: number;
  confidence: number;
  opportunity_stage: OpportunityStage;
  estimated_next_action: string;
  recommended_outreach_angle: string;
  scoring_factors: ScoringFactor[];
  manual_review_flag: boolean;
  approach_now: boolean;
  scored_at: string;
}

export interface SourceDocument {
  id: number;
  agency_id: number;
  url: string;
  title: string;
  document_type: string;
  doc_type?: string;
  source_name: string;
  published_date: string;
  scraped_at: string;
}

export interface ScrapeRun {
  id: number;
  scraper_name: string;
  state: string;
  started_at: string;
  completed_at: string;
  status: 'running' | 'completed' | 'failed' | 'partial';
  records_found: number;
  records_created: number;
  records_updated: number;
}

export interface DashboardSummary {
  total_agencies: number;
  total_bond_value: number;
  agencies_with_bonds_passed: number;
  approach_now_count: number;
  top_opportunities: Array<{
    agency_id: number;
    agency_name: string;
    score: number;
    stage: string;
    bond_amount: number;
    state: string;
  }>;
  pipeline_by_stage: Record<string, number>;
  bonds_by_state: Array<{ state: string; total_value: number; count: number }>;
  recent_scrape_runs: ScrapeRun[];
}

export interface ApiResponse<T> {
  status: string;
  message: string;
  data: T;
  meta: {
    timestamp: string;
    version: string;
    pagination?: PaginationMeta;
  };
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface AgencyFilters {
  state?: string;
  agency_type?: AgencyType;
  min_score?: number;
  max_score?: number;
  opportunity_stage?: OpportunityStage;
  approach_now?: boolean;
  min_bond_amount?: number;
  search?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}
