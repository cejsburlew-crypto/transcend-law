import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { downloadBlob } from '@ssp-shared/utils/blob-download';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private api = inject(ApiService);

  exportCsv(filters: Record<string, string | number | boolean | undefined> = {}): Observable<Blob> {
    return this.api.getBlob('/export/csv', filters).pipe(
      tap(blob => downloadBlob(blob, 'bond-intelligence-leads.csv'))
    );
  }

  exportCrm(filters: Record<string, string | number | boolean | undefined> = {}): Observable<Blob> {
    return this.api.getBlob('/export/crm', filters).pipe(
      tap(blob => downloadBlob(blob, 'bond-intelligence-crm-hubspot.csv'))
    );
  }
}
