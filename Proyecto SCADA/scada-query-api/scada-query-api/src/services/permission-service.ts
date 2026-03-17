import { pool } from './db-service';

export interface IPermissions {
    user_id: number;
    can_view: boolean;
    can_edit: boolean;
    can_export: boolean;
    can_block: boolean;
    can_operate: boolean;
    can_edit_sinopticos: boolean;
}

export const getPermissions = async (userId: number): Promise<IPermissions | null> => {
    const result = await pool.query(
        `SELECT user_id, can_view, can_edit, can_export, can_block, can_operate, can_edit_sinopticos
         FROM scada.permissions WHERE user_id = $1`,
        [userId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const upsertPermissions = async (userId: number, perms: Partial<IPermissions>): Promise<void> => {
    await pool.query(
        `INSERT INTO scada.permissions (user_id, can_view, can_edit, can_export, can_block, can_operate, can_edit_sinopticos)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE SET
           can_view = EXCLUDED.can_view,
           can_edit = EXCLUDED.can_edit,
           can_export = EXCLUDED.can_export,
           can_block = EXCLUDED.can_block,
           can_operate = EXCLUDED.can_operate,
           can_edit_sinopticos = EXCLUDED.can_edit_sinopticos`,
        [
            userId,
            perms.can_view ?? true,
            perms.can_edit ?? false,
            perms.can_export ?? false,
            perms.can_block ?? false,
            perms.can_operate ?? false,
            perms.can_edit_sinopticos ?? false
        ]
    );
};
