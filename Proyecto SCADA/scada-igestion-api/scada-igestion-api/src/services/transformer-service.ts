//src/services/transformer-service.ts

import { ChirpstackUplinkPayload, TelemetryProcessed } from '../interfaces/telemetry';

// Constantes de diseño hidráulico

const SENSOR_V_MAX = 5.0; // <--- PLACEHOLDER: Actulizar este parámetro cuando se cuente con la ficha técnica del medidor final
const PRESSURE_MAX_KG = 10.197; // Valor estandar  100m de columna de agua
const VELOCIDAD_MAX_SENSOR = 5.48; // m/s (Ajustado para que 6" ≈ 100 L/s tomando como base una tubería de  6" pulgadas)
const NIVEL_MAX_M = 10.0;     // 0-10 metros
const LLUVIA_MAX_MM = 100.0;  // 0-100 mm/hr

/**
 * Calculo del porcentage de carga de las baterías (DC 24V)
 * basado en 1/3 de la capacidad maxima 8V o más = 100%, 0V = 0%.
 */
const calculateBattery = (voltage: any): number => {
    const v = (typeof voltage === 'number') ? voltage : 0;
    if (v >= 8.0) return 100;
    if (v <= 0) return 0;
    const percentage = (v * 100) / 8;
    return parseFloat(percentage.toFixed(2));
};

/**
 * Calcula el Caudal Máximo teórico basado en el diámetro (Pulgadas)
 * @param inches Diámetro nominal de la tubería
 */
const calculateMaxFlow = (diameterInches: number): number => {
    const radiusMeters = (diameterInches * 0.0254) / 2;
    const area = Math.PI * Math.pow(radiusMeters, 2);
    // Flow (L/s) = Velocity (m/s) * Area (m2) * 1000
    const maxFlowLps = SENSOR_V_MAX * area * 1000;
    return parseFloat(maxFlowLps.toFixed(3));
};

export const transformTelemetry = ( payload: ChirpstackUplinkPayload, siteMetadata: any ): TelemetryProcessed | null => {
    const data = payload.object || {}; 
    const utcDate = new Date(payload.time);

    // --- FILTRO DE PRECISIÓN ---
    // Si adv_2 es undefined, es un mensaje de heartbeat o diagnóstico sin datos de sensores.
    if (data.adv_2 === undefined || data.adc_1 === undefined) {
        return null; // Retornamos null para indicar que este paquete no debe procesarse
    }
    
    // Formato de hora para Ciudad de México (UTC-6)
    const mxTime = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).format(utcDate);

    // Extraer diámetro de la metadata (con fallback a 6" si no existe)
    const diametro = siteMetadata?.pipe_diameter ? parseFloat(siteMetadata.pipe_diameter) : 6.0;

    // Calcula el MAX dinámico para este sitio específico
    const dynamicMaxFlow = calculateMaxFlow(diametro);
    
    // Cambiamos el tipo de 'ma' a any para manejar undefined y quitamos parseFloat
    const scale = (ma: any, maxValue: number) => {
        const valMA = (typeof ma === 'number') ? ma : 4.0;
        if (valMA <= 4.05) return 0; // Dead zone
        return parseFloat((((valMA - 4) * maxValue) / 16).toFixed(3));
    };  

    // Acceso seguro a rxInfo
    let currentRssi = 0;
    let currentSnr = 0;
    if (payload.rxInfo && payload.rxInfo.length > 0 && payload.rxInfo[0]) {
        currentRssi = payload.rxInfo[0].rssi;
        currentSnr = payload.rxInfo[0].snr;
    }

    return {
        devEUI: payload.deviceInfo.devEui,
	site_name: siteMetadata?.site_name || 'SITIO_DESCONOCIDO',
        municipality: siteMetadata?.municipality || 'SIN_ASIGNAR',
        timestamp: utcDate,
        timestampMX: mxTime,

	// Scala dinamica
        presion_kg: scale(data.adc_1, 10.1972), // Presión fija (ej. 10 kg/cm2)
        caudal_lts: scale(data.adc_2, dynamicMaxFlow), // <--- CAUDAL DINÁMICO
        presion_ma: (typeof data.adc_1 === 'number') ? data.adc_1 : 4.0,
        caudal_ma: (typeof data.adc_2 === 'number') ? data.adc_2 : 4.0,

	//Controlde estados
        is_cfe_on: data.gpio_in_1 === 'high' || data.gpio_in_1 === 'on',
	bomba_activa: data.gpio_in_2 === 'high' || data.gpio_in_2 === 'on',
	fallo_arrancador: data.gpio_in_3 === 'high' || data.gpio_in_3 === 'on',

	diametro_tuberia: diametro,
	battery: calculateBattery(data.adv_2),
        battery_voltage: (typeof data.adv_2 === 'number') ? data.adv_2 : 0,
        rssi: currentRssi,
        snr: currentSnr,
        ...(typeof data.adc_3 === 'number' && data.adc_3 > 4.05
            ? { nivel_m: scale(data.adc_3, siteMetadata?.nivel_max ? parseFloat(siteMetadata.nivel_max) : NIVEL_MAX_M) }
            : {}),
        ...(typeof data.adc_4 === 'number' && data.adc_4 > 4.05
            ? { lluvia_mm: scale(data.adc_4, siteMetadata?.lluvia_max ? parseFloat(siteMetadata.lluvia_max) : LLUVIA_MAX_MM) }
            : {}),
    };
};
