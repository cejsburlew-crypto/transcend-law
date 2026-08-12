import { Pipe, PipeTransform } from '@angular/core';
import { AgencyType } from '../models/agency.model';

const LABELS: Record<AgencyType, string> = {
  k12_district: 'K-12 School District',
  community_college: 'Community College',
  university: 'University',
  city: 'City',
  county: 'County',
  water_district: 'Water District',
  hospital_district: 'Hospital District',
  transit: 'Transit Agency',
  airport: 'Airport',
  port: 'Port',
  special_district: 'Special District',
};

@Pipe({ name: 'agencyTypeLabel', standalone: true })
export class AgencyTypeLabelPipe implements PipeTransform {
  transform(value: AgencyType | string | null | undefined): string {
    if (!value) return '—';
    return LABELS[value as AgencyType] || value;
  }
}
