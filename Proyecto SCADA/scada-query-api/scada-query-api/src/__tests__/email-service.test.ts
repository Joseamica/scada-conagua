// scada-query-api/src/__tests__/email-service.test.ts
// F-004: Verificar que el código 2FA nunca aparece en logs de producción
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted garantiza que mockSendMail existe antes de que el módulo se cargue
const mockSendMail = vi.hoisted(() => vi.fn());

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
    },
}));

import { send2FACode } from '../services/email-service';

const CODE = '847291';
const EMAIL = 'operador@conagua.gob.mx';

describe('F-004: send2FACode — el código 2FA no debe aparecer en logs', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        mockSendMail.mockReset();
        consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env.NODE_ENV = originalEnv;
    });

    it('en éxito: el log no contiene el código 2FA', async () => {
        mockSendMail.mockResolvedValue({});

        await send2FACode(EMAIL, CODE);

        const allLogs = consoleSpy.mock.calls.flat().join(' ');
        expect(allLogs).not.toContain(CODE);
    });

    it('en éxito: el log enmascara el email', async () => {
        mockSendMail.mockResolvedValue({});

        await send2FACode(EMAIL, CODE);

        const allLogs = consoleSpy.mock.calls.flat().join(' ');
        expect(allLogs).not.toContain(EMAIL);
        expect(allLogs).toContain('op***@conagua.gob.mx');
    });

    it('en fallo con NODE_ENV=production: el código NO aparece en ningún log', async () => {
        process.env.NODE_ENV = 'production';
        mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

        await send2FACode(EMAIL, CODE);

        const allOutput = [
            ...consoleSpy.mock.calls.flat(),
            ...consoleWarnSpy.mock.calls.flat(),
            ...consoleErrorSpy.mock.calls.flat(),
        ].join(' ');

        expect(allOutput).not.toContain(CODE);
    });

    it('en fallo con NODE_ENV=development: el código SÍ aparece (fallback dev)', async () => {
        process.env.NODE_ENV = 'development';
        mockSendMail.mockRejectedValue(new Error('SMTP timeout'));

        await send2FACode(EMAIL, CODE);

        const warnLogs = consoleWarnSpy.mock.calls.flat().join(' ');
        expect(warnLogs).toContain(CODE);
    });
});
