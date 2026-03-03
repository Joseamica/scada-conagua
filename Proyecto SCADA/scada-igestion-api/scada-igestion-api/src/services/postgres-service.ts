// src/services/postgres-service.ts

import { Pool, QueryResult } from 'pg';
import 'dotenv/config'; 
import { TelemetryProcessed } from '../interfaces/telemetry';

const isPostgresReady: boolean = !!(process.env.PG_HOST && process.env.PG_DATABASE);

// Inicialización del Pool: Usamos 'export const' para el pool
export const pool: Pool | null = (() => {
    if (isPostgresReady) {
        return new Pool({
            host: process.env.PG_HOST || 'localhost',
            user: process.env.PG_USER || 'scada_user',
            password: process.env.PG_PASSWORD || 'Sc@d42025$',
            database: process.env.PG_DATABASE || 'scada_metadata',
            port: parseInt(process.env.PG_PORT || '5432', 10),
        });
    }
    return null;
})(); // <-- Esto es una IIFE para inicializar y asignar


/**
 * Define la estructura de la metadata de un sitio (Pozo, Tanque, etc.).
 * Usamos una interfaz estricta para el resultado de la consulta.
 */
export interface SiteMetadata {
    site_id: string; // ID interno del sitio
    dev_eui: string; // Clave de unión con el payload de ChirpStack
    location: string;
    municipality: string; // Ecatepec, Tlalnepantla, Texcoco, Chalco
    threshold_flow_min: number; // Umbral de alarma de flujo
    threshold_pressure_max: number; // Umbral de alarma de presión
};

/**
 * 🚀 NUEVO: Actualización de estatus para datos provenientes de Ignition (ICH)
 * Realiza el mapeo entre el nombre del pozo y su dev_eui en el inventario.
 */
export const updateIgnitionSiteStatus = async (data: any): Promise<void> => {
    if (!pool) {
        console.error('>>> [Postgres] Pool is not initialized');
        return;
    }

    // 1. Buscamos el dev_eui en la tabla inventory usando el nombre del pozo
    // Usamos ILIKE y % para que "POZO 34" coincida con "Pozo 034 - Ixtapaluca"
    const findEuiQuery = `
        SELECT dev_eui FROM scada.inventory
        WHERE site_name ILIKE $1
        LIMIT 1
    `;
    const searchTerm = `%${data.pozo_name}%`;

    try {
        const res = await pool.query(findEuiQuery, [searchTerm]);

        if (res.rows.length === 0) {
            console.warn(`⚠️ [Postgres] No se encontró inventario para el sitio: ${data.pozo_name}`);
            return;
        }

        const devEui = res.rows[0].dev_eui;
        let column = '';

        // 2. Mapeo de variables Ignition -> Columnas en site_status
        switch (data.variable) {
            case 'presion': column = 'last_pressure_value'; break;
            case 'caudal': column = 'last_flow_value'; break;
            case 'bomba': column = 'bomba_activa'; break;
            case 'senal': column = 'rssi'; break;
            case 'caudal_totalizado': // Mapeo para el "odómetro"
                column = 'last_total_flow'; 
                break;
        }

        if (column) {
            /**
             * 🛠️ LÓGICA DE UPSERT:
             * Intentamos insertar la fila. Si el dev_eui ya existe (ON CONFLICT),
             * actualizamos solo la columna que llegó y el timestamp.
             */
            const upsertQuery = `
                INSERT INTO scada.site_status (dev_eui, ${column}, last_updated_at)
                VALUES ($1, $2, $3)
                ON CONFLICT (dev_eui) 
                DO UPDATE SET 
                    ${column} = EXCLUDED.${column}, 
                    last_updated_at = EXCLUDED.last_updated_at;
            `;

            const finalValue = (data.variable === 'bomba') ? (data.valor === true) : Number(data.valor);
            
            // Usamos data.timestamp para mantener la sincronía con el origen
            await pool.query(upsertQuery, [devEui, finalValue, data.timestamp]);
        }

    } catch (error) {
        console.error('❌ [Postgres Error] Ignition Update:', error);
    }
};

/**
 * Lógica ChirpStack
 * @param devEUI 
 * @param payload El mensaje de ChirpStack.
 */

export const updateSiteStatus = async (devEUI: string, data: TelemetryProcessed): Promise<void> => {
    if (!pool) return;

    const query = `
        INSERT INTO scada.site_status (
            dev_eui, 
            last_flow_value, 
            last_pressure_value, 
            battery_level,
            rssi,
            snr,
            is_cfe_on,
            bomba_activa,      -- Añadido
            fallo_arrancador,  -- Añadido
            last_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (dev_eui) 
        DO UPDATE SET 
            last_flow_value = EXCLUDED.last_flow_value,
            last_pressure_value = EXCLUDED.last_pressure_value,
            battery_level = EXCLUDED.battery_level,
            rssi = EXCLUDED.rssi,
            snr = EXCLUDED.snr,
            is_cfe_on = EXCLUDED.is_cfe_on,
            bomba_activa = EXCLUDED.bomba_activa,
            fallo_arrancador = EXCLUDED.fallo_arrancador,
            last_updated_at = EXCLUDED.last_updated_at;
    `;

    const values = [
        devEUI,
        data.caudal_lts,
        data.presion_kg,
        data.battery,
        data.rssi,
        data.snr,
        data.is_cfe_on,
        data.bomba_activa,    // Mapeo desde el transformador
        data.fallo_arrancador, // Mapeo desde el transformador (True = Falla)
        data.timestamp
    ];

    try {
        await pool.query(query, values);
        console.log(`✅ [Postgres] Site status fully synchronized: ${devEUI}`);
    } catch (error) {
        console.error(`❌ [Postgres] Sync Error for ${devEUI}:`, error);
    }
}; 

/**
 * Consulta de metadata básica del sitio
 */
export const getSiteMetadata = async (devEUI: string): Promise<any | null> => {
    if (!pool) return null;
    const query = `SELECT * FROM scada.inventory WHERE dev_eui = $1`;
    try {
        const result = await pool.query(query, [devEUI]);
        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error(`❌ [Postgres] Error querying metadata for ${devEUI}:`, error);
        return null;
    }
};
