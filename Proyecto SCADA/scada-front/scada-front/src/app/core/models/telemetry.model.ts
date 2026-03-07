// src/app/core/models/telemetry.model.ts

export interface TelemetryPoint {
  timestamp: string; // ISO 8601
  value: number;
  unit: string;
}

export interface SiteInventory {
    id: number;
    gw_eui: string;
    dev_eui: string;
    site_name: string;
    site_type: string;
    municipality: string;
    latitude: number;
    longitude: number;
    is_active: boolean;
    last_pressure_kg: number;
    last_flow_lts: number;
    last_total_flow: number;
    last_battery_percent: number;
    last_signal_rssi: number;
    last_signal_snr: number;
    last_update: string; // ISO String from Postgres
    is_cfe_on: boolean;
    bomba_activa: boolean;       // 🚀 Estado Motor
    fallo_arrancador: boolean;   // 🚀 Alarma
    battery_level: number;
    rssi: number;
    snr: number;
}

export interface TelemetryHistoryResponse {
  siteName: string;
  devEui: string;
  measurement: string;
  data: TelemetryPoint[];
}

export interface SiteLiveStatus {
    dev_eui: string;
    site_name: string;
    municipality: string;
    last_flow_value: number;
    last_pressure_value: number;
    last_total_flow: number;     // 🚀 Nuevo: Odómetro Ignition
    last_nivel_value?: number;
    last_lluvia_value?: number;
    last_updated_at: string;
    is_cfe_on: boolean;
    bomba_activa: boolean;       // 🚀 Nuevo: Estado Motor
    fallo_arrancador: boolean;   // 🚀 Nuevo: Alarma
    battery_level: number;
    rssi: number;
    snr: number;
}