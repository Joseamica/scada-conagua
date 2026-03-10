import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { forkJoin, firstValueFrom } from 'rxjs';
import { SinopticoService, CanvasWidget, ChartConfig, LabelConfig, TableConfig } from '../../../../core/services/sinoptico.service';
import { TelemetryService } from '../../../../core/services/telemetry';
import { VariableService } from '../../../../core/services/variable.service';

/**
 * Fetches and caches telemetry data for sinoptico widgets.
 * - Live values: batch query via POST /sinopticos/:id/query (polling every 60s)
 * - Chart data: individual history queries per series
 *
 * Provided at component level (editor or viewer).
 */
@Injectable()
export class SinopticoDataStore implements OnDestroy {
  private sinopticoService = inject(SinopticoService);
  private telemetryService = inject(TelemetryService);
  private variableService = inject(VariableService);

  /** Live latest values keyed by "devEUI::measurement" */
  private _liveValues = signal<Record<string, any>>({});
  readonly liveValues = this._liveValues.asReadonly();

  /** Per-device last_updated_at timestamps keyed by "devEUI::measurement" */
  private _deviceTimestamps = signal<Record<string, string>>({});
  readonly deviceTimestamps = this._deviceTimestamps.asReadonly();

  /** Chart time-series keyed by "devEUI:measurement" → [[timestamp, value], ...] */
  private _chartData = signal<Record<string, [number, number][]>>({});
  readonly chartData = this._chartData.asReadonly();

  /** Last fetch timestamp */
  private _lastUpdate = signal<string | null>(null);
  readonly lastUpdate = this._lastUpdate.asReadonly();

  /** Loading state */
  private _loadingLive = signal(false);
  readonly loadingLive = this._loadingLive.asReadonly();

  private _loadingCharts = signal(false);
  readonly loadingCharts = this._loadingCharts.asReadonly();

  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private sinopticoId = 0;

  ngOnDestroy(): void {
    this.stopPolling();
  }

  /**
   * Start fetching data for the given sinoptico's widgets.
   * Fetches immediately, then polls every 60s for live values.
   */
  startPolling(sinopticoId: number, widgets: CanvasWidget[]): void {
    this.sinopticoId = sinopticoId;
    this.stopPolling();

    // Immediate fetch
    this.fetchLiveValues(widgets);
    this.fetchAllChartData(widgets);

    // Poll live values every 60s
    this.pollingTimer = setInterval(() => {
      this.fetchLiveValues(widgets);
    }, 60_000);
  }

  stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /** Refresh data for updated widget list (e.g., after config change) */
  refresh(widgets: CanvasWidget[]): void {
    this.fetchLiveValues(widgets);
    this.fetchAllChartData(widgets);
  }

  /** Fetch only chart data (e.g., after time range change) */
  refreshCharts(widgets: CanvasWidget[]): void {
    this.fetchAllChartData(widgets);
  }

  /** Get the latest value for a devEUI + measurement, or a view formula key */
  getValue(keyOrDevEUI: string, measurement?: string): number | null {
    const values = this._liveValues();
    // View formula key: "view:1:formula:2"
    if (keyOrDevEUI.startsWith('view:')) {
      const entry = values[keyOrDevEUI];
      return entry?.value ?? null;
    }
    // Original tag key: "devEUI::measurement"
    if (!keyOrDevEUI || !measurement) return null;
    const key = `${keyOrDevEUI}::${measurement}`;
    const entry = values[key];
    if (!entry) return null;
    return this.extractValue(entry, measurement);
  }

  /** Get chart series data for a devEUI + measurement, or a view formula series */
  getChartSeries(
    seriesOrDevEUI: { source?: string; viewId?: number; formulaId?: number; devEUI?: string; measurement?: string } | string,
    measurement?: string,
  ): [number, number][] {
    if (typeof seriesOrDevEUI === 'object') {
      const s = seriesOrDevEUI;
      if (s.source === 'view' && s.viewId && s.formulaId) {
        return this._chartData()[`view:${s.viewId}:formula:${s.formulaId}`] || [];
      }
      return this._chartData()[`${s.devEUI}:${s.measurement}`] || [];
    }
    // Legacy string-based call
    const key = `${seriesOrDevEUI}:${measurement}`;
    return this._chartData()[key] || [];
  }

  /** Returns the last_updated_at for a device key, or null */
  getDeviceTimestamp(keyOrDevEUI: string, measurement?: string): string | null {
    if (keyOrDevEUI.startsWith('view:')) return null; // formulas don't have device timestamps
    const key = measurement ? `${keyOrDevEUI}::${measurement}` : keyOrDevEUI;
    return this._deviceTimestamps()[key] || null;
  }

  /** Returns true if the device data is stale (>15 minutes old) */
  isStale(keyOrDevEUI: string, measurement?: string): boolean {
    const ts = this.getDeviceTimestamp(keyOrDevEUI, measurement);
    if (!ts) return false; // no data yet, don't show stale
    const diff = Date.now() - new Date(ts).getTime();
    return diff > 15 * 60 * 1000; // 15 minutes
  }

  // ==================== Private ====================

  private fetchLiveValues(widgets: CanvasWidget[]): void {
    const widgetPayloads = this.buildWidgetPayloads(widgets);
    if (widgetPayloads.length === 0) return;

    this._loadingLive.set(true);
    this.sinopticoService.queryWidgets(this.sinopticoId, widgetPayloads).subscribe({
      next: (res) => {
        this._liveValues.set(res.results || {});
        this._lastUpdate.set(res.timestamp);

        // Extract per-device last_updated_at timestamps
        const timestamps: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.results || {})) {
          if (value && (value as any).last_updated_at) {
            timestamps[key] = (value as any).last_updated_at;
          }
        }
        this._deviceTimestamps.set(timestamps);

        this._loadingLive.set(false);
      },
      error: () => this._loadingLive.set(false),
    });
  }

  private fetchAllChartData(widgets: CanvasWidget[]): void {
    const chartWidgets = widgets.filter((w) => w.type === 'chart');
    if (chartWidgets.length === 0) return;

    const tagRequests: Record<string, ReturnType<typeof this.telemetryService.getHistory>> = {};
    const viewSeriesEntries: { key: string; viewId: number; formulaId: number; range: string }[] = [];

    for (const w of chartWidgets) {
      const cfg = w.config as ChartConfig;
      const range = cfg.timeRange || '24h';
      const influxRange = this.toInfluxRange(range);
      for (const s of cfg.series) {
        if (s.source === 'view' && s.viewId && s.formulaId) {
          const key = `view:${s.viewId}:formula:${s.formulaId}`;
          if (!viewSeriesEntries.some((e) => e.key === key)) {
            viewSeriesEntries.push({ key, viewId: s.viewId, formulaId: s.formulaId, range });
          }
        } else {
          if (!s.devEUI || !s.measurement) continue;
          const key = `${s.devEUI}:${s.measurement}`;
          if (!tagRequests[key]) {
            tagRequests[key] = this.telemetryService.getHistory(s.devEUI, s.measurement, influxRange);
          }
        }
      }
    }

    const tagKeys = Object.keys(tagRequests);
    if (tagKeys.length === 0 && viewSeriesEntries.length === 0) return;

    this._loadingCharts.set(true);

    // Fetch tag-based chart data via forkJoin
    const tagPromise =
      tagKeys.length > 0
        ? firstValueFrom(forkJoin(tagRequests)).then((results: any) => {
            const chartData: Record<string, [number, number][]> = {};
            for (const key of tagKeys) {
              const res = results[key];
              if (res?.data) {
                chartData[key] = res.data.map((d: any) => [
                  new Date(d._time || d.timestamp).getTime(),
                  d._value ?? d.value,
                ]);
              }
            }
            return chartData;
          })
        : Promise.resolve({} as Record<string, [number, number][]>);

    // Fetch view formula series data
    const viewPromises = viewSeriesEntries.map((entry) =>
      firstValueFrom(
        this.variableService.executeViewSeries(entry.viewId, entry.formulaId, entry.range),
      ).then(
        (result) => ({ key: entry.key, data: result.data }),
        () => ({ key: entry.key, data: [] as [number, number][] }),
      ),
    );

    Promise.all([tagPromise, ...viewPromises])
      .then(([tagData, ...viewResults]) => {
        const chartData: Record<string, [number, number][]> = { ...tagData };
        for (const vr of viewResults) {
          chartData[vr.key] = vr.data;
        }
        this._chartData.set(chartData);
        this._loadingCharts.set(false);
      })
      .catch(() => this._loadingCharts.set(false));
  }

  private buildWidgetPayloads(widgets: CanvasWidget[]): any[] {
    const payloads: any[] = [];
    for (const w of widgets) {
      if (w.type === 'label') {
        const cfg = w.config as LabelConfig;
        if (cfg.devEUI && cfg.measurement) {
          payloads.push({ devEUI: cfg.devEUI, measurement: cfg.measurement });
        }
      } else if (w.type === 'chart') {
        const cfg = w.config as ChartConfig;
        const validSeries = cfg.series.filter((s) => s.devEUI && s.measurement);
        if (validSeries.length > 0) {
          payloads.push({ series: validSeries.map((s) => ({ devEUI: s.devEUI, measurement: s.measurement })) });
        }
      } else if (w.type === 'table') {
        const cfg = w.config as TableConfig;
        for (const col of cfg.columns) {
          if (col.devEUI && col.measurement) {
            payloads.push({ devEUI: col.devEUI, measurement: col.measurement });
          }
        }
      }
    }
    return payloads;
  }

  private extractValue(entry: any, measurement: string): number | null {
    // New format: backend returns { value, last_updated_at } directly from InfluxDB
    if (entry.value !== undefined) {
      return entry.value !== null ? Number(entry.value) : null;
    }
    // Legacy fallback: site_status field mapping
    const fieldMap: Record<string, string> = {
      caudal_lts: 'last_flow_value',
      presion_kg: 'last_pressure_value',
      last_total_flow: 'last_total_flow',
      nivel_m: 'last_nivel_value',
      lluvia_mm: 'last_lluvia_value',
      rssi: 'rssi',
      snr: 'snr',
      battery: 'battery_level',
      value_presion: 'last_pressure_value',
      value_caudal: 'last_flow_value',
      value_caudal_totalizado: 'last_total_flow',
      value_senal: 'rssi',
      value_nivel: 'last_nivel_value',
      value_lluvia: 'last_lluvia_value',
    };
    const field = fieldMap[measurement] || measurement;
    const val = entry[field] ?? entry[measurement];
    return val !== null && val !== undefined ? Number(val) : null;
  }

  private toInfluxRange(timeRange: string): string {
    const map: Record<string, string> = {
      '1h': '-1h',
      '6h': '-6h',
      '24h': '-24h',
      '7d': '-7d',
      '30d': '-30d',
    };
    return map[timeRange] || '-24h';
  }
}
