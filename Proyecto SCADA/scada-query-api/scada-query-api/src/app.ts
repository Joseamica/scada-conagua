//scada-query-api/src/app.ts
//
import express, { Application, Request, Response } from 'express';
// cors package available if needed for more complex CORS config
import { sendSCADACommand } from './services/control-service';
import { getTelemetryData } from './services/influx-query-service';
import { pool } from './services/db-service';
import authRoutes from './routes/auth-routes';
import userRoutes from './routes/user-routes';
import auditRoutes from './routes/audit-routes';
import entityRoutes from './routes/entity-routes';
import { isAuth, isOperator, isSupervisor } from './middlewares/auth-middleware';

const app: Application = express();

// Trust the first proxy (Nginx) to get real client IP and HTTPS headers
app.set('trust proxy', 1);

// Configuración de CORS
const ALLOWED_ORIGINS = ['https://scada.playtelecom.com', 'https://scada.avoqado.io'];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
        return res.status(200).send('OK');
    }
    next();
});

// Body parser (After CORS)
app.use(express.json());

// Handle malformed JSON gracefully (e.g. bad escape characters in passwords)
app.use((err: any, req: Request, res: Response, next: Function) => {
    if (err.type === 'entity.parse.failed') {
        console.warn(`⚠️ Malformed JSON from ${req.ip}: ${err.message}`);
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    next(err);
});

// Log de requests — NUNCA logea payloads de rutas de auth (contienen passwords/tokens)
app.use((req, res, next) => {
    console.log(`>>> [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST' && process.env.NODE_ENV !== 'production' && !req.url.includes('/auth/')) {
        console.log('>>> PAYLOAD:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Health Check
app.get('/', (req: Request, res: Response): void => {
  res.status(200).json({
    status: 'SCADA API - V2 - SINCRONIZADA', // Cambia este texto
    timestamp: new Date().toISOString()
  });
});

// Validadores de parámetros para evitar inyección Flux
const RE_RELATIVE_RANGE = /^-[0-9]+(m|h|d|w|mo|y)$/;
const RE_RFC3339 = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/;
const RE_INTERVAL = /^[0-9]+(m|h|d)$/;
const RE_DEV_EUI = /^[a-zA-Z0-9_:-]{1,64}$/;
const RE_MEASUREMENT = /^[a-zA-Z0-9_-]{1,64}$/;

// Lógica para obtener el LIVE STATUS de un sitio remoto 
export const getSiteStatus = async (req: Request, res: Response) => {
    const { devEUI } = req.params;
    if (!RE_DEV_EUI.test(devEUI)) {
        return res.status(400).json({ error: 'Invalid devEUI format.' });
    }
    try {
        const sql = `
            SELECT i.site_name, i.municipality, i.site_type, i.latitude, i.longitude,
                   s.last_flow_value, s.last_pressure_value, s.battery_level,
                   s.is_cfe_on, s.last_updated_at, s.rssi, s.snr,
		   s.bomba_activa, s.fallo_arrancador, s.last_total_flow
            FROM scada.inventory i
            LEFT JOIN scada.site_status s ON TRIM(i.dev_eui) = TRIM(s.dev_eui)
            WHERE TRIM(i.dev_eui) = $1
        `;
        const result = await pool.query(sql, [devEUI.trim()]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found in inventory' });
        }
        res.json(result.rows[0]);
    } catch (e) {
        console.error('❌ Database Error:', e);
        res.status(500).json({ error: 'Internal Database Error' });
    }
};

// Ruta para proceso de autentificación y autorización de acceso a sistema SCADA
app.use('/api/v1/auth', authRoutes);

// Ruta para la gestión de usuarios
app.use('/api/v1/users', userRoutes);

// Registra la actividad de un usuario para procesos de auditoría bajo el prefijo /audit
app.use('/api/v1/audit', auditRoutes);

// Ruta para la gestión de entidades organizacionales (árbol jerárquico)
app.use('/api/v1/entities', entityRoutes);

// Ruta de Consulta de Telemetría (GET)
export const getSiteHistory = async (req: Request, res: Response) => {
    const { devEUI, measurement } = req.params;

    // Validación de seguridad: previene Flux injection en devEUI y measurement
    if (!RE_DEV_EUI.test(devEUI)) {
        return res.status(400).json({ error: 'Invalid devEUI format.' });
    }
    if (!RE_MEASUREMENT.test(measurement)) {
        return res.status(400).json({ error: 'Invalid measurement format.' });
    }

    // Rango personalizado (fechas absolutas) o relativo
    const from     = req.query.from as string | undefined;
    const to       = req.query.to   as string | undefined;
    const interval = req.query.interval as string | undefined;
    const range    = req.query.range as string || '-24h';

    // Validación de seguridad: previene Flux injection
    if (from && !RE_RFC3339.test(from)) {
        return res.status(400).json({ error: 'Invalid "from" timestamp format.' });
    }
    if (to && !RE_RFC3339.test(to)) {
        return res.status(400).json({ error: 'Invalid "to" timestamp format.' });
    }
    if (interval && !RE_INTERVAL.test(interval)) {
        return res.status(400).json({ error: 'Invalid interval format.' });
    }
    if (!from && !RE_RELATIVE_RANGE.test(range)) {
        return res.status(400).json({ error: 'Invalid range format.' });
    }

    // Validar que el rango no sea invertido (from debe ser anterior a to)
    if (from && to && new Date(from) >= new Date(to)) {
        return res.status(400).json({ error: '"from" must be earlier than "to".' });
    }

    const rangeStart = from || range;
    const rangeStop  = (from && to) ? to : undefined;

    const everyMap: Record<string, string> = {
        '-15m': '1m',
        '-30m': '2m',
        '-1h':  '5m',
        '-6h':  '15m',
        '-12h': '30m',
        '-24h': '1h',
        '-7d':  '6h',
        '-30d': '1d',
        '-1mo': '1d',
        '-1y':  '7d',
    };
    const every = interval || everyMap[range] || '1h';

    try {
        const data = await getTelemetryData(devEUI, measurement, rangeStart, every, rangeStop);
        res.json(data);
    } catch (e) {
        const errorMessage = (e instanceof Error) ? e.message : 'An unknown error occurred';
        console.error('Error fetching telemetry:', errorMessage);
        res.status(500).json({ error: 'Failed to retrieve telemetry data.' });
    }
};

// Catálogo de todos los sitios con telemetría activa
app.get('/api/v1/sites', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT
                s.dev_eui,
                COALESCE(i.site_name, s.dev_eui) AS site_name,
                i.municipality,
                i.site_type,
                s.last_flow_value,
                s.last_pressure_value,
                s.last_updated_at
            FROM scada.site_status s
            LEFT JOIN scada.inventory i ON TRIM(i.dev_eui) = TRIM(s.dev_eui)
            WHERE s.dev_eui IS NOT NULL AND TRIM(s.dev_eui) != ''
            ORDER BY site_name
        `);
        res.json(result.rows);
    } catch (e) {
        console.error('❌ Sites catalog error:', e);
        res.status(500).json({ error: 'Internal Database Error' });
    }
});

// Definición de rutas (GET) y ruta de Control SCADA (POST)
app.get('/api/v1/status/:devEUI', isAuth, getSiteStatus);
app.get('/api/v1/telemetry/:devEUI/:measurement', isAuth, getSiteHistory);

app.post('/api/v1/control', isOperator, async (req: Request, res: Response) => {
    const { devEUI, command } = req.body;
    
    // Validación de parámetros de entrada conforme a la interfaz SCADAControlRequest
    if (!devEUI || (command !== 'START' && command !== 'STOP')) {
        return res.status(400).json({ error: 'Invalid devEUI or command. Must be START or STOP.' });
    }
    
    const success = await sendSCADACommand(req.body);
    
    if (success) {
        res.status(202).json({ 
            status: 'Command accepted', 
            message: `Control command '${command}' sent to DevEUI ${devEUI}.` 
        });
    } else {
        res.status(500).json({ error: 'Failed to publish MQTT downlink command.' });
    }
});

export default app;
