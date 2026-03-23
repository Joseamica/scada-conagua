import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RainStation {
  id: number;
  code: string;
  name: string;
  address: string | null;
  municipality: string;
  municipio_id: number;
  latitude: number;
  longitude: number;
  is_active: boolean;
  last_value_mm: number;
  last_updated_at: string | null;
}

export interface RainCutStation {
  id: number;
  station_id: number;
  code: string;
  station_name: string;
  municipality: string;
  municipio_id: number;
  cut_date: string;
  h06: number; h07: number; h08: number; h09: number;
  h10: number; h11: number; h12: number; h13: number;
  h14: number; h15: number; h16: number; h17: number;
  h18: number; h19: number; h20: number; h21: number;
  h22: number; h23: number;
  h00: number; h01: number; h02: number; h03: number;
  h04: number; h05: number;
  cut_total: number;
}

export interface RainCutMunicipality {
  municipality: string;
  municipio_id: number;
  stations: RainCutStation[];
  totals: Record<string, number>;
}

export interface RainCutResponse {
  date: string;
  municipalities: RainCutMunicipality[];
  total_stations: number;
}

@Injectable({ providedIn: 'root' })
export class RainService {
  private http = inject(HttpClient);
  private base = `${environment.apiQueryUrl}/rain`;

  getStations(): Observable<RainStation[]> {
    return this.http.get<RainStation[]>(`${this.base}/stations`);
  }

  getCurrent(): Observable<RainStation[]> {
    return this.http.get<RainStation[]>(`${this.base}/current`);
  }

  getCuts(date: string): Observable<RainCutResponse> {
    return this.http.get<RainCutResponse>(`${this.base}/cuts/${date}`);
  }

  getAvailableDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/dates`);
  }
}
