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
    // Primero match exacto, luego match exacto + municipio, luego ILIKE con municipio
    const findEuiQuery = `
        SELECT dev_eui FROM scada.inventory
        WHERE UPPER(TRIM(site_name)) = UPPER(TRIM($1))
        LIMIT 1
    `;
    const findEuiByMunicipioQuery = `
        SELECT dev_eui FROM scada.inventory
        WHERE site_name ILIKE $1
          AND UPPER(TRIM(municipality)) = UPPER(TRIM($2))
        LIMIT 1
    `;
    const searchTerm = `%${data.pozo_name}%`;

    try {
        // Try exact name match first (handles "POZO 50" == "POZO 50")
        let res = await pool.query(findEuiQuery, [data.pozo_name]);

        // Fallback: ILIKE + municipio filter (avoids "POZO 01" matching "Pozo 011 - Chalco")
        if (res.rows.length === 0 && data.municipio) {
            res = await pool.query(findEuiByMunicipioQuery, [searchTerm, data.municipio]);
        }

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
            case 'nivel': column = 'last_nivel_value'; break;
            case 'lluvia': column = 'last_lluvia_value'; break;
            case 'arrancador': column = 'fallo_arrancador'; break;
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

            // Usamos NOW() para last_updated_at — refleja cuándo recibimos el dato, no cuándo ICH lo generó
            await pool.query(upsertQuery, [devEui, finalValue, new Date()]);

            // Auto-promote obra → activo for meaningful measurements
            const isValidMeasurement =
                (data.variable === 'presion' || data.variable === 'caudal' || data.variable === 'caudal_totalizado')
                && typeof data.valor === 'number' && data.valor > 0;
            if (isValidMeasurement) {
                await promoteObraSiteIfNeeded(devEui);
            }
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
            bomba_activa,
            fallo_arrancador,
            last_nivel_value,
            last_lluvia_value,
            last_total_flow,
            last_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
            last_nivel_value = COALESCE(EXCLUDED.last_nivel_value, scada.site_status.last_nivel_value),
            last_lluvia_value = COALESCE(EXCLUDED.last_lluvia_value, scada.site_status.last_lluvia_value),
            last_total_flow = COALESCE(EXCLUDED.last_total_flow, scada.site_status.last_total_flow),
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
        data.bomba_activa,
        data.fallo_arrancador,
        data.nivel_m ?? null,
        data.lluvia_mm ?? null,
        data.caudal_totalizado_m3 ?? null,
        new Date()
    ];

    try {
        await pool.query(query, values);
        console.log(`✅ [Postgres] Site status fully synchronized: ${devEUI}`);

        // Auto-promote obra → activo if valid telemetry
        const hasValidData = (data.caudal_lts !== null && data.caudal_lts > 0)
                          || (data.presion_kg !== null && data.presion_kg > 0);
        if (hasValidData) {
            await promoteObraSiteIfNeeded(devEUI);
        }
    } catch (error) {
        console.error(`❌ [Postgres] Sync Error for ${devEUI}:`, error);
    }
}; 

/**
 * Auto-promote: if a site is currently 'obra' or 'pendiente' in inventory,
 * promote it to 'activo' when valid telemetry arrives.
 * One-way only — never demotes 'activo' back.
 */
const promoteObraSiteIfNeeded = async (devEUI: string): Promise<void> => {
    if (!pool) return;
    try {
        const result = await pool.query(
            `UPDATE scada.inventory
             SET estatus = 'activo'
             WHERE TRIM(dev_eui) = $1
               AND LOWER(TRIM(COALESCE(estatus, ''))) IN ('obra', 'pendiente')`,
            [devEUI.trim()]
        );
        if (result.rowCount && result.rowCount > 0) {
            console.log(`🔄 [Postgres] Site ${devEUI} auto-promoted: obra/pendiente → activo`);
        }
    } catch (error) {
        console.error(`⚠️ [Postgres] Auto-promote check failed for ${devEUI}:`, error);
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
