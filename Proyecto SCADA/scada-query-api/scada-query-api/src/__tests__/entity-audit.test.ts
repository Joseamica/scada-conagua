// scada-query-api/src/__tests__/entity-audit.test.ts
// Tests for entity routes and audit log endpoints
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';

// ─── Mocks ─────────────────────────────────────────────────────────────────
vi.mock('../services/db-service', () => ({
    pool: {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
            // Entity queries
            if (sql.includes('FROM scada.entities') && !sql.includes('INSERT')) {
                return Promise.resolve({
                    rows: [
                        { id: 1, name: 'CONAGUA', level: 'Federal', parent_id: null, estado_id: 0, municipio_id: 0, is_active: true },
                        { id: 2, name: 'OCAVM', level: 'Estatal', parent_id: 1, estado_id: 15, municipio_id: 0, is_active: true },
                        { id: 4, name: 'Ecatepec', level: 'Municipal', parent_id: 2, estado_id: 15, municipio_id: 33, is_active: true },
                    ]
                });
            }
            // Create entity
            if (sql.includes('INSERT INTO scada.entities')) {
                return Promise.resolve({ rows: [{ id: 10 }] });
            }
            // Audit logs count
            if (sql.includes('COUNT(*)') && sql.includes('audit_logs')) {
                return Promise.resolve({ rows: [{ count: '3' }] });
            }
            // Audit logs data
            if (sql.includes('FROM scada.audit_logs')) {
                return Promise.resolve({
                    rows: [
                        { id: 1, user_id: 1, full_name: 'Admin', email: 'admin@test.com', role_name: 'Administrador', scope: 'Federal', action: 'LOGIN_SUCCESS', details: '{}', ip_address: '127.0.0.1', created_at: '2026-01-20T09:14:00Z' },
                        { id: 2, user_id: 1, full_name: 'Admin', email: 'admin@test.com', role_name: 'Administrador', scope: 'Federal', action: 'NAVIGATE_TO_MODULE', details: '{"module_name":"dashboard"}', ip_address: '127.0.0.1', created_at: '2026-01-20T09:15:00Z' },
                    ]
                });
            }
            // Default
            return Promise.resolve({ rows: [{ site_name: 'Test' }] });
        })
    },
}));

vi.mock('../services/influx-query-service', () => ({
    getTelemetryData: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('../services/control-service', () => ({
    sendSCADACommand: vi.fn().mockResolvedValue(true),
}));

// ─── Token helpers ──────────────────────────────────────────────────────────
const TEST_SECRET = 'test_secret_scada_vitest';

const makeToken = (role_id: number, scope = 'Federal', scope_id = 0, estado_id = 0) =>
    'Bearer ' + jwt.sign(
        { id: role_id, role_id, scope, scope_id, estado_id },
        TEST_SECRET,
        { expiresIn: '1h' }
    );

const TOKEN = {
    admin:    makeToken(1, 'Federal'),
    operador: makeToken(3, 'Municipal', 33, 15),
    tecnico:  makeToken(4, 'Federal'),
};

// ─── Entity Routes ──────────────────────────────────────────────────────────
describe('GET /api/v1/entities', () => {
    it('authenticated user can list entities', async () => {
        const res = await request(app)
            .get('/api/v1/entities')
            .set('Authorization', TOKEN.admin);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
    });

    it('unauthenticated request → 401', async () => {
        const res = await request(app).get('/api/v1/entities');
        expect(res.status).toBe(401);
    });

    it('Tecnico (rol 4) can list entities', async () => {
        const res = await request(app)
            .get('/api/v1/entities')
            .set('Authorization', TOKEN.tecnico);
        expect(res.status).toBe(200);
    });
});

describe('POST /api/v1/entities', () => {
    it('Admin can create entity', async () => {
        const res = await request(app)
            .post('/api/v1/entities')
            .set('Authorization', TOKEN.admin)
            .send({ name: 'Naucalpan', level: 'Municipal', parent_id: 2, estado_id: 15, municipio_id: 57 });
        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
    });

    it('Non-admin cannot create entity → 403', async () => {
        const res = await request(app)
            .post('/api/v1/entities')
            .set('Authorization', TOKEN.operador)
            .send({ name: 'Test', level: 'Municipal' });
        expect(res.status).toBe(403);
    });

    it('Missing name → 400', async () => {
        const res = await request(app)
            .post('/api/v1/entities')
            .set('Authorization', TOKEN.admin)
            .send({ level: 'Municipal' });
        expect(res.status).toBe(400);
    });
});

// ─── Audit Log Routes ───────────────────────────────────────────────────────
describe('GET /api/v1/audit/logs', () => {
    it('authenticated user can list audit logs', async () => {
        const res = await request(app)
            .get('/api/v1/audit/logs')
            .set('Authorization', TOKEN.admin);
        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.total).toBe(3);
    });

    it('unauthenticated request → 401', async () => {
        const res = await request(app).get('/api/v1/audit/logs');
        expect(res.status).toBe(401);
    });

    it('supports pagination params', async () => {
        const res = await request(app)
            .get('/api/v1/audit/logs?page=1&limit=10')
            .set('Authorization', TOKEN.admin);
        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(1);
        expect(res.body.pagination.limit).toBe(10);
    });
});

describe('GET /api/v1/audit/logs/export', () => {
    it('authenticated user can export CSV', async () => {
        const res = await request(app)
            .get('/api/v1/audit/logs/export')
            .set('Authorization', TOKEN.admin);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/csv');
        expect(res.text).toContain('ID,Usuario,Email');
    });

    it('unauthenticated request → 401', async () => {
        const res = await request(app).get('/api/v1/audit/logs/export');
        expect(res.status).toBe(401);
    });
});

// ─── User Routes with entityId filter ────────────────────────────────────────
describe('GET /api/v1/users?entityId=', () => {
    it('Admin can filter users by entityId', async () => {
        const res = await request(app)
            .get('/api/v1/users?entityId=2')
            .set('Authorization', TOKEN.admin);
        expect(res.status).toBe(200);
    });
});
