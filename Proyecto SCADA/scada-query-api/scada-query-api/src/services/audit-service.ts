// src/services/audit-service.ts

import { pool } from './db-service';

export type AuditAction =
  // Auth
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'TOTP_ENABLED'
  | 'TOTP_DISABLED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_SUCCESS'
  // User Management
  | 'CREATE_USER_SUCCESS'
  | 'CREATE_USER_FAILED'
  | 'UPDATE_USER'
  | 'USER_SOFT_DELETE'
  | 'ADMIN_PASSWORD_RESET'
  | 'PERMISSION_UPDATED'
  // Control
  | 'PUMP_COMMAND_SENT'
  | 'PUMP_COMMAND_FAILED'
  // Entities
  | 'ENTITY_CREATED'
  // Sites / Inventory
  | 'SITE_CREATED'
  | 'SITE_UPDATED'
  // Data Export
  | 'EXPORT_CHART_PNG'
  | 'EXPORT_TELEMETRY_CSV'
  | 'EXPORT_AUDIT_CSV'
  // Navigation
  | 'NAVIGATE_TO_MODULE';

export async function auditLog(
  userId: number | null,
  action: AuditAction,
  details: Record<string, any>,
  ipAddress: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [userId, action, JSON.stringify(details), ipAddress || '0.0.0.0']
    );
  } catch (err) {
    console.error('[AuditLog Error]', action, err);
    // No throw — audit failures must never break the main operation
  }
}
