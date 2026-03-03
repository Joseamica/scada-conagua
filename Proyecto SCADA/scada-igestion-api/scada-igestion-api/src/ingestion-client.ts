// src/ingestion-client.ts

import * as mqtt from 'mqtt';
import 'dotenv/config'; 
import { ChirpstackUplinkPayload } from './interfaces/telemetry';
import { writeTelemetryToInflux } from './services/influx-service';
import { getSiteMetadata, updateSiteStatus } from './services/postgres-service'; // Placeholder
import { transformTelemetry } from './services/transformer-service'; // Importamos el transformador
import { transformIgnition } from './services/ignition-transformer'; // Nuevo servicio ICH
import { writeGroupedIgnitionToInflux } from './services/influx-service';
import { updateIgnitionSiteStatus } from './services/postgres-service';

// --- Configuración de Conexión MQTT ---
const MQTT_HOST: string = process.env.MQTT_HOST || 'localhost';
const MQTT_PORT: number = parseInt(process.env.MQTT_PORT || '1883', 10);
// Ajustado al estándar de ChirpStack v4: event/up
const MQTT_TOPIC_TELEMETRY: string = 'application/+/device/+/event/up';
const MQTT_TOPIC_IGNITION: string = 'ignition-conagua-ocavm/#'; // Nuevo tópico ICH
const MQTT_URL: string = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
// Mapa para gestionar los pozos activos en el buffer
const ignitionBuffer = new Map<string, BufferEntry>();
const FLUSH_TIMEOUT = 500; // Milisegundos de espera	

// Estructura para el Buffer
interface BufferEntry {
    municipio: string;
    pozo_name: string;
    fields: Record<string, any>; // Aquí guardaremos presión, caudal, etc.
    tags: Record<string, string>;
    timer: NodeJS.Timeout | null;
}	

// Conexión al Broker Mosquitto: Definición de la variable 'client'
const client: mqtt.MqttClient = mqtt.connect(MQTT_URL); // <-- Definición aquí

const flushBufferToInflux = async (key: string) => {
    const entry = ignitionBuffer.get(key);
    if (!entry) return;

    try {
        // Llamada al servicio
        await writeGroupedIgnitionToInflux({
            municipio: entry.municipio,
            pozo_name: entry.pozo_name,
            fields: entry.fields,
            tags: entry.tags
        });
        // 2. 📊 SALIDA DE LOG ESTILO CHIRPSTACK
        const f = entry.fields; // Alias corto para legibilidad
        
        // Mapeo de estados para emojis
        const bombaStatus = f.bomba === true ? 'ON' : 'OFF';
        const senalVal = f.senal || 0;
        const senalRango = senalVal >= 80 ? 'Excelente' : senalVal >= 25 ? 'Bueno' : 'Malo';

        console.log(`---------------------------------------------------------`);
        // Usamos [IGNITION] para diferenciar el origen rápidamente en OCI
        console.log(`📡 [IGNITION] ${entry.pozo_name} - NEW UPLINK AGGREGATED`);

        // Línea 1: Unidades Físicas (Incluyendo el Odómetro que acabamos de agregar)
        console.log(`📊 Operación: Presión=${f.presion || 0} kg/cm² | Caudal=${f.caudal || 0} lt/s | Total=${f.caudal_totalizado || 0} m³`);

        // Línea 2: Estados lógicos
        // Nota: Ignition no envía CFE/Arrancador en tu muestra, ponemos fallback
        console.log(`⚙️  Estados: Bomba=${bombaStatus} | Calidad Link=${entry.tags.calidad || 'N/A'}`);

        // Línea 3: Salud del Nodo (Basado en el % de señal de Ignition)
        console.log(`🔋 Señal: ${senalVal}% (${senalRango}) | Timestamp: ${new Date().toLocaleTimeString()}`);
        console.log(`---------------------------------------------------------`);

    } catch (err) {
        console.error(`❌ Error al procesar log/escritura de ${entry.pozo_name}:`, err);
    } finally {
        ignitionBuffer.delete(key);
    }
};

client.on('connect', (): void => {
    console.log(`✅ MQTT Client Connected to Broker: ${MQTT_URL}`);
    client.subscribe([MQTT_TOPIC_TELEMETRY, MQTT_TOPIC_IGNITION], (err: Error | null): void => {
        if (!err) {
            console.log(`📡 Subscribed to ChirpStack topic: ${MQTT_TOPIC_TELEMETRY}`);
	    console.log(`📡 Subscribed to Ignition: ${MQTT_TOPIC_IGNITION}`);
        }
    });
});

client.on('message', async (topic: string, message: Buffer): Promise<void> => {
     const rawPayload = message.toString();

    try {
        // --- 1. LÓGICA PARA IGNITION (IXTAPALUCA) ---
        if (topic.startsWith('ignition-conagua-ocavm')) {
    		const processed = transformIgnition(topic, rawPayload);
    		const bufferKey = `${processed.municipio}_${processed.pozo_name}`;

    		// A. Actualizar Postgres de inmediato (Estado actual siempre vivo)
    		await updateIgnitionSiteStatus(processed);

    		// B. Gestión del Buffer para InfluxDB
    		let entry = ignitionBuffer.get(bufferKey);

    		if (!entry) {
        		entry = {
            			municipio: processed.municipio,
            			pozo_name: processed.pozo_name,
            			fields: {},
            			tags: { calidad: processed.calidad },
            			timer: null
        		};
        		ignitionBuffer.set(bufferKey, entry);
    		}

    		// Agregamos la variable al "combo"
    		entry.fields[processed.variable] = processed.valor;

    		// Si ya existe un timer, lo reiniciamos (Debounce)
    		if (entry.timer) clearTimeout(entry.timer);

    		entry.timer = setTimeout(async () => {
        		// Ejecutamos la escritura agrupada
        		await flushBufferToInflux(bufferKey);
    		}, FLUSH_TIMEOUT);
	}
        
        // --- 2. LÓGICA PARA CHIRPSTACK (CÓDIGO ORIGINAL INTACTO) ---
        else if (topic.includes('event/up')) {
            const payload: ChirpstackUplinkPayload = JSON.parse(rawPayload);
            const devEUI: string = payload.deviceInfo.devEui;

            if (devEUI && payload.object) {
                // 1. PASO CRÍTICO: Obtener Metadata
                const metadata = await getSiteMetadata(devEUI);

                // 2. TRANSFORMACIÓN
                const processedData = transformTelemetry(payload, metadata);

                if (processedData) {
                    // LOG DETALLADO ORIGINAL
                    console.log(`---------------------------------------------------------`);
                    console.log(`📡 [${processedData.devEUI}] ${processedData.site_name || 'SITIO UNKNOWN'} - NEW UPLINK`);
                    console.log(`📊 Operación: Presión=${processedData.presion_kg} kg/cm² | Caudal=${processedData.caudal_lts} lt/s`);
                    console.log(`⚙️  Estados: CFE=${processedData.is_cfe_on ? 'ON' : 'OFF'} | Bomba=${processedData.bomba_activa ? 'ON' : 'OFF'} | Arrancador=${processedData.fallo_arrancador ? '⚠️ FALLA' : 'OK'}`);
                    console.log(`🔋 Carga: Batería=${processedData.battery}% | RSSI=${processedData.rssi}dBm | SNR=${processedData.snr}dB`);
                    console.log(`---------------------------------------------------------`);

                    // 3. INGESTA A INFLUXDB (Bucket Original)
                    await writeTelemetryToInflux(processedData);

                    // 4. ACTUALIZACIÓN EN POSTGRESQL (Estado actual/Last Value)
                    await updateSiteStatus(devEUI, processedData);
                } else {
                    console.log(`ℹ️ [${devEUI}] Heartbeat frame ignorado.`);
                }
            }
        }
    } catch (e) {
        console.error(`❌ Error procesando mensaje en tópico ${topic}:`, e);
    }
});

client.on('error', (err: Error): void => {
    console.error('🛑 Error de Conexión MQTT:', err);
});

export { client };

/**
 * 🛡️ MECANISMO DE CIERRE GRÁCIL (Graceful Shutdown)
 * Garantiza que no se pierdan datos en el buffer al reiniciar el contenedor.
 */
const gracefulShutdown = async (signal: string) => {
    console.log(`\n⚠️ [${signal}] Signal received. Starting graceful shutdown...`);

    // 1. Dejar de recibir mensajes nuevos
    client.end();
    console.log('🛑 MQTT Client disconnected.');

    // 2. Vaciado de emergencia del Buffer
    if (ignitionBuffer.size > 0) {
        console.log(`📦 Emergency flush: Processing ${ignitionBuffer.size} pending sites...`);

        const flushPromises = Array.from(ignitionBuffer.keys()).map(async (key) => {
            const entry = ignitionBuffer.get(key);
            if (entry && entry.timer) {
                clearTimeout(entry.timer); // Cancelamos el timer programado
            }
            return flushBufferToInflux(key); // Ejecutamos la escritura inmediata
        });

        await Promise.all(flushPromises);
        console.log('✅ All pending data has been saved to InfluxDB/Postgres.');
    } else {
        console.log('✅ Buffer was empty. No data loss risk.');
    }

    console.log('👋 SCADA Ingestion service stopped safely.');
    process.exit(0);
};

// Escuchamos las señales de terminación de Docker/OS
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
