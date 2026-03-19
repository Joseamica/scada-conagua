// src/routes/sinoptico-routes.ts — Sinoptico projects, canvas CRUD, sharing, activity log
import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { pool } from '../services/db-service';
import { isAuth, canEditSinopticos } from '../middlewares/auth-middleware';
import { auditLog } from '../services/audit-service';
import { evaluateFormulasBatch } from '../services/formula-engine';
import { getLatestValue } from '../services/influx-query-service';

// --- Sinoptico image uploads config ---
const SINOPTICO_UPLOADS_DIR = process.env.UPLOADS_DIR
    ? path.join(process.env.UPLOADS_DIR, '..', 'sinopticos')
    : path.join(__dirname, '..', '..', 'uploads', 'sinopticos');
fs.mkdirSync(SINOPTICO_UPLOADS_DIR, { recursive: true });

const sinopticoStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const sinId = req.params.id || 'unknown';
        const dir = path.join(SINOPTICO_UPLOADS_DIR, sinId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        cb(null, uniqueName);
    },
});

const sinopticoUpload = multer({
    storage: sinopticoStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes PNG, JPG, WEBP, GIF o SVG.'));
        }
    },
});

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
function scopeWhere(user: any, alias: string = 'p', paramStart: number = 2): { clause: string; params: any[] } {
    if (user.scope === 'Municipal' && user.scope_id) {
        return { clause: `AND ${alias}.municipio_id = $${paramStart}`, params: [user.scope_id] };
    }
    if (user.scope === 'Estatal' && user.estado_id) {
        return { clause: `AND ${alias}.estado_id = $${paramStart}`, params: [user.estado_id] };
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
        const isAdmin = user.role_id === 1;

        if (isAdmin) {
            // Admins see ALL projects (federal view)
            const result = await pool.query(
                `SELECT p.*, u.full_name AS owner_name,
                        (SELECT COUNT(*) FROM scada.sinopticos s WHERE s.project_id = p.id) AS sinoptico_count
                 FROM scada.sinoptico_projects p
                 JOIN scada.users u ON u.id = p.owner_id
                 ORDER BY p.updated_at DESC`
            );
            return res.json(result.rows);
        }

        const scope = scopeWhere(user, 'p', 2);

        const sql = `
            SELECT p.*, u.full_name AS owner_name,
                   (SELECT COUNT(*) FROM scada.sinopticos s WHERE s.project_id = p.id) AS sinoptico_count
            FROM scada.sinoptico_projects p
            JOIN scada.users u ON u.id = p.owner_id
            WHERE (p.owner_id = $1 OR p.is_public = true
                   OR EXISTS (SELECT 1 FROM scada.sinoptico_shares sh
                              JOIN scada.sinopticos si ON si.id = sh.sinoptico_id
                              WHERE si.project_id = p.id AND sh.user_id = $1))
            ${scope.clause}
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
        await auditLog(req.user!.id, 'SINOPTICO_PROJECT_UPDATED', { project_id: id, name: result.rows[0].name }, req.ip!);
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

// GET /projects/:id/sinopticos — list sinopticos in project (only owned, shared, or if admin/public)
router.get('/projects/:id/sinopticos', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const isAdmin = user.role_id === 1;

        // Check if project is public
        const projResult = await pool.query(
            'SELECT is_public, owner_id FROM scada.sinoptico_projects WHERE id = $1',
            [req.params.id]
        );
        const project = projResult.rows[0];
        const isOwnerOrPublic = project && (project.owner_id === user.id || project.is_public);

        // Admins and project owners see all sinopticos; others only see owned + shared
        const accessFilter = (isAdmin || isOwnerOrPublic)
            ? ''
            : `AND (s.owner_id = $2 OR EXISTS (
                   SELECT 1 FROM scada.sinoptico_shares sh
                   WHERE sh.sinoptico_id = s.id AND sh.user_id = $2))`;

        const params: any[] = [req.params.id];
        if (!isAdmin && !isOwnerOrPublic) params.push(user.id);

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
             WHERE s.project_id = $1 AND s.deleted_at IS NULL
             ${accessFilter}
             ORDER BY s.updated_at DESC`,
            params
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
        await auditLog(req.user!.id, 'SINOPTICO_CREATED', { sinoptico_id: result.rows[0].id, project_id: req.params.id, name }, req.ip!);

        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        console.error('Error creating sinoptico:', e.message);
        res.status(500).json({ error: 'Error al crear sinoptico.' });
    }
});

// GET /sinopticos/shared-with-me — list sinopticos shared with the current user
// IMPORTANT: must be BEFORE /sinopticos/:id to avoid Express treating "sinopticos-shared" as :id
router.get('/sinopticos-shared', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const result = await pool.query(
            `SELECT s.id, s.name, s.description, s.canvas_width, s.canvas_height,
                    s.thumbnail, s.version, s.owner_id, s.created_at, s.updated_at,
                    u.full_name AS owner_name, sh.permission,
                    p.name AS project_name, p.id AS project_id,
                    COALESCE(jsonb_array_length(s.canvas->'widgets'), 0) AS widget_count,
                    (SELECT jsonb_agg(jsonb_build_object(
                        'type', w->>'type', 'x', w->>'x', 'y', w->>'y',
                        'width', w->>'width', 'height', w->>'height'
                    )) FROM jsonb_array_elements(s.canvas->'widgets') w) AS widget_layout
             FROM scada.sinoptico_shares sh
             JOIN scada.sinopticos s ON s.id = sh.sinoptico_id
             JOIN scada.users u ON u.id = s.owner_id
             JOIN scada.sinoptico_projects p ON p.id = s.project_id
             WHERE sh.user_id = $1 AND s.deleted_at IS NULL
             ORDER BY s.updated_at DESC`,
            [user.id]
        );
        res.json(result.rows);
    } catch (e: any) {
        console.error('Error listing shared sinopticos:', e.message);
        res.status(500).json({ error: 'Error al listar sinopticos compartidos.' });
    }
});

// GET /sinopticos-all — lightweight list of all accessible sinopticos (for link widget dropdown)
router.get('/sinopticos-all', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const isAdmin = user.role_id === 1;
        const accessFilter = isAdmin
            ? ''
            : `AND (s.owner_id = $1 OR p.is_public = true
                OR EXISTS (SELECT 1 FROM scada.sinoptico_shares sh WHERE sh.sinoptico_id = s.id AND sh.user_id = $1))`;
        const params = isAdmin ? [] : [user.id];
        const result = await pool.query(
            `SELECT s.id, s.name, p.name AS project_name
             FROM scada.sinopticos s
             JOIN scada.sinoptico_projects p ON p.id = s.project_id
             WHERE s.deleted_at IS NULL ${accessFilter}
             ORDER BY p.name, s.name`,
            params
        );
        res.json(result.rows);
    } catch (e: any) {
        console.error('Error listing all sinopticos:', e.message);
        res.status(500).json({ error: 'Error al listar sinopticos.' });
    }
});

// GET /sinopticos/share-candidates — search users RBAC-filtered (no sinoptico context, for creation flow)
// IMPORTANT: must be BEFORE /sinopticos/:id to avoid Express treating "share-candidates" as :id
router.get('/sinopticos/share-candidates', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const q = ((req.query.q as string) || '').toLowerCase();

        const conditions: string[] = [
            'u.is_active = true',
            'u.id != $1',
            '(LOWER(u.full_name) LIKE $2 OR LOWER(u.email) LIKE $2)',
            'u.role_id >= $3',
        ];
        const values: any[] = [user.id, `%${q}%`, user.role_id];

        if (user.scope === 'Municipal') {
            conditions.push(`u.scope_id = $${values.length + 1}`);
            values.push(user.scope_id);
            conditions.push(`u.estado_id = $${values.length + 1}`);
            values.push(user.estado_id);
        } else if (user.scope === 'Estatal') {
            conditions.push(`u.estado_id = $${values.length + 1}`);
            values.push(user.estado_id);
        }

        const result = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.role_id, r.role_name,
                    u.scope, u.municipio_name
             FROM scada.users u
             JOIN scada.roles r ON r.id = u.role_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY u.full_name LIMIT 20`,
            values
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error searching share candidates:', err);
        res.status(500).json({ error: 'Error searching users' });
    }
});

// GET /sinopticos/:id — load canvas (full JSONB) — checks access
router.get('/sinopticos/:id', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const result = await pool.query(
            `SELECT s.*, u.full_name AS owner_name,
                    p.name AS project_name, p.id AS project_id, p.is_public AS project_public
             FROM scada.sinopticos s
             JOIN scada.users u ON u.id = s.owner_id
             JOIN scada.sinoptico_projects p ON p.id = s.project_id
             WHERE s.id = $1 AND s.deleted_at IS NULL`,
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sinoptico no encontrado.' });
        }

        const sinoptico = result.rows[0];
        const isAdmin = user.role_id === 1;
        const isOwner = sinoptico.owner_id === user.id;
        const isPublic = sinoptico.project_public;

        // Determine effective permission for this user
        let share_permission: 'owner' | 'edit' | 'read' = 'read';
        if (isAdmin || isOwner) {
            share_permission = 'owner';
        }

        // Check share (needed for access control AND permission level)
        const shareCheck = await pool.query(
            'SELECT permission FROM scada.sinoptico_shares WHERE sinoptico_id = $1 AND user_id = $2',
            [req.params.id, user.id]
        );

        if (!isAdmin && !isOwner && !isPublic && shareCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Sin permisos para ver este sinoptico.' });
        }

        if (share_permission === 'read' && shareCheck.rows.length > 0 && shareCheck.rows[0].permission === 'edit') {
            share_permission = 'edit';
        }

        // Check can_edit_sinopticos granular permission
        if (share_permission === 'read') {
            const permCheck = await pool.query(
                'SELECT can_edit_sinopticos FROM scada.permissions WHERE user_id = $1',
                [user.id]
            );
            if (permCheck.rows[0]?.can_edit_sinopticos) share_permission = 'edit';
        }

        res.json({ ...sinoptico, share_permission });
    } catch (e: any) {
        console.error('Error loading sinoptico:', e.message);
        res.status(500).json({ error: 'Error al cargar sinoptico.' });
    }
});

// PUT /sinopticos/:id — save canvas (owner, admin, canEditSinopticos perm, or 'edit' share required)
router.put('/sinopticos/:id', isAuth, async (req: Request, res: Response) => {
    const { name, description, canvas, canvas_width, canvas_height, canvas_bg, thumbnail } = req.body;

    try {
        const user = req.user!;
        const isAdmin = user.role_id === 1;

        if (!isAdmin) {
            const ownerCheck = await pool.query(
                'SELECT owner_id FROM scada.sinopticos WHERE id = $1 AND deleted_at IS NULL',
                [req.params.id]
            );
            if (ownerCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Sinoptico no encontrado.' });
            }
            const isOwner = ownerCheck.rows[0].owner_id === user.id;

            if (!isOwner) {
                // Check granular permission OR edit share
                const permCheck = await pool.query(
                    'SELECT can_edit_sinopticos FROM scada.permissions WHERE user_id = $1',
                    [user.id]
                );
                const hasGranularPerm = permCheck.rows[0]?.can_edit_sinopticos === true;

                if (!hasGranularPerm) {
                    const shareCheck = await pool.query(
                        "SELECT id FROM scada.sinoptico_shares WHERE sinoptico_id = $1 AND user_id = $2 AND permission = 'edit'",
                        [req.params.id, user.id]
                    );
                    if (shareCheck.rows.length === 0) {
                        return res.status(403).json({ error: 'Sin permisos de edicion para este sinoptico.' });
                    }
                }
            }
        }

        const result = await pool.query(
            `UPDATE scada.sinopticos
             SET name = COALESCE($1, name),
                 description = COALESCE($2, description),
                 canvas = COALESCE($3, canvas),
                 canvas_width = COALESCE($4, canvas_width),
                 canvas_height = COALESCE($5, canvas_height),
                 canvas_bg = COALESCE($6, canvas_bg),
                 thumbnail = COALESCE($7, thumbnail),
                 version = version + 1,
                 updated_at = NOW()
             WHERE id = $8 RETURNING id, version, updated_at`,
            [name?.trim(), description, canvas ? JSON.stringify(canvas) : null, canvas_width, canvas_height, canvas_bg ?? null, thumbnail, req.params.id]
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
        await auditLog(req.user!.id, 'SINOPTICO_SAVED', { sinoptico_id: req.params.id, version: result.rows[0].version }, req.ip!);

        res.json(result.rows[0]);
    } catch (e: any) {
        console.error('Error saving sinoptico:', e.message);
        res.status(500).json({ error: 'Error al guardar sinoptico.' });
    }
});

// DELETE /sinopticos/:id (soft delete)
router.delete('/sinopticos/:id', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            'UPDATE scada.sinopticos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id, name',
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

// ═══════════════════════════════════════════
// SINOPTICO IMAGE UPLOADS
// ═══════════════════════════════════════════

// POST /sinopticos/:id/images — upload an image for a sinoptico canvas
router.post('/:id/images', canEditSinopticos, (req: Request, res: Response, next: Function) => {
    sinopticoUpload.single('image')(req, res, (err: any) => {
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
    if (!req.file) {
        return res.status(400).json({ error: 'No se envió ningún archivo.' });
    }

    try {
        // Verify sinoptico exists
        const sin = await pool.query(
            'SELECT id FROM scada.sinopticos WHERE id = $1 AND deleted_at IS NULL',
            [req.params.id]
        );
        if (sin.rows.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Sinoptico no encontrado.' });
        }

        const imageUrl = `/api/v1/sinopticos/${req.params.id}/images/${req.file.filename}`;

        res.json({
            url: imageUrl,
            filename: req.file.filename,
            message: 'Imagen subida correctamente.',
        });
    } catch (e: any) {
        console.error('Error uploading sinoptico image:', e.message);
        res.status(500).json({ error: 'Error al subir imagen.' });
    }
});

// GET /sinopticos/:id/images/:filename — serve uploaded image
// No auth — served as static resource for <img src="..."> tags
router.get('/:id/images/:filename', (req: Request, res: Response) => {
    const { id, filename } = req.params;
    // Sanitize filename to prevent path traversal
    const safeName = path.basename(filename);
    const filePath = path.join(SINOPTICO_UPLOADS_DIR, id, safeName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Imagen no encontrada.' });
    }

    res.sendFile(filePath);
});

// GET /sinopticos/:id/images — list all images for a sinoptico
router.get('/:id/images', isAuth, (req: Request, res: Response) => {
    const dir = path.join(SINOPTICO_UPLOADS_DIR, req.params.id);
    if (!fs.existsSync(dir)) {
        return res.json([]);
    }

    const files = fs.readdirSync(dir)
        .filter(f => /\.(png|jpe?g|webp|gif|svg)$/i.test(f))
        .map(f => ({
            filename: f,
            url: `/api/v1/sinopticos/${req.params.id}/images/${f}`,
        }));

    res.json(files);
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
        await auditLog(req.user!.id, 'SINOPTICO_DUPLICATED', { sinoptico_id: result.rows[0].id, original_id: req.params.id, name: result.rows[0].name }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        console.error('Error duplicating sinoptico:', e.message);
        res.status(500).json({ error: 'Error al duplicar sinoptico.' });
    }
});

// ═══════════════════════════════════════════
// TRASH (soft-deleted sinopticos)
// ═══════════════════════════════════════════

// GET /projects/:projectId/trash — list deleted sinopticos in project
router.get('/projects/:projectId/trash', isAuth, async (req: Request, res: Response) => {
    try {
        const { projectId } = req.params;
        const result = await pool.query(
            `SELECT id, name, description, version, deleted_at FROM scada.sinopticos
             WHERE project_id = $1 AND deleted_at IS NOT NULL
             ORDER BY deleted_at DESC`,
            [projectId]
        );
        res.json(result.rows);
    } catch (e: any) {
        console.error('Error listing trash:', e.message);
        res.status(500).json({ error: 'Error al listar papelera.' });
    }
});

// POST /sinopticos/:id/restore — restore a soft-deleted sinoptico
router.post('/sinopticos/:id/restore', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `UPDATE scada.sinopticos SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id, name`,
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Sinoptico not found in trash' });
        }
        await auditLog(req.user!.id, 'SINOPTICO_RESTORED', { sinoptico_id: id, name: result.rows[0].name }, req.ip!);
        res.json({ message: 'Restored', ...result.rows[0] });
    } catch (e: any) {
        console.error('Error restoring sinoptico:', e.message);
        res.status(500).json({ error: 'Error al restaurar sinoptico.' });
    }
});

// ═══════════════════════════════════════════
// SHARING
// ═══════════════════════════════════════════

// GET /sinopticos/:id/shares
router.get('/sinopticos/:id/shares', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT sh.id, sh.user_id, sh.permission, sh.created_at,
                    u.full_name, u.email, u.role_id, r.role_name, u.municipio_name
             FROM scada.sinoptico_shares sh
             JOIN scada.users u ON u.id = sh.user_id
             JOIN scada.roles r ON r.id = u.role_id
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
const VALID_PERMISSIONS = ['view', 'edit', 'create', 'delete', 'admin', 'read'];
const PERM_ALIASES: Record<string, string> = { read: 'view' };
router.post('/sinopticos/:id/shares', canEditSinopticos, async (req: Request, res: Response) => {
    const { user_id, permission } = req.body;
    // permission can be a single string or comma-separated: "view,edit"
    const perms = (typeof permission === 'string' ? permission : '').split(',')
        .map((p: string) => PERM_ALIASES[p.trim()] || p.trim()).filter(Boolean);
    if (!user_id || perms.length === 0 || !perms.every((p: string) => ['view', 'edit', 'create', 'delete', 'admin'].includes(p))) {
        return res.status(400).json({ error: 'user_id y permission son obligatorios. Valores: view, edit, create, delete, admin' });
    }
    // Normalize: sort and deduplicate, "admin" implies all
    const normalizedPerm = perms.includes('admin') ? 'admin' : [...new Set(perms)].sort().join(',');

    try {
        // Validate caller can share with this user (scope + role check)
        const target = await pool.query(
            'SELECT role_id, scope_id, estado_id FROM scada.users WHERE id = $1 AND is_active = true',
            [user_id]
        );
        if (target.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const t = target.rows[0];
        const caller = req.user!;

        // Role check: can't share with higher role (unless caller is Admin)
        if (t.role_id < caller.role_id && caller.role_id !== 1) {
            return res.status(403).json({ error: 'No puedes compartir con un usuario de rol superior.' });
        }

        // Scope check
        if (caller.scope === 'Municipal' && (t.scope_id !== caller.scope_id || t.estado_id !== caller.estado_id)) {
            return res.status(403).json({ error: 'Solo puedes compartir con usuarios de tu municipio.' });
        }
        if (caller.scope === 'Estatal' && t.estado_id !== caller.estado_id) {
            return res.status(403).json({ error: 'Solo puedes compartir con usuarios de tu estado.' });
        }

        const result = await pool.query(
            `INSERT INTO scada.sinoptico_shares (sinoptico_id, user_id, permission)
             VALUES ($1, $2, $3)
             ON CONFLICT (sinoptico_id, user_id) DO UPDATE SET permission = $3
             RETURNING *`,
            [req.params.id, user_id, normalizedPerm]
        );
        await auditLog(req.user!.id, 'SINOPTICO_SHARED', { sinoptico_id: req.params.id, shared_with: user_id, permission: normalizedPerm }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al compartir sinoptico.' });
    }
});

// DELETE /sinopticos/:id/shares/:shareId
router.delete('/sinopticos/:id/shares/:shareId', canEditSinopticos, async (req: Request, res: Response) => {
    try {
        await pool.query('DELETE FROM scada.sinoptico_shares WHERE id = $1 AND sinoptico_id = $2', [req.params.shareId, req.params.id]);
        await auditLog(req.user!.id, 'SINOPTICO_UNSHARED', { sinoptico_id: req.params.id, share_id: req.params.shareId }, req.ip!);
        res.json({ message: 'Permiso eliminado.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar permiso.' });
    }
});

// GET /sinopticos/:id/share-candidates — search users to share with (RBAC-filtered, excludes already shared)
router.get('/sinopticos/:id/share-candidates', isAuth, async (req: Request, res: Response) => {
    try {
        const user = req.user!;
        const sinopticoId = req.params.id;
        const q = ((req.query.q as string) || '').toLowerCase();

        const conditions: string[] = [
            'u.is_active = true',
            'u.id != $1',
            '(LOWER(u.full_name) LIKE $2 OR LOWER(u.email) LIKE $2)',
            'u.role_id >= $3',  // Can only share with same or lower role
            // Exclude users already shared with
            `u.id NOT IN (SELECT sh.user_id FROM scada.sinoptico_shares sh WHERE sh.sinoptico_id = $4)`,
        ];
        const values: any[] = [user.id, `%${q}%`, user.role_id, sinopticoId];

        // Scope filtering: Municipal sees only same municipality, Estatal sees same state
        if (user.scope === 'Municipal') {
            conditions.push(`u.scope_id = $${values.length + 1}`);
            values.push(user.scope_id);
            conditions.push(`u.estado_id = $${values.length + 1}`);
            values.push(user.estado_id);
        } else if (user.scope === 'Estatal') {
            conditions.push(`u.estado_id = $${values.length + 1}`);
            values.push(user.estado_id);
        }
        // Federal: no additional scope filter

        const result = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.role_id, r.role_name,
                    u.scope, u.municipio_name
             FROM scada.users u
             JOIN scada.roles r ON r.id = u.role_id
             WHERE ${conditions.join(' AND ')}
             ORDER BY u.full_name LIMIT 20`,
            values
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error searching share candidates:', err);
        res.status(500).json({ error: 'Error searching users' });
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

        // 1) Try site_status (PostgreSQL) first — fast, always fresh in production
        const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
        const results: Record<string, any> = {};
        const missingKeys: [string, { devEUI: string; measurement: string }][] = [];

        for (const [key, { devEUI, measurement }] of queries) {
            const field = measurementToField(measurement);
            if (ALLOWED_SITE_STATUS_FIELDS.has(field)) {
                const pgResult = await pool.query(
                    `SELECT ${field}, last_updated_at FROM scada.site_status WHERE TRIM(dev_eui) = $1`,
                    [devEUI.trim()]
                );
                const row = pgResult.rows[0];
                if (row && row[field] !== null && row[field] !== undefined) {
                    const age = Date.now() - new Date(row.last_updated_at).getTime();
                    if (age < STALE_THRESHOLD_MS) {
                        // Fresh data from PostgreSQL
                        results[key] = {
                            value: Number(row[field]),
                            last_updated_at: row.last_updated_at,
                        };
                        continue;
                    }
                }
            }
            missingKeys.push([key, { devEUI, measurement }]);
        }

        // 2) Fallback to InfluxDB for stale/missing values
        if (missingKeys.length > 0) {
            const influxPromises = missingKeys.map(async ([key, { devEUI, measurement }]) => {
                const latest = await getLatestValue(devEUI, measurement);
                if (latest.value !== null) {
                    results[key] = {
                        value: latest.value,
                        last_updated_at: latest.timestamp,
                    };
                }
            });
            await Promise.all(influxPromises);
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

                // Build column bindings: site_status first, InfluxDB fallback
                const bindings: Record<string, number | null> = {};
                const colPromises = colResult.rows.map(async (col: any, idx: number) => {
                    let val: number | null = null;
                    const field = measurementToField(col.measurement);

                    // Try site_status first
                    if (ALLOWED_SITE_STATUS_FIELDS.has(field)) {
                        const siteRow = await pool.query(
                            `SELECT ${field} FROM scada.site_status WHERE dev_eui = $1`,
                            [col.dev_eui]
                        );
                        const raw = siteRow.rows[0]?.[field] ?? null;
                        if (raw !== null) val = Number(raw);
                    }

                    // Fallback to InfluxDB
                    if (val === null) {
                        const latest = await getLatestValue(col.dev_eui, col.measurement);
                        val = latest.value !== null ? Number(latest.value) : null;
                    }

                    bindings[col.alias] = val;
                    bindings[`i_${idx + 1}`] = val;
                });
                await Promise.all(colPromises);

                // Evaluate all formulas in topological order
                const { values: evaluated } = evaluateFormulasBatch(
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
