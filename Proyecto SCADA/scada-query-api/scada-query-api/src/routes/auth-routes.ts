// src/routes/auth-routes.ts
/// <reference path="../types.d.ts" />

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import * as QRCode from 'qrcode';
import { send2FACode, sendPasswordResetEmail } from '../services/email-service';
import { findUserByEmail, findUserById, validate2FACode, clearUser2FAToken, verifyCredentials, generateAndSave2FACode, generateTempToken, saveTotpSecret, enableTotp, disableTotp, generatePasswordResetToken, findUserByResetToken, resetPasswordWithToken } from '../services/user-service';
import bcrypt from 'bcrypt';
import { ILoginRequest } from '../interfaces/user.interface';
import { pool } from '../services/db-service';
import { isAuth } from '../middlewares/auth-middleware';

const router = Router();

// Endpoint para el Login
router.post('/login', async (req: Request, res: Response) => {
    const { email, password }: ILoginRequest = req.body;

    try {
        const user = await verifyCredentials({ email, password });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials or account blocked.' });
        }

        // TOTP (Google Authenticator) takes priority if enabled
        if (user.totp_enabled && user.totp_secret) {
            const tempToken = generateTempToken(user.id);
            return res.status(200).json({
                message: 'Enter your Google Authenticator code',
                requires2FA: true,
                method: 'totp',
                tempToken
            });
        }

        // Fallback: Email-based 2FA
        if (user.is_2fa_enabled) {
            const tempToken = generateTempToken(user.id);
            const code = await generateAndSave2FACode(user.id);

            // Sending the code via Gmail Relay
            await send2FACode(user.email, code);

            return res.status(200).json({
                message: '2FA code sent to your email',
                requires2FA: true,
                method: 'email',
                tempToken
            });
        }

        // Final session if 2FA is disabled
        const sessionToken = jwt.sign(
            { 
        	id: user.id, 
        	role_id: user.role_id,
        	scope: user.scope,        
        	scope_id: user.scope_id,    
        	estado_id: user.estado_id   
    	    },
            process.env['JWT_SECRET'] as string,
            { expiresIn: '8h' }
        );

        res.status(200).json({
            message: 'Login successful',
            requires2FA: false,
            token: sessionToken,
            user: {
        	id: user.id,
        	full_name: user.full_name,
        	role_id: user.role_id,
        	scope: user.scope,
                scope_id: user.scope_id,
        	estado_id: user.estado_id,
        	totp_enabled: !!user.totp_enabled
    	    }
        });

    } catch (error: any) {
        // Handling lock messages from verifyCredentials
        res.status(423).json({ error: error.message });
    }
});

// Endpoint para verificar los 6-digitos (code)y posibles al final de la sesión con  JWT
router.post('/verify-2fa', async (req: Request, res: Response) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ error: 'Email and verification code are required.' });
    }

    try {
        const user = await validate2FACode(email, code);

        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired verification code.' });
        }

        // 1. Clear tokens to prevent reuse
	if (user && user.two_factor_token === code) {
            await clearUser2FAToken(user.id);
        }
        // 2. Generate final session JWT (8 hours)
        // Including scope and role for frontend authorization
        const sessionToken = jwt.sign(
            { 
                id: user.id, 
                role_id: user.role_id, 
                scope: user.scope, 
                scope_id: user.scope_id,
	        estado_id: user.estado_id	
            },
            process.env['JWT_SECRET'] as string,
            { expiresIn: '8h' }
        );

        // 3. Register activity in scada.audit_logs
        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address) 
             VALUES ($1, $2, $3, $4)`,
            [
                user.id, 
                'LOGIN_SUCCESS', 
                JSON.stringify({ method: '2FA_GMAIL', site_access: 'SCADA - SOA' }), 
                req.ip // Real IP captured thanks to 'trust proxy'
            ]
        );

        // 4. Send success response
        res.status(200).json({
            message: 'Authentication successful',
            token: sessionToken,
            user: {
                id: user.id,
                full_name: user.full_name,
                role_id: user.role_id,
                scope: user.scope,
		scope_id: user.scope_id,
        	estado_id: user.estado_id,
        	totp_enabled: !!user.totp_enabled
            }
        });

    } catch (error) {
        console.error('>>> [2FA Error]:', error);
        res.status(500).json({ error: 'Internal server error during verification.' });
    }
});

// Endpoint para el reenvío de code  2FA si el code previo one se pierde o expira
router.post('/resend-2fa', async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Generate a fresh 6-digit code and update the DB
        const newCode = await generateAndSave2FACode(user.id);

        // Send via the Gmail Relay
        await send2FACode(user.email, newCode);

        res.status(200).json({ message: 'A new security code has been sent.' });

    } catch (error) {
        console.error('>>> [Resend Error]:', error);
        res.status(500).json({ error: 'Failed to resend code. Please try again.' });
    }
});

// ── TOTP (Google Authenticator) Routes ──

// Step 1: Generate TOTP secret + QR code for the authenticated user
router.post('/2fa/setup', isAuth, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const user = await findUserById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (user.totp_enabled) {
            return res.status(400).json({ error: 'TOTP is already enabled for this account.' });
        }

        // Generate a new secret
        const secret = generateSecret();

        // Save it (not yet enabled — user must verify first)
        await saveTotpSecret(userId, secret);

        // Build the otpauth:// URI for Google Authenticator
        const otpauthUri = generateURI({
            issuer: 'SCADA-SOA',
            label: user.email,
            secret
        });

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(otpauthUri);

        res.status(200).json({
            message: 'Scan this QR code with Google Authenticator, then verify with a code.',
            qrCode: qrDataUrl,
            secret,  // Manual entry fallback
            otpauthUri
        });

    } catch (error) {
        console.error('>>> [TOTP Setup Error]:', error);
        res.status(500).json({ error: 'Failed to generate TOTP setup.' });
    }
});

// Step 2: Verify the first TOTP code and enable it
router.post('/2fa/verify-setup', isAuth, async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Verification code is required.' });
    }

    try {
        const userId = req.user!.id;
        const user = await findUserById(userId);

        if (!user || !user.totp_secret) {
            return res.status(400).json({ error: 'No TOTP secret found. Run setup first.' });
        }

        if (user.totp_enabled) {
            return res.status(400).json({ error: 'TOTP is already enabled.' });
        }

        // Verify the code against the stored secret (allow 30s window)
        const result = await verifyTotp({
            secret: user.totp_secret,
            token: code,
            epochTolerance: 30
        });

        if (!result.valid) {
            return res.status(401).json({ error: 'Invalid code. Please try again.' });
        }

        // Code is valid — enable TOTP
        await enableTotp(userId);

        // Audit log
        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'TOTP_ENABLED', JSON.stringify({ method: 'google_authenticator' }), req.ip]
        );

        res.status(200).json({ message: 'Google Authenticator 2FA enabled successfully.' });

    } catch (error) {
        console.error('>>> [TOTP Verify Setup Error]:', error);
        res.status(500).json({ error: 'Failed to verify TOTP code.' });
    }
});

// Step 3: Verify TOTP code during login
router.post('/verify-totp', async (req: Request, res: Response) => {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
        return res.status(400).json({ error: 'Temp token and TOTP code are required.' });
    }

    try {
        // Decode the temp token to get the user ID
        const decoded = jwt.verify(tempToken, process.env['JWT_SECRET'] as string) as any;

        if (decoded.type !== '2FA_PENDING') {
            return res.status(401).json({ error: 'Invalid token type.' });
        }

        const user = await findUserById(decoded.userId);

        if (!user || !user.totp_secret || !user.totp_enabled) {
            return res.status(401).json({ error: 'TOTP is not configured for this account.' });
        }

        // Verify the TOTP code (allow 30s tolerance window)
        const result = await verifyTotp({
            secret: user.totp_secret,
            token: code,
            epochTolerance: 30
        });

        if (!result.valid) {
            return res.status(401).json({ error: 'Invalid or expired TOTP code.' });
        }

        // Generate final session JWT (8 hours)
        const sessionToken = jwt.sign(
            {
                id: user.id,
                role_id: user.role_id,
                scope: user.scope,
                scope_id: user.scope_id,
                estado_id: user.estado_id
            },
            process.env['JWT_SECRET'] as string,
            { expiresIn: '8h' }
        );

        // Audit log
        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [user.id, 'LOGIN_SUCCESS', JSON.stringify({ method: 'TOTP_GOOGLE_AUTH', site_access: 'SCADA - SOA' }), req.ip]
        );

        res.status(200).json({
            message: 'Authentication successful',
            token: sessionToken,
            user: {
                id: user.id,
                full_name: user.full_name,
                role_id: user.role_id,
                scope: user.scope,
                scope_id: user.scope_id,
                estado_id: user.estado_id,
                totp_enabled: true
            }
        });

    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Temp token expired. Please login again.' });
        }
        console.error('>>> [TOTP Login Error]:', error);
        res.status(500).json({ error: 'Internal server error during TOTP verification.' });
    }
});

// Disable TOTP for the authenticated user
router.post('/2fa/disable', isAuth, async (req: Request, res: Response) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Current TOTP code is required to disable 2FA.' });
    }

    try {
        const userId = req.user!.id;
        const user = await findUserById(userId);

        if (!user || !user.totp_secret || !user.totp_enabled) {
            return res.status(400).json({ error: 'TOTP is not enabled for this account.' });
        }

        // Verify the code before disabling
        const result = await verifyTotp({
            secret: user.totp_secret,
            token: code,
            epochTolerance: 30
        });

        if (!result.valid) {
            return res.status(401).json({ error: 'Invalid TOTP code.' });
        }

        await disableTotp(userId);

        // Audit log
        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'TOTP_DISABLED', JSON.stringify({ method: 'google_authenticator' }), req.ip]
        );

        res.status(200).json({ message: 'Google Authenticator 2FA has been disabled.' });

    } catch (error) {
        console.error('>>> [TOTP Disable Error]:', error);
        res.status(500).json({ error: 'Failed to disable TOTP.' });
    }
});

// ── Self-service Password Reset ──

// Rate limit tracking (in-memory, resets on restart — good enough for this scale)
const resetAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RESET_RATE_LIMIT = 3;       // max requests per window
const RESET_RATE_WINDOW = 900000; // 15 minutes in ms

// Periodic cleanup of expired rate-limit entries to prevent memory leak
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of resetAttempts) {
        if (now - entry.firstAttempt >= RESET_RATE_WINDOW) {
            resetAttempts.delete(key);
        }
    }
}, RESET_RATE_WINDOW);

// Step 1: Request a password reset link
router.post('/forgot-password', async (req: Request, res: Response) => {
    const { email } = req.body;

    // Always return the same message regardless of whether the email exists.
    // This prevents email enumeration attacks.
    const SAFE_MSG = 'Si existe una cuenta con ese correo, recibiras un enlace para restablecer tu contrasena.';

    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'El correo electronico es requerido.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Rate limiting by email (prevent abuse)
    const now = Date.now();
    const entry = resetAttempts.get(normalizedEmail);
    if (entry) {
        if (now - entry.firstAttempt < RESET_RATE_WINDOW) {
            if (entry.count >= RESET_RATE_LIMIT) {
                // Still return the safe message — don't reveal rate limiting to attacker
                return res.status(200).json({ message: SAFE_MSG });
            }
            entry.count++;
        } else {
            // Window expired, reset
            resetAttempts.set(normalizedEmail, { count: 1, firstAttempt: now });
        }
    } else {
        resetAttempts.set(normalizedEmail, { count: 1, firstAttempt: now });
    }

    try {
        const user = await findUserByEmail(normalizedEmail);

        if (user && !user.is_blocked) {
            const rawToken = await generatePasswordResetToken(user.id);

            // Build the reset URL (frontend route)
            const baseUrl = process.env.FRONTEND_URL || 'https://scada.playtelecom.com';
            const resetUrl = `${baseUrl}/auth/reset-password?token=${rawToken}`;

            await sendPasswordResetEmail(user.email, resetUrl);

            // Audit log
            await pool.query(
                `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
                 VALUES ($1, $2, $3, $4)`,
                [user.id, 'PASSWORD_RESET_REQUESTED', JSON.stringify({ email: normalizedEmail }), req.ip]
            );
        }
        // If user doesn't exist or is blocked, we silently do nothing.

        res.status(200).json({ message: SAFE_MSG });
    } catch (error) {
        console.error('>>> [Forgot Password Error]:', error);
        // Still return the safe message on error
        res.status(200).json({ message: SAFE_MSG });
    }
});

// Step 2: Reset the password using the token from the email
router.post('/reset-password', async (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return res.status(400).json({ error: 'Token y nueva contrasena son requeridos.' });
    }

    if (typeof token !== 'string' || token.length !== 64) {
        return res.status(400).json({ error: 'Token invalido.' });
    }

    // Password strength: minimum 8 chars, at least 1 uppercase, 1 lowercase, 1 number
    if (password.length < 8) {
        return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres.' });
    }
    if (!/[A-Z]/.test(password)) {
        return res.status(400).json({ error: 'La contrasena debe incluir al menos una mayuscula.' });
    }
    if (!/[a-z]/.test(password)) {
        return res.status(400).json({ error: 'La contrasena debe incluir al menos una minuscula.' });
    }
    if (!/[0-9]/.test(password)) {
        return res.status(400).json({ error: 'La contrasena debe incluir al menos un numero.' });
    }

    try {
        const user = await findUserByResetToken(token);

        if (!user) {
            return res.status(400).json({ error: 'El enlace ha expirado o ya fue utilizado. Solicita uno nuevo.' });
        }

        const newHash = await bcrypt.hash(password, 10);
        await resetPasswordWithToken(user.id, newHash);

        // Audit log
        await pool.query(
            `INSERT INTO scada.audit_logs (user_id, action, details, ip_address)
             VALUES ($1, $2, $3, $4)`,
            [user.id, 'PASSWORD_RESET_SUCCESS', JSON.stringify({ method: 'self_service' }), req.ip]
        );

        res.status(200).json({ message: 'Contrasena actualizada correctamente. Ya puedes iniciar sesion.' });
    } catch (error) {
        console.error('>>> [Reset Password Error]:', error);
        res.status(500).json({ error: 'Error interno al restablecer la contrasena.' });
    }
});

export default router;
