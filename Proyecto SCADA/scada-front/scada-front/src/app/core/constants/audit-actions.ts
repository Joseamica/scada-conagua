export interface ActionMeta {
  label: string;
  category: 'auth' | 'user' | 'control' | 'entity' | 'export' | 'nav';
}

export const ACTION_META: Record<string, ActionMeta> = {
  // Auth
  LOGIN_SUCCESS:            { label: 'Login exitoso',        category: 'auth' },
  LOGIN_FAILED:             { label: 'Login fallido',        category: 'auth' },
  LOGOUT:                   { label: 'Logout',               category: 'auth' },
  TOTP_ENABLED:             { label: '2FA activado',         category: 'auth' },
  TOTP_DISABLED:            { label: '2FA desactivado',      category: 'auth' },
  PASSWORD_RESET_REQUESTED: { label: 'Reset solicitado',     category: 'auth' },
  PASSWORD_RESET_SUCCESS:   { label: 'Reset exitoso',        category: 'auth' },
  // User management
  CREATE_USER_SUCCESS:      { label: 'Usuario creado',       category: 'user' },
  CREATE_USER_FAILED:       { label: 'Error crear usuario',  category: 'user' },
  UPDATE_USER:              { label: 'Usuario actualizado',  category: 'user' },
  USER_SOFT_DELETE:         { label: 'Usuario desactivado',  category: 'user' },
  ADMIN_PASSWORD_RESET:     { label: 'Reset por admin',      category: 'user' },
  PERMISSION_UPDATED:       { label: 'Permisos actualizados', category: 'user' },
  // Control
  PUMP_COMMAND_SENT:        { label: 'Bomba: comando',       category: 'control' },
  PUMP_COMMAND_FAILED:      { label: 'Bomba: error',         category: 'control' },
  // Entities / Inventory
  ENTITY_CREATED:           { label: 'Entidad creada',       category: 'entity' },
  SITE_CREATED:             { label: 'Sitio creado',         category: 'entity' },
  // Data export
  EXPORT_CHART_PNG:         { label: 'Export PNG',           category: 'export' },
  EXPORT_TELEMETRY_CSV:     { label: 'Export CSV',           category: 'export' },
  EXPORT_AUDIT_CSV:         { label: 'Export auditoria',     category: 'export' },
  // Navigation
  NAVIGATE_TO_MODULE:       { label: 'Navegacion',           category: 'nav' },
};

export const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ACTION_META).map(([k, v]) => [k, v.label])
);

export function translateAction(action: string): string {
  return ACTION_LABELS[action] || action;
}

export function actionCategory(action: string): string {
  return ACTION_META[action]?.category || 'nav';
}
