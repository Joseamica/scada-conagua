import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { POZOS_DATA } from '../pozos/pozos-data';
import { HeaderBarComponent } from '../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../layout/footer-tabs/footer-tabs';
import { CommonModule } from '@angular/common';
import { TelemetryService } from '../../core/services/telemetry';
import * as L from 'leaflet';
import * as echarts from 'echarts';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'gerencia-municipio',
  standalone: true,
  imports: [HeaderBarComponent, FooterTabsComponent, CommonModule],
  templateUrl: './gerencia-municipio.html',
  styleUrl: './gerencia-municipio.css'
})
export class GerenciaMunicipio implements OnInit, AfterViewInit {

  municipioId!: number;
  municipioNombre!: string;
  gastoTotal = 0;
  pozosActivos = 0;
  totalPozos = 0;

  detalleMap!: L.Map;
  chart!: echarts.ECharts;

  private telemetryService = inject(TelemetryService);
  private pozosMunicipio: any[] = [];

  constructor(private route: ActivatedRoute, private cdr: ChangeDetectorRef) {}

  // =========================
  // INIT DATA
  // =========================

  ngOnInit() {
    this.municipioId = Number(
      this.route.snapshot.paramMap.get('id')
    );

    this.loadMunicipioData();
    this.loadLiveFlowData();
  }

  // =========================
  // INIT UI (MAP + CHART)
  // =========================

  ngAfterViewInit() {
    this.initMap();
    this.createChart();
  }

  // =========================
  // DATA LOGIC
  // =========================

  loadMunicipioData() {
    const pozos = Object.values(POZOS_DATA);

    this.pozosMunicipio = pozos.filter(
      (p: any) => Number(p.municipioId) === this.municipioId
    );

    this.totalPozos = this.pozosMunicipio.length;
    this.pozosActivos = this.pozosMunicipio.filter(
      (p: any) => (p.estatus || '').toLowerCase() === 'activo'
    ).length;
  }

  // Fetch live flow values from API and aggregate
  private loadLiveFlowData() {
    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        // Build a set of devEUIs that belong to this municipality
        const municipioDevEuis = new Set(
          this.pozosMunicipio
            .map((p: any) => (p.devEui || '').trim().toLowerCase())
            .filter((d: string) => d.length > 0)
        );

        // Sum flow values from live site_status for matching devEUIs
        let totalFlow = 0;
        sites.forEach(site => {
          const siteDevEui = (site.dev_eui || '').trim().toLowerCase();
          if (municipioDevEuis.has(siteDevEui) && site.last_flow_value != null) {
            const flow = Number(site.last_flow_value);
            if (flow > 0.01) {
              totalFlow += flow;
            }
          }
        });

        this.gastoTotal = Math.round(totalFlow * 100) / 100;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching live flow data:', err);
        // Fallback: keep gastoTotal at 0
      }
    });
  }

  // =========================
  // MAP
  // =========================

  private initMap() {
    this.detalleMap = L.map('mapDetalle')
      .setView([19.4, -99.1], 11);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(this.detalleMap);

    this.loadMunicipioDetalle(this.municipioId);
  }

  private loadMunicipioDetalle(municipioId: number) {
    fetch('assets/mapas/edomex_municipios.geojson')
      .then(res => res.json())
      .then(data => {
        const municipioLayer = L.geoJSON(data, {
          filter: (feature: any) => {
            const id = Number(feature.properties?.CVE_MUN);
            if (id === this.municipioId) {
              this.municipioNombre =
                feature.properties?.NOMGEO ||
                feature.properties?.nombre;
              this.cdr.detectChanges();
              return true;
            }
            return false;
          },

          style: () => ({
            color: '#2c7f73',
            weight: 3,
            fillColor: '#589088',
            fillOpacity: 0.15
          }),

          onEachFeature: (feature, layer) => {
            const nombre =
              feature.properties?.NOMGEO ||
              feature.properties?.nombre;
            layer.bindTooltip(nombre, {
              permanent: true,
              direction: 'center',
              className: 'municipio-label'
            });
          }
        }).addTo(this.detalleMap);

        this.detalleMap.fitBounds(
          municipioLayer.getBounds(),
          { padding: [40, 40], maxZoom: 12 }
        );
      });
  }

  // =========================
  // CHART
  // =========================

  private createChart() {
    const chartDom = document.getElementById('chartMunicipio')!;
    this.chart = echarts.init(chartDom);

    // Fetch historical data for the first active pozo in this municipality
    const activePozo = this.pozosMunicipio.find(
      (p: any) => (p.estatus || '').toLowerCase() === 'activo' && p.devEui
    );

    if (activePozo) {
      this.telemetryService.getHistory(activePozo.devEui, 'caudal_lts', '-7d').subscribe({
        next: (data) => {
          const points = (data as any) || [];
          if (Array.isArray(points) && points.length > 0) {
            const dates = points.map((p: any) => {
              const d = new Date(p._time || p.timestamp);
              return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            });
            const values = points.map((p: any) => {
              const v = Number(p._value ?? p.value ?? 0);
              return v > 0.01 ? Math.round(v * 100) / 100 : null;
            });
            this.updateChart(dates, values);
          } else {
            this.updateChart([], []);
          }
        },
        error: () => this.updateChart([], [])
      });
    } else {
      this.updateChart([], []);
    }
  }

  private updateChart(dates: string[], values: (number | null)[]) {
    const option: echarts.EChartsOption = {
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      xAxis: {
        type: 'category',
        data: dates.length > 0 ? dates : ['Sin datos'],
        axisLabel: { rotate: 45, color: '#374151' },
        axisLine: { lineStyle: { color: '#9ca3af' } },
        splitLine: { show: true, lineStyle: { color: '#e5e7eb' } }
      },
      yAxis: {
        type: 'value',
        name: 'Gasto [L/s]',
        nameLocation: 'middle',
        nameGap: 40,
        axisLine: { show: false },
        splitLine: { show: true, lineStyle: { color: '#d1d5db' } }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#fff',
        borderColor: '#e2e8f0',
        borderWidth: 1,
        textStyle: { color: '#0f172a', fontSize: 13 }
      },
      series: [{
        data: values.length > 0 ? values : [0],
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#0284c7' },
        areaStyle: { color: '#0ea5e9', opacity: 0.45 }
      }]
    };

    this.chart.setOption(option);
  }
}
