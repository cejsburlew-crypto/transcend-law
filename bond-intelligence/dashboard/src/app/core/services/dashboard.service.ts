import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, DashboardSummary } from '../models/agency.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);

  getSummary(): Observable<ApiResponse<DashboardSummary>> {
    return this.api.get<DashboardSummary>('/dashboard/summary');
  }
}
