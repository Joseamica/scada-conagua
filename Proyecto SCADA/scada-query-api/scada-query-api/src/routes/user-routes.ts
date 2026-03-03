import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { getAllUsers, softDeleteUser, updateUser, createUser, getScopedUsers, resetUserPassword, isEmailRegistered } from '../services/user-service';
import { getPermissions, upsertPermissions } from '../services/permission-service';
import { isAdmin } from '../middlewares/auth-middleware';
import { pool } from '../services/db-service';

const router = Router();

// Helper: parse and validate integer route param
const parseId = (raw: string): number | null => {
    const n = parseInt(raw, 10);
    return Number.isNaN(n) || n <= 0 ? null : n;
};

// Todas las rutas de gestión de usuarios requieren Admin
router.use(isAdmin);

// POST / — Crear usuario
router.post('/', async (req: Request, res: Response) => {
    const { email } = req.body;

    try {
        const alreadyExists = await isEmailRegistered(email);
        if (alreadyExists) {
            return res.status(409).json({ error: 'The email address is already registered.' });
        }

        const userId = await createUser(req.body);

        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [req.user!.id, 'CREATE_USER_SUCCESS', JSON.stringify({ email }), req.ip]
        );

        res.status(201).json({ id: userId, message: 'User created' });

    } catch (error: any) {
        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [req.user!.id, 'CREATE_USER_FAILED', JSON.stringify({ email, reason: error.message }), req.ip]
        );
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
    try {
        await updateUser(id, req.body);
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

        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [req.user!.id, 'ADMIN_PASSWORD_RESET', JSON.stringify({ target_user_id: targetId }), req.ip]
        );

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
    try {
        await upsertPermissions(userId, req.body);
        res.json({ message: 'Permissions updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update permissions' });
    }
});

export default router;
