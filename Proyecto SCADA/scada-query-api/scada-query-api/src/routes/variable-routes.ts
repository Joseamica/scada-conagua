// src/routes/variable-routes.ts — Variable views, formulas, tag browser, execute
import { Router, Request, Response } from 'express';
import { FluxTableMetaData } from '@influxdata/influxdb-client';
import { pool } from '../services/db-service';
import { influxDB, org, queryApi } from '../services/influx-query-service';
import { isAuth, canEditSinopticos } from '../middlewares/auth-middleware';
import { validateFormula, evaluateFormulasBatch, NullPolicy } from '../services/formula-engine';
import { auditLog } from '../services/audit-service';

const router = Router();

const VALID_AGGREGATIONS = ['AVG', 'MIN', 'MAX', 'SUM', 'LAST_VALUE', 'BAL'];

/** Check if user has read/edit/owner access to a variable view */
async function assertViewAccess(
    viewId: number | string,
    userId: number,
    roleId: number,
    level: 'read' | 'edit' | 'owner' = 'read'
): Promise<boolean> {
    if (roleId === 1) {
        const r = await pool.query('SELECT 1 FROM scada.variable_views WHERE id = $1', [viewId]);
        return r.rows.length > 0;
    }
    const view = await pool.query('SELECT owner_id, is_shared FROM scada.variable_views WHERE id = $1', [viewId]);
    if (view.rows.length === 0) return false;
    const row = view.rows[0];
    if (row.owner_id === userId) return true;
    if (level === 'owner') return false;
    if (level === 'read' && row.is_shared) return true;
    const share = await pool.query(
        'SELECT permission FROM scada.view_shares WHERE view_id = $1 AND user_id = $2',
        [viewId, userId]
    );
    if (share.rows.length === 0) return false;
    if (level === 'edit') return share.rows[0].permission === 'edit';
    return true;
}

// ═══════════════════════════════════════════
// TAG BROWSER — devEUI → measurements tree
// ═══════════════════════════════════════════

router.get('/tags', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;

        // Base query: all sites from inventory (normalize municipality casing, exclude ICH lab)
        let sql = `
            SELECT TRIM(i.dev_eui) AS dev_eui, i.site_name,
                   UPPER(TRIM(i.municipality)) AS municipality, i.site_type, i.proveedor
            FROM scada.inventory i
            WHERE TRIM(COALESCE(i.dev_eui, '')) != ''
              AND LENGTH(TRIM(i.dev_eui)) >= 8
              AND UPPER(TRIM(COALESCE(i.municipality, ''))) NOT IN ('JIQUILPAN', '', 'ENSENADA')
        `;
        const params: any[] = [];

        // Municipal scope filtering (integer comparison via municipio_id)
        if (user.scope === 'Municipal' && user.scope_id) {
            sql += ' AND (i.municipio_id = $1 OR i.municipio_id IS NULL)';
            params.push(user.scope_id);
        } else if (user.scope === 'Estatal' && user.estado_id) {
            sql += ` AND (i.municipio_id IN (
                SELECT e.municipio_id FROM scada.entities e WHERE e.estado_id = $1 AND e.level = 'Municipal'
            ) OR i.municipio_id IS NULL)`;
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
        await auditLog(req.user!.id, 'VARIABLE_FOLDER_CREATED', { folder_id: result.rows[0].id, name }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear carpeta.' });
    }
});

router.delete('/folders/:id', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        await pool.query('DELETE FROM scada.variable_folders WHERE id = $1 AND owner_id = $2', [req.params.id, req.user!.id]);
        await auditLog(req.user!.id, 'VARIABLE_FOLDER_DELETED', { folder_id: req.params.id }, req.ip!);
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
        if (folder_id) {
            const folderCheck = await pool.query(
                'SELECT id FROM scada.variable_folders WHERE id = $1 AND owner_id = $2',
                [folder_id, req.user!.id]
            );
            if (folderCheck.rows.length === 0) return res.status(403).json({ error: 'Carpeta no pertenece al usuario.' });
        }
        const result = await pool.query(
            `INSERT INTO scada.variable_views (name, description, folder_id, owner_id)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name.trim(), description || null, folder_id || null, req.user!.id]
        );
        await auditLog(req.user!.id, 'VARIABLE_VIEW_CREATED', { view_id: result.rows[0].id, name }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear vista.' });
    }
});

router.get('/views/:id', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.id, user.id, user.role_id, 'read'))) {
            return res.status(403).json({ error: 'Sin acceso a esta vista.' });
        }
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
    const { name, description, folder_id, is_shared, null_policy } = req.body;
    if (null_policy && !['zero', 'null'].includes(null_policy)) {
        return res.status(400).json({ error: 'null_policy debe ser "zero" o "null".' });
    }
    try {
        if (folder_id) {
            const folderCheck = await pool.query(
                'SELECT id FROM scada.variable_folders WHERE id = $1 AND owner_id = $2',
                [folder_id, req.user!.id]
            );
            if (folderCheck.rows.length === 0) return res.status(403).json({ error: 'Carpeta no pertenece al usuario.' });
        }
        const result = await pool.query(
            `UPDATE scada.variable_views
             SET name = COALESCE($1, name), description = $2, folder_id = $3,
                 is_shared = COALESCE($4, is_shared), null_policy = COALESCE($5, null_policy),
                 updated_at = NOW()
             WHERE id = $6 AND owner_id = $7 RETURNING *`,
            [name?.trim(), description, folder_id, is_shared, null_policy, req.params.id, req.user!.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Vista no encontrada.' });
        await auditLog(req.user!.id, 'VARIABLE_VIEW_UPDATED', { view_id: req.params.id, name: result.rows[0].name }, req.ip!);
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
        await auditLog(req.user!.id, 'VARIABLE_VIEW_DELETED', { view_id: req.params.id }, req.ip!);
        res.json({ message: 'Vista eliminada.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar vista.' });
    }
});

// ═══════════════════════════════════════════
// COLUMNS — variable bindings in a view
// ═══════════════════════════════════════════

router.post('/views/:id/columns', canEditSinopticos, async (req: Request, res: Response) => {
    const { alias, dev_eui, measurement, aggregation, sort_order, incognita_name } = req.body;
    if (!alias?.trim() || !dev_eui?.trim() || !measurement?.trim()) {
        return res.status(400).json({ error: 'alias, dev_eui y measurement son obligatorios.' });
    }
    if (aggregation && !VALID_AGGREGATIONS.includes(aggregation)) {
        return res.status(400).json({ error: 'Agregación no válida.' });
    }
    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.id, user.id, user.role_id, 'edit'))) {
            return res.status(403).json({ error: 'Sin acceso de edición a esta vista.' });
        }
        const result = await pool.query(
            `INSERT INTO scada.view_columns (view_id, alias, dev_eui, measurement, aggregation, sort_order, incognita_name)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [req.params.id, alias.trim(), dev_eui.trim(), measurement.trim(), aggregation || 'AVG', sort_order || 0, incognita_name || null]
        );
        await pool.query('UPDATE scada.variable_views SET updated_at = NOW() WHERE id = $1', [req.params.id]);
        await auditLog(req.user!.id, 'VARIABLE_COLUMN_ADDED', { view_id: req.params.id, column_id: result.rows[0].id, alias, dev_eui, measurement }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        if (e.code === '23505') return res.status(409).json({ error: 'Esta columna ya existe en la vista.' });
        res.status(500).json({ error: 'Error al agregar columna.' });
    }
});

router.put('/views/:viewId/columns/:colId', canEditSinopticos, async (req: Request, res: Response) => {
    const { alias, dev_eui, measurement, aggregation, sort_order, incognita_name } = req.body;
    if (aggregation && !VALID_AGGREGATIONS.includes(aggregation)) {
        return res.status(400).json({ error: 'Agregación no válida.' });
    }
    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.viewId, user.id, user.role_id, 'edit'))) {
            return res.status(403).json({ error: 'Sin acceso de edición a esta vista.' });
        }
        const result = await pool.query(
            `UPDATE scada.view_columns
             SET alias = COALESCE($1, alias), dev_eui = COALESCE($2, dev_eui),
                 measurement = COALESCE($3, measurement), aggregation = COALESCE($4, aggregation),
                 sort_order = COALESCE($5, sort_order), incognita_name = COALESCE($6, incognita_name)
             WHERE id = $7 AND view_id = $8 RETURNING *`,
            [alias?.trim(), dev_eui, measurement, aggregation, sort_order, incognita_name, req.params.colId, req.params.viewId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Columna no encontrada.' });
        await auditLog(req.user!.id, 'VARIABLE_COLUMN_UPDATED', { view_id: req.params.viewId, column_id: req.params.colId }, req.ip!);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar columna.' });
    }
});

router.delete('/views/:viewId/columns/:colId', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.viewId, user.id, user.role_id, 'edit'))) {
            return res.status(403).json({ error: 'Sin acceso de edición a esta vista.' });
        }
        await pool.query('DELETE FROM scada.view_columns WHERE id = $1 AND view_id = $2', [req.params.colId, req.params.viewId]);
        await auditLog(req.user!.id, 'VARIABLE_COLUMN_DELETED', { view_id: req.params.viewId, column_id: req.params.colId }, req.ip!);
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

    const user = req.user!;
    if (!(await assertViewAccess(req.params.id, user.id, user.role_id, 'edit'))) {
        return res.status(403).json({ error: 'Sin acceso de edición a esta vista.' });
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
        await auditLog(req.user!.id, 'VARIABLE_FORMULA_CREATED', { view_id: req.params.id, formula_id: result.rows[0].id, alias, expression }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear formula.' });
    }
});

router.put('/views/:viewId/formulas/:formulaId', canEditSinopticos, async (req: Request, res: Response) => {
    const { alias, expression, depends_on, sort_order } = req.body;

    const user = req.user!;
    if (!(await assertViewAccess(req.params.viewId, user.id, user.role_id, 'edit'))) {
        return res.status(403).json({ error: 'Sin acceso de edición a esta vista.' });
    }

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
        await auditLog(req.user!.id, 'VARIABLE_FORMULA_UPDATED', { view_id: req.params.viewId, formula_id: req.params.formulaId }, req.ip!);
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar formula.' });
    }
});

router.delete('/views/:viewId/formulas/:formulaId', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.viewId, user.id, user.role_id, 'edit'))) {
            return res.status(403).json({ error: 'Sin acceso de edición a esta vista.' });
        }
        await pool.query('DELETE FROM scada.view_formulas WHERE id = $1 AND view_id = $2', [req.params.formulaId, req.params.viewId]);
        await auditLog(req.user!.id, 'VARIABLE_FORMULA_DELETED', { view_id: req.params.viewId, formula_id: req.params.formulaId }, req.ip!);
        res.json({ message: 'Formula eliminada.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar formula.' });
    }
});

// POST /views/:id/formulas/validate — validate formula syntax without saving
router.post('/views/:id/formulas/validate', isAuth, async (req: Request, res: Response) => {
    const { expression } = req.body;
    if (!expression) return res.status(400).json({ error: 'expression es obligatorio.' });

    const user = req.user!;
    if (!(await assertViewAccess(req.params.id, user.id, user.role_id, 'read'))) {
        return res.status(403).json({ error: 'Sin acceso a esta vista.' });
    }

    const result = validateFormula(expression);
    res.json(result);
});

// ═══════════════════════════════════════════
// EXECUTE VIEW — batch InfluxDB query + formula evaluation
// ═══════════════════════════════════════════

router.post('/views/:id/execute', isAuth, async (req: Request, res: Response) => {
    const { range } = req.body;

    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.id, user.id, user.role_id, 'read'))) {
            return res.status(403).json({ error: 'Sin acceso a esta vista.' });
        }

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

        // Fetch values — LAST_VALUE uses fast site_status cache, other aggregations query InfluxDB
        const columnValues: Record<string, number | null> = {};
        const execRange = range || '24h';

        // Parallelize all column value fetches
        const colTasks = columns.rows.map(async (col: any) => {
            if (col.aggregation === 'LAST_VALUE' || !col.aggregation) {
                // Fast path: cached site_status
                const statusResult = await pool.query(
                    `SELECT last_flow_value, last_pressure_value, last_total_flow,
                            battery_level, rssi, snr, last_nivel_value, last_lluvia_value
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
                        value_presion: 'last_pressure_value',
                        value_caudal: 'last_flow_value',
                        value_caudal_totalizado: 'last_total_flow',
                        value_senal: 'rssi',
                        value_nivel: 'last_nivel_value',
                        value_lluvia: 'last_lluvia_value',
                    };
                    const pgField = measurementMap[col.measurement] || col.measurement;
                    return { alias: col.alias, value: row[pgField] !== null ? Number(row[pgField]) : null };
                }
                return { alias: col.alias, value: null };
            } else {
                // InfluxDB aggregation (AVG, MIN, MAX, SUM, BAL)
                try {
                    const isIgnition = col.dev_eui.toLowerCase().startsWith('dev');
                    const activeBucket = isIgnition
                        ? process.env.INFLUX_BUCKET_IGNITION || 'telemetria_ignition'
                        : process.env.INFLUX_BUCKET || 'telemetria_sitios';
                    const activeMeasurement = isIgnition ? 'mediciones_ignition' : 'mediciones_pozos';

                    let influxField = col.measurement;
                    if (isIgnition) {
                        const igMapping: Record<string, string> = {
                            presion_kg: 'value_presion', caudal_lts: 'value_caudal',
                            last_total_flow: 'value_caudal_totalizado', rssi: 'value_senal',
                            nivel_m: 'value_nivel', lluvia_mm: 'value_lluvia',
                        };
                        influxField = igMapping[col.measurement] || col.measurement;
                    }

                    let tagFilter: string;
                    if (isIgnition) {
                        const pgRes = await pool.query(
                            'SELECT site_name FROM scada.inventory WHERE TRIM(dev_eui) = $1 LIMIT 1',
                            [col.dev_eui.trim()]
                        );
                        const siteName = pgRes.rows[0]?.site_name || '';
                        const safe = siteName.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\n\r]/g, '');
                        tagFilter = `r["pozo"] == "${safe}"`;
                    } else {
                        tagFilter = `r["devEui"] == "${col.dev_eui.trim()}"`;
                    }

                    const aggFnMap: Record<string, string> = {
                        AVG: 'mean', MIN: 'min', MAX: 'max', SUM: 'sum', BAL: 'spread',
                    };
                    const fluxFn = aggFnMap[col.aggregation] || 'mean';
                    const influxRange = toInfluxRange(execRange);

                    const fluxQuery = `
                        from(bucket: "${activeBucket}")
                            |> range(start: ${influxRange})
                            |> filter(fn: (r) => r["_measurement"] == "${activeMeasurement}")
                            |> filter(fn: (r) => ${tagFilter})
                            |> filter(fn: (r) => r["_field"] == "${influxField}")
                            |> group()
                            |> ${fluxFn}()
                    `;

                    const rows = await queryInfluxSeries(fluxQuery);
                    return { alias: col.alias, value: rows.length > 0 ? rows[0].value : null };
                } catch (aggErr) {
                    console.error(`Aggregation error for ${col.alias}:`, aggErr);
                    return { alias: col.alias, value: null };
                }
            }
        });

        const colResults = await Promise.all(colTasks);
        for (const { alias, value } of colResults) {
            columnValues[alias] = value;
        }

        // Add i_N index-based bindings (i_1 = first column, i_2 = second, etc.)
        const indexedValues: Record<string, number | null> = { ...columnValues };
        columns.rows.forEach((col: any, idx: number) => {
            indexedValues[`i_${idx + 1}`] = columnValues[col.alias];
        });

        // Read null_policy from view (default: 'zero')
        const nullPolicy: NullPolicy = view.rows[0].null_policy || 'zero';

        // Evaluate formulas in order
        const { values: allValues, quality: qualityMap } = evaluateFormulasBatch(
            formulas.rows.map((f: any) => ({
                alias: f.alias,
                expression: f.expression,
                depends_on: f.depends_on || [],
            })),
            indexedValues,
            nullPolicy
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
            quality: qualityMap,
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
    if (isNaN(viewId)) {
        return res.status(400).json({ error: 'ID de vista invalido.' });
    }
    const { formulaId, all = false, range = '24h' } = req.body;

    // Validate formulaId when not in "all" mode
    if (!all && (formulaId == null || isNaN(Number(formulaId)))) {
        return res.status(400).json({ error: 'formulaId es requerido (o usa all: true).' });
    }

    try {
        const user = req.user!;
        if (!(await assertViewAccess(viewId, user.id, user.role_id, 'read'))) {
            return res.status(403).json({ error: 'Sin acceso a esta vista.' });
        }

        // Load columns
        const colResult = await pool.query(
            'SELECT * FROM scada.view_columns WHERE view_id = $1 ORDER BY sort_order',
            [viewId]
        );

        // Load all formulas for dependency resolution
        const allFormulasResult = await pool.query(
            'SELECT * FROM scada.view_formulas WHERE view_id = $1 ORDER BY sort_order',
            [viewId]
        );

        // If single formulaId mode, find the formula in already-loaded results
        let formula: any = null;
        if (!all) {
            formula = allFormulasResult.rows.find((f: any) => f.id === Number(formulaId));
            if (!formula) {
                return res.status(404).json({ error: 'Formula not found' });
            }
        }

        // Sanitize a string for safe interpolation into Flux queries
        const sanitizeFlux = (s: string) => s
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/[\n\r]/g, '');

        // Query InfluxDB for each column's historical data (in parallel)
        const influxRange = toInfluxRange(range);
        const columnSeries: Record<string, Map<number, number>> = {};
        const columnAliasSeries: Map<string, Map<number, number>> = new Map();
        const columns = colResult.rows;

        // Build query tasks for parallel execution
        const queryTasks = columns.map(async (col: any, i: number) => {
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
                tagFilter = `r["pozo"] == "${sanitizeFlux(siteName)}"`;
            } else {
                tagFilter = `r["devEui"] == "${sanitizeFlux(col.dev_eui.trim())}"`;
            }

            const fluxQuery = `
                from(bucket: "${activeBucket}")
                    |> range(start: ${influxRange})
                    |> filter(fn: (r) => r["_measurement"] == "${activeMeasurement}")
                    |> filter(fn: (r) => ${tagFilter})
                    |> filter(fn: (r) => r["_field"] == "${sanitizeFlux(influxField)}")
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

            return { alias: col.alias, index: i, tsMap };
        });

        // Execute all InfluxDB queries in parallel
        const queryResults = await Promise.all(queryTasks);
        for (const { alias, index, tsMap } of queryResults) {
            columnSeries[alias] = tsMap;
            columnSeries[`i_${index + 1}`] = tsMap;
            columnAliasSeries.set(alias, tsMap);
        }

        // Read null_policy from view
        const viewRow = await pool.query('SELECT null_policy FROM scada.variable_views WHERE id = $1', [viewId]);
        const nullPolicy: NullPolicy = viewRow.rows[0]?.null_policy || 'zero';

        // Collect all unique timestamps
        const allTimestamps = new Set<number>();
        for (const tsMap of Object.values(columnSeries)) {
            for (const ts of tsMap.keys()) {
                allTimestamps.add(ts);
            }
        }
        const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

        // Evaluate ALL formulas at each timestamp
        const formulaSeriesMap: Record<string, [number, number][]> = {};
        for (const f of allFormulasResult.rows) {
            formulaSeriesMap[f.alias] = [];
        }

        for (const ts of sortedTimestamps) {
            const bindings: Record<string, number | null> = {};
            for (const [alias, tsMap] of Object.entries(columnSeries)) {
                bindings[alias] = tsMap.get(ts) ?? null;
            }

            const { values: evaluated, quality } = evaluateFormulasBatch(
                allFormulasResult.rows.map((f: any) => ({
                    alias: f.alias,
                    expression: f.expression,
                    depends_on: f.depends_on || [],
                })),
                bindings,
                nullPolicy
            );

            for (const f of allFormulasResult.rows) {
                const val = evaluated[f.alias];
                if (val !== null && val !== undefined && !isNaN(val)) {
                    formulaSeriesMap[f.alias].push([ts, val]);
                }
            }
        }

        // "all" mode: return every column + formula series in one response
        if (all) {
            const columnSeriesArr = columns.map((col: any) => ({
                alias: col.alias,
                data: Array.from(columnAliasSeries.get(col.alias) || []).sort((a, b) => a[0] - b[0]),
            }));
            const formulaSeriesArr = allFormulasResult.rows.map((f: any) => ({
                formulaId: f.id,
                alias: f.alias,
                expression: f.expression,
                data: formulaSeriesMap[f.alias] || [],
            }));
            return res.json({ columns: columnSeriesArr, formulas: formulaSeriesArr });
        }

        // Single formula mode (backward compatible)
        const seriesData = formulaSeriesMap[formula.alias] || [];
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

// ═══════════════════════════════════════════
// VIEW SHARING
// ═══════════════════════════════════════════

// GET /views/:id/shares — list shares for a view
router.get('/views/:id/shares', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.id, user.id, user.role_id, 'owner'))) {
            return res.status(403).json({ error: 'Solo el propietario puede ver los permisos.' });
        }
        const result = await pool.query(
            `SELECT vs.id, vs.user_id, vs.permission, vs.created_at,
                    u.full_name, u.email
             FROM scada.view_shares vs
             JOIN scada.users u ON u.id = vs.user_id
             WHERE vs.view_id = $1
             ORDER BY u.full_name`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching view shares:', err);
        res.status(500).json({ error: 'Error fetching shares' });
    }
});

// POST /views/:id/shares — add or update a share
router.post('/views/:id/shares', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.id, user.id, user.role_id, 'owner'))) {
            return res.status(403).json({ error: 'Solo el propietario puede compartir la vista.' });
        }
        const { user_id, permission } = req.body;
        if (!user_id) {
            res.status(400).json({ error: 'user_id is required' });
            return;
        }
        const result = await pool.query(
            `INSERT INTO scada.view_shares (view_id, user_id, permission)
             VALUES ($1, $2, $3)
             ON CONFLICT (view_id, user_id) DO UPDATE SET permission = $3
             RETURNING *`,
            [req.params.id, user_id, permission || 'read']
        );
        await auditLog(req.user!.id, 'VARIABLE_VIEW_SHARED', { view_id: req.params.id, shared_with: user_id, permission: permission || 'read' }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding view share:', err);
        res.status(500).json({ error: 'Error adding share' });
    }
});

// DELETE /views/:viewId/shares/:shareId — remove a share
router.delete('/views/:viewId/shares/:shareId', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        if (!(await assertViewAccess(req.params.viewId, user.id, user.role_id, 'owner'))) {
            return res.status(403).json({ error: 'Solo el propietario puede modificar permisos.' });
        }
        await pool.query(
            'DELETE FROM scada.view_shares WHERE id = $1 AND view_id = $2',
            [req.params.shareId, req.params.viewId]
        );
        await auditLog(req.user!.id, 'VARIABLE_VIEW_UNSHARED', { view_id: req.params.viewId, share_id: req.params.shareId }, req.ip!);
        res.json({ message: 'Permiso eliminado.' });
    } catch (err) {
        console.error('Error removing view share:', err);
        res.status(500).json({ error: 'Error removing share' });
    }
});

// GET /views/:id/share-candidates — search users to share with
router.get('/views/:id/share-candidates', isAuth, async (req: Request, res: Response) => {
    try {
        const q = ((req.query.q as string) || '').toLowerCase();
        const result = await pool.query(
            `SELECT id, full_name, email FROM scada.users
             WHERE is_active = true AND id != $1
             AND (LOWER(full_name) LIKE $2 OR LOWER(email) LIKE $2)
             ORDER BY full_name LIMIT 20`,
            [req.user!.id, `%${q}%`]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error searching share candidates:', err);
        res.status(500).json({ error: 'Error searching users' });
    }
});

export default router;
