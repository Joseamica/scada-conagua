import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AnalyticsTrend {
  site: string;
  devEUI: string;
  measurement: string;
  range: string;
  dataPoints: number;
  trend: {
    slope: number;
    intercept: number;
    r2: number;
    direction: 'increasing' | 'decreasing' | 'stable';
    slopePerDay: number;
    trendLine: { timestamp: string; value: number }[];
  };
  stats: AnalyticsStats;
  movingAverage: { timestamp: string; value: number }[];
  data: { timestamp: string; value: number }[];
}

export interface AnalyticsAnomaly {
  timestamp: string;
  value: number;
  zscore: number;
  severity: 'low' | 'medium' | 'high';
}

export interface AnalyticsAnomalyResponse {
  site: string;
  devEUI: string;
  measurement: string;
  anomalyCount: number;
  anomalies: AnalyticsAnomaly[];
  stats: AnalyticsStats;
  data: { timestamp: string; value: number }[];
}

export interface AnalyticsPrediction {
  site: string;
  devEUI: string;
  measurement: string;
  historical: { timestamp: string; value: number }[];
  predicted: { timestamp: string; value: number }[];
  confidence: {
    upper: { timestamp: string; value: number }[];
    lower: { timestamp: string; value: number }[];
  };
}

export interface AnalyticsClean {
  site: string;
  devEUI: string;
  measurement: string;
  original: { timestamp: string; value: number }[];
  cleaned: { timestamp: string; value: number }[];
  spikesRemoved: number;
  percentCleaned: number;
}

export interface AnalyticsStats {
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

export interface AnalyticsDashboard {
  totalSites: number;
  sitesWithTelemetry: number;
  sitesWithAnomalies: number;
  sitesWithNegativeTrend: number;
  topAnomalies: { site: string; devEUI: string; municipality: string; issue: string }[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private base = `${environment.apiQueryUrl}/analytics`;

  getTrend(devEUI: string, measurement: string, range: string = '-7d'): Observable<AnalyticsTrend> {
    return this.http.get<AnalyticsTrend>(`${this.base}/trend/${devEUI}/${measurement}?range=${range}`);
  }

  getAnomalies(devEUI: string, measurement: string, range: string = '-7d', threshold: number = 2.5): Observable<AnalyticsAnomalyResponse> {
    return this.http.get<AnalyticsAnomalyResponse>(`${this.base}/anomalies/${devEUI}/${measurement}?range=${range}&threshold=${threshold}`);
  }

  getPrediction(devEUI: string, measurement: string, range: string = '-7d', periods: number = 288): Observable<AnalyticsPrediction> {
    return this.http.get<AnalyticsPrediction>(`${this.base}/prediction/${devEUI}/${measurement}?range=${range}&periods=${periods}`);
  }

  getNeuralPrediction(devEUI: string, measurement: string, range: string = '-7d', periods: number = 48): Observable<any> {
    return this.http.get<any>(`${this.base}/prediction/neural/${devEUI}/${measurement}?range=${range}&periods=${periods}`);
  }

  getClean(devEUI: string, measurement: string, range: string = '-7d', windowSize: number = 5): Observable<AnalyticsClean> {
    return this.http.get<AnalyticsClean>(`${this.base}/clean/${devEUI}/${measurement}?range=${range}&windowSize=${windowSize}`);
  }

  getDashboard(): Observable<AnalyticsDashboard> {
    return this.http.get<AnalyticsDashboard>(`${this.base}/dashboard`);
  }
}
