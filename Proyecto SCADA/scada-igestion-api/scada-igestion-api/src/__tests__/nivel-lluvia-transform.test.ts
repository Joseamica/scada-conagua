import { describe, it, expect } from 'vitest';
import { transformTelemetry } from '../services/transformer-service';
import { ChirpstackUplinkPayload } from '../interfaces/telemetry';

const makePayload = (overrides: Record<string, any> = {}): ChirpstackUplinkPayload => ({
    time: '2026-03-06T12:00:00Z',
    fPort: 1,
    deviceInfo: { devEui: 'test123', deviceName: 'Test', applicationName: 'App' },
    rxInfo: [{ rssi: -50, snr: 8 }],
    object: {
        adc_1: 8.0,
        adc_2: 8.0,
        adv_2: 7.5,
        gpio_in_1: 'high',
        gpio_in_2: 'high',
        gpio_in_3: 'low',
        ...overrides,
    },
});

const baseMeta = { site_name: 'Pozo Test', municipality: 'Ecatepec', pipe_diameter: '6' };

describe('Nivel y Lluvia Transform', () => {
    it('produces nivel_m and lluvia_mm when adc_3/adc_4 are present', () => {
        const payload = makePayload({ adc_3: 12.0, adc_4: 12.0 });
        const result = transformTelemetry(payload, baseMeta);

        expect(result).not.toBeNull();
        expect(result!.nivel_m).toBeDefined();
        expect(result!.lluvia_mm).toBeDefined();
        expect(result!.nivel_m).toBeGreaterThan(0);
        expect(result!.lluvia_mm).toBeGreaterThan(0);
    });

    it('does NOT include nivel_m or lluvia_mm when adc_3/adc_4 are absent', () => {
        const payload = makePayload();
        const result = transformTelemetry(payload, baseMeta);

        expect(result).not.toBeNull();
        expect(result!.nivel_m).toBeUndefined();
        expect(result!.lluvia_mm).toBeUndefined();
    });

    it('does NOT produce nivel_m when adc_3 is in dead zone (<=4.05)', () => {
        const payload = makePayload({ adc_3: 4.0 });
        const result = transformTelemetry(payload, baseMeta);

        expect(result).not.toBeNull();
        expect(result!.nivel_m).toBeUndefined();
    });

    it('scales adc_3=12.0 mA with max=10m to nivel_m=5.0', () => {
        const payload = makePayload({ adc_3: 12.0 });
        const result = transformTelemetry(payload, baseMeta);

        expect(result).not.toBeNull();
        // scale(12.0, 10.0) = ((12 - 4) * 10) / 16 = 5.0
        expect(result!.nivel_m).toBe(5.0);
    });

    it('uses siteMetadata.nivel_max override when present', () => {
        const payload = makePayload({ adc_3: 12.0 });
        const meta = { ...baseMeta, nivel_max: '20' };
        const result = transformTelemetry(payload, meta);

        expect(result).not.toBeNull();
        // scale(12.0, 20.0) = ((12 - 4) * 20) / 16 = 10.0
        expect(result!.nivel_m).toBe(10.0);
    });

    it('uses siteMetadata.lluvia_max override when present', () => {
        const payload = makePayload({ adc_4: 12.0 });
        const meta = { ...baseMeta, lluvia_max: '200' };
        const result = transformTelemetry(payload, meta);

        expect(result).not.toBeNull();
        // scale(12.0, 200.0) = ((12 - 4) * 200) / 16 = 100.0
        expect(result!.lluvia_mm).toBe(100.0);
    });
});
