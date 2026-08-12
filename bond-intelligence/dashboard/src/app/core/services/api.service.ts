import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/agency.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  get<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}): Observable<ApiResponse<T>> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        httpParams = httpParams.set(key, String(val));
      }
    });
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}${path}`, { params: httpParams })
      .pipe(catchError(this.handleError));
  }

  post<T>(path: string, body: unknown = {}): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(`${this.baseUrl}${path}`, body)
      .pipe(catchError(this.handleError));
  }

  getBlob(path: string, params: Record<string, string | number | boolean | undefined> = {}): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        httpParams = httpParams.set(key, String(val));
      }
    });
    return this.http.get(`${this.baseUrl}${path}`, { params: httpParams, responseType: 'blob' })
      .pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const message = error.error?.message || error.message || 'An unknown error occurred';
    console.error('API Error:', message);
    return throwError(() => new Error(message));
  }
}
