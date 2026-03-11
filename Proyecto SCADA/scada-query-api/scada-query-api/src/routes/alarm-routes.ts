// src/routes/alarm-routes.ts — Alarm CRUD, ACK, history, recipients, collections
import { Router, Request, Response } from 'express';
import { pool } from '../services/db-service';
import { isAuth, isSupervisor } from '../middlewares/auth-middleware';
import { auditLog } from '../services/audit-service';

const router = Router();

// ═══════════════════════════════════════════
// ALARM GROUPS — hierarchical grouping
// ═══════════════════════════════════════════

router.get('/groups', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT g.*,
                    (SELECT COUNT(*) FROM scada.alarms a WHERE a.group_id = g.id) AS alarm_count,
                    u.full_name AS created_by_name
             FROM scada.alarm_groups g
             LEFT JOIN scada.users u ON u.id = g.created_by
             ORDER BY g.name`
        );
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al listar grupos.' });
    }
});

router.post('/groups', isSupervisor, async (req: Request, res: Response) => {
    const { name, description, parent_group_id, municipality, estado_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre obligatorio.' });

    try {
        const result = await pool.query(
            `INSERT INTO scada.alarm_groups (name, description, parent_group_id, municipality, estado_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name.trim(), description || null, parent_group_id || null, municipality || null, estado_id || 0, req.user!.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear grupo.' });
    }
});

router.put('/groups/:id', isSupervisor, async (req: Request, res: Response) => {
    const { name, description, parent_group_id, municipality, estado_id, is_enabled } = req.body;
    try {
        const result = await pool.query(
            `UPDATE scada.alarm_groups
             SET name = COALESCE($1, name), description = $2, parent_group_id = $3,
                 municipality = $4, estado_id = COALESCE($5, estado_id),
                 is_enabled = COALESCE($6, is_enabled), updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [name?.trim(), description, parent_group_id, municipality, estado_id, is_enabled, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Grupo no encontrado.' });
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar grupo.' });
    }
});

router.delete('/groups/:id', isSupervisor, async (req: Request, res: Response) => {
    try {
        const result = await pool.query('DELETE FROM scada.alarm_groups WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Grupo no encontrado.' });
        res.json({ message: 'Grupo eliminado.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar grupo.' });
    }
});

// ═══════════════════════════════════════════
// ALARMS — threshold-based rules
// ═══════════════════════════════════════════

router.get('/', isAuth, async (req: Request, res: Response) => {
    const { group_id } = req.query;
    try {
        let sql = `
            SELECT a.*, g.name AS group_name,
                   s.current_state, s.last_value, s.last_evaluated_at,
                   s.acknowledged_at, s.ack_comment
            FROM scada.alarms a
            JOIN scada.alarm_groups g ON g.id = a.group_id
            LEFT JOIN scada.alarm_state s ON s.alarm_id = a.id
        `;
        const params: any[] = [];
        if (group_id) {
            sql += ' WHERE a.group_id = $1';
            params.push(group_id);
        }
        sql += ' ORDER BY a.created_at DESC';

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al listar alarmas.' });
    }
});

router.post('/', isSupervisor, async (req: Request, res: Response) => {
    const {
        group_id, name, description, severity, dev_eui, measurement,
        comparison_operator, threshold_value,
        hysteresis_activation_sec, hysteresis_deactivation_sec,
        action_type, notify_on_state_change, notification_template,
        resend_period_min, resend_enabled, play_sound, show_banner,
    } = req.body;

    if (!group_id || !name?.trim() || !dev_eui || !measurement || !comparison_operator || threshold_value === undefined) {
        return res.status(400).json({ error: 'Campos obligatorios: group_id, name, dev_eui, measurement, comparison_operator, threshold_value.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO scada.alarms
             (group_id, name, description, severity, dev_eui, measurement,
              comparison_operator, threshold_value,
              hysteresis_activation_sec, hysteresis_deactivation_sec,
              action_type, notify_on_state_change, notification_template,
              resend_period_min, resend_enabled, play_sound, show_banner, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
            [
                group_id, name.trim(), description || null, severity || 'aviso',
                dev_eui, measurement, comparison_operator, threshold_value,
                hysteresis_activation_sec || 0, hysteresis_deactivation_sec || 0,
                action_type || 'none', notify_on_state_change ?? true, notification_template || null,
                resend_period_min || 1440, resend_enabled ?? false,
                play_sound ?? false, show_banner ?? false, req.user!.id,
            ]
        );

        // Create initial alarm state
        await pool.query(
            'INSERT INTO scada.alarm_state (alarm_id) VALUES ($1)',
            [result.rows[0].id]
        );

        await auditLog(req.user!.id, 'ALARM_CREATED', { alarm_id: result.rows[0].id, name, dev_eui }, req.ip!);
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        console.error('Error creating alarm:', e.message);
        res.status(500).json({ error: 'Error al crear alarma.' });
    }
});

router.put('/:id', isSupervisor, async (req: Request, res: Response) => {
    const {
        name, description, severity, is_enabled, dev_eui, measurement,
        comparison_operator, threshold_value,
        hysteresis_activation_sec, hysteresis_deactivation_sec,
        action_type, notify_on_state_change, notification_template,
        resend_period_min, resend_enabled, play_sound, show_banner,
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE scada.alarms SET
                name = COALESCE($1, name), description = $2, severity = COALESCE($3, severity),
                is_enabled = COALESCE($4, is_enabled), dev_eui = COALESCE($5, dev_eui),
                measurement = COALESCE($6, measurement),
                comparison_operator = COALESCE($7, comparison_operator),
                threshold_value = COALESCE($8, threshold_value),
                hysteresis_activation_sec = COALESCE($9, hysteresis_activation_sec),
                hysteresis_deactivation_sec = COALESCE($10, hysteresis_deactivation_sec),
                action_type = COALESCE($11, action_type),
                notify_on_state_change = COALESCE($12, notify_on_state_change),
                notification_template = $13,
                resend_period_min = COALESCE($14, resend_period_min),
                resend_enabled = COALESCE($15, resend_enabled),
                play_sound = COALESCE($16, play_sound),
                show_banner = COALESCE($17, show_banner),
                updated_at = NOW()
             WHERE id = $18 RETURNING *`,
            [
                name?.trim(), description, severity, is_enabled, dev_eui, measurement,
                comparison_operator, threshold_value,
                hysteresis_activation_sec, hysteresis_deactivation_sec,
                action_type, notify_on_state_change, notification_template,
                resend_period_min, resend_enabled, play_sound, show_banner, req.params.id,
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Alarma no encontrada.' });
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar alarma.' });
    }
});

router.delete('/:id', isSupervisor, async (req: Request, res: Response) => {
    try {
        const result = await pool.query('DELETE FROM scada.alarms WHERE id = $1 RETURNING id, name', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Alarma no encontrada.' });
        await auditLog(req.user!.id, 'ALARM_DELETED', { alarm_id: req.params.id, name: result.rows[0].name }, req.ip!);
        res.json({ message: 'Alarma eliminada.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar alarma.' });
    }
});

// ═══════════════════════════════════════════
// ACTIVE ALARMS — polling endpoint (15s frontend)
// ═══════════════════════════════════════════

router.get('/active', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT a.id, a.name, a.severity, a.dev_eui, a.measurement,
                    a.comparison_operator, a.threshold_value,
                    a.play_sound, a.show_banner,
                    s.current_state, s.last_value, s.last_triggered_at,
                    s.acknowledged_by, s.acknowledged_at, s.ack_comment,
                    g.name AS group_name, i.site_name, i.municipality
             FROM scada.alarms a
             JOIN scada.alarm_state s ON s.alarm_id = a.id
             JOIN scada.alarm_groups g ON g.id = a.group_id
             LEFT JOIN scada.inventory i ON TRIM(i.dev_eui) = TRIM(a.dev_eui)
             WHERE s.current_state != 'INACTIVE' AND a.is_enabled = true
             ORDER BY
                CASE a.severity WHEN 'critico' THEN 1 WHEN 'alerta' THEN 2 WHEN 'aviso' THEN 3 END,
                s.last_triggered_at DESC`
        );
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al obtener alarmas activas.' });
    }
});

// POST /:id/acknowledge — ACK an alarm (requires comment)
router.post('/:id/acknowledge', isAuth, async (req: Request, res: Response) => {
    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ error: 'Comentario obligatorio para reconocer alarma.' });

    try {
        const alarm = await pool.query(
            'SELECT a.name, s.current_state FROM scada.alarms a JOIN scada.alarm_state s ON s.alarm_id = a.id WHERE a.id = $1',
            [req.params.id]
        );
        if (alarm.rows.length === 0) return res.status(404).json({ error: 'Alarma no encontrada.' });
        if (alarm.rows[0].current_state !== 'ACTIVE_UNACK') {
            return res.status(400).json({ error: 'La alarma no esta en estado ACTIVE_UNACK.' });
        }

        const previousState = alarm.rows[0].current_state;

        await pool.query(
            `UPDATE scada.alarm_state
             SET current_state = 'ACTIVE_ACK', acknowledged_by = $1, acknowledged_at = NOW(), ack_comment = $2, updated_at = NOW()
             WHERE alarm_id = $3`,
            [req.user!.id, comment.trim(), req.params.id]
        );

        // Log to history
        await pool.query(
            `INSERT INTO scada.alarm_history (alarm_id, alarm_name, severity, previous_state, new_state, transition_reason, user_id, ack_comment)
             SELECT a.id, a.name, a.severity, $1, 'ACTIVE_ACK', 'User acknowledged', $2, $3
             FROM scada.alarms a WHERE a.id = $4`,
            [previousState, req.user!.id, comment.trim(), req.params.id]
        );

        await auditLog(req.user!.id, 'ALARM_ACKNOWLEDGED', { alarm_id: req.params.id, comment }, req.ip!);
        res.json({ message: 'Alarma reconocida.' });
    } catch (e: any) {
        console.error('Error acknowledging alarm:', e.message);
        res.status(500).json({ error: 'Error al reconocer alarma.' });
    }
});

// ═══════════════════════════════════════════
// ALARM HISTORY — 5-year retention
// ═══════════════════════════════════════════

router.get('/history', isAuth, async (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;
    const { from, to, severity, dev_eui } = req.query;

    try {
        let where = 'WHERE 1=1';
        const params: any[] = [];

        if (from) {
            params.push(from);
            where += ` AND h.created_at >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            where += ` AND h.created_at <= $${params.length}`;
        }
        if (severity) {
            params.push(severity);
            where += ` AND h.severity = $${params.length}`;
        }
        if (dev_eui) {
            params.push(dev_eui);
            where += ` AND h.dev_eui = $${params.length}`;
        }

        const countResult = await pool.query(`SELECT COUNT(*) FROM scada.alarm_history h ${where}`, params);
        const total = parseInt(countResult.rows[0].count);

        params.push(limit, offset);
        const result = await pool.query(
            `SELECT h.*, u.full_name AS user_name
             FROM scada.alarm_history h
             LEFT JOIN scada.users u ON u.id = h.user_id
             ${where}
             ORDER BY h.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json({ data: result.rows, total, page, limit });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al obtener historial.' });
    }
});

// GET /history/export — CSV export
router.get('/history/export', isAuth, async (req: Request, res: Response) => {
    const { from, to } = req.query;
    try {
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (from) { params.push(from); where += ` AND h.created_at >= $${params.length}`; }
        if (to) { params.push(to); where += ` AND h.created_at <= $${params.length}`; }

        const result = await pool.query(
            `SELECT h.created_at, h.alarm_name, h.dev_eui, h.group_name, h.severity,
                    h.previous_state, h.new_state, h.trigger_value, h.threshold_value,
                    h.transition_reason, h.ack_comment, u.full_name AS user_name
             FROM scada.alarm_history h
             LEFT JOIN scada.users u ON u.id = h.user_id
             ${where}
             ORDER BY h.created_at DESC
             LIMIT 10000`,
            params
        );

        const headers = ['Fecha', 'Alarma', 'DevEUI', 'Grupo', 'Severidad', 'Estado Anterior', 'Nuevo Estado', 'Valor', 'Umbral', 'Razon', 'Comentario ACK', 'Usuario'];
        const csvRows = [headers.join(',')];
        for (const row of result.rows) {
            const safe = (v: any) => {
                const s = String(v ?? '');
                return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
            };
            csvRows.push([
                row.created_at, row.alarm_name, row.dev_eui, row.group_name, row.severity,
                row.previous_state, row.new_state, row.trigger_value, row.threshold_value,
                row.transition_reason, row.ack_comment, row.user_name,
            ].map(safe).join(','));
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=alarm_history.csv');
        res.send('\uFEFF' + csvRows.join('\n'));
    } catch (e: any) {
        res.status(500).json({ error: 'Error al exportar historial.' });
    }
});

// ═══════════════════════════════════════════
// RECIPIENTS — master contact list
// ═══════════════════════════════════════════

router.get('/recipients', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT r.*, u.full_name AS created_by_name
             FROM scada.alarm_recipients r
             LEFT JOIN scada.users u ON u.id = r.created_by
             ORDER BY r.contact_name`
        );
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al listar destinatarios.' });
    }
});

router.post('/recipients', isSupervisor, async (req: Request, res: Response) => {
    const { contact_name, email, phone, telegram_username, telegram_chat_id, telegram_enabled, comments } = req.body;
    if (!contact_name?.trim()) return res.status(400).json({ error: 'Nombre de contacto obligatorio.' });
    try {
        const result = await pool.query(
            `INSERT INTO scada.alarm_recipients (contact_name, email, phone, telegram_username, telegram_chat_id, telegram_enabled, comments, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [contact_name.trim(), email || null, phone || null, telegram_username || null, telegram_chat_id || null, telegram_enabled ?? false, comments || null, req.user!.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear destinatario.' });
    }
});

router.put('/recipients/:id', isSupervisor, async (req: Request, res: Response) => {
    const { contact_name, email, phone, telegram_username, telegram_chat_id, telegram_enabled, comments } = req.body;
    try {
        const result = await pool.query(
            `UPDATE scada.alarm_recipients SET
                contact_name = COALESCE($1, contact_name), email = $2, phone = $3,
                telegram_username = $4, telegram_chat_id = $5, telegram_enabled = COALESCE($6, telegram_enabled),
                comments = $7
             WHERE id = $8 RETURNING *`,
            [contact_name?.trim(), email, phone, telegram_username, telegram_chat_id, telegram_enabled, comments, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Destinatario no encontrado.' });
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar destinatario.' });
    }
});

router.delete('/recipients/:id', isSupervisor, async (req: Request, res: Response) => {
    try {
        const result = await pool.query('DELETE FROM scada.alarm_recipients WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Destinatario no encontrado.' });
        res.json({ message: 'Destinatario eliminado.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar destinatario.' });
    }
});

// ═══════════════════════════════════════════
// COLLECTIONS — named groups of recipients
// ═══════════════════════════════════════════

router.get('/collections', isAuth, async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            `SELECT c.*,
                    (SELECT COUNT(*) FROM scada.alarm_collection_members m WHERE m.collection_id = c.id) AS member_count
             FROM scada.alarm_recipient_collections c
             ORDER BY c.name`
        );
        res.json(result.rows);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al listar colecciones.' });
    }
});

router.post('/collections', isSupervisor, async (req: Request, res: Response) => {
    const { name, description, recipient_ids } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre obligatorio.' });
    try {
        const result = await pool.query(
            'INSERT INTO scada.alarm_recipient_collections (name, description, created_by) VALUES ($1, $2, $3) RETURNING *',
            [name.trim(), description || null, req.user!.id]
        );
        // Add members if provided
        if (Array.isArray(recipient_ids) && recipient_ids.length > 0) {
            const values = recipient_ids.map((rid: number) => `(${result.rows[0].id}, ${parseInt(String(rid))})`).join(',');
            await pool.query(`INSERT INTO scada.alarm_collection_members (collection_id, recipient_id) VALUES ${values} ON CONFLICT DO NOTHING`);
        }
        res.status(201).json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al crear coleccion.' });
    }
});

router.put('/collections/:id', isSupervisor, async (req: Request, res: Response) => {
    const { name, description, recipient_ids } = req.body;
    try {
        const result = await pool.query(
            'UPDATE scada.alarm_recipient_collections SET name = COALESCE($1, name), description = $2 WHERE id = $3 RETURNING *',
            [name?.trim(), description, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Coleccion no encontrada.' });

        // Replace members if provided
        if (Array.isArray(recipient_ids)) {
            await pool.query('DELETE FROM scada.alarm_collection_members WHERE collection_id = $1', [req.params.id]);
            if (recipient_ids.length > 0) {
                const values = recipient_ids.map((rid: number) => `(${parseInt(req.params.id)}, ${parseInt(String(rid))})`).join(',');
                await pool.query(`INSERT INTO scada.alarm_collection_members (collection_id, recipient_id) VALUES ${values}`);
            }
        }
        res.json(result.rows[0]);
    } catch (e: any) {
        res.status(500).json({ error: 'Error al actualizar coleccion.' });
    }
});

router.delete('/collections/:id', isSupervisor, async (req: Request, res: Response) => {
    try {
        const result = await pool.query('DELETE FROM scada.alarm_recipient_collections WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Coleccion no encontrada.' });
        res.json({ message: 'Coleccion eliminada.' });
    } catch (e: any) {
        res.status(500).json({ error: 'Error al eliminar coleccion.' });
    }
});

export default router;
