// scada-query-api/src/__tests__/auth.test.ts
// Suite completa de seguridad y governance por roles
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

// ─── Mocks de servicios externos ────────────────────────────────────────────
vi.mock('../services/db-service', () => ({
    pool: { query: vi.fn().mockResolvedValue({ rows: [{ site_name: 'Pozo Test' }] }) },
}));

vi.mock('../services/influx-query-service', () => ({
    getTelemetryData: vi.fn().mockResolvedValue({ siteName: 'Test', devEui: 'TEST', measurement: 'presion', data: [] }),
}));

vi.mock('../services/control-service', () => ({
    sendSCADACommand: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/permission-service', () => ({
    getPermissions: vi.fn().mockImplementation((userId: number) => {
        // Ejecutivo (rol 4, id=4 in test tokens) cannot operate
        const canOperate = userId !== 4;
        return Promise.resolve({
            can_view: true,
            can_export: true,
            can_operate: canOperate,
            can_edit_synoptics: false,
        });
    }),
}));

// ─── Generación de tokens por rol ────────────────────────────────────────────
// Usa el JWT_SECRET del vitest.config.ts: 'test_secret_scada_vitest'
const TEST_SECRET = 'test_secret_scada_vitest';

const makeToken = (role_id: number, scope = 'Federal', scope_id = 0, estado_id = 0) =>
    'Bearer ' + jwt.sign(
        { id: role_id, role_id, scope, scope_id, estado_id },
        TEST_SECRET,
        { expiresIn: '1h' }
    );

const TOKEN = {
    admin:      makeToken(1, 'Federal'),
    supervisor: makeToken(2, 'Estatal', 26, 26),
    operador:   makeToken(3, 'Municipal', 5, 26),
    ejecutivo:  makeToken(4, 'Federal'),
    invalido:   'Bearer token_falso_xyz',
};

// ─── F-001 + F-005: Sin autenticación ────────────────────────────────────────
describe('Sin token — todos los endpoints protegidos deben rechazar', () => {
    it('POST /control sin token → 401', async () => {
        const res = await request(app).post('/api/v1/control').send({ devEUI: 'T', command: 'STOP' });
        expect(res.status).toBe(401);
    });

    it('GET /status sin token → 401', async () => {
        const res = await request(app).get('/api/v1/status/TEST001');
        expect(res.status).toBe(401);
    });

    it('GET /telemetry sin token → 401', async () => {
        const res = await request(app).get('/api/v1/telemetry/TEST001/presion');
        expect(res.status).toBe(401);
    });

    it('GET / (health check) sin token → 200', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
    });
});

// ─── Token inválido ───────────────────────────────────────────────────────────
describe('Token inválido — debe rechazar con 403', () => {
    it('POST /control con token falso → 403', async () => {
        const res = await request(app)
            .post('/api/v1/control')
            .set('Authorization', TOKEN.invalido)
            .send({ devEUI: 'T', command: 'STOP' });
        expect(res.status).toBe(403);
    });

    it('GET /status con token falso → 403', async () => {
        const res = await request(app)
            .get('/api/v1/status/TEST001')
            .set('Authorization', TOKEN.invalido);
        expect(res.status).toBe(403);
    });
});

// ─── Governance: POST /control (role + scope + can_operate per CONAGUA) ────
describe('Governance: POST /api/v1/control', () => {
    // Municipal admin can control pumps
    const municipalAdmin = makeToken(1, 'Municipal', 33, 15);
    // Estatal supervisor can control pumps
    const estatalSupervisor = makeToken(2, 'Estatal', 0, 15);

    it('Admin Municipal con can_operate puede enviar comando → 202', async () => {
        const res = await request(app)
            .post('/api/v1/control')
            .set('Authorization', municipalAdmin)
            .send({ devEUI: 'TEST001', command: 'START' });
        expect(res.status).toBe(202);
    });

    it('Supervisor Estatal puede enviar comando → 202', async () => {
        const res = await request(app)
            .post('/api/v1/control')
            .set('Authorization', estatalSupervisor)
            .send({ devEUI: 'TEST001', command: 'START' });
        expect(res.status).toBe(202);
    });

    it('Admin Federal NO puede controlar bombas (solo supervisión) → 403', async () => {
        const res = await request(app)
            .post('/api/v1/control')
            .set('Authorization', TOKEN.admin)
            .send({ devEUI: 'TEST001', command: 'START' });
        expect(res.status).toBe(403);
    });

    it('Operador (rol 3) NO puede controlar bombas → 403', async () => {
        const res = await request(app)
            .post('/api/v1/control')
            .set('Authorization', TOKEN.operador)
            .send({ devEUI: 'TEST001', command: 'STOP' });
        expect(res.status).toBe(403);
    });

    it('Ejecutivo (rol 4) NO puede enviar comando → 403', async () => {
        const res = await request(app)
            .post('/api/v1/control')
            .set('Authorization', TOKEN.ejecutivo)
            .send({ devEUI: 'TEST001', command: 'START' });
        expect(res.status).toBe(403);
    });
});

// ─── Governance: GET /status y /telemetry (isAuth — cualquier rol) ────────────
describe('Governance: GET /api/v1/status y /telemetry (solo requiere estar autenticado)', () => {
    const roles = [
        { nombre: 'Admin',      token: () => TOKEN.admin },
        { nombre: 'Supervisor', token: () => TOKEN.supervisor },
        { nombre: 'Operador',   token: () => TOKEN.operador },
        { nombre: 'Ejecutivo',  token: () => TOKEN.ejecutivo },
    ];

    for (const rol of roles) {
        it(`${rol.nombre} (rol ${roles.indexOf(rol) + 1}) puede ver status → no 401/403`, async () => {
            const res = await request(app)
                .get('/api/v1/status/TEST001')
                .set('Authorization', rol.token());
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });

        it(`${rol.nombre} (rol ${roles.indexOf(rol) + 1}) puede ver telemetría → no 401/403`, async () => {
            const res = await request(app)
                .get('/api/v1/telemetry/TEST001/presion')
                .set('Authorization', rol.token());
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    }
});

// ─── Governance: /users (Admin + Supervisor per CONAGUA) ────────────────────────
describe('Governance: /api/v1/users (Admin y Supervisor)', () => {
    it('Supervisor PUEDE listar usuarios (gestiona subordinados) → 200', async () => {
        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', TOKEN.supervisor);
        expect(res.status).toBe(200);
    });

    it('Operador NO puede listar usuarios → 403', async () => {
        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', TOKEN.operador);
        expect(res.status).toBe(403);
    });

    it('Ejecutivo NO puede listar usuarios → 403', async () => {
        const res = await request(app)
            .get('/api/v1/users')
            .set('Authorization', TOKEN.ejecutivo);
        expect(res.status).toBe(403);
    });

    it('Sin token no puede listar usuarios → 401', async () => {
        const res = await request(app).get('/api/v1/users');
        expect(res.status).toBe(401);
    });
});

// ─── Validación de parámetros en /control ────────────────────────────────────
describe('Validación de parámetros en /control', () => {
    it('Comando inválido (no START/STOP) → 400', async () => {
        const res = await request(app)
            .post('/api/v1/control')
            .set('Authorization', TOKEN.admin)
            .send({ devEUI: 'TEST001', command: 'HACK' });
        expect(res.status).toBe(400);
    });

    it('Sin devEUI → 400', async () => {
        const res = await request(app)
            .post('/api/v1/control')
            .set('Authorization', TOKEN.admin)
            .send({ command: 'START' });
        expect(res.status).toBe(400);
    });
});
