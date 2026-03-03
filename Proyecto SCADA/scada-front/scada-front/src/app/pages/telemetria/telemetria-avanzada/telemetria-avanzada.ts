import {
  Component,
  AfterViewInit,
  OnInit,
  ViewChild,
  ElementRef,
  signal,
  inject,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import * as echarts from 'echarts';

import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowLeftStartOnRectangle, heroDocumentArrowDown } from '@ng-icons/heroicons/outline';
import { TelemetryService } from '../../../core/services/telemetry';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { getEChartsColors } from '../../../core/utils/echarts-theme';
import { POZOS_DATA } from '../../pozos/pozos-data';

type SeriesKey = 'caudal' | 'presion' | 'comunicacion';
type TimePreset = '15m' | '1h' | '6h' | '12h' | '1d' | '1sem';

@Component({
  selector: 'app-telemetria-avanzada',
  standalone: true,
  imports: [CommonModule, HeaderBarComponent, FooterTabsComponent, NgIconComponent],
  providers: [
    provideIcons({ heroArrowLeftStartOnRectangle, heroDocumentArrowDown })
  ],
  templateUrl: './telemetria-avanzada.html',
  styleUrls: ['./telemetria-avanzada.css']
})
export class TelemetriaAvanzada implements OnInit, AfterViewInit {

  @ViewChild('chart', { static: false })
  chartRef!: ElementRef<HTMLDivElement>;

  chart!: echarts.ECharts;

  // =========================
  // ESTADO
  // =========================
  sitesDisponibles: Array<{ devEUI: string; name: string }> = [];

  selectedSites = signal<string[]>([]);

  selectedSeries = signal<Record<SeriesKey, boolean>>({
    caudal: true,
    presion: true,
    comunicacion: false
  });

  timePreset = signal<TimePreset>('1d');
  loading = signal(false);

  private readonly rangeMap: Record<TimePreset, string> = {
    '15m': '-15m',
    '1h':  '-1h',
    '6h':  '-6h',
    '12h': '-12h',
    '1d':  '-24h',
    '1sem':'-7d'
  };

  private authService = inject(AuthService);
  private themeService = inject(ThemeService);

  private themeEffect = effect(() => {
    const theme = this.themeService.resolved();
    if (this.chart) {
      const c = getEChartsColors(theme);
      this.chart.setOption({ backgroundColor: c.backgroundColor }, true);
      this.chart.resize();
    }
  });

  constructor(
    private router: Router,
    private telemetryService: TelemetryService
  ) {}

  // =========================
  // LIFECYCLE
  // =========================
  ngOnInit(): void {
    this.loadSites();
  }

  ngAfterViewInit(): void {
    this.chart = echarts.init(this.chartRef.nativeElement);
    this.showEmptyChart();
  }

  // =========================
  // CARGA DE SITIOS
  // =========================
  private loadSites(): void {
    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        const user = this.authService.currentUser();
        const scope = user?.scope;
        const scopeId = user?.scope_id;

        // Build set of allowed devEUIs based on user scope
        let allowedDevEuis: Set<string> | null = null;
        if (scope === 'Municipal' && scopeId) {
          allowedDevEuis = new Set(
            Object.values(POZOS_DATA)
              .filter((p: any) => Number(p.municipioId) === scopeId)
              .map((p: any) => (p.devEui || '').trim().toLowerCase())
              .filter((d: string) => d.length > 0)
          );
        }

        this.sitesDisponibles = sites
          .filter(s => {
            if (!allowedDevEuis) return true; // Federal/Estatal sees all
            return allowedDevEuis.has((s.dev_eui || '').trim().toLowerCase());
          })
          .map(s => ({
            devEUI: s.dev_eui,
            name: s.site_name
          }));

        // Seleccionar el primer sitio por default
        if (this.sitesDisponibles.length > 0) {
          this.selectedSites.set([this.sitesDisponibles[0].devEUI]);
          this.loadCharts();
        }
      },
      error: (err) => console.error('Error cargando sitios:', err)
    });
  }

  // =========================
  // INTERACCIONES DE UI
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

  setTimePreset(p: TimePreset): void {
    this.timePreset.set(p);
    this.loadCharts();
  }

  onToggleSeries(key: SeriesKey, checked: boolean): void {
    this.selectedSeries.set({ ...this.selectedSeries(), [key]: checked });
    this.loadCharts();
  }

  // =========================
  // CARGA DE DATOS REALES
  // =========================
  loadCharts(): void {
    const activeSites = this.selectedSites();

    if (!this.chart || activeSites.length === 0) {
      this.showEmptyChart();
      return;
    }

    const range = this.rangeMap[this.timePreset()];
    const seriesState = this.selectedSeries();
    this.loading.set(true);

    const requests = activeSites.map(devEUI =>
      forkJoin({
        flow:     this.telemetryService.getHistory(devEUI, 'caudal_lts', range),
        pressure: this.telemetryService.getHistory(devEUI, 'presion_kg', range),
        rssi:     this.telemetryService.getHistory(devEUI, 'rssi', range),
      })
    );

    forkJoin(requests).subscribe({
      next: (results: any[]) => {
        const series: echarts.SeriesOption[] = [];

        results.forEach((res, idx) => {
          const devEUI   = activeSites[idx];
          const siteName = this.sitesDisponibles.find(s => s.devEUI === devEUI)?.name ?? devEUI;

          const flowData     = res.flow.data.map((p: any)     => [new Date(p.timestamp).getTime(), p.value]);
          const pressureData = res.pressure.data.map((p: any) => [new Date(p.timestamp).getTime(), p.value]);
          const rssiData     = res.rssi.data.map((p: any)     => [new Date(p.timestamp).getTime(), p.value]);

          if (seriesState.caudal) {
            series.push({
              name: `${siteName} · Caudal`,
              type: 'line', smooth: true, yAxisIndex: 0,
              showSymbol: false, connectNulls: false,
              data: flowData
            });
          }

          if (seriesState.presion) {
            series.push({
              name: `${siteName} · Presión`,
              type: 'line', smooth: true, yAxisIndex: 1,
              showSymbol: false, connectNulls: false,
              data: pressureData
            });
          }

          if (seriesState.comunicacion) {
            series.push({
              name: `${siteName} · Señal`,
              type: 'line', smooth: true, yAxisIndex: 2,
              showSymbol: false,
              lineStyle: { type: 'dashed' },
              data: rssiData
            });
          }
        });

        const yAxis: any[] = [
          { type: 'value', name: 'L/s' },
          { type: 'value', name: 'Kg/cm²' }
        ];
        if (seriesState.comunicacion) {
          yAxis.push({ type: 'value', name: 'dBm', inverse: true });
        }

        this.chart.setOption({
          tooltip: { trigger: 'axis' },
          legend: { top: 10, type: 'scroll', data: series.map(s => s.name as string) },
          grid: { left: '6%', right: '8%', top: '18%', bottom: '10%' },
          xAxis: { type: 'time' },
          yAxis,
          series
        }, true);

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando telemetría:', err);
        this.loading.set(false);
      }
    });
  }

  // =========================
  // UTILIDADES
  // =========================
  private showEmptyChart(): void {
    if (!this.chart) return;
    this.chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { top: 10, data: [] },
      grid: { left: '6%', right: '8%', top: '18%', bottom: '10%' },
      xAxis: { type: 'time' },
      yAxis: [{ type: 'value', name: 'L/s' }, { type: 'value', name: 'Kg/cm²' }],
      series: []
    }, true);
  }

  exportPDF(): void {
    const img = this.chart.getDataURL({ type: 'png', pixelRatio: 2 });
    console.log('Exportar gráfica a PDF', img);
  }

  goBack(): void {
    this.router.navigate(['/telemetria']);
  }
}
