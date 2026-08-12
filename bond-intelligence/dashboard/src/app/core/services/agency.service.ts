import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Agency, AgencyFilters, ApiResponse } from '../models/agency.model';

@Injectable({ providedIn: 'root' })
export class AgencyService {
  private api = inject(ApiService);

  getAgencies(filters: AgencyFilters = {}): Observable<ApiResponse<Agency[]>> {
    return this.api.get<Agency[]>('/agencies', filters as Record<string, string | number | boolean | undefined>);
  }

  getAgency(id: number): Observable<ApiResponse<Agency>> {
    return this.api.get<Agency>(`/agencies/${id}`);
  }

  getMapData(): Observable<ApiResponse<any[]>> {
    return this.api.get<any[]>('/agencies/map');
  }

  getStats(): Observable<ApiResponse<any>> {
    return this.api.get<any>('/agencies/stats');
  }
}
