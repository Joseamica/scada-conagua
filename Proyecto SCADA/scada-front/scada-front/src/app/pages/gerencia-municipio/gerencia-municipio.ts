import { Component, OnInit, AfterViewInit, OnDestroy, inject, signal, computed, ViewChild, ElementRef, effect } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef } from '@angular/core';
import { forkJoin } from 'rxjs';
import * as L from 'leaflet';
import * as echarts from 'echarts';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPresentationChartLine, heroChartBar, heroChartBarSquare, heroChartPie
} from '@ng-icons/heroicons/outline';

import { HeaderBarComponent } from '../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../layout/footer-tabs/footer-tabs';
import { TelemetryService } from '../../core/services/telemetry';
import { ThemeService } from '../../core/services/theme.service';
import { getEChartsColors } from '../../core/utils/echarts-theme';
import { TIME_RANGES, TimeRange } from '../../shared/time-ranges';
import { DateRangePickerComponent, DateRangeOutput } from '../../shared/date-range-picker/date-range-picker';

// ── Chart variable & type definitions (shared with pozo-detalle) ──

interface ChartVariable {
  key: string;
  label: string;
  unit: string;
  color: string;
  position: 'left' | 'right';
}

const CHART_VARIABLES: ChartVariable[] = [
  { key: 'caudal_lts',  label: 'Caudal',    unit: 'Lt/s',   color: '#007bff', position: 'left' },
  { key: 'presion_kg',  label: 'Presión',   unit: 'Kg/cm²', color: '#28a745', position: 'right' },
  { key: 'rssi',        label: 'Señal LTE', unit: 'dBm',    color: '#ffc107', position: 'right' },
  { key: 'snr',         label: 'SNR',       unit: 'dB',     color: '#9333ea', position: 'right' },
];

type ChartType = 'line' | 'bar' | 'area' | 'gauge';

const CHART_TYPE_OPTIONS: { key: ChartType; label: string; icon: string }[] = [
  { key: 'line',  label: 'Línea',  icon: 'heroPresentationChartLine' },
  { key: 'bar',   label: 'Barras', icon: 'heroChartBar' },
  { key: 'area',  label: 'Área',   icon: 'heroChartBarSquare' },
  { key: 'gauge', label: 'Gauge',  icon: 'heroChartPie' },
];

@Component({
  selector: 'gerencia-municipio',
  standalone: true,
  imports: [HeaderBarComponent, FooterTabsComponent, CommonModule, NgIconComponent, DateRangePickerComponent],
  templateUrl: './gerencia-municipio.html',
  styleUrl: './gerencia-municipio.css',
  viewProviders: [
    provideIcons({ heroPresentationChartLine, heroChartBar, heroChartBarSquare, heroChartPie })
  ]
})
export class GerenciaMunicipio implements OnInit, AfterViewInit, OnDestroy {

  municipioId!: number;
  municipioNombre!: string;
  gastoTotal = 0;
  pozosActivos = 0;
  totalPozos = 0;

  detalleMap!: L.Map;
  chart!: echarts.ECharts;

  private telemetryService = inject(TelemetryService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private pozosMunicipio: any[] = [];
  private activeDevEui = '';
  private resizeHandler = () => { this.chart?.resize(); };
  private tileLayer?: L.TileLayer;

  private themeEffect = effect(() => {
    const theme = this.themeService.resolved();
    if (this.chart) {
      if (Object.keys(this.lastChartData).length > 0) {
        this.renderMainChart();
      }
      this.chart.resize();
    }
    if (this.tileLayer && this.detalleMap) {
      const url = theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      this.tileLayer.setUrl(url);
    }
  });

  // Sitios list with live data
  sitios = signal<{ slug: string; nombre: string; estatus: string; caudal: number; presion: number; lat: number; lng: number }[]>([]);

  constructor(private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}

  // ── Time range ──
  @ViewChild('datePicker') datePickerRef!: DateRangePickerComponent;
  @ViewChild('chartEl') chartElRef!: ElementRef<HTMLDivElement>;

  timeRanges = TIME_RANGES;
  range = signal<TimeRange>('7d');

  private quickRangeMs: Record<string, number> = {
    '15m': 15*60e3, '30m': 30*60e3, '1h': 3600e3, '6h': 6*3600e3,
    '12h': 12*3600e3, '24h': 86400e3, '7d': 7*86400e3, '1m': 30*86400e3, '1y': 365*86400e3
  };

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
      '15m': '15 min', '30m': '30 min', '1h': '1 hora', '6h': '6h', '12h': '12h',
      '24h': '1 día', '7d': '1 semana', '1m': '1 mes', '1y': '1 año'
    };
    return labels[this.range()] || this.range();
  });

  // ── Variable & chart type selectors ──
  chartVariables = CHART_VARIABLES;
  selectedVars = signal<Set<string>>(new Set(['caudal_lts', 'presion_kg']));
  chartTypeOptions = CHART_TYPE_OPTIONS;
  chartType = signal<ChartType>('line');
  private lastChartData: Record<string, [number, number | null][]> = {};

  // ── Lifecycle ──

  ngOnInit() {
    this.municipioId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadData();
  }

  ngAfterViewInit() {
    this.initMap();
    this.chart = echarts.init(this.chartElRef.nativeElement);
    this.loadCharts();
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy() {
    if (this.chart) this.chart.dispose();
    window.removeEventListener('resize', this.resizeHandler);
  }

  // ── Data ──

  /** Load all data from API — replaces POZOS_DATA */
  private loadData() {
    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        // Filter by municipio_id from API
        const filtered = sites.filter(s => s.municipio_id === this.municipioId);

        this.pozosMunicipio = filtered.map(s => ({
          devEui: s.dev_eui,
          nombre: s.site_name,
          estatus: s.estatus || 'activo',
          lat: s.latitude || 0,
          lng: s.longitude || 0,
        }));
        this.totalPozos = this.pozosMunicipio.length;
        this.pozosActivos = this.pozosMunicipio.filter(
          (p: any) => (p.estatus || '').toLowerCase() === 'activo'
        ).length;

        const active = this.pozosMunicipio.find(
          (p: any) => (p.estatus || '').toLowerCase() === 'activo' && p.devEui
        );
        this.activeDevEui = active?.devEui || '';

        // Build sitios list from API data
        this.sitios.set(filtered.map(s => ({
          slug: s.dev_eui,
          nombre: s.site_name || s.dev_eui,
          estatus: s.estatus || 'Desconocido',
          caudal: 0,
          presion: 0,
          lat: s.latitude || 0,
          lng: s.longitude || 0,
        })));

        // Live flow aggregation from same response
        let totalFlow = 0;
        const liveMap = new Map<string, { caudal: number; presion: number }>();

        filtered.forEach(site => {
          const flow = Number(site.last_flow_value) || 0;
          const pressure = Number(site.last_pressure_value) || 0;
          if (flow > 0.01) totalFlow += flow;
          liveMap.set(site.dev_eui, {
            caudal: Math.round(flow * 100) / 100,
            presion: Math.round(pressure * 100) / 100,
          });
        });

        this.gastoTotal = Math.round(totalFlow * 100) / 100;

        // Enrich sitios with live data
        this.sitios.set(this.sitios().map(s => {
          const live = liveMap.get(s.slug);
          return live ? { ...s, caudal: live.caudal, presion: live.presion } : s;
        }));

        this.cdr.detectChanges();
        // Add map markers now that sitios have lat/lng from API
        if (this.detalleMap) this.addPozoMarkers();
        // Load charts now that activeDevEui is set
        this.loadCharts();
      },
      error: (err) => console.error('Error fetching sites data:', err)
    });
  }

  goToPozo(slug: string) {
    this.router.navigate(['/pozos', slug]);
  }

  // ── Map ──

  private initMap() {
    this.detalleMap = L.map('mapDetalle').setView([19.4, -99.1], 11);
    const tileUrl = this.themeService.resolved() === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    this.tileLayer = L.tileLayer(tileUrl, { subdomains: 'abcd', maxZoom: 19 }).addTo(this.detalleMap);
    this.loadMunicipioDetalle(this.municipioId);
    // Markers added after data loads from API (see loadData callback)
  }

  private addPozoMarkers() {
    const icon = L.divIcon({
      className: 'pozo-marker',
      html: '<div class="pozo-marker-dot"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    this.sitios().forEach(s => {
      if (s.lat && s.lng) {
        L.marker([s.lat, s.lng], { icon })
          .addTo(this.detalleMap)
          .bindTooltip(s.nombre, { direction: 'top', offset: [0, -10] })
          .on('click', () => this.goToPozo(s.slug));
      }
    });
  }

  private loadMunicipioDetalle(municipioId: number) {
    fetch('assets/mapas/edomex_municipios.geojson')
      .then(res => res.json())
      .then(data => {
        const municipioLayer = L.geoJSON(data, {
          filter: (feature: any) => {
            const id = Number(feature.properties?.CVE_MUN);
            if (id === this.municipioId) {
              this.municipioNombre = feature.properties?.NOMGEO || feature.properties?.nombre;
              this.cdr.detectChanges();
              return true;
            }
            return false;
          },
          style: () => ({ color: '#2c7f73', weight: 3, fillColor: '#589088', fillOpacity: 0.15 }),
          onEachFeature: (feature, layer) => {
            const nombre = feature.properties?.NOMGEO || feature.properties?.nombre;
            layer.bindTooltip(nombre, { permanent: true, direction: 'center', className: 'municipio-label' });
          }
        }).addTo(this.detalleMap);
        this.detalleMap.fitBounds(municipioLayer.getBounds(), { padding: [40, 40], maxZoom: 12 });
      });
  }

  // ── Chart: range actions ──

  setRange(r: TimeRange) {
    this.range.set(r);
    if (this.datePickerRef) {
      const now = new Date();
      const ms = this.quickRangeMs[r] || 86400e3;
      this.datePickerRef.syncFromQuickRange(new Date(now.getTime() - ms), now);
    }
    this.customFrom.set('');
    this.customTo.set('');
    this.customInterval.set('');
    this.loadCharts();
  }

  onRangeApplied(event: DateRangeOutput) {
    this.customFrom.set(event.from);
    this.customTo.set(event.to);
    this.customInterval.set(event.interval);
    this.loadCharts();
  }

  // ── Chart: variable & type toggles ──

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

  setChartType(t: ChartType) {
    this.chartType.set(t);
    if (t === 'gauge') {
      this.renderGauge();
      return;
    }
    if (Object.keys(this.lastChartData).length > 0) {
      this.renderMainChart();
    } else {
      this.loadCharts();
    }
  }

  // ── Chart: data loading ──

  loadCharts() {
    if (!this.activeDevEui || !this.chart) return;

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

    const selected = this.selectedVars();
    const requests: Record<string, any> = {};

    for (const v of this.chartVariables) {
      if (selected.has(v.key)) {
        requests[v.key] = this.telemetryService.getHistory(this.activeDevEui, v.key, rangeStr, options);
      }
    }

    if (Object.keys(requests).length === 0) return;

    forkJoin(requests).subscribe({
      next: (res: any) => {
        const toPoint = (p: any): [number, number | null] => {
          const ts = new Date(p.timestamp).getTime();
          const v = p.value;
          return [ts, (v != null && v > 0.01) ? v : null];
        };

        const chartData: Record<string, [number, number | null][]> = {};
        for (const v of this.chartVariables) {
          if (selected.has(v.key) && res[v.key]) {
            if (v.key === 'rssi' || v.key === 'snr') {
              chartData[v.key] = res[v.key].data.map((p: any) =>
                [new Date(p.timestamp).getTime(), p.value ?? null] as [number, number | null]);
            } else {
              chartData[v.key] = res[v.key].data.map(toPoint);
            }
          }
        }

        this.lastChartData = chartData;
        this.renderMainChart();
      },
      error: (err) => console.error('Error loading chart data:', err)
    });
  }

  // ── Chart: rendering ──

  private renderMainChart() {
    if (this.chartType() === 'gauge') {
      this.renderGauge();
    } else {
      this.updateChart(this.lastChartData);
    }
  }

  private updateChart(data: Record<string, [number, number | null][]>) {
    const selected = this.selectedVars();
    const activeVars = this.chartVariables.filter(v => selected.has(v.key) && data[v.key]);
    const c = getEChartsColors(this.themeService.resolved());

    // Y axes
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
        axisLabel: { color: v.color, fontSize: 10 },
        nameTextStyle: { color: v.color, fontSize: 10 },
        splitLine: { show: idx === 0, lineStyle: { color: c.splitLine } },
        axisLine: { lineStyle: { color: c.axisLine } }
      };
      if (!isLeft && rightOffset > 0) axis.offset = rightOffset;
      if (!isLeft) rightOffset += 60;
      yAxis.push(axis);
    }

    // Tooltip formatter with color dots and units
    const varMap = new Map(activeVars.map(v => [v.label, v]));
    const tooltipFormatter = (params: any) => {
      if (!Array.isArray(params) || params.length === 0) return '';
      const ts = new Date(params[0].value[0]);
      const dateStr = ts.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
      const timeStr = ts.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      let html = `<div style="font-size:11px;font-weight:600;margin-bottom:4px;color:${c.tooltip.textColor}">${dateStr} ${timeStr}</div>`;
      for (const p of params) {
        const v = varMap.get(p.seriesName);
        const val = p.value[1];
        if (val == null) continue;
        html += `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${c.tooltip.textColor}">`;
        html += `<span style="width:7px;height:7px;border-radius:50%;background:${v?.color || p.color};flex-shrink:0"></span>`;
        html += `<span>${p.seriesName}</span>`;
        html += `<span style="margin-left:auto;font-weight:600">${Number(val).toFixed(2)} ${v?.unit || ''}</span>`;
        html += `</div>`;
      }
      return html;
    };

    // Series
    const series: any[] = [];
    const legendData: string[] = [];
    const type = this.chartType();
    const isBar = type === 'bar';
    const isArea = type === 'area';

    for (const v of activeVars) {
      legendData.push(v.label);
      const isDashed = v.key === 'rssi' || v.key === 'snr';
      const s: any = {
        name: v.label, type: isBar ? 'bar' : 'line',
        yAxisIndex: varAxisIndex[v.key], data: data[v.key],
        showSymbol: false, smooth: false, sampling: 'lttb', connectNulls: false
      };
      if (isBar) {
        s.itemStyle = { color: v.color };
        s.barMaxWidth = 8;
      } else {
        s.lineStyle = { width: isDashed ? 1 : 1.5, color: v.color, ...(isDashed ? { type: 'dashed' } : {}) };
      }
      if (isArea) {
        s.areaStyle = { color: v.color + '25' };
        s.stack = 'total';
      }
      series.push(s);
    }

    const rightAxes = activeVars.filter(v => v.position === 'right').length;
    const gridRight = Math.max(40, 40 + (rightAxes - 1) * 60);

    this.chart.setOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: c.tooltip.bg,
        borderColor: c.tooltip.border,
        textStyle: { color: c.tooltip.textColor, fontSize: 11 },
        padding: [8, 10],
        formatter: tooltipFormatter
      },
      legend: { show: false },
      grid: { left: 55, right: gridRight, bottom: 50, top: 20 },
      xAxis: {
        type: 'time', boundaryGap: false,
        axisLabel: {
          color: c.subtextColor, fontSize: 10,
          formatter: (val: number) => {
            const d = new Date(val);
            const h = d.getHours(), m = d.getMinutes();
            const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
            if (h === 0 && m === 0) return date;
            return `${date}\n${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
          }
        },
        axisLine: { lineStyle: { color: c.axisLine } },
        splitLine: { show: false }
      },
      yAxis,
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
        {
          type: 'slider', xAxisIndex: 0, bottom: 4, height: 20, handleSize: '80%',
          borderColor: c.splitLine,
          fillerColor: 'rgba(0,123,255,0.08)',
          handleStyle: { color: c.subtextColor, borderColor: c.axisLine },
          dataBackground: { lineStyle: { color: c.splitLine }, areaStyle: { color: c.splitLine } },
          textStyle: { color: c.subtextColor, fontSize: 10 }
        }
      ],
      series
    }, true);
  }

  private renderGauge() {
    const selected = this.selectedVars();
    const activeVars = this.chartVariables.filter(v => selected.has(v.key));
    const series: any[] = [];
    const count = activeVars.length;

    activeVars.forEach((v, i) => {
      // Use last known value from chart data
      let currentValue = 0;
      const pts = this.lastChartData[v.key];
      if (pts && pts.length > 0) {
        const last = pts[pts.length - 1][1];
        if (last !== null) currentValue = last;
      }

      let max = 100;
      if (v.key === 'caudal_lts') max = Math.max(50, currentValue * 1.5);
      else if (v.key === 'presion_kg') max = Math.max(10, currentValue * 1.5);
      else if (v.key === 'snr') max = 30;

      const centerX = `${(100 / (count + 1)) * (i + 1)}%`;

      series.push({
        type: 'gauge', center: [centerX, '55%'],
        radius: count <= 2 ? '75%' : '55%',
        startAngle: 220, endAngle: -40,
        min: 0, max: Math.ceil(max), splitNumber: 5,
        axisLine: { lineStyle: { width: 18, color: [[0.3, '#e5e7eb'], [0.7, v.color + '60'], [1, v.color]] } },
        axisTick: { distance: -18, length: 6, lineStyle: { color: '#fff', width: 2 } },
        splitLine: { distance: -18, length: 18, lineStyle: { color: '#fff', width: 3 } },
        axisLabel: { distance: 25, color: '#64748b', fontSize: 10 },
        pointer: { width: 5, length: '60%', itemStyle: { color: v.color } },
        anchor: { show: true, size: 12, itemStyle: { borderWidth: 2, borderColor: v.color } },
        title: { show: true, offsetCenter: [0, '85%'], fontSize: 13, color: '#475569', fontWeight: 600 },
        detail: {
          valueAnimation: true, formatter: `{value} ${v.unit}`,
          fontSize: 16, fontWeight: 700, color: v.color, offsetCenter: [0, '65%']
        },
        data: [{ value: Number(currentValue.toFixed(2)), name: v.label }]
      });
    });

    this.chart.setOption({ series }, true);
  }
}
