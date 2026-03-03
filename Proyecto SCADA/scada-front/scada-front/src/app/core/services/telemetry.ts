import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TelemetryHistoryResponse } from '../models/telemetry.model';

// Correlación de la interfaz con el backend (src/interfaces/query.ts)
export interface SCADAControlRequest {
    devEUI: string;
    command: 'START' | 'STOP';
    siteName?: string;
}

// Interface para Live Status desde Postgress
export interface SiteLiveStatus {
    dev_eui: string;
    site_name: string;
    municipality: string;
    last_flow_value: number;
    last_pressure_value: number;
    last_total_flow: number;     
    last_updated_at: string;
    is_cfe_on: boolean;
    bomba_activa: boolean;       
    fallo_arrancador: boolean;  
    rssi: number;
    snr: number;
}

//Representa a solo punto la serie de tiempo InfluxDB para las gráficas
export interface HistoricalDataPoint {
    _time: string;
    _value: number;
    _field: string;
}

@Injectable({
  providedIn: 'root'
})
export class TelemetryService {
  private http = inject(HttpClient);
  
  // Uso para las varibles de entorno para microservicios en OCI (backend-server)
    private readonly BASE_URL = environment.apiQueryUrl;
  
  // Catálogo completo de sitios del inventario (incluye last_flow_value para agregaciones)
  getSites(): Observable<{ dev_eui: string; site_name: string; municipality: string; site_type: string; last_flow_value: number | null; last_pressure_value: number | null; last_updated_at: string | null }[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/sites`);
  }

  // Consulta los datos mas recientes de un sitio en especifico
  getSiteStatus(devEUI: string): Observable<any> {
    // Usamos environment.apiUrl que debe terminar en /api/v1
    return this.http.get(`${environment.apiQueryUrl}/status/${devEUI.trim()}`);
  }
  

  // Devuelve los datos historicos de un pozo específico (Presión, Flujo, Nivel, etc.)
  // @param devEui UC300 Hardware ID
  // @param range  Rango relativo (ej: '-24h', '-7d') — ignorado si se pasa from/to
  // @param options  Opciones opcionales: from/to (ISO 8601 UTC) e interval (ej: '15m', '1h')
  getHistory(
    devEUI: string,
    measurement: string,
    range: string = '-1h',
    options?: { from?: string; to?: string; interval?: string }
  ): Observable<TelemetryHistoryResponse> {
    let params = new HttpParams();
    if (options?.from && options?.to) {
      params = params.set('from', options.from).set('to', options.to);
    } else {
      params = params.set('range', range);
    }
    if (options?.interval) {
      params = params.set('interval', options.interval);
    }
    return this.http.get<TelemetryHistoryResponse>(`${environment.apiQueryUrl}/telemetry/${devEUI}/${measurement}`, { params });
  }

  // Método de control para usar la interfaz estricta
  sendControlCommand(payload: SCADAControlRequest): Observable<any> {
    // Se define endpoint src/app.ts: app.post('/api/v1/control')
    return this.http.post(`${environment.apiControlUrl}`, payload);
  }
}
