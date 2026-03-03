import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject, signal, computed, effect } from '@angular/core';
import { Location, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft, heroBeaker, heroCheckCircle, heroMapPin,
  heroChartBar, heroPresentationChartLine, heroGlobeAmericas,
  heroArrowsPointingOut, heroArrowsPointingIn,
  heroMagnifyingGlassPlus, heroArrowPath, heroArrowDownTray,
  heroCursorArrowRays, heroTableCells, heroChartBarSquare,
  heroViewfinderCircle, heroPencil, heroChartPie
} from '@ng-icons/heroicons/outline';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { POZOS_DATA } from '../../pozos/pozos-data';
import { TelemetryService } from '../../../core/services/telemetry';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { getEChartsColors } from '../../../core/utils/echarts-theme';
import { TIME_RANGES, TimeRange } from '../../../shared/time-ranges';
import { DateRangePickerComponent, DateRangeOutput } from '../../../shared/date-range-picker/date-range-picker';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';
import * as echarts from 'echarts';

interface GisSource {
  type: 'kml';
  path: string;
  municipioId: number;
  estadoId: number;
}

const SITIOS_SOURCES: GisSource[] = [
  { type: 'kml' as const, path: 'assets/mapas/4PT/ecatepec.kml', municipioId: 33, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/ixtapaluca.kml', municipioId: 39, estadoId: 15 },
];

const MUNICIPIO_NAMES: Record<number, string> = { 33: 'Ecatepec', 39: 'Ixtapaluca', 25: 'Chalco' };
const MUNICIPIO_COLORS: Record<number, string> = { 33: '#6b0027', 39: '#007bff', 25: '#0d9488' };

type ChartType = 'line' | 'bar' | 'area';

const CHART_TYPE_OPTIONS: { key: ChartType; label: string; icon: string }[] = [
  { key: 'line',  label: 'Línea',  icon: 'heroPresentationChartLine' },
  { key: 'bar',   label: 'Barras', icon: 'heroChartBar' },
  { key: 'area',  label: 'Área',   icon: 'heroChartBarSquare' },
];

@Component({
  selector: 'overview',
  standalone: true,
  imports: [HeaderBarComponent, FooterTabsComponent, CommonModule, NgIconComponent, DateRangePickerComponent],
  providers: [
    provideIcons({
      heroArrowLeft, heroBeaker, heroCheckCircle, heroMapPin,
      heroChartBar, heroPresentationChartLine, heroGlobeAmericas,
      heroArrowsPointingOut, heroArrowsPointingIn,
      heroMagnifyingGlassPlus, heroArrowPath, heroArrowDownTray,
      heroCursorArrowRays, heroTableCells, heroChartBarSquare,
      heroViewfinderCircle, heroPencil, heroChartPie
    })
  ],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('chartEl') chartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('datePicker') datePickerRef!: DateRangePickerComponent;

  detalleMap!: L.Map;
  chart!: echarts.ECharts;

  gastoByMunicipio = new Map<number, number>();
  private location = inject(Location);
  private telemetryService = inject(TelemetryService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private tileLayer?: L.TileLayer;
  private resizeHandler = () => this.chart?.resize();

  private themeEffect = effect(() => {
    const theme = this.themeService.resolved();
    if (this.chart && this.lastChartData.size > 0) {
      this.renderChart();
      this.chart.resize();
    }
    if (this.tileLayer && this.detalleMap) {
      const url = theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      this.tileLayer.setUrl(url);
    }
  });

  // Scoped sources filtered by user role
  private scopedSources: GisSource[] = [];
  private scopedPozos: any[] = [];

  // Flags for sync: map overlay needs BOTH map DOM + API data ready
  private mapReady = false;
  private dataReady = false;

  // KPI values
  gastoTotalGlobal = 0;
  pozosActivos = 0;
  totalPozos = 0;
  municipiosCount = 0;
  promedioPorPozo = 0;

  // =========================
  // TIME RANGES
  // =========================
  timeRanges = TIME_RANGES;
  range = signal<TimeRange>('24h');

  private quickRangeMs: Record<string, number> = {
    '15m': 15*60e3, '30m': 30*60e3, '1h': 3600e3, '6h': 6*3600e3,
    '12h': 12*3600e3, '24h': 86400e3, '7d': 7*86400e3, '1m': 30*86400e3, '1y': 365*86400e3
  };

  setRange(r: TimeRange) {
    this.range.set(r);
    if (this.datePickerRef) {
      const now = new Date();
      const ms = this.quickRangeMs[r] || 86400e3;
      this.datePickerRef.syncFromQuickRange(new Date(now.getTime() - ms), now);
    }
    this.clearCustomRange();
  }

  // =========================
  // CUSTOM RANGE
  // =========================
  customFrom = signal('');
  customTo = signal('');
  customInterval = signal('');
  customRangeActive = computed(() => !!this.customFrom() && !!this.customTo());

  activeRangeLabel = computed(() => {
    if (this.customRangeActive()) {
      const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
      return `${fmt(this.customFrom())} – ${fmt(this.customTo())}`;
    }
    const labels: Record<string, string> = {
      '15m': 'Últimos 15 min', '30m': 'Últimos 30 min', '1h': 'Última hora',
      '6h': 'Últimas 6h', '12h': 'Últimas 12h', '24h': 'Último día',
      '7d': 'Última semana', '1m': 'Último mes', '1y': 'Último año'
    };
    return labels[this.range()] || this.range();
  });

  activeIntervalLabel = computed(() => {
    if (this.customRangeActive() && this.customInterval()) {
      const map: Record<string, string> = {
        '1m': '1 min', '5m': '5 min', '15m': '15 min', '30m': '30 min',
        '1h': '1 hora', '6h': '6 horas', '1d': '1 día'
      };
      return map[this.customInterval()] || this.customInterval();
    }
    const autoMap: Record<string, string> = {
      '15m': '1 min', '30m': '2 min', '1h': '5 min', '6h': '15 min',
      '12h': '30 min', '24h': '1 hora', '7d': '6 horas', '1m': '1 día', '1y': '7 días'
    };
    return 'Auto (' + (autoMap[this.range()] || '1h') + ')';
  });

  onRangeApplied(event: DateRangeOutput) {
    this.customFrom.set(event.from);
    this.customTo.set(event.to);
    this.customInterval.set(event.interval);
    this.loadHistoricalData();
  }

  clearCustomRange() {
    this.customFrom.set('');
    this.customTo.set('');
    this.customInterval.set('');
    this.loadHistoricalData();
  }

  clearInterval() {
    this.customInterval.set('');
    this.loadHistoricalData();
  }

  // =========================
  // CHART TYPE & TOOLBAR
  // =========================
  chartTypeOptions = CHART_TYPE_OPTIONS;
  chartType = signal<ChartType>('line');
  crosshairEnabled = signal(false);
  activeBrushType = signal<'none' | 'lineX' | 'rect' | 'polygon'>('none');
  isFullscreen = signal(false);
  loading = signal(false);

  // Municipality toggles
  municipioSeries = signal<{ id: number; name: string; color: string; liveFlow: number }[]>([]);
  selectedMunicipios = signal<Set<number>>(new Set());

  // Cached chart data per municipio: Map<municipioId, [timestamp, value][]>
  private lastChartData = new Map<number, [number, number | null][]>();
  municipioStats = signal<Record<number, { min: number; max: number; avg: number; current: number }>>({});

  private escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isFullscreen()) {
      this.isFullscreen.set(false);
      setTimeout(() => this.chart?.resize(), 50);
    }
  };

  setChartType(t: ChartType) {
    this.chartType.set(t);
    if (this.lastChartData.size > 0) this.renderChart();
    else this.loadHistoricalData();
  }

  toggleCrosshair() {
    this.crosshairEnabled.set(!this.crosshairEnabled());
    if (this.lastChartData.size > 0) this.renderChart();
  }

  setBrushType(type: 'lineX' | 'rect' | 'polygon') {
    if (!this.chart) return;
    if (this.activeBrushType() === type) {
      this.activeBrushType.set('none');
      this.chart.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: false, brushMode: 'single' } });
    } else {
      this.chart.setOption({ brush: { toolbox: [], xAxisIndex: 0 } });
      this.activeBrushType.set(type);
      this.chart.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: type, brushMode: 'single' } });
    }
  }

  resetZoom() {
    if (!this.chart) return;
    this.activeBrushType.set('none');
    this.chart.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: false, brushMode: 'single' } });
    this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: 0, end: 100 });
    this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, start: 0, end: 100 });
  }

  toggleFullscreen() {
    const next = !this.isFullscreen();
    this.isFullscreen.set(next);
    if (next) document.addEventListener('keydown', this.escHandler);
    else document.removeEventListener('keydown', this.escHandler);
    setTimeout(() => this.chart?.resize(), 50);
  }

  downloadChartPng() {
    if (!this.chart) return;
    const url = this.chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gasto_overview.png';
    a.click();
  }

  exportCsv() {
    const selected = this.selectedMunicipios();
    const activeSeries = this.municipioSeries().filter(m => selected.has(m.id));
    if (activeSeries.length === 0) return;

    const allTimestamps = new Set<number>();
    for (const m of activeSeries) {
      const d = this.lastChartData.get(m.id);
      if (d) d.forEach(p => allTimestamps.add(p[0]));
    }
    const sorted = Array.from(allTimestamps).sort((a, b) => a - b);

    const lookups: Record<number, Map<number, number | null>> = {};
    for (const m of activeSeries) {
      const map = new Map<number, number | null>();
      const d = this.lastChartData.get(m.id);
      if (d) d.forEach(p => map.set(p[0], p[1]));
      lookups[m.id] = map;
    }

    const headers = ['Fecha', ...activeSeries.map(m => `${m.name} (l/s)`)];
    const rows = sorted.map(ts => {
      const date = new Date(ts).toLocaleString('es-MX');
      const values = activeSeries.map(m => {
        const val = lookups[m.id].get(ts);
        return val !== null && val !== undefined ? val.toString() : '';
      });
      return [date, ...values].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gasto_overview.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  toggleMunicipio(id: number) {
    const current = new Set(this.selectedMunicipios());
    if (current.has(id)) {
      if (current.size <= 1) return;
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedMunicipios.set(current);
    this.renderChart();
  }

  isMunicipioSelected(id: number): boolean {
    return this.selectedMunicipios().has(id);
  }

  constructor(private router: Router) {}

  goBack() { this.location.back(); }

  ngOnInit() {
    this.initScopedData();
    this.loadStaticData();
    this.loadLiveFlowData();
  }

  private initScopedData() {
    const user = this.authService.currentUser();
    const scope = user?.scope;
    const scopeId = user?.scope_id;

    if (scope === 'Municipal' && scopeId) {
      this.scopedSources = SITIOS_SOURCES.filter(s => s.municipioId === scopeId);
      this.scopedPozos = Object.values(POZOS_DATA).filter(
        (p: any) => Number(p.municipioId) === scopeId
      );
    } else if (scope === 'Estatal' && user?.estado_id) {
      this.scopedSources = SITIOS_SOURCES.filter(s => s.estadoId === user.estado_id);
      this.scopedPozos = Object.values(POZOS_DATA);
    } else {
      this.scopedSources = [...SITIOS_SOURCES];
      this.scopedPozos = Object.values(POZOS_DATA);
    }

    // Build municipality series data
    const series = this.scopedSources.map(s => ({
      id: s.municipioId,
      name: MUNICIPIO_NAMES[s.municipioId] || `Mun. ${s.municipioId}`,
      color: MUNICIPIO_COLORS[s.municipioId] || '#6b0027',
      liveFlow: 0
    }));
    this.municipioSeries.set(series);
    this.selectedMunicipios.set(new Set(series.map(s => s.id)));
  }

  ngAfterViewInit() {
    this.initBaseMap();
    this.chart = echarts.init(this.chartRef.nativeElement);

    // Brush-to-zoom
    this.chart.on('brushEnd', (params: any) => {
      const areas = params.areas;
      if (!areas?.length || !areas[0].coordRange) return;
      const brushType = this.activeBrushType();
      const range = areas[0].coordRange;
      let xStart: number, xEnd: number;
      if (brushType === 'lineX') { [xStart, xEnd] = range; }
      else if (brushType === 'rect') { [xStart, xEnd] = range[0]; }
      else if (brushType === 'polygon') {
        const xs = range.map((p: number[]) => p[0]);
        xStart = Math.min(...xs); xEnd = Math.max(...xs);
      } else return;

      this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, startValue: xStart, endValue: xEnd });
      this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, startValue: xStart, endValue: xEnd });
      this.chart.dispatchAction({ type: 'brush', areas: [] });
      this.chart.dispatchAction({ type: 'takeGlobalCursor', key: 'brush', brushOption: { brushType: false, brushMode: 'single' } });
      this.activeBrushType.set('none');
    });

    this.mapReady = true;
    this.tryLoadOverlay();
    this.loadHistoricalData();
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy() {
    if (this.chart) this.chart.dispose();
    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('keydown', this.escHandler);
  }

  // =========================
  // DATA LOGIC
  // =========================

  private loadStaticData() {
    this.totalPozos = this.scopedPozos.length;
    this.pozosActivos = this.scopedPozos.filter((p: any) => (p.estatus || '').toLowerCase() === 'activo').length;
    this.municipiosCount = this.scopedSources.length;
  }

  private loadLiveFlowData() {
    const devEuiToMunicipio = new Map<string, number>();
    const scopedMunicipioIds = new Set(this.scopedSources.map(s => s.municipioId));
    this.scopedPozos.forEach((p: any) => {
      if ((p.estatus || '').toLowerCase() !== 'activo') return;
      if (!p.devEui || !p.municipioId) return;
      if (!scopedMunicipioIds.has(Number(p.municipioId))) return;
      devEuiToMunicipio.set(p.devEui.trim().toLowerCase(), Number(p.municipioId));
    });

    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        let totalGlobal = 0;
        sites.forEach(site => {
          const devEui = (site.dev_eui || '').trim().toLowerCase();
          const municipioId = devEuiToMunicipio.get(devEui);
          if (municipioId == null) return;
          const flow = Number(site.last_flow_value || 0);
          if (flow <= 0.01) return;
          totalGlobal += flow;
          const current = this.gastoByMunicipio.get(municipioId) || 0;
          this.gastoByMunicipio.set(municipioId, Math.round((current + flow) * 100) / 100);
        });

        this.gastoTotalGlobal = Math.round(totalGlobal * 100) / 100;
        this.promedioPorPozo = this.pozosActivos > 0
          ? Math.round((this.gastoTotalGlobal / this.pozosActivos) * 100) / 100
          : 0;

        // Update municipality live flow values
        const series = this.municipioSeries().map(m => ({
          ...m,
          liveFlow: this.gastoByMunicipio.get(m.id) || 0
        }));
        this.municipioSeries.set(series);

        this.dataReady = true;
        this.tryLoadOverlay();
      },
      error: () => {
        this.dataReady = true;
        this.tryLoadOverlay();
      }
    });
  }

  // =========================
  // HISTORICAL DATA
  // =========================

  loadHistoricalData() {
    if (!this.chart) return;

    // Build devEUI list per municipio
    const municipioWells = new Map<number, string[]>();
    const scopedMunicipioIds = new Set(this.scopedSources.map(s => s.municipioId));

    this.scopedPozos.forEach((p: any) => {
      if ((p.estatus || '').toLowerCase() !== 'activo') return;
      if (!p.devEui || !p.municipioId) return;
      const mid = Number(p.municipioId);
      if (!scopedMunicipioIds.has(mid)) return;
      const wells = municipioWells.get(mid) || [];
      wells.push(p.devEui);
      municipioWells.set(mid, wells);
    });

    // Build range params
    let rangeStr = `-${this.range()}`;
    if (this.range() === '1m') rangeStr = '-1mo';
    const options: { from?: string; to?: string; interval?: string } = {};
    if (this.customRangeActive()) {
      options.from = this.customFrom();
      options.to = this.customTo();
    }
    if (this.customInterval()) options.interval = this.customInterval();

    // Fetch all wells in parallel
    const requests: Record<string, any> = {};
    for (const [mid, wells] of municipioWells) {
      wells.forEach((devEUI, i) => {
        requests[`${mid}_${i}`] = this.telemetryService.getHistory(devEUI, 'caudal_lts', rangeStr, options);
      });
    }

    if (Object.keys(requests).length === 0) return;

    this.loading.set(true);

    forkJoin(requests).subscribe({
      next: (res: any) => {
        // Aggregate by municipio: for each timestamp, sum all wells' flow
        const aggregated = new Map<number, Map<number, number>>();

        for (const [key, data] of Object.entries(res) as [string, any][]) {
          const mid = parseInt(key.split('_')[0]);
          if (!aggregated.has(mid)) aggregated.set(mid, new Map());
          const munMap = aggregated.get(mid)!;

          (data.data || []).forEach((p: any) => {
            const ts = new Date(p.timestamp).getTime();
            const v = p.value != null && p.value > 0.01 ? p.value : 0;
            munMap.set(ts, (munMap.get(ts) || 0) + v);
          });
        }

        // Convert to chart data format
        this.lastChartData.clear();
        for (const [mid, munMap] of aggregated) {
          const sorted = Array.from(munMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([ts, v]): [number, number | null] => [ts, v > 0.01 ? Math.round(v * 100) / 100 : null]);
          this.lastChartData.set(mid, sorted);
        }

        this.computeStats();
        this.renderChart();
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private computeStats() {
    const stats: Record<number, { min: number; max: number; avg: number; current: number }> = {};
    for (const [mid, data] of this.lastChartData) {
      const values = data.map(d => d[1]).filter((v): v is number => v !== null && v > 0);
      if (values.length === 0) continue;
      stats[mid] = {
        min: Math.round(Math.min(...values) * 100) / 100,
        max: Math.round(Math.max(...values) * 100) / 100,
        avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
        current: Math.round(values[values.length - 1] * 100) / 100,
      };
    }
    this.municipioStats.set(stats);
  }

  // =========================
  // RENDER CHART
  // =========================

  private renderChart() {
    if (!this.chart) return;
    const c = getEChartsColors(this.themeService.resolved());
    const selected = this.selectedMunicipios();
    const activeMunicipios = this.municipioSeries().filter(m => selected.has(m.id));
    const type = this.chartType();
    const isBar = type === 'bar';
    const isArea = type === 'area';

    const legendData: string[] = [];
    const series: any[] = [];

    for (const m of activeMunicipios) {
      const data = this.lastChartData.get(m.id) || [];
      legendData.push(m.name);
      const pointCount = data.filter(p => p[1] !== null).length;
      const sparse = pointCount < 10;

      const s: any = {
        name: m.name,
        type: isBar ? 'bar' : 'line',
        data,
        showSymbol: sparse, symbolSize: sparse ? 6 : 4,
        smooth: false, sampling: 'lttb',
        connectNulls: false
      };

      if (isBar) {
        s.itemStyle = { color: m.color };
        s.barMaxWidth = 8;
      } else {
        s.lineStyle = { width: 1.5, color: m.color };
      }

      if (isArea) {
        s.areaStyle = { color: m.color + '25' };
      }

      series.push(s);
    }

    const option: any = {
      backgroundColor: c.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        axisPointer: this.crosshairEnabled()
          ? { type: 'cross', crossStyle: { color: '#94a3b8', type: 'dashed' } }
          : { type: 'line', lineStyle: { color: '#94a3b8', type: 'dashed' } },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const date = new Date(params[0].value[0]);
          const dateStr = date.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          let html = `<div style="margin-bottom:6px;font-weight:600;color:#f1f5f9">${dateStr}</div>`;
          for (const p of params) {
            const val = p.value[1] !== null && p.value[1] !== undefined ? Number(p.value[1]).toFixed(2) : '—';
            html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">`;
            html += `<span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>`;
            html += `<span style="flex:1;color:#cbd5e1">${p.seriesName}</span>`;
            html += `<span style="font-weight:600;color:#f1f5f9">${val} l/s</span>`;
            html += `</div>`;
          }
          return html;
        }
      },
      legend: { data: legendData, top: 0, textStyle: { color: c.textColor } },
      grid: { left: 56, right: 24, bottom: 64, top: 40 },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          fontSize: 11,
          color: c.subtextColor,
          formatter: (value: number) => {
            const d = new Date(value);
            return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
              + '\n' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          }
        },
        axisLine: { lineStyle: { color: c.axisLine } },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'l/s',
        scale: true,
        axisLabel: { color: c.subtextColor, fontSize: 11 },
        nameTextStyle: { color: c.subtextColor },
        splitLine: { lineStyle: { color: c.splitLine, type: 'dashed' } }
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
        {
          type: 'slider', xAxisIndex: 0, bottom: 8, height: 22,
          handleSize: '80%',
          handleStyle: { color: '#94a3b8', borderColor: '#64748b' },
          borderColor: 'transparent',
          backgroundColor: 'rgba(148,163,184,0.08)',
          fillerColor: 'rgba(0,123,255,0.12)',
          dataBackground: {
            lineStyle: { color: c.subtextColor, width: 0.5 },
            areaStyle: { color: 'rgba(203,213,225,0.15)' }
          }
        }
      ],
      series
    };

    this.chart.setOption(option, true);
  }

  // Only load municipio overlay when both map and data are ready
  private tryLoadOverlay() {
    if (this.mapReady && this.dataReady) this.loadMunicipiosOverview();
  }

  // =========================
  // MAP
  // =========================

  private initBaseMap() {
    this.detalleMap = L.map('mapOverview').setView([19.4, -99.1], 11);
    const tileUrl = this.themeService.resolved() === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    this.tileLayer = L.tileLayer(tileUrl, { subdomains: 'abcd', maxZoom: 19 }).addTo(this.detalleMap);
  }

  private loadMunicipiosOverview() {
    fetch('assets/mapas/edomex_municipios.geojson')
      .then(res => res.json())
      .then(data => {
        const municipiosSource = new Set(this.scopedSources.map(s => s.municipioId));

        const municipioLayer = L.geoJSON(data, {
          filter: (feature: any) => municipiosSource.has(Number(feature.properties?.CVE_MUN)),
          style: () => ({ color: '#0d9488', weight: 2, fillColor: '#0d9488', fillOpacity: 0.12 }),
          onEachFeature: (feature, layer) => {
            const municipioId = Number(feature.properties?.CVE_MUN);
            const nombre = feature.properties?.NOMGEO || feature.properties?.nombre;
            const gasto = this.gastoByMunicipio.get(municipioId) || 0;

            layer.bindTooltip(
              `<div class="municipio-label-wrapper">
                <div class="municipio-name">${nombre}</div>
                <div class="municipio-gasto">${gasto.toLocaleString()} l/s</div>
              </div>`,
              { permanent: true, direction: 'center', className: 'municipio-label', interactive: false }
            );

            layer.on('click', () => this.router.navigate(['/gerencia/municipio', municipioId]));
            (layer as any).getElement?.()?.style.setProperty('cursor', 'pointer');
          }
        }).addTo(this.detalleMap);

        this.detalleMap.fitBounds(municipioLayer.getBounds(), { paddingTopLeft: [20, 20], paddingBottomRight: [20, 20] });
      });
  }
}
