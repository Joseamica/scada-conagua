export interface ActionMeta {
  label: string;
  category: 'auth' | 'user' | 'control' | 'entity' | 'export' | 'nav' | 'sinoptico' | 'variable' | 'alarm' | 'gis';
}

export const ACTION_META: Record<string, ActionMeta> = {
  // Auth
  LOGIN_SUCCESS:            { label: 'Login exitoso',            category: 'auth' },
  LOGIN_FAILED:             { label: 'Login fallido',            category: 'auth' },
  LOGOUT:                   { label: 'Logout',                   category: 'auth' },
  TOTP_ENABLED:             { label: '2FA activado',             category: 'auth' },
  TOTP_DISABLED:            { label: '2FA desactivado',          category: 'auth' },
  PASSWORD_RESET_REQUESTED: { label: 'Reset solicitado',         category: 'auth' },
  PASSWORD_RESET_SUCCESS:   { label: 'Reset exitoso',            category: 'auth' },
  // User management
  CREATE_USER_SUCCESS:      { label: 'Usuario creado',           category: 'user' },
  CREATE_USER_FAILED:       { label: 'Error crear usuario',      category: 'user' },
  UPDATE_USER:              { label: 'Usuario actualizado',      category: 'user' },
  USER_SOFT_DELETE:         { label: 'Usuario desactivado',      category: 'user' },
  ADMIN_PASSWORD_RESET:     { label: 'Reset por admin',          category: 'user' },
  PERMISSION_UPDATED:       { label: 'Permisos actualizados',    category: 'user' },
  // Control
  PUMP_COMMAND_SENT:        { label: 'Bomba: comando',           category: 'control' },
  PUMP_COMMAND_FAILED:      { label: 'Bomba: error',             category: 'control' },
  // Entities / Inventory
  ENTITY_CREATED:           { label: 'Entidad creada',           category: 'entity' },
  SITE_CREATED:             { label: 'Sitio creado',             category: 'entity' },
  SITE_UPDATED:             { label: 'Sitio actualizado',        category: 'entity' },
  SITE_RENDER_UPLOADED:     { label: 'Render subido',            category: 'entity' },
  SITE_DELETED:             { label: 'Sitio eliminado',          category: 'entity' },
  // GIS
  GIS_LAYER_PUBLISHED:      { label: 'Capa GIS publicada',      category: 'gis' },
  GIS_LAYER_DELETED:        { label: 'Capa GIS eliminada',      category: 'gis' },
  // Data export
  EXPORT_CHART_PNG:         { label: 'Export PNG',               category: 'export' },
  EXPORT_TELEMETRY_CSV:     { label: 'Export CSV',               category: 'export' },
  EXPORT_AUDIT_CSV:         { label: 'Export auditoria',         category: 'export' },
  // Navigation
  NAVIGATE_TO_MODULE:       { label: 'Navegacion',               category: 'nav' },
  // Sinopticos
  SINOPTICO_PROJECT_CREATED:  { label: 'Proyecto creado',        category: 'sinoptico' },
  SINOPTICO_PROJECT_UPDATED:  { label: 'Proyecto actualizado',   category: 'sinoptico' },
  SINOPTICO_PROJECT_DELETED:  { label: 'Proyecto eliminado',     category: 'sinoptico' },
  SINOPTICO_CREATED:          { label: 'Sinoptico creado',       category: 'sinoptico' },
  SINOPTICO_SAVED:            { label: 'Sinoptico guardado',     category: 'sinoptico' },
  SINOPTICO_DELETED:          { label: 'Sinoptico eliminado',    category: 'sinoptico' },
  SINOPTICO_DUPLICATED:       { label: 'Sinoptico duplicado',    category: 'sinoptico' },
  SINOPTICO_SHARED:           { label: 'Sinoptico compartido',   category: 'sinoptico' },
  SINOPTICO_UNSHARED:         { label: 'Sinoptico descompartido', category: 'sinoptico' },
  // Variables
  VARIABLE_FOLDER_CREATED:    { label: 'Carpeta creada',         category: 'variable' },
  VARIABLE_FOLDER_DELETED:    { label: 'Carpeta eliminada',      category: 'variable' },
  VARIABLE_VIEW_CREATED:      { label: 'Vista creada',           category: 'variable' },
  VARIABLE_VIEW_UPDATED:      { label: 'Vista actualizada',      category: 'variable' },
  VARIABLE_VIEW_DELETED:      { label: 'Vista eliminada',        category: 'variable' },
  VARIABLE_COLUMN_ADDED:      { label: 'Columna agregada',       category: 'variable' },
  VARIABLE_COLUMN_UPDATED:    { label: 'Columna actualizada',    category: 'variable' },
  VARIABLE_COLUMN_DELETED:    { label: 'Columna eliminada',      category: 'variable' },
  VARIABLE_FORMULA_CREATED:   { label: 'Formula creada',         category: 'variable' },
  VARIABLE_FORMULA_UPDATED:   { label: 'Formula actualizada',    category: 'variable' },
  VARIABLE_FORMULA_DELETED:   { label: 'Formula eliminada',      category: 'variable' },
  VARIABLE_VIEW_SHARED:       { label: 'Vista compartida',       category: 'variable' },
  VARIABLE_VIEW_UNSHARED:     { label: 'Vista descompartida',    category: 'variable' },
  // Alarms
  ALARM_CREATED:              { label: 'Alarma creada',          category: 'alarm' },
  ALARM_DELETED:              { label: 'Alarma eliminada',       category: 'alarm' },
  ALARM_ACKNOWLEDGED:         { label: 'Alarma reconocida',      category: 'alarm' },
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
