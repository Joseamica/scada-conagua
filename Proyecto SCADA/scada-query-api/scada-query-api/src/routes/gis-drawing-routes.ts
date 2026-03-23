// src/routes/gis-drawing-routes.ts — GIS drawings CRUD (user annotations on the map)
import { Router, Request, Response } from 'express';
import { pool } from '../services/db-service';
import { isAuth } from '../middlewares/auth-middleware';
import { auditLog } from '../services/audit-service';

const router = Router();

// ─── Scope helper: restrict results to user's municipality/estado ───
function scopeWhere(user: any, alias: string = 'd', paramStart: number = 2): { clause: string; params: any[] } {
    if (user.scope === 'Municipal' && user.scope_id) {
        return { clause: `AND ${alias}.municipio_id = $${paramStart}`, params: [user.scope_id] };
    }
    if (user.scope === 'Estatal' && user.estado_id) {
        return { clause: `AND ${alias}.estado_id = $${paramStart}`, params: [user.estado_id] };
    }
    return { clause: '', params: [] };
}

// ─── GET / — List user's own drawings + public ones (scoped) ───
router.get('/', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const isAdmin = user.role_id === 1;

        if (isAdmin) {
            // Admins see ALL drawings (federal view)
            const result = await pool.query(
                `SELECT d.*, u.full_name AS owner_name
                 FROM scada.gis_drawings d
                 JOIN scada.users u ON u.id = d.user_id
                 ORDER BY d.updated_at DESC`
            );
            return res.json(result.rows);
        }

        const scope = scopeWhere(user, 'd', 2);

        const sql = `
            SELECT d.*, u.full_name AS owner_name
            FROM scada.gis_drawings d
            JOIN scada.users u ON u.id = d.user_id
            WHERE (d.user_id = $1 OR d.is_public = true)
            ${scope.clause}
            ORDER BY d.updated_at DESC
        `;
        const params = [user.id, ...scope.params];
        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (e: any) {
        console.error('[GIS-Drawing] Error listing drawings:', e.message);
        res.status(500).json({ error: 'Error al listar dibujos GIS.' });
    }
});

// ─── GET /:id — Get single drawing ───
router.get('/:id', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const { id } = req.params;

        const result = await pool.query(
            `SELECT d.*, u.full_name AS owner_name
             FROM scada.gis_drawings d
             JOIN scada.users u ON u.id = d.user_id
             WHERE d.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dibujo no encontrado.' });
        }

        const drawing = result.rows[0];

        // Access control: owner, admin, or public within scope
        if (drawing.user_id !== user.id && user.role_id !== 1) {
            if (!drawing.is_public) {
                return res.status(403).json({ error: 'Sin acceso a este dibujo.' });
            }
            // Public drawing — still check municipal scope
            if (user.scope === 'Municipal' && user.scope_id && drawing.municipio_id !== user.scope_id) {
                return res.status(403).json({ error: 'Sin acceso a este dibujo.' });
            }
            if (user.scope === 'Estatal' && user.estado_id && drawing.estado_id !== user.estado_id) {
                return res.status(403).json({ error: 'Sin acceso a este dibujo.' });
            }
        }

        res.json(drawing);
    } catch (e: any) {
        console.error('[GIS-Drawing] Error getting drawing:', e.message);
        res.status(500).json({ error: 'Error al obtener dibujo GIS.' });
    }
});

// ─── POST / — Create drawing ───
router.post('/', isAuth, async (req: Request, res: Response) => {
    const { name, geojson, color, description, is_public } = req.body;

    if (!name?.trim()) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (!geojson || typeof geojson !== 'object') {
        return res.status(400).json({ error: 'geojson es obligatorio y debe ser un objeto.' });
    }

    try {
        const user = req.user!;
        const municipio_id = user.scope === 'Municipal' ? user.scope_id : 0;
        const estado_id = user.estado_id || 0;

        const result = await pool.query(
            `INSERT INTO scada.gis_drawings (user_id, name, description, geojson, color, municipio_id, estado_id, is_public)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [
                user.id,
                name.trim(),
                description || null,
                JSON.stringify(geojson),
                color || '#6d002b',
                municipio_id,
                estado_id,
                is_public ?? false,
            ]
        );

        await auditLog(user.id, 'GIS_DRAWING_CREATED', { drawing_id: result.rows[0].id, name: name.trim() }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        console.error('[GIS-Drawing] Error creating drawing:', e.message);
        res.status(500).json({ error: 'Error al crear dibujo GIS.' });
    }
});

// ─── PUT /:id — Update drawing (owner only) ───
router.put('/:id', isAuth, async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, geojson, color, description, is_public } = req.body;

    try {
        const user = req.user!;

        // Verify ownership
        const existing = await pool.query(
            'SELECT user_id FROM scada.gis_drawings WHERE id = $1',
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Dibujo no encontrado.' });
        }
        if (existing.rows[0].user_id !== user.id && user.role_id !== 1) {
            return res.status(403).json({ error: 'Solo el propietario puede editar este dibujo.' });
        }

        const result = await pool.query(
            `UPDATE scada.gis_drawings
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 geojson = COALESCE($3, geojson),
                 color = COALESCE($4, color),
                 is_public = COALESCE($5, is_public),
                 updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [
                name?.trim() || null,
                description !== undefined ? description : null,
                geojson ? JSON.stringify(geojson) : null,
                color || null,
                is_public !== undefined ? is_public : null,
                id,
            ]
        );

        await auditLog(user.id, 'GIS_DRAWING_UPDATED', { drawing_id: id, name: result.rows[0].name }, req.ip!);
        res.json(result.rows[0]);
    } catch (e: any) {
        console.error('[GIS-Drawing] Error updating drawing:', e.message);
        res.status(500).json({ error: 'Error al actualizar dibujo GIS.' });
    }
});

// ─── DELETE /:id — Delete drawing (owner only) ───
router.delete('/:id', isAuth, async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const user = req.user!;

        // Verify ownership
        const existing = await pool.query(
            'SELECT user_id FROM scada.gis_drawings WHERE id = $1',
            [id]
        );
        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Dibujo no encontrado.' });
        }
        if (existing.rows[0].user_id !== user.id && user.role_id !== 1) {
            return res.status(403).json({ error: 'Solo el propietario puede eliminar este dibujo.' });
        }

        await pool.query('DELETE FROM scada.gis_drawings WHERE id = $1', [id]);

        await auditLog(user.id, 'GIS_DRAWING_DELETED', { drawing_id: id }, req.ip!);
        res.json({ message: 'Dibujo eliminado correctamente.' });
    } catch (e: any) {
        console.error('[GIS-Drawing] Error deleting drawing:', e.message);
        res.status(500).json({ error: 'Error al eliminar dibujo GIS.' });
    }
});

export default router;
