//src/interfaces/user-interface.ts

export interface IUser {
    id: number;
    full_name: string;
    last_name?: string;
    email: string;
    password_hash: string;
    role_id: number;
    phone?: string;
    is_2fa_enabled: boolean;
    two_factor_token?: string | null;
    token_expiry?: Date | null;
    totp_secret?: string | null;
    totp_enabled?: boolean;
    is_blocked: boolean;
    failed_attempts: number;
    locked_until?: Date | null;
    scope: string;
    scope_id: number; //--------------> Id del Municipio
    estado_id: number;
    estado_name?: string;
    municipio_name?: string;
    entity_id?: number;
    last_login?: Date | null;
    created_at?: Date;
}

export interface ICreateUserRequest {
    full_name: string;
    last_name: string;
    email: string;
    password: string;
    role_id: number;
    phone?: string;
    is_2fa_enabled?: boolean;
    scope: string;
    scope_id: number;
    estado_id: number;
    estado_name?: string;
    municipio_name?: string;
    entity_id?: number;
}

export interface ILoginRequest {
    email: string;
    password: string;
}

export interface IAuthResponse {
    message: string;
    requires2FA: boolean;
    tempToken?: string; // Token temporal para validar el 2FA
    user?: {
        id: number;
        full_name: string;
        role_id: number;
    };
}
