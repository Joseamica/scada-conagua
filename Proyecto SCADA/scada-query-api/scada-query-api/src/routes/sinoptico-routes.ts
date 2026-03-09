// src/routes/sinoptico-routes.ts — Sinoptico projects, canvas CRUD, sharing, activity log
import { Router, Request, Response } from 'express';
import { pool } from '../services/db-service';
import { isAuth, canEditSinopticos } from '../middlewares/auth-middleware';
import { auditLog } from '../services/audit-service';
import { evaluateFormulasBatch } from '../services/formula-engine';

const router = Router();

// ─── Measurement → site_status column mapping (whitelist) ───
function measurementToField(measurement: string): string {
    const map: Record<string, string> = {
        caudal_lts: 'last_flow_value',
        presion_kg: 'last_pressure_value',
        nivel_m: 'last_nivel_value',
        lluvia_mm: 'last_lluvia_value',
        rssi: 'rssi',
        snr: 'snr',
        battery: 'battery_level',
        value_presion: 'last_pressure_value',
        value_caudal: 'last_flow_value',
        value_caudal_totalizado: 'last_totalized_value',
        value_senal: 'rssi',
        value_nivel: 'last_nivel_value',
        value_lluvia: 'last_lluvia_value',
    };
    return map[measurement] || measurement;
}

// Allowed site_status columns for dynamic field queries (SQL injection prevention)
const ALLOWED_SITE_STATUS_FIELDS = new Set([
    'last_flow_value',
    'last_pressure_value',
    'last_nivel_value',
    'last_lluvia_value',
    'last_totalized_value',
    'rssi',
    'snr',
    'battery_level',
]);

// ─── Scope helper: restrict results to user's municipality ───
function scopeWhere(user: any, alias: string = 'p'): { clause: string; params: any[] } {
    if (user.scope === 'Municipal') {
        return { clause: `AND ${alias}.municipio_id = $`, params: [user.scope_id] };
    }
    if (user.scope === 'Estatal') {
        return { clause: `AND ${alias}.estado_id = $`, params: [user.estado_id] };
    }
    return { clause: '', params: [] };
}

// ═══════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════

// GET /projects — list projects visible to user
router.get('/projects', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const scope = scopeWhere(user);
        const paramOffset = scope.params.length;

        const sql = `
            SELECT p.*, u.full_name AS owner_name,
                   (SELECT COUNT(*) FROM scada.sinopticos s WHERE s.project_id = p.id) AS sinoptico_count
            FROM scada.sinoptico_projects p
            JOIN scada.users u ON u.id = p.owner_id
            WHERE (p.owner_id = $1 OR p.is_public = true
                   OR EXISTS (SELECT 1 FROM scada.sinoptico_shares sh
                              JOIN scada.sinopticos si ON si.id = sh.sinoptico_id
                              WHERE si.project_id = p.id AND sh.user_id = $1))
            ${scope.clause ? scope.clause.replace('$', `$${paramOffset + 2}`) : ''}
            ORDER BY p.updated_at DESC
        `;
        const params = [user.id, ...scope.params];
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (e: any) {
        console.error('Error listing projects:', e.message);
        res.status(500).json({ error: 'Error al listar proyectos.' });
    }
});

// POST /projects — create project
router.post('/projects', canEditSinopticos, async (req: Request, res: Response) => {
    const { name, description, entity_id, is_public } = req.body;
    if (!name?.trim()) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    try {
        const user = req.user!;
        const result = await pool.query(
            `INSERT INTO scada.sinoptico_projects (name, description, owner_id, entity_id, estado_id, municipio_id, is_public)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                name.trim(),
                description || null,
                user.id,
                entity_id || null,
                user.estado_id || 0,
                user.scope === 'Municipal' ? user.scope_id : 0,
                is_public ?? false,
            ]
        );
        await auditLog(user.id, 'SINOPTICO_PROJECT_CREATED', { project_id: result.rows[0].id, name }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        console.error('Error creating project:', e.message);
        res.status(500).json({ error: 'Error al crear proyecto.' });
    }
});

// PUT /projects/:id
router.put('/projects/:id', canEditSinopticos, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, is_public } = req.body;

    try {
        const result = await pool.query(
            `UPDATE scada.sinoptico_projects
             SET name = COALESCE($1, name), description = $2, is_public = COALESCE($3, is_public), updated_at = NOW()
             WHERE id = $4 AND owner_id = $5 RETURNING *`,
            [name?.trim(), description, is_public, id, req.user!.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proyecto no encontrado o sin permisos.' });
        }
        res.json(result.rows[0]);
    } catch (e: any) {
        console.error('Error updating project:', e.message);
        res.status(500).json({ error: 'Error al actualizar proyecto.' });
    }
});

// DELETE /projects/:id
router.delete('/projects/:id', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'DELETE FROM scada.sinoptico_projects WHERE id = $1 AND owner_id = $2 RETURNING id',
            [req.params.id, req.user!.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Proyecto no encontrado o sin permisos.' });
        }
        await auditLog(req.user!.id, 'SINOPTICO_PROJECT_DELETED', { project_id: req.params.id }, req.ip!);
        res.json({ message: 'Proyecto eliminado.' });
    } catch (e: any) {
        console.error('Error deleting project:', e.message);
        res.status(500).json({ error: 'Error al eliminar proyecto.' });
    }
});

// ═══════════════════════════════════════════
// SINOPTICOS (canvas pages)
// ═══════════════════════════════════════════

// GET /projects/:id/sinopticos — list sinopticos in project
router.get('/projects/:id/sinopticos', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT s.id, s.name, s.description, s.canvas_width, s.canvas_height,
                    s.thumbnail, s.version, s.owner_id, s.created_at, s.updated_at,
                    u.full_name AS owner_name,
                    COALESCE(jsonb_array_length(s.canvas->'widgets'), 0) AS widget_count,
                    (SELECT jsonb_agg(jsonb_build_object(
                        'type', w->>'type', 'x', w->>'x', 'y', w->>'y',
                        'width', w->>'width', 'height', w->>'height'
                    )) FROM jsonb_array_elements(s.canvas->'widgets') w) AS widget_layout
             FROM scada.sinopticos s
             JOIN scada.users u ON u.id = s.owner_id
             WHERE s.project_id = $1
             ORDER BY s.updated_at DESC`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (e: any) {
        console.error('Error listing sinopticos:', e.message);
        res.status(500).json({ error: 'Error al listar sinopticos.' });
    }
});

// POST /projects/:id/sinopticos — create sinoptico
router.post('/projects/:id/sinopticos', canEditSinopticos, async (req: Request, res: Response) => {
    const { name, description, canvas_width, canvas_height } = req.body;
    if (!name?.trim()) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO scada.sinopticos (project_id, name, description, canvas_width, canvas_height, owner_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
                req.params.id,
                name.trim(),
                description || null,
                canvas_width || 1920,
                canvas_height || 1080,
                req.user!.id,
            ]
        );

        // Log activity
        await pool.query(
            `INSERT INTO scada.sinoptico_activity_log (sinoptico_id, user_id, action, details)
             VALUES ($1, $2, 'created', $3)`,
            [result.rows[0].id, req.user!.id, JSON.stringify({ name })]
        );

        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        console.error('Error creating sinoptico:', e.message);
        res.status(500).json({ error: 'Error al crear sinoptico.' });
    }
});

// GET /sinopticos/:id — load canvas (full JSONB)
router.get('/sinopticos/:id', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT s.*, u.full_name AS owner_name,
                    p.name AS project_name, p.id AS project_id
             FROM scada.sinopticos s
             JOIN scada.users u ON u.id = s.owner_id
             JOIN scada.sinoptico_projects p ON p.id = s.project_id
             WHERE s.id = $1`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sinoptico no encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (e: any) {
        console.error('Error loading sinoptico:', e.message);
        res.status(500).json({ error: 'Error al cargar sinoptico.' });
    }
});

// PUT /sinopticos/:id — save canvas
router.put('/sinopticos/:id', canEditSinopticos, async (req: Request, res: Response) => {
    const { name, description, canvas, canvas_width, canvas_height, thumbnail } = req.body;

    try {
        const result = await pool.query(
            `UPDATE scada.sinopticos
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 canvas = COALESCE($3, canvas),
                 canvas_width = COALESCE($4, canvas_width),
                 canvas_height = COALESCE($5, canvas_height),
                 thumbnail = COALESCE($6, thumbnail),
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $7 RETURNING id, version, updated_at`,
            [name?.trim(), description, canvas ? JSON.stringify(canvas) : null, canvas_width, canvas_height, thumbnail, req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sinoptico no encontrado.' });
        }

        // Log activity
        await pool.query(
            `INSERT INTO scada.sinoptico_activity_log (sinoptico_id, user_id, action, details)
             VALUES ($1, $2, 'saved', $3)`,
            [req.params.id, req.user!.id, JSON.stringify({ version: result.rows[0].version })]
        );

        res.json(result.rows[0]);
    } catch (e: any) {
        console.error('Error saving sinoptico:', e.message);
        res.status(500).json({ error: 'Error al guardar sinoptico.' });
    }
});

// DELETE /sinopticos/:id
router.delete('/sinopticos/:id', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'DELETE FROM scada.sinopticos WHERE id = $1 RETURNING id, name',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sinoptico no encontrado.' });
        }
        await auditLog(req.user!.id, 'SINOPTICO_DELETED', { sinoptico_id: req.params.id, name: result.rows[0].name }, req.ip!);
        res.json({ message: 'Sinoptico eliminado.' });
    } catch (e: any) {
        console.error('Error deleting sinoptico:', e.message);
        res.status(500).json({ error: 'Error al eliminar sinoptico.' });
    }
});

// POST /sinopticos/:id/duplicate — clone sinoptico
router.post('/sinopticos/:id/duplicate', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const original = await pool.query('SELECT * FROM scada.sinopticos WHERE id = $1', [req.params.id]);
        if (original.rows.length === 0) {
            return res.status(404).json({ error: 'Sinoptico no encontrado.' });
        }
        const src = original.rows[0];
        const result = await pool.query(
            `INSERT INTO scada.sinopticos (project_id, name, description, canvas, canvas_width, canvas_height, owner_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [src.project_id, `${src.name} (copia)`, src.description, JSON.stringify(src.canvas), src.canvas_width, src.canvas_height, req.user!.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        console.error('Error duplicating sinoptico:', e.message);
        res.status(500).json({ error: 'Error al duplicar sinoptico.' });
    }
});

// ═══════════════════════════════════════════
// SHARING
// ═══════════════════════════════════════════

// GET /sinopticos/:id/shares
router.get('/sinopticos/:id/shares', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT sh.id, sh.user_id, sh.permission, sh.created_at, u.full_name, u.email
             FROM scada.sinoptico_shares sh
             JOIN scada.users u ON u.id = sh.user_id
             WHERE sh.sinoptico_id = $1
             ORDER BY u.full_name`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al listar permisos.' });
    }
});

// POST /sinopticos/:id/shares
router.post('/sinopticos/:id/shares', canEditSinopticos, async (req: Request, res: Response) => {
    const { user_id, permission } = req.body;
    if (!user_id || !['read', 'edit'].includes(permission)) {
        return res.status(400).json({ error: 'user_id y permission (read/edit) son obligatorios.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO scada.sinoptico_shares (sinoptico_id, user_id, permission)
             VALUES ($1, $2, $3)
             ON CONFLICT (sinoptico_id, user_id) DO UPDATE SET permission = $3
             RETURNING *`,
            [req.params.id, user_id, permission]
        );
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al compartir sinoptico.' });
    }
});

// DELETE /sinopticos/:id/shares/:shareId
router.delete('/sinopticos/:id/shares/:shareId', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        await pool.query('DELETE FROM scada.sinoptico_shares WHERE id = $1 AND sinoptico_id = $2', [req.params.shareId, req.params.id]);
        res.json({ message: 'Permiso eliminado.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar permiso.' });
    }
});

// ═══════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════

router.get('/sinopticos/:id/activity', isAuth, async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    try {
        const result = await pool.query(
            `SELECT a.*, u.full_name
             FROM scada.sinoptico_activity_log a
             JOIN scada.users u ON u.id = a.user_id
             WHERE a.sinoptico_id = $1
             ORDER BY a.created_at DESC
             LIMIT $2`,
            [req.params.id, limit]
        );
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al cargar actividad.' });
    }
});

// ═══════════════════════════════════════════
// BATCH TELEMETRY QUERY (for sinoptico widgets)
// ═══════════════════════════════════════════

router.post('/sinopticos/:id/query', isAuth, async (req: Request, res: Response) => {
    const { widgets, range } = req.body;

    if (!Array.isArray(widgets) || widgets.length === 0) {
        return res.status(400).json({ error: 'Se requiere un array de widgets.' });
    }

    try {
        // Collect unique devEUI+measurement pairs from all widgets
        const queries: Map<string, { devEUI: string; measurement: string }> = new Map();
        for (const w of widgets) {
            if (w.devEUI && w.measurement) {
                const key = `${w.devEUI}::${w.measurement}`;
                queries.set(key, { devEUI: w.devEUI, measurement: w.measurement });
            }
            // Handle chart series
            if (Array.isArray(w.series)) {
                for (const s of w.series) {
                    if (s.devEUI && s.measurement) {
                        const key = `${s.devEUI}::${s.measurement}`;
                        queries.set(key, { devEUI: s.devEUI, measurement: s.measurement });
                    }
                }
            }
        }

        // For now, fetch latest values from site_status (fast, no InfluxDB)
        const results: Record<string, any> = {};
        for (const [key, { devEUI }] of queries) {
            const pgResult = await pool.query(
                `SELECT s.last_flow_value, s.last_pressure_value, s.battery_level,
                        s.rssi, s.snr, s.last_nivel_value, s.last_lluvia_value,
                        s.last_updated_at, s.bomba_activa, s.fallo_arrancador
                 FROM scada.site_status s
                 WHERE TRIM(s.dev_eui) = $1`,
                [devEUI.trim()]
            );
            if (pgResult.rows.length > 0) {
                results[key] = pgResult.rows[0];
            }
        }

        // === Resolve variable view formulas ===
        const viewIds = new Set<number>();
        for (const w of widgets) {
            const cfg = w.config || {};
            if (cfg.source === 'view' && cfg.viewId) viewIds.add(cfg.viewId);
            if (cfg.series) {
                for (const s of cfg.series) {
                    if (s.source === 'view' && s.viewId) viewIds.add(s.viewId);
                }
            }
            if (cfg.columns) {
                for (const c of cfg.columns) {
                    if (c.source === 'view' && c.viewId) viewIds.add(c.viewId);
                }
            }
        }

        for (const viewId of viewIds) {
            try {
                // Load columns
                const colResult = await pool.query(
                    'SELECT * FROM scada.view_columns WHERE view_id = $1 ORDER BY sort_order',
                    [viewId]
                );
                // Load formulas
                const fResult = await pool.query(
                    'SELECT * FROM scada.view_formulas WHERE view_id = $1 ORDER BY sort_order',
                    [viewId]
                );

                if (!fResult.rows.length) continue;

                // Build column bindings from site_status
                const bindings: Record<string, number | null> = {};
                let colIdx = 1;
                for (const col of colResult.rows) {
                    const field = measurementToField(col.measurement);
                    let val: number | null = null;

                    if (ALLOWED_SITE_STATUS_FIELDS.has(field)) {
                        const siteRow = await pool.query(
                            `SELECT ${field} FROM scada.site_status WHERE dev_eui = $1`,
                            [col.dev_eui]
                        );
                        const raw = siteRow.rows[0]?.[field] ?? null;
                        val = raw !== null ? Number(raw) : null;
                    }

                    bindings[col.alias] = val;
                    bindings[`i_${colIdx}`] = val;
                    colIdx++;
                }

                // Evaluate all formulas in topological order
                const evaluated = evaluateFormulasBatch(
                    fResult.rows.map((f: any) => ({
                        alias: f.alias,
                        expression: f.expression,
                        depends_on: f.depends_on || [],
                    })),
                    bindings
                );

                // Add formula results to response
                for (const f of fResult.rows) {
                    results[`view:${viewId}:formula:${f.id}`] = {
                        value: evaluated[f.alias] ?? null,
                    };
                }
            } catch (err) {
                console.error(`Error resolving view ${viewId} formulas:`, err);
            }
        }

        res.json({ results, timestamp: new Date().toISOString() });
    } catch (e: any) {
        console.error('Error batch query:', e.message);
        res.status(500).json({ error: 'Error al consultar telemetria.' });
    }
});

export default router;
