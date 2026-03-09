// src/routes/variable-routes.ts — Variable views, formulas, tag browser, execute
import { Router, Request, Response } from 'express';
import { FluxTableMetaData } from '@influxdata/influxdb-client';
import { pool } from '../services/db-service';
import { influxDB, org, queryApi } from '../services/influx-query-service';
import { isAuth, canEditSinopticos } from '../middlewares/auth-middleware';
import { validateFormula, evaluateFormulasBatch } from '../services/formula-engine';

const router = Router();

// ═══════════════════════════════════════════
// TAG BROWSER — devEUI → measurements tree
// ═══════════════════════════════════════════

router.get('/tags', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;

        // Base query: all sites from inventory
        let sql = `
            SELECT TRIM(i.dev_eui) AS dev_eui, i.site_name, i.municipality, i.site_type, i.proveedor
            FROM scada.inventory i
            WHERE TRIM(COALESCE(i.dev_eui, '')) != ''
        `;
        const params: any[] = [];

        // Municipal scope filtering
        if (user.scope === 'Municipal') {
            sql += ` AND LOWER(TRIM(i.municipality)) IN (
                SELECT LOWER(TRIM(e.name)) FROM scada.entities e
                WHERE e.municipio_id = $1 AND e.level = 'Municipal'
            )`;
            params.push(user.scope_id);
        } else if (user.scope === 'Estatal') {
            sql += ` AND LOWER(TRIM(i.municipality)) IN (
                SELECT LOWER(TRIM(e.name)) FROM scada.entities e
                WHERE e.estado_id = $1
            )`;
            params.push(user.estado_id);
        }

        sql += ' ORDER BY i.municipality, i.site_name';
        const result = await pool.query(sql, params);

        // Build tree: municipality → site → measurements
        const CHIRPSTACK_MEASUREMENTS = ['caudal_lts', 'presion_kg', 'rssi', 'snr', 'battery'];
        const IGNITION_MEASUREMENTS = ['value_presion', 'value_caudal', 'value_caudal_totalizado', 'value_senal', 'value_nivel', 'value_lluvia'];

        const tree = result.rows.map((row: any) => {
            const isIgnition = row.dev_eui.toLowerCase().startsWith('dev');
            return {
                devEUI: row.dev_eui,
                siteName: row.site_name,
                municipality: row.municipality,
                siteType: row.site_type,
                provider: row.proveedor,
                measurements: isIgnition ? IGNITION_MEASUREMENTS : CHIRPSTACK_MEASUREMENTS,
            };
        });

        res.json(tree);
    } catch (e: any) {
        console.error('Error fetching tags:', e.message);
        res.status(500).json({ error: 'Error al obtener tags.' });
    }
});

// ═══════════════════════════════════════════
// FOLDERS — explorer tree
// ═══════════════════════════════════════════

router.get('/folders', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'SELECT * FROM scada.variable_folders WHERE owner_id = $1 ORDER BY name',
            [req.user!.id]
        );
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al listar carpetas.' });
    }
});

router.post('/folders', canEditSinopticos, async (req: Request, res: Response) => {
    const { name, parent_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre obligatorio.' });
    try {
        const result = await pool.query(
            'INSERT INTO scada.variable_folders (name, parent_id, owner_id) VALUES ($1, $2, $3) RETURNING *',
            [name.trim(), parent_id || null, req.user!.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear carpeta.' });
    }
});

router.delete('/folders/:id', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        await pool.query('DELETE FROM scada.variable_folders WHERE id = $1 AND owner_id = $2', [req.params.id, req.user!.id]);
        res.json({ message: 'Carpeta eliminada.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar carpeta.' });
    }
});

// ═══════════════════════════════════════════
// VARIABLE VIEWS — named collections of columns + formulas
// ═══════════════════════════════════════════

router.get('/views', isAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const mineOnly = req.query.mine === 'true';

        let whereClause: string;
        if (mineOnly) {
            whereClause = 'WHERE v.owner_id = $1';
        } else {
            whereClause = `WHERE v.owner_id = $1
                OR v.is_shared = true
                OR EXISTS (SELECT 1 FROM scada.view_shares vs WHERE vs.view_id = v.id AND vs.user_id = $1)`;
        }

        const result = await pool.query(
            `SELECT v.*, u.full_name AS owner_name,
                    (SELECT COUNT(*) FROM scada.view_columns c WHERE c.view_id = v.id) AS column_count,
                    (SELECT COUNT(*) FROM scada.view_formulas f WHERE f.view_id = v.id) AS formula_count
             FROM scada.variable_views v
             JOIN scada.users u ON u.id = v.owner_id
             ${whereClause}
             ORDER BY v.updated_at DESC`,
            [userId]
        );
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al listar vistas.' });
    }
});

router.post('/views', canEditSinopticos, async (req: Request, res: Response) => {
    const { name, description, folder_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre obligatorio.' });
    try {
        const result = await pool.query(
            `INSERT INTO scada.variable_views (name, description, folder_id, owner_id)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name.trim(), description || null, folder_id || null, req.user!.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear vista.' });
    }
});

router.get('/views/:id', isAuth, async (req: Request, res: Response) => {
    try {
        const view = await pool.query('SELECT * FROM scada.variable_views WHERE id = $1', [req.params.id]);
        if (view.rows.length === 0) return res.status(404).json({ error: 'Vista no encontrada.' });

        const columns = await pool.query(
            'SELECT * FROM scada.view_columns WHERE view_id = $1 ORDER BY sort_order',
            [req.params.id]
        );
        const formulas = await pool.query(
            'SELECT * FROM scada.view_formulas WHERE view_id = $1 ORDER BY sort_order',
            [req.params.id]
        );

        res.json({
            ...view.rows[0],
            columns: columns.rows,
            formulas: formulas.rows,
        });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al cargar vista.' });
    }
});

router.put('/views/:id', canEditSinopticos, async (req: Request, res: Response) => {
    const { name, description, folder_id, is_shared } = req.body;
    try {
        const result = await pool.query(
            `UPDATE scada.variable_views
             SET name = COALESCE($1, name), description = $2, folder_id = $3,
                 is_shared = COALESCE($4, is_shared), updated_at = NOW()
             WHERE id = $5 AND owner_id = $6 RETURNING *`,
            [name?.trim(), description, folder_id, is_shared, req.params.id, req.user!.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Vista no encontrada.' });
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar vista.' });
    }
});

router.delete('/views/:id', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'DELETE FROM scada.variable_views WHERE id = $1 AND owner_id = $2 RETURNING id',
            [req.params.id, req.user!.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Vista no encontrada.' });
        res.json({ message: 'Vista eliminada.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar vista.' });
    }
});

// ═══════════════════════════════════════════
// COLUMNS — variable bindings in a view
// ═══════════════════════════════════════════

router.post('/views/:id/columns', canEditSinopticos, async (req: Request, res: Response) => {
    const { alias, dev_eui, measurement, aggregation, sort_order } = req.body;
    if (!alias?.trim() || !dev_eui || !measurement) {
        return res.status(400).json({ error: 'alias, dev_eui y measurement son obligatorios.' });
    }
    try {
        const result = await pool.query(
            `INSERT INTO scada.view_columns (view_id, alias, dev_eui, measurement, aggregation, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.params.id, alias.trim(), dev_eui, measurement, aggregation || 'AVG', sort_order || 0]
        );
        await pool.query('UPDATE scada.variable_views SET updated_at = NOW() WHERE id = $1', [req.params.id]);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al agregar columna.' });
    }
});

router.put('/views/:viewId/columns/:colId', canEditSinopticos, async (req: Request, res: Response) => {
    const { alias, dev_eui, measurement, aggregation, sort_order } = req.body;
    try {
        const result = await pool.query(
            `UPDATE scada.view_columns
             SET alias = COALESCE($1, alias), dev_eui = COALESCE($2, dev_eui),
                 measurement = COALESCE($3, measurement), aggregation = COALESCE($4, aggregation),
                 sort_order = COALESCE($5, sort_order)
             WHERE id = $6 AND view_id = $7 RETURNING *`,
            [alias?.trim(), dev_eui, measurement, aggregation, sort_order, req.params.colId, req.params.viewId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Columna no encontrada.' });
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar columna.' });
    }
});

router.delete('/views/:viewId/columns/:colId', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        await pool.query('DELETE FROM scada.view_columns WHERE id = $1 AND view_id = $2', [req.params.colId, req.params.viewId]);
        res.json({ message: 'Columna eliminada.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar columna.' });
    }
});

// ═══════════════════════════════════════════
// FORMULAS
// ═══════════════════════════════════════════

router.post('/views/:id/formulas', canEditSinopticos, async (req: Request, res: Response) => {
    const { alias, expression, depends_on, sort_order } = req.body;
    if (!alias?.trim() || !expression?.trim()) {
        return res.status(400).json({ error: 'alias y expression son obligatorios.' });
    }

    // Validate formula syntax
    const validation = validateFormula(expression);
    if (!validation.valid) {
        return res.status(400).json({ error: `Formula invalida: ${validation.error}` });
    }

    try {
        const result = await pool.query(
            `INSERT INTO scada.view_formulas (view_id, alias, expression, depends_on, sort_order)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.params.id, alias.trim(), expression, depends_on || [], sort_order || 0]
        );
        await pool.query('UPDATE scada.variable_views SET updated_at = NOW() WHERE id = $1', [req.params.id]);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear formula.' });
    }
});

router.put('/views/:viewId/formulas/:formulaId', canEditSinopticos, async (req: Request, res: Response) => {
    const { alias, expression, depends_on, sort_order } = req.body;

    if (expression) {
        const validation = validateFormula(expression);
        if (!validation.valid) {
            return res.status(400).json({ error: `Formula invalida: ${validation.error}` });
        }
    }

    try {
        const result = await pool.query(
            `UPDATE scada.view_formulas
             SET alias = COALESCE($1, alias), expression = COALESCE($2, expression),
                 depends_on = COALESCE($3, depends_on), sort_order = COALESCE($4, sort_order)
             WHERE id = $5 AND view_id = $6 RETURNING *`,
            [alias?.trim(), expression, depends_on, sort_order, req.params.formulaId, req.params.viewId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Formula no encontrada.' });
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar formula.' });
    }
});

router.delete('/views/:viewId/formulas/:formulaId', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        await pool.query('DELETE FROM scada.view_formulas WHERE id = $1 AND view_id = $2', [req.params.formulaId, req.params.viewId]);
        res.json({ message: 'Formula eliminada.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar formula.' });
    }
});

// POST /views/:id/formulas/validate — validate formula syntax without saving
router.post('/views/:id/formulas/validate', isAuth, async (req: Request, res: Response) => {
    const { expression } = req.body;
    if (!expression) return res.status(400).json({ error: 'expression es obligatorio.' });

    const result = validateFormula(expression);
    res.json(result);
});

// ═══════════════════════════════════════════
// EXECUTE VIEW — batch InfluxDB query + formula evaluation
// ═══════════════════════════════════════════

router.post('/views/:id/execute', isAuth, async (req: Request, res: Response) => {
    const { range } = req.body;

    try {
        // Load view with columns and formulas
        const view = await pool.query('SELECT * FROM scada.variable_views WHERE id = $1', [req.params.id]);
        if (view.rows.length === 0) return res.status(404).json({ error: 'Vista no encontrada.' });

        const columns = await pool.query(
            'SELECT * FROM scada.view_columns WHERE view_id = $1 ORDER BY sort_order',
            [req.params.id]
        );
        const formulas = await pool.query(
            'SELECT * FROM scada.view_formulas WHERE view_id = $1 ORDER BY sort_order',
            [req.params.id]
        );

        // For Phase 1: fetch latest values from site_status (fast path)
        // Phase 4 will add full InfluxDB batch query with pivot
        const columnValues: Record<string, number | null> = {};

        for (const col of columns.rows) {
            const statusResult = await pool.query(
                `SELECT last_flow_value, last_pressure_value, battery_level, rssi, snr,
                        last_nivel_value, last_lluvia_value
                 FROM scada.site_status
                 WHERE TRIM(dev_eui) = $1`,
                [col.dev_eui.trim()]
            );
            if (statusResult.rows.length > 0) {
                const row = statusResult.rows[0];
                const measurementMap: Record<string, string> = {
                    caudal_lts: 'last_flow_value',
                    presion_kg: 'last_pressure_value',
                    battery: 'battery_level',
                    rssi: 'rssi',
                    snr: 'snr',
                    nivel_m: 'last_nivel_value',
                    lluvia_mm: 'last_lluvia_value',
                };
                const pgField = measurementMap[col.measurement] || col.measurement;
                columnValues[col.alias] = row[pgField] !== null ? Number(row[pgField]) : null;
            } else {
                columnValues[col.alias] = null;
            }
        }

        // Add i_N index-based bindings (i_1 = first column, i_2 = second, etc.)
        const indexedValues: Record<string, number | null> = { ...columnValues };
        columns.rows.forEach((col: any, idx: number) => {
            indexedValues[`i_${idx + 1}`] = columnValues[col.alias];
        });

        // Evaluate formulas in order
        const allValues = evaluateFormulasBatch(
            formulas.rows.map((f: any) => ({
                alias: f.alias,
                expression: f.expression,
                depends_on: f.depends_on || [],
            })),
            indexedValues
        );

        // Strip i_N index keys from output — only return alias-keyed values
        const cleanValues: Record<string, number | null> = {};
        for (const [key, val] of Object.entries(allValues)) {
            if (!key.startsWith('i_')) cleanValues[key] = val;
        }

        res.json({
            view: view.rows[0],
            columns: columns.rows,
            formulas: formulas.rows,
            values: cleanValues,
            timestamp: new Date().toISOString(),
        });
    } catch (e: any) {
        console.error('Error executing view:', e.message);
        res.status(500).json({ error: 'Error al ejecutar vista.' });
    }
});

// ═══════════════════════════════════════════
// HELPERS — InfluxDB time-series querying
// ═══════════════════════════════════════════

function toInfluxRange(range: string): string {
    const map: Record<string, string> = {
        '1h': '-1h',
        '6h': '-6h',
        '24h': '-24h',
        '7d': '-7d',
        '30d': '-30d',
    };
    return map[range] || '-24h';
}

function measurementToInfluxField(measurement: string): string {
    const map: Record<string, string> = {
        caudal_lts: 'flow_value',
        presion_kg: 'pressure_value',
        nivel_m: 'nivel_value',
        lluvia_mm: 'lluvia_value',
        value_presion: 'presion',
        value_caudal: 'caudal',
        value_caudal_totalizado: 'caudal_totalizado',
        value_senal: 'senal',
        value_nivel: 'nivel',
        value_lluvia: 'lluvia',
    };
    return map[measurement] || measurement;
}

/** Run a Flux query and return rows as {timestamp, value} */
async function queryInfluxSeries(
    fluxQuery: string
): Promise<{ timestamp: number; value: number }[]> {
    const rows: { timestamp: number; value: number }[] = [];
    await new Promise<void>((resolve, reject) => {
        queryApi.queryRows(fluxQuery, {
            next: (row: string[], tableMeta: FluxTableMetaData) => {
                const o = tableMeta.toObject(row);
                if (o._value !== null && o._value !== undefined) {
                    rows.push({
                        timestamp: new Date(o._time).getTime(),
                        value: Number(o._value),
                    });
                }
            },
            error: (error: Error) => reject(error),
            complete: () => resolve(),
        });
    });
    return rows;
}

// ═══════════════════════════════════════════
// EXECUTE SERIES — historical time-series for a single formula
// ═══════════════════════════════════════════

router.post('/views/:id/execute-series', isAuth, async (req: Request, res: Response) => {
    const viewId = parseInt(req.params.id);
    const { formulaId, range = '24h' } = req.body;

    try {
        // Load columns
        const colResult = await pool.query(
            'SELECT * FROM scada.view_columns WHERE view_id = $1 ORDER BY sort_order',
            [viewId]
        );

        // Load the specific formula
        const fResult = await pool.query(
            'SELECT * FROM scada.view_formulas WHERE id = $1 AND view_id = $2',
            [formulaId, viewId]
        );
        if (!fResult.rows.length) {
            return res.status(404).json({ error: 'Formula not found' });
        }
        const formula = fResult.rows[0];

        // Load all formulas for dependency resolution
        const allFormulasResult = await pool.query(
            'SELECT * FROM scada.view_formulas WHERE view_id = $1 ORDER BY sort_order',
            [viewId]
        );

        // Query InfluxDB for each column's historical data
        const influxRange = toInfluxRange(range);
        const columnSeries: Record<string, Map<number, number>> = {};
        const columns = colResult.rows;

        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const isIgnition = col.dev_eui.toLowerCase().startsWith('dev');
            const activeBucket = isIgnition
                ? process.env.INFLUX_BUCKET_IGNITION || 'telemetria_ignition'
                : process.env.INFLUX_BUCKET || 'telemetria_sitios';
            const activeMeasurement = isIgnition ? 'mediciones_ignition' : 'mediciones_pozos';

            // Map measurement name → InfluxDB field
            let influxField = col.measurement;
            if (isIgnition) {
                const igMapping: Record<string, string> = {
                    presion_kg: 'value_presion',
                    caudal_lts: 'value_caudal',
                    last_total_flow: 'value_caudal_totalizado',
                    rssi: 'value_senal',
                    nivel_m: 'value_nivel',
                    lluvia_mm: 'value_lluvia',
                };
                influxField = igMapping[col.measurement] || col.measurement;
            }

            // Resolve tag filter: Ignition uses pozo (site_name), ChirpStack uses devEui
            let tagFilter: string;
            if (isIgnition) {
                const pgRes = await pool.query(
                    'SELECT site_name FROM scada.inventory WHERE TRIM(dev_eui) = $1 LIMIT 1',
                    [col.dev_eui.trim()]
                );
                const siteName = pgRes.rows[0]?.site_name || '';
                const safeSiteName = siteName
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/[\n\r]/g, '');
                tagFilter = `r["pozo"] == "${safeSiteName}"`;
            } else {
                tagFilter = `r["devEui"] == "${col.dev_eui.trim()}"`;
            }

            const fluxQuery = `
                from(bucket: "${activeBucket}")
                    |> range(start: ${influxRange})
                    |> filter(fn: (r) => r["_measurement"] == "${activeMeasurement}")
                    |> filter(fn: (r) => ${tagFilter})
                    |> filter(fn: (r) => r["_field"] == "${influxField}")
                    |> group()
                    |> aggregateWindow(every: 5m, fn: mean, createEmpty: false)
                    |> yield(name: "mean")
            `;

            const tsMap = new Map<number, number>();
            try {
                const rows = await queryInfluxSeries(fluxQuery);
                for (const row of rows) {
                    tsMap.set(row.timestamp, row.value);
                }
            } catch (e) {
                console.error(`InfluxDB query error for column ${col.alias}:`, e);
            }

            columnSeries[col.alias] = tsMap;
            columnSeries[`i_${i + 1}`] = tsMap;
        }

        // Collect all unique timestamps
        const allTimestamps = new Set<number>();
        for (const tsMap of Object.values(columnSeries)) {
            for (const ts of tsMap.keys()) {
                allTimestamps.add(ts);
            }
        }
        const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

        // Evaluate formula at each timestamp
        const seriesData: [number, number][] = [];
        for (const ts of sortedTimestamps) {
            const bindings: Record<string, number | null> = {};
            for (const [alias, tsMap] of Object.entries(columnSeries)) {
                bindings[alias] = tsMap.get(ts) ?? null;
            }

            const evaluated = evaluateFormulasBatch(
                allFormulasResult.rows.map((f: any) => ({
                    alias: f.alias,
                    expression: f.expression,
                    depends_on: f.depends_on || [],
                })),
                bindings
            );

            const val = evaluated[formula.alias];
            if (val !== null && val !== undefined && !isNaN(val)) {
                seriesData.push([ts, val]);
            }
        }

        res.json({
            formulaId: formula.id,
            alias: formula.alias,
            data: seriesData,
        });
    } catch (err) {
        console.error('Error executing formula series:', err);
        res.status(500).json({ error: 'Error computing formula series' });
    }
});

export default router;
