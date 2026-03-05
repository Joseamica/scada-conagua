// src/services/influx-query-service.ts

import { InfluxDB, FluxTableMetaData, QueryApi } from '@influxdata/influxdb-client';
import 'dotenv/config';
import { SiteTelemetryResponse, TimeSeriesData } from '../interfaces/query';
import { pool } from '../services/db-service';

// --- Configuración de Conexión ---
const url: string = process.env.INFLUX_URL || 'http://localhost:8086';
const token: string = process.env.INFLUX_TOKEN as string;
const org: string = process.env.INFLUX_ORG || 'CONAGUA';
const bucket: string = process.env.INFLUX_BUCKET || 'telemetria_sitios';

const influxDB: InfluxDB = new InfluxDB({ url, token });
const queryApi: QueryApi = influxDB.getQueryApi(org);

export async function getTelemetryData(
    devEUI: string,
    measurementField: string,
    range: string = '-24h',
    every: string = '1m',
    stop?: string
): Promise<SiteTelemetryResponse> {

    let siteName = 'Unknown Site';

    try {
        // 1. Identificación de origen (Ignition ICH o ChirpStack 4PT)
        const isIgnition = devEUI.toLowerCase().startsWith('dev');
        
        // 2. Selección dinámica de infraestructura
        const activeBucket = isIgnition ? 'telemetria_ignition' : (process.env.INFLUX_BUCKET || 'telemetria_sitios');
        const activeMeasurement = isIgnition ? 'mediciones_ignition' : 'mediciones_pozos';

        // 3. Mapeo de Campos (Abstracción para el Frontend)
        let influxField = measurementField;
        if (isIgnition) {
            const mapping: Record<string, string> = {
                'presion_kg': 'value_presion',
                'caudal_lts': 'value_caudal',
                'last_total_flow': 'value_caudal_totalizado',
                'rssi': 'value_senal'
            };
            influxField = mapping[measurementField] || measurementField;
        }

        // 4. Buscar el nombre del sitio en PostgreSQL
        const pgQuery = 'SELECT site_name FROM scada.inventory WHERE dev_eui = $1 LIMIT 1';
        const pgRes = await pool.query(pgQuery, [devEUI.trim()]);
        siteName = pgRes.rows[0]?.site_name || 'Unknown Site';

        const queryApi = influxDB.getQueryApi(org);

        // 5. Filtro dinámico: Ignition usa tag 'pozo', Chirpstack usa tag 'devEui'
        const safeSiteName = siteName.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r]/g, '');
        const tagFilter = isIgnition
            ? `r["pozo"] == "${safeSiteName}"`
            : `r["devEui"] == "${devEUI}"`;

        const rangeClause = stop
            ? `start: ${range}, stop: ${stop}`
            : `start: ${range}`;

        const fluxQuery = `
            from(bucket: "${activeBucket}")
                |> range(${rangeClause})
                |> filter(fn: (r) => r["_measurement"] == "${activeMeasurement}")
                |> filter(fn: (r) => ${tagFilter})
                |> filter(fn: (r) => r["_field"] == "${influxField}")
                |> group()
                |> aggregateWindow(every: ${every}, fn: mean, createEmpty: false)
                |> yield(name: "mean")
        `;

        const data: TimeSeriesData[] = [];

        // Ejecutamos la consulta InfluxDB
        await new Promise<void>((resolve, reject) => {
            queryApi.queryRows(fluxQuery, {
                next: (row: string[], tableMeta: FluxTableMetaData) => {
                    const o = tableMeta.toObject(row);
                    data.push({
                        timestamp: o._time,
                        value: o._value,
                        unit: o.unit || '',
                    });
                },
                error: (error: Error) => {
                    console.error('🛑 InfluxDB Query Error:', error);
                    reject(error);
                },
                complete: () => {
                    resolve();
                },
            });
        });

        return {
            siteName: siteName,
            devEui: devEUI,
            measurement: measurementField,
            data: data,
        };

    } catch (error) {
        const errorMessage = (error instanceof Error) ? error.message : 'An unknown error occurred.';
        console.error('❌ Failed to execute Telemetry Service:', errorMessage);
        return {
            siteName: 'Error',
            devEui: devEUI,
            measurement: measurementField,
            data: []
        };
    }
}
