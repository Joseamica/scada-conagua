import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GisDrawing {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  geojson: any;
  color: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGisDrawing {
  name: string;
  geojson: any;
  color?: string;
  description?: string;
  is_public?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GisDrawingService {
  private http = inject(HttpClient);
  private base = `${environment.apiQueryUrl}/gis/drawings`;

  list(): Observable<GisDrawing[]> {
    return this.http.get<GisDrawing[]>(this.base);
  }

  get(id: number): Observable<GisDrawing> {
    return this.http.get<GisDrawing>(`${this.base}/${id}`);
  }

  create(data: CreateGisDrawing): Observable<GisDrawing> {
    return this.http.post<GisDrawing>(this.base, data);
  }

  update(id: number, data: Partial<CreateGisDrawing>): Observable<GisDrawing> {
    return this.http.put<GisDrawing>(`${this.base}/${id}`, data);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
