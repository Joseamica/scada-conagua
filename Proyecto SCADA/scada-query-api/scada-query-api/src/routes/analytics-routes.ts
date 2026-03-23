// src/routes/analytics-routes.ts — Analytics endpoints (trends, anomalies, predictions)
import { Router, Request, Response } from 'express';
import { isAuth } from '../middlewares/auth-middleware';
import { getTelemetryData } from '../services/influx-query-service';
import { pool } from '../services/db-service';
import {
    linearRegression,
    detectAnomalies,
    exponentialSmoothing,
    cleanSpikes,
    computeStats,
    movingAverage,
    DataPoint,
} from '../services/analytics-service';
import { neuralPredict } from '../services/neural-network-service';

const router = Router();

// Helper: verify user has access to devEUI (scope check)
async function checkDevEUIScope(devEUI: string, user: any): Promise<boolean> {
    if (user.role_id === 1) return true; // admin sees all
    if (user.scope !== 'Municipal' || !user.scope_id) return true; // non-municipal sees all

    const result = await pool.query(
        'SELECT municipio_id FROM scada.inventory WHERE TRIM(dev_eui) = $1',
        [devEUI.trim()]
    );
    if (result.rows.length === 0) return true; // unknown devEUI — fail-open
    const siteMunId = result.rows[0].municipio_id;
    return !siteMunId || siteMunId === user.scope_id; // null = fail-open
}

// Helper: extract data points from telemetry response
function toDataPoints(data: { timestamp: string; value: number }[]): DataPoint[] {
    return data.filter(d => d.value != null && !isNaN(d.value)).map(d => ({
        timestamp: d.timestamp,
        value: Number(d.value),
    }));
}

// Helper: get aggregation interval based on range
function intervalForRange(range: string): string {
    if (range.includes('1y') || range.includes('365d')) return '1d';
    if (range.includes('30d') || range.includes('1mo')) return '6h';
    if (range.includes('7d')) return '1h';
    if (range.includes('24h') || range.includes('1d')) return '15m';
    return '5m';
}

// GET /trend/:devEUI/:measurement — Linear regression trend
router.get('/trend/:devEUI/:measurement', isAuth, async (req: Request, res: Response) => {
    try {
        const { devEUI, measurement } = req.params;
        if (!(await checkDevEUIScope(devEUI, req.user!))) {
            return res.status(403).json({ error: 'Sin acceso a este sitio.' });
        }
        const range = (req.query.range as string) || '-7d';
        const every = intervalForRange(range);

        const telemetry = await getTelemetryData(devEUI, measurement, range, every);
        const points = toDataPoints(telemetry.data);

        if (points.length < 5) {
            return res.json({ error: 'Datos insuficientes para calcular tendencia.', points: points.length });
        }

        const trend = linearRegression(points);
        const stats = computeStats(points.map(p => p.value));
        const ma = movingAverage(points, 12);

        res.json({
            site: telemetry.siteName,
            devEUI,
            measurement,
            range,
            dataPoints: points.length,
            trend,
            stats,
            movingAverage: ma,
            data: points,
        });
    } catch (e: any) {
        console.error('[Analytics] Trend error:', e.message);
        res.status(500).json({ error: 'Error al calcular tendencia.' });
    }
});

// GET /anomalies/:devEUI/:measurement — Anomaly detection
router.get('/anomalies/:devEUI/:measurement', isAuth, async (req: Request, res: Response) => {
    try {
        const { devEUI, measurement } = req.params;
        if (!(await checkDevEUIScope(devEUI, req.user!))) {
            return res.status(403).json({ error: 'Sin acceso a este sitio.' });
        }
        const range = (req.query.range as string) || '-7d';
        const threshold = Number(req.query.threshold) || 2.5;
        const every = intervalForRange(range);

        const telemetry = await getTelemetryData(devEUI, measurement, range, every);
        const points = toDataPoints(telemetry.data);
        const anomalies = detectAnomalies(points, threshold);
        const stats = computeStats(points.map(p => p.value));

        res.json({
            site: telemetry.siteName,
            devEUI,
            measurement,
            range,
            threshold,
            dataPoints: points.length,
            anomalyCount: anomalies.length,
            anomalies,
            stats,
            data: points,
        });
    } catch (e: any) {
        console.error('[Analytics] Anomaly error:', e.message);
        res.status(500).json({ error: 'Error al detectar anomalías.' });
    }
});

// GET /prediction/:devEUI/:measurement — Exponential smoothing prediction
router.get('/prediction/:devEUI/:measurement', isAuth, async (req: Request, res: Response) => {
    try {
        const { devEUI, measurement } = req.params;
        if (!(await checkDevEUIScope(devEUI, req.user!))) {
            return res.status(403).json({ error: 'Sin acceso a este sitio.' });
        }
        const range = (req.query.range as string) || '-7d';
        const periods = Math.min(Number(req.query.periods) || 288, 8640); // max 30 days of 5-min data
        const alpha = Number(req.query.alpha) || 0.3;
        const every = intervalForRange(range);

        const telemetry = await getTelemetryData(devEUI, measurement, range, every);
        const points = toDataPoints(telemetry.data);
        const prediction = exponentialSmoothing(points, alpha, periods);

        res.json({
            site: telemetry.siteName,
            devEUI,
            measurement,
            range,
            periods,
            ...prediction,
        });
    } catch (e: any) {
        console.error('[Analytics] Prediction error:', e.message);
        res.status(500).json({ error: 'Error al generar predicción.' });
    }
});

// GET /prediction/neural/:devEUI/:measurement — Neural network (MLP) prediction
router.get('/prediction/neural/:devEUI/:measurement', isAuth, async (req: Request, res: Response) => {
    try {
        const { devEUI, measurement } = req.params;
        if (!(await checkDevEUIScope(devEUI, req.user!))) {
            return res.status(403).json({ error: 'Sin acceso a este sitio.' });
        }
        const range = (req.query.range as string) || '-7d';
        const periods = Math.min(Number(req.query.periods) || 48, 720); // max 30 days of hourly data
        const windowSize = Math.min(Number(req.query.windowSize) || 12, 24);
        const epochs = Math.min(Number(req.query.epochs) || 50, 100);
        const every = intervalForRange(range);

        const telemetry = await getTelemetryData(devEUI, measurement, range, every);
        const points = toDataPoints(telemetry.data);

        if (points.length < windowSize + 10) {
            return res.json({ error: `Datos insuficientes: ${points.length} puntos (necesita ${windowSize + 10}+)` });
        }

        const result = await neuralPredict(points, windowSize, periods, epochs);

        res.json({
            site: telemetry.siteName,
            devEUI,
            measurement,
            range,
            ...result,
        });
    } catch (e: any) {
        console.error('[Analytics] Neural prediction error:', e.message);
        res.status(500).json({ error: 'Error al generar predicción neural: ' + e.message });
    }
});

// GET /clean/:devEUI/:measurement — Data cleaning (spike removal)
router.get('/clean/:devEUI/:measurement', isAuth, async (req: Request, res: Response) => {
    try {
        const { devEUI, measurement } = req.params;
        if (!(await checkDevEUIScope(devEUI, req.user!))) {
            return res.status(403).json({ error: 'Sin acceso a este sitio.' });
        }
        const range = (req.query.range as string) || '-7d';
        const windowSize = Math.min(Number(req.query.windowSize) || 5, 20);
        const every = intervalForRange(range);

        const telemetry = await getTelemetryData(devEUI, measurement, range, every);
        const points = toDataPoints(telemetry.data);
        const result = cleanSpikes(points, windowSize);

        res.json({
            site: telemetry.siteName,
            devEUI,
            measurement,
            range,
            windowSize,
            ...result,
        });
    } catch (e: any) {
        console.error('[Analytics] Clean error:', e.message);
        res.status(500).json({ error: 'Error al limpiar datos.' });
    }
});

// GET /stats/:devEUI/:measurement — Descriptive statistics
router.get('/stats/:devEUI/:measurement', isAuth, async (req: Request, res: Response) => {
    try {
        const { devEUI, measurement } = req.params;
        if (!(await checkDevEUIScope(devEUI, req.user!))) {
            return res.status(403).json({ error: 'Sin acceso a este sitio.' });
        }
        const range = (req.query.range as string) || '-7d';
        const every = intervalForRange(range);

        const telemetry = await getTelemetryData(devEUI, measurement, range, every);
        const points = toDataPoints(telemetry.data);
        const stats = computeStats(points.map(p => p.value));

        res.json({
            site: telemetry.siteName,
            devEUI,
            measurement,
            range,
            dataPoints: points.length,
            stats,
        });
    } catch (e: any) {
        console.error('[Analytics] Stats error:', e.message);
        res.status(500).json({ error: 'Error al calcular estadísticas.' });
    }
});

// GET /dashboard — Global analytics KPIs
router.get('/dashboard', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;

        // Get all active sites with telemetry
        let sitesQuery = `
            SELECT i.dev_eui, i.site_name, i.municipality, i.municipio_id,
                   ss.last_flow_value, ss.last_pressure_value, ss.last_updated_at
            FROM scada.inventory i
            LEFT JOIN scada.site_status ss ON ss.dev_eui = i.dev_eui
            WHERE ss.last_updated_at IS NOT NULL
        `;
        const params: any[] = [];

        if (user.scope === 'Municipal' && user.scope_id) {
            sitesQuery += ` AND i.municipio_id = $1`;
            params.push(user.scope_id);
        }
        sitesQuery += ` ORDER BY i.site_name`;

        const sites = await pool.query(sitesQuery, params);
        const totalSites = sites.rows.length;

        // Quick anomaly scan: check for sites with unusual last values
        let sitesWithAnomalies = 0;
        let sitesWithNegativeTrend = 0;
        const topAnomalies: any[] = [];

        // For performance, we do a simplified check on cached values
        const now = Date.now();
        for (const site of sites.rows) {
            const flow = Number(site.last_flow_value) || 0;
            const pressure = Number(site.last_pressure_value) || 0;
            const lastUpdate = site.last_updated_at ? new Date(site.last_updated_at).getTime() : 0;
            const isStale = (now - lastUpdate) > 15 * 60 * 1000;

            // Simple anomaly: pressure too high or flow sudden drop
            if (pressure > 5.0 || (flow === 0 && !isStale)) {
                sitesWithAnomalies++;
                if (topAnomalies.length < 5) {
                    topAnomalies.push({
                        site: site.site_name,
                        devEUI: site.dev_eui,
                        municipality: site.municipality,
                        issue: pressure > 5.0 ? `Presión alta (${pressure} kg/cm²)` : 'Caudal en 0',
                    });
                }
            }
        }

        res.json({
            totalSites,
            sitesWithTelemetry: sites.rows.filter((s: any) => s.last_updated_at).length,
            sitesWithAnomalies,
            sitesWithNegativeTrend,
            topAnomalies,
        });
    } catch (e: any) {
        console.error('[Analytics] Dashboard error:', e.message);
        res.status(500).json({ error: 'Error al generar dashboard analítico.' });
    }
});

export default router;
