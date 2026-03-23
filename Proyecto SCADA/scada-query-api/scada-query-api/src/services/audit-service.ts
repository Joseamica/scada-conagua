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
  | 'SITE_RENDER_UPLOADED'
  | 'SITE_DELETED'
  // GIS
  | 'GIS_LAYER_PUBLISHED'
  | 'GIS_LAYER_DELETED'
  | 'GIS_DRAWING_CREATED'
  | 'GIS_DRAWING_UPDATED'
  | 'GIS_DRAWING_DELETED'
  | 'GIS_VIEW_CREATED'
  | 'GIS_VIEW_UPDATED'
  | 'GIS_VIEW_DELETED'
  // Data Export
  | 'EXPORT_CHART_PNG'
  | 'EXPORT_TELEMETRY_CSV'
  | 'EXPORT_AUDIT_CSV'
  // Navigation
  | 'NAVIGATE_TO_MODULE'
  // Sinopticos
  | 'SINOPTICO_PROJECT_CREATED'
  | 'SINOPTICO_PROJECT_UPDATED'
  | 'SINOPTICO_PROJECT_DELETED'
  | 'SINOPTICO_CREATED'
  | 'SINOPTICO_SAVED'
  | 'SINOPTICO_DELETED'
  | 'SINOPTICO_DUPLICATED'
  | 'SINOPTICO_RESTORED'
  | 'SINOPTICO_SHARED'
  | 'SINOPTICO_UNSHARED'
  // Variables
  | 'VARIABLE_FOLDER_CREATED'
  | 'VARIABLE_FOLDER_DELETED'
  | 'VARIABLE_VIEW_CREATED'
  | 'VARIABLE_VIEW_UPDATED'
  | 'VARIABLE_VIEW_DELETED'
  | 'VARIABLE_COLUMN_ADDED'
  | 'VARIABLE_COLUMN_UPDATED'
  | 'VARIABLE_COLUMN_DELETED'
  | 'VARIABLE_FORMULA_CREATED'
  | 'VARIABLE_FORMULA_UPDATED'
  | 'VARIABLE_FORMULA_DELETED'
  | 'VARIABLE_VIEW_SHARED'
  | 'VARIABLE_VIEW_UNSHARED'
  // Alarms
  | 'ALARM_CREATED'
  | 'ALARM_UPDATED'
  | 'ALARM_DELETED'
  | 'ALARM_ACKNOWLEDGED';

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
