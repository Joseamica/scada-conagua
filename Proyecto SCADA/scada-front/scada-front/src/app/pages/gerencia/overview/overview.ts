import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { Location, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft, heroBeaker, heroCheckCircle, heroMapPin,
  heroChartBar, heroPresentationChartLine, heroGlobeAmericas
} from '@ng-icons/heroicons/outline';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { POZOS_DATA } from '../../pozos/pozos-data';
import { TelemetryService } from '../../../core/services/telemetry';
import { AuthService } from '../../../core/services/auth.service';
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

@Component({
  selector: 'overview',
  standalone: true,
  imports: [HeaderBarComponent, FooterTabsComponent, CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      heroArrowLeft, heroBeaker, heroCheckCircle, heroMapPin,
      heroChartBar, heroPresentationChartLine, heroGlobeAmericas
    })
  ],
  templateUrl: './overview.html',
  styleUrl: './overview.css',
})
export class Overview implements OnInit, AfterViewInit {

  detalleMap!: L.Map;
  chart!: echarts.ECharts;

  gastoByMunicipio = new Map<number, number>();
  private location = inject(Location);
  private telemetryService = inject(TelemetryService);
  private authService = inject(AuthService);

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
      // Federal or fallback — see everything
      this.scopedSources = [...SITIOS_SOURCES];
      this.scopedPozos = Object.values(POZOS_DATA);
    }
  }

  ngAfterViewInit() {
    this.initBaseMap();
    this.createChart();
    this.mapReady = true;
    this.tryLoadOverlay();
  }

  // =========================
  // DATA LOGIC
  // =========================

  private loadStaticData() {
    this.totalPozos = this.scopedPozos.length;

    const activos = this.scopedPozos.filter(
      (p: any) => (p.estatus || '').toLowerCase() === 'activo'
    );
    this.pozosActivos = activos.length;
    this.municipiosCount = this.scopedSources.length;
  }

  private loadLiveFlowData() {
    // Build devEUI → municipioId mapping for active scoped pozos
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

        this.dataReady = true;
        this.tryLoadOverlay();
        this.updateChartWithLiveData();
      },
      error: (err) => {
        console.error('Error fetching live flow data:', err);
        this.dataReady = true;
        this.tryLoadOverlay();
      }
    });
  }

  // Only load municipio overlay when both map and data are ready
  private tryLoadOverlay() {
    if (this.mapReady && this.dataReady) {
      this.loadMunicipiosOverview();
    }
  }

  // =========================
  // MAP
  // =========================

  private initBaseMap() {
    this.detalleMap = L.map('mapOverview').setView([19.4, -99.1], 11);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(this.detalleMap);
  }

  private loadMunicipiosOverview() {
    fetch('assets/mapas/edomex_municipios.geojson')
      .then(res => res.json())
      .then(data => {
        const municipiosSource = new Set(
          this.scopedSources.map(s => s.municipioId)
        );

        const municipioLayer = L.geoJSON(data, {
          filter: (feature: any) => {
            const id = Number(feature.properties?.CVE_MUN);
            return municipiosSource.has(id);
          },

          style: () => ({
            color: '#0d9488',
            weight: 2,
            fillColor: '#0d9488',
            fillOpacity: 0.12
          }),

          onEachFeature: (feature, layer) => {
            const municipioId = Number(feature.properties?.CVE_MUN);
            const nombre = feature.properties?.NOMGEO || feature.properties?.nombre;
            const gasto = this.gastoByMunicipio.get(municipioId) || 0;

            layer.bindTooltip(
              `<div class="municipio-label-wrapper">
                <div class="municipio-name">${nombre}</div>
                <div class="municipio-gasto">${gasto.toLocaleString()} l/s</div>
              </div>`,
              {
                permanent: true,
                direction: 'center',
                className: 'municipio-label',
                interactive: false
              }
            );

            layer.on('click', () => {
              this.router.navigate(['/gerencia/municipio', municipioId]);
            });

            (layer as any).getElement?.()?.style.setProperty('cursor', 'pointer');
          }
        }).addTo(this.detalleMap);

        this.detalleMap.fitBounds(
          municipioLayer.getBounds(),
          { paddingTopLeft: [20, 20], paddingBottomRight: [20, 20] }
        );
      });
  }

  // =========================
  // CHART
  // =========================

  private createChart() {
    const chartDom = document.getElementById('chartOverview')!;
    this.chart = echarts.init(chartDom);

    const resizeObserver = new ResizeObserver(() => {
      this.chart?.resize();
    });
    resizeObserver.observe(chartDom);
  }

  private updateChartWithLiveData() {
    if (!this.chart) return;

    const labels: string[] = [];
    const values: number[] = [];
    const municipioNames: Record<number, string> = { 33: 'Ecatepec', 39: 'Ixtapaluca', 25: 'Chalco' };

    this.scopedSources.forEach(source => {
      const name = municipioNames[source.municipioId] || `Mun. ${source.municipioId}`;
      const gasto = this.gastoByMunicipio.get(source.municipioId) || 0;
      labels.push(name);
      values.push(gasto);
    });

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#0f172a', fontSize: 13 },
        formatter: (params: any) => {
          const p = params[0];
          return `<strong>${p.name}</strong><br/>Gasto: <strong>${p.value.toLocaleString()} l/s</strong>`;
        }
      },
      grid: { left: 56, right: 16, top: 24, bottom: 56 },
      xAxis: {
        type: 'category',
        data: labels.length > 0 ? labels : ['Sin datos'],
        axisLabel: { rotate: 0, color: '#64748b', fontSize: 12 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisTick: { show: false },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'value',
        name: 'Gasto (l/s)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: '#64748b', fontSize: 12 },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
      },
      series: [{
        data: values.length > 0 ? values : [0],
        type: 'bar',
        barWidth: '40%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#6b0027' },
            { offset: 1, color: 'rgba(107, 0, 39, 0.6)' }
          ]),
          borderRadius: [6, 6, 0, 0]
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#8b0035' },
              { offset: 1, color: 'rgba(139, 0, 53, 0.7)' }
            ])
          }
        }
      }]
    };

    this.chart.setOption(option);
  }
}
