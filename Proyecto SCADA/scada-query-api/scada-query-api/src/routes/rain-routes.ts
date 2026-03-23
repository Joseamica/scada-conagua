// src/routes/rain-routes.ts — Rain monitoring module endpoints
import { Router, Request, Response } from 'express';
import { pool } from '../services/db-service';
import { isAuth } from '../middlewares/auth-middleware';

const router = Router();

// GET /stations — List all rain stations (scoped by municipality)
router.get('/stations', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        let sql = `SELECT * FROM scada.rain_stations WHERE is_active = true`;
        const params: any[] = [];

        // Municipal users only see their municipality's stations
        if (user.scope === 'Municipal' && user.scope_id) {
            sql += ` AND municipio_id = $1`;
            params.push(user.scope_id);
        } else if (user.scope === 'Estatal' && user.estado_id) {
            // Estatal sees all in their state (all our stations are EDOMEX)
        }

        sql += ` ORDER BY municipality, code`;
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (e: any) {
        console.error('[Rain] Error listing stations:', e.message);
        res.status(500).json({ error: 'Error al listar estaciones pluviométricas.' });
    }
});

// GET /current — Current readings for all stations
router.get('/current', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        let sql = `SELECT * FROM scada.rain_stations WHERE is_active = true`;
        const params: any[] = [];

        if (user.scope === 'Municipal' && user.scope_id) {
            sql += ` AND municipio_id = $1`;
            params.push(user.scope_id);
        }

        sql += ` ORDER BY last_value_mm DESC NULLS LAST, name`;
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (e: any) {
        console.error('[Rain] Error fetching current:', e.message);
        res.status(500).json({ error: 'Error al obtener lecturas actuales.' });
    }
});

// GET /cuts/:date — Daily rain cut table (6AM-6AM)
router.get('/cuts/:date', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const { date } = req.params; // YYYY-MM-DD

        let sql = `
            SELECT c.*, s.code, s.name AS station_name, s.municipality, s.municipio_id,
                   s.latitude, s.longitude
            FROM scada.rain_daily_cuts c
            JOIN scada.rain_stations s ON s.id = c.station_id
            WHERE c.cut_date = $1 AND s.is_active = true
        `;
        const params: any[] = [date];

        if (user.scope === 'Municipal' && user.scope_id) {
            sql += ` AND s.municipio_id = $${params.length + 1}`;
            params.push(user.scope_id);
        }

        sql += ` ORDER BY s.municipality, s.code`;
        const result = await pool.query(sql, params);

        // Group by municipality for the frontend table
        const grouped: Record<string, { municipality: string; municipio_id: number; stations: any[]; totals: Record<string, number> }> = {};

        for (const row of result.rows) {
            const mun = row.municipality;
            if (!grouped[mun]) {
                grouped[mun] = { municipality: mun, municipio_id: row.municipio_id, stations: [], totals: {} };
                // Init totals
                for (let h = 6; h <= 23; h++) grouped[mun].totals[`h${String(h).padStart(2, '0')}`] = 0;
                for (let h = 0; h <= 5; h++) grouped[mun].totals[`h${String(h).padStart(2, '0')}`] = 0;
                grouped[mun].totals.cut_total = 0;
            }
            grouped[mun].stations.push(row);
            // Accumulate totals
            for (let h = 6; h <= 23; h++) {
                const key = `h${String(h).padStart(2, '0')}`;
                grouped[mun].totals[key] += Number(row[key]) || 0;
            }
            for (let h = 0; h <= 5; h++) {
                const key = `h${String(h).padStart(2, '0')}`;
                grouped[mun].totals[key] += Number(row[key]) || 0;
            }
            grouped[mun].totals.cut_total += Number(row.cut_total) || 0;
        }

        res.json({
            date,
            municipalities: Object.values(grouped),
            total_stations: result.rows.length,
        });
    } catch (e: any) {
        console.error('[Rain] Error fetching cuts:', e.message);
        res.status(500).json({ error: 'Error al obtener corte de lluvia.' });
    }
});

// GET /cuts/:date/available — Check which dates have data
router.get('/dates', isAuth, async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT cut_date FROM scada.rain_daily_cuts ORDER BY cut_date DESC LIMIT 30`
        );
        res.json(result.rows.map((r: any) => r.cut_date));
    } catch (e: any) {
        console.error('[Rain] Error fetching dates:', e.message);
        res.status(500).json({ error: 'Error al obtener fechas disponibles.' });
    }
});

export default router;
