import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SinopticoProject {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  owner_name: string;
  entity_id: number | null;
  estado_id: number;
  municipio_id: number;
  is_public: boolean;
  sinoptico_count: number;
  created_at: string;
  updated_at: string;
}

export interface Sinoptico {
  id: number;
  project_id: number;
  project_name?: string;
  name: string;
  description: string | null;
  canvas: CanvasState;
  canvas_width: number;
  canvas_height: number;
  canvas_bg?: string;
  thumbnail: string | null;
  version: number;
  owner_id: number;
  owner_name: string;
  widget_count?: number;
  widget_layout?: { type: string; x: number; y: number; width: number; height: number }[];
  created_at: string;
  updated_at: string;
}

export interface CanvasState {
  widgets: CanvasWidget[];
  grid: { snap: boolean; size: number };
  zoom: number;
}

export interface CanvasWidget {
  id: string;
  type: 'table' | 'chart' | 'map' | 'label' | 'header' | 'image' | 'text' | 'shape' | 'link' | 'clock' | 'variable' | 'alarm';
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked: boolean;
  groupId?: string;
  opacity?: number; // 0-1, defaults to 1
  config: WidgetConfig;
}

// Widget-specific configs
export interface LabelConfig {
  devEUI: string;
  measurement: string;
  title: string;
  unit: string;
  decimals: number;
  fontSize: number;
  alarmRanges: { min: number; max: number; color: string; blink: boolean }[];
  // Variable view integration
  source?: 'tag' | 'view';
  viewId?: number;
  formulaId?: number;
  formulaAlias?: string;
}

export interface ChartConfig {
  series: {
    devEUI: string;
    measurement: string;
    label: string;
    color: string;
    lineType: 'line' | 'bar' | 'area';
    yAxisIndex: number;
    // Variable view integration
    source?: 'tag' | 'view';
    viewId?: number;
    formulaId?: number;
    formulaAlias?: string;
  }[];
  timeRange: string; // '1h' | '6h' | '24h' | '7d' | '30d'
  showLegend: boolean;
  showGrid: boolean;
}

export interface MapConfig {
  center: [number, number];
  zoom: number;
  markers: { devEUI: string; label: string; lat: number; lng: number; navigateTo?: number }[];
  showLayer: boolean;
}

export interface TableConfig {
  columns: {
    devEUI: string;
    measurement: string;
    label: string;
    unit: string;
    // Variable view integration
    source?: 'tag' | 'view';
    viewId?: number;
    formulaId?: number;
    formulaAlias?: string;
  }[];
  showHeader: boolean;
  striped: boolean;
}

export interface HeaderConfig {
  title: string;
  subtitle: string;
  logoUrl: string;
  bgColor: string;
  textColor: string;
  fontSize: number;
}

export interface ImageConfig {
  src: string;
  alt: string;
  objectFit: 'cover' | 'contain' | 'fill' | 'none';
  borderRadius: number;
}

export interface TextConfig {
  text: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  bgColor: string;
  padding: number;
}

export interface ShapeConfig {
  shapeType: 'rectangle' | 'ellipse' | 'line' | 'triangle' | 'diamond' | 'arrow-right' | 'arrow-down' | 'pentagon' | 'hexagon' | 'star';
  fillColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

export interface LinkConfig {
  targetSinopticoId: number | null;
  targetName: string;
  label: string;
  bgColor: string;
  textColor: string;
  fontSize: number;
}

export interface VariableConfig {
  viewId: number | null;
  viewName: string;
  columnId: number | null;
  formulaId: number | null;
  sourceLabel: string; // display name: "presion_doble" or "Pozo 008 / caudal"
  title: string;
  unit: string;
  decimals: number;
  fontSize: number;
  color: string;
  bgColor: string;
}

export interface AlarmConfig {
  title: string;
  maxItems: number;
  fontSize: number;
  showSiteName: boolean;
  showTimestamp: boolean;
  compact: boolean;
}

export interface ClockConfig {
  format: '12h' | '24h';
  showDate: boolean;
  showSeconds: boolean;
  fontSize: number;
  color: string;
  bgColor: string;
}

export type WidgetConfig =
  | LabelConfig
  | ChartConfig
  | MapConfig
  | TableConfig
  | HeaderConfig
  | ImageConfig
  | TextConfig
  | ShapeConfig
  | LinkConfig
  | ClockConfig
  | VariableConfig
  | AlarmConfig;

export function defaultWidgetConfig(type: CanvasWidget['type']): WidgetConfig {
  switch (type) {
    case 'label':
      return {
        devEUI: '',
        measurement: '',
        title: 'Valor',
        unit: '',
        decimals: 2,
        fontSize: 32,
        alarmRanges: [],
      };
    case 'chart':
      return { series: [], timeRange: '24h', showLegend: true, showGrid: true };
    case 'map':
      return { center: [19.35, -98.99], zoom: 12, markers: [], showLayer: true };
    case 'table':
      return { columns: [], showHeader: true, striped: true };
    case 'header':
      return {
        title: 'Titulo',
        subtitle: '',
        logoUrl: '',
        bgColor: '#6d002b',
        textColor: '#ffffff',
        fontSize: 24,
      };
    case 'image':
      return { src: '', alt: '', objectFit: 'contain', borderRadius: 0 };
    case 'text':
      return { text: 'Texto', fontSize: 16, fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', color: '#0f172a', bgColor: 'transparent', padding: 8 };
    case 'shape':
      return { shapeType: 'rectangle', fillColor: '#e2e8f0', borderColor: '#94a3b8', borderWidth: 2, borderRadius: 0 };
    case 'link':
      return { targetSinopticoId: null, targetName: '', label: 'Ir a...', bgColor: '#6d002b', textColor: '#ffffff', fontSize: 14 };
    case 'clock':
      return { format: '24h', showDate: true, showSeconds: true, fontSize: 32, color: '#0f172a', bgColor: 'transparent' };
    case 'variable':
      return { viewId: null, viewName: '', columnId: null, formulaId: null, sourceLabel: '', title: 'Variable', unit: '', decimals: 2, fontSize: 32, color: '#0f172a', bgColor: 'transparent' };
    case 'alarm':
      return { title: 'Alarmas Activas', maxItems: 10, fontSize: 12, showSiteName: true, showTimestamp: true, compact: false };
  }
}

export interface SinopticoShare {
  id: number;
  user_id: number;
  permission: 'read' | 'edit';
  full_name: string;
  email: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: number;
  sinoptico_id: number;
  user_id: number;
  full_name: string;
  action: string;
  details: any;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class SinopticoService {
  private http = inject(HttpClient);
  private base = `${environment.apiQueryUrl}/sinopticos`;

  // Projects
  getProjects(): Observable<SinopticoProject[]> {
    return this.http.get<SinopticoProject[]>(`${this.base}/projects`);
  }

  createProject(data: { name: string; description?: string; is_public?: boolean }): Observable<SinopticoProject> {
    return this.http.post<SinopticoProject>(`${this.base}/projects`, data);
  }

  updateProject(id: number, data: Partial<SinopticoProject>): Observable<SinopticoProject> {
    return this.http.put<SinopticoProject>(`${this.base}/projects/${id}`, data);
  }

  deleteProject(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/projects/${id}`);
  }

  // Sinopticos
  getProjectSinopticos(projectId: number): Observable<Sinoptico[]> {
    return this.http.get<Sinoptico[]>(`${this.base}/projects/${projectId}/sinopticos`);
  }

  getAllSinopticos(): Observable<{ id: number; name: string; project_name: string }[]> {
    return this.http.get<{ id: number; name: string; project_name: string }[]>(`${this.base}/sinopticos-all`);
  }

  createSinoptico(projectId: number, data: { name: string; description?: string; canvas_width?: number; canvas_height?: number }): Observable<Sinoptico> {
    return this.http.post<Sinoptico>(`${this.base}/projects/${projectId}/sinopticos`, data);
  }

  getSinoptico(id: number): Observable<Sinoptico> {
    return this.http.get<Sinoptico>(`${this.base}/sinopticos/${id}`);
  }

  saveSinoptico(id: number, data: Partial<Sinoptico>): Observable<{ id: number; version: number; updated_at: string }> {
    return this.http.put<{ id: number; version: number; updated_at: string }>(`${this.base}/sinopticos/${id}`, data);
  }

  deleteSinoptico(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/sinopticos/${id}`);
  }

  duplicateSinoptico(id: number): Observable<Sinoptico> {
    return this.http.post<Sinoptico>(`${this.base}/sinopticos/${id}/duplicate`, {});
  }

  // Trash
  getTrash(projectId: number): Observable<{ id: number; name: string; description: string | null; version: number; deleted_at: string }[]> {
    return this.http.get<any[]>(`${this.base}/projects/${projectId}/trash`);
  }

  restoreSinoptico(id: number): Observable<{ message: string; id: number; name: string }> {
    return this.http.post<{ message: string; id: number; name: string }>(`${this.base}/sinopticos/${id}/restore`, {});
  }

  // Shared with me
  getSharedWithMe(): Observable<(Sinoptico & { permission: string; project_name: string })[]> {
    return this.http.get<any[]>(`${this.base}/sinopticos-shared`);
  }

  // Sharing
  getShares(sinopticoId: number): Observable<SinopticoShare[]> {
    return this.http.get<SinopticoShare[]>(`${this.base}/sinopticos/${sinopticoId}/shares`);
  }

  addShare(sinopticoId: number, userId: number, permission: 'read' | 'edit'): Observable<any> {
    return this.http.post(`${this.base}/sinopticos/${sinopticoId}/shares`, { user_id: userId, permission });
  }

  removeShare(sinopticoId: number, shareId: number): Observable<any> {
    return this.http.delete(`${this.base}/sinopticos/${sinopticoId}/shares/${shareId}`);
  }

  searchShareCandidates(sinopticoId: number, q: string): Observable<{ id: number; full_name: string; email: string }[]> {
    return this.http.get<{ id: number; full_name: string; email: string }[]>(
      `${this.base}/sinopticos/${sinopticoId}/share-candidates`, { params: { q } },
    );
  }

  // Activity
  getActivity(sinopticoId: number, limit = 50): Observable<ActivityLogEntry[]> {
    return this.http.get<ActivityLogEntry[]>(`${this.base}/sinopticos/${sinopticoId}/activity?limit=${limit}`);
  }

  // Batch telemetry query
  queryWidgets(sinopticoId: number, widgets: any[], range?: string): Observable<{ results: Record<string, any>; timestamp: string }> {
    return this.http.post<{ results: Record<string, any>; timestamp: string }>(`${this.base}/sinopticos/${sinopticoId}/query`, { widgets, range });
  }
}
