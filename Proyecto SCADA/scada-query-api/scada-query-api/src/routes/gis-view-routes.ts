// src/routes/gis-view-routes.ts — GIS views CRUD (saved map state snapshots)
import { Router, Request, Response } from 'express';
import { pool } from '../services/db-service';
import { isAuth } from '../middlewares/auth-middleware';
import { auditLog } from '../services/audit-service';

const router = Router();

function scopeWhere(user: any, alias: string = 'v', paramStart: number = 2): { clause: string; params: any[] } {
    if (user.scope === 'Municipal' && user.scope_id) {
        return { clause: `AND ${alias}.municipio_id = $${paramStart}`, params: [user.scope_id] };
    }
    if (user.scope === 'Estatal' && user.estado_id) {
        return { clause: `AND ${alias}.estado_id = $${paramStart}`, params: [user.estado_id] };
    }
    return { clause: '', params: [] };
}

// GET / — List views (admin sees all, others see own + public in scope)
router.get('/', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;

        if (user.role_id === 1) {
            const result = await pool.query(
                `SELECT v.*, u.full_name AS owner_name
                 FROM scada.gis_views v
                 JOIN scada.users u ON u.id = v.user_id
                 ORDER BY v.updated_at DESC`
            );
            return res.json(result.rows);
        }

        const scope = scopeWhere(user, 'v', 2);
        const result = await pool.query(
            `SELECT v.*, u.full_name AS owner_name
             FROM scada.gis_views v
             JOIN scada.users u ON u.id = v.user_id
             WHERE (v.user_id = $1 OR v.is_public = true)
             ${scope.clause}
             ORDER BY v.updated_at DESC`,
            [user.id, ...scope.params]
        );
        res.json(result.rows);
    } catch (e: any) {
        console.error('[GIS-View] Error listing views:', e.message);
        res.status(500).json({ error: 'Error al listar vistas GIS.' });
    }
});

// GET /:id — Get single view
router.get('/:id', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const result = await pool.query(
            `SELECT v.*, u.full_name AS owner_name
             FROM scada.gis_views v
             JOIN scada.users u ON u.id = v.user_id
             WHERE v.id = $1`,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Vista no encontrada.' });
        }

        const view = result.rows[0];
        if (view.user_id !== user.id && user.role_id !== 1) {
            if (!view.is_public) return res.status(403).json({ error: 'Sin acceso a esta vista.' });
            if (user.scope === 'Municipal' && user.scope_id && view.municipio_id !== user.scope_id) {
                return res.status(403).json({ error: 'Sin acceso a esta vista.' });
            }
        }
        res.json(view);
    } catch (e: any) {
        console.error('[GIS-View] Error getting view:', e.message);
        res.status(500).json({ error: 'Error al obtener vista GIS.' });
    }
});

// POST / — Create view
router.post('/', isAuth, async (req: Request, res: Response) => {
    const { name, view_state, description, is_public } = req.body;

    if (!name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (!view_state || typeof view_state !== 'object') {
        return res.status(400).json({ error: 'view_state es obligatorio y debe ser un objeto.' });
    }

    try {
        const user = req.user!;
        const result = await pool.query(
            `INSERT INTO scada.gis_views (user_id, name, description, view_state, is_public, municipio_id, estado_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                user.id,
                name.trim(),
                description || null,
                JSON.stringify(view_state),
                is_public ?? false,
                user.scope === 'Municipal' ? user.scope_id : 0,
                user.estado_id || 0,
            ]
        );

        await auditLog(user.id, 'GIS_VIEW_CREATED', { view_id: result.rows[0].id, name: name.trim() }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        console.error('[GIS-View] Error creating view:', e.message);
        res.status(500).json({ error: 'Error al crear vista GIS.' });
    }
});

// PUT /:id — Update view (owner or admin)
router.put('/:id', isAuth, async (req: Request, res: Response) => {
    const { name, view_state, description, is_public } = req.body;

    try {
        const user = req.user!;
        const existing = await pool.query('SELECT user_id FROM scada.gis_views WHERE id = $1', [req.params.id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Vista no encontrada.' });
        if (existing.rows[0].user_id !== user.id && user.role_id !== 1) {
            return res.status(403).json({ error: 'Solo el propietario puede editar esta vista.' });
        }

        const result = await pool.query(
            `UPDATE scada.gis_views
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 view_state = COALESCE($3, view_state),
                 is_public = COALESCE($4, is_public),
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [
                name?.trim() || null,
                description !== undefined ? description : null,
                view_state ? JSON.stringify(view_state) : null,
                is_public !== undefined ? is_public : null,
                req.params.id,
            ]
        );

        await auditLog(user.id, 'GIS_VIEW_UPDATED', { view_id: req.params.id }, req.ip!);
        res.json(result.rows[0]);
    } catch (e: any) {
        console.error('[GIS-View] Error updating view:', e.message);
        res.status(500).json({ error: 'Error al actualizar vista GIS.' });
    }
});

// DELETE /:id — Delete view (owner or admin)
router.delete('/:id', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const existing = await pool.query('SELECT user_id FROM scada.gis_views WHERE id = $1', [req.params.id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Vista no encontrada.' });
        if (existing.rows[0].user_id !== user.id && user.role_id !== 1) {
            return res.status(403).json({ error: 'Solo el propietario puede eliminar esta vista.' });
        }

        await pool.query('DELETE FROM scada.gis_views WHERE id = $1', [req.params.id]);
        await auditLog(user.id, 'GIS_VIEW_DELETED', { view_id: req.params.id }, req.ip!);
        res.json({ message: 'Vista eliminada correctamente.' });
    } catch (e: any) {
        console.error('[GIS-View] Error deleting view:', e.message);
        res.status(500).json({ error: 'Error al eliminar vista GIS.' });
    }
});

export default router;
