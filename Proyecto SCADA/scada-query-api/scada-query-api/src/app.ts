//scada-query-api/src/app.ts
//
import express, { Application, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// cors package available if needed for more complex CORS config
import { sendSCADACommand } from './services/control-service';
import { getTelemetryData } from './services/influx-query-service';
import { pool } from './services/db-service';
import authRoutes from './routes/auth-routes';
import userRoutes from './routes/user-routes';
import auditRoutes from './routes/audit-routes';
import entityRoutes from './routes/entity-routes';
import { isAuth } from './middlewares/auth-middleware';
import { auditLog } from './services/audit-service';
import { getPermissions } from './services/permission-service';
import gisRoutes from './routes/gis-routes';
import sinopticoRoutes from './routes/sinoptico-routes';
import variableRoutes from './routes/variable-routes';
import alarmRoutes from './routes/alarm-routes';

// --- Render uploads config ---
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads', 'renders');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const renderStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const devEUI = (req.params.devEUI || 'unknown').trim();
        cb(null, `${devEUI}${ext}`);
    },
});

const upload = multer({
    storage: renderStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes PNG, JPG o WEBP.'));
        }
    },
});

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

// Serve uploaded render images as static files
app.use('/api/v1/uploads/renders', express.static(UPLOADS_DIR));

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
                   i.municipio_id,
                   s.last_flow_value, s.last_pressure_value, s.battery_level,
                   s.is_cfe_on, s.last_updated_at, s.rssi, s.snr,
		   s.bomba_activa, s.fallo_arrancador, s.last_total_flow,
		   s.last_nivel_value, s.last_lluvia_value
            FROM scada.inventory i
            LEFT JOIN scada.site_status s ON TRIM(i.dev_eui) = TRIM(s.dev_eui)
            WHERE TRIM(i.dev_eui) = $1
        `;
        const result = await pool.query(sql, [devEUI.trim()]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Device not found in inventory' });
        }

        const row = result.rows[0];
        const user = (req as any).user;
        if (row.municipio_id && user?.scope === 'Municipal' && user?.scope_id) {
            if (row.municipio_id !== user.scope_id) {
                return res.status(403).json({ error: 'Sin acceso a este sitio.' });
            }
        }

        res.json(row);
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

// Ruta para gestión de capas GIS (GeoServer)
app.use('/api/v1/gis', gisRoutes);

// Sinopticos: proyectos, canvas, compartir, actividad
app.use('/api/v1/sinopticos', sinopticoRoutes);

// Variables: tag browser, vistas, columnas, formulas, ejecucion
app.use('/api/v1/variables', variableRoutes);

// Alarmas: grupos, reglas, ACK, historial, destinatarios
app.use('/api/v1/alarms', alarmRoutes);

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

    // Scope check: municipal users can only query their own sites
    const user = (req as any).user;
    if (user?.scope === 'Municipal' && user?.scope_id) {
        const scopeCheck = await pool.query(
            'SELECT municipio_id FROM scada.inventory WHERE TRIM(dev_eui) = $1', [devEUI.trim()]
        );
        if (scopeCheck.rows.length > 0) {
            const siteMunId = scopeCheck.rows[0].municipio_id;
            if (siteMunId && siteMunId !== user.scope_id) {
                return res.status(403).json({ error: 'Sin acceso a telemetria de este sitio.' });
            }
        }
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
        const user = (req as any).user;
        let scopeFilter = '';
        const params: any[] = [];

        // Municipal users only see their municipality's sites (integer comparison)
        if (user?.scope === 'Municipal' && user?.scope_id) {
            scopeFilter = 'AND (i.municipio_id = $1 OR i.municipio_id IS NULL)';
            params.push(user.scope_id);
        } else if (user?.scope === 'Estatal' && user?.estado_id) {
            scopeFilter = `AND (i.municipio_id IN (
                SELECT e.municipio_id FROM scada.entities e WHERE e.estado_id = $1 AND e.level = 'Municipal'
            ) OR i.municipio_id IS NULL)`;
            params.push(user.estado_id);
        }

        const result = await pool.query(`
            SELECT
                COALESCE(TRIM(i.dev_eui), TRIM(s.dev_eui)) AS dev_eui,
                COALESCE(i.site_name, s.dev_eui, i.dev_eui) AS site_name,
                i.municipality,
                i.site_type,
                s.last_flow_value,
                s.last_pressure_value,
                s.last_updated_at,
                s.rssi,
                s.snr,
                i.latitude,
                i.longitude,
                i.proveedor,
                i.estatus,
                i.render_url,
                s.last_nivel_value,
                s.last_lluvia_value,
                i.municipio_id
            FROM scada.inventory i
            LEFT JOIN scada.site_status s ON TRIM(s.dev_eui) = TRIM(i.dev_eui)
            WHERE TRIM(COALESCE(i.dev_eui, '')) != ''
            ${scopeFilter}
            ORDER BY site_name
        `, params);
        res.json(result.rows);
    } catch (e) {
        console.error('❌ Sites catalog error:', e);
        res.status(500).json({ error: 'Internal Database Error' });
    }
});

// Crear un nuevo sitio en el inventario
app.post('/api/v1/sites', isAuth, async (req: Request, res: Response) => {
    const { dev_eui, gw_eui, site_name, site_type, municipality, latitude, longitude, proveedor, estatus, utr_id } = req.body;

    if (!site_name || !dev_eui || !municipality) {
        return res.status(400).json({ error: 'site_name, dev_eui y municipality son obligatorios.' });
    }

    // dev_eui max 16 chars (char(16) column)
    if (dev_eui.length > 16) {
        return res.status(400).json({ error: 'dev_eui no puede exceder 16 caracteres.' });
    }

    try {
        // Check duplicate dev_eui
        const existing = await pool.query(
            'SELECT dev_eui FROM scada.inventory WHERE TRIM(dev_eui) = $1',
            [dev_eui.trim()]
        );
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Ya existe un sitio con ese DevEUI.' });
        }

        // gw_eui is NOT NULL + UNIQUE — use provided value or generate placeholder
        const effectiveGwEui = gw_eui?.trim() || `GW-${dev_eui.trim()}`.substring(0, 16);

        // Resolve municipio_id from municipality text (or use explicit value from frontend)
        let resolvedMunicipioId = req.body.municipio_id || null;
        if (!resolvedMunicipioId && municipality) {
            const munLookup = await pool.query(
                "SELECT municipio_id FROM scada.entities WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND level = 'Municipal'",
                [municipality.trim()]
            );
            resolvedMunicipioId = munLookup.rows[0]?.municipio_id || null;
        }

        const result = await pool.query(
            `INSERT INTO scada.inventory (dev_eui, gw_eui, site_name, site_type, municipality, latitude, longitude, proveedor, estatus, municipio_id, utr_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING dev_eui`,
            [
                dev_eui.trim(),
                effectiveGwEui,
                site_name.trim(),
                site_type || null,
                municipality.trim(),
                latitude || null,
                longitude || null,
                proveedor || null,
                estatus || 'activo',
                resolvedMunicipioId,
                utr_id?.trim() || null,
            ]
        );

        await auditLog(req.user!.id, 'SITE_CREATED', { dev_eui, site_name, municipality }, req.ip!);

        res.status(201).json({
            dev_eui: result.rows[0].dev_eui.trim(),
            message: 'Sitio creado correctamente.',
        });
    } catch (e: any) {
        // Handle unique constraint on gw_eui
        if (e.code === '23505') {
            return res.status(409).json({ error: 'Conflicto: DevEUI o Gateway ID duplicado.' });
        }
        console.error('❌ Error creating site:', e);
        res.status(500).json({ error: 'Error interno al crear el sitio.' });
    }
});

// Obtener un sitio individual por devEUI
app.get('/api/v1/sites/:devEUI', isAuth, async (req: Request, res: Response) => {
    const { devEUI } = req.params;
    if (!RE_DEV_EUI.test(devEUI)) {
        return res.status(400).json({ error: 'Invalid devEUI format.' });
    }
    try {
        const result = await pool.query(
            `SELECT dev_eui, gw_eui, site_name, site_type, municipality, latitude, longitude, is_active, proveedor, estatus, render_url, municipio_id, utr_id
             FROM scada.inventory WHERE TRIM(dev_eui) = $1`,
            [devEUI.trim()]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sitio no encontrado.' });
        }
        const row = result.rows[0];

        const user = (req as any).user;
        if (row.municipio_id && user?.scope === 'Municipal' && user?.scope_id) {
            if (row.municipio_id !== user.scope_id) {
                return res.status(403).json({ error: 'Sin acceso a este sitio.' });
            }
        }

        res.json({
            dev_eui: (row.dev_eui || '').trim(),
            gw_eui: (row.gw_eui || '').trim(),
            site_name: (row.site_name || '').trim(),
            site_type: row.site_type,
            municipality: (row.municipality || '').trim(),
            latitude: row.latitude ? Number(row.latitude) : null,
            longitude: row.longitude ? Number(row.longitude) : null,
            is_active: row.is_active,
            proveedor: row.proveedor || null,
            estatus: row.estatus || 'activo',
            render_url: row.render_url || null,
            municipio_id: row.municipio_id || null,
            utr_id: row.utr_id || null,
        });
    } catch (e) {
        console.error('❌ Error fetching site:', e);
        res.status(500).json({ error: 'Error interno.' });
    }
});

// Actualizar un sitio existente
app.put('/api/v1/sites/:devEUI', isAuth, async (req: Request, res: Response) => {
    const { devEUI } = req.params;
    if (!RE_DEV_EUI.test(devEUI)) {
        return res.status(400).json({ error: 'Invalid devEUI format.' });
    }

    const { site_name, site_type, municipality, latitude, longitude, gw_eui, proveedor, estatus, new_dev_eui, utr_id } = req.body;
    if (!site_name || !municipality) {
        return res.status(400).json({ error: 'site_name y municipality son obligatorios.' });
    }

    // Validate new_dev_eui format if provided
    if (new_dev_eui && !RE_DEV_EUI.test(new_dev_eui)) {
        return res.status(400).json({ error: 'Formato de nuevo DevEUI invalido.' });
    }

    try {
        const existing = await pool.query(
            'SELECT dev_eui, municipio_id FROM scada.inventory WHERE TRIM(dev_eui) = $1',
            [devEUI.trim()]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Sitio no encontrado.' });
        }

        // Scope check: municipal users can only edit their own sites
        const user = (req as any).user;
        const existingMunId = existing.rows[0].municipio_id;
        if (existingMunId && user?.scope === 'Municipal' && user?.scope_id) {
            if (existingMunId !== user.scope_id) {
                return res.status(403).json({ error: 'Sin acceso a este sitio.' });
            }
        }

        // If changing devEUI, check the new one doesn't already exist
        if (new_dev_eui && new_dev_eui.trim().toLowerCase() !== devEUI.trim().toLowerCase()) {
            const conflict = await pool.query(
                'SELECT dev_eui FROM scada.inventory WHERE TRIM(dev_eui) = $1',
                [new_dev_eui.trim()]
            );
            if (conflict.rows.length > 0) {
                return res.status(409).json({ error: 'Ya existe un sitio con ese DevEUI.' });
            }
        }

        const setClauses: string[] = [];
        const values: any[] = [];

        setClauses.push(`site_name = $${values.length + 1}`);
        values.push(site_name.trim());

        setClauses.push(`site_type = $${values.length + 1}`);
        values.push(site_type || null);

        setClauses.push(`municipality = $${values.length + 1}`);
        values.push(municipality.trim());

        setClauses.push(`latitude = $${values.length + 1}`);
        values.push(latitude || null);

        setClauses.push(`longitude = $${values.length + 1}`);
        values.push(longitude || null);

        if (gw_eui) {
            setClauses.push(`gw_eui = $${values.length + 1}`);
            values.push(gw_eui.trim().substring(0, 16));
        }

        setClauses.push(`proveedor = $${values.length + 1}`);
        values.push(proveedor || null);

        setClauses.push(`estatus = $${values.length + 1}`);
        values.push(estatus || 'activo');

        setClauses.push(`utr_id = $${values.length + 1}`);
        values.push(utr_id?.trim() || null);

        // Resolve municipio_id from municipality text
        const munLookup = await pool.query(
            "SELECT municipio_id FROM scada.entities WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND level = 'Municipal'",
            [municipality.trim()]
        );
        setClauses.push(`municipio_id = $${values.length + 1}`);
        values.push(munLookup.rows[0]?.municipio_id || null);

        // Update dev_eui itself if a new one was provided
        const effectiveNewEui = (new_dev_eui && new_dev_eui.trim().toLowerCase() !== devEUI.trim().toLowerCase())
            ? new_dev_eui.trim()
            : null;
        if (effectiveNewEui) {
            setClauses.push(`dev_eui = $${values.length + 1}`);
            values.push(effectiveNewEui.substring(0, 16));
        }

        values.push(devEUI.trim());
        await pool.query(
            `UPDATE scada.inventory SET ${setClauses.join(', ')} WHERE TRIM(dev_eui) = $${values.length}`,
            values
        );

        // Cascade: update site_status dev_eui if it changed
        if (effectiveNewEui) {
            await pool.query(
                'UPDATE scada.site_status SET dev_eui = $1 WHERE TRIM(dev_eui) = $2',
                [effectiveNewEui.substring(0, 16), devEUI.trim()]
            );
        }

        await auditLog(req.user!.id, 'SITE_UPDATED', {
            dev_eui: devEUI,
            ...(effectiveNewEui ? { new_dev_eui: effectiveNewEui } : {}),
            site_name, municipality
        }, req.ip!);

        res.json({ message: 'Sitio actualizado correctamente.' });
    } catch (e: any) {
        if (e.code === '23505') {
            return res.status(409).json({ error: 'Conflicto: Gateway ID duplicado.' });
        }
        console.error('❌ Error updating site:', e);
        res.status(500).json({ error: 'Error interno al actualizar el sitio.' });
    }
});

// Eliminar un sitio del inventario (y su site_status)
app.delete('/api/v1/sites/:devEUI', isAuth, async (req: Request, res: Response) => {
    const { devEUI } = req.params;
    if (!RE_DEV_EUI.test(devEUI)) {
        return res.status(400).json({ error: 'Invalid devEUI format.' });
    }

    try {
        const existing = await pool.query(
            'SELECT dev_eui, site_name, municipio_id FROM scada.inventory WHERE TRIM(dev_eui) = $1',
            [devEUI.trim()]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Sitio no encontrado.' });
        }

        // Scope check: municipal users can only delete their own sites
        const user = (req as any).user;
        const delMunId = existing.rows[0].municipio_id;
        if (delMunId && user?.scope === 'Municipal' && user?.scope_id) {
            if (delMunId !== user.scope_id) {
                return res.status(403).json({ error: 'Sin acceso a este sitio.' });
            }
        }

        const siteName = existing.rows[0].site_name;

        // Delete site_status first (FK-safe order)
        await pool.query('DELETE FROM scada.site_status WHERE TRIM(dev_eui) = $1', [devEUI.trim()]);
        await pool.query('DELETE FROM scada.inventory WHERE TRIM(dev_eui) = $1', [devEUI.trim()]);

        // Clean up render file if exists
        const renderPath = path.join(UPLOADS_DIR, `${devEUI.trim()}.png`);
        for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
            const p = path.join(UPLOADS_DIR, `${devEUI.trim()}${ext}`);
            if (fs.existsSync(p)) fs.unlinkSync(p);
        }

        await auditLog(req.user!.id, 'SITE_DELETED', { dev_eui: devEUI, site_name: siteName }, req.ip!);

        res.json({ message: `Sitio '${siteName}' eliminado correctamente.` });
    } catch (e) {
        console.error('❌ Error deleting site:', e);
        res.status(500).json({ error: 'Error interno al eliminar el sitio.' });
    }
});

// Subir imagen de render para un sitio
app.post('/api/v1/sites/:devEUI/render', isAuth, (req: Request, res: Response, next: Function) => {
    upload.single('render')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'La imagen no puede exceder 10 MB.' });
            }
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
}, async (req: Request, res: Response) => {
    const { devEUI } = req.params;
    if (!RE_DEV_EUI.test(devEUI)) {
        return res.status(400).json({ error: 'Invalid devEUI format.' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'No se envió ningún archivo.' });
    }

    try {
        // Check that site exists
        const existing = await pool.query(
            'SELECT dev_eui, render_url FROM scada.inventory WHERE TRIM(dev_eui) = $1',
            [devEUI.trim()]
        );
        if (existing.rows.length === 0) {
            // Clean up uploaded file
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Sitio no encontrado.' });
        }

        // Delete old render file if extension changed
        const oldUrl = existing.rows[0].render_url;
        if (oldUrl) {
            const oldFilename = path.basename(oldUrl);
            const oldPath = path.join(UPLOADS_DIR, oldFilename);
            if (oldPath !== req.file.path && fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        const renderUrl = `/api/v1/uploads/renders/${req.file.filename}`;
        await pool.query(
            'UPDATE scada.inventory SET render_url = $1 WHERE TRIM(dev_eui) = $2',
            [renderUrl, devEUI.trim()]
        );

        await auditLog(req.user!.id, 'SITE_RENDER_UPLOADED', { dev_eui: devEUI, render_url: renderUrl }, req.ip!);

        res.json({ render_url: renderUrl, message: 'Render subido correctamente.' });
    } catch (e) {
        console.error('❌ Error uploading render:', e);
        res.status(500).json({ error: 'Error interno al subir el render.' });
    }
});

// Definición de rutas (GET) y ruta de Control SCADA (POST)
app.get('/api/v1/status/:devEUI', isAuth, getSiteStatus);
app.get('/api/v1/telemetry/:devEUI/:measurement', isAuth, getSiteHistory);

// Telemetría agregada por municipio — suma todos los pozos activos
app.get('/api/v1/telemetry/municipality/:municipioId/:measurement', isAuth, async (req: Request, res: Response) => {
    const { municipioId, measurement } = req.params;
    if (!RE_MEASUREMENT.test(measurement)) {
        return res.status(400).json({ error: 'Invalid measurement format.' });
    }
    const munId = parseInt(municipioId, 10);
    if (isNaN(munId) || munId <= 0) {
        return res.status(400).json({ error: 'Invalid municipioId.' });
    }

    const from     = req.query.from as string | undefined;
    const to       = req.query.to   as string | undefined;
    const interval = req.query.interval as string | undefined;
    const range    = req.query.range as string || '-24h';

    if (from && !RE_RFC3339.test(from)) return res.status(400).json({ error: 'Invalid "from" format.' });
    if (to && !RE_RFC3339.test(to)) return res.status(400).json({ error: 'Invalid "to" format.' });
    if (interval && !RE_INTERVAL.test(interval)) return res.status(400).json({ error: 'Invalid interval format.' });
    if (!from && !RE_RELATIVE_RANGE.test(range)) return res.status(400).json({ error: 'Invalid range format.' });

    const rangeStart = from || range;
    const rangeStop  = (from && to) ? to : undefined;
    const everyMap: Record<string, string> = {
        '-15m': '1m', '-30m': '2m', '-1h': '5m', '-6h': '15m',
        '-12h': '30m', '-24h': '1h', '-7d': '6h', '-30d': '1d', '-1mo': '1d', '-1y': '7d',
    };
    const every = interval || everyMap[range] || '1h';

    try {
        // Get all active devEUIs for this municipality
        const sitesRes = await pool.query(
            `SELECT TRIM(dev_eui) as dev_eui FROM scada.inventory
             WHERE municipio_id = $1 AND TRIM(COALESCE(dev_eui, '')) != ''
               AND (estatus IS NULL OR estatus NOT IN ('inactivo', 'pendiente'))`,
            [munId]
        );
        const devEUIs = sitesRes.rows.map(r => r.dev_eui.trim()).filter(d => d && !d.startsWith('pend'));

        if (devEUIs.length === 0) {
            return res.json({ municipioId: munId, measurement, data: [], devEuiCount: 0 });
        }

        // Query each devEUI individually and merge/sum by timestamp bucket
        const rangeClause = rangeStop ? `start: ${rangeStart}, stop: ${rangeStop}` : `start: ${rangeStart}`;
        const { getTelemetryData } = require('./services/influx-query-service');

        // Run queries in parallel (max 10 concurrent to avoid overwhelming InfluxDB)
        const batchSize = 10;
        const allSeries: { timestamp: string; value: number }[][] = [];

        for (let i = 0; i < devEUIs.length; i += batchSize) {
            const batch = devEUIs.slice(i, i + batchSize);
            const results = await Promise.all(
                batch.map(devEui => getTelemetryData(devEui, measurement, rangeStart, every, rangeStop))
            );
            results.forEach((r: any) => {
                if (r.data && r.data.length > 0) {
                    allSeries.push(r.data.map((p: any) => ({ timestamp: p.timestamp, value: p.value ?? 0 })));
                }
            });
        }

        // Merge: sum values by timestamp bucket
        const sumMap = new Map<string, number>();
        for (const series of allSeries) {
            for (const point of series) {
                const prev = sumMap.get(point.timestamp) || 0;
                sumMap.set(point.timestamp, prev + (point.value > 0.01 ? point.value : 0));
            }
        }

        const data = Array.from(sumMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([timestamp, value]) => ({ timestamp, value: Math.round(value * 100) / 100 }));

        res.json({ municipioId: munId, measurement, data, devEuiCount: devEUIs.length });
    } catch (e) {
        console.error('❌ Municipality telemetry error:', e);
        res.status(500).json({ error: 'Error al consultar telemetría del municipio.' });
    }
});

app.post('/api/v1/control', isAuth, async (req: Request, res: Response) => {
    const { devEUI, command } = req.body;

    // Input validation first (400 before 403)
    if (!devEUI || (command !== 'START' && command !== 'STOP')) {
        return res.status(400).json({ error: 'Invalid devEUI or command. Must be START or STOP.' });
    }

    const user = (req as any).user;

    // Role check: only Admin (1) and Supervisor (2) can control pumps (CONAGUA confirmed)
    if (!user || user.role_id > 2) {
        return res.status(403).json({ error: 'Solo Administradores y Supervisores pueden controlar bombas.' });
    }

    // Scope check: Federal users cannot control pumps (oversight only, per CONAGUA case 5.2)
    if (user.scope === 'Federal') {
        return res.status(403).json({ error: 'Usuarios federales no pueden controlar bombas (solo supervisión).' });
    }

    // Scope check: municipal users can only control pumps in their municipality
    if (user.scope === 'Municipal' && user.scope_id) {
        const siteCheck = await pool.query(
            'SELECT municipio_id FROM scada.inventory WHERE TRIM(dev_eui) = $1', [devEUI.trim()]
        );
        if (siteCheck.rows.length > 0 && siteCheck.rows[0].municipio_id) {
            if (siteCheck.rows[0].municipio_id !== user.scope_id) {
                return res.status(403).json({ error: 'Sin acceso a este sitio.' });
            }
        }
    }

    // Permission check: user must have can_operate flag
    const perms = await getPermissions(req.user!.id);
    if (!perms?.can_operate) {
        return res.status(403).json({ error: 'No tiene permiso para operar bombas.' });
    }

    const success = await sendSCADACommand(req.body);

    if (success) {
        await auditLog(req.user!.id, 'PUMP_COMMAND_SENT', { devEUI, command }, req.ip!);
        res.status(202).json({
            status: 'Command accepted',
            message: `Control command '${command}' sent to DevEUI ${devEUI}.`
        });
    } else {
        await auditLog(req.user!.id, 'PUMP_COMMAND_FAILED', { devEUI, command }, req.ip!);
        res.status(500).json({ error: 'Failed to publish MQTT downlink command.' });
    }
});

export default app;
