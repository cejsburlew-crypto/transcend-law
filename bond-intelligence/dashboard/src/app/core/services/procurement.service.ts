import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse } from '../models/agency.model';

@Injectable({ providedIn: 'root' })
export class ProcurementService {
  private api = inject(ApiService);

  getProcurement(filters: Record<string, string | number | boolean | undefined> = {}): Observable<ApiResponse<any[]>> {
    return this.api.get<any[]>('/procurement', filters);
  }

  getActive(): Observable<ApiResponse<any[]>> {
    return this.api.get<any[]>('/procurement/active');
  }
}
