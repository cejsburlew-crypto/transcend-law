export type SspStatus = 'draft' | 'submitted' | 'approved';

export interface SiteSafetyPlan {
  id?: number;
  transcend_pm_org_id?: string;
  transcend_pm_project_id?: string;
  project_name: string;
  site_name?: string;
  scope_of_work?: string;
  project_address?: string;
  apn?: string;
  property_owner?: string;
  site_lat?: number;
  site_lng?: number;
  map_layers?: string;
  plan_drawing?: string;
  map_snapshot?: string;
  owner_name?: string;
  architect_firm?: string;
  general_contractor?: string;
  contractor_id?: string;
  contractor_contact_name?: string;
  contractor_phone?: string;
  contractor_email?: string;
  site_superintendent?: string;
  site_safety_director_name?: string;
  site_safety_director_phone?: string;
  site_safety_director_email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  hospital_name?: string;
  hospital_address?: string;
  hospital_phone?: string;
  urgent_care_name?: string;
  urgent_care_address?: string;
  urgent_care_phone?: string;
  fire_department_name?: string;
  fire_department_address?: string;
  fire_department_phone_emergency?: string;
  fire_department_phone_non_emergency?: string;
  fire_department_phone?: string;
  police_department_name?: string;
  police_department_address?: string;
  police_department_phone_emergency?: string;
  police_department_phone_non_emergency?: string;
  police_department_phone?: string;
  lfa_contact_name?: string;
  lfa_contact_title?: string;
  lfa_contact_phone?: string;
  lfa_contact_email?: string;
  submission_date?: string;
  site_safety_director_training?: string;
  fire_watch_training?: string;
  fire_access_routes?: string;
  fire_protection_equipment?: string;
  smoking_cooking_policy?: string;
  temporary_heating_plan?: string;
  hot_work_plan?: string;
  combustible_waste_plan?: string;
  flammable_materials_storage?: string;
  site_security_plan?: string;
  plan_changes_procedure?: string;
  lfa_site_specific?: string;
  hazards_identified?: string;
  safety_measures?: string;
  ppe_requirements?: string;
  training_requirements?: string;
  incident_reporting?: string;
  effective_date?: string;
  prepared_by?: string;
  status?: SspStatus;
  created_at?: string;
  updated_at?: string;
}

export interface AddressLookupResult {
  project_address?: string;
  site_name?: string;
  apn?: string;
  property_owner?: string;
  owner_name?: string;
  site_lat?: number;
  site_lng?: number;
  hospital_name?: string;
  hospital_address?: string;
  hospital_phone?: string;
  hospital_lat?: number;
  hospital_lng?: number;
  urgent_care_name?: string;
  urgent_care_address?: string;
  urgent_care_phone?: string;
  urgent_care_lat?: number;
  urgent_care_lng?: number;
  fire_department_name?: string;
  fire_department_address?: string;
  fire_department_phone_emergency?: string;
  fire_department_phone_non_emergency?: string;
  fire_department_phone?: string;
  fire_department_lat?: number;
  fire_department_lng?: number;
  police_department_name?: string;
  police_department_address?: string;
  police_department_phone_emergency?: string;
  police_department_phone_non_emergency?: string;
  police_department_phone?: string;
  police_department_lat?: number;
  police_department_lng?: number;
}

export interface AddressLookupMeta {
  lat?: number;
  lng?: number;
  county?: string;
  city?: string;
  apn_source?: string;
}

export interface ParcelLookupResult {
  apn?: string;
  situs_address?: string;
  use_description?: string;
  agency_name?: string;
  geometry?: { type: 'Polygon'; coordinates: number[][][] } | null;
}

export interface DsaProjectLookupResult {
  transcend_pm_project_id?: string;
  transcend_pm_org_id?: string;
  project_name?: string;
  site_name?: string;
  scope_of_work?: string;
  property_owner?: string;
  owner_name?: string;
  architect_firm?: string;
  project_address?: string;
}

export interface ProjectContractor {
  id: string;
  name: string;
  role: string;
  contact_name?: string;
  phone?: string;
  email?: string;
}

export interface SspAttachment {
  id: number;
  category: string;
  original_name: string;
  stored_name: string;
  mime_type?: string;
  size_bytes?: number;
  created_at?: string;
}

export interface MapLayersState {
  site: { lat: number; lng: number };
  parcel?: { type: 'Polygon'; coordinates: number[][][] } | null;
  services: {
    hospital?: ServiceMarker;
    urgent_care?: ServiceMarker;
    fire?: ServiceMarker;
    police?: ServiceMarker;
  };
  customLabels: MapLabel[];
}

export interface ServiceMarker {
  name: string;
  address?: string;
  lat: number;
  lng: number;
  visible: boolean;
}

export interface MapLabel {
  id: string;
  lat: number;
  lng: number;
  text: string;
  type: 'hydrant' | 'fdc' | 'extinguisher' | 'route' | 'other';
}

export interface PlanDrawingState {
  strokes: DrawingStroke[];
}

export interface DrawingStroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

export const DSA_APPLICATION_PATTERN = /^\d{2}-\d{6}$/;

export function suggestedPdfFileName(plan: Pick<SiteSafetyPlan, 'transcend_pm_project_id' | 'submission_date'>): string {
  const app = plan.transcend_pm_project_id?.trim() || 'xx-xxxxxx';
  const date = plan.submission_date || new Date().toISOString().slice(0, 10);
  return `${app} Site Safety Plan_${date}.pdf`;
}
