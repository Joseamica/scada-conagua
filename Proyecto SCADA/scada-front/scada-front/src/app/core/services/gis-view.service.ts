import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GisViewState {
  bounds: { sw: [number, number]; ne: [number, number] };
  base: 'mapa' | 'satelite' | 'terreno';
  bearing: number;
  layerVisibility: string;
  filterMunicipio: number;
  filterSiteType: string;
  filterMinFlow: number;
  filterOnlyAlarm: boolean;
  heatmapVisible: boolean;
  miniMapVisible: boolean;
  geoServerLayers: string[];
  drawnItems: any | null;
}

export interface GisView {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  view_state: GisViewState;
  is_public: boolean;
  owner_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateGisView {
  name: string;
  view_state: GisViewState;
  description?: string;
  is_public?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GisViewService {
  private http = inject(HttpClient);
  private base = `${environment.apiQueryUrl}/gis/views`;

  list(): Observable<GisView[]> {
    return this.http.get<GisView[]>(this.base);
  }

  get(id: number): Observable<GisView> {
    return this.http.get<GisView>(`${this.base}/${id}`);
  }

  create(data: CreateGisView): Observable<GisView> {
    return this.http.post<GisView>(this.base, data);
  }

  update(id: number, data: Partial<CreateGisView>): Observable<GisView> {
    return this.http.put<GisView>(`${this.base}/${id}`, data);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }
}
