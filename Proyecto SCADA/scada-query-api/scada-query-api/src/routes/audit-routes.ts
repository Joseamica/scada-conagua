import { Router, Request, Response } from 'express';
import { pool } from '../services/db-service';
import { isAuth, isSupervisor } from '../middlewares/auth-middleware';
import { auditLog, AuditAction } from '../services/audit-service';

const router = Router();

// POST /navigation — Log module navigation and client-side events
router.post('/navigation', isAuth, async (req: Request, res: Response) => {
    const { module, action, entity, entityId, details } = req.body;
    const userId = req.user?.id ?? null;
    const clientIp = req.ip || '0.0.0.0';

    const auditAction: AuditAction = action || 'NAVIGATE_TO_MODULE';
    const auditDetails: Record<string, any> = {
        module_name: module,
        ...(entity && { entity }),
        ...(entityId && { entity_id: entityId }),
        ...(details && { ...details }),
    };

    try {
        await auditLog(userId, auditAction, auditDetails, clientIp);
        res.status(200).json({ message: 'Event logged' });
    } catch (error) {
        console.error('>>> [Audit Error]:', error);
        res.status(500).json({ error: 'Failed to record audit log' });
    }
});

// GET /logs — Paginated audit log listing with filters (supervisor+ only)
router.get('/logs', isSupervisor, async (req: Request, res: Response) => {
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const offset = (page - 1) * limit;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const rawUserId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const userId = rawUserId && !Number.isNaN(rawUserId) && rawUserId > 0 ? rawUserId : undefined;

    try {
        const conditions: string[] = [];
        const values: any[] = [];

        if (from) {
            values.push(from);
            conditions.push(`a.created_at >= $${values.length}`);
        }
        if (to) {
            values.push(to);
            conditions.push(`a.created_at <= $${values.length}`);
        }
        if (userId) {
            values.push(userId);
            conditions.push(`a.user_id = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Count total for pagination
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM scada.audit_logs a ${whereClause}`,
            values
        );
        const total = parseInt(countResult.rows[0].count);

        // Fetch page
        const dataValues = [...values, limit, offset];
        const dataResult = await pool.query(
            `SELECT a.id, a.user_id, u.full_name, u.email, r.role_name, u.scope,
                    e.name AS entity_name,
                    a.action, a.details, a.ip_address, a.created_at
             FROM scada.audit_logs a
             LEFT JOIN scada.users u ON a.user_id = u.id
             LEFT JOIN scada.roles r ON u.role_id = r.id
             LEFT JOIN scada.entities e ON u.entity_id = e.id
             ${whereClause}
             ORDER BY a.created_at DESC
             LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
            dataValues
        );

        res.json({
            data: dataResult.rows,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// GET /logs/export — CSV export of audit logs (supervisor+ only)
router.get('/logs/export', isSupervisor, async (req: Request, res: Response) => {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const rawUserId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const userId = rawUserId && !Number.isNaN(rawUserId) && rawUserId > 0 ? rawUserId : undefined;

    try {
        const conditions: string[] = [];
        const values: any[] = [];

        if (from) {
            values.push(from);
            conditions.push(`a.created_at >= $${values.length}`);
        }
        if (to) {
            values.push(to);
            conditions.push(`a.created_at <= $${values.length}`);
        }
        if (userId) {
            values.push(userId);
            conditions.push(`a.user_id = $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const result = await pool.query(
            `SELECT a.id, u.full_name, u.email, r.role_name, u.scope,
                    e.name AS entity_name,
                    a.action, a.details, a.ip_address, a.created_at
             FROM scada.audit_logs a
             LEFT JOIN scada.users u ON a.user_id = u.id
             LEFT JOIN scada.roles r ON u.role_id = r.id
             LEFT JOIN scada.entities e ON u.entity_id = e.id
             ${whereClause}
             ORDER BY a.created_at DESC`,
            values
        );

        // Build CSV
        const header = 'ID,Usuario,Email,Rol,Nivel,Municipio,Accion,Detalles,IP,Fecha\n';
        const rows = result.rows.map(r => {
            const details = typeof r.details === 'string' ? r.details : JSON.stringify(r.details);
            return [
                r.id,
                `"${(r.full_name || '').replace(/"/g, '""')}"`,
                r.email || '',
                r.role_name || '',
                r.scope || '',
                r.entity_name || '',
                r.action,
                `"${details.replace(/"/g, '""')}"`,
                r.ip_address || '',
                r.created_at ? new Date(r.created_at).toISOString() : ''
            ].join(',');
        }).join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=audit_logs.csv');
        res.send(header + rows);
    } catch (error) {
        console.error('Error exporting audit logs:', error);
        res.status(500).json({ error: 'Failed to export audit logs' });
    }
});

export default router;
