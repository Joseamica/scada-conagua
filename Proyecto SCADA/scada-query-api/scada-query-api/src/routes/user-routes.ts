import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { getAllUsers, softDeleteUser, updateUser, createUser, getScopedUsers, resetUserPassword, isEmailRegistered } from '../services/user-service';
import { getPermissions, upsertPermissions } from '../services/permission-service';
import { isAdmin, isSupervisor } from '../middlewares/auth-middleware';
import { auditLog } from '../services/audit-service';
import { pool } from '../services/db-service';

const router = Router();

// Helper: parse and validate integer route param
const parseId = (raw: string): number | null => {
    const n = parseInt(raw, 10);
    return Number.isNaN(n) || n <= 0 ? null : n;
};

// User management: Admin has full access, Supervisor can manage subordinates (role > theirs, same scope)
router.use(isSupervisor);

// POST / — Crear usuario
router.post('/', async (req: Request, res: Response) => {
    const { email } = req.body;
    const caller = req.user!;

    // Supervisors can only create users with a LOWER role (Operador=3, Tecnico=4)
    if (caller.role_id === 2) {
        const targetRole = req.body.role_id || 4;
        if (targetRole <= 2) {
            return res.status(403).json({ error: 'Supervisores solo pueden crear Operadores y Técnicos.' });
        }
    }

    try {
        const alreadyExists = await isEmailRegistered(email);
        if (alreadyExists) {
            return res.status(409).json({ error: 'The email address is already registered.' });
        }

        const userId = await createUser(req.body);

        // Seed default permissions based on role (per CONAGUA questionnaire 2026-03-19)
        const roleId = req.body.role_id || 4;
        await upsertPermissions(userId, {
            can_view: true,
            can_edit: roleId <= 3,         // Admin, Supervisor, Operador
            can_export: roleId <= 3,       // Admin, Supervisor, Operador
            can_block: roleId === 1,       // Admin only
            can_operate: roleId <= 3,      // Admin, Supervisor, Operador (role still blocks pump control for Operador)
            can_edit_sinopticos: roleId <= 2, // Admin, Supervisor
        });

        await auditLog(req.user!.id, 'CREATE_USER_SUCCESS', { email }, req.ip!);

        res.status(201).json({ id: userId, message: 'User created' });

    } catch (error: any) {
        await auditLog(req.user!.id, 'CREATE_USER_FAILED', { email, reason: error.message }, req.ip!);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET / — Listar usuarios filtrados por scope del admin autenticado
// Optional query param: ?entityId=X filters by organizational entity
router.get('/', async (req: Request, res: Response) => {
    try {
        const { scope, scope_id, estado_id } = req.user!;
        const entityId = req.query.entityId ? parseInt(req.query.entityId as string) : undefined;
        const users = await getScopedUsers(scope, scope_id, estado_id, entityId);
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// PUT /:id — Editar usuario
router.put('/:id', async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user ID.' });

    // Supervisors can only edit subordinates (role > theirs)
    const caller = req.user!;
    if (caller.role_id === 2) {
        const target = await pool.query('SELECT role_id FROM scada.users WHERE id = $1', [id]);
        if (target.rows.length > 0 && target.rows[0].role_id <= 2) {
            return res.status(403).json({ error: 'Supervisores solo pueden editar Operadores y Técnicos.' });
        }
        // Prevent role escalation via edit
        if (req.body.role_id && req.body.role_id <= 2) {
            return res.status(403).json({ error: 'No puede asignar rol de Supervisor o Admin.' });
        }
    }

    try {
        await updateUser(id, req.body);
        const fieldsChanged = Object.keys(req.body);
        await auditLog(req.user!.id, 'UPDATE_USER', { target_user_id: id, fields_changed: fieldsChanged }, req.ip!);
        res.status(200).json({ message: 'User updated successfully' });
    } catch (error: any) {
        if (error.message === 'Invalid role_id. Must be between 1 and 4.') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// PATCH /:id/block — Revocar acceso (soft delete)
router.patch('/:id/block', async (req: Request, res: Response) => {
    const targetId = parseId(req.params.id);
    if (!targetId) return res.status(400).json({ error: 'Invalid user ID.' });

    // Supervisors can only block subordinates
    if (req.user!.role_id === 2) {
        const target = await pool.query('SELECT role_id FROM scada.users WHERE id = $1', [targetId]);
        if (target.rows.length > 0 && target.rows[0].role_id <= 2) {
            return res.status(403).json({ error: 'Supervisores solo pueden bloquear Operadores y Técnicos.' });
        }
    }

    const adminId = req.user?.id || 0;
    const clientIp = req.ip || '0.0.0.0';

    try {
        await softDeleteUser(targetId, adminId, clientIp);
        res.status(200).json({ message: 'User access revoked (Soft Delete)' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to revoke access' });
    }
});

// POST /:id/reset-password — Resetear contraseña
router.post('/:id/reset-password', async (req: Request, res: Response) => {
    const targetId = parseId(req.params.id);
    if (!targetId) return res.status(400).json({ error: 'Invalid user ID.' });
    const { newPassword } = req.body;

    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(newPassword, salt);

        await resetUserPassword(targetId, hash);

        await auditLog(req.user!.id, 'ADMIN_PASSWORD_RESET', { target_user_id: targetId }, req.ip!);

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        res.status(500).json({ error: 'Error resetting password' });
    }
});

// GET /:id/permissions — Get user permissions
router.get('/:id/permissions', async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid user ID.' });
    try {
        const perms = await getPermissions(id);
        if (!perms) {
            return res.status(404).json({ error: 'Permissions not found' });
        }
        res.json(perms);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

// PUT /:id/permissions — Update user permissions
router.put('/:id/permissions', async (req: Request, res: Response) => {
    const userId = parseId(req.params.id);
    if (!userId) return res.status(400).json({ error: 'Invalid user ID.' });

    // Supervisors can only edit permissions of subordinates
    if (req.user!.role_id === 2) {
        const target = await pool.query('SELECT role_id FROM scada.users WHERE id = $1', [userId]);
        if (target.rows.length > 0 && target.rows[0].role_id <= 2) {
            return res.status(403).json({ error: 'Supervisores solo pueden editar permisos de Operadores y Técnicos.' });
        }
    }

    try {
        await upsertPermissions(userId, req.body);
        await auditLog(req.user!.id, 'PERMISSION_UPDATED', { target_user_id: userId, permissions: req.body }, req.ip!);
        res.json({ message: 'Permissions updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update permissions' });
    }
});

export default router;
