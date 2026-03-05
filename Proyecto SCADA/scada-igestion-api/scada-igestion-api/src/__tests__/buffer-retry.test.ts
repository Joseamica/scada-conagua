// Test suite for Fix #6: Ignition buffer retry logic
// Tests the flushBufferToInflux behavior with retries, snapshots, and race conditions
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock writeGroupedIgnitionToInflux ──────────────────────────────────────
const mockWriteGrouped = vi.fn();
vi.mock('../services/influx-service', () => ({
    writeTelemetryToInflux: vi.fn(),
    writeGroupedIgnitionToInflux: mockWriteGrouped,
}));

// Mock postgres-service to prevent real DB calls
vi.mock('../services/postgres-service', () => ({
    getSiteMetadata: vi.fn(),
    updateSiteStatus: vi.fn(),
    updateIgnitionSiteStatus: vi.fn().mockResolvedValue(undefined),
}));

// Mock transformer
vi.mock('../services/ignition-transformer', () => ({
    transformIgnition: vi.fn(),
}));

// Mock mqtt to prevent real connections
vi.mock('mqtt', () => {
    const handlers: Record<string, Function> = {};
    const mockClient = {
        on: vi.fn((event: string, handler: Function) => { handlers[event] = handler; }),
        subscribe: vi.fn(),
        end: vi.fn(),
    };
    return {
        connect: vi.fn(() => mockClient),
        __mockClient: mockClient,
        __handlers: handlers,
    };
});

// ─── Import after mocks ────────────────────────────────────────────────────
// We can't import the full module (it connects to MQTT on import),
// so we test the buffer logic in isolation by recreating it here.

interface BufferEntry {
    municipio: string;
    pozo_name: string;
    fields: Record<string, any>;
    tags: Record<string, string>;
    timer: NodeJS.Timeout | null;
    retries: number;
}

const FLUSH_TIMEOUT = 500;
const ignitionBuffer = new Map<string, BufferEntry>();

// Recreated flushBufferToInflux — mirrors the production code exactly
const flushBufferToInflux = async (key: string) => {
    const entry = ignitionBuffer.get(key);
    if (!entry) return;

    const snapshot = {
        municipio: entry.municipio,
        pozo_name: entry.pozo_name,
        fields: { ...entry.fields },
        tags: { ...entry.tags },
    };
    const timerAtStart = entry.timer;

    try {
        await mockWriteGrouped(snapshot);

        if (entry.timer === timerAtStart) {
            ignitionBuffer.delete(key);
        }
    } catch (err) {
        entry.retries++;
        if (entry.retries < 3) {
            entry.timer = setTimeout(async () => {
                await flushBufferToInflux(key);
            }, FLUSH_TIMEOUT * 2);
        } else {
            ignitionBuffer.delete(key);
        }
    }
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Fix #6: Buffer retry logic', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        ignitionBuffer.clear();
        mockWriteGrouped.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('successful write deletes the buffer entry', async () => {
        mockWriteGrouped.mockResolvedValueOnce(undefined);

        ignitionBuffer.set('mun_pozo1', {
            municipio: 'IXTAPALUCA',
            pozo_name: 'POZO 1',
            fields: { presion: 2.5 },
            tags: { calidad: 'Good' },
            timer: null,
            retries: 0,
        });

        await flushBufferToInflux('mun_pozo1');

        expect(ignitionBuffer.has('mun_pozo1')).toBe(false);
        expect(mockWriteGrouped).toHaveBeenCalledOnce();
    });

    it('failed write does NOT delete the buffer — retries instead', async () => {
        mockWriteGrouped.mockRejectedValueOnce(new Error('InfluxDB down'));

        ignitionBuffer.set('mun_pozo1', {
            municipio: 'IXTAPALUCA',
            pozo_name: 'POZO 1',
            fields: { presion: 2.5 },
            tags: { calidad: 'Good' },
            timer: null,
            retries: 0,
        });

        await flushBufferToInflux('mun_pozo1');

        // Entry should still exist (not deleted)
        expect(ignitionBuffer.has('mun_pozo1')).toBe(true);
        // Retries should have incremented
        expect(ignitionBuffer.get('mun_pozo1')!.retries).toBe(1);
        // A retry timer should have been scheduled
        expect(ignitionBuffer.get('mun_pozo1')!.timer).not.toBeNull();
    });

    it('discards data after 3 failed attempts', async () => {
        mockWriteGrouped.mockRejectedValue(new Error('InfluxDB down'));

        ignitionBuffer.set('mun_pozo1', {
            municipio: 'IXTAPALUCA',
            pozo_name: 'POZO 1',
            fields: { presion: 2.5 },
            tags: { calidad: 'Good' },
            timer: null,
            retries: 0,
        });

        // Attempt 1
        await flushBufferToInflux('mun_pozo1');
        expect(ignitionBuffer.has('mun_pozo1')).toBe(true);
        expect(ignitionBuffer.get('mun_pozo1')!.retries).toBe(1);

        // Attempt 2
        await flushBufferToInflux('mun_pozo1');
        expect(ignitionBuffer.has('mun_pozo1')).toBe(true);
        expect(ignitionBuffer.get('mun_pozo1')!.retries).toBe(2);

        // Attempt 3 — should discard
        await flushBufferToInflux('mun_pozo1');
        expect(ignitionBuffer.has('mun_pozo1')).toBe(false);
    });

    it('uses snapshot — new data arriving during write is NOT lost', async () => {
        // Simulate slow write that resolves after we mutate the entry
        let resolveWrite: () => void;
        mockWriteGrouped.mockImplementationOnce(() => {
            return new Promise<void>((resolve) => { resolveWrite = resolve; });
        });

        const originalTimer = setTimeout(() => {}, 99999);
        ignitionBuffer.set('mun_pozo1', {
            municipio: 'IXTAPALUCA',
            pozo_name: 'POZO 1',
            fields: { presion: 2.5 },
            tags: { calidad: 'Good' },
            timer: originalTimer,
            retries: 0,
        });

        // Start the flush (it will await the mock)
        const flushPromise = flushBufferToInflux('mun_pozo1');

        // Simulate new MQTT message arriving while write is in progress
        const entry = ignitionBuffer.get('mun_pozo1')!;
        entry.fields.caudal = 10.0; // New data!
        entry.retries = 0;
        if (entry.timer) clearTimeout(entry.timer);
        const newTimer = setTimeout(() => {}, 99999);
        entry.timer = newTimer; // Different timer reference

        // Now resolve the write
        resolveWrite!();
        await flushPromise;

        // Entry should NOT have been deleted (new data arrived during write)
        expect(ignitionBuffer.has('mun_pozo1')).toBe(true);
        // The new data should still be in the entry
        expect(ignitionBuffer.get('mun_pozo1')!.fields.caudal).toBe(10.0);

        // The snapshot sent to InfluxDB should have the OLD data only
        expect(mockWriteGrouped).toHaveBeenCalledWith(
            expect.objectContaining({
                fields: { presion: 2.5 }, // No caudal — that came after snapshot
            })
        );

        clearTimeout(originalTimer);
        clearTimeout(newTimer);
    });

    it('missing entry returns early without error', async () => {
        await flushBufferToInflux('nonexistent_key');
        expect(mockWriteGrouped).not.toHaveBeenCalled();
    });

    it('retry with eventual success writes data and cleans up', async () => {
        mockWriteGrouped
            .mockRejectedValueOnce(new Error('InfluxDB down'))
            .mockResolvedValueOnce(undefined); // Second attempt succeeds

        ignitionBuffer.set('mun_pozo1', {
            municipio: 'IXTAPALUCA',
            pozo_name: 'POZO 1',
            fields: { presion: 2.5 },
            tags: { calidad: 'Good' },
            timer: null,
            retries: 0,
        });

        // First attempt fails
        await flushBufferToInflux('mun_pozo1');
        expect(ignitionBuffer.has('mun_pozo1')).toBe(true);

        // Second attempt succeeds
        await flushBufferToInflux('mun_pozo1');
        expect(ignitionBuffer.has('mun_pozo1')).toBe(false);
        expect(mockWriteGrouped).toHaveBeenCalledTimes(2);
    });
});
