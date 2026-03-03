import {
  Component, AfterViewInit, OnInit, OnDestroy, ViewChild,
  ElementRef, signal, computed, inject, effect, DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import * as echarts from 'echarts';

import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeftStartOnRectangle, heroPresentationChartLine, heroChartBar,
  heroChartBarSquare, heroChartPie, heroCursorArrowRays, heroMagnifyingGlassPlus,
  heroViewfinderCircle, heroPencil, heroArrowPath, heroArrowsPointingOut,
  heroArrowsPointingIn, heroArrowDownTray, heroTableCells, heroMagnifyingGlass,
  heroXMark
} from '@ng-icons/heroicons/outline';
import { TelemetryService } from '../../../core/services/telemetry';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { getEChartsColors } from '../../../core/utils/echarts-theme';
import { POZOS_DATA } from '../../pozos/pozos-data';
import { TIME_RANGES, TimeRange } from '../../../shared/time-ranges';
import { DateRangePickerComponent, DateRangeOutput } from '../../../shared/date-range-picker/date-range-picker';

interface ChartVariable {
  key: string;
  label: string;
  unit: string;
  color: string;
  position: 'left' | 'right';
  defaultOn: boolean;
}

const CHART_VARIABLES: ChartVariable[] = [
  { key: 'caudal_lts',  label: 'Caudal',    unit: 'Lt/s',   color: '#007bff', position: 'left',  defaultOn: true },
  { key: 'presion_kg',  label: 'Presión',   unit: 'Kg/cm²', color: '#28a745', position: 'right', defaultOn: true },
  { key: 'rssi',        label: 'Señal LTE', unit: 'dBm',    color: '#ffc107', position: 'right', defaultOn: false },
  { key: 'snr',         label: 'SNR',       unit: 'dB',     color: '#9333ea', position: 'right', defaultOn: false },
];

// Distinguishable colors for multi-site series
const SITE_COLORS = [
  '#007bff', '#28a745', '#e91e8f', '#ff6b35', '#9333ea',
  '#06b6d4', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6',
  '#ec4899', '#84cc16', '#f97316', '#6366f1', '#22d3ee',
];

type ChartType = 'line' | 'bar' | 'area' | 'radar';

const CHART_TYPE_OPTIONS: { key: ChartType; label: string; icon: string }[] = [
  { key: 'line',  label: 'Línea',  icon: 'heroPresentationChartLine' },
  { key: 'bar',   label: 'Barras', icon: 'heroChartBar' },
  { key: 'area',  label: 'Área',   icon: 'heroChartBarSquare' },
  { key: 'radar', label: 'Radar',  icon: 'heroChartPie' },
];

@Component({
  selector: 'app-telemetria-avanzada',
  standalone: true,
  imports: [CommonModule, HeaderBarComponent, FooterTabsComponent, NgIconComponent, DateRangePickerComponent],
  providers: [
    provideIcons({
      heroArrowLeftStartOnRectangle, heroPresentationChartLine, heroChartBar,
      heroChartBarSquare, heroChartPie, heroCursorArrowRays, heroMagnifyingGlassPlus,
      heroViewfinderCircle, heroPencil, heroArrowPath, heroArrowsPointingOut,
      heroArrowsPointingIn, heroArrowDownTray, heroTableCells, heroMagnifyingGlass,
      heroXMark
    })
  ],
  templateUrl: './telemetria-avanzada.html',
  styleUrls: ['./telemetria-avanzada.css']
})
export class TelemetriaAvanzada implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('chart', { static: false }) chartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('radarChart', { static: false }) radarRef!: ElementRef<HTMLDivElement>;
  @ViewChild('datePicker') datePickerRef!: DateRangePickerComponent;
  chart!: echarts.ECharts;
  radarChart!: echarts.ECharts;

  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private resizeHandler = () => { this.chart?.resize(); this.radarChart?.resize(); };

  private themeEffect = effect(() => {
    const theme = this.themeService.resolved();
    if (this.chart) {
      const c = getEChartsColors(theme);
      this.chart.setOption({ backgroundColor: c.backgroundColor }, true);
      this.chart.resize();
    }
  });

  // Sites
  sitesDisponibles = signal<Array<{ devEUI: string; name: string }>>([]);
  selectedSites = signal<string[]>([]);
  searchQuery = signal('');

  filteredSites = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const sites = this.sitesDisponibles();
    if (!q) return sites;
    return sites.filter(s =>
      s.name.toLowerCase().includes(q) || s.devEUI.toLowerCase().includes(q)
    );
  });

  // Variables
  chartVariables = CHART_VARIABLES;
  selectedVars = signal<Set<string>>(new Set(['caudal_lts', 'presion_kg']));

  // Chart type
  chartTypeOptions = CHART_TYPE_OPTIONS;
  chartType = signal<ChartType>('line');

  // Time ranges
  timeRanges = TIME_RANGES;
  range = signal<TimeRange>('24h');

  private quickRangeMs: Record<string, number> = {
    '15m': 15*60e3, '30m': 30*60e3, '1h': 3600e3, '6h': 6*3600e3,
    '12h': 12*3600e3, '24h': 86400e3, '7d': 7*86400e3, '1m': 30*86400e3, '1y': 365*86400e3
  };

  // Custom range
  customFrom = signal('');
  customTo = signal('');
  customInterval = signal('');
  customRangeActive = computed(() => !!this.customFrom() && !!this.customTo());

  activeRangeLabel = computed(() => {
    if (this.customRangeActive()) {
      const fmt = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
      };
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

  // Toolbar signals
  crosshairEnabled = signal(false);
  activeBrushType = signal<'none' | 'lineX' | 'rect' | 'polygon'>('none');
  isFullscreen = signal(false);
  loading = signal(false);

  // Custom Y-axis ranges per variable
  yRanges = signal<Record<string, { min?: number; max?: number }>>({});

  // Data storage
  private lastChartData: Record<string, Record<string, [number, number | null][]>> = {};
  variableStats = signal<Record<string, { min: number; max: number; avg: number; current: number }>>({});

  private escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isFullscreen()) {
      this.isFullscreen.set(false);
      const c = this.chartType() === 'radar' ? this.radarChart : this.chart;
      setTimeout(() => c?.resize(), 50);
    }
  };

  private preselectedDevEUI: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private telemetryService: TelemetryService
  ) {
    this.preselectedDevEUI = this.route.snapshot.queryParams['devEUI'] || null;
  }

  // =========================
  // LIFECYCLE
  // =========================
  ngOnInit(): void {
    this.loadSites();
  }

  ngAfterViewInit(): void {
    this.chart = echarts.init(this.chartRef.nativeElement);

    // Brush-to-zoom
    this.chart.on('brushEnd', (params: any) => {
      const areas = params.areas;
      if (!areas?.length || !areas[0].coordRange) return;

      const brushType = this.activeBrushType();
      const range = areas[0].coordRange;
      let xStart: number, xEnd: number;

      if (brushType === 'lineX') {
        [xStart, xEnd] = range;
      } else if (brushType === 'rect') {
        [xStart, xEnd] = range[0];
      } else if (brushType === 'polygon') {
        const xs = range.map((p: number[]) => p[0]);
        xStart = Math.min(...xs);
        xEnd = Math.max(...xs);
      } else {
        return;
      }

      this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, startValue: xStart, endValue: xEnd });
      this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, startValue: xStart, endValue: xEnd });
      this.chart.dispatchAction({ type: 'brush', areas: [] });
      this.chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: { brushType: false, brushMode: 'single' }
      });
      this.activeBrushType.set('none');
    });

    if (this.radarRef?.nativeElement) {
      this.radarChart = echarts.init(this.radarRef.nativeElement);
    }

    this.loadCharts();
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy(): void {
    if (this.chart) this.chart.dispose();
    if (this.radarChart) this.radarChart.dispose();
    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('keydown', this.escHandler);
  }

  // =========================
  // SITES
  // =========================
  private loadSites(): void {
    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        const user = this.authService.currentUser();
        const scope = user?.scope;
        const scopeId = user?.scope_id;

        let allowedDevEuis: Set<string> | null = null;
        if (scope === 'Municipal' && scopeId) {
          allowedDevEuis = new Set(
            Object.values(POZOS_DATA)
              .filter((p: any) => Number(p.municipioId) === scopeId)
              .map((p: any) => (p.devEui || '').trim().toLowerCase())
              .filter((d: string) => d.length > 0)
          );
        }

        const mapped = sites
          .filter(s => {
            if (!allowedDevEuis) return true;
            return allowedDevEuis.has((s.dev_eui || '').trim().toLowerCase());
          })
          .map(s => ({ devEUI: s.dev_eui, name: s.site_name }));

        this.sitesDisponibles.set(mapped);

        if (mapped.length > 0) {
          const target = this.preselectedDevEUI
            ? mapped.find(s => s.devEUI.trim() === this.preselectedDevEUI!.trim())
            : null;
          this.selectedSites.set([target ? target.devEUI : mapped[0].devEUI]);
          this.loadCharts();
        }
      },
      error: (err) => console.error('Error cargando sitios:', err)
    });
  }

  // =========================
  // UI INTERACTIONS
  // =========================
  toggleSite(devEUI: string): void {
    const current = this.selectedSites();
    this.selectedSites.set(
      current.includes(devEUI)
        ? current.filter(s => s !== devEUI)
        : [...current, devEUI]
    );
    this.loadCharts();
  }

  setRange(r: TimeRange) {
    this.range.set(r);
    if (this.datePickerRef) {
      const now = new Date();
      const ms = this.quickRangeMs[r] || 86400e3;
      const from = new Date(now.getTime() - ms);
      this.datePickerRef.syncFromQuickRange(from, now);
    }
    this.clearCustomRange();
  }

  onRangeApplied(event: DateRangeOutput): void {
    this.customFrom.set(event.from);
    this.customTo.set(event.to);
    this.customInterval.set(event.interval);
    this.loadCharts();
  }

  clearCustomRange(): void {
    this.customFrom.set('');
    this.customTo.set('');
    this.customInterval.set('');
    this.loadCharts();
  }

  toggleVar(key: string) {
    const current = new Set(this.selectedVars());
    if (current.has(key)) {
      if (current.size <= 1) return;
      current.delete(key);
    } else {
      current.add(key);
    }
    this.selectedVars.set(current);
    this.loadCharts();
  }

  isVarSelected(key: string): boolean {
    return this.selectedVars().has(key);
  }

  getYMin(key: string): string {
    const r = this.yRanges()[key];
    return r?.min != null ? String(r.min) : '';
  }

  getYMax(key: string): string {
    const r = this.yRanges()[key];
    return r?.max != null ? String(r.max) : '';
  }

  setYRange(key: string, bound: 'min' | 'max', value: string): void {
    const current = { ...this.yRanges() };
    const entry = { ...(current[key] || {}) };
    const num = value.trim() === '' ? undefined : Number(value);
    entry[bound] = num;
    if (entry.min == null && entry.max == null) {
      delete current[key];
    } else {
      current[key] = entry;
    }
    this.yRanges.set(current);
    if (Object.keys(this.lastChartData).length > 0) {
      this.renderChart();
    }
  }

  setChartType(t: ChartType) {
    this.chartType.set(t);
    if (Object.keys(this.lastChartData).length === 0) return;
    if (t === 'radar') {
      setTimeout(() => { this.radarChart?.resize(); this.renderRadar(); }, 50);
    } else {
      setTimeout(() => { this.chart?.resize(); this.renderChart(); }, 50);
    }
  }

  getSiteColor(devEUI: string): string {
    const idx = this.sitesDisponibles().findIndex(s => s.devEUI === devEUI);
    return SITE_COLORS[idx % SITE_COLORS.length];
  }

  getSiteName(devEUI: string): string {
    return this.sitesDisponibles().find(s => s.devEUI === devEUI)?.name ?? devEUI;
  }

  // =========================
  // DATA LOADING
  // =========================
  loadCharts(): void {
    const activeSites = this.selectedSites();
    if (!this.chart || activeSites.length === 0) {
      this.chart?.setOption({ series: [], legend: { data: [] } }, true);
      return;
    }

    let rangeStr = `-${this.range()}`;
    if (this.range() === '1m') rangeStr = '-1mo';

    const options: { from?: string; to?: string; interval?: string } = {};
    if (this.customRangeActive()) {
      options.from = this.customFrom();
      options.to = this.customTo();
    }
    if (this.customInterval()) {
      options.interval = this.customInterval();
    }

    this.loading.set(true);
    // Radar always fetches ALL variables to form a proper polygon
    const selected = this.chartType() === 'radar'
      ? new Set(this.chartVariables.map(v => v.key))
      : this.selectedVars();

    const requests = activeSites.map(devEUI => {
      const varRequests: Record<string, any> = {};
      for (const v of this.chartVariables) {
        if (selected.has(v.key)) {
          varRequests[v.key] = this.telemetryService.getHistory(devEUI, v.key, rangeStr, options);
        }
      }
      return forkJoin(varRequests);
    });

    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        const toPoint = (p: any): [number, number | null] => {
          const ts = new Date(p.timestamp).getTime();
          const v = p.value;
          return [ts, (v != null && v > 0.01) ? v : null];
        };

        this.lastChartData = {};
        results.forEach((res, idx) => {
          const devEUI = activeSites[idx];
          this.lastChartData[devEUI] = {};
          for (const v of this.chartVariables) {
            if (selected.has(v.key) && res[v.key]) {
              if (v.key === 'rssi' || v.key === 'snr') {
                this.lastChartData[devEUI][v.key] = res[v.key].data.map((p: any) =>
                  [new Date(p.timestamp).getTime(), p.value ?? null] as [number, number | null]);
              } else {
                this.lastChartData[devEUI][v.key] = res[v.key].data.map(toPoint);
              }
            }
          }
        });

        this.computeVariableStats();
        if (this.chartType() === 'radar') {
          this.renderRadar();
        } else {
          this.renderChart();
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando telemetría:', err);
        this.loading.set(false);
      }
    });
  }

  // =========================
  // CHART RENDERING
  // =========================
  private renderChart(): void {
    const selected = this.selectedVars();
    const activeVars = this.chartVariables.filter(v => selected.has(v.key));
    const activeSites = this.selectedSites();
    const themeColors = getEChartsColors(this.themeService.resolved());
    const type = this.chartType();
    const isBar = type === 'bar';
    const isArea = type === 'area';

    // Y AXES
    const yAxis: any[] = [];
    const varAxisIndex: Record<string, number> = {};
    let rightOffset = 0;

    for (const v of activeVars) {
      const idx = yAxis.length;
      varAxisIndex[v.key] = idx;
      const isLeft = v.position === 'left';
      const axis: any = {
        type: 'value', name: v.unit, position: isLeft ? 'left' : 'right',
        scale: true,
        axisLabel: { color: v.color, fontSize: 11 },
        nameTextStyle: { color: v.color },
        splitLine: { show: idx === 0, lineStyle: { color: themeColors.splitLine, type: 'dashed' } }
      };
      const yRange = this.yRanges()[v.key];
      if (yRange?.min != null) { axis.min = yRange.min; axis.scale = false; }
      if (yRange?.max != null) { axis.max = yRange.max; axis.scale = false; }
      if (!isLeft && rightOffset > 0) axis.offset = rightOffset;
      if (!isLeft) rightOffset += 60;
      yAxis.push(axis);
    }

    // SERIES
    const series: any[] = [];
    const legendData: string[] = [];
    const chartVars = this.chartVariables;

    for (const site of activeSites) {
      const siteData = this.lastChartData[site];
      if (!siteData) continue;
      const siteName = this.getSiteName(site);
      const siteColor = this.getSiteColor(site);

      for (const v of activeVars) {
        const data = siteData[v.key];
        if (!data) continue;

        const seriesName = activeSites.length > 1
          ? `${siteName} · ${v.label}`
          : v.label;
        legendData.push(seriesName);

        // For multi-site, use site color; for single site, use variable color
        const color = activeSites.length > 1 ? siteColor : v.color;
        const isDashed = v.key === 'rssi' || v.key === 'snr';
        const pointCount = data.filter(p => p[1] !== null).length;
        const sparse = pointCount < 10;

        const s: any = {
          name: seriesName,
          type: isBar ? 'bar' : 'line',
          yAxisIndex: varAxisIndex[v.key],
          data,
          showSymbol: sparse, symbolSize: sparse ? 6 : 4,
          smooth: false, sampling: 'lttb',
          connectNulls: false
        };
        if (isBar) {
          s.itemStyle = { color };
          s.barMaxWidth = 8;
        } else {
          s.lineStyle = { width: isDashed ? 1 : 1.5, color, ...(isDashed ? { type: 'dashed' } : {}) };
        }
        if (isArea) {
          s.areaStyle = { color: color + '25' };
        }
        series.push(s);
      }
    }

    const rightAxes = activeVars.filter(v => v.position === 'right').length;
    const gridRight = Math.max(55, 55 + (rightAxes - 1) * 60);

    const option: any = {
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
            const cv = chartVars.find(cv => cv.label === p.seriesName || p.seriesName?.endsWith(cv.label));
            const unit = cv?.unit || '';
            const val = p.value[1] !== null && p.value[1] !== undefined ? Number(p.value[1]).toFixed(2) : '—';
            html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">`;
            html += `<span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>`;
            html += `<span style="flex:1;color:#cbd5e1">${p.seriesName}</span>`;
            html += `<span style="font-weight:600;color:#f1f5f9">${val} ${unit}</span>`;
            html += `</div>`;
          }
          return html;
        }
      },
      legend: { show: activeSites.length > 1, data: legendData, top: 0, type: 'scroll' },
      grid: { left: 55, right: gridRight, bottom: 70, top: activeSites.length > 1 ? 45 : 20 },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          fontSize: 11,
          formatter: (value: number) => {
            const d = new Date(value);
            return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
              + '\n' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          }
        },
        splitLine: { show: false }
      },
      yAxis,
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
            lineStyle: { color: '#cbd5e1', width: 0.5 },
            areaStyle: { color: 'rgba(203,213,225,0.15)' }
          }
        }
      ],
      series
    };

    this.chart.setOption(option, true);
  }

  // =========================
  // TOOLBAR ACTIONS
  // =========================
  toggleCrosshair() {
    this.crosshairEnabled.set(!this.crosshairEnabled());
    if (Object.keys(this.lastChartData).length > 0) {
      this.renderChart();
    }
  }

  setBrushType(type: 'lineX' | 'rect' | 'polygon') {
    if (!this.chart) return;
    const current = this.activeBrushType();
    if (current === type) {
      this.activeBrushType.set('none');
      this.chart.dispatchAction({
        type: 'takeGlobalCursor', key: 'brush',
        brushOption: { brushType: false, brushMode: 'single' }
      });
    } else {
      // Register brush component on-demand (hidden from UI)
      this.chart.setOption({ brush: { toolbox: [], xAxisIndex: 0 } });
      this.activeBrushType.set(type);
      this.chart.dispatchAction({
        type: 'takeGlobalCursor', key: 'brush',
        brushOption: { brushType: type, brushMode: 'single' }
      });
    }
  }

  resetZoom() {
    if (!this.chart) return;
    this.activeBrushType.set('none');
    this.chart.dispatchAction({
      type: 'takeGlobalCursor', key: 'brush',
      brushOption: { brushType: false, brushMode: 'single' }
    });
    this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: 0, end: 100 });
    this.chart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, start: 0, end: 100 });
  }

  toggleFullscreen() {
    const next = !this.isFullscreen();
    this.isFullscreen.set(next);
    if (next) {
      document.addEventListener('keydown', this.escHandler);
    } else {
      document.removeEventListener('keydown', this.escHandler);
    }
    const active = this.chartType() === 'radar' ? this.radarChart : this.chart;
    setTimeout(() => active?.resize(), 50);
  }

  downloadChartPng() {
    const active = this.chartType() === 'radar' ? this.radarChart : this.chart;
    if (!active) return;
    const url = active.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetria_avanzada_${new Date().toISOString().slice(0,10)}.png`;
    a.click();
  }

  exportCsv() {
    const selected = this.selectedVars();
    const activeVars = this.chartVariables.filter(v => selected.has(v.key));
    const activeSites = this.selectedSites();
    if (activeVars.length === 0 || activeSites.length === 0) return;

    const allTimestamps = new Set<number>();
    for (const site of activeSites) {
      const siteData = this.lastChartData[site];
      if (!siteData) continue;
      for (const v of activeVars) {
        const d = siteData[v.key];
        if (d) d.forEach(p => allTimestamps.add(p[0]));
      }
    }
    const sorted = Array.from(allTimestamps).sort((a, b) => a - b);

    // Build lookup maps
    const lookups: Record<string, Record<string, Map<number, number | null>>> = {};
    for (const site of activeSites) {
      lookups[site] = {};
      const siteData = this.lastChartData[site];
      if (!siteData) continue;
      for (const v of activeVars) {
        const map = new Map<number, number | null>();
        const d = siteData[v.key];
        if (d) d.forEach(p => map.set(p[0], p[1]));
        lookups[site][v.key] = map;
      }
    }

    // Headers
    const headers = ['Fecha'];
    for (const site of activeSites) {
      const name = this.getSiteName(site);
      for (const v of activeVars) {
        headers.push(`${name} - ${v.label} (${v.unit})`);
      }
    }

    const rows = sorted.map(ts => {
      const date = new Date(ts).toLocaleString('es-MX');
      const values: string[] = [];
      for (const site of activeSites) {
        for (const v of activeVars) {
          const val = lookups[site]?.[v.key]?.get(ts);
          values.push(val !== null && val !== undefined ? val.toString() : '');
        }
      }
      return [date, ...values].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetria_avanzada_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private computeVariableStats() {
    const stats: Record<string, { min: number; max: number; avg: number; current: number }> = {};
    const isRadar = this.chartType() === 'radar';
    for (const v of this.chartVariables) {
      if (!isRadar && !this.selectedVars().has(v.key)) continue;
      const allValues: number[] = [];
      let lastValue = 0;
      for (const site of this.selectedSites()) {
        const data = this.lastChartData[site]?.[v.key];
        if (!data) continue;
        const vals = data.map(d => d[1]).filter((x): x is number => x !== null);
        allValues.push(...vals);
        if (vals.length > 0) lastValue = vals[vals.length - 1];
      }
      if (allValues.length === 0) continue;
      stats[v.key] = {
        min: Math.round(Math.min(...allValues) * 1000) / 1000,
        max: Math.round(Math.max(...allValues) * 1000) / 1000,
        avg: Math.round((allValues.reduce((a, b) => a + b, 0) / allValues.length) * 1000) / 1000,
        current: Math.round(lastValue * 1000) / 1000
      };
    }
    this.variableStats.set(stats);
  }

  private renderRadar(): void {
    if (!this.radarChart) {
      if (this.radarRef?.nativeElement) {
        this.radarChart = echarts.init(this.radarRef.nativeElement);
      } else {
        return;
      }
    }

    const stats = this.variableStats();
    // Radar always uses ALL variables that have data
    const activeVars = this.chartVariables.filter(v => stats[v.key]);
    const activeSites = this.selectedSites();
    const themeColors = getEChartsColors(this.themeService.resolved());

    if (activeVars.length < 3 || activeSites.length === 0) {
      this.radarChart.setOption({ radar: { indicator: [] }, series: [] }, true);
      return;
    }

    // Per-site current values for multi-site mode
    const perSite: Record<string, Record<string, number>> = {};
    for (const site of activeSites) {
      perSite[site] = {};
      for (const v of activeVars) {
        const data = this.lastChartData[site]?.[v.key];
        if (!data) continue;
        const vals = data.map(d => d[1]).filter((x): x is number => x !== null);
        if (vals.length > 0) perSite[site][v.key] = vals[vals.length - 1];
      }
    }

    const indicator = activeVars.map(v => ({
      name: `${v.label}\n(${v.unit})`,
      max: Math.round((stats[v.key].max * 1.2 || 1) * 100) / 100
    }));

    let seriesData: any[];
    if (activeSites.length === 1) {
      seriesData = [
        {
          name: 'Actual',
          value: activeVars.map(v => Math.round((stats[v.key]?.current ?? 0) * 100) / 100),
          lineStyle: { width: 2 },
          itemStyle: { color: '#007bff' },
          areaStyle: { color: 'rgba(0, 123, 255, 0.15)' }
        },
        {
          name: 'Promedio',
          value: activeVars.map(v => Math.round((stats[v.key]?.avg ?? 0) * 100) / 100),
          lineStyle: { width: 1.5, type: 'dashed' },
          itemStyle: { color: '#28a745' },
          areaStyle: { color: 'rgba(40, 167, 69, 0.08)' }
        }
      ];
    } else {
      seriesData = activeSites.map((site, i) => {
        const color = SITE_COLORS[i % SITE_COLORS.length];
        return {
          name: this.getSiteName(site),
          value: activeVars.map(v => Math.round((perSite[site]?.[v.key] ?? 0) * 100) / 100),
          lineStyle: { width: 2, color },
          itemStyle: { color },
          areaStyle: { color: color + '20' }
        };
      });
    }

    this.radarChart.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
        textStyle: { color: '#e2e8f0', fontSize: 12 }
      },
      legend: {
        bottom: 0,
        textStyle: { color: themeColors.textColor, fontSize: 11 }
      },
      radar: {
        indicator,
        shape: 'polygon',
        radius: '65%',
        splitNumber: 5,
        axisName: { color: themeColors.textColor, fontSize: 11 },
        splitLine: { lineStyle: { color: themeColors.splitLine } },
        splitArea: { areaStyle: { color: ['transparent', 'rgba(148,163,184,0.03)'] } },
        axisLine: { lineStyle: { color: themeColors.splitLine } }
      },
      series: [{ type: 'radar', data: seriesData, symbol: 'circle', symbolSize: 5 }]
    }, true);
  }

  goBack(): void {
    this.router.navigate(['/telemetria']);
  }
}
