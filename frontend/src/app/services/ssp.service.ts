import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  SiteSafetyPlan,
  AddressLookupResult,
  AddressLookupMeta,
  ParcelLookupResult,
  DsaProjectLookupResult,
  ProjectContractor,
  SspAttachment,
} from '../models/site-safety-plan.model';

@Injectable({ providedIn: 'root' })
export class SspService {
  private readonly base = `${environment.apiUrl}/ssp`;
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(): Observable<SiteSafetyPlan[]> {
    return this.http
      .get<{ data: SiteSafetyPlan[] }>(this.base)
      .pipe(map((res) => res.data));
  }

  get(id: number): Observable<SiteSafetyPlan> {
    return this.http
      .get<{ data: SiteSafetyPlan }>(`${this.base}/${id}`)
      .pipe(map((res) => res.data));
  }

  create(plan: SiteSafetyPlan): Observable<SiteSafetyPlan> {
    return this.http
      .post<{ data: SiteSafetyPlan }>(this.base, plan)
      .pipe(map((res) => res.data));
  }

  update(id: number, plan: SiteSafetyPlan): Observable<SiteSafetyPlan> {
    return this.http
      .put<{ data: SiteSafetyPlan }>(`${this.base}/${id}`, plan)
      .pipe(map((res) => res.data));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  lookupAddress(address: string): Observable<{ data: AddressLookupResult; meta: AddressLookupMeta }> {
    return this.http.post<{ data: AddressLookupResult; meta: AddressLookupMeta }>(
      `${this.api}/lookup-address`,
      { address }
    );
  }

  lookupParcel(payload: { lat: number; lng: number; apn?: string; county?: string }): Observable<ParcelLookupResult> {
    return this.http
      .post<{ data: ParcelLookupResult }>(`${this.api}/lookup-parcel`, payload)
      .pipe(map((res) => res.data));
  }

  lookupDsaProject(dsaApplicationNumber: string): Observable<{
    data?: DsaProjectLookupResult;
    contractors?: ProjectContractor[];
    error?: string;
  }> {
    return this.http.post<{ data?: DsaProjectLookupResult; contractors?: ProjectContractor[]; error?: string }>(
      `${this.api}/lookup-dsa-project`,
      { dsa_application_number: dsaApplicationNumber }
    );
  }

  exportPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/export-pdf`, { responseType: 'blob' });
  }

  exportPackage(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/export-package`, { responseType: 'blob' });
  }

  listAttachments(id: number): Observable<SspAttachment[]> {
    return this.http
      .get<{ data: SspAttachment[] }>(`${this.base}/${id}/attachments`)
      .pipe(map((res) => res.data));
  }

  uploadAttachment(id: number, file: File, category = 'fire_dept_approved'): Observable<SspAttachment> {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    return this.http
      .post<{ data: SspAttachment }>(`${this.base}/${id}/attachments`, form)
      .pipe(map((res) => res.data));
  }
}
