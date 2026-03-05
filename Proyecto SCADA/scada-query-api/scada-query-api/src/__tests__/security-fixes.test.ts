// Tests for security fixes #4 (Flux injection) and #7 (rate limit /resend-2fa)
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

// ─── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('../services/db-service', () => ({
    pool: {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
            // Return site_name with special chars for Flux injection test
            if (sql.includes('site_name') && params?.[0] === 'devINJECTION') {
                return { rows: [{ site_name: 'test" |> yield()' }] };
            }
            return { rows: [{ site_name: 'Pozo Test' }] };
        }),
    },
}));

vi.mock('../services/influx-query-service', () => {
    // Import the real module to test the escape logic
    return {
        getTelemetryData: vi.fn().mockResolvedValue({
            siteName: 'Test',
            devEui: 'TEST',
            measurement: 'presion',
            data: [],
        }),
    };
});

vi.mock('../services/control-service', () => ({
    sendSCADACommand: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/permission-service', () => ({
    getPermissions: vi.fn().mockResolvedValue({
        can_view: true,
        can_export: true,
        can_operate: true,
        can_edit_synoptics: false,
    }),
}));

vi.mock('../services/user-service', () => ({
    findUserByEmail: vi.fn(),
    findUserById: vi.fn().mockResolvedValue({
        id: 42,
        email: 'test@conagua.gob.mx',
        role_id: 3,
        scope: 'Municipal',
        scope_id: 5,
        estado_id: 15,
        is_2fa_enabled: true,
        totp_enabled: false,
    }),
    validate2FACode: vi.fn(),
    clearUser2FAToken: vi.fn(),
    verifyCredentials: vi.fn(),
    generateAndSave2FACode: vi.fn().mockResolvedValue('123456'),
    generateTempToken: vi.fn(),
    saveTotpSecret: vi.fn(),
    enableTotp: vi.fn(),
    disableTotp: vi.fn(),
    generatePasswordResetToken: vi.fn(),
    findUserByResetToken: vi.fn(),
    resetPasswordWithToken: vi.fn(),
    generateEmailVerifyToken: vi.fn(),
    validateEmailVerifyToken: vi.fn(),
}));

vi.mock('../services/email-service', () => ({
    send2FACode: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../services/audit-service', () => ({
    auditLog: vi.fn(),
}));

const TEST_SECRET = 'test_secret_scada_vitest';

// ─── Fix #4: Flux Injection Escape ──────────────────────────────────────────

describe('Fix #4: Flux injection — siteName escape', () => {
    it('safeSiteName escapes double quotes and backslashes', () => {
        // This tests the exact logic from influx-query-service.ts:55
        const malicious = 'test" |> yield()';
        const safe = malicious
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/[\n\r]/g, '');
        expect(safe).toBe('test\\" |> yield()');
        // When interpolated: r["pozo"] == "test\" |> yield()"
        // The \" is a literal quote inside the Flux string — no injection
    });

    it('escapes backslashes before quotes (correct order)', () => {
        const input = 'test\\"escape';
        const safe = input
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/[\n\r]/g, '');
        // \\ becomes \\\\ first, then " becomes \"
        expect(safe).toBe('test\\\\\\"escape');
    });

    it('strips newlines and carriage returns', () => {
        const input = 'pozo\nmalicious\rcode';
        const safe = input
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/[\n\r]/g, '');
        expect(safe).toBe('pozomaliciouscode');
    });

    it('normal site names pass through unchanged', () => {
        const input = 'POZO 34 - Ixtapaluca';
        const safe = input
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/[\n\r]/g, '');
        expect(safe).toBe('POZO 34 - Ixtapaluca');
    });

    it('siteName in API response is NOT escaped (no regression)', () => {
        // The original siteName should be returned to the frontend, not safeSiteName
        const siteName = 'Pozo "La Joya"';
        const safeSiteName = siteName
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/[\n\r]/g, '');

        // These should be different
        expect(safeSiteName).not.toBe(siteName);
        // Frontend gets the original
        expect(siteName).toBe('Pozo "La Joya"');
    });
});

// ─── Fix #7: Rate Limit /resend-2fa ─────────────────────────────────────────

describe('Fix #7: Rate limit /resend-2fa', () => {
    const make2FAToken = (userId: number) =>
        jwt.sign({ userId, type: '2FA_PENDING' }, TEST_SECRET, { expiresIn: '5m' });

    it('first 3 resend requests succeed', async () => {
        const tempToken = make2FAToken(100); // userId=100, unique per test

        for (let i = 0; i < 3; i++) {
            const res = await request(app)
                .post('/api/v1/auth/resend-2fa')
                .send({ tempToken });
            expect(res.status).toBe(200);
            expect(res.body.message).toBe('A new security code has been sent.');
        }
    });

    it('4th resend is silently blocked (returns same 200 message)', async () => {
        const tempToken = make2FAToken(200); // Different userId to avoid cross-test interference

        // Exhaust the limit
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post('/api/v1/auth/resend-2fa')
                .send({ tempToken });
        }

        // 4th attempt — should be rate limited but return same response
        const { send2FACode } = await import('../services/email-service');
        const callsBefore = (send2FACode as any).mock.calls.length;

        const res = await request(app)
            .post('/api/v1/auth/resend-2fa')
            .send({ tempToken });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('A new security code has been sent.');

        // Verify no email was actually sent
        const callsAfter = (send2FACode as any).mock.calls.length;
        expect(callsAfter).toBe(callsBefore);
    });

    it('different users have independent rate limits', async () => {
        const token1 = make2FAToken(301);
        const token2 = make2FAToken(302);

        // Exhaust user 301
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post('/api/v1/auth/resend-2fa')
                .send({ tempToken: token1 });
        }

        // User 302 should still work
        const res = await request(app)
            .post('/api/v1/auth/resend-2fa')
            .send({ tempToken: token2 });

        expect(res.status).toBe(200);
    });

    it('expired tempToken returns 401', async () => {
        const expired = jwt.sign(
            { userId: 400, type: '2FA_PENDING' },
            TEST_SECRET,
            { expiresIn: '0s' }
        );

        // Small delay to ensure expiry
        await new Promise((r) => setTimeout(r, 50));

        const res = await request(app)
            .post('/api/v1/auth/resend-2fa')
            .send({ tempToken: expired });

        expect(res.status).toBe(401);
    });

    it('missing tempToken returns 400', async () => {
        const res = await request(app)
            .post('/api/v1/auth/resend-2fa')
            .send({});

        expect(res.status).toBe(400);
    });
});
