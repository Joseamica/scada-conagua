// src/services/analytics-service.ts — Pure statistical functions for SCADA analytics
// No external ML dependencies — runs entirely in Node.js

export interface DataPoint {
    timestamp: string;
    value: number;
}

export interface TrendResult {
    slope: number;
    intercept: number;
    r2: number;
    direction: 'increasing' | 'decreasing' | 'stable';
    slopePerDay: number;
    trendLine: DataPoint[];
}

export interface AnomalyResult {
    timestamp: string;
    value: number;
    zscore: number;
    severity: 'low' | 'medium' | 'high';
}

export interface PredictionResult {
    historical: DataPoint[];
    predicted: DataPoint[];
    confidence: { upper: DataPoint[]; lower: DataPoint[] };
    alpha: number;
}

export interface CleanResult {
    original: DataPoint[];
    cleaned: DataPoint[];
    spikesRemoved: number;
    percentCleaned: number;
}

export interface StatsResult {
    count: number;
    mean: number;
    median: number;
    stddev: number;
    min: number;
    max: number;
    q1: number;
    q3: number;
    iqr: number;
}

// ─── Linear Regression ───
export function linearRegression(data: DataPoint[]): TrendResult {
    if (data.length < 2) {
        return { slope: 0, intercept: 0, r2: 0, direction: 'stable', slopePerDay: 0, trendLine: [] };
    }

    const t0 = new Date(data[0].timestamp).getTime();
    const points = data.map(d => ({
        x: (new Date(d.timestamp).getTime() - t0) / 86400000, // days since start
        y: d.value,
    }));

    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
    for (const p of points) {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumX2 += p.x * p.x;
        sumY2 += p.y * p.y;
    }

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) {
        return { slope: 0, intercept: sumY / n, r2: 0, direction: 'stable', slopePerDay: 0, trendLine: [] };
    }

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // R² (coefficient of determination)
    const yMean = sumY / n;
    let ssRes = 0, ssTot = 0;
    for (const p of points) {
        const predicted = slope * p.x + intercept;
        ssRes += (p.y - predicted) ** 2;
        ssTot += (p.y - yMean) ** 2;
    }
    const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

    // Direction
    const absSlope = Math.abs(slope);
    const direction = absSlope < 0.01 ? 'stable' : slope > 0 ? 'increasing' : 'decreasing';

    // Trend line (start and end points)
    const trendLine: DataPoint[] = [
        { timestamp: data[0].timestamp, value: intercept },
        { timestamp: data[data.length - 1].timestamp, value: slope * points[points.length - 1].x + intercept },
    ];

    return { slope, intercept, r2: Math.round(r2 * 1000) / 1000, direction, slopePerDay: slope, trendLine };
}

// ─── Anomaly Detection (Z-score + IQR) ───
export function detectAnomalies(data: DataPoint[], threshold: number = 2.5): AnomalyResult[] {
    if (data.length < 10) return [];

    const values = data.map(d => d.value);
    const stats = computeStats(values);
    const anomalies: AnomalyResult[] = [];

    // IQR bounds
    const lowerIQR = stats.q1 - 1.5 * stats.iqr;
    const upperIQR = stats.q3 + 1.5 * stats.iqr;

    for (let i = 0; i < data.length; i++) {
        const zscore = stats.stddev === 0 ? 0 : Math.abs((values[i] - stats.mean) / stats.stddev);
        const outsideIQR = values[i] < lowerIQR || values[i] > upperIQR;

        if (zscore > threshold || outsideIQR) {
            anomalies.push({
                timestamp: data[i].timestamp,
                value: values[i],
                zscore: Math.round(zscore * 100) / 100,
                severity: zscore > 4 ? 'high' : zscore > 3 ? 'medium' : 'low',
            });
        }
    }

    return anomalies;
}

// ─── Exponential Smoothing (Prediction) ───
export function exponentialSmoothing(data: DataPoint[], alpha: number = 0.3, periods: number = 288): PredictionResult {
    if (data.length < 5) {
        return { historical: data, predicted: [], confidence: { upper: [], lower: [] }, alpha };
    }

    const values = data.map(d => d.value);

    // Fit exponential smoothing
    const smoothed: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
        smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
    }

    // Residuals for confidence band
    const residuals = values.map((v, i) => v - smoothed[i]);
    const residualStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length);

    // Predict forward
    const lastSmoothed = smoothed[smoothed.length - 1];
    const lastTimestamp = new Date(data[data.length - 1].timestamp).getTime();
    const interval = data.length > 1
        ? (new Date(data[data.length - 1].timestamp).getTime() - new Date(data[0].timestamp).getTime()) / (data.length - 1)
        : 300000; // 5 min default

    const predicted: DataPoint[] = [];
    const upper: DataPoint[] = [];
    const lower: DataPoint[] = [];

    for (let i = 1; i <= periods; i++) {
        const ts = new Date(lastTimestamp + interval * i).toISOString();
        const widening = 1 + (i / periods) * 0.5; // confidence widens over time
        predicted.push({ timestamp: ts, value: Math.round(lastSmoothed * 100) / 100 });
        upper.push({ timestamp: ts, value: Math.round((lastSmoothed + 2 * residualStd * widening) * 100) / 100 });
        lower.push({ timestamp: ts, value: Math.round(Math.max(0, lastSmoothed - 2 * residualStd * widening) * 100) / 100 });
    }

    return { historical: data, predicted, confidence: { upper, lower }, alpha };
}

// ─── Spike Removal (Data Cleaning) ───
export function cleanSpikes(data: DataPoint[], windowSize: number = 5): CleanResult {
    if (data.length < windowSize * 2) {
        return { original: data, cleaned: data, spikesRemoved: 0, percentCleaned: 0 };
    }

    const values = data.map(d => d.value);
    const cleaned = [...values];
    let spikesRemoved = 0;

    for (let i = windowSize; i < values.length - windowSize; i++) {
        // Window around current point (excluding the point itself)
        const window: number[] = [];
        for (let j = i - windowSize; j <= i + windowSize; j++) {
            if (j !== i) window.push(values[j]);
        }

        const windowMean = window.reduce((s, v) => s + v, 0) / window.length;
        const windowStd = Math.sqrt(window.reduce((s, v) => s + (v - windowMean) ** 2, 0) / window.length);

        if (windowStd > 0 && Math.abs(values[i] - windowMean) > 3 * windowStd) {
            cleaned[i] = windowMean;
            spikesRemoved++;
        }
    }

    return {
        original: data,
        cleaned: data.map((d, i) => ({ timestamp: d.timestamp, value: Math.round(cleaned[i] * 100) / 100 })),
        spikesRemoved,
        percentCleaned: Math.round((spikesRemoved / data.length) * 10000) / 100,
    };
}

// ─── Descriptive Statistics ───
export function computeStats(values: number[]): StatsResult {
    if (values.length === 0) {
        return { count: 0, mean: 0, median: 0, stddev: 0, min: 0, max: 0, q1: 0, q3: 0, iqr: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const stddev = Math.sqrt(variance);
    const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];

    return {
        count: n,
        mean: Math.round(mean * 1000) / 1000,
        median: Math.round(median * 1000) / 1000,
        stddev: Math.round(stddev * 1000) / 1000,
        min: sorted[0],
        max: sorted[n - 1],
        q1: Math.round(q1 * 1000) / 1000,
        q3: Math.round(q3 * 1000) / 1000,
        iqr: Math.round((q3 - q1) * 1000) / 1000,
    };
}

// ─── Moving Average ───
export function movingAverage(data: DataPoint[], windowSize: number = 12): DataPoint[] {
    if (data.length < windowSize) return data;

    const result: DataPoint[] = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
        const window = data.slice(start, end);
        const avg = window.reduce((s, d) => s + d.value, 0) / window.length;
        result.push({ timestamp: data[i].timestamp, value: Math.round(avg * 100) / 100 });
    }
    return result;
}
