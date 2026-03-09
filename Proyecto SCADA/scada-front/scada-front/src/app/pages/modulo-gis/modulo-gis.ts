import { Component, OnInit, OnDestroy, inject, effect, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import * as omnivore from 'leaflet-omnivore';
import * as echarts from 'echarts';
import { forkJoin } from 'rxjs';
import { HeaderBarComponent } from '../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../layout/footer-tabs/footer-tabs';
import { POZOS_DATA } from '../pozos/pozos-data';
import { POZOS_LAYOUT } from '../pozos/pozos-layout';
import { POZO_NAME_TO_ID } from '../../core/stores/pozo-name.map';
import { PozosStore } from '../../core/stores/pozos.store';
import { TelemetryService } from '../../core/services/telemetry';
import { ThemeService } from '../../core/services/theme.service';
import { getEChartsColors } from '../../core/utils/echarts-theme';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner';
import { heroPresentationChartLine } from '@ng-icons/heroicons/outline';


const DETAIL_BASE_URL = '/pozos';

type ScadaIconKey = 'well' | 'tank' | 'block_water' | 'rain_gauge';

interface GisSource {
  type: 'kml';
  path: string;
  municipioId: number;
  estadoId: number; // 🔑 Obligatorio para la jerarquía
}

// ✅ NUEVO: fuentes múltiples (solo agrega aquí archivos)
const SITIOS_SOURCES: GisSource[] = [
  //{ type: 'kml' as const, path: 'assets/mapas/4PT/sitios.kml' },
  { type: 'kml' as const, path: 'assets/mapas/4PT/sitios_piloto.kml', municipioId: 0, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/chalco.kml', municipioId: 25, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/chicoloapan.kml', municipioId: 29, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/odapas_chimalhuacan.kml', municipioId: 31, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/ecatepec.kml', municipioId: 33, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/ixtapaluca.kml', municipioId: 39, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/odapas_la_paz.kml', municipioId: 70, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/odapas-neza.kml', municipioId: 58, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/texcoco.kml', municipioId: 99, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/tlanepantla.kml', municipioId: 104, estadoId: 15 },
  { type: 'kml' as const, path: 'assets/mapas/4PT/odapas-valle-de-chalco.kml', municipioId: 122, estadoId: 15 }
  // { type: 'kml' as const, path: 'assets/mapas/4PT/doc.kml' },
];


const SCADA_ICON_MAP: Record<ScadaIconKey, string> = {
  well: 'well.svg',
  tank: 'tank.svg',
  block_water: 'block-water.svg',
  rain_gauge: 'rain-gauge.svg'
};

const GRAY_ICON_MAP: Record<ScadaIconKey, L.Icon> = {
  well: L.icon({
    iconUrl: 'assets/icons/map/well-gray.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  }),
  tank: L.icon({
    iconUrl: 'assets/icons/map/tank-gray.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  }),
  block_water: L.icon({
    iconUrl: 'assets/icons/map/block-water-gray.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  }),
  rain_gauge: L.icon({
    iconUrl: 'assets/icons/map/rain-gauge-gray.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  })
};

const MUNICIPIOS_CON_POZO = new Set<number>(
  SITIOS_SOURCES
    .filter(s => s.municipioId > 0)
    .map(s => s.municipioId)
);

@Component({
  selector: 'app-modulo-gis',
  templateUrl: './modulo-gis.html',
  styleUrls: ['./modulo-gis.css'],
  standalone: true,
  imports: [HeaderBarComponent, FooterTabsComponent, NgIconComponent, LoadingSpinnerComponent],
  providers: [
    provideIcons({
      heroPresentationChartLine,
    })
  ],
})

export class ModuloGis implements OnInit, OnDestroy {
  mapLoading = signal(true);
  map!: L.Map;
  private popupChart: echarts.ECharts | null = null;
  private popupChartGeneration = 0;
  private municipioChartCache = new Map<number, [number, number | null][]>();
  private pozoChartCache = new Map<string, [number, number | null][]>();

  // LayerGroups
  pozosLayer = L.layerGroup();
  // (opcional) si quieres mantener "capas operativas" como antes
  capasLayer = L.layerGroup();
  redPrimariaLayer = L.layerGroup();
  redSecundariaLayer = L.layerGroup();
  zonasLayer = L.layerGroup();

  pozosActivosLayer = L.layerGroup();
  pozosObraLayer = L.layerGroup();
  pozosInactivosLayer = L.layerGroup();


  // Municipios
  municipiosLayer!: L.GeoJSON;
  // Control de capas (para poder agregar overlays async)
  layersControl!: L.Control.Layers;

  // Buscador
  municipiosIndex = new Map<string, L.Polygon>();
  markersIndex = new Map<string, L.Marker>();
  selectedPozoName: string | null = null;

  private gastoByMunicipio = new Map<number, number>();
  private apiSitesByName = new Map<string, any>();
  private telemetryService = inject(TelemetryService);
  private themeService = inject(ThemeService);
  private http = inject(HttpClient);
  private tileLayer?: L.TileLayer;
  private geoserverWmsLayers = new Map<string, L.TileLayer.WMS>();
  private baseLayers: Record<string, L.TileLayer> = {};
  private activeBaseKey = '';

  private themeEffect = effect(() => {
    const theme = this.themeService.resolved();
    // Only auto-switch if the user is on the default "Mapa" base layer
    if (this.tileLayer && this.map && (this.activeBaseKey === 'mapa' || this.activeBaseKey === '')) {
      const url = theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
      this.tileLayer.setUrl(url);
    }
    // Re-render popup chart after theme transition settles
    if (this.popupChart && !this.popupChart.isDisposed()) {
      setTimeout(() => {
        if (this.popupChart && !this.popupChart.isDisposed()) {
          this.popupChart.resize();
        }
      }, 150);
    }
  });

  constructor(
    private router: Router,
    private pozosStore: PozosStore
  ) {}

  get highlightWells() {
    return this.pozosStore.highlightWells;
  }

  // ─────────────────────────────
  // Helpers
  // ─────────────────────────────
  private inferTypeFromName(name: string): ScadaIconKey | null {
    const n = name.toUpperCase();
    if (n.includes('POZO')) return 'well';
    if (n.includes('PLUVIO') || n.includes('PLUVI')) return 'rain_gauge';
    if (n.includes('NIVEL') || n.includes('TANQUE')) return 'tank';
    if (n.includes('AGUA EN BLOQUE')) return 'block_water';
    if (n.includes('CAUDAL') || n.includes('PRESION')) return 'block_water';
    return null;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  private normalizeKey(v: string): string {
    return (v || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Cache ALL sites from API — needed for dynamic popup lookup */
  private loadApiSitesCache() {
    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        this.apiSitesByName.clear();
        sites.forEach(site => {
          const key = this.normalizeKey(site.site_name || '');
          if (key) this.apiSitesByName.set(key, site);
        });
      },
      error: () => {}
    });
  }

  private loadGeoServerLayers() {
    this.http.get<{ wmsUrl: string; layers: { name: string }[] }>('/api/v1/gis/layers').subscribe({
      next: ({ wmsUrl, layers }) => {
        if (!layers?.length) return;
        layers.forEach(layer => {
          const wms = L.tileLayer.wms(wmsUrl, {
            layers: `scada:${layer.name}`,
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
          } as any);
          this.geoserverWmsLayers.set(layer.name, wms);
          const label = `<span class="layer-label"><span class="legend-dot" style="background:#10b981"></span> ${layer.name}</span>`;
          this.layersControl.addOverlay(wms, label);
        });
      },
      error: () => {} // GeoServer offline — silently skip
    });
  }

  private buildGastoByMunicipio() {
    this.gastoByMunicipio.clear();

    // Build devEUI → municipioId mapping from POZOS_DATA
    const devEuiToMunicipio = new Map<string, number>();
    Object.values(POZOS_DATA as any).forEach((pozo: any) => {
      const munId = Number(pozo?.municipioId ?? pozo?.CVE_MUN);
      if (!munId || !MUNICIPIOS_CON_POZO.has(munId)) return;
      const devEui = (pozo?.devEui || '').trim().toLowerCase();
      if (devEui) devEuiToMunicipio.set(devEui, munId);
    });

    // Fetch live flow data from API
    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        // Also update cache from this response
        this.apiSitesByName.clear();
        sites.forEach(site => {
          const key = this.normalizeKey(site.site_name || '');
          if (key) this.apiSitesByName.set(key, site);
        });

        sites.forEach(site => {
          const devEui = (site.dev_eui || '').trim().toLowerCase();
          const munId = devEuiToMunicipio.get(devEui);
          if (munId == null) return;
          const flow = Number(site.last_flow_value || 0);
          if (flow <= 0.01) return;
          const prev = this.gastoByMunicipio.get(munId) || 0;
          this.gastoByMunicipio.set(munId, Math.round((prev + flow) * 100) / 100);
        });
      },
      error: () => {} // Fallback: keep at 0
    });
  }

  private closeAllTooltipsExcept(exceptName: string) {
    this.markersIndex.forEach((m, n) => {
      if (n !== exceptName) m.closeTooltip();
    });
  }

  private resolveSiteIconUrl(name: string): string {

  const normalized = this.normalizeKey(name);

  // resolver id
  let pozoId = POZO_NAME_TO_ID[normalized];
  if (!pozoId) pozoId = this.slugify(name);

  const data = POZOS_DATA[pozoId];

  // 🔥 detectar tipo por nombre
  const type = this.inferTypeFromName(name) ?? 'well';

  const fileType = type.replaceAll('_','-');

  // ===============================
  // NO POZOS → icono fijo
  // ===============================
 if (type !== 'well') {
  return `assets/icons/map/${fileType}-gray.svg`;
}

  // ===============================
  // POZOS → depende del estatus
  // ===============================
  if (!data) {
    // Sitio no está en POZOS_DATA (creado dinámicamente) — mostrar activo por defecto
    return `assets/icons/map/well.svg`;
  }

  const status = (data.estatus || '').toLowerCase().trim();

  if (status === 'activo') {
    return `assets/icons/map/well.svg`;
  }

  if (status === 'obra') {
    return `assets/icons/map/well-yellow.svg`;
  }

  return `assets/icons/map/well-gray.svg`;
}



// ─────────────────────────────
// ✅ NUEVO: Escalado de iconos por zoom
// ─────────────────────────────

// Guarda meta por marker para reconstruir el icono al cambiar zoom
  private setMarkerIconMeta(marker: L.Marker, iconUrl: string) {
    (marker as any).__scadaIconUrl = iconUrl;
  }

// Calcula tamaño según zoom (ajústalo a tu gusto)
  private iconSizeForZoom(zoom: number): number {
    return (
      zoom <= 8  ? 10 :
      zoom <= 10 ? 16 :
      zoom <= 12 ? 22 :
      zoom <= 14 ? 30 : 38
    );
  }

  private buildIcon(iconUrl: string, size: number): L.Icon {
    return L.icon({
      iconUrl,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  private applyIconScaleToMarker(marker: L.Marker) {
    const iconUrl = (marker as any).__scadaIconUrl as string | undefined;
    if (!iconUrl) return;

    const zoom = this.map.getZoom();
    const alwaysVisible = (marker as any).__alwaysVisible === true;

    // 🚫 Ocultar en zoom bajo SOLO si no es alwaysVisible
    if (zoom < 10 && !alwaysVisible) {
      marker.setOpacity(0);
      return;
    }

    marker.setOpacity(1);

    // 🧠 Size especial para piloto
    let size = this.iconSizeForZoom(zoom);

    if (alwaysVisible) {
      size = Math.max(size, 22); // 👈 nunca menor a esto
    }

    marker.setIcon(
      L.icon({
        iconUrl,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      })
    );
  }

  private setupIconScalingByZoom() {
    // 1) cuando cambia el zoom, reescalamos todos los markers de pozosLayer + el piloto
    this.map.on('zoomend', () => {

  [
    this.pozosActivosLayer,
    this.pozosObraLayer,
    this.pozosInactivosLayer
  ].forEach(group => {

    group.eachLayer((l:any)=>{
      if (l instanceof L.Marker) {
        this.applyIconScaleToMarker(l);
      }
    });

  });

      // si tienes markers sueltos fuera del layer, igual se puede (piloto lo indexas)
      const piloto = this.markersIndex.get('SITIO PILOTO');
      if (piloto) this.applyIconScaleToMarker(piloto);
    });
  }

  // ─────────────────────────────
  // ✅ NUEVO: Sitios (múltiples KML)
  // ─────────────────────────────
  private loadSitiosSources() {
    SITIOS_SOURCES.forEach(src => {
      if (src.type === 'kml') {
        this.loadSitiosKml(src.path);
      }
    });
  }

    // ─────────────────────────────
  // ✅ Popup
  // ─────────────────────────────

  private buildPozoPopup(name: string): string {
    const normalized = this.normalizeKey(name);
    const pozoId = POZO_NAME_TO_ID[normalized] || this.slugify(name);
    const d = POZOS_DATA[pozoId];
    const l = POZOS_LAYOUT[pozoId];

    // Site exists in hardcoded data — full popup
    if (d) {
      const detailUrl = `${DETAIL_BASE_URL}/${this.slugify(name)}`;
      // Prefer API-uploaded render over static asset
      const hcApiSite = this.apiSitesByName.get(this.normalizeKey(name));
      const hcRenderSrc = hcApiSite?.render_url || (l?.render ? `assets/pozos/${l.render}` : '');
      return `
        <div class="scada-popup">
          ${hcRenderSrc ? `
            <div class="scada-popup-render">
              <img src="${hcRenderSrc}" alt="${d.nombre}" />
            </div>
          ` : ''}

          <div class="scada-popup-header">${d.nombre}</div>

          <div class="scada-popup-metrics">
            <div class="metric"><span>Latitud:</span> <b>${d.lat}</b></div>
            <div class="metric"><span>Longitud:</span> <b>${d.lng}</b></div>
          </div>

          <div class="scada-popup-meta"><div><b>Estatus:</b> ${d.estatus}</div></div>
          <div class="scada-popup-meta"><div><b>Proveedor:</b> ${d.proveedor}</div></div>

          <div class="scada-popup-chart" id="popup-chart-pozo-${this.slugify(name)}">
            <div class="scada-popup-chart-loading">Cargando...</div>
          </div>

          <button class="scada-popup-btn" data-url="${detailUrl}">
            Ver isométrico →
          </button>
        </div>
      `;
    }

    // Dynamic site (not in POZOS_DATA) — build popup from API cache
    const nameKey = this.normalizeKey(name);
    const apiSite = this.apiSitesByName.get(nameKey);
    const devEui = (apiSite?.dev_eui || '').trim();
    // Navigate to isometric view using devEUI as slug
    const detailUrl = devEui ? `${DETAIL_BASE_URL}/${devEui}` : '';

    // For hardcoded sites, check if API has a render_url override
    const renderUrl = apiSite?.render_url;

    return `
      <div class="scada-popup">
        ${renderUrl ? `
          <div class="scada-popup-render">
            <img src="${renderUrl}" alt="${name}" />
          </div>
        ` : ''}
        <div class="scada-popup-header">${name}</div>

        <div class="scada-popup-metrics">
          ${apiSite?.municipality ? `<div class="metric"><span>Municipio:</span> <b>${apiSite.municipality}</b></div>` : ''}
          ${apiSite?.site_type ? `<div class="metric"><span>Tipo:</span> <b>${apiSite.site_type}</b></div>` : ''}
          ${apiSite?.last_flow_value != null ? `<div class="metric"><span>Caudal:</span> <b>${Number(apiSite.last_flow_value).toFixed(2)} L/s</b></div>` : ''}
          ${apiSite?.last_pressure_value != null ? `<div class="metric"><span>Presión:</span> <b>${Number(apiSite.last_pressure_value).toFixed(2)} kg/cm²</b></div>` : ''}
          ${apiSite?.last_nivel_value != null ? `<div class="metric"><span>Nivel:</span> <b>${Number(apiSite.last_nivel_value).toFixed(2)} m</b></div>` : ''}
          ${apiSite?.last_lluvia_value != null ? `<div class="metric"><span>Lluvia:</span> <b>${Number(apiSite.last_lluvia_value).toFixed(1)} mm</b></div>` : ''}
        </div>

        ${devEui ? `
          <div class="scada-popup-chart" id="popup-chart-pozo-${this.slugify(name)}">
            <div class="scada-popup-chart-loading">Cargando...</div>
          </div>
          <button class="scada-popup-btn" data-url="${detailUrl}">
            Ver isométrico →
          </button>
        ` : `
          <div class="scada-popup-meta"><div>Sitio sin datos de telemetría</div></div>
        `}
      </div>
    `;
  }

  private buildMunicipioPopup(nombre:string, municipioId:number): string {
    const gasto = this.gastoByMunicipio.get(municipioId) || 0;
    const detailUrl = `/gerencia/municipio/${municipioId}`;
    return `
      <div class="scada-popup">
        <div class="scada-popup-header">
          ${nombre}
        </div>

        <div class="scada-popup-metrics">
          <div class="metric">
            <span>Gasto total:</span>
            <b>${gasto.toLocaleString('es-MX')} L/s</b>
          </div>
        </div>

        <div class="scada-popup-chart" id="popup-chart-${municipioId}">
          <div class="scada-popup-chart-loading">Cargando...</div>
        </div>

        <button class="scada-popup-btn" data-url="${detailUrl}" data-mun="${municipioId}">
          Ver detalle →
        </button>
      </div>
    `;
  }

  private loadSitiosKml(path: string, onReady?: (bounds: L.LatLngBounds) => void) {
    fetch(path)
      .then(res => res.text())
      .then(kmlText => {
        const url = URL.createObjectURL(
          new Blob([kmlText], { type: 'text/xml' })
        );

        const kmlLayer = omnivore.kml(
          url,
          null,
          L.geoJSON(null, {
            pointToLayer: (_f, latlng) =>
              L.marker(latlng) // 🔥 SIN icono inicial
          })
        );

        kmlLayer.on('ready', () => {
          kmlLayer.eachLayer((layerItem: any) => {
            if (!layerItem.getLatLng) return;
            const name = layerItem.feature?.properties?.name;
            if (!name) return;

            // ⚠️ MISMA lógica, solo con fallback seguro
            const marker = layerItem as L.Marker;

            // 👇 obtener data igual que en resolvePozoIconUrl
            const normalized = this.normalizeKey(name);

            let pozoId = POZO_NAME_TO_ID[normalized];

            if (!pozoId) {
              pozoId = this.slugify(name);
            }

            const data = POZOS_DATA[pozoId];
            const estado = (data?.estatus || 'activo').toLowerCase().trim();

            // Agregar al layer correcto (default activo para sitios dinámicos)
            if (estado === 'activo') {
              marker.addTo(this.pozosActivosLayer);
            }
            else if (estado === 'obra') {
              marker.addTo(this.pozosObraLayer);
            }
            else {
              marker.addTo(this.pozosInactivosLayer);
            }

            this.applyIconScaleToMarker(marker);

            const key = this.normalizeKey(name);
            this.markersIndex.set(key, marker);

            marker.bindTooltip(name, {
              direction: 'top',
              offset: [0, -8],
              opacity: 0.9
            });

            marker.on('mouseover', () => marker.openTooltip());
            marker.on('mouseout', () => {
              if (this.selectedPozoName !== key) marker.closeTooltip();
            });

            marker.on('click', () => {
              this.selectedPozoName = key;
              this.closeAllTooltipsExcept(key);
              marker.openTooltip();
            });


          // Decide qué URL usar (gris o color)
            const iconUrl = this.resolveSiteIconUrl(name); 

          // ✅ meta primero, luego scale
          this.setMarkerIconMeta(marker, iconUrl);
          this.applyIconScaleToMarker(marker);
          if (this.map.getZoom() < 10) marker.setOpacity(0);

          if ((marker as any).bringToFront) (marker as any).bringToFront();

            const popupId = `go-${this.slugify(name)}`;
            const detailUrl = `${DETAIL_BASE_URL}/${this.slugify(name)}`;

            marker.bindPopup(
              () => this.buildPozoPopup(name),
              { minWidth: 260 }
            );
           marker.on('popupopen', (e: any) => {
              const popupEl = e.popup.getElement() as HTMLElement;
              if (!popupEl) return;

              const btn = popupEl.querySelector(
                '.scada-popup-btn'
              ) as HTMLButtonElement | null;

              if (btn) {
                btn.onclick = () => {
                  const url = btn.getAttribute('data-url');
                  if (url) this.router.navigateByUrl(url);
                };
              }

              // Render mini chart for this well
              const normalized = this.normalizeKey(name);
              const pid = POZO_NAME_TO_ID[normalized];
              const pData = pid ? POZOS_DATA[pid] : null;
              let devEui = (pData?.devEui || '').trim();
              // Fallback: look up devEUI from API cache for dynamic sites
              if (!devEui) {
                devEui = (this.apiSitesByName.get(this.normalizeKey(name))?.dev_eui || '').trim();
              }
              if (devEui) {
                this.renderPozoPopupChart(devEui, this.slugify(name));
              }
            });

            marker.on('popupclose', () => {
              if (this.popupChart) {
                this.popupChart.dispose();
                this.popupChart = null;
              }
            });
          });

          // Notify caller with the bounds of this KML for auto-zoom
          if (onReady) {
            const bounds = L.latLngBounds([]);
            kmlLayer.eachLayer((l: any) => {
              if (l.getLatLng) bounds.extend(l.getLatLng());
            });
            onReady(bounds);
          }

          URL.revokeObjectURL(url);

          // asegurar todo al frente
          this.pozosLayer.eachLayer((l: any) => {
            if (l.bringToFront) l.bringToFront();
          });
        });
      })
      .catch(() => {
        // KML failed (404, network error) — still count it so fitBounds can proceed
        if (onReady) onReady(L.latLngBounds([]));
      });
  }

  /**
   * Add markers for inventory sites (created via form) that aren't already on the map from KML.
   * Called after all KML sources finish loading so markersIndex is fully populated.
   */
  private addDynamicSiteMarkers() {
    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        // Update the API cache while we're at it
        this.apiSitesByName.clear();
        sites.forEach(site => {
          const key = this.normalizeKey(site.site_name || '');
          if (key) this.apiSitesByName.set(key, site);
        });

        sites.forEach(site => {
          const lat = Number(site.latitude);
          const lng = Number(site.longitude);
          if (!lat || !lng) return; // No coordinates — can't place on map

          const name = site.site_name || site.dev_eui;
          const key = this.normalizeKey(name);
          if (this.markersIndex.has(key)) return; // Already on map from KML

          // Proximity dedup: skip if a KML marker is within ~100m (same physical site, different name)
          const siteLatLng = L.latLng(lat, lng);
          let nearbyKml = false;
          this.markersIndex.forEach((existingMarker) => {
            if (!nearbyKml && existingMarker.getLatLng().distanceTo(siteLatLng) < 100) {
              nearbyKml = true;
            }
          });
          if (nearbyKml) return;

          const marker = L.marker([lat, lng]);
          const siteEstatus = (site as any).estatus || 'activo';
          const targetLayer =
            siteEstatus === 'obra'
              ? this.pozosObraLayer
              : siteEstatus === 'inactivo'
                ? this.pozosInactivosLayer
                : this.pozosActivosLayer;
          marker.addTo(targetLayer);

          const iconUrl = this.resolveSiteIconUrl(name);
          this.setMarkerIconMeta(marker, iconUrl);
          this.applyIconScaleToMarker(marker);
          if (this.map.getZoom() < 10) marker.setOpacity(0);

          this.markersIndex.set(key, marker);

          marker.bindTooltip(name, {
            direction: 'top',
            offset: [0, -8],
            opacity: 0.9
          });

          marker.on('mouseover', () => marker.openTooltip());
          marker.on('mouseout', () => {
            if (this.selectedPozoName !== key) marker.closeTooltip();
          });
          marker.on('click', () => {
            this.selectedPozoName = key;
            this.closeAllTooltipsExcept(key);
            marker.openTooltip();
          });

          marker.bindPopup(
            () => this.buildPozoPopup(name),
            { minWidth: 260 }
          );

          marker.on('popupopen', (e: any) => {
            const popupEl = e.popup.getElement() as HTMLElement;
            if (!popupEl) return;

            const btn = popupEl.querySelector('.scada-popup-btn') as HTMLButtonElement | null;
            if (btn) {
              btn.onclick = () => {
                const url = btn.getAttribute('data-url');
                if (url) this.router.navigateByUrl(url);
              };
            }

            const devEui = (site.dev_eui || '').trim();
            if (devEui) {
              this.renderPozoPopupChart(devEui, this.slugify(name));
            }
          });

          marker.on('popupclose', () => {
            if (this.popupChart) {
              this.popupChart.dispose();
              this.popupChart = null;
            }
          });
        });
      },
      error: () => {}
    });
  }

  // ─────────────────────────────
  // Red Primaria (GeoJSON)
  // ─────────────────────────────
  loadRedPrimaria() {
    fetch('assets/mapas/red_primaria.geojson')
      .then(res => res.json())
      .then(data => {

        const layer = L.geoJSON(data, {
          style: () => ({
            color: '#2563eb',
            weight: 2,
            opacity: 0.9
          }),
          onEachFeature: (feature, layer) => {
            const name =
              feature.properties?.name ||
              feature.properties?.Name;

            if (name) {
              layer.bindTooltip(name, {
                sticky: true,
                opacity: 0.9
              });
            }
          }
        });

        layer.addTo(this.redPrimariaLayer);

        console.log(
          'Red primaria cargada:',
          this.redPrimariaLayer.getLayers().length
        );
      });
  }

  // ─────────────────────────────
  // Municipios (GeoJSON)
  // ─────────────────────────────
  loadMunicipios() {

  // ─────────────────────────────────────────
  // 1️⃣ OBTENER USUARIO DESDE LOCAL STORAGE
  // ─────────────────────────────────────────
    const userData = localStorage.getItem('scada_user_data');
    const user = userData ? JSON.parse(userData) : null;

  // ─────────────────────────────────────────
  // 2️⃣ CARGAR GEOJSON
  // ─────────────────────────────────────────
    fetch('assets/mapas/edomex_municipios.geojson')
      .then(res => res.json())
      .then(data => {

      // limpiar index
      this.municipiosIndex.clear();

      // evitar duplicar layer
      if (this.municipiosLayer) {
        this.map.removeLayer(this.municipiosLayer);
      }

      // ─────────────────────────────────────────
      // 3️⃣ FILTRAR SEGÚN SCOPE
      // ─────────────────────────────────────────
       const municipiosActivos = new Set(
        SITIOS_SOURCES
        .map(s => s.municipioId)
        .filter(id => id > 0)
      );

      let filteredData = {
        ...data,
        features: data.features.filter((f:any) => {

          const municipioId = Number(f.properties.CVE_MUN);

          // SOLO municipios definidos en SOURCE
          if (!municipiosActivos.has(municipioId)) return false;

          // Si usuario municipal → solo su municipio
          if (user?.scope === 'Municipal') {
            return municipioId === Number(user.scope_id);
          }

          // Usuario estatal ve todos los activos
          return true;
        })
      };
      // ─────────────────────────────────────────
      // 4️⃣ CREAR LAYER GEOJSON
      // ─────────────────────────────────────────

     

      this.municipiosLayer = L.geoJSON(filteredData, {
        style: () => ({
          color: '#64748b',
          weight: 1,
          fillColor: '#cbd5e1',
          fillOpacity: 0.12
        }),

        onEachFeature: (feature, layer) => {
          const poly = layer as L.Polygon;
          const nombre =
            feature.properties?.NOMGEO ||
            feature.properties?.nombre;
          const municipioId = Number(feature.properties?.CVE_MUN);
          const tienePozo = MUNICIPIOS_CON_POZO.has(municipioId);
          if(nombre){
            const key = this.normalizeKey(nombre);
            this.municipiosIndex.set(key, poly);
            if(tienePozo){
              poly.bindTooltip(nombre, { opacity: 0.9 });

              // Popup con botón "Ver detalle"
              poly.bindPopup(
                () => this.buildMunicipioPopup(nombre, municipioId),
                { minWidth: 280, maxWidth: 300 }
              );

              poly.on('popupopen', (e: any) => {
                const popupEl = e.popup.getElement() as HTMLElement;
                if (!popupEl) return;
                const btn = popupEl.querySelector('.scada-popup-btn') as HTMLButtonElement;
                if (!btn) return;
                btn.onclick = (ev: MouseEvent) => {
                  ev.stopPropagation();
                  const url = btn.getAttribute('data-url');
                  if (url) this.router.navigateByUrl(url);
                };
                // Render mini chart
                this.renderPopupChart(municipioId);
              });

              poly.on('popupclose', () => {
                if (this.popupChart) {
                  this.popupChart.dispose();
                  this.popupChart = null;
                }
              });

              // Hover effect (sin rebindear tooltip ni bringToFront)
              poly.on('mouseover', () => {
                poly.setStyle({ weight: 2, color: '#334155', fillOpacity: 0.35 });
                poly.openTooltip();
              });
              poly.on('mouseout', () => {
                this.municipiosLayer.resetStyle(poly);
                poly.closeTooltip();
              });

          } else {
            poly.bindTooltip(nombre, { sticky: true, opacity: 0.85 });

            // Hover effect for non-pozo polygons
            layer.on({
              mouseover: (e: any) => {
                e.target.setStyle({ weight: 2, color: '#334155', fillOpacity: 0.35 });
                e.target.bringToFront();
                e.target.openTooltip();
              },
              mouseout: (e: any) => {
                this.municipiosLayer.resetStyle(e.target);
                e.target.closeTooltip();
              }
            });
          }
        }
        }
      }).addTo(this.map);

      const bounds = this.municipiosLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, {
          padding: [80, 80],
          maxZoom: 11
        });
      }

      // ─────────────────────────────────────────
      // 5️⃣ AUTO ZOOM + BLOQUEO MUNICIPAL
      // ─────────────────────────────────────────
      if(user?.scope === 'Municipal') {
        const bounds = this.municipiosLayer.getBounds();
        if(bounds.isValid()){
          this.map.fitBounds(bounds, {
            padding: [40,40],
            maxZoom: 12
          });
          this.map.setMaxBounds(bounds);
          this.map.options.maxBoundsViscosity = 1.0;
        }
      }
    });
}

  // ─────────────────────────────
  // Red Secundaria (GeoJSON)
  // ─────────────────────────────
  loadRedSecundaria() {
    fetch('assets/mapas/red_secundaria.geojson')
      .then(res => res.json())
      .then(data => {
        const layer = L.geoJSON(data, {
          style: () => ({
            color: '#16a34a',
            weight: 1,
            opacity: 0.85
          }),
          onEachFeature: (feature, layer) => {
            const name =
              feature.properties?.name ||
              feature.properties?.Name;
            if (name) {
              layer.bindTooltip(name, {
                sticky: true,
                opacity: 0.9
              });
            }
          }
        });
        layer.addTo(this.redSecundariaLayer);
        console.log(
          'Red secundaria cargada:',
          this.redSecundariaLayer.getLayers().length
        );
      });
  }

  // ─────────────────────────────
  // Buscador global: Municipio -> Pozo
  // ─────────────────────────────
  searchGlobal(query: string) {
    const q = this.normalizeKey(query);
    if (q.length < 3) return;

    this.municipiosIndex.forEach(poly => {
      poly.setStyle({ fillOpacity: 0.12, weight: 1 });
    });

    const municipioMatch = Array.from(this.municipiosIndex.entries())
      .find(([name]) => name.includes(q));

    if (municipioMatch) {
      const [, poly] = municipioMatch;
      poly.setStyle({ fillOpacity: 0.5, weight: 3 });
      this.map.fitBounds(poly.getBounds(), {
        padding: [30, 30],
        maxZoom: 11
      });
      return;
    }

    const pozoMatch = Array.from(this.markersIndex.entries())
      .find(([name]) => name.includes(q));

    if (!pozoMatch) return;

    const [name, marker] = pozoMatch;

    this.map.flyTo(marker.getLatLng(), 15, { duration: 0.8 });

    this.selectedPozoName = name;
    this.closeAllTooltipsExcept(name);
    marker.openTooltip();
  }

  // ─────────────────────────────
  // Capas operativas: estilos por grupo
  // ─────────────────────────────
  private styleRedPrimaria(layer: any) {
    layer.setStyle?.({
      color: '#2563eb',
      weight: 4,
      opacity: 0.9
    });

    const name = layer.feature?.properties?.name || layer.feature?.properties?.Name;
    if (name) layer.bindTooltip(name, { sticky: true, opacity: 0.9 });

    layer.addTo(this.redPrimariaLayer);
  }

  private styleRedSecundaria(layer: any) {
    layer.setStyle?.({
      color: '#16a34a',
      weight: 3,
      opacity: 0.85
    });

    const name = layer.feature?.properties?.name || layer.feature?.properties?.Name;
    if (name) layer.bindTooltip(name, { sticky: true, opacity: 0.9 });

    layer.addTo(this.redSecundariaLayer);
  }

  private styleZona(layer: any) {
    layer.setStyle?.({
      color: '#f59e0b',
      weight: 2,
      fillOpacity: 0.15
    });

    const name = layer.feature?.properties?.name || layer.feature?.properties?.Name;
    if (name) layer.bindTooltip(name, { sticky: true, opacity: 0.9 });

    layer.addTo(this.zonasLayer);
  }

  private styleAndAddLayerLegacy(layer: any) {
    const geomType = layer.feature?.geometry?.type;

    if (geomType?.includes('Line')) {
      layer.setStyle?.({ color: '#2563eb', weight: 3, opacity: 0.85 });
    }

    if (geomType?.includes('Polygon')) {
      layer.setStyle?.({ color: '#0f766e', weight: 2, fillOpacity: 0.2 });
    }

    const name = layer.feature?.properties?.name || layer.feature?.properties?.Name;
    if (name) layer.bindTooltip(name, { sticky: true, opacity: 0.9 });

    layer.addTo(this.capasLayer);
  }

  // ─────────────────────────────
  // Init
  // ─────────────────────────────
  ngOnInit(): void {

    // Fix Leaflet default icon path (prevents 404 on marker-shadow.png)
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: 'assets/icons/map/well.svg',
      shadowUrl: '',
    });

    // 1) Mapa base
    this.map = L.map('map').setView([19.3, -99.6], 8);

    // --- Base layers ---
    const isDark = this.themeService.resolved() === 'dark';
    const cartoUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const cartoLayer = L.tileLayer(cartoUrl, { subdomains: 'abcd', maxZoom: 19 });
    const satelliteLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Esri' }
    );
    const terrainLayer = L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      { maxZoom: 17, attribution: 'OpenTopoMap' }
    );

    this.tileLayer = cartoLayer;
    this.activeBaseKey = 'mapa';
    this.baseLayers = { mapa: cartoLayer, satelite: satelliteLayer, terreno: terrainLayer };
    cartoLayer.addTo(this.map);

    // Track which base layer the user selects
    this.map.on('baselayerchange', (e: any) => {
      if (e.layer === cartoLayer) this.activeBaseKey = 'mapa';
      else if (e.layer === satelliteLayer) this.activeBaseKey = 'satelite';
      else if (e.layer === terrainLayer) this.activeBaseKey = 'terreno';
      this.tileLayer = e.layer;
    });

    this.setupIconScalingByZoom();

    // 2) LayerGroups (contenedores)
    this.pozosLayer.addTo(this.map);
    this.pozosActivosLayer.addTo(this.map);
    this.pozosObraLayer.addTo(this.map);
    this.pozosInactivosLayer.addTo(this.map);

    // 3) Control de capas
    this.layersControl = L.control.layers(
  {
    'Mapa': cartoLayer,
    'Satélite': satelliteLayer,
    'Terreno': terrainLayer,
  },
  {
    '<span class="layer-label"><span class="legend-dot blue"></span> Sitios activos</span>':
      this.pozosActivosLayer,

    '<span class="layer-label"><span class="legend-dot yellow"></span> Sitios en obra</span>':
      this.pozosObraLayer,

    '<span class="layer-label"><span class="legend-dot gray"></span> Sitios inactivos</span>':
      this.pozosInactivosLayer,

    '<span class="layer-label"><img src="assets/icons/red-primaria.svg" width="20 "> Red primaria</span>':
      this.redPrimariaLayer,

    '<span class="layer-label"><img src="assets/icons/red-secundaria.svg" width="20 "> Red secundaria</span>':
      this.redSecundariaLayer,

    '<span class="layer-label"><img src="assets/icons/zonas.svg" width="20 "> Zonas</span>':
      this.zonasLayer
  },
  { collapsed: false }
).addTo(this.map);

    // ─────────────────────────────────────────────────────────────────────────
    // 1) OBTENER IDENTIDAD Y ALCANCE (GEOGRAPHIC SCOPE) — before loading assets
    // ─────────────────────────────────────────────────────────────────────────
    const userData = localStorage.getItem('scada_user_data');
    const user = userData ? JSON.parse(userData) : null;
    const isMunicipal = user?.scope === 'Municipal';

    console.group('>>> [SCADA DEBUG] GIS Hierarchical Filter');
    console.log('User Identity:', user?.full_name);
    console.log('User Scope:', user?.scope);
    console.log('State ID (estado_id):', user?.estado_id);
    console.log('Target ID (scope_id):', user?.scope_id);
    console.groupEnd();

    // 4) GeoJSON / overlays — conditional loading based on scope
    this.loadMunicipios();
    this.loadApiSitesCache(); // Always cache API sites for dynamic popups
    this.loadGeoServerLayers(); // Load WMS layers from GeoServer
    if (!isMunicipal) {
      // State-level overlays: skip for Municipal users (saves ~4MB + 60s)
      this.buildGastoByMunicipio();
      this.loadRedPrimaria();
      this.loadRedSecundaria();
    }

    // Mantener pozos al frente si prenden municipios
    this.map.on('overlayadd', (e: any) => {
      if (e?.name === 'Municipios') {
        [this.pozosActivosLayer, this.pozosObraLayer, this.pozosInactivosLayer]
          .forEach(group => {
            group.eachLayer((l:any)=>{
              if (l instanceof L.Marker) this.applyIconScaleToMarker(l);
            });
          });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2) LÓGICA DE FILTRADO JERÁRQUICO
    // ─────────────────────────────────────────────────────────────────────────
    let filteredSources: GisSource[] = [];

    if (!user || user.scope === 'Federal' || user.scope === 'ALL') {
      // NIVEL 1: Federal - Carga total de infraestructura
      console.log('[GIS] Access: FEDERAL. Loading all sources.');
      filteredSources = SITIOS_SOURCES;
    } 
    else if (user.scope === 'Estatal') {
      // NIVEL 2: Estatal - Filtra todos los municipios del estado (ej. Edomex ID 15)
      // Default to 15 (Estado de Mexico) if estado_id is missing — OCAVM only operates in EdoMex
      const estadoId = user.estado_id || 15;
      console.log(`[GIS] Access: ESTATAL (ID: ${estadoId}). Filtering by State.`);
      filteredSources = SITIOS_SOURCES.filter(src => src.estadoId === estadoId);
    } 
    else if (user.scope === 'Municipal') {
      // NIVEL 3: Municipal - Restricción total al scope_id (ej. Ecatepec ID 34)
      console.log(`[GIS] Access: MUNICIPAL (ID: ${user.scope_id}). Single municipality view.`);
      filteredSources = SITIOS_SOURCES.filter(src => src.municipioId === user.scope_id);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3) EJECUCIÓN DE CARGA Y AUTO-ZOOM
    // ─────────────────────────────────────────────────────────────────────────

    // Immediate zoom to approximate scope while KMLs load
    if (user?.scope === 'Municipal') {
      this.map.setView([19.40, -98.95], 12);
    } else if (user?.scope === 'Estatal') {
      this.map.setView([19.35, -99.05], 10);
    }
    // Federal keeps default view ([19.3, -99.6], 8)

    // Load KMLs and fitBounds once all are ready
    let loadedCount = 0;
    const totalSources = filteredSources.length;
    const allBounds = L.latLngBounds([]);

    if (totalSources === 0) {
      // No KML sources — still load dynamic markers from API
      this.addDynamicSiteMarkers();
      this.mapLoading.set(false);
    } else {
      filteredSources.forEach(src => {
        this.loadSitiosKml(src.path, (layerBounds) => {
          if (layerBounds?.isValid()) allBounds.extend(layerBounds);
          loadedCount++;
          if (loadedCount === totalSources) {
            if (allBounds.isValid()) {
              this.map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 14 });
            }
            // Add markers for inventory sites not already placed by KML
            this.addDynamicSiteMarkers();
            this.mapLoading.set(false);
          }
        });
      });
    }

    // ─────────────────────────────
    // 🟦 KML DE CAPAS (skip for Municipal — state-level infrastructure)
    // ─────────────────────────────
    if (isMunicipal) return; // Municipal users only need their KML + municipio border
    fetch('assets/mapas/4PT/capas.kml')
      .then(res => res.text())
      .then(kmlText => {

        const url = URL.createObjectURL(
          new Blob([kmlText], { type: 'text/xml' })
        );

        const capasKml = omnivore.kml(url);

        capasKml.on('ready', () => {

          capasKml.eachLayer((layer: any) => {

            // MultiGeometry
            if (layer.getLayers && typeof layer.getLayers === 'function') {
              layer.getLayers().forEach((sub: any) => this.routeCapaOperativa(sub));
              return;
            }

            this.routeCapaOperativa(layer);
          });

          URL.revokeObjectURL(url);
        });
      });
  }

  


  private routeCapaOperativa(layer: any) {
    const nameRaw =
      layer.feature?.properties?.name ||
      layer.feature?.properties?.Name ||
      '';

    const name = (nameRaw || '').toUpperCase();
    const geomType = layer.feature?.geometry?.type || '';

    // ───── RED PRIMARIA
    if (name.includes('PRIMARIA') || name.includes('TRONCAL')) {
      this.styleRedPrimaria(layer);
      return;
    }

    // ───── RED SECUNDARIA
    if (name.includes('SECUNDARIA') || name.includes('RAMAL')) {
      this.styleRedSecundaria(layer);
      return;
    }

    // ───── ZONAS (por polígonos, o por nombre)
    if (geomType.includes('Polygon') || name.includes('ZONA') || name.includes('SECTOR')) {
      this.styleZona(layer);
      return;
    }

    // ───── FALLBACK (legacy)
    this.styleAndAddLayerLegacy(layer);
  }

  private renderPopupChart(municipioId: number) {
    // Dispose previous popup chart if any
    if (this.popupChart) {
      this.popupChart.dispose();
      this.popupChart = null;
    }

    const gen = ++this.popupChartGeneration;

    const el = document.getElementById(`popup-chart-${municipioId}`);
    if (!el) return;

    // If cached, render immediately
    const cached = this.municipioChartCache.get(municipioId);
    if (cached) {
      this.drawMiniChart(el, cached);
      return;
    }

    // Build devEUI list for this municipality
    const wells: string[] = [];
    Object.values(POZOS_DATA as any).forEach((pozo: any) => {
      const munId = Number(pozo?.municipioId ?? pozo?.CVE_MUN);
      if (munId !== municipioId) return;
      if ((pozo?.estatus || '').toLowerCase() !== 'activo') return;
      const devEui = (pozo?.devEui || '').trim();
      if (devEui) wells.push(devEui);
    });

    if (wells.length === 0) {
      el.innerHTML = '<div class="scada-popup-chart-empty">Sin pozos activos</div>';
      return;
    }

    // Fetch last 24h for all wells
    const requests: Record<string, any> = {};
    wells.forEach((devEUI, i) => {
      requests[`w${i}`] = this.telemetryService.getHistory(devEUI, 'caudal_lts', '-24h', {});
    });

    forkJoin(requests).subscribe({
      next: (res: any) => {
        if (gen !== this.popupChartGeneration) return; // stale response, skip
        // Aggregate: sum flows per timestamp bucket
        const buckets = new Map<number, number>();
        for (const data of Object.values(res) as any[]) {
          (data.data || []).forEach((p: any) => {
            const ts = new Date(p.timestamp).getTime();
            const v = p.value != null && p.value > 0.01 ? p.value : 0;
            buckets.set(ts, (buckets.get(ts) || 0) + v);
          });
        }

        const sorted = Array.from(buckets.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([ts, v]): [number, number | null] => [ts, v > 0.01 ? Math.round(v * 100) / 100 : null]);

        this.municipioChartCache.set(municipioId, sorted);

        // Check element still exists (popup might have closed)
        const chartEl = document.getElementById(`popup-chart-${municipioId}`);
        if (chartEl) this.drawMiniChart(chartEl, sorted);
      },
      error: () => {
        if (el) el.innerHTML = '<div class="scada-popup-chart-empty">Error al cargar</div>';
      }
    });
  }

  private renderPozoPopupChart(devEui: string, slug: string) {
    if (this.popupChart) {
      this.popupChart.dispose();
      this.popupChart = null;
    }

    const gen = ++this.popupChartGeneration;

    const el = document.getElementById(`popup-chart-pozo-${slug}`);
    if (!el) return;

    const cached = this.pozoChartCache.get(devEui);
    if (cached) {
      this.drawPozoMiniChart(el, cached);
      return;
    }

    forkJoin({
      caudal: this.telemetryService.getHistory(devEui, 'caudal_lts', '-24h', {}),
      presion: this.telemetryService.getHistory(devEui, 'presion_kg', '-24h', {})
    }).subscribe({
      next: (res: any) => {
        if (gen !== this.popupChartGeneration) return; // stale response, skip
        const toSorted = (raw: any[], floor: boolean) =>
          (raw || [])
            .map((p: any): [number, number | null] => {
              const ts = new Date(p.timestamp).getTime();
              const v = p.value;
              return [ts, v != null && (!floor || v > 0.01) ? Math.round(v * 100) / 100 : null];
            })
            .sort((a: any, b: any) => a[0] - b[0]);

        const result = {
          caudal: toSorted(res.caudal?.data, true),
          presion: toSorted(res.presion?.data, false)
        };

        this.pozoChartCache.set(devEui, result as any);
        const chartEl = document.getElementById(`popup-chart-pozo-${slug}`);
        if (chartEl) this.drawPozoMiniChart(chartEl, result as any);
      },
      error: () => {
        if (el) el.innerHTML = '<div class="scada-popup-chart-empty">Error al cargar</div>';
      }
    });
  }

  private drawPozoMiniChart(el: HTMLElement, data: any) {
    el.innerHTML = '';
    const caudal = data.caudal || data;
    const presion = data.presion || [];

    if ((!Array.isArray(caudal) || caudal.length === 0) && presion.length === 0) {
      el.innerHTML = '<div class="scada-popup-chart-empty">Sin datos</div>';
      return;
    }

    if (this.popupChart) { this.popupChart.dispose(); this.popupChart = null; }
    this.popupChart = echarts.init(el);

    const series: any[] = [];
    const yAxis: any[] = [];

    if (caudal.length > 0) {
      yAxis.push({ type: 'value', show: false, scale: true });
      series.push({
        type: 'line', data: Array.isArray(caudal) ? caudal : [], yAxisIndex: 0,
        showSymbol: false, smooth: true,
        lineStyle: { width: 1.5, color: '#007bff' },
        areaStyle: { color: 'rgba(0,123,255,0.12)' },
        connectNulls: false
      });
    }

    if (presion.length > 0) {
      yAxis.push({ type: 'value', show: false, scale: true });
      series.push({
        type: 'line', data: presion, yAxisIndex: yAxis.length - 1,
        showSymbol: false, smooth: true,
        lineStyle: { width: 1.2, color: '#28a745', type: 'dashed' },
        connectNulls: false
      });
    }

    this.popupChart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 4, right: 4, top: 8, bottom: 4 },
      xAxis: { type: 'time', show: false },
      yAxis,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const d = new Date(params[0].value[0]);
          const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          let html = `<div style="margin-bottom:4px;color:#94a3b8">${time}</div>`;
          for (const p of params) {
            const val = p.value[1] != null ? Number(p.value[1]).toFixed(1) : '—';
            const label = p.seriesIndex === 0 ? 'Caudal' : 'Presión';
            const unit = p.seriesIndex === 0 ? 'L/s' : 'Kg/cm²';
            html += `<div style="display:flex;gap:4px;align-items:center">`;
            html += `<span style="width:6px;height:6px;border-radius:50%;background:${p.color}"></span>`;
            html += `<span style="color:#cbd5e1">${label}:</span>`;
            html += `<b style="color:#f1f5f9">${val} ${unit}</b></div>`;
          }
          return html;
        }
      },
      series
    });
  }

  private drawMiniChart(el: HTMLElement, data: [number, number | null][]) {
    el.innerHTML = '';
    if (data.length === 0) {
      el.innerHTML = '<div class="scada-popup-chart-empty">Sin datos</div>';
      return;
    }

    const c = getEChartsColors(this.themeService.resolved());
    this.popupChart = echarts.init(el);

    this.popupChart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 4, right: 4, top: 8, bottom: 4 },
      xAxis: { type: 'time', show: false },
      yAxis: { type: 'value', show: false, scale: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 11 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          if (!p?.value) return '';
          const d = new Date(p.value[0]);
          const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          const val = p.value[1] != null ? Number(p.value[1]).toFixed(1) : '—';
          return `<b>${val} L/s</b><br/>${time}`;
        }
      },
      series: [{
        type: 'line',
        data,
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 1.5, color: '#007bff' },
        areaStyle: { color: 'rgba(0,123,255,0.15)' },
        connectNulls: false
      }]
    });
  }

  ngOnDestroy() {
    if (this.popupChart) {
      this.popupChart.dispose();
      this.popupChart = null;
    }
  }

  goToOverview() {
    this.router.navigate(['/gerencia/overview-gastos']);
  }
}
