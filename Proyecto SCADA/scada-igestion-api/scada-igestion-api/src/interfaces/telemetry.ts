// src/interfaces/telemetry.ts

export interface ChirpstackUplinkPayload {
    time: string;
    fPort: number; // Puerto utilizado para el envío de los Frames LoRaWAN
    deviceInfo: {
        devEui: string;
        deviceName: string;
        applicationName: string;
    };
    rxInfo: { rssi: number; snr: number }[];
    object: {
        adc_1: number;      // Presión mA
        adc_2: number;      // Caudal mA
	adv_2: number;     // Valor de 1/3 de la carga total de la batería (DC 24V)  
        gpio_in_1: string;  // Flag de estatus de la corriente pública (CFE) Online || Offline
        gpio_in_2: string; // Flag de estatus del estado de la bomba: Parado || Arrancado
        gpio_in_3: string; // Flag de estatus del estado del arrancador: Falla on || Ok || off 	
        [key: string]: any;
    };
}

export interface TelemetryProcessed {
    devEUI: string;
    site_name: string;        // Para identificar el pozo en Influx/Angular
    municipality: string;     // Para filtros por zona (Ecatepec, etc.)
    timestamp: Date;
    timestampMX: string;      // Propiedad para el horario de CDMX (UTC-6)
    presion_kg: number;
    caudal_lts: number;
    presion_ma: number;
    caudal_ma: number;
    is_cfe_on: boolean;       // Atributo que determina sin tenemos presencia o ausencia de energía electrica proveniente de la red pública (CFE para México)
    bomba_activa: boolean;    // Estado del motor
    fallo_arrancador: boolean; // Alarma crítica (True = Falla)
    diametro_tuberia: number;
    battery: number;          // Porcentaje calculado
    battery_voltage: number;  // Voltaje crudo (adv_2) 1/3 de la carga total de las baterías (DC 24V)
    rssi: number;             // Calidad de señal
    snr: number;              // Relación señal-ruido
}

export interface IgnitionPayload {
    topic: string;    // Ejemplo: ignition-conagua-ocavm/IXTAPALUCA/pozo/POZO 34
    rawPayload: string; // Ejemplo: Presion;[0.72, Good, ...]
}

export interface IgnitionProcessed {
    municipio: string;
    pozo_name: string;
    variable: string;
    valor: number | boolean;
    unidad: string;
    calidad: string;
    timestamp: Date;
}
