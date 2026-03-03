// src/app/core/models/user.model.ts

export type UserScope = 'Federal' | 'Estatal' | 'Municipal';
export type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

export interface User {
  id: number;
  full_name: string;
  last_name: string;
  email: string;
  password?: string;        // Solo para creación del usuario
  role_id: number;
  role_name?: string;
  is_2fa_enabled: boolean;  // Flag que indica si el 2FA está habilitado
  phone: string;
  is_blocked: boolean;
  is_active: boolean;       // Flag para estado activo/inactivo indicando si el usuarion esta dentro del sistema
  scope: string;            // Ambito del usuario: Federal, Estatal, Municipal
  scope_id: number;
  municipio_name?: string;   
  estado_id?: number;       // Solo para usuarios con ámbito Estatal
  estado_name?: string;
  entity_id?: number;
  entity_name?: string;
  created_at?: string;
  last_login?: string;
  failed_attempts?: number;
}



