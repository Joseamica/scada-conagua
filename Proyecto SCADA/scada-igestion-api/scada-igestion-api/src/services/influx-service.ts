// src/services/influx-service.ts (Versión corregida)

import { InfluxDB, Point, WriteApi } from '@influxdata/influxdb-client';
import { ChirpstackUplinkPayload } from '../interfaces/telemetry'; 
import { TelemetryProcessed } from '../interfaces/telemetry';
import 'dotenv/config'; 

// --- Configuración de Conexión ---
const url: string = process.env.INFLUX_URL || '';
const token: string = process.env.INFLUX_TOKEN || '';
const org: string = process.env.INFLUX_ORG || '';
const bucket: string = process.env.INFLUX_BUCKET || '';

const influxDB: InfluxDB = new InfluxDB({ url, token });
const writeApi: WriteApi = influxDB.getWriteApi(org, bucket);
const writeApiIgnition: WriteApi = influxDB.getWriteApi(org, process.env.INFLUX_BUCKET_IGNITION || 'telemetria_ignition'); 

export const writeTelemetryToInflux = async (data: TelemetryProcessed): Promise<void> => {
    try {
        // Usamos directamente las propiedades de 'data' que vienen del transformador
        const point = new Point('mediciones_pozos')
            .tag('devEui', data.devEUI)
            .tag('site', data.site_name)          // Ahora el pozo tiene nombre real
            .tag('municipality', data.municipality) // Filtro por municipio
            .tag('diametro_tuberia', data.diametro_tuberia.toString())

	    // --- FIELDS (Valores numéricos/booleanos) ---
	    // Usamos el operador || 0 para blindar el FloatField
            .floatField('presion_kg', data.presion_kg || 0)
            .floatField('caudal_lts', data.caudal_lts || 0) 
            .floatField('battery', data.battery || 0)
            .floatField('rssi', data.rssi || 0)
            .floatField('snr', data.snr || 0)

	    // --- ESTADOS (Booleanos) ---
            .booleanField('is_cfe_on', !!data.is_cfe_on)
            .booleanField('bomba_activa', !!data.bomba_activa)
            .booleanField('fallo_arrancador', !!data.fallo_arrancador)

            .timestamp(data.timestamp);

        // --- Nivel y lluvia: solo se escriben si existen ---
        if (data.nivel_m != null) {
            point.floatField('nivel_m', data.nivel_m);
        }
        if (data.lluvia_mm != null) {
            point.floatField('lluvia_mm', data.lluvia_mm);
        }

        writeApi.writePoint(point);
        await writeApi.flush();
        console.log(`✅ InfluxDB: Persistencia exitosa para ${data.devEUI}`);
    } catch (error) {
        console.error('❌ InfluxDB Error:', error);
        throw error;
    }
};

// Nuevo bucket para ICH — usa writeApi persistente (igual que ChirpStack)
export const writeGroupedIgnitionToInflux = async (data: any): Promise<void> => {
    try {
        const point = new Point('mediciones_ignition')
            .tag('municipio', data.municipio)
            .tag('pozo', data.pozo_name)
            .tag('calidad', data.tags.calidad);

        // Iteramos sobre todos los campos recolectados en el buffer
        Object.entries(data.fields).forEach(([key, value]) => {
            if (key === 'bomba') {
                point.tag('status_motor', value ? 'Encendido' : 'Apagado');
                point.booleanField('value_bomba', value as boolean);
            } else if (key === 'arrancador') {
                point.stringField('value_arrancador', String(!!value));
            } else if (key === 'senal') {
                const v = value as number;
                point.tag('status_senal', v >= 80 ? 'Excelente' : v >= 25 ? 'Bueno' : 'Malo');
                point.floatField('value_senal', v);
            } else {
                // presión, caudal, totalizado...
                const numVal = Number(value);
                if (!isNaN(numVal)) {
                    point.floatField(`value_${key}`, numVal);
                }
            }
        });

        point.timestamp(new Date());
        writeApiIgnition.writePoint(point);
        await writeApiIgnition.flush();
        console.log(`✅ InfluxDB Ignition: Persistencia exitosa para ${data.pozo_name}`);
    } catch (error) {
        console.error('❌ Error InfluxDB Grouped Write:', error);
        throw error;
    }
};
