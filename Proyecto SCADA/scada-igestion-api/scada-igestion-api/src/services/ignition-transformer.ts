// src/services/ignition-transformer.ts
import { IgnitionProcessed } from '../interfaces/telemetry';

export const transformIgnition = (topic: string, rawData: string): IgnitionProcessed => {
    const parts = topic.split('/');
    // Validación de seguridad para el tópico
    const municipio = parts[1] || 'UNKNOWN';
    const pozo_name = parts[3] || 'UNKNOWN';

    const segments = rawData.split(';');
    const variable = segments[0] || 'unknown';
    const rest = segments[1] || ''; 

    const cleanRest = rest.replace('[', '').replace(']', '');
    const dataParts = cleanRest.split(',').map(s => s.trim());
    
    const valorStr = dataParts[0] || '0'; 
    const calidad = dataParts[1] || 'Bad';

    // PARSING DEL TIMESTAMP (La clave del UTC vs CDMX)
    // Buscamos el número largo entre paréntesis: (1770955410203)
    
    // Extracción Segura del Timestamp ---
    const matchTimestamp = rawData.match(/\((\d+)\)/);

    // Usamos un nombre único para el string extraído
    const extractedTs = (matchTimestamp && matchTimestamp[1]) ? matchTimestamp[1] : null;

    // Definimos explícitamente el tipo Date para cumplir con la interfaz
    const eventTime: Date = extractedTs
        ? new Date(parseInt(extractedTs, 10))
        : new Date();

    let valor: number | boolean = parseFloat(valorStr);
    const varLower = variable.toLowerCase();
    if (varLower.includes('bomba') || varLower.includes('arrancador')) {
        valor = valorStr.toLowerCase() === 'true';
    }

    return {
        municipio,
        pozo_name,
        variable: variable.replace(/ /g, '_').toLowerCase(),
        valor,
        unidad: '', // Lógica de unidad simplificada
        calidad,
        timestamp: eventTime
    }
};
