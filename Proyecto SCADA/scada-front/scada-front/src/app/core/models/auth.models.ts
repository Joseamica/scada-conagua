export interface UserSession {
  id: number;
  email: string;
  full_name: string;
  role_id: number;
  scope: string;
  scope_id: number;
  estado_id: number;
  totp_enabled: boolean;
  is_2fa_enabled: boolean;
  can_operate?: boolean;
}

export interface AuthResponse {
  message: string;
  requires2FA: boolean;
  method?: 'totp' | 'email';  // Tipo de 2FA requerido
  tempToken?: string; // JWT temporal (Token) para flujo 2FA
  token?: string;     // Sesión final JWT
  user?: UserSession;
}

export interface TotpSetupResponse {
  message: string;
  qrCode: string;     // data:image/png;base64 del QR
  secret: string;     // Clave manual para Google Authenticator
  otpauthUri: string;
}

export interface LoginRequest {
  email: string;      // En la interface de Login UI el correo será el'username', pero el  backend espera un 'email'
  password: string;
}