// src/interfaces/query.ts

/**
 * Representa un punto individual en una serie de tiempo (InfluxDB)
 */
export interface TimeSeriesData {
    timestamp: string; 
    value: number;     
    unit: string;      
}

/**
 * Respuesta estructurada para gráficas de telemetría
 */
export interface SiteTelemetryResponse {
    siteName: string;
    devEui: string;
    measurement: string; 
    data: TimeSeriesData[];
}

/**
 * 🚀 Contrato para el LIVE STATUS (PostgreSQL)
 * Esta interfaz debe coincidir con el SELECT del archivo app.ts
 */
export interface SiteStatus {
    // Metadata del Inventario
    site_name: string;
    municipality: string;
    site_type: string;
    latitude: number;
    longitude: number;

    // Telemetría de Operación
    last_flow_value: number;
    last_pressure_value: number;
    last_total_flow: number; // <-- El odómetro sensores de caudal
    last_nivel_value?: number;
    last_lluvia_value?: number;
    
    // Salud y Conectividad
    battery_level: number;
    rssi: number;
    snr: number;
    last_updated_at: string | Date;

    // Estados Lógicos y Alarmas
    is_cfe_on: boolean;
    bomba_activa: boolean;
    fallo_arrancador: boolean;
}

/**
 * Control SCADA
 */
export type SCADACommand = 'START' | 'STOP'; 

export interface SCADAControlRequest {
    devEUI: string;
    command: SCADACommand;
}
