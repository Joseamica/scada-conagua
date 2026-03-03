import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import * as L from 'leaflet';
import * as omnivore from 'leaflet-omnivore';
import { HeaderBarComponent } from '../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../layout/footer-tabs/footer-tabs';
import { POZOS_DATA } from '../pozos/pozos-data';
import { POZOS_LAYOUT } from '../pozos/pozos-layout';
import { POZO_NAME_TO_ID } from '../../core/stores/pozo-name.map';
import { PozosStore } from '../../core/stores/pozos.store';
import { TelemetryService } from '../../core/services/telemetry';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
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
  imports: [HeaderBarComponent, FooterTabsComponent,NgIconComponent],
  providers: [
    provideIcons({
      heroPresentationChartLine,
    })
  ],
})

export class ModuloGis implements OnInit {
  map!: L.Map;

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
  private telemetryService = inject(TelemetryService);

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
    return `assets/icons/map/well-gray.svg`;
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
    const pozoId = POZO_NAME_TO_ID[normalized];

    if (!pozoId) {
      return `<strong>${name}</strong>`;
    } 
    const d = POZOS_DATA[pozoId];
    const l = POZOS_LAYOUT[pozoId];

    if (!d) {
      return `<strong>${name}</strong>`;
    }

    const renderHtml = l?.render
    ? `
      <div class="popup-render">
        <img src="assets/renders/pozos/${l.render}" />
      </div>
    `
    : '';

    const detailUrl = `${DETAIL_BASE_URL}/${this.slugify(name)}`;
    return `
      <div class="scada-popup">
        ${renderHtml ? `
          <div class="scada-popup-render">
            <img src="assets/pozos/${l.render}" alt="${d.nombre}" />
          </div>
        ` : ''}

          <div class="scada-popup-header">
            ${d.nombre}
          </div>

          <div class="scada-popup-metrics">
            <div class="metric">
              <span>Latitud:</span>
              <b>${d.lat}</b>
            </div>
            <div class="metric">
              <span>Longitud:</span>
              <b>${d.lng}</b>
            </div>
          </div>

          <div class="scada-popup-meta">
            <div><b>Estatus:</b> ${d.estatus}</div>
          </div>
          <div class="scada-popup-meta">
            <div><b>Proveedor:</b> ${d.proveedor}</div>
          </div>
          <button
            class="scada-popup-btn"
            data-url="${detailUrl}"
          >
            Ver isométrico →
          </button>
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

        <button class="scada-popup-btn" data-url="${detailUrl}">
          Ver detalle →
        </button>
      </div>
    `;
  }

  private loadSitiosKml(path: string) {
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

            const data = POZOS_DATA[pozoId]; // 👈 ahora sí existe
            const estado = (data?.estatus || '').toLowerCase().trim();

            // 👇 agregar al layer correcto
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
              this.buildPozoPopup(name),
              { minWidth: 260 }
            );
           marker.on('popupopen', (e: any) => {
              const popupEl = e.popup.getElement() as HTMLElement;
              if (!popupEl) return;

              const btn = popupEl.querySelector(
                '.scada-popup-btn'
              ) as HTMLButtonElement | null;

              if (!btn) return;

              btn.onclick = () => {
                const url = btn.getAttribute('data-url');
                if (url) {
                  this.router.navigateByUrl(url);
                }
              };
            });
          });

          // 🔎 IMPORTANTE: NO hacemos fitBounds por cada KML nuevo
          // (si lo haces, el mapa brinca por cada archivo).
          // Dejamos tu comportamiento global igual (sin romper UX).

          URL.revokeObjectURL(url);

          // asegurar todo al frente
          this.pozosLayer.eachLayer((l: any) => {
            if (l.bringToFront) l.bringToFront();
          });
        });
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
                { minWidth: 260 }
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

    // 1) Mapa base
    this.map = L.map('map').setView([19.3, -99.6], 8);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(this.map);

    this.setupIconScalingByZoom();

    // 2) LayerGroups (contenedores)
    this.pozosLayer.addTo(this.map);
    this.pozosActivosLayer.addTo(this.map);
    this.pozosObraLayer.addTo(this.map);
    this.pozosInactivosLayer.addTo(this.map);
    
    // 3) Control de capas (UNO SOLO)
    

    
    this.layersControl = L.control.layers(
  {},
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

    // 4) GeoJSON / overlays async
    this.buildGastoByMunicipio();
    this.loadMunicipios();
    this.loadRedPrimaria();
    this.loadRedSecundaria();

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
    // 1) OBTENER IDENTIDAD Y ALCANCE (GEOGRAPHIC SCOPE)
    // ─────────────────────────────────────────────────────────────────────────
    const userData = localStorage.getItem('scada_user_data');
    const user = userData ? JSON.parse(userData) : null;

    // 🧪 MECANISMO DE DEBUGGING (Frontend Pro)
    console.group('>>> [SCADA DEBUG] GIS Hierarchical Filter');
    console.log('User Identity:', user?.full_name);
    console.log('User Role:', user?.role);        
    console.log('State ID (estado_id):', user?.estado_id);
    console.log('Target ID (scope_id):', user?.scope_id);
    console.groupEnd();

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
    filteredSources.forEach(src => this.loadSitiosKml(src.path));

    // Auto-zoom inteligente basado en el nivel
    //if (user?.scope === 'Municipal' && user?.scope_id === 34) {
      // Zoom específico para Ecatepec
      //this.map.setView([19.60, -99.03], 12); 
      //} else if (user?.scope === 'Estatal') {
        // Vista general del Estado de México
      //  this.map.setView([19.35, -99.30], 9);
    //}

    // ─────────────────────────────
    // 🟦 KML DE CAPAS (fragmentado)
    // ─────────────────────────────
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

  goToOverview() {
    this.router.navigate(['/gerencia/overview-gastos']);
  }
}
