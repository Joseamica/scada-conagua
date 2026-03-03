// src/services/control-service.ts
import * as mqtt from 'mqtt';
import 'dotenv/config';
import { SCADAControlRequest } from '../interfaces/query';

// --- Configuración de Conexión MQTT ---
const MQTT_HOST: string = process.env.MQTT_HOST || '163.192.131.108';
const MQTT_PORT: number = parseInt(process.env.MQTT_PORT || '1883', 10);
const MQTT_URL: string = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;

const mqttClient: mqtt.MqttClient = mqtt.connect(MQTT_URL); 
mqttClient.on('error', (err: Error) => {
    console.error('🛑 MQTT Client Error (Control Service):', err);
});

const APPLICATION_ID: string = '07275113-a6a4-4af8-bd1e-1ca79380a941'; 
const FIXED_FPORT: number = 85; 

/**
 * Retorna el payload binario (Buffer) para el comando D01/D02, codificado a Base64.
 */
function buildSCADAControlPayload(command: 'START' | 'STOP'): string | null {
    let hexPayload: string;
    
    if (command === 'START') {
        hexPayload = '70756C32'; // pul2
    } else if (command === 'STOP') {
        hexPayload = '70756C31'; // pul1
    } else {
        return null;
    }
    
    // Convierte HEX a Base64 requerido por ChirpStack
    const payloadBuffer = Buffer.from(hexPayload, 'hex');
    return payloadBuffer.toString('base64');
}


/**
 * Envía el comando Downlink a través de MQTT a ChirpStack.
 */
export async function sendSCADACommand(request: SCADAControlRequest): Promise<boolean> {
    const { devEUI, command } = request;
    
    const base64Payload = buildSCADAControlPayload(command);
    
    if (!base64Payload) return false;

    const chirpstackPayload = JSON.stringify({
	devEui: devEUI,    
        confirmed: true, 
        fPort: FIXED_FPORT, 
        data: base64Payload,
    });

    const downlinkTopic = `application/${APPLICATION_ID}/device/${devEUI}/command/down`;

    return new Promise((resolve) => {
        mqttClient.publish(downlinkTopic, chirpstackPayload, { qos: 1 }, (err) => {
            if (err) {
                console.error(`❌ Fallo la publicación MQTT Downlink para ${devEUI}:`, err.message);
                resolve(false);
            } else {
                console.log(`✅ Comando SCADA '${command}' enviado a DevEUI ${devEUI} en el tópico: ${downlinkTopic}`);
                resolve(true);
            }
        });
    });
}
