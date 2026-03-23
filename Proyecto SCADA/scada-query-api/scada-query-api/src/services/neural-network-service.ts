// src/services/neural-network-service.ts
// MLP (Multi-Layer Perceptron) for time-series prediction using TensorFlow.js
// Trains on-demand with the data provided, predicts N steps forward.

import * as tf from '@tensorflow/tfjs';
import { DataPoint } from './analytics-service';

export interface NeuralPredictionResult {
    method: 'neural_network';
    architecture: string;
    epochs: number;
    loss: number;
    historical: DataPoint[];
    predicted: DataPoint[];
    confidence: { upper: DataPoint[]; lower: DataPoint[] };
    trainingTimeMs: number;
}

/**
 * Train an MLP on windowed time-series data and predict forward.
 *
 * Architecture: Input(windowSize) → Dense(32, relu) → Dense(16, relu) → Dense(1)
 * Normalization: min-max scaling to [0,1]
 * Window: uses last `windowSize` values to predict the next value
 *
 * @param data Historical data points
 * @param windowSize Number of past values used as input features (default: 12)
 * @param predictPeriods Number of future periods to predict (default: 48)
 * @param epochs Training epochs (default: 50)
 */
export async function neuralPredict(
    data: DataPoint[],
    windowSize: number = 12,
    predictPeriods: number = 48,
    epochs: number = 50
): Promise<NeuralPredictionResult> {
    const startTime = Date.now();

    if (data.length < windowSize + 10) {
        throw new Error(`Datos insuficientes: necesita al menos ${windowSize + 10} puntos, tiene ${data.length}`);
    }

    const values = data.map(d => d.value);

    // ── Normalize to [0, 1] ──
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1; // avoid division by zero
    const normalized = values.map(v => (v - minVal) / range);

    // ── Create windowed training data ──
    const xs: number[][] = [];
    const ys: number[] = [];
    for (let i = 0; i < normalized.length - windowSize; i++) {
        xs.push(normalized.slice(i, i + windowSize));
        ys.push(normalized[i + windowSize]);
    }

    // ── Build MLP model ──
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 32, activation: 'relu', inputShape: [windowSize] }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));

    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'meanSquaredError',
    });

    // ── Train ──
    const xTensor = tf.tensor2d(xs);
    const yTensor = tf.tensor2d(ys, [ys.length, 1]);

    const history = await model.fit(xTensor, yTensor, {
        epochs,
        batchSize: Math.min(32, Math.floor(xs.length / 2)),
        shuffle: true,
        verbose: 0,
    });

    const finalLoss = history.history.loss[history.history.loss.length - 1] as number;

    // ── Predict forward ──
    let currentWindow = normalized.slice(-windowSize);
    const predictedNormalized: number[] = [];

    for (let i = 0; i < predictPeriods; i++) {
        const input = tf.tensor2d([currentWindow]);
        const output = model.predict(input) as tf.Tensor;
        const predictedValue = (await output.data())[0];
        predictedNormalized.push(predictedValue);

        // Slide window
        currentWindow = [...currentWindow.slice(1), predictedValue];

        input.dispose();
        output.dispose();
    }

    // ── Denormalize ──
    const predictedValues = predictedNormalized.map(v => v * range + minVal);

    // ── Compute confidence band ──
    // Use training residuals to estimate uncertainty
    const trainPredictions: number[] = [];
    for (let i = 0; i < xs.length; i++) {
        const input = tf.tensor2d([xs[i]]);
        const output = model.predict(input) as tf.Tensor;
        trainPredictions.push((await output.data())[0]);
        input.dispose();
        output.dispose();
    }

    const residuals = ys.map((actual, i) => actual - trainPredictions[i]);
    const residualStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length) * range;

    // ── Build output DataPoints ──
    const lastTimestamp = new Date(data[data.length - 1].timestamp).getTime();
    const interval = data.length > 1
        ? (new Date(data[data.length - 1].timestamp).getTime() - new Date(data[0].timestamp).getTime()) / (data.length - 1)
        : 300000;

    const predicted: DataPoint[] = [];
    const upper: DataPoint[] = [];
    const lower: DataPoint[] = [];

    for (let i = 0; i < predictPeriods; i++) {
        const ts = new Date(lastTimestamp + interval * (i + 1)).toISOString();
        const val = Math.round(predictedValues[i] * 100) / 100;
        const widening = 1 + (i / predictPeriods) * 0.5;
        predicted.push({ timestamp: ts, value: val });
        upper.push({ timestamp: ts, value: Math.round((val + 2 * residualStd * widening) * 100) / 100 });
        lower.push({ timestamp: ts, value: Math.round(Math.max(0, val - 2 * residualStd * widening) * 100) / 100 });
    }

    // ── Cleanup ──
    xTensor.dispose();
    yTensor.dispose();
    model.dispose();

    return {
        method: 'neural_network',
        architecture: `MLP [${windowSize} → 32(relu) → 16(relu) → 1]`,
        epochs,
        loss: Math.round(finalLoss * 10000) / 10000,
        historical: data,
        predicted,
        confidence: { upper, lower },
        trainingTimeMs: Date.now() - startTime,
    };
}
