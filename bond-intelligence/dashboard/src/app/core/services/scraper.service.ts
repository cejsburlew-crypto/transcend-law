import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { ApiResponse, ScrapeRun } from '../models/agency.model';

@Injectable({ providedIn: 'root' })
export class ScraperService {
  private api = inject(ApiService);

  getRuns(): Observable<ApiResponse<ScrapeRun[]>> {
    return this.api.get<ScrapeRun[]>('/scrape-runs');
  }

  getRun(id: number): Observable<ApiResponse<ScrapeRun>> {
    return this.api.get<ScrapeRun>(`/scrape-runs/${id}`);
  }

  trigger(scraper: string, state?: string): Observable<ApiResponse<any>> {
    return this.api.post<any>('/scrape-runs/trigger', { scraper, state });
  }
}
