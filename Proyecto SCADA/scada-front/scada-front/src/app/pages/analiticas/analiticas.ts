import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderBarComponent } from '../../layout/header-bar/header-bar';
import { SidebarNavComponent } from '../../layout/sidebar-nav/sidebar-nav';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner';
import { AnalyticsService, AnalyticsTrend, AnalyticsAnomalyResponse, AnalyticsPrediction, AnalyticsClean, AnalyticsDashboard } from '../../core/services/analytics.service';
import { TelemetryService } from '../../core/services/telemetry';
import * as echarts from 'echarts';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-analiticas',
  standalone: true,
  templateUrl: './analiticas.html',
  styleUrls: ['./analiticas.css'],
  imports: [CommonModule, FormsModule, HeaderBarComponent, SidebarNavComponent, LoadingSpinnerComponent],
})
export class AnaliticasComponent implements OnInit {
  private analyticsService = inject(AnalyticsService);
  private telemetryService = inject(TelemetryService);
  private themeService = inject(ThemeService);

  activeTab = signal<'tendencias' | 'anomalias' | 'predicciones' | 'limpieza'>('tendencias');
  loading = signal(false);

  // Selectors
  sites = signal<{ dev_eui: string; site_name: string; municipality: string }[]>([]);
  selectedSite = signal('');
  selectedMeasurement = signal('caudal_lts');
  selectedRange = signal('-7d');

  measurements = [
    { key: 'caudal_lts', label: 'Caudal (L/s)' },
    { key: 'presion_kg', label: 'Presion (kg/cm²)' },
    { key: 'rssi', label: 'Senal RSSI (dBm)' },
    { key: 'battery', label: 'Bateria (%)' },
  ];

  ranges = [
    { key: '-24h', label: '24 horas' },
    { key: '-7d', label: '7 dias' },
    { key: '-30d', label: '30 dias' },
    { key: '-90d', label: '3 meses' },
  ];

  // Prediction method toggle
  predictionMethod = signal<'statistical' | 'neural'>('neural');
  predictionHorizon = signal<'24h' | '7d' | '30d'>('7d');
  neuralResult = signal<any>(null);

  // Dashboard KPIs
  dashboard = signal<AnalyticsDashboard | null>(null);

  // Results
  trendResult = signal<AnalyticsTrend | null>(null);
  anomalyResult = signal<AnalyticsAnomalyResponse | null>(null);
  predictionResult = signal<AnalyticsPrediction | null>(null);
  cleanResult = signal<AnalyticsClean | null>(null);

  // Chart
  private chart: echarts.ECharts | null = null;

  ngOnInit() {
    this.loadSites();
    this.loadDashboard();
  }

  loadSites() {
    this.telemetryService.getSites().subscribe({
      next: (sites: any[]) => {
        const filtered = sites
          .filter((s: any) => s.last_updated_at)
          .map((s: any) => ({ dev_eui: s.dev_eui, site_name: s.site_name, municipality: s.municipality }))
          .sort((a: any, b: any) => a.site_name.localeCompare(b.site_name));
        this.sites.set(filtered);
        if (filtered.length > 0 && !this.selectedSite()) {
          this.selectedSite.set(filtered[0].dev_eui);
        }
      },
      error: () => {},
    });
  }

  loadDashboard() {
    this.analyticsService.getDashboard().subscribe({
      next: (d) => this.dashboard.set(d),
      error: () => {},
    });
  }

  analyze() {
    const site = this.selectedSite();
    const measurement = this.selectedMeasurement();
    const range = this.selectedRange();
    if (!site) return;

    this.loading.set(true);

    switch (this.activeTab()) {
      case 'tendencias':
        this.analyticsService.getTrend(site, measurement, range).subscribe({
          next: (r) => { this.trendResult.set(r); this.renderTrendChart(r); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
        break;
      case 'anomalias':
        this.analyticsService.getAnomalies(site, measurement, range).subscribe({
          next: (r) => { this.anomalyResult.set(r); this.renderAnomalyChart(r); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
        break;
      case 'predicciones':
        const horizonPeriods = this.getHorizonPeriods();
        if (this.predictionMethod() === 'neural') {
          this.analyticsService.getNeuralPrediction(site, measurement, range, horizonPeriods.neural).subscribe({
            next: (r) => {
              this.neuralResult.set(r);
              this.predictionResult.set(r);
              this.renderPredictionChart(r);
              this.loading.set(false);
            },
            error: () => {
              this.analyticsService.getPrediction(site, measurement, range, horizonPeriods.statistical).subscribe({
                next: (r) => { this.predictionResult.set(r); this.renderPredictionChart(r); this.loading.set(false); },
                error: () => this.loading.set(false),
              });
            },
          });
        } else {
          this.analyticsService.getPrediction(site, measurement, range, horizonPeriods.statistical).subscribe({
            next: (r) => { this.predictionResult.set(r); this.renderPredictionChart(r); this.loading.set(false); },
            error: () => this.loading.set(false),
          });
        }
        break;
      case 'limpieza':
        this.analyticsService.getClean(site, measurement, range).subscribe({
          next: (r) => { this.cleanResult.set(r); this.renderCleanChart(r); this.loading.set(false); },
          error: () => this.loading.set(false),
        });
        break;
    }
  }

  onTabChange(tab: 'tendencias' | 'anomalias' | 'predicciones' | 'limpieza') {
    this.activeTab.set(tab);
    if (this.selectedSite()) this.analyze();
  }

  // ── Chart Rendering ──

  private initChart() {
    if (this.chart) this.chart.dispose();
    const el = document.getElementById('analytics-chart');
    if (!el) return;
    const isDark = this.themeService.resolved() === 'dark';
    this.chart = echarts.init(el, isDark ? 'dark' : undefined);
  }

  private renderTrendChart(r: AnalyticsTrend) {
    this.initChart();
    if (!this.chart || !r?.data?.length) return;

    const seriesColors = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];
    this.chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['Datos', 'Media movil', 'Tendencia'], top: 4 },
      grid: { top: 40, right: 20, bottom: 30, left: 60 },
      xAxis: { type: 'time' },
      yAxis: { type: 'value', name: this.selectedMeasurement() },
      series: [
        {
          name: 'Datos',
          type: 'line',
          data: r.data.map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 1, color: seriesColors[0] },
          itemStyle: { color: seriesColors[0] },
        },
        {
          name: 'Media movil',
          type: 'line',
          data: (r.movingAverage || []).map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 2, color: seriesColors[1] },
          itemStyle: { color: seriesColors[1] },
        },
        {
          name: 'Tendencia',
          type: 'line',
          data: (r.trend?.trendLine || []).map(d => [d.timestamp, Math.round(d.value * 100) / 100]),
          symbol: 'none',
          lineStyle: { width: 2, type: 'dashed', color: '#ef4444' },
          itemStyle: { color: '#ef4444' },
        },
      ],
    });
  }

  private renderAnomalyChart(r: AnalyticsAnomalyResponse) {
    this.initChart();
    if (!this.chart || !r?.data?.length) return;

    const seriesColors = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];
    this.chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['Datos', 'Anomalias'], top: 4 },
      grid: { top: 40, right: 20, bottom: 30, left: 60 },
      xAxis: { type: 'time' },
      yAxis: { type: 'value', name: this.selectedMeasurement() },
      series: [
        {
          name: 'Datos',
          type: 'line',
          data: r.data.map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 1.5, color: seriesColors[0] },
          itemStyle: { color: seriesColors[0] },
        },
        {
          name: 'Anomalias',
          type: 'scatter',
          data: r.anomalies.map(a => [a.timestamp, a.value]),
          symbol: 'circle',
          symbolSize: (val: any, params: any) => {
            const a = r.anomalies[params.dataIndex];
            return a ? Math.min(8 + a.zscore * 2, 20) : 8;
          },
          itemStyle: {
            color: '#ef4444',
            borderColor: '#fff',
            borderWidth: 1,
          },
        },
      ],
    });
  }

  private renderPredictionChart(r: AnalyticsPrediction) {
    this.initChart();
    if (!this.chart) return;
    if (!r?.historical?.length) return; // guard against undefined data

    const seriesColors = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];
    const predicted = r.predicted || [];
    const upper = r.confidence?.upper || [];
    const lower = r.confidence?.lower || [];

    this.chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['Historico', 'Prediccion', 'Banda superior', 'Banda inferior'], top: 4 },
      grid: { top: 40, right: 20, bottom: 30, left: 60 },
      xAxis: { type: 'time' },
      yAxis: { type: 'value', name: this.selectedMeasurement() },
      series: [
        {
          name: 'Historico',
          type: 'line',
          data: r.historical.map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 1.5, color: seriesColors[0] },
        },
        {
          name: 'Prediccion',
          type: 'line',
          data: predicted.map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 2, type: 'dashed', color: '#22c55e' },
        },
        {
          name: 'Banda superior',
          type: 'line',
          data: upper.map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 0 },
          areaStyle: { color: 'rgba(34,197,94,0.1)' },
        },
        {
          name: 'Banda inferior',
          type: 'line',
          data: lower.map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 0 },
          areaStyle: { color: 'rgba(34,197,94,0.1)', origin: 'start' },
        },
      ],
    });
  }

  private renderCleanChart(r: AnalyticsClean) {
    this.initChart();
    if (!this.chart) return;

    const seriesColors = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6'];
    this.chart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis' },
      legend: { data: ['Original', 'Limpio'], top: 4 },
      grid: { top: 40, right: 20, bottom: 30, left: 60 },
      xAxis: { type: 'time' },
      yAxis: { type: 'value', name: this.selectedMeasurement() },
      series: [
        {
          name: 'Original',
          type: 'line',
          data: r.original.map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 1, color: '#94a3b8', opacity: 0.5 },
        },
        {
          name: 'Limpio',
          type: 'line',
          data: r.cleaned.map(d => [d.timestamp, d.value]),
          symbol: 'none',
          lineStyle: { width: 2, color: seriesColors[0] },
        },
      ],
    });
  }

  /** Calculate periods based on horizon and data aggregation interval */
  private getHorizonPeriods(): { neural: number; statistical: number } {
    const h = this.predictionHorizon();
    // Neural uses hourly intervals, statistical uses the query interval
    switch (h) {
      case '24h': return { neural: 24, statistical: 288 };   // 24hrs / 1hr neural, 24hrs / 5min stat
      case '7d':  return { neural: 168, statistical: 2016 };  // 7d / 1hr, 7d / 5min
      case '30d': return { neural: 720, statistical: 720 };   // 30d / 1hr both (too many points otherwise)
      default:    return { neural: 48, statistical: 288 };
    }
  }

  /** Confidence label based on horizon */
  predictionConfidenceLabel = computed(() => {
    const h = this.predictionHorizon();
    switch (h) {
      case '24h': return 'Alta';
      case '7d': return 'Media';
      case '30d': return 'Baja — prediccion a largo plazo, usar con precaucion';
      default: return '';
    }
  });

  directionLabel(dir: string): string {
    switch (dir) {
      case 'increasing': return 'Subiendo';
      case 'decreasing': return 'Bajando';
      default: return 'Estable';
    }
  }

  directionIcon(dir: string): string {
    switch (dir) {
      case 'increasing': return '↑';
      case 'decreasing': return '↓';
      default: return '→';
    }
  }
}
