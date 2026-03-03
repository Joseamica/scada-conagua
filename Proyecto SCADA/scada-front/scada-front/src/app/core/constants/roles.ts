// Single source of truth for role names — aligned with SOA spec
// Migration 003 normalizes these in the DB

export const ROLE_MAP: Record<number, string> = {
  1: 'Administrador',
  2: 'Supervisor',
  3: 'Operador',
  4: 'Tecnico'
};

export const ROLE_ID_MAP: Record<string, number> = {
  'Administrador': 1,
  'Supervisor': 2,
  'Operador': 3,
  'Tecnico': 4
};

export const ROLE_OPTIONS = [
  { id: 1, name: 'Administrador' },
  { id: 2, name: 'Supervisor' },
  { id: 3, name: 'Operador' },
  { id: 4, name: 'Tecnico' }
];
