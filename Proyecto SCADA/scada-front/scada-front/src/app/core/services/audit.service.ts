import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuditLogEntry {
  id: number;
  user_id: number;
  full_name: string;
  email: string;
  role_name: string;
  scope: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface AuditLogsResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  userId?: number;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly apiUrl = `${environment.apiQueryUrl}/audit`;

  constructor(private http: HttpClient) {}

  getLogs(params: AuditLogParams = {}): Observable<AuditLogsResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.limit) httpParams = httpParams.set('limit', params.limit.toString());
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.userId) httpParams = httpParams.set('userId', params.userId.toString());

    return this.http.get<AuditLogsResponse>(`${this.apiUrl}/logs`, { params: httpParams });
  }

  exportCSV(params: AuditLogParams = {}): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params.from) httpParams = httpParams.set('from', params.from);
    if (params.to) httpParams = httpParams.set('to', params.to);
    if (params.userId) httpParams = httpParams.set('userId', params.userId.toString());

    return this.http.get(`${this.apiUrl}/logs/export`, {
      params: httpParams,
      responseType: 'blob'
    });
  }
}
