// src/services/user-service.ts

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from './db-service';
import { ICreateUserRequest, IUser, ILoginRequest } from '../interfaces/user.interface';

const JWT_SECRET = process.env['JWT_SECRET'] as string;

export const createUser = async (userData: ICreateUserRequest): Promise<number> => {
    const { full_name, last_name, email, password, role_id, phone, scope, scope_id, estado_id, estado_name, municipio_name, entity_id } = userData;

    // Double check within the service to prevent race conditions
    const exists = await isEmailRegistered(email);
    if (exists) {
        throw new Error('EMAIL_ALREADY_EXISTS');
    }

    // Hashing the password with a salt factor of 10
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const query = `
        INSERT INTO scada.users (
            full_name, last_name, email, password_hash, role_id, phone, scope, scope_id, estado_id, estado_name, municipio_name, entity_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id;
    `;

    const values = [full_name, last_name, email, passwordHash, role_id, phone, scope, scope_id, estado_id, estado_name, municipio_name, entity_id || null];

    try {
        const result = await pool.query(query, values);
        return result.rows[0].id;
    } catch (error) {
        console.error('Error creating user in DB:', error);
        throw new Error('Database insertion failed');
    }
};

// Columns needed for authentication flows (includes password_hash and totp_secret for verification)
const AUTH_COLUMNS = `id, full_name, last_name, email, password_hash, role_id, phone,
    is_2fa_enabled, is_blocked, scope, scope_id, estado_id, estado_name, municipio_name,
    two_factor_token, token_expiry, failed_attempts, locked_until,
    totp_enabled, totp_secret, entity_id, created_at`;

// Columns for safe reads (never includes password_hash or totp_secret)
const SAFE_COLUMNS = `id, full_name, last_name, email, role_id, phone,
    is_2fa_enabled, is_blocked, scope, scope_id, estado_id, estado_name, municipio_name,
    failed_attempts, locked_until, totp_enabled, entity_id, created_at`;

export const findUserByEmail = async (email: string): Promise<IUser | null> => {
    const query = `SELECT ${AUTH_COLUMNS} FROM scada.users WHERE email = $1`;
    const result = await pool.query(query, [email]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

export const isEmailRegistered = async (email: string): Promise<boolean> => {
    const query = 'SELECT id FROM scada.users WHERE email = $1 LIMIT 1';
    const result = await pool.query(query, [email]);
    return result.rowCount ? result.rowCount > 0 : false;
};

export const getScopedUsers = async (adminScope: string, adminScopeId: number, adminEstadoId: number, entityId?: number): Promise<any[]> => {
    const conditions: string[] = [];
    const values: any[] = [];

    // Build query — use recursive CTE when filtering by entity (includes children)
    let cte = '';
    if (entityId) {
        cte = `WITH RECURSIVE entity_tree AS (
            SELECT id FROM scada.entities WHERE id = $${values.length + 1}
            UNION ALL
            SELECT e.id FROM scada.entities e JOIN entity_tree et ON e.parent_id = et.id
        ) `;
        values.push(entityId);
        conditions.push(`u.entity_id IN (SELECT id FROM entity_tree)`);
    }

    let query = cte + `
        SELECT u.id, u.full_name, u.last_name, u.email, u.role_id, r.role_name,
               u.is_2fa_enabled, u.is_blocked, u.scope, u.scope_id, u.estado_id,
               u.estado_name, u.municipio_name, u.entity_id, e.name AS entity_name, u.created_at
        FROM scada.users u
        JOIN scada.roles r ON u.role_id = r.id
        LEFT JOIN scada.entities e ON u.entity_id = e.id
    `;

    // Lógica Jerárquica planteada:
    if (adminScope === 'Estatal') {
        conditions.push(`u.estado_id = $${values.length + 1}`);
        values.push(adminEstadoId);
    } else if (adminScope === 'Municipio') {
        conditions.push(`u.estado_id = $${values.length + 1}`);
        values.push(adminEstadoId);
        conditions.push(`u.scope_id = $${values.length + 1}`);
        values.push(adminScopeId);
    }

    if (conditions.length > 0) {
        query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY u.full_name ASC`;
    const result = await pool.query(query, values);
    return result.rows;
};

// Updates user details. Only updates fields present in userData (partial update).
export const updateUser = async (id: number, userData: any): Promise<void> => {
    // Validate role_id range to prevent privilege escalation (guards use role_id <= N)
    if (userData.role_id !== undefined) {
        const roleId = Number(userData.role_id);
        if (!Number.isInteger(roleId) || roleId < 1 || roleId > 4) {
            throw new Error('Invalid role_id. Must be between 1 and 4.');
        }
        userData.role_id = roleId;
    }

    const allowedFields: Record<string, string> = {
        full_name: 'full_name',
        last_name: 'last_name',
        email: 'email',
        role_id: 'role_id',
        phone: 'phone',
        is_2fa_enabled: 'is_2fa_enabled',
        is_active: 'is_active',
        scope: 'scope',
        scope_id: 'scope_id',
        estado_id: 'estado_id',
        estado_name: 'estado_name',
        municipio_name: 'municipio_name',
        entity_id: 'entity_id'
    };

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const [key, column] of Object.entries(allowedFields)) {
        if (userData[key] !== undefined) {
            values.push(userData[key]);
            setClauses.push(`${column} = $${values.length}`);
        }
    }

    if (setClauses.length === 0) {
        return; // Nothing to update
    }

    values.push(id);
    const query = `UPDATE scada.users SET ${setClauses.join(', ')} WHERE id = $${values.length}`;

    try {
        await pool.query(query, values);
        console.log(`[OCI] Usuario ID ${id} actualizado con éxito.`);
    } catch (error) {
        console.error('>>> [DB Error] updateUser failed:', error);
        throw new Error('Database update failed');
    }
};

export const verifyCredentials = async (loginData: ILoginRequest): Promise<IUser | null> => {
    const user = await findUserByEmail(loginData.email);

    if (!user || user.is_blocked) return null;

    // Check if account is temporarily locked (Brute force protection)
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
        throw new Error('Account is temporarily locked due to multiple failed attempts.');
    }

    const isMatch = await bcrypt.compare(loginData.password, user.password_hash);

    if (isMatch) {
        // Reset failed attempts on success
        await pool.query('UPDATE scada.users SET failed_attempts = 0, last_login = NOW() WHERE id = $1', [user.id]);
        return user;
    } else {
        // Increment failed attempts
        await pool.query('UPDATE scada.users SET failed_attempts = failed_attempts + 1 WHERE id = $1', [user.id]);

        // Logical lock if attempts > 5
        if (user.failed_attempts + 1 >= 5) {
            await pool.query(
                "UPDATE scada.users SET locked_until = NOW() + interval '15 minutes' WHERE id = $1",
                [user.id]
            );
        }
        return null;
    }
};

// Generates a random 6-digit code, sets a 10-minute expiry, and saves it to the user record.
export const generateAndSave2FACode = async (userId: number): Promise<string> => {
    // Generate a numeric string of 6 digits
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set expiry for 10 minutes from now
    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 10);

    const query = `
        UPDATE scada.users 
        SET two_factor_token = $1, 
            token_expiry = $2,
            failed_attempts = 0 
        WHERE id = $3
    `;

    try {
        await pool.query(query, [code, expiry, userId]);
        return code;
    } catch (error) {
        console.error('>>> [Database Error] Failed to save 2FA token:', error);
        throw new Error('Could not generate security token');
    }
};

// Validate the 2FA code and check for expiration (10 minutes)
export const validate2FACode = async (email: string, code: string): Promise<IUser | null> => {
    const query = `
        SELECT ${AUTH_COLUMNS} FROM scada.users
        WHERE email = $1
        AND two_factor_token = $2
        AND token_expiry > NOW()
        AND is_blocked = false;
    `;

    const result = await pool.query(query, [email, code]);

    if (result.rows.length > 0) {
        return result.rows[0];
    }
    return null;
};

export const generateTempToken = (userId: number): string => {
    return jwt.sign({ userId, type: '2FA_PENDING' }, JWT_SECRET, { expiresIn: '5m' });
};

// Clear security tokens after successful validation
export const clearUser2FAToken = async (userId: number): Promise<void> => {
    await pool.query(
        'UPDATE scada.users SET two_factor_token = NULL, token_expiry = NULL, failed_attempts = 0 WHERE id = $1',
        [userId]
    );
};

// List all users including their block status
export const getAllUsers = async (): Promise<IUser[]> => {
    const query = `
        SELECT id, full_name, last_name, email, role_id, phone, is_2fa_enabled, is_blocked, scope, scope_id, created_at
        FROM scada.users
        ORDER BY is_blocked ASC, full_name ASC;
    `;
    const result = await pool.query(query);
    return result.rows;
};

// Logical delete (Soft Delete) by toggling is_blocked
export const softDeleteUser = async (targetId: number, adminId: number, ip: string): Promise<void> => {
    const query = 'UPDATE scada.users SET is_blocked = true WHERE id = $1';

    await pool.query('BEGIN'); // Transactional to ensure log consistency
    try {
        await pool.query(query, [targetId]);
        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [adminId, 'USER_SOFT_DELETE', JSON.stringify({ target_user_id: targetId }), ip]
        );
        await pool.query('COMMIT');
    } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
    }
};

// English: Simple password reset by an administrator
export const resetUserPassword = async (targetUserId: number, newHash: string): Promise<void> => {
    await pool.query(
        'UPDATE scada.users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE id = $2',
        [newHash, targetUserId]
    );
};

export const adminResetPassword = async (targetId: number, adminId: number, newHash: string, ip: string) => {
    await pool.query('BEGIN');
    try {
        await pool.query('UPDATE scada.users SET password_hash = $1, failed_attempts = 0 WHERE id = $2', [newHash, targetId]);
        await pool.query('INSERT INTO scada.audit_logs (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
            [adminId, 'ADMIN_RESET_PWD', JSON.stringify({ target_user_id: targetId }), ip]);
        await pool.query('COMMIT');
    } catch (e) { await pool.query('ROLLBACK'); throw e; }
};

// ── TOTP (Google Authenticator) ──

export const saveTotpSecret = async (userId: number, secret: string): Promise<void> => {
    await pool.query(
        'UPDATE scada.users SET totp_secret = $1 WHERE id = $2',
        [secret, userId]
    );
};

export const enableTotp = async (userId: number): Promise<void> => {
    await pool.query(
        'UPDATE scada.users SET totp_enabled = true WHERE id = $1',
        [userId]
    );
};

export const disableTotp = async (userId: number): Promise<void> => {
    await pool.query(
        'UPDATE scada.users SET totp_enabled = false, totp_secret = NULL WHERE id = $1',
        [userId]
    );
};

export const findUserById = async (userId: number): Promise<IUser | null> => {
    const result = await pool.query(`SELECT ${AUTH_COLUMNS} FROM scada.users WHERE id = $1`, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

// ── Password Reset (self-service) ──

/**
 * Generate a cryptographically secure reset token.
 * Returns the raw token (sent via email) and stores its SHA-256 hash in the DB.
 * Token expires in 30 minutes. Any previous token is overwritten.
 */
export const generatePasswordResetToken = async (userId: number): Promise<string> => {
    const rawToken = crypto.randomBytes(32).toString('hex'); // 64-char hex string
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiry = new Date();
    expiry.setMinutes(expiry.getMinutes() + 30);

    await pool.query(
        'UPDATE scada.users SET reset_token_hash = $1, reset_token_expiry = $2 WHERE id = $3',
        [tokenHash, expiry, userId]
    );

    return rawToken;
};

/**
 * Find a user by a raw reset token. Hashes the provided token and looks it up.
 * Only returns users with a non-expired, non-null token who are not blocked.
 */
export const findUserByResetToken = async (rawToken: string): Promise<IUser | null> => {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const result = await pool.query(
        `SELECT ${SAFE_COLUMNS}, reset_token_hash, reset_token_expiry FROM scada.users
         WHERE reset_token_hash = $1
           AND reset_token_expiry > NOW()
           AND is_blocked = false`,
        [tokenHash]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Reset password using a valid token. Clears the token, resets lockout state.
 */
export const resetPasswordWithToken = async (userId: number, newPasswordHash: string): Promise<void> => {
    await pool.query(
        `UPDATE scada.users
         SET password_hash = $1,
             reset_token_hash = NULL,
             reset_token_expiry = NULL,
             failed_attempts = 0,
             locked_until = NULL
         WHERE id = $2`,
        [newPasswordHash, userId]
    );
};
