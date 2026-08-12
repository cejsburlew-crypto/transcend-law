import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, AgencyFilters } from '../models/agency.model';

@Injectable({ providedIn: 'root' })
export class LeadService {
  private api = inject(ApiService);

  getLeads(filters: AgencyFilters = {}): Observable<ApiResponse<any[]>> {
    return this.api.get<any[]>('/leads', filters as Record<string, string | number | boolean | undefined>);
  }

  getTopLeads(): Observable<ApiResponse<any[]>> {
    return this.api.get<any[]>('/leads/top');
  }

  scoreAgency(agencyId: number): Observable<ApiResponse<any>> {
    return this.api.post<any>(`/leads/${agencyId}/score`);
  }
}
