import { Component, OnInit, OnDestroy, inject, effect, signal, computed, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import * as L from 'leaflet';
import * as omnivore from 'leaflet-omnivore';
import * as echarts from 'echarts';
import * as turf from '@turf/turf';
import { forkJoin } from 'rxjs';
import { DatePipe } from '@angular/common';
import { HeaderBarComponent } from '../../layout/header-bar/header-bar';
import { SidebarNavComponent } from '../../layout/sidebar-nav/sidebar-nav';
import { PozosStore } from '../../core/stores/pozos.store';
import { TelemetryService } from '../../core/services/telemetry';
import { ThemeService } from '../../core/services/theme.service';
import { getEChartsColors } from '../../core/utils/echarts-theme';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner';
import { GisDrawingService } from '../../core/services/gis-drawing.service';
import { GisViewService, GisView, GisViewState } from '../../core/services/gis-view.service';
import { RainService, RainStation } from '../../core/services/rain.service';
import { heroPresentationChartLine } from '@ng-icons/heroicons/outline';


const DETAIL_BASE_URL = '/pozos';
const COMM_LOSS_THRESHOLD_MS = 15 * 60 * 1000;

interface CardSite {
  devEUI: string;
  name: string;
  type: string;
  municipality: string;
  flow: number | null;
  unit: string;
  status: 'ok' | 'no-flow' | 'no-signal' | 'pending' | 'obra';
  signalPct: number | null;
  timestamp: string;
}

type ScadaIconKey = 'well' | 'tank' | 'block_water' | 'rain_gauge' | 'drainage';

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
  rain_gauge: 'rain-gauge.svg',
  drainage: 'drainage.svg'
};

const MUNICIPIOS_CON_POZO = new Set<number>(
  SITIOS_SOURCES
    .filter(s => s.municipioId > 0)
    .map(s => s.municipioId)
);

/** Load markercluster plugin dynamically via script tag (needs window.L to exist first). */
function loadMarkerClusterPlugin(): Promise<boolean> {
  return new Promise((resolve) => {
    const gL = (window as any).L;
    if (!gL) { resolve(false); return; }
    if (gL.markerClusterGroup) { resolve(true); return; } // already loaded
    const script = document.createElement('script');
    script.src = 'assets/js/leaflet.markercluster.js';
    script.onload = () => {
      resolve(typeof gL.markerClusterGroup === 'function');
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/** Load leaflet-rotate plugin dynamically (needs window.L). Must load BEFORE creating map. */
function loadRotatePlugin(): Promise<boolean> {
  return new Promise((resolve) => {
    const gL = (window as any).L;
    if (!gL) { resolve(false); return; }
    if (gL.Map.prototype.setBearing) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'assets/js/leaflet-rotate.js';
    script.onload = () => resolve(typeof gL.Map.prototype.setBearing === 'function');
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/** Load leaflet-heat plugin dynamically (needs window.L). */
function loadHeatPlugin(): Promise<boolean> {
  return new Promise((resolve) => {
    const gL = (window as any).L;
    if (!gL) { resolve(false); return; }
    if (gL.heatLayer) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'assets/js/leaflet-heat.js';
    script.onload = () => resolve(typeof gL.heatLayer === 'function');
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/** Load leaflet-draw plugin dynamically (needs window.L). */
function loadDrawPlugin(): Promise<boolean> {
  return new Promise((resolve) => {
    const gL = (window as any).L;
    if (!gL) { resolve(false); return; }
    if (gL.Draw) { resolve(true); return; }

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/js/leaflet.draw.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'assets/js/leaflet.draw.js';
    script.onload = () => {
      if (typeof gL.Draw === 'object' && gL.drawLocal) {
        // Translate leaflet-draw tooltips to Spanish
        const d = gL.drawLocal.draw;
        d.toolbar.actions = { title: 'Cancelar dibujo', text: 'Cancelar' };
        d.toolbar.finish = { title: 'Terminar dibujo', text: 'Terminar' };
        d.toolbar.undo = { title: 'Eliminar ultimo punto', text: 'Deshacer' };
        d.toolbar.buttons.polyline = 'Dibujar linea';
        d.toolbar.buttons.polygon = 'Dibujar poligono';
        d.toolbar.buttons.rectangle = 'Dibujar rectangulo';
        d.toolbar.buttons.circle = 'Dibujar circulo';
        d.toolbar.buttons.marker = 'Colocar marcador';
        d.handlers.polygon.tooltip = {
          start: 'Click para comenzar a dibujar.',
          cont: 'Click para continuar dibujando.',
          end: 'Click en el primer punto para cerrar el poligono.',
        };
        d.handlers.polyline.tooltip = {
          start: 'Click para comenzar a dibujar.',
          cont: 'Click para continuar dibujando.',
          end: 'Click en el ultimo punto para terminar.',
        };
        d.handlers.polyline.error = '<strong>Error:</strong> los bordes no pueden cruzarse.';
        d.handlers.rectangle.tooltip = { start: 'Click y arrastra para dibujar un rectangulo.' };
        d.handlers.circle.tooltip = { start: 'Click y arrastra para dibujar un circulo.' };
        d.handlers.marker.tooltip = { start: 'Click en el mapa para colocar el marcador.' };
        d.handlers.simpleshape = { tooltip: { end: 'Suelta el mouse para terminar.' } };

        const e = gL.drawLocal.edit;
        e.toolbar.actions.save = { title: 'Guardar cambios', text: 'Guardar' };
        e.toolbar.actions.cancel = { title: 'Cancelar edicion', text: 'Cancelar' };
        e.toolbar.actions.clearAll = { title: 'Limpiar todo', text: 'Limpiar' };
        e.toolbar.buttons.edit = 'Editar geometrias';
        e.toolbar.buttons.editDisabled = 'No hay geometrias para editar';
        e.toolbar.buttons.remove = 'Eliminar geometrias';
        e.toolbar.buttons.removeDisabled = 'No hay geometrias para eliminar';
        e.handlers.edit.tooltip = {
          text: 'Arrastra los vertices para editar.',
          subtext: 'Click en cancelar para deshacer cambios.',
        };
        e.handlers.remove.tooltip = { text: 'Click en una geometria para eliminarla.' };
      }
      resolve(typeof gL.Draw === 'object');
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/** Create a MarkerClusterGroup via the global L (patched by plugin). */
function createClusterGroup(color: string): L.LayerGroup {
  const gL = (window as any).L;
  return gL.markerClusterGroup({
    maxClusterRadius: 55,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    disableClusteringAtZoom: 15,
    animate: true,
    iconCreateFunction: (cluster: any) => {
      const count = cluster.getChildCount();
      const size = count > 50 ? 54 : count > 20 ? 46 : 38;
      const fontSize = count > 99 ? 12 : 14;
      return L.divIcon({
        html: `<div class="scada-cluster" style="--c:${color};width:${size}px;height:${size}px">
                 <span class="scada-cluster-count" style="font-size:${fontSize}px">${count}</span>
               </div>`,
        className: '',
        iconSize: L.point(size, size),
      });
    },
  });
}

@Component({
  selector: 'app-modulo-gis',
  templateUrl: './modulo-gis.html',
  styleUrls: ['./modulo-gis.css'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [HeaderBarComponent, SidebarNavComponent, NgIconComponent, LoadingSpinnerComponent, DatePipe],
  providers: [
    provideIcons({
      heroPresentationChartLine,
    })
  ],
})

export class ModuloGis implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  embed = signal(this.route.snapshot.queryParamMap.get('embed') === '1');
  mapLoading = signal(true);
  map!: L.Map;
  private popupChart: echarts.ECharts | null = null;
  private popupChartGeneration = 0;
  private municipioChartCache = new Map<number, [number, number | null][]>();
  private pozoChartCache = new Map<string, [number, number | null][]>();
  private chartCacheTTL: ReturnType<typeof setInterval> | null = null;
  private static readonly CHART_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // LayerGroups
  capasLayer = L.layerGroup();
  redPrimariaLayer = L.layerGroup();
  redSecundariaLayer = L.layerGroup();
  zonasLayer = L.layerGroup();

  pozosOperandoLayer: L.LayerGroup = L.layerGroup();    // operating (flow > 0)
  pozosSinGastoLayer: L.LayerGroup = L.layerGroup();     // stopped (connected, no flow)
  pozosSinComLayer: L.LayerGroup = L.layerGroup();        // no-signal (COMM LOSS)
  pozosObraLayer: L.LayerGroup = L.layerGroup();
  pozosInactivosLayer: L.LayerGroup = L.layerGroup();
  pozosPendienteLayer: L.LayerGroup = L.layerGroup();

  // Custom layer control state
  layerPanelOpen = signal(window.innerWidth > 640);
  activeBase = signal<'mapa' | 'satelite' | 'terreno'>('mapa');
  layerVisible = signal({
    operando: true,
    sinGasto: true,
    sinCom: true,
    obra: true,
    inactivos: true,
    pendientes: true,
    redPrimaria: false,
    redSecundaria: false,
    zonas: false,
  });
  layerCounts = signal({
    operando: 0, sinGasto: 0, sinCom: 0,
    obra: 0, inactivos: 0, pendientes: 0,
    redPrimaria: 0, redSecundaria: 0, zonas: 0,
  });
  totalSites = signal(0);
  alarmCount = signal(0);

  // Quick filter state
  filterPanelOpen = signal(false);
  filterMunicipio = signal<number>(0); // 0 = all
  filterSiteType = signal<string>(''); // '' = all
  filterMinFlow = signal<number>(0);   // 0 = no filter
  filterOnlyAlarm = signal(false);

  municipioOptions = signal<{ id: number; name: string }[]>([]);

  // View mode: map vs cards
  viewMode = signal<'map' | 'cards'>('map');

  // Sites list for cards view — built from API cache
  cardSites = signal<CardSite[]>([]);


  // GIS Tools
  cursorCoords = signal('');
  activeTool = signal<'none' | 'measure-distance' | 'measure-area' | 'draw-point' | 'draw-line' | 'draw-polygon' | 'edit' | 'delete-shape' | 'buffer'>('none');
  measureResult = signal('');
  liveMeasure = signal('');
  drawnItems: L.FeatureGroup = L.featureGroup();
  private drawControl: any = null;
  private activeDrawHandler: any = null;
  toolsPanelOpen = signal(true);
  queryResults = signal<{ name: string; devEUI: string; status: string; flow: number | null }[]>([]);
  queryPanelOpen = signal(false);

  // Edit/delete mode
  private editHandler: any = null;
  private deleteHandler: any = null;

  // Buffer
  bufferRadius = signal(1); // km
  bufferPanelOpen = signal(false);

  // Saved drawings
  savedDrawings = signal<any[]>([]);
  savedDrawingsPanelOpen = signal(false);
  saveDrawingName = signal('');

  // Share toast
  shareToast = signal(false);
  drawColor = signal('#6d002b');
  colorPickerOpen = signal(false);
  drawColorOptions = ['#6d002b', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#1e293b'];

  // Layer selection + layers panel
  selectedLayer = signal<L.Layer | null>(null);
  layersPanelVisible = signal(false);
  statusLegendOpen = signal(false);
  private globalKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private layerIdCounter = 0;

  // Inline text editing (replaces prompt())
  inlineTextInput = signal<{ latlng: L.LatLng; pixel: { x: number; y: number } } | null>(null);
  inlineTextValue = signal('');
  editingLayerId = signal<number | null>(null);
  editingLayerValue = signal('');

  // Undo/Redo stack for drawn layers (tracks ALL mutations)
  private undoStack: { action: string; layer: L.Layer; meta: any }[] = [];
  private redoStack: { action: string; layer: L.Layer; meta: any }[] = [];
  // Snapshot of latlngs before edit mode (for undo vertex edits)
  private preEditSnapshots = new Map<L.Layer, any>();

  toolHintText = computed(() => {
    const tool = this.activeTool();
    switch (tool) {
      case 'measure-distance': return 'Click para agregar puntos \u00b7 Enter terminar \u00b7 \u2318Z deshacer \u00b7 Esc cancelar';
      case 'measure-area': return 'Click para definir vertices \u00b7 Enter cerrar \u00b7 \u2318Z deshacer \u00b7 Esc cancelar';
      case 'draw-polygon': return 'Click para definir vertices \u00b7 Enter cerrar \u00b7 \u2318Z deshacer \u00b7 Esc cancelar';
      case 'draw-line': return 'Click para agregar puntos \u00b7 Enter terminar \u00b7 \u2318Z deshacer \u00b7 Esc cancelar';
      case 'draw-point': return 'Click en el mapa para colocar el punto \u00b7 Esc cancelar';
      case 'edit': return 'Arrastra vertices para editar \u00b7 Enter guardar \u00b7 Esc cancelar';
      case 'delete-shape': return 'Click en geometria para eliminar \u00b7 Enter confirmar \u00b7 Esc cancelar';
      default: return '';
    }
  });

  // Municipios
  municipiosLayer!: L.GeoJSON;
  // (layersControl removed — custom panel replaces native Leaflet control)

  // Buscador
  municipiosIndex = new Map<string, L.Polygon>();
  markersIndex = new Map<string, L.Marker>();
  selectedPozoName: string | null = null;

  private gastoByMunicipio = new Map<number, number>();
  private apiSitesByName = new Map<string, any>();
  private telemetryService = inject(TelemetryService);
  private themeService = inject(ThemeService);
  private http = inject(HttpClient);
  private gisDrawingService = inject(GisDrawingService);
  private gisViewService = inject(GisViewService);
  private rainService = inject(RainService);
  private tileLayer?: L.TileLayer;
  private geoserverWmsLayers = new Map<string, L.TileLayer.WMS>();
  geoLayers = signal<{ name: string; visible: boolean }[]>([]);
  geoUploading = signal(false);
  isAdmin = signal(false);
  private baseLayers: Record<string, L.TileLayer> = {};
  private activeBaseKey = '';

  // Context menu (name/devEUI are empty string when no marker nearby)
  contextMenu = signal<{ x: number; y: number; name: string; devEUI: string; latlng: L.LatLng } | null>(null);

  // Heatmap
  heatmapVisible = signal(false);
  private heatmapLayer: any = null;

  // Compass / rotation
  mapBearing = signal(0);

  // Keyboard shortcuts panel
  shortcutsPanelOpen = signal(false);

  // GIS Views (social network of saved views)
  gisViews = signal<GisView[]>([]);
  gisViewsPanelOpen = signal(false);
  gisViewsTab = signal<'mine' | 'all'>('mine');
  saveViewName = signal('');
  saveViewDesc = signal('');
  saveViewPublic = signal(false);
  activeViewId = signal<number | null>(null);
  private currentUserId = 0;

  myViews = computed(() => this.gisViews().filter(v => v.user_id === this.currentUserId));

  // True when loading from a shared URL or restoring a view — suppresses all auto-zoom
  private isSharedView = false;

  // Rain stations on map
  rainStationsVisible = signal(false);
  rainStationsCount = signal(0);
  private rainStationsLayer: L.LayerGroup = L.layerGroup();

  // Mini-map
  miniMapVisible = signal(true);
  private miniMapInstance: L.Map | null = null;
  private miniMapRect: L.Rectangle | null = null;
  private miniMapSync: (() => void) | null = null;

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
  // Custom Layer Control
  // ─────────────────────────────
  switchBase(key: 'mapa' | 'satelite' | 'terreno') {
    if (!this.map) return;
    Object.values(this.baseLayers).forEach(l => this.map.removeLayer(l));
    this.baseLayers[key]?.addTo(this.map);
    this.activeBase.set(key);
    this.activeBaseKey = key;
    this.tileLayer = this.baseLayers[key];
  }

  toggleLayer(key: 'operando' | 'sinGasto' | 'sinCom' | 'obra' | 'inactivos' | 'pendientes' | 'redPrimaria' | 'redSecundaria' | 'zonas') {
    const vis = { ...this.layerVisible() };
    vis[key] = !vis[key];
    this.layerVisible.set(vis);

    const layerMap = {
      operando: this.pozosOperandoLayer,
      sinGasto: this.pozosSinGastoLayer,
      sinCom: this.pozosSinComLayer,
      obra: this.pozosObraLayer,
      inactivos: this.pozosInactivosLayer,
      pendientes: this.pozosPendienteLayer,
      redPrimaria: this.redPrimariaLayer,
      redSecundaria: this.redSecundariaLayer,
      zonas: this.zonasLayer,
    };
    const layer = layerMap[key];
    if (!layer) return;
    if (vis[key]) {
      layer.addTo(this.map);
    } else {
      this.map.removeLayer(layer);
    }
  }

  toggleActivos() {
    const vis = this.layerVisible();
    const allOn = vis.operando && vis.sinGasto && vis.sinCom;
    const newState = !allOn;
    this.layerVisible.set({ ...vis, operando: newState, sinGasto: newState, sinCom: newState });
    const layers = [
      { layer: this.pozosOperandoLayer, key: 'operando' as const },
      { layer: this.pozosSinGastoLayer, key: 'sinGasto' as const },
      { layer: this.pozosSinComLayer, key: 'sinCom' as const },
    ];
    for (const { layer } of layers) {
      if (newState) layer.addTo(this.map);
      else this.map.removeLayer(layer);
    }
  }

  get activosAllChecked(): boolean {
    const v = this.layerVisible();
    return v.operando && v.sinGasto && v.sinCom;
  }

  get activosCount(): number {
    const c = this.layerCounts();
    return c.operando + c.sinGasto + c.sinCom;
  }

  refreshLayerCounts() {
    this.layerCounts.set({
      operando: this.pozosOperandoLayer.getLayers().length,
      sinGasto: this.pozosSinGastoLayer.getLayers().length,
      sinCom: this.pozosSinComLayer.getLayers().length,
      obra: this.pozosObraLayer.getLayers().length,
      inactivos: this.pozosInactivosLayer.getLayers().length,
      pendientes: this.pozosPendienteLayer.getLayers().length,
      redPrimaria: this.redPrimariaLayer.getLayers().length,
      redSecundaria: this.redSecundariaLayer.getLayers().length,
      zonas: this.zonasLayer.getLayers().length,
    });
    const c = this.layerCounts();
    this.totalSites.set(c.operando + c.sinGasto + c.sinCom + c.obra + c.inactivos + c.pendientes);
    this.refreshAlarmCount();
    this.buildMunicipioOptions();
  }

  private refreshAlarmCount() {
    let count = 0;
    [this.pozosOperandoLayer, this.pozosSinGastoLayer, this.pozosSinComLayer, this.pozosObraLayer, this.pozosInactivosLayer].forEach(group => {
      group.eachLayer((l: any) => {
        if (l instanceof L.Marker && (l as any).__scadaOpState === 'no-signal') {
          count++;
        }
      });
    });
    this.alarmCount.set(count);
  }

  // ─────────────────────────────
  // Quick Filter
  // ─────────────────────────────
  // Stash filtered-out markers so we can restore them
  private filteredOutMarkers: { marker: L.Marker; group: L.LayerGroup }[] = [];

  applyFilters() {
    const mun = this.filterMunicipio();
    const sType = this.filterSiteType();
    const minFlow = this.filterMinFlow();
    const onlyAlarm = this.filterOnlyAlarm();
    const hasFilter = mun > 0 || sType !== '' || minFlow > 0 || onlyAlarm;

    // 1. Restore previously filtered-out markers
    for (const { marker, group } of this.filteredOutMarkers) {
      if (!group.hasLayer(marker)) group.addLayer(marker);
      marker.setOpacity(1);
    }
    this.filteredOutMarkers = [];

    if (!hasFilter) {
      this.refreshLayerCounts();
      return;
    }

    // 2. Remove non-matching markers from their cluster groups
    const groups = [this.pozosOperandoLayer, this.pozosSinGastoLayer, this.pozosSinComLayer, this.pozosObraLayer, this.pozosInactivosLayer, this.pozosPendienteLayer];
    for (const group of groups) {
      const toRemove: L.Marker[] = [];
      group.eachLayer((l: any) => {
        if (!(l instanceof L.Marker)) return;
        let visible = true;
        if (mun > 0 && (l as any).__scadaMunicipioId !== mun) visible = false;
        if (sType && (l as any).__scadaSiteType !== sType) visible = false;
        if (minFlow > 0 && ((l as any).__scadaFlow || 0) < minFlow) visible = false;
        if (onlyAlarm && (l as any).__scadaOpState !== 'no-signal') visible = false;
        if (!visible) toRemove.push(l);
      });
      for (const m of toRemove) {
        group.removeLayer(m);
        this.filteredOutMarkers.push({ marker: m, group });
      }
    }

    this.refreshLayerCounts();
  }

  clearFilters() {
    this.filterMunicipio.set(0);
    this.filterSiteType.set('');
    this.filterMinFlow.set(0);
    this.filterOnlyAlarm.set(false);
    this.applyFilters();
  }

  private buildMunicipioOptions() {
    const seen = new Map<number, string>();
    for (const [, site] of this.apiSitesByName.entries()) {
      const id = site.municipio_id;
      const name = site.municipality;
      if (id && name && !seen.has(id)) seen.set(id, name);
    }
    const opts = Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    this.municipioOptions.set(opts);
  }

  // ─────────────────────────────
  // Helpers
  // ─────────────────────────────
  private inferTypeFromName(name: string, siteType?: string): ScadaIconKey | null {
    // Prefer explicit site_type from DB when available
    if (siteType) {
      const t = siteType.toLowerCase().trim();
      if (t === 'pozo') return 'well';
      if (t === 'pluviometro') return 'rain_gauge';
      if (t === 'drenaje' || t === 'carcamo') return 'drainage';
      if (t === 'tanque' || t === 'estanque') return 'tank';
      if (t === 'agua_bloque') return 'block_water';
    }
    // Fallback: infer from name
    const n = name.toUpperCase();
    if (n.includes('POZO')) return 'well';
    if (n.includes('PLUVIO') || n.includes('PLUVI')) return 'rain_gauge';
    if (n.includes('NIVEL') || n.includes('TANQUE')) return 'tank';
    if (n.includes('AGUA EN BLOQUE')) return 'block_water';
    if (n.includes('CAUDAL') || n.includes('PRESION')) return 'block_water';
    if (n.includes('CARCAMO') || n.includes('CÁRCAMO') || n.includes('DRENAJE')) return 'drainage';
    if (n.includes('RED PRIMARIA') || n.includes('RED SECUNDARIA')) return 'block_water';
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

  /** Cache ALL sites from API — needed for dynamic popup lookup.
   *  Returns a Promise so callers can wait for the cache to be ready. */
  private loadApiSitesCache(): Promise<void> {
    return new Promise((resolve) => {
      this.telemetryService.getSites().subscribe({
        next: (sites) => {
          this.apiSitesByName.clear();
          sites.forEach(site => {
            const key = this.normalizeKey(site.site_name || '');
            if (key) this.apiSitesByName.set(key, site);
          });
          resolve();
        },
        error: () => resolve(), // proceed even on error
      });
    });
  }

  private loadGeoServerLayers() {
    // Check admin status for upload button
    try {
      const userData = localStorage.getItem('scada_user_data');
      const user = userData ? JSON.parse(userData) : null;
      this.isAdmin.set(user?.role_id === 1);
    } catch { /* */ }

    this.http.get<{ wmsUrl: string; layers: { name: string }[] }>('/api/v1/gis/layers').subscribe({
      next: ({ wmsUrl, layers }) => {
        if (!layers?.length) { this.geoLayers.set([]); return; }
        const items: { name: string; visible: boolean }[] = [];
        layers.forEach(layer => {
          const wms = L.tileLayer.wms(wmsUrl, {
            layers: `scada:${layer.name}`,
            format: 'image/png',
            transparent: true,
            version: '1.1.1',
            maxZoom: 19,
            opacity: 0.7,
            styles: '',
            // Throttle requests to avoid 429 from GeoServer
            maxNativeZoom: 16,
            tileSize: 512,
            zoomOffset: -1,
          } as any);
          this.geoserverWmsLayers.set(layer.name, wms);
          items.push({ name: layer.name, visible: false });
        });
        this.geoLayers.set(items);
      },
      error: () => { this.geoLayers.set([]); }
    });
  }

  toggleGeoLayer(name: string) {
    const wms = this.geoserverWmsLayers.get(name);
    if (!wms) return;
    if (this.map.hasLayer(wms)) {
      this.map.removeLayer(wms);
    } else {
      wms.addTo(this.map);
    }
    this.geoLayers.update(layers =>
      layers.map(l => l.name === name ? { ...l, visible: this.map.hasLayer(wms) } : l)
    );
  }

  uploadShapefile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !file.name.endsWith('.zip')) return;

    this.geoUploading.set(true);
    const formData = new FormData();
    formData.append('shapefile', file);
    const layerName = file.name.replace('.zip', '').replace(/[^a-zA-Z0-9_]/g, '_');
    formData.append('layer_name', layerName);

    this.http.post('/api/v1/gis/layers', formData).subscribe({
      next: () => {
        this.geoUploading.set(false);
        this.loadGeoServerLayers(); // Refresh layer list
        (event.target as HTMLInputElement).value = ''; // Reset file input
      },
      error: () => {
        this.geoUploading.set(false);
        (event.target as HTMLInputElement).value = '';
      }
    });
  }

  deleteGeoLayer(name: string) {
    if (!confirm(`¿Eliminar capa "${name}"?`)) return;
    this.http.delete(`/api/v1/gis/layers/${name}`).subscribe({
      next: () => {
        const wms = this.geoserverWmsLayers.get(name);
        if (wms && this.map.hasLayer(wms)) this.map.removeLayer(wms);
        this.geoserverWmsLayers.delete(name);
        this.geoLayers.update(layers => layers.filter(l => l.name !== name));
      },
      error: () => {}
    });
  }

  private buildGastoByMunicipio() {
    this.gastoByMunicipio.clear();

    // Use API data with municipio_id — no more POZOS_DATA
    this.telemetryService.getSites().subscribe({
      next: (sites) => {
        // Also update cache from this response
        this.apiSitesByName.clear();
        sites.forEach(site => {
          const key = this.normalizeKey(site.site_name || '');
          if (key) this.apiSitesByName.set(key, site);
        });

        const now = Date.now();
        sites.forEach(site => {
          const munId = site.municipio_id;
          if (!munId || !MUNICIPIOS_CON_POZO.has(munId)) return;
          const flow = Number(site.last_flow_value || 0);
          if (flow <= 0.01) return;
          // Exclude sites without recent communication (COMM LOSS >15 min)
          if (site.last_updated_at) {
            const elapsed = now - new Date(site.last_updated_at).getTime();
            if (elapsed > 15 * 60 * 1000) return;
          } else {
            return; // No telemetry at all
          }
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

  /**
   * Deep-clean a normalized name for fuzzy comparison:
   * - Remove dashes, quotes, parentheses
   * - Strip leading zeros from numbers ("001" → "1", "05" → "5")
   * - Convert trailing Roman numerals to Arabic (II → 2, III → 3)
   * - Collapse whitespace
   */
  private cleanForMatch(s: string): string {
    return s
      .replace(/[-"'()&]/g, ' ')       // remove dashes, quotes, parens, ampersand
      .replace(/&quot;/g, ' ')          // HTML entities in KML
      .replace(/\b0+(\d)/g, '$1')       // strip leading zeros: "001" → "1"
      .replace(/\bIV\b/g, '4')          // Roman → Arabic (before III/II/I to avoid partial)
      .replace(/\bIII\b/g, '3')
      .replace(/\bII\b/g, '2')
      .replace(/\s+I$/g, ' 1')          // trailing " I" → " 1" (only at end to avoid IXTAPALUCA)
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract the site type+number prefix: "POZO 13 CHIMALPA 2" → "POZO 13"
   */
  private extractSiteNumberKey(cleaned: string): string | null {
    const m = cleaned.match(/^(POZO|TANQUE|CARCAMO|CAUDAL|PRESION|PLUVIOMETRO)\s+(\d+)\b/);
    return m ? m[1] + ' ' + m[2] : null;
  }

  /**
   * Lookup an API site by name — exact first, then fuzzy prefix/dash match,
   * then site-number fallback.
   * Caches fuzzy hits in apiSitesByName for O(1) on subsequent lookups.
   */
  private lookupApiSite(name: string): any | undefined {
    const key = this.normalizeKey(name);
    let site = this.apiSitesByName.get(key);
    if (site) return site;

    const cleanKml = this.cleanForMatch(key);
    let bestMatch: any | undefined;
    let bestLen = 0;

    for (const [dbKey, dbSite] of this.apiSitesByName.entries()) {
      const cleanDb = this.cleanForMatch(dbKey);
      // Exact after cleaning (handles dashes, leading zeros, quotes, roman numerals)
      if (cleanKml === cleanDb) {
        bestMatch = dbSite;
        break;
      }
      // DB name is word-boundary prefix of KML name (e.g. "POZO 24" in "POZO 24 IXTAPALUCA")
      if (cleanKml.startsWith(cleanDb + ' ') && cleanDb.length > bestLen) {
        bestMatch = dbSite;
        bestLen = cleanDb.length;
      }
      // KML name is word-boundary prefix of DB name
      if (cleanDb.startsWith(cleanKml + ' ') && cleanKml.length > bestLen) {
        bestMatch = dbSite;
        bestLen = cleanKml.length;
      }
    }

    // Fallback: match by site type+number (e.g. "POZO 13" from "POZO 13 IXTAPALUCA" matches "POZO 13 CHIMALPA 2")
    if (!bestMatch) {
      const kmlNumKey = this.extractSiteNumberKey(cleanKml);
      if (kmlNumKey) {
        for (const [dbKey, dbSite] of this.apiSitesByName.entries()) {
          const dbNumKey = this.extractSiteNumberKey(this.cleanForMatch(dbKey));
          if (dbNumKey === kmlNumKey) {
            bestMatch = dbSite;
            break;
          }
        }
      }
    }

    // Cache fuzzy result for future lookups
    if (bestMatch) {
      this.apiSitesByName.set(key, bestMatch);
    }
    return bestMatch;
  }

  /**
   * Resolve estatus from API cache (DB is the single source of truth).
   */
  private buildMarkerTooltip(name: string, estatus: string, apiSite?: any): string {
    const statusLabels: Record<string, string> = {
      activo: 'Activo', obra: 'En obra', inactivo: 'Inactivo', pendiente: 'Pendiente',
    };
    const statusColors: Record<string, string> = {
      activo: '#3b82f6', obra: '#f59e0b', inactivo: '#ef4444', pendiente: '#94a3b8',
    };
    const label = statusLabels[estatus] || estatus;
    const color = statusColors[estatus] || '#94a3b8';

    // Determine real-time operational state
    const isStale = apiSite ? this.isSiteStale(apiSite) : false;
    const flow = Number(apiSite?.last_flow_value) || 0;
    const pressure = Number(apiSite?.last_pressure_value) || 0;

    let opLabel = '';
    let opColor = '';
    if (estatus === 'activo' && isStale) {
      opLabel = 'Sin comunicacion';
      opColor = '#ef4444';
    } else if (estatus === 'activo' && (flow > 0.01 || pressure > 0)) {
      opLabel = 'Operando';
      opColor = '#059669';
    } else if (estatus === 'activo') {
      opLabel = 'Detenido';
      opColor = '#94a3b8';
    }

    const municipality = apiSite?.municipality
      ? `<div style="font-size:10px;color:#64748b;margin-top:2px">${apiSite.municipality}</div>` : '';

    const opLine = opLabel
      ? `<div style="display:flex;align-items:center;gap:4px;margin-top:1px">`
        + `<span style="font-size:10px;color:${opColor};font-weight:500">${opLabel}</span>`
        + `</div>` : '';

    return `<div style="font-weight:600;font-size:12px">${name}</div>`
      + `<div style="display:flex;align-items:center;gap:4px;margin-top:3px">`
      + `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color}"></span>`
      + `<span style="font-size:11px;color:${color};font-weight:600">${label}</span>`
      + `</div>`
      + opLine
      + municipality;
  }

  private resolveEstatus(name: string): string {
    const apiSite = this.lookupApiSite(name);
    if (apiSite?.estatus) {
      return apiSite.estatus.toLowerCase().trim();
    }
    return 'activo'; // default until API cache loads
  }

  private resolveSiteIconUrl(name: string, siteType?: string): string {
    const type = this.inferTypeFromName(name, siteType) ?? 'well';
    const fileType = type.replaceAll('_', '-');
    const status = this.resolveEstatus(name);

    if (status === 'obra') {
      return `assets/icons/map/${fileType}-yellow.svg`;
    }
    if (status === 'inactivo' || status === 'pendiente') {
      return `assets/icons/map/${fileType}-gray.svg`;
    }
    return `assets/icons/map/${fileType}.svg`;
  }



// ─────────────────────────────
// ✅ NUEVO: Escalado de iconos por zoom
// ─────────────────────────────

// Guarda meta por marker para reconstruir el icono al cambiar zoom
  private setMarkerIconMeta(marker: L.Marker, iconUrl: string, estatus?: string, apiSite?: any) {
    (marker as any).__scadaIconUrl = iconUrl;
    if (estatus) (marker as any).__scadaEstatus = estatus;
    if (apiSite) {
      (marker as any).__scadaMunicipioId = apiSite.municipio_id || 0;
      (marker as any).__scadaSiteType = (apiSite.site_type || '').toLowerCase();
      (marker as any).__scadaFlow = Number(apiSite.last_flow_value) || 0;
    }
  }

  /** Determine operational state for marker visuals */
  private setMarkerOpState(marker: L.Marker, apiSite: any) {
    if (!apiSite) return;
    const estatus = (apiSite.estatus || 'activo').toLowerCase();
    const flow = Number(apiSite.last_flow_value) || 0;
    const pressure = Number(apiSite.last_pressure_value) || 0;

    let opState: 'operating' | 'stopped' | 'no-signal' | 'inactive';
    if (estatus === 'inactivo') {
      opState = 'no-signal';
    } else if (estatus === 'obra' || estatus === 'pendiente') {
      opState = 'inactive';
    } else if (this.isSiteStale(apiSite)) {
      // Activo site that hasn't reported recently → COMM LOSS
      opState = 'no-signal';
    } else if (flow > 0.01 || pressure > 0) {
      opState = 'operating';
    } else {
      opState = 'stopped';
    }
    (marker as any).__scadaOpState = opState;
  }

  /** Returns true if an activo site hasn't reported in over 15 minutes */
  private isSiteStale(apiSite: any): boolean {
    const lastUpdate = apiSite.last_updated_at;
    if (!lastUpdate) return false;
    const ageMs = Date.now() - new Date(lastUpdate).getTime();
    return ageMs > 15 * 60 * 1000; // 15 minutes
  }

  /** Attach live KPI value to a marker for the mini badge overlay */
  private setMarkerKpi(marker: L.Marker, apiSite: any) {
    if (!apiSite) return;
    const flow = apiSite.last_flow_value;
    const pressure = apiSite.last_pressure_value;
    const level = apiSite.last_nivel_value;
    const rain = apiSite.last_lluvia_value;

    if (flow != null && Number(flow) > 0.01) {
      (marker as any).__scadaKpi = `${Number(flow).toFixed(1)} L/s`;
    } else if (pressure != null && Number(pressure) > 0) {
      (marker as any).__scadaKpi = `${Number(pressure).toFixed(1)} kg`;
    } else if (level != null && Number(level) > 0) {
      (marker as any).__scadaKpi = `${Number(level).toFixed(1)} m`;
    } else if (rain != null && Number(rain) > 0) {
      (marker as any).__scadaKpi = `${Number(rain).toFixed(0)} mm`;
    }
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

  /** Fixed base size for all marker icons. CSS zoom-tier classes handle scaling. */
  private static readonly ICON_BASE = 22;
  private static readonly PULSE_BASE = Math.round(22 * 1.8); // 40

  private applyIconScaleToMarker(marker: L.Marker) {
    const iconUrl = (marker as any).__scadaIconUrl as string | undefined;
    if (!iconUrl) return;

    const size = ModuloGis.ICON_BASE;
    const pulseSize = ModuloGis.PULSE_BASE;

    // Clusters handle visibility at low zoom — no manual hide needed
    marker.setOpacity(1);

    const opState = ((marker as any).__scadaOpState as string) || 'inactive';
    const alwaysVisible = (marker as any).__alwaysVisible === true;

    // KPI badge — always rendered; CSS zoom-tier hides at low zoom
    const kpi = ((marker as any).__scadaKpi as string) || '';
    const kpiBadge = kpi
      ? `<span class="mk-kpi">${kpi}</span>`
      : '';

    // No-signal overlay — always rendered; CSS zoom-tier hides at low zoom
    const noSignalOverlay = opState === 'no-signal'
      ? `<span class="mk-nosignal" title="Sin señal">\u26A0</span>`
      : '';

    const alwaysVisibleCls = alwaysVisible ? ' mk-always-visible' : '';

    let html: string;
    if (opState === 'operating') {
      html = `<div class="mk-live mk-op-ok${alwaysVisibleCls}" style="width:${pulseSize}px;height:${pulseSize}px">
           <span class="mk-ring mk-ring-green" style="width:${pulseSize}px;height:${pulseSize}px"></span>
           <img src="${iconUrl}" width="${size}" height="${size}" />
           ${kpiBadge}
         </div>`;
    } else if (opState === 'stopped') {
      html = `<div class="mk-live mk-op-stopped${alwaysVisibleCls}" style="width:${pulseSize}px;height:${pulseSize}px">
           <span class="mk-ring mk-ring-red" style="width:${pulseSize}px;height:${pulseSize}px"></span>
           <img src="${iconUrl}" width="${size}" height="${size}" />
           ${kpiBadge}
         </div>`;
    } else if (opState === 'no-signal') {
      html = `<div class="mk-dead mk-op-nosignal${alwaysVisibleCls}" style="width:${size}px;height:${size}px">
           <img src="${iconUrl}" width="${size}" height="${size}" />
           ${noSignalOverlay}
           ${kpiBadge}
         </div>`;
    } else {
      html = `<div class="mk-dead${alwaysVisibleCls}" style="width:${size}px;height:${size}px">
           <img src="${iconUrl}" width="${size}" height="${size}" />
           ${kpiBadge}
         </div>`;
    }

    marker.setIcon(
      L.divIcon({
        html,
        iconSize: [pulseSize, pulseSize],
        iconAnchor: [pulseSize / 2, pulseSize / 2],
        className: alwaysVisible ? 'scada-marker mk-always-visible' : 'scada-marker',
      })
    );
  }

  /**
   * Sets a CSS zoom-tier class on the map container so that all marker icons
   * are scaled via CSS `transform: scale()` instead of rebuilding every divIcon.
   * Tiers match the old `iconSizeForZoom` breakpoints:
   *   xs (<=8) → 10px → scale 0.45
   *   sm (<=10) → 16px → scale 0.73
   *   md (<=12) → 22px → scale 1    (base — matches ICON_BASE)
   *   lg (<=14) → 30px → scale 1.36
   *   xl (>14)  → 38px → scale 1.73
   */
  private setupIconScalingByZoom() {
    if (!this.map) return;
    const updateZoomTier = () => {
      const container = this.map!.getContainer();
      container.classList.forEach(cls => {
        if (cls.startsWith('zoom-tier-')) container.classList.remove(cls);
      });
      const zoom = this.map!.getZoom();
      let tier: string;
      if (zoom <= 8) tier = 'xs';
      else if (zoom <= 10) tier = 'sm';
      else if (zoom <= 12) tier = 'md';
      else if (zoom <= 14) tier = 'lg';
      else tier = 'xl';
      container.classList.add(`zoom-tier-${tier}`);
    };
    this.map.on('zoomend', updateZoomTier);
    updateZoomTier(); // set initial tier
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
    const apiSite = this.lookupApiSite(name);
    const devEui = (apiSite?.dev_eui || '').trim();
    // Navigate to isometric view using devEUI as slug
    const detailUrl = devEui ? `${DETAIL_BASE_URL}/${devEui}` : '';

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

            const marker = layerItem as L.Marker;
            const normalized = this.normalizeKey(name);
            const estado = this.resolveEstatus(name);

          // Decide icon URL — prefer API site_type if cached
            const cachedSite = this.lookupApiSite(name);
            const iconUrl = this.resolveSiteIconUrl(name, cachedSite?.site_type);
            const estatus = this.resolveEstatus(name);

          // Set meta + KPI + opState FIRST so we can classify into sub-layers
          this.setMarkerIconMeta(marker, iconUrl, estatus, cachedSite);
          this.setMarkerKpi(marker, cachedSite);
          this.setMarkerOpState(marker, cachedSite);

            // Agregar al layer correcto based on opState for activos
            if (estado === 'activo') {
              const opState = (marker as any).__scadaOpState;
              if (opState === 'no-signal') {
                marker.addTo(this.pozosSinComLayer);
              } else if (opState === 'stopped') {
                marker.addTo(this.pozosSinGastoLayer);
              } else {
                marker.addTo(this.pozosOperandoLayer);
              }
            }
            else if (estado === 'obra') {
              marker.addTo(this.pozosObraLayer);
            }
            else if (estado === 'pendiente') {
              marker.addTo(this.pozosPendienteLayer);
            }
            else {
              marker.addTo(this.pozosInactivosLayer);
            }

          this.applyIconScaleToMarker(marker);

            const key = this.normalizeKey(name);
            // Clear old marker listeners to prevent memory leaks on rebuild
            const oldMarker = this.markersIndex.get(key);
            if (oldMarker) oldMarker.off();
            this.markersIndex.set(key, marker);

            const ttSite = this.lookupApiSite(name);
            const ttEstatus = this.resolveEstatus(name);
            marker.bindTooltip(this.buildMarkerTooltip(name, ttEstatus, ttSite), {
              direction: 'top',
              offset: [0, -8],
              opacity: 0.95
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
              const devEui = (this.lookupApiSite(name)?.dev_eui || '').trim();
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

            // Right-click context menu
            this.bindContextMenu(marker, name);
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

          // asegurar markers al frente
          [this.pozosOperandoLayer, this.pozosSinGastoLayer, this.pozosSinComLayer, this.pozosObraLayer, this.pozosInactivosLayer, this.pozosPendienteLayer]
            .forEach(g => g.eachLayer((l: any) => { if (l.bringToFront) l.bringToFront(); }));
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

          // Set meta + KPI + opState FIRST so we can classify into sub-layers
          const iconUrl = this.resolveSiteIconUrl(name, site.site_type);
          this.setMarkerIconMeta(marker, iconUrl, siteEstatus, site);
          this.setMarkerKpi(marker, site);
          this.setMarkerOpState(marker, site);

          let targetLayer: L.LayerGroup;
          if (siteEstatus === 'obra') {
            targetLayer = this.pozosObraLayer;
          } else if (siteEstatus === 'inactivo') {
            targetLayer = this.pozosInactivosLayer;
          } else if (siteEstatus === 'pendiente') {
            targetLayer = this.pozosPendienteLayer;
          } else {
            // activo — classify by opState
            const opState = (marker as any).__scadaOpState;
            if (opState === 'no-signal') {
              targetLayer = this.pozosSinComLayer;
            } else if (opState === 'stopped') {
              targetLayer = this.pozosSinGastoLayer;
            } else {
              targetLayer = this.pozosOperandoLayer;
            }
          }
          marker.addTo(targetLayer);
          this.applyIconScaleToMarker(marker);

          // Clear old marker listeners to prevent memory leaks on rebuild
          const oldMarker = this.markersIndex.get(key);
          if (oldMarker) oldMarker.off();
          this.markersIndex.set(key, marker);

          marker.bindTooltip(this.buildMarkerTooltip(name, siteEstatus, site), {
            direction: 'top',
            offset: [0, -8],
            opacity: 0.95
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

          // Right-click context menu
          this.bindContextMenu(marker, name);
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
            weight: 3,
            opacity: 0.9,
            dashArray: '12 8',
          }),
          onEachFeature: (feature, lyr: any) => {
            const name =
              feature.properties?.name ||
              feature.properties?.Name;

            if (name) {
              lyr.bindTooltip(name, {
                sticky: true,
                opacity: 0.9
              });
            }

            // Add flow animation class once path is rendered
            lyr.on('add', () => {
              if (lyr._path) L.DomUtil.addClass(lyr._path, 'pipe-flow-animated');
            });
          }
        });

        layer.addTo(this.redPrimariaLayer);

      })
      .catch((err) => console.error('GeoJSON load failed:', err));
  }

  // ─────────────────────────────
  // Municipios (GeoJSON)
  // ─────────────────────────────
  loadMunicipios() {

  // ─────────────────────────────────────────
  // 1️⃣ OBTENER USUARIO DESDE LOCAL STORAGE
  // ─────────────────────────────────────────
    let user: any = null;
    try {
      const userData = localStorage.getItem('scada_user_data');
      user = userData ? JSON.parse(userData) : null;
    } catch { /* corrupt localStorage — proceed as unauthenticated */ }

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

      // Auto-zoom to municipios — SKIP if opening a shared URL
      if (!this.isSharedView) {
        const bounds = this.municipiosLayer.getBounds();
        if (bounds.isValid()) {
          if (user?.scope === 'Municipal') {
            // Municipal: zoom to their municipality (initial view only, no lock)
            this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
          } else {
            this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 11 });
          }
        }
      }
      // NOTE: No setMaxBounds — users can freely pan/zoom to explore
    })
    .catch((err) => console.error('GeoJSON load failed:', err));
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
            weight: 2,
            opacity: 0.85,
            dashArray: '10 6',
          }),
          onEachFeature: (feature, lyr: any) => {
            const name =
              feature.properties?.name ||
              feature.properties?.Name;
            if (name) {
              lyr.bindTooltip(name, {
                sticky: true,
                opacity: 0.9
              });
            }

            lyr.on('add', () => {
              if (lyr._path) {
                L.DomUtil.addClass(lyr._path, 'pipe-flow-animated');
                L.DomUtil.addClass(lyr._path, 'pipe-flow--secondary');
              }
            });
          }
        });
        layer.addTo(this.redSecundariaLayer);
      })
      .catch((err) => console.error('GeoJSON load failed:', err));
  }

  // ─────────────────────────────
  // Buscador global: Municipio -> Pozo
  // ─────────────────────────────
  // Search dropdown state
  searchQuery = signal('');
  searchResults = signal<{ type: string; label: string; sub: string; data: any }[]>([]);
  searchDropdownOpen = signal(false);

  searchGlobal(query: string) {
    this.searchQuery.set(query);
    if (!this.map || query.length < 2) {
      this.searchResults.set([]);
      this.searchDropdownOpen.set(false);
      return;
    }

    const q = this.normalizeKey(query);
    const results: { type: string; label: string; sub: string; data: any }[] = [];

    // 1. Municipios
    this.municipiosIndex.forEach((poly, name) => {
      if (name.includes(q)) {
        results.push({ type: 'municipio', label: name, sub: 'Municipio', data: poly });
      }
    });

    // 2. Sitios/Pozos
    let siteCount = 0;
    this.markersIndex.forEach((marker, name) => {
      if (siteCount >= 8) return; // limit
      if (name.includes(q)) {
        const site = this.lookupApiSite(name);
        const mun = site?.municipality || '';
        results.push({ type: 'sitio', label: name, sub: mun, data: { marker, name } });
        siteCount++;
      }
    });

    // 3. Pluviómetros (if loaded)
    if (this.rainStationsVisible()) {
      this.rainStationsLayer.eachLayer((layer: any) => {
        // circleMarkers don't have __siteName, skip
      });
    }

    // 4. Geocoding (address search via Nominatim) — debounced
    if (results.length === 0 && query.length >= 4) {
      this.geocodeSearch(query);
    }

    this.searchResults.set(results);
    this.searchDropdownOpen.set(results.length > 0);
  }

  private geocodeTimeout: any = null;
  private geocodeSearch(query: string) {
    clearTimeout(this.geocodeTimeout);
    this.geocodeTimeout = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Estado de Mexico, Mexico')}&limit=5`)
        .then(r => r.json())
        .then((places: any[]) => {
          if (!places?.length) return;
          const current = this.searchResults();
          const geoResults = places.map((p: any) => ({
            type: 'direccion',
            label: p.display_name.split(',').slice(0, 2).join(', '),
            sub: 'Direccion',
            data: { lat: +p.lat, lng: +p.lon },
          }));
          this.searchResults.set([...current, ...geoResults]);
          this.searchDropdownOpen.set(true);
        })
        .catch(() => {});
    }, 400); // 400ms debounce
  }

  selectSearchResult(result: { type: string; label: string; sub: string; data: any }) {
    this.searchDropdownOpen.set(false);

    if (result.type === 'municipio') {
      const poly = result.data;
      this.municipiosIndex.forEach(p => p.setStyle({ fillOpacity: 0.12, weight: 1 }));
      poly.setStyle({ fillOpacity: 0.5, weight: 3 });
      this.map.fitBounds(poly.getBounds(), { padding: [30, 30], maxZoom: 12 });
    } else if (result.type === 'sitio') {
      const { marker, name } = result.data;
      this.map.flyTo(marker.getLatLng(), 15, { duration: 0.8 });
      this.selectedPozoName = name;
      this.closeAllTooltipsExcept(name);
      marker.openTooltip();
    } else if (result.type === 'direccion') {
      const { lat, lng } = result.data;
      this.map.flyTo([lat, lng], 15, { duration: 0.8 });
    }
  }

  closeSearchDropdown() {
    setTimeout(() => this.searchDropdownOpen.set(false), 200);
  }

  // ─────────────────────────────
  // Capas operativas: estilos por grupo
  // ─────────────────────────────
  private styleRedPrimaria(layer: any) {
    layer.setStyle?.({
      color: '#2563eb',
      weight: 4,
      opacity: 0.9,
      dashArray: '12 8',
    });

    // Add flow animation class to SVG path after it's rendered
    if (layer._path) {
      L.DomUtil.addClass(layer._path, 'pipe-flow-animated');
    } else {
      layer.on?.('add', () => {
        if (layer._path) L.DomUtil.addClass(layer._path, 'pipe-flow-animated');
      });
    }

    const name = layer.feature?.properties?.name || layer.feature?.properties?.Name;
    if (name) layer.bindTooltip(name, { sticky: true, opacity: 0.9 });

    layer.addTo(this.redPrimariaLayer);
  }

  private styleRedSecundaria(layer: any) {
    layer.setStyle?.({
      color: '#16a34a',
      weight: 3,
      opacity: 0.85,
      dashArray: '10 6',
    });

    // Add flow animation class to SVG path after it's rendered
    if (layer._path) {
      L.DomUtil.addClass(layer._path, 'pipe-flow-animated');
      L.DomUtil.addClass(layer._path, 'pipe-flow--secondary');
    } else {
      layer.on?.('add', () => {
        if (layer._path) {
          L.DomUtil.addClass(layer._path, 'pipe-flow-animated');
          L.DomUtil.addClass(layer._path, 'pipe-flow--secondary');
        }
      });
    }

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
  async ngOnInit(): Promise<void> {

    // Fix Leaflet default icon path — both ES module L and global window.L
    const iconFix = { iconUrl: 'assets/icons/map/well.svg', iconRetinaUrl: 'assets/icons/map/well.svg', shadowUrl: '', shadowRetinaUrl: '' };
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions(iconFix);
    const gL = (window as any).L;
    if (gL?.Icon?.Default) {
      delete gL.Icon.Default.prototype._getIconUrl;
      gL.Icon.Default.mergeOptions(iconFix);
    }

    // Load MarkerCluster plugin — must happen before creating layers
    // Load rotate FIRST (patches L.Map), then others in parallel
    await loadRotatePlugin();
    const [clusterOk] = await Promise.all([loadMarkerClusterPlugin(), loadDrawPlugin(), loadHeatPlugin()]);
    if (clusterOk) {
      this.pozosOperandoLayer = createClusterGroup('#3b82f6');   // blue
      this.pozosSinGastoLayer = createClusterGroup('#f59e0b');   // amber
      this.pozosSinComLayer = createClusterGroup('#ef4444');      // red
      this.pozosObraLayer = createClusterGroup('#f59e0b');
      this.pozosInactivosLayer = createClusterGroup('#ef4444');
      this.pozosPendienteLayer = createClusterGroup('#94a3b8');
    }

    // Cache TTL — clear popup chart data every 5 minutes so stale data is refreshed
    this.chartCacheTTL = setInterval(() => {
      this.municipioChartCache.clear();
      this.pozoChartCache.clear();
    }, ModuloGis.CHART_CACHE_TTL_MS);

    // 1) Mapa base — restore from shared URL if params exist
    const qp = this.route.snapshot.queryParamMap;
    const swParam = qp.get('sw');
    const neParam = qp.get('ne');
    const isSharedBounds = swParam && neParam;
    this.isSharedView = !!isSharedBounds;

    // Use global L.Map (patched by leaflet-rotate) for rotation support
    // leaflet-rotate: use global L.map() factory (not constructor) to trigger init hooks
    const globalL = (window as any).L;
    const rotateSupported = !!globalL?.Map?.prototype?.setBearing;
    const createMap = (id: string, opts: any) => {
      if (rotateSupported && globalL.map) {
        return globalL.map(id, opts);
      }
      return L.map(id, opts);
    };

    if (isSharedBounds) {
      const [swLat, swLng] = swParam!.split(',').map(Number);
      const [neLat, neLng] = neParam!.split(',').map(Number);
      this.map = createMap('map', { rotate: true, rotateControl: false, bearing: 0, touchRotate: true });
      this.map.fitBounds([[swLat, swLng], [neLat, neLng]]);
    } else {
      const startLat = qp.get('lat') ? +qp.get('lat')! : 19.3;
      const startLng = qp.get('lng') ? +qp.get('lng')! : -99.6;
      const startZoom = qp.get('z') ? +qp.get('z')! : 8;
      this.map = createMap('map', { rotate: true, rotateControl: false, bearing: 0, touchRotate: true });
      this.map.setView([startLat, startLng], startZoom);
    }
    // Expose for debugging (remove later)
    (window as any).__map = this.map;

    // --- Scale control ---
    L.control.scale({ position: 'bottomleft', metric: true, imperial: true }).addTo(this.map);

    // --- Cursor coordinates ---
    this.map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;
      const latDir = lat >= 0 ? 'N' : 'S';
      const lngDir = lng >= 0 ? 'E' : 'W';
      this.cursorCoords.set(`${Math.abs(lat).toFixed(5)}\u00b0 ${latDir}, ${Math.abs(lng).toFixed(5)}\u00b0 ${lngDir}`);
    });
    this.map.on('mouseout', () => this.cursorCoords.set(''));

    // --- Rotation: Alt/Option + Left-click drag ---
    this.initAltDragRotate();

    // --- Rotation tracking ---
    this.initBearingTracking();

    // --- Close context menu on map click ---
    this.map.on('click', () => this.closeContextMenu());

    // Context menu is handled via Angular (contextmenu) binding in template

    // --- Mini-map (init after map is ready) ---
    if (this.miniMapVisible()) this.initMiniMap();

    // --- Drawn items layer ---
    this.drawnItems.addTo(this.map);

    // --- Global keyboard shortcuts ---
    this.globalKeyHandler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+Z = Undo, Cmd/Ctrl+Shift+Z / Ctrl+Y = Redo (always active)
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (this.activeTool() === 'none') this.undoDrawAction();
        return;
      }
      if (mod && (e.key === 'z' && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        if (this.activeTool() === 'none') this.redoDrawAction();
        return;
      }

      if (this.activeTool() !== 'none') return; // tool-specific handler takes precedence
      if (mod) return; // don't intercept Cmd+C, Cmd+V etc.

      // Single-key tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'p': e.preventDefault(); this.startTool('draw-polygon'); return;
        case 'l': e.preventDefault(); this.startTool('draw-line'); return;
        case 'm': e.preventDefault(); this.startTool('draw-point'); return;
        case 'd': e.preventDefault(); this.startTool('measure-distance'); return;
        case 'a': e.preventDefault(); this.startTool('measure-area'); return;
        case 'e': e.preventDefault(); this.startEditMode(); return;
        case 'x': e.preventDefault(); this.startDeleteMode(); return;
        case 't': e.preventDefault(); this.addTextLabel(); return;
      }

      // Backspace/Delete to remove selected layer
      const sel = this.selectedLayer();
      if (!sel) return;
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        this.removeDrawnLayer(sel);
      }
    };
    document.addEventListener('keydown', this.globalKeyHandler);

    // Deselect when clicking empty map area
    this.map.on('click', () => {
      if (this.activeTool() === 'none' && this.selectedLayer()) {
        this.deselectLayer();
      }
    });

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

    this.baseLayers = { mapa: cartoLayer, satelite: satelliteLayer, terreno: terrainLayer };

    // Restore base map from shared URL
    const startBase = (qp.get('base') || 'mapa') as 'mapa' | 'satelite' | 'terreno';
    const initialBase = this.baseLayers[startBase] || cartoLayer;
    this.tileLayer = initialBase;
    this.activeBaseKey = startBase;
    this.activeBase.set(startBase);
    initialBase.addTo(this.map);

    // Track which base layer the user selects
    this.map.on('baselayerchange', (e: any) => {
      if (e.layer === cartoLayer) this.activeBaseKey = 'mapa';
      else if (e.layer === satelliteLayer) this.activeBaseKey = 'satelite';
      else if (e.layer === terrainLayer) this.activeBaseKey = 'terreno';
      this.tileLayer = e.layer;
    });

    this.setupIconScalingByZoom();

    // 2) LayerGroups (contenedores)
    this.pozosOperandoLayer.addTo(this.map);
    this.pozosSinGastoLayer.addTo(this.map);
    this.pozosSinComLayer.addTo(this.map);
    this.pozosObraLayer.addTo(this.map);
    this.pozosInactivosLayer.addTo(this.map);
    this.pozosPendienteLayer.addTo(this.map);

    // 3) Custom layer control — no native L.control.layers
    // (layers already added above; red/zonas start hidden)
    this.refreshLayerCounts();

    // ─────────────────────────────────────────────────────────────────────────
    // 1) OBTENER IDENTIDAD Y ALCANCE (GEOGRAPHIC SCOPE) — before loading assets
    // ─────────────────────────────────────────────────────────────────────────
    let user: any = null;
    try {
      const userData = localStorage.getItem('scada_user_data');
      user = userData ? JSON.parse(userData) : null;
    } catch { /* corrupt localStorage — proceed as unauthenticated */ }
    const isMunicipal = user?.scope === 'Municipal';

    // 4) GeoJSON / overlays — conditional loading based on scope
    this.loadMunicipios();
    this.loadGeoServerLayers(); // Load WMS layers from GeoServer
    if (!isMunicipal) {
      // State-level overlays: skip for Municipal users (saves ~4MB + 60s)
      this.buildGastoByMunicipio();
      this.loadRedPrimaria();
      this.loadRedSecundaria();
    }

    // Mantener pozos al frente si prenden municipios — remove and re-add to push
    // marker DOM nodes above the newly added municipios overlay
    this.map.on('overlayadd', (e: any) => {
      if (e?.name === 'Municipios') {
        const groups = [this.pozosOperandoLayer, this.pozosSinGastoLayer, this.pozosSinComLayer, this.pozosObraLayer, this.pozosInactivosLayer, this.pozosPendienteLayer];
        groups.forEach(g => { if (this.map!.hasLayer(g)) { g.remove(); g.addTo(this.map!); } });
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 2) LÓGICA DE FILTRADO JERÁRQUICO
    // ─────────────────────────────────────────────────────────────────────────
    let filteredSources: GisSource[] = [];

    if (!user || user.scope === 'Federal' || user.scope === 'ALL') {
      // NIVEL 1: Federal - Carga total de infraestructura
      filteredSources = SITIOS_SOURCES;
    }
    else if (user.scope === 'Estatal') {
      // NIVEL 2: Estatal - Filtra todos los municipios del estado (ej. Edomex ID 15)
      // Default to 15 (Estado de Mexico) if estado_id is missing — OCAVM only operates in EdoMex
      const estadoId = user.estado_id || 15;
      filteredSources = SITIOS_SOURCES.filter(src => src.estadoId === estadoId);
    }
    else if (user.scope === 'Municipal') {
      // NIVEL 3: Municipal - Restricción total al scope_id (ej. Ecatepec ID 34)
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

    // CRITICAL: Load API sites cache FIRST, then KMLs.
    // resolveEstatus() needs apiSitesByName populated before KML markers are created.
    this.loadApiSitesCache().then(() => {

    // Load KMLs and fitBounds once all are ready
    let loadedCount = 0;
    const totalSources = filteredSources.length;
    const allBounds = L.latLngBounds([]);

    if (totalSources === 0) {
      // No KML sources — still load dynamic markers from API
      this.addDynamicSiteMarkers();
      this.refreshLayerCounts();
      this.mapLoading.set(false);
    } else {
      filteredSources.forEach(src => {
        this.loadSitiosKml(src.path, (layerBounds) => {
          if (layerBounds?.isValid()) allBounds.extend(layerBounds);
          loadedCount++;
          if (loadedCount === totalSources) {
            if (allBounds.isValid() && !this.isSharedView) {
              this.map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 14 });
            }
            // Add markers for inventory sites not already placed by KML
            this.addDynamicSiteMarkers();
            this.refreshLayerCounts();
            this.mapLoading.set(false);
          }
        });
      });
    }

    }); // end loadApiSitesCache().then()

    // Load saved drawings + views from DB
    this.loadSavedDrawings();
    this.loadGisViews();

    // Get current user ID for view filtering
    try {
      const userData = localStorage.getItem('scada_user_data');
      if (userData) this.currentUserId = JSON.parse(userData).id || 0;
    } catch { /* ignore */ }

    // Restore shared drawings from URL param 'd'
    const sharedDrawings = qp.get('d');
    if (sharedDrawings) {
      this.restoreSharedDrawings(sharedDrawings);
    }

    // Restore full shared state (layers, filters, heatmap, etc.)
    if (isSharedBounds) {
      this.restoreSharedState(qp);
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
      })
      .catch((err) => console.error('GeoJSON load failed:', err));
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

    // Build devEUI list for this municipality from API cache
    const wells: string[] = [];
    this.apiSitesByName.forEach((site) => {
      if (site.municipio_id !== municipioId) return;
      if ((site.estatus || '').toLowerCase() !== 'activo') return;
      const devEui = (site.dev_eui || '').trim();
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
    // Clean up global keyboard handler
    if (this.globalKeyHandler) {
      document.removeEventListener('keydown', this.globalKeyHandler);
      this.globalKeyHandler = null;
    }
    // Clean up GIS tool listeners
    this.cleanupDrawListeners();
    this.setMapCrosshair(false);
    // Dispose ECharts popup
    if (this.popupChart) {
      this.popupChart.dispose();
      this.popupChart = null;
    }
    // Destroy Leaflet map — releases all layers, event listeners, tile loaders
    if (this.map) {
      this.map.remove();
    }
    // Clear chart cache TTL interval
    if (this.chartCacheTTL) {
      clearInterval(this.chartCacheTTL);
      this.chartCacheTTL = null;
    }
    // Clear caches
    this.municipioChartCache.clear();
    this.pozoChartCache.clear();
    this.markersIndex.clear();
    this.municipiosIndex.clear();
  }

  goToOverview() {
    this.router.navigate(['/gerencia/overview-gastos']);
  }

  // ─────────────────────────────
  // RIGHT-CLICK CONTEXT MENU
  // ─────────────────────────────

  /** Bind context menu to a site marker (individual + cluster-safe) */
  private bindContextMenu(marker: L.Marker, name: string) {
    // Store name on marker for map-level contextmenu lookup
    (marker as any).__siteName = name;
  }

  /** Context menu — finds nearest site marker to click point */
  onMapContextMenu(event: MouseEvent) {
    event.preventDefault();
    if (!this.map) return;
    const rect = this.map.getContainer().getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const latlng = this.map.containerPointToLatLng(L.point(x, y));
    this.showContextMenuAt(x, y, latlng);
  }

  private showContextMenuAt(x: number, y: number, latlng: L.LatLng) {
    if (!this.map) return;
    const clickPt = L.point(x, y);
    let bestMarker: L.Marker | null = null;
    let bestDist = 40; // max pixel distance

    const checkMarker = (layer: any) => {
      if (!layer.getLatLng || !layer.__siteName) return;
      try {
        const markerPt = this.map.latLngToContainerPoint(layer.getLatLng());
        const dx = clickPt.x - markerPt.x;
        const dy = clickPt.y - markerPt.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestMarker = layer;
        }
      } catch { /* marker not visible */ }
    };

    // Check all markers via the index (faster than iterating cluster groups)
    this.markersIndex.forEach((marker) => checkMarker(marker));

    if (bestMarker) {
      const name = (bestMarker as any).__siteName;
      const site = this.lookupApiSite(name);
      const devEUI = site?.dev_eui?.trim() || this.slugify(name);
      this.contextMenu.set({ x, y, name, devEUI, latlng });
    } else {
      // No marker nearby — show basic context menu (coords, zoom, draw)
      this.contextMenu.set({ x, y, name: '', devEUI: '', latlng });
    }
  }

  closeContextMenu() {
    this.contextMenu.set(null);
  }

  ctxViewDetail() {
    const ctx = this.contextMenu();
    if (ctx?.devEUI) this.goToSiteDetail(ctx.devEUI);
    this.closeContextMenu();
  }

  ctxViewTrend() {
    const ctx = this.contextMenu();
    if (ctx?.devEUI) {
      const url = this.router.serializeUrl(
        this.router.createUrlTree([DETAIL_BASE_URL, ctx.devEUI], { queryParams: { tab: 'trend' } })
      );
      window.open(url, '_blank');
    }
    this.closeContextMenu();
  }

  ctxCopyCoords() {
    const ctx = this.contextMenu();
    if (ctx?.latlng) {
      const text = `${ctx.latlng.lat.toFixed(6)}, ${ctx.latlng.lng.toFixed(6)}`;
      navigator.clipboard.writeText(text).catch(() => {});
    }
    this.closeContextMenu();
  }

  ctxZoomTo() {
    const ctx = this.contextMenu();
    if (ctx?.latlng) {
      this.map.flyTo(ctx.latlng, 16, { duration: 0.8 });
    }
    this.closeContextMenu();
  }

  // ─────────────────────────────
  // HEATMAP LAYER
  // ─────────────────────────────

  toggleHeatmap() {
    const gL = (window as any).L;
    if (!gL?.heatLayer) return;

    if (this.heatmapVisible()) {
      // Remove
      if (this.heatmapLayer) {
        this.map.removeLayer(this.heatmapLayer);
        this.heatmapLayer = null;
      }
      this.heatmapVisible.set(false);
      return;
    }

    // Build heatmap data from API sites
    const points: [number, number, number][] = [];
    this.apiSitesByName.forEach((site) => {
      const lat = site.latitude ?? site.lat;
      const lng = site.longitude ?? site.lng;
      if (lat == null || lng == null) return;
      const flow = site.last_flow_value != null ? Math.abs(Number(site.last_flow_value)) : 0;
      // Normalize: use flow as intensity (0-1 range, capped at 20 L/s)
      const intensity = Math.min(flow / 20, 1);
      points.push([lat, lng, Math.max(intensity, 0.15)]); // min 0.15 so zero-flow still shows
    });

    // Also get from markers if API data is sparse
    if (points.length < 5) {
      this.markersIndex.forEach((marker) => {
        const ll = marker.getLatLng();
        points.push([ll.lat, ll.lng, 0.3]);
      });
    }

    if (points.length === 0) return;

    this.heatmapLayer = gL.heatLayer(points, {
      radius: 35,
      blur: 25,
      maxZoom: 14,
      max: 1,
      gradient: {
        0.0: '#22c55e',  // green — low flow
        0.3: '#eab308',  // yellow
        0.5: '#f97316',  // orange
        0.7: '#ef4444',  // red
        1.0: '#991b1b',  // dark red — high flow
      },
    });
    this.heatmapLayer.addTo(this.map);
    this.heatmapVisible.set(true);
  }

  // ─────────────────────────────
  // RAIN STATIONS ON MAP
  // ─────────────────────────────

  toggleRainStations() {
    if (this.rainStationsVisible()) {
      this.map.removeLayer(this.rainStationsLayer);
      this.rainStationsLayer.clearLayers();
      this.rainStationsVisible.set(false);
      this.rainStationsCount.set(0);
      return;
    }

    this.rainService.getCurrent().subscribe({
      next: (stations) => {
        this.rainStationsLayer.clearLayers();

        stations.forEach((s: RainStation) => {
          if (!s.latitude || !s.longitude) return;

          const mm = Number(s.last_value_mm) || 0;
          let color = '#94a3b8'; // gray — no rain
          if (mm > 10) color = '#ef4444';       // red — intense
          else if (mm > 5) color = '#f59e0b';   // amber — heavy
          else if (mm > 1) color = '#3b82f6';   // blue — moderate
          else if (mm > 0) color = '#93c5fd';   // light blue — light

          const fillOp = mm > 10 ? 0.7 : mm > 5 ? 0.6 : mm > 1 ? 0.5 : mm > 0 ? 0.4 : 0.3;
          const radius = mm > 0 ? Math.min(8 + mm, 18) : 6;

          const circle = L.circleMarker([s.latitude, s.longitude], {
            radius, color, weight: 2, fillColor: color, fillOpacity: fillOp,
          });

          if (mm > 0) {
            circle.bindTooltip(`${mm.toFixed(1)}`, { permanent: true, direction: 'center', className: 'rain-label-tooltip' });
          }

          circle.bindPopup(
            `<div style="font-family:Inter,system-ui,sans-serif;font-size:13px">` +
            `<strong>${s.code} — ${s.name}</strong><br>` +
            `<span style="color:#64748b">${s.municipality}</span><br>` +
            `<span style="font-size:18px;font-weight:700">${mm.toFixed(2)} mm</span>` +
            (s.last_updated_at ? `<br><small style="color:#94a3b8">${new Date(s.last_updated_at).toLocaleTimeString()}</small>` : '') +
            `</div>`, { minWidth: 160 }
          );
          circle.addTo(this.rainStationsLayer);
        });

        this.rainStationsLayer.addTo(this.map);
        this.rainStationsLayer.eachLayer((l: any) => { if (l.bringToFront) l.bringToFront(); });
        this.rainStationsVisible.set(true);
        this.rainStationsCount.set(stations.length);
      },
      error: () => {}
    });
  }

  // ─────────────────────────────
  // MINI-MAP (overview reference)
  // ─────────────────────────────

  private initMiniMap() {
    // Wait for the DOM element to exist
    setTimeout(() => {
      const el = document.getElementById('gis-minimap');
      if (!el || this.miniMapInstance) return;

      const miniTile = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        { subdomains: 'abcd', maxZoom: 19, attribution: '' }
      );

      this.miniMapInstance = L.map(el, {
        zoomControl: false,
        attributionControl: false,
        dragging: true,         // interactive — pan to navigate
        scrollWheelZoom: true,  // scroll to zoom mini-map
        doubleClickZoom: false,
        touchZoom: false,
        boxZoom: false,
        keyboard: false,
        layers: [miniTile],
      });

      // Stop events from propagating to main map
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);

      this.miniMapRect = L.rectangle(this.map.getBounds(), {
        color: '#6d002b',
        weight: 2,
        fillOpacity: 0.15,
        interactive: false,
      }).addTo(this.miniMapInstance);

      // Click on mini-map → navigate main map
      this.miniMapInstance.on('click', (e: L.LeafletMouseEvent) => {
        this.map.panTo(e.latlng, { animate: true, duration: 0.5 });
      });

      // Sync: main map → mini-map
      let syncing = false;
      this.miniMapSync = () => {
        if (!this.miniMapInstance || !this.miniMapRect || syncing) return;
        syncing = true;
        const bounds = this.map.getBounds();
        const zoom = Math.max(this.map.getZoom() - 5, 1);
        this.miniMapInstance.setView(bounds.getCenter(), zoom, { animate: false });
        this.miniMapRect.setBounds(bounds);
        syncing = false;
      };
      this.map.on('moveend zoomend', this.miniMapSync);

      // Add site dots to mini-map
      this.addMiniMapDots();

      // Force tile load
      this.miniMapInstance.invalidateSize();
      setTimeout(() => this.miniMapSync!(), 100);
    }, 300);
  }

  /** Add small colored dots for each site on the mini-map */
  private addMiniMapDots() {
    if (!this.miniMapInstance) return;
    const colorMap: Record<string, string> = {
      'ok': '#22c55e',       // green
      'stopped': '#f59e0b',  // amber
      'no-signal': '#ef4444', // red
      'obra': '#eab308',     // yellow
      'inactivo': '#94a3b8', // gray
      'pendiente': '#cbd5e1', // light gray
    };

    this.markersIndex.forEach((marker) => {
      const ll = marker.getLatLng();
      const opState = (marker as any).__scadaOpState || 'pendiente';
      const color = colorMap[opState] || '#cbd5e1';
      L.circleMarker(ll, {
        radius: 3,
        color: 'transparent',
        fillColor: color,
        fillOpacity: 0.85,
        interactive: false,
      }).addTo(this.miniMapInstance!);
    });
  }

  private destroyMiniMap() {
    if (this.miniMapSync) {
      this.map.off('moveend zoomend', this.miniMapSync);
      this.miniMapSync = null;
    }
    if (this.miniMapInstance) {
      this.miniMapInstance.remove();
      this.miniMapInstance = null;
      this.miniMapRect = null;
    }
  }

  toggleMiniMap() {
    if (this.miniMapVisible()) {
      this.destroyMiniMap();
      this.miniMapVisible.set(false);
    } else {
      this.miniMapVisible.set(true);
      this.initMiniMap();
    }
  }

  // ─────────────────────────────
  // COMPASS / MAP ROTATION
  // ─────────────────────────────

  private initBearingTracking() {
    // Track bearing changes from leaflet-rotate
    this.map.on('rotate' as any, () => {
      const bearing = (this.map as any).getBearing?.() || 0;
      this.mapBearing.set(Math.round(bearing));
    });
  }

  resetNorth() {
    if ((this.map as any).setBearing) {
      (this.map as any).setBearing(0);
      this.mapBearing.set(0);
    }
  }

  /** Alt/Option + Left-click drag on the map to rotate */
  private initAltDragRotate() {
    if (!(this.map as any).setBearing) return;
    const container = this.map.getContainer();
    let rotating = false;
    let startX = 0;
    let startBearing = 0;

    container.addEventListener('mousedown', (e: MouseEvent) => {
      if (!e.altKey || e.button !== 0) return; // Only Alt + left click
      e.preventDefault();
      e.stopPropagation();
      rotating = true;
      startX = e.clientX;
      startBearing = (this.map as any).getBearing() || 0;
      this.map.dragging.disable();
      container.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!rotating) return;
      const dx = e.clientX - startX;
      const newBearing = startBearing + dx * 0.5; // 0.5 deg per pixel
      (this.map as any).setBearing(newBearing % 360);
      this.mapBearing.set(Math.round(newBearing % 360));
    });

    document.addEventListener('mouseup', () => {
      if (!rotating) return;
      rotating = false;
      this.map.dragging.enable();
      container.style.cursor = '';
    });
  }

  /** Drag the compass rose to rotate the map */
  private compassDragging = false;
  private compassCenter = { x: 0, y: 0 };
  private compassStartAngle = 0;

  onCompassDragStart(event: MouseEvent) {
    if (!(this.map as any).setBearing) return;
    event.preventDefault();
    event.stopPropagation();

    const el = (event.currentTarget as HTMLElement);
    const rect = el.getBoundingClientRect();
    this.compassCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this.compassStartAngle = Math.atan2(event.clientY - this.compassCenter.y, event.clientX - this.compassCenter.x);
    this.compassDragging = true;

    const startBearing = (this.map as any).getBearing() || 0;

    const onMove = (e: MouseEvent) => {
      if (!this.compassDragging) return;
      const angle = Math.atan2(e.clientY - this.compassCenter.y, e.clientX - this.compassCenter.x);
      const delta = (angle - this.compassStartAngle) * (180 / Math.PI);
      const newBearing = (startBearing + delta) % 360;
      (this.map as any).setBearing(newBearing);
      this.mapBearing.set(Math.round(newBearing));
    };

    const onUp = () => {
      this.compassDragging = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  toggleViewMode() {
    const next = this.viewMode() === 'map' ? 'cards' : 'map';
    this.viewMode.set(next);
    if (next === 'cards') {
      this.buildCardSites();
    }
  }

  goToSiteDetail(devEUI: string) {
    if (devEUI) {
      const url = this.router.serializeUrl(this.router.createUrlTree([DETAIL_BASE_URL, devEUI]));
      window.open(url, '_blank');
    }
  }

  private buildCardSites() {
    const now = Date.now();
    const sites: CardSite[] = [];
    this.apiSitesByName.forEach((s) => {
      const flow = s.last_flow_value != null ? Number(s.last_flow_value) : null;
      const hasTelemetry = s.last_updated_at != null;
      const hasFlow = flow != null && flow > 0.01;
      const estatus = ((s as any).estatus || 'activo').toLowerCase();
      const isStale = hasTelemetry && (now - new Date(s.last_updated_at!).getTime() > COMM_LOSS_THRESHOLD_MS);

      let status: CardSite['status'];
      if (estatus === 'obra') status = 'obra';
      else if (!hasTelemetry) status = 'pending';
      else if (isStale) status = 'no-signal';
      else if (hasFlow) status = 'ok';
      else status = 'no-flow';

      const rssi = s.rssi ?? null;
      let signalPct: number | null = null;
      if (rssi != null) {
        const clamped = Math.max(-120, Math.min(-30, rssi));
        signalPct = Math.round(((clamped + 120) / 90) * 100);
      }

      let ts = '—';
      if (hasTelemetry) {
        const d = new Date(s.last_updated_at!);
        if (!isNaN(d.getTime())) {
          const day = d.getDate().toString().padStart(2, '0');
          const mon = (d.getMonth() + 1).toString().padStart(2, '0');
          const h = d.getHours().toString().padStart(2, '0');
          const m = d.getMinutes().toString().padStart(2, '0');
          ts = `${day}/${mon} ${h}:${m}`;
        }
      }

      sites.push({
        devEUI: (s.dev_eui || '').trim(),
        name: s.site_name || 'Sin nombre',
        type: s.site_type ? s.site_type.charAt(0).toUpperCase() + s.site_type.slice(1).toLowerCase() : 'Pozo',
        municipality: s.municipality || 'Sin zona',
        flow,
        unit: 'L/s',
        status,
        signalPct,
        timestamp: ts,
      });
    });

    // Sort: problems first
    const ORDER: Record<string, number> = { 'no-signal': 0, 'no-flow': 1, 'ok': 2, 'obra': 3, 'pending': 4 };
    sites.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
    this.cardSites.set(sites);
  }

  cardStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'ok': 'Operando', 'no-flow': 'Sin gasto', 'no-signal': 'Sin com.',
      'pending': 'Pendiente', 'obra': 'En obra'
    };
    return labels[status] || status;
  }

  // ─────────────────────────────
  // GIS TOOLS
  // ─────────────────────────────

  private drawVertexListener: any = null;
  private drawVertices: L.LatLng[] = [];

  private setMapCrosshair(active: boolean) {
    const container = this.map?.getContainer();
    if (!container) return;
    if (active) {
      L.DomUtil.addClass(container, 'ft-crosshair');
    } else {
      L.DomUtil.removeClass(container, 'ft-crosshair');
    }
  }

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  startTool(tool: 'measure-distance' | 'measure-area' | 'draw-point' | 'draw-line' | 'draw-polygon') {
    this.cancelTool();
    this.activeTool.set(tool);
    this.measureResult.set('');
    this.liveMeasure.set('');
    this.drawVertices = [];
    this.setMapCrosshair(true);

    // Keyboard shortcuts: Enter = finish, Escape = cancel
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); this.finishTool(); }
      if (e.key === 'Escape') { e.preventDefault(); this.cancelTool(); }
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); this.undoLastVertex(); }
    };
    document.addEventListener('keydown', this.keyHandler);

    const gL = (window as any).L;
    if (!gL?.Draw) return;

    let handler: any;
    const color = this.drawColor();
    const opts: any = { shapeOptions: { color, weight: 3, opacity: 0.8 } };

    switch (tool) {
      case 'measure-distance':
        handler = new gL.Draw.Polyline(this.map, { ...opts, shapeOptions: { ...opts.shapeOptions, dashArray: '8 6' } });
        break;
      case 'measure-area':
        handler = new gL.Draw.Polygon(this.map, opts);
        break;
      case 'draw-point':
        handler = new gL.Draw.Marker(this.map, {});
        break;
      case 'draw-line':
        handler = new gL.Draw.Polyline(this.map, opts);
        break;
      case 'draw-polygon':
        handler = new gL.Draw.Polygon(this.map, opts);
        break;
    }

    if (handler) {
      this.activeDrawHandler = handler;
      handler.enable();

      // Listen for vertices added
      this.drawVertexListener = (e: any) => {
        const layers = e.layers?.getLayers?.() || [];
        const verts: L.LatLng[] = [];
        layers.forEach((l: any) => {
          if (l.getLatLng) verts.push(l.getLatLng());
        });
        this.drawVertices = verts;

        // Real-time measurement
        if (tool === 'measure-distance' || tool === 'measure-area') {
          this.updateLiveMeasure(tool);
        }

        // Click-to-close: add click listeners on existing vertex icons
        if (verts.length >= 2 && tool !== 'draw-point') {
          setTimeout(() => {
            const icons = document.querySelectorAll('.leaflet-editing-icon');
            icons.forEach((icon) => {
              (icon as any).__closeHandler?.();
              const closeHandler = () => {
                // Let leaflet-draw process the click first, then finish on next tick
                setTimeout(() => this.finishTool(), 100);
              };
              icon.addEventListener('click', closeHandler);
              (icon as any).__closeHandler = () => icon.removeEventListener('click', closeHandler);
            });
          }, 50);
        }
      };
      this.map.on('draw:drawvertex' as any, this.drawVertexListener);

      // Mousemove for real-time preview
      if (tool === 'measure-distance' || tool === 'measure-area') {
        const mouseMoveHandler = (e: L.LeafletMouseEvent) => {
          if (this.drawVertices.length > 0) {
            this.updateLiveMeasure(tool, e.latlng);
          }
        };
        (this as any).__drawMouseMove = mouseMoveHandler;
        this.map.on('mousemove', mouseMoveHandler);
      }

      this.map.once('draw:created' as any, (e: any) => {
        const layer = e.layer;

        // Clean up real-time listeners
        this.cleanupDrawListeners();

        if (tool === 'measure-distance') {
          const coords = layer.getLatLngs();
          let total = 0;
          for (let i = 1; i < coords.length; i++) {
            total += coords[i - 1].distanceTo(coords[i]);
          }
          const result = total >= 1000 ? `${(total / 1000).toFixed(2)} km` : `${total.toFixed(1)} m`;
          this.measureResult.set(result);
          this.liveMeasure.set('');
          this.drawnItems.addLayer(layer);
          layer.bindTooltip(result, { permanent: true, className: 'measure-tooltip' });
        } else if (tool === 'measure-area') {
          const coords = layer.getLatLngs()[0].map((ll: any) => [ll.lng, ll.lat]);
          coords.push(coords[0]); // close polygon
          const poly = turf.polygon([coords]);
          const area = turf.area(poly);
          const result = area >= 1_000_000 ? `${(area / 1_000_000).toFixed(2)} km\u00b2` : `${area.toFixed(0)} m\u00b2`;
          this.measureResult.set(result);
          this.liveMeasure.set('');
          this.drawnItems.addLayer(layer);
          layer.bindTooltip(result, { permanent: true, className: 'measure-tooltip' });
        } else if (tool === 'draw-polygon') {
          this.drawnItems.addLayer(layer);
          this.querySitesInPolygon(layer);
        } else {
          this.drawnItems.addLayer(layer);
        }

        // Tag layer for panel tracking
        (layer as any).__layerId = ++this.layerIdCounter;
        (layer as any).__layerType = tool.replace('measure-', '').replace('draw-', '');

        // Make all non-marker layers draggable + selectable
        this.makeLayerDraggable(layer);
        this.registerLayerSelection(layer);
        this.trackLayerAdd(layer);

        this.activeTool.set('none');
        this.activeDrawHandler = null;
        this.setMapCrosshair(false);
      });
    }
  }

  private updateLiveMeasure(tool: string, cursorPos?: L.LatLng) {
    const verts = [...this.drawVertices];
    if (cursorPos) verts.push(cursorPos);
    if (verts.length < 2) return;

    if (tool === 'measure-distance') {
      let total = 0;
      for (let i = 1; i < verts.length; i++) {
        total += verts[i - 1].distanceTo(verts[i]);
      }
      this.liveMeasure.set(total >= 1000 ? `${(total / 1000).toFixed(2)} km` : `${total.toFixed(1)} m`);
    } else if (tool === 'measure-area' && verts.length >= 3) {
      const coords = verts.map(v => [v.lng, v.lat]);
      coords.push(coords[0]);
      try {
        const poly = turf.polygon([coords]);
        const area = turf.area(poly);
        this.liveMeasure.set(area >= 1_000_000 ? `${(area / 1_000_000).toFixed(2)} km\u00b2` : `${area.toFixed(0)} m\u00b2`);
      } catch {
        // Invalid polygon coordinates — skip
      }
    }
  }

  private cleanupDrawListeners() {
    if (this.drawVertexListener) {
      this.map.off('draw:drawvertex' as any, this.drawVertexListener);
      this.drawVertexListener = null;
    }
    if ((this as any).__drawMouseMove) {
      this.map.off('mousemove', (this as any).__drawMouseMove);
      delete (this as any).__drawMouseMove;
    }
    this.drawVertices = [];
  }

  finishTool() {
    const tool = this.activeTool();
    // Dispatch to correct handler for edit/delete modes
    if (tool === 'edit') { this.saveEdit(); return; }
    if (tool === 'delete-shape') { this.confirmDelete(); return; }
    if (!this.activeDrawHandler) return;
    const isPolygon = tool === 'measure-area' || tool === 'draw-polygon';
    try {
      if (isPolygon) {
        // Polygon: completeShape() closes the shape (connects last→first)
        this.activeDrawHandler.completeShape();
      } else if (typeof this.activeDrawHandler._finishShape === 'function') {
        // Polyline: _finishShape() finalizes as open line
        this.activeDrawHandler._finishShape();
      } else {
        this.activeDrawHandler.disable();
      }
    } catch {
      this.cleanupDrawListeners();
      this.activeDrawHandler?.disable?.();
      this.activeDrawHandler = null;
      this.activeTool.set('none');
      this.liveMeasure.set('');
      this.setMapCrosshair(false);
    }
  }

  undoLastVertex() {
    if (!this.activeDrawHandler) return;
    try {
      this.activeDrawHandler.deleteLastVertex?.();
      if (this.drawVertices.length > 0) {
        this.drawVertices.pop();
        this.updateLiveMeasure(this.activeTool());
      }
    } catch { /* no vertices to undo */ }
  }

  cancelTool() {
    this.cleanupDrawListeners();
    this.cleanupKeyHandler();
    if (this.activeDrawHandler) {
      try { this.activeDrawHandler.disable(); } catch { /* ignore */ }
      this.activeDrawHandler = null;
    }
    if (this.editHandler) {
      try { this.editHandler.revert(); } catch { /* ignore */ }
      try { this.editHandler.disable(); } catch { /* ignore */ }
      this.editHandler = null;
    }
    if (this.deleteHandler) {
      try { this.deleteHandler.revert(); } catch { /* ignore */ }
      try { this.deleteHandler.disable(); } catch { /* ignore */ }
      this.deleteHandler = null;
    }
    this.activeTool.set('none');
    this.measureResult.set('');
    this.liveMeasure.set('');
    this.setMapCrosshair(false);
  }

  clearDrawnItems() {
    this.deselectLayer();
    this.drawnItems.clearLayers();
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.measureResult.set('');
    this.liveMeasure.set('');
    this.queryResults.set([]);
    this.queryPanelOpen.set(false);
    this.layersPanelVisible.set(false);
  }

  private querySitesInPolygon(layer: any) {
    const coords = layer.getLatLngs()[0].map((ll: any) => [ll.lng, ll.lat]);
    coords.push(coords[0]);
    const polygon = turf.polygon([coords]);

    const results: { name: string; devEUI: string; status: string; flow: number | null }[] = [];
    const now = Date.now();

    this.apiSitesByName.forEach((site) => {
      const lat = site.latitude ?? site.lat;
      const lng = site.longitude ?? site.lng ?? site.lon;
      if (lat == null || lng == null) return;

      const pt = turf.point([Number(lng), Number(lat)]);
      if (turf.booleanPointInPolygon(pt, polygon)) {
        const flow = site.last_flow_value != null ? Number(site.last_flow_value) : null;
        const hasTelemetry = site.last_updated_at != null;
        const isStale = hasTelemetry && (now - new Date(site.last_updated_at!).getTime() > COMM_LOSS_THRESHOLD_MS);
        let status = 'pending';
        if ((site.estatus || '').toLowerCase() === 'obra') status = 'obra';
        else if (!hasTelemetry) status = 'pending';
        else if (isStale) status = 'no-signal';
        else if (flow != null && flow > 0.01) status = 'ok';
        else status = 'no-flow';

        results.push({
          name: site.site_name || 'Sin nombre',
          devEUI: (site.dev_eui || '').trim(),
          status,
          flow,
        });
      }
    });

    // Also check markers on the map (KML sites that might not be in apiSitesByName)
    this.markersIndex.forEach((marker, name) => {
      const latlng = marker.getLatLng();
      const pt = turf.point([latlng.lng, latlng.lat]);
      if (turf.booleanPointInPolygon(pt, polygon)) {
        // Dedup: skip if a result with same name (case-insensitive) already exists
        const nameNorm = name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!results.some(r => r.name.toLowerCase().replace(/[^a-z0-9]/g, '') === nameNorm)) {
          results.push({ name, devEUI: '', status: 'pending', flow: null });
        }
      }
    });

    this.queryResults.set(results);
    this.queryPanelOpen.set(results.length > 0);

    // Fit bounds to polygon
    this.map.fitBounds(layer.getBounds(), { padding: [30, 30] });
  }

  exportDrawnItems() {
    const geojson = this.drawnItems.toGeoJSON();
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scada_gis_export.geojson';
    a.click();
    URL.revokeObjectURL(url);
  }

  importGeoJSON(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => console.error('File read failed');
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const color = this.drawColor();
        const geoLayer = L.geoJSON(data, {
          style: () => ({ color, weight: 2, opacity: 0.8 }),
        });
        const baseName = file.name.replace('.geojson', '').replace('.json', '');
        // Add individual sub-layers (not the group) so leaflet-draw edit/delete works
        let idx = 0;
        geoLayer.eachLayer((sublayer: any) => {
          idx++;
          (sublayer as any).__layerId = ++this.layerIdCounter;
          (sublayer as any).__layerType = 'geojson';
          (sublayer as any).__layerName = geoLayer.getLayers().length > 1 ? `${baseName} (${idx})` : baseName;
          this.drawnItems.addLayer(sublayer);
          this.makeLayerDraggable(sublayer);
          this.registerLayerSelection(sublayer);
          this.trackLayerAdd(sublayer);
        });
        this.map.fitBounds(geoLayer.getBounds(), { padding: [30, 30] });
      } catch { /* invalid file */ }
    };
    reader.readAsText(file);
  }

  // ─────────────────────────────
  // EDIT / DELETE MODE
  // ─────────────────────────────

  startEditMode() {
    this.cancelTool();
    const gL = (window as any).L;
    if (!gL?.EditToolbar?.Edit || this.drawnItems.getLayers().length === 0) return;

    // Snapshot all layer latlngs before editing (for undo)
    this.preEditSnapshots.clear();
    this.drawnItems.eachLayer((layer: any) => {
      if (layer.getLatLngs) {
        this.preEditSnapshots.set(layer, JSON.parse(JSON.stringify(layer.getLatLngs())));
      } else if (layer instanceof L.Marker) {
        const ll = layer.getLatLng();
        this.preEditSnapshots.set(layer, { lat: ll.lat, lng: ll.lng });
      }
    });

    this.activeTool.set('edit');
    this.editHandler = new gL.EditToolbar.Edit(this.map, { featureGroup: this.drawnItems });
    this.editHandler.enable();
    this.setMapCrosshair(false);

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); this.saveEdit(); }
      if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  saveEdit() {
    if (this.editHandler) {
      try { this.editHandler.save(); } catch { /* ignore */ }
      try { this.editHandler.disable(); } catch { /* ignore */ }
      this.editHandler = null;
    }
    this.cleanupKeyHandler();
    this.activeTool.set('none');

    // Track vertex edits in undo stack
    this.preEditSnapshots.forEach((prevData, layer) => {
      if ((layer as any).getLatLngs) {
        const newLatLngs = JSON.parse(JSON.stringify((layer as any).getLatLngs()));
        if (JSON.stringify(prevData) !== JSON.stringify(newLatLngs)) {
          this.undoStack.push({ action: 'edit-vertices', layer, meta: { prevLatLngs: prevData, newLatLngs } });
          this.redoStack.length = 0;
        }
      } else if (layer instanceof L.Marker) {
        const newLL = layer.getLatLng();
        if (prevData.lat !== newLL.lat || prevData.lng !== newLL.lng) {
          this.undoStack.push({ action: 'move-marker', layer, meta: { prevLatLng: L.latLng(prevData.lat, prevData.lng), newLatLng: L.latLng(newLL.lat, newLL.lng) } });
          this.redoStack.length = 0;
        }
      }
    });
    this.preEditSnapshots.clear();

    // Re-query sites for any edited polygons
    this.refreshPolygonQueries();
  }

  cancelEdit() {
    if (this.editHandler) {
      try { this.editHandler.revert(); } catch { /* ignore */ }
      try { this.editHandler.disable(); } catch { /* ignore */ }
      this.editHandler = null;
    }
    if (this.deleteHandler) {
      try { this.deleteHandler.revert(); } catch { /* ignore */ }
      try { this.deleteHandler.disable(); } catch { /* ignore */ }
      this.deleteHandler = null;
    }
    this.cleanupKeyHandler();
    this.activeTool.set('none');
  }

  startDeleteMode() {
    this.cancelTool();
    const gL = (window as any).L;
    if (!gL?.EditToolbar?.Delete || this.drawnItems.getLayers().length === 0) return;

    this.activeTool.set('delete-shape');
    this.deleteHandler = new gL.EditToolbar.Delete(this.map, { featureGroup: this.drawnItems });
    this.deleteHandler.enable();

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); this.confirmDelete(); }
      if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  confirmDelete() {
    if (this.deleteHandler) {
      try { this.deleteHandler.save(); } catch { /* ignore */ }
      try { this.deleteHandler.disable(); } catch { /* ignore */ }
      this.deleteHandler = null;
    }
    this.cleanupKeyHandler();
    this.activeTool.set('none');
  }

  private cleanupKeyHandler() {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  /** Make a drawn polygon/polyline draggable by mouse drag */
  private makeLayerDraggable(layer: any) {
    if (layer instanceof L.Marker) return; // markers use dragend event below

    let dragging = false;
    let startLatLng: L.LatLng;
    let prevLatLngs: any; // snapshot before drag for undo

    layer.on('mousedown', (e: any) => {
      if (this.activeTool() !== 'none') return; // don't drag while drawing
      dragging = true;
      startLatLng = e.latlng;
      // Snapshot latlngs for undo
      prevLatLngs = layer.getLatLngs ? JSON.parse(JSON.stringify(layer.getLatLngs())) : null;
      this.map.dragging.disable();
      L.DomUtil.addClass(this.map.getContainer(), 'ft-grabbing');

      const onMove = (ev: L.LeafletMouseEvent) => {
        if (!dragging) return;
        const dlat = ev.latlng.lat - startLatLng.lat;
        const dlng = ev.latlng.lng - startLatLng.lng;
        startLatLng = ev.latlng;

        // Move all points of the shape
        if (layer.getLatLngs) {
          const latlngs = layer.getLatLngs();
          const moved = this.offsetLatLngs(latlngs, dlat, dlng);
          layer.setLatLngs(moved);

          // Keep tooltip anchored to polygon center
          const tip = layer.getTooltip();
          if (tip && layer.getCenter) {
            tip.setLatLng(layer.getCenter());
          }
        }
      };

      const onUp = () => {
        dragging = false;
        this.map.dragging.enable();
        L.DomUtil.removeClass(this.map.getContainer(), 'ft-grabbing');
        this.map.off('mousemove', onMove);
        this.map.off('mouseup', onUp);

        // Track move in undo stack
        if (prevLatLngs && layer.getLatLngs) {
          const newLatLngs = JSON.parse(JSON.stringify(layer.getLatLngs()));
          this.undoStack.push({ action: 'move', layer, meta: { prevLatLngs, newLatLngs } });
          this.redoStack.length = 0;
        }

        // Force leaflet-draw to rebuild edit handlers with current coordinates
        const gL = (window as any).L;
        if ((layer as any).editing) {
          try { (layer as any).editing.disable(); } catch { /* ignore */ }
        }
        if (layer instanceof L.Polygon && gL?.Edit?.Poly) {
          (layer as any).editing = new gL.Edit.Poly(layer);
        } else if (layer instanceof L.Polyline && gL?.Edit?.Poly) {
          (layer as any).editing = new gL.Edit.Poly(layer);
        }

        // Re-query sites after drag if layer is a polygon
        if (layer.getLatLngs && layer instanceof L.Polygon) {
          this.querySitesInPolygon(layer);
        }
      };

      this.map.on('mousemove', onMove);
      this.map.on('mouseup', onUp);

      L.DomEvent.stopPropagation(e);
    });

    // Cursor hint
    layer.on('mouseover', () => {
      if (this.activeTool() === 'none') {
        L.DomUtil.addClass(this.map.getContainer(), 'ft-grab');
      }
    });
    layer.on('mouseout', () => {
      L.DomUtil.removeClass(this.map.getContainer(), 'ft-grab');
    });
  }

  /** Recursively offset LatLngs (handles nested arrays for polygons) */
  private offsetLatLngs(latlngs: any, dlat: number, dlng: number): any {
    if (Array.isArray(latlngs[0])) {
      return latlngs.map((ring: any) => this.offsetLatLngs(ring, dlat, dlng));
    }
    return latlngs.map((ll: L.LatLng) => L.latLng(ll.lat + dlat, ll.lng + dlng));
  }

  // ─────────────────────────────
  // BUFFER ZONES
  // ─────────────────────────────

  toggleBufferPanel() {
    this.bufferPanelOpen.set(!this.bufferPanelOpen());
  }

  applyBuffer() {
    const layers = this.drawnItems.getLayers();
    if (layers.length === 0) return;
    const radius = this.bufferRadius();

    layers.forEach((layer: any) => {
      if ((layer as any).__isBuffer) return; // skip existing buffers
      try {
        const geojson = layer.toGeoJSON();
        const buffered = turf.buffer(geojson, radius, { units: 'kilometers' });
        if (buffered) {
          const bufferGeo = L.geoJSON(buffered, {
            style: () => ({
              color: '#3b82f6',
              weight: 2,
              opacity: 0.5,
              fillOpacity: 0.1,
              fillColor: '#3b82f6',
              dashArray: '6 4',
            }),
          });
          // Add individual sub-layers so leaflet-draw edit/delete works
          bufferGeo.eachLayer((sublayer: any) => {
            (sublayer as any).__isBuffer = true;
            (sublayer as any).__layerId = ++this.layerIdCounter;
            (sublayer as any).__layerType = 'buffer';
            (sublayer as any).__layerName = `Buffer ${radius} km`;
            this.drawnItems.addLayer(sublayer);
            this.makeLayerDraggable(sublayer);
            this.registerLayerSelection(sublayer);
          });
          // Query sites within buffer
          bufferGeo.eachLayer((l: any) => {
            if (l.getLatLngs) this.querySitesInPolygon(l);
          });
        }
      } catch { /* skip invalid geometries */ }
    });
    this.bufferPanelOpen.set(false);
  }

  // ─────────────────────────────
  // SAVED DRAWINGS (PERSISTENCE)
  // ─────────────────────────────

  loadSavedDrawings() {
    this.gisDrawingService.list().subscribe({
      next: (drawings) => this.savedDrawings.set(drawings),
      error: (err) => console.error('Failed to load saved drawings:', err)
    });
  }

  loadDrawing(drawing: any) {
    try {
      const geoLayer = L.geoJSON(drawing.geojson, {
        style: () => ({ color: drawing.color || '#6d002b', weight: 3, opacity: 0.8 }),
      });
      // Add individual sub-layers so leaflet-draw edit/delete works
      let idx = 0;
      geoLayer.eachLayer((sublayer: any) => {
        idx++;
        (sublayer as any).__drawingId = drawing.id;
        (sublayer as any).__drawingName = drawing.name;
        (sublayer as any).__layerId = ++this.layerIdCounter;
        (sublayer as any).__layerType = 'saved';
        (sublayer as any).__layerName = geoLayer.getLayers().length > 1 ? `${drawing.name} (${idx})` : drawing.name;
        sublayer.bindTooltip(drawing.name, { permanent: false, className: 'drawing-label' });
        this.drawnItems.addLayer(sublayer);
        this.makeLayerDraggable(sublayer);
        this.registerLayerSelection(sublayer);
      });
      this.map.fitBounds(geoLayer.getBounds(), { padding: [30, 30] });
    } catch { /* invalid geojson */ }
  }

  saveCurrentDrawing() {
    const name = this.saveDrawingName().trim();
    if (!name || this.drawnItems.getLayers().length === 0) return;
    const geojson = this.drawnItems.toGeoJSON();
    this.gisDrawingService.create({ name, geojson, color: '#6d002b' }).subscribe({
      next: (saved) => {
        this.savedDrawings.update(list => [...list, saved]);
        this.saveDrawingName.set('');
      },
      error: () => {}
    });
  }

  deleteSavedDrawing(id: number) {
    this.gisDrawingService.delete(id).subscribe({
      next: () => this.savedDrawings.update(list => list.filter(d => d.id !== id)),
      error: () => {}
    });
  }

  // ─────────────────────────────
  // MAP EXPORT (PNG)
  // ─────────────────────────────

  async exportMapPNG() {
    if (!this.map) return;
    const container = this.map.getContainer();
    container.classList.add('gis-exporting');

    try {
      const { toPng } = await import('html-to-image');

      // 1) Capture the map
      const mapDataUrl = await toPng(container, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (el: HTMLElement) => {
          const cls = el.classList;
          if (!cls) return true;
          return !cls.contains('leaflet-control-zoom') &&
                 !cls.contains('leaflet-control-scale') &&
                 !cls.contains('ft-bar') &&
                 !cls.contains('ft-hint') &&
                 !cls.contains('ft-layers-panel') &&
                 !cls.contains('lc');
        },
      });

      // 2) Compose final image with title + legend via Canvas
      const mapImg = new Image();
      mapImg.src = mapDataUrl;
      await new Promise(r => { mapImg.onload = r; });

      const HEADER_H = 60;
      const FOOTER_H = 50;
      const canvas = document.createElement('canvas');
      canvas.width = mapImg.width;
      canvas.height = mapImg.height + HEADER_H * 2 + FOOTER_H * 2; // *2 because pixelRatio=2
      const ctx = canvas.getContext('2d')!;
      const pr = 2; // pixelRatio

      // Header background
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, HEADER_H * pr);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${16 * pr}px system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText('Sistema SCADA - Mapa GIS', 20 * pr, (HEADER_H * pr) / 2);

      // Date on right
      const now = new Date();
      const dateStr = now.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }) +
        ' ' + now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      ctx.font = `${11 * pr}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#94a3b8';
      const dateW = ctx.measureText(dateStr).width;
      ctx.fillText(dateStr, canvas.width - dateW - 20 * pr, (HEADER_H * pr) / 2);

      // Map image
      ctx.drawImage(mapImg, 0, HEADER_H * pr);

      // Footer background
      const footerY = HEADER_H * pr + mapImg.height;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, footerY, canvas.width, FOOTER_H * pr);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, footerY);
      ctx.lineTo(canvas.width, footerY);
      ctx.stroke();

      // Legend items
      const legendItems = [
        { color: '#22c55e', label: 'Operando' },
        { color: '#f59e0b', label: 'Sin gasto' },
        { color: '#ef4444', label: 'Sin comunicacion' },
        { color: '#94a3b8', label: 'Pendiente' },
      ];
      ctx.font = `${10 * pr}px system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = 'middle';
      let lx = 20 * pr;
      const ly = footerY + (FOOTER_H * pr) / 2;
      for (const item of legendItems) {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(lx + 5 * pr, ly, 4 * pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.fillText(item.label, lx + 14 * pr, ly);
        lx += ctx.measureText(item.label).width + 30 * pr;
      }

      // Scale info on right
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const scaleStr = `Zoom: ${zoom} | ${center.lat.toFixed(4)}N, ${center.lng.toFixed(4)}W`;
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${9 * pr}px system-ui, -apple-system, sans-serif`;
      const scaleW = ctx.measureText(scaleStr).width;
      ctx.fillText(scaleStr, canvas.width - scaleW - 20 * pr, ly);

      // Download
      const link = document.createElement('a');
      link.download = `mapa_scada_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export PNG failed:', err);
      alert('No se pudo exportar el mapa. Intenta con una captura de pantalla (Cmd+Shift+4).');
    }
    container.classList.remove('gis-exporting');
  }

  // ─────────────────────────────
  // SHARE VIEW (URL) — exact snapshot of what user sees
  // ─────────────────────────────

  shareView() {
    if (!this.map) return;
    // Use bounds (not center/zoom) so the view adapts to any screen size
    const bounds = this.map.getBounds();
    const params = new URLSearchParams({
      sw: `${bounds.getSouth().toFixed(6)},${bounds.getWest().toFixed(6)}`,
      ne: `${bounds.getNorth().toFixed(6)},${bounds.getEast().toFixed(6)}`,
      base: this.activeBase(),
    });

    // Capture layer visibility state
    const lv = this.layerVisible();
    const layerState = [
      lv.operando ? '1' : '0',
      lv.sinGasto ? '1' : '0',
      lv.sinCom ? '1' : '0',
      lv.obra ? '1' : '0',
      lv.inactivos ? '1' : '0',
      lv.pendientes ? '1' : '0',
      lv.redPrimaria ? '1' : '0',
      lv.redSecundaria ? '1' : '0',
      lv.zonas ? '1' : '0',
    ].join('');
    if (layerState !== '111111000') params.set('lv', layerState); // only if non-default

    // Capture filters
    if (this.filterMunicipio() > 0) params.set('fm', this.filterMunicipio().toString());
    if (this.filterSiteType()) params.set('ft', this.filterSiteType());
    if (this.filterMinFlow() > 0) params.set('ff', this.filterMinFlow().toString());
    if (this.filterOnlyAlarm()) params.set('fa', '1');

    // Capture visualization toggles
    if (this.heatmapVisible()) params.set('hm', '1');
    if (!this.miniMapVisible()) params.set('mm', '0'); // mini-map defaults to on

    // Serialize drawn items with custom properties
    if (this.drawnItems.getLayers().length > 0) {
      const features: any[] = [];
      this.drawnItems.eachLayer((layer: any) => {
        let feature: any;
        if (layer instanceof L.Marker) {
          const ll = layer.getLatLng();
          feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [ll.lng, ll.lat] }, properties: {} };
        } else if (layer.toGeoJSON) {
          feature = layer.toGeoJSON();
        }
        if (feature) {
          feature.properties = {
            _name: layer.__layerName || '',
            _type: layer.__layerType || '',
            _color: layer.__layerColor || layer.options?.color || this.drawColor(),
          };
          features.push(feature);
        }
      });
      if (features.length > 0) {
        const geojson = JSON.stringify({ type: 'FeatureCollection', features });
        params.set('d', btoa(unescape(encodeURIComponent(geojson))));
      }
    }

    const url = `${window.location.origin}/modulo-gis?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      this.shareToast.set(true);
      setTimeout(() => this.shareToast.set(false), 2000);
    }).catch(() => {});
  }

  /** Restore full view state from shared URL params */
  private restoreSharedState(qp: any) {
    // Restore layer visibility
    const lv = qp.get('lv');
    if (lv && lv.length === 9) {
      const vis = {
        operando: lv[0] === '1',
        sinGasto: lv[1] === '1',
        sinCom: lv[2] === '1',
        obra: lv[3] === '1',
        inactivos: lv[4] === '1',
        pendientes: lv[5] === '1',
        redPrimaria: lv[6] === '1',
        redSecundaria: lv[7] === '1',
        zonas: lv[8] === '1',
      };
      this.layerVisible.set(vis);
      // Apply layer visibility after data loads
      setTimeout(() => {
        if (!vis.operando) this.toggleLayer('operando');
        if (!vis.sinGasto) this.toggleLayer('sinGasto');
        if (!vis.sinCom) this.toggleLayer('sinCom');
        if (!vis.obra) this.toggleLayer('obra');
        if (!vis.inactivos) this.toggleLayer('inactivos');
        if (!vis.pendientes) this.toggleLayer('pendientes');
        if (vis.redPrimaria) this.toggleLayer('redPrimaria');
        if (vis.redSecundaria) this.toggleLayer('redSecundaria');
        if (vis.zonas) this.toggleLayer('zonas');
      }, 2000);
    }

    // Restore filters
    const fm = qp.get('fm');
    if (fm) this.filterMunicipio.set(+fm);
    const ft = qp.get('ft');
    if (ft) this.filterSiteType.set(ft);
    const ff = qp.get('ff');
    if (ff) this.filterMinFlow.set(+ff);
    if (qp.get('fa') === '1') this.filterOnlyAlarm.set(true);
    if (fm || ft || ff || qp.get('fa')) {
      setTimeout(() => this.applyFilters(), 2500);
    }

    // Restore heatmap
    if (qp.get('hm') === '1') {
      setTimeout(() => this.toggleHeatmap(), 1500);
    }

    // Restore mini-map
    if (qp.get('mm') === '0') {
      this.miniMapVisible.set(false);
    }
  }

  /** Restore drawn items from share URL param 'd' */
  private restoreSharedDrawings(encoded: string) {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const data = JSON.parse(json);
      if (!data?.features?.length) return;

      const color = this.drawColor();
      for (const feature of data.features) {
        const props = feature.properties || {};
        const layerColor = props._color || color;
        const layerName = props._name || '';
        const layerType = props._type || '';

        let layer: L.Layer | null = null;

        if (feature.geometry.type === 'Point') {
          const [lng, lat] = feature.geometry.coordinates;
          if (layerType === 'text' && layerName) {
            const icon = L.divIcon({
              className: 'gis-text-label',
              html: `<span style="color:${layerColor};border-color:${layerColor}">${this.escapeHtml(layerName)}</span>`,
              iconSize: [0, 0], iconAnchor: [0, 0],
            });
            layer = L.marker([lat, lng], { icon, draggable: true });
          } else {
            layer = L.marker([lat, lng], { draggable: true });
          }
        } else {
          const geoLayer = L.geoJSON(feature, {
            style: () => ({ color: layerColor, weight: 3, opacity: 0.8 }),
          });
          geoLayer.eachLayer((sub: any) => { layer = sub; });
        }

        if (layer) {
          (layer as any).__layerId = ++this.layerIdCounter;
          (layer as any).__layerType = layerType;
          (layer as any).__layerName = layerName;
          (layer as any).__layerColor = layerColor;
          this.drawnItems.addLayer(layer);
          this.makeLayerDraggable(layer as any);
          this.registerLayerSelection(layer);
          this.trackLayerAdd(layer);
        }
      }
    } catch { /* invalid shared data — ignore silently */ }
  }

  // ─────────────────────────────
  // GIS VIEWS (social network of saved map states)
  // ─────────────────────────────

  loadGisViews() {
    this.gisViewService.list().subscribe({
      next: (views) => this.gisViews.set(views),
      error: () => {}
    });
  }

  /** Capture the complete current map state into a serializable object */
  captureViewState(): GisViewState {
    if (!this.map) return {} as GisViewState;
    const bounds = this.map.getBounds();
    const lv = this.layerVisible();

    // Serialize drawn items with custom properties
    let drawnItems: any = null;
    if (this.drawnItems.getLayers().length > 0) {
      const features: any[] = [];
      this.drawnItems.eachLayer((layer: any) => {
        let feature: any;
        if (layer instanceof L.Marker) {
          const ll = layer.getLatLng();
          feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [ll.lng, ll.lat] }, properties: {} };
        } else if (layer.toGeoJSON) {
          feature = layer.toGeoJSON();
        }
        if (feature) {
          feature.properties = {
            _name: layer.__layerName || '',
            _type: layer.__layerType || '',
            _color: layer.__layerColor || layer.options?.color || this.drawColor(),
          };
          features.push(feature);
        }
      });
      if (features.length > 0) {
        drawnItems = { type: 'FeatureCollection', features };
      }
    }

    // Capture active GeoServer WMS layers
    const geoServerLayers: string[] = [];
    this.geoLayers().forEach(gl => {
      if (gl.visible) geoServerLayers.push(gl.name);
    });

    return {
      bounds: {
        sw: [bounds.getSouth(), bounds.getWest()],
        ne: [bounds.getNorth(), bounds.getEast()],
      },
      base: this.activeBase(),
      bearing: (this.map as any).getBearing?.() || 0,
      layerVisibility: [
        lv.operando, lv.sinGasto, lv.sinCom, lv.obra, lv.inactivos, lv.pendientes,
        lv.redPrimaria, lv.redSecundaria, lv.zonas,
      ].map(v => v ? '1' : '0').join(''),
      filterMunicipio: this.filterMunicipio(),
      filterSiteType: this.filterSiteType(),
      filterMinFlow: this.filterMinFlow(),
      filterOnlyAlarm: this.filterOnlyAlarm(),
      heatmapVisible: this.heatmapVisible(),
      miniMapVisible: this.miniMapVisible(),
      geoServerLayers,
      drawnItems,
    };
  }

  /** Restore a saved GIS view — replaces entire map state */
  restoreGisView(view: GisView) {
    if (!this.map) return;
    const vs = view.view_state;
    this.isSharedView = true; // suppress auto-zoom

    // Clear current drawn items
    this.deselectLayer();
    this.drawnItems.clearLayers();
    this.undoStack.length = 0;
    this.redoStack.length = 0;

    // Restore bounds
    this.map.fitBounds([vs.bounds.sw, vs.bounds.ne]);

    // Restore base map
    if (vs.base && vs.base !== this.activeBase()) {
      this.switchBase(vs.base);
    }

    // Restore bearing/rotation
    if (vs.bearing && (this.map as any).setBearing) {
      (this.map as any).setBearing(vs.bearing);
      this.mapBearing.set(Math.round(vs.bearing));
    }

    // Restore layer visibility
    if (vs.layerVisibility?.length === 9) {
      const vis = {
        operando: vs.layerVisibility[0] === '1',
        sinGasto: vs.layerVisibility[1] === '1',
        sinCom: vs.layerVisibility[2] === '1',
        obra: vs.layerVisibility[3] === '1',
        inactivos: vs.layerVisibility[4] === '1',
        pendientes: vs.layerVisibility[5] === '1',
        redPrimaria: vs.layerVisibility[6] === '1',
        redSecundaria: vs.layerVisibility[7] === '1',
        zonas: vs.layerVisibility[8] === '1',
      };
      this.layerVisible.set(vis);
      // Sync with actual layer groups after a short delay
      setTimeout(() => {
        const current = this.layerVisible();
        const keys = ['operando', 'sinGasto', 'sinCom', 'obra', 'inactivos', 'pendientes', 'redPrimaria', 'redSecundaria', 'zonas'] as const;
        keys.forEach(k => {
          const isOn = current[k];
          const shouldBeOn = vis[k];
          if (isOn !== shouldBeOn) this.toggleLayer(k);
        });
      }, 500);
    }

    // Restore filters
    this.filterMunicipio.set(vs.filterMunicipio || 0);
    this.filterSiteType.set(vs.filterSiteType || '');
    this.filterMinFlow.set(vs.filterMinFlow || 0);
    this.filterOnlyAlarm.set(vs.filterOnlyAlarm || false);
    if (vs.filterMunicipio || vs.filterSiteType || vs.filterMinFlow || vs.filterOnlyAlarm) {
      setTimeout(() => this.applyFilters(), 1000);
    }

    // Restore heatmap
    if (vs.heatmapVisible && !this.heatmapVisible()) {
      setTimeout(() => this.toggleHeatmap(), 800);
    } else if (!vs.heatmapVisible && this.heatmapVisible()) {
      this.toggleHeatmap();
    }

    // Restore minimap
    if (vs.miniMapVisible !== this.miniMapVisible()) {
      this.toggleMiniMap();
    }

    // Restore drawn items
    if (vs.drawnItems) {
      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(vs.drawnItems))));
      this.restoreSharedDrawings(encoded);
    }

    this.activeViewId.set(view.id);
    this.gisViewsPanelOpen.set(false);
  }

  saveCurrentView() {
    const name = this.saveViewName().trim();
    if (!name) return;
    const viewState = this.captureViewState();
    this.gisViewService.create({
      name,
      view_state: viewState,
      description: this.saveViewDesc().trim() || undefined,
      is_public: this.saveViewPublic(),
    }).subscribe({
      next: (saved) => {
        this.gisViews.update(list => [saved, ...list]);
        this.saveViewName.set('');
        this.saveViewDesc.set('');
        this.saveViewPublic.set(false);
        this.activeViewId.set(saved.id);
      },
      error: () => {}
    });
  }

  updateGisView(id: number) {
    const viewState = this.captureViewState();
    this.gisViewService.update(id, { view_state: viewState }).subscribe({
      next: (updated) => {
        this.gisViews.update(list => list.map(v => v.id === id ? updated : v));
      },
      error: () => {}
    });
  }

  deleteGisView(id: number) {
    this.gisViewService.delete(id).subscribe({
      next: () => {
        this.gisViews.update(list => list.filter(v => v.id !== id));
        if (this.activeViewId() === id) this.activeViewId.set(null);
      },
      error: () => {}
    });
  }

  // ─────────────────────────────
  // TEXT LABEL TOOL (inline editing — no prompt())
  // ─────────────────────────────
  addTextLabel() {
    this.cancelTool();
    this.activeTool.set('draw-point');
    this.setMapCrosshair(true);

    this.map.once('click', (e: L.LeafletMouseEvent) => {
      this.activeTool.set('none');
      this.setMapCrosshair(false);
      // Show inline input at the click position
      const pixel = this.map.latLngToContainerPoint(e.latlng);
      this.inlineTextInput.set({ latlng: e.latlng, pixel: { x: pixel.x, y: pixel.y } });
      this.inlineTextValue.set('');
    });
  }

  /** Called from the inline text input on Enter/blur */
  confirmInlineText() {
    const data = this.inlineTextInput();
    const text = this.inlineTextValue().trim();
    this.inlineTextInput.set(null);
    this.inlineTextValue.set('');
    if (!data || !text) return;

    const color = this.drawColor();
    const icon = L.divIcon({
      className: 'gis-text-label',
      html: `<span style="color:${color};border-color:${color}">${this.escapeHtml(text)}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    const marker = L.marker(data.latlng, { icon, draggable: true });
    (marker as any).__layerName = text;
    (marker as any).__layerType = 'text';
    (marker as any).__layerColor = color;
    (marker as any).__layerId = ++this.layerIdCounter;
    marker.addTo(this.drawnItems);
    this.registerLayerSelection(marker);
    this.trackLayerAdd(marker);
  }

  cancelInlineText() {
    this.inlineTextInput.set(null);
    this.inlineTextValue.set('');
    delete (this as any).__editingTextMarker;
  }

  /** Start inline editing on an existing text marker (double-click) */
  private startInlineEditOnMarker(marker: L.Marker) {
    const pixel = this.map.latLngToContainerPoint(marker.getLatLng());
    const currentText = (marker as any).__layerName || '';
    this.inlineTextInput.set({ latlng: marker.getLatLng(), pixel: { x: pixel.x, y: pixel.y } });
    this.inlineTextValue.set(currentText);
    // Tag that we're editing an existing marker
    (this as any).__editingTextMarker = marker;
  }

  /** Called from inline text input — handles both new and edit */
  confirmInlineTextOrEdit() {
    const editingMarker = (this as any).__editingTextMarker as L.Marker | undefined;
    if (editingMarker) {
      this.confirmInlineTextEdit(editingMarker);
    } else {
      this.confirmInlineText();
    }
  }

  /** Confirm editing an existing text label */
  private confirmInlineTextEdit(marker: L.Marker) {
    const newText = this.inlineTextValue().trim();
    const prevText = (marker as any).__layerName || '';
    const prevName = prevText;
    this.inlineTextInput.set(null);
    this.inlineTextValue.set('');
    delete (this as any).__editingTextMarker;

    if (!newText || newText === prevText) return;

    const color = (marker as any).__layerColor || this.drawColor();
    const icon = L.divIcon({
      className: 'gis-text-label',
      html: `<span style="color:${color};border-color:${color}">${this.escapeHtml(newText)}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    marker.setIcon(icon);
    (marker as any).__layerName = newText;

    // Track in undo
    this.undoStack.push({ action: 'text-edit', layer: marker, meta: { prevText, newText, prevName, newName: newText, color } });
    this.redoStack.length = 0;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─────────────────────────────
  // LAYER SELECTION + PANEL
  // ─────────────────────────────

  /** Register click-to-select, dblclick-to-edit, and marker drag tracking on a drawn layer */
  private registerLayerSelection(layer: L.Layer) {
    layer.on('click', (e: any) => {
      if (this.activeTool() !== 'none') return;
      L.DomEvent.stopPropagation(e);
      this.selectLayer(layer);
    });
    layer.on('dblclick', (e: any) => {
      if (this.activeTool() !== 'none') return;
      L.DomEvent.stopPropagation(e);
      // Double-click on text label → inline edit
      if ((layer as any).__layerType === 'text') {
        this.startInlineEditOnMarker(layer as L.Marker);
        return;
      }
      this.deselectLayer();
      this.startEditMode();
    });

    // Track marker drag (for undo)
    if (layer instanceof L.Marker && (layer as any).options?.draggable) {
      let prevLatLng: L.LatLng;
      layer.on('dragstart', () => {
        prevLatLng = L.latLng(layer.getLatLng().lat, layer.getLatLng().lng);
      });
      layer.on('dragend', () => {
        const newLatLng = layer.getLatLng();
        this.undoStack.push({ action: 'move-marker', layer, meta: { prevLatLng, newLatLng: L.latLng(newLatLng.lat, newLatLng.lng) } });
        this.redoStack.length = 0;
      });
    }
  }

  selectLayer(layer: L.Layer) {
    this.deselectLayer();
    this.selectedLayer.set(layer);
    // Visual highlight
    if ((layer as any).setStyle) {
      (layer as any).__prevStyle = {
        weight: (layer as any).options?.weight,
        opacity: (layer as any).options?.opacity,
        dashArray: (layer as any).options?.dashArray,
      };
      (layer as any).setStyle({ weight: 4, opacity: 1, dashArray: '6 4' });
    }
    if (layer instanceof L.Marker) {
      const el = (layer as any)._icon;
      if (el) el.classList.add('ft-layer-selected');
    }
  }

  deselectLayer() {
    const prev = this.selectedLayer();
    if (!prev) return;
    // Restore style
    if ((prev as any).setStyle && (prev as any).__prevStyle) {
      (prev as any).setStyle((prev as any).__prevStyle);
      delete (prev as any).__prevStyle;
    }
    if (prev instanceof L.Marker) {
      const el = (prev as any)._icon;
      if (el) el.classList.remove('ft-layer-selected');
    }
    this.selectedLayer.set(null);
  }

  removeDrawnLayer(layer: L.Layer) {
    this.deselectLayer();
    this.drawnItems.removeLayer(layer);
    this.undoStack.push({ action: 'remove', layer, meta: null });
    this.redoStack.length = 0;
    // Refresh query — polygon may have been the one with results
    this.refreshPolygonQueries();
  }

  /** Re-query all polygons in drawnItems to refresh the query panel */
  private refreshPolygonQueries() {
    let found = false;
    this.drawnItems.eachLayer((layer: any) => {
      if (!found && layer instanceof L.Polygon && (layer as any).__layerType === 'polygon') {
        this.querySitesInPolygon(layer);
        found = true;
      }
    });
    if (!found) {
      this.queryResults.set([]);
      this.queryPanelOpen.set(false);
    }
  }

  /** Track a layer addition for undo */
  private trackLayerAdd(layer: L.Layer) {
    this.undoStack.push({ action: 'add', layer, meta: null });
    this.redoStack.length = 0;
  }

  undoDrawAction() {
    const entry = this.undoStack.pop();
    if (!entry) return;
    this.deselectLayer();

    switch (entry.action) {
      case 'add':
        this.drawnItems.removeLayer(entry.layer);
        break;
      case 'remove':
        this.drawnItems.addLayer(entry.layer);
        break;
      case 'move':
      case 'edit-vertices':
        if ((entry.layer as any).setLatLngs) {
          (entry.layer as any).setLatLngs(this.deserializeLatLngs(entry.meta.prevLatLngs));
          this.rebuildEditHandler(entry.layer);
        }
        break;
      case 'move-marker':
        if (entry.layer instanceof L.Marker) {
          entry.layer.setLatLng(entry.meta.prevLatLng);
        }
        break;
      case 'color-change':
        this.applyColorToLayer(entry.layer, entry.meta.prevColor);
        break;
      case 'text-edit':
        if (entry.layer instanceof L.Marker) {
          const color = entry.meta.color || this.drawColor();
          const icon = L.divIcon({
            className: 'gis-text-label',
            html: `<span style="color:${color};border-color:${color}">${this.escapeHtml(entry.meta.prevText)}</span>`,
            iconSize: [0, 0], iconAnchor: [0, 0],
          });
          entry.layer.setIcon(icon);
          (entry.layer as any).__layerName = entry.meta.prevName;
        }
        break;
      case 'rename':
        (entry.layer as any).__layerName = entry.meta.prevName;
        break;
    }
    this.redoStack.push(entry);
    this.refreshPolygonQueries();
  }

  redoDrawAction() {
    const entry = this.redoStack.pop();
    if (!entry) return;
    this.deselectLayer();

    switch (entry.action) {
      case 'add':
        this.drawnItems.addLayer(entry.layer);
        break;
      case 'remove':
        this.drawnItems.removeLayer(entry.layer);
        break;
      case 'move':
      case 'edit-vertices':
        if ((entry.layer as any).setLatLngs) {
          (entry.layer as any).setLatLngs(this.deserializeLatLngs(entry.meta.newLatLngs));
          this.rebuildEditHandler(entry.layer);
        }
        break;
      case 'move-marker':
        if (entry.layer instanceof L.Marker) {
          entry.layer.setLatLng(entry.meta.newLatLng);
        }
        break;
      case 'color-change':
        this.applyColorToLayer(entry.layer, entry.meta.newColor);
        break;
      case 'text-edit':
        if (entry.layer instanceof L.Marker) {
          const color = entry.meta.color || this.drawColor();
          const icon = L.divIcon({
            className: 'gis-text-label',
            html: `<span style="color:${color};border-color:${color}">${this.escapeHtml(entry.meta.newText)}</span>`,
            iconSize: [0, 0], iconAnchor: [0, 0],
          });
          entry.layer.setIcon(icon);
          (entry.layer as any).__layerName = entry.meta.newName;
        }
        break;
      case 'rename':
        (entry.layer as any).__layerName = entry.meta.newName;
        break;
    }
    this.undoStack.push(entry);
    this.refreshPolygonQueries();
  }

  /** Rebuild leaflet-draw edit handler after undo/redo of coordinates */
  private rebuildEditHandler(layer: any) {
    const gL = (window as any).L;
    if (layer.editing) {
      try { layer.editing.disable(); } catch { /* ignore */ }
    }
    if ((layer instanceof L.Polygon || layer instanceof L.Polyline) && gL?.Edit?.Poly) {
      (layer as any).editing = new gL.Edit.Poly(layer);
    }
    // Re-anchor tooltip
    const tip = layer.getTooltip?.();
    if (tip && layer.getCenter) {
      tip.setLatLng(layer.getCenter());
    }
  }

  /** Convert serialized latlng arrays back to L.LatLng objects */
  private deserializeLatLngs(data: any): any {
    if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
      return data.map((ring: any) => this.deserializeLatLngs(ring));
    }
    return data.map((ll: any) => L.latLng(ll.lat, ll.lng));
  }

  /** Apply color to a layer (polygon/polyline stroke, text label color) */
  private applyColorToLayer(layer: L.Layer, color: string) {
    if ((layer as any).__layerType === 'text' && layer instanceof L.Marker) {
      const text = (layer as any).__layerName || '';
      const icon = L.divIcon({
        className: 'gis-text-label',
        html: `<span style="color:${color};border-color:${color}">${this.escapeHtml(text)}</span>`,
        iconSize: [0, 0], iconAnchor: [0, 0],
      });
      layer.setIcon(icon);
      (layer as any).__layerColor = color;
    } else if ((layer as any).setStyle) {
      (layer as any).setStyle({ color });
    }
  }

  /** Change color of a selected layer (called when clicking color swatch with selection active) */
  changeSelectedLayerColor(color: string) {
    const layer = this.selectedLayer();
    if (!layer) return;
    const prevColor = (layer as any).__layerColor || (layer as any).options?.color || this.drawColor();
    if (prevColor === color) return;
    this.applyColorToLayer(layer, color);
    (layer as any).__layerColor = color;
    this.undoStack.push({ action: 'color-change', layer, meta: { prevColor, newColor: color } });
    this.redoStack.length = 0;
  }

  /** Get list of drawn layers for the panel */
  getDrawnLayersList(): { id: number; type: string; name: string; layer: L.Layer; visible: boolean }[] {
    const layers: { id: number; type: string; name: string; layer: L.Layer; visible: boolean }[] = [];
    this.drawnItems.eachLayer((layer: any) => {
      const id = layer.__layerId || 0;
      const type = layer.__layerType || (layer instanceof L.Marker ? 'marker' : layer instanceof L.Polygon ? 'polygon' : 'polyline');
      const name = layer.__layerName || this.inferLayerName(layer);
      const visible = this.map.hasLayer(layer);
      layers.push({ id, type, name, layer, visible });
    });
    return layers.reverse(); // newest on top (Figma convention)
  }

  private inferLayerName(layer: any): string {
    const tip = layer.getTooltip?.();
    if (tip) {
      const content = tip.getContent?.();
      if (content) return String(content);
    }
    if (layer instanceof L.Polygon) return 'Poligono';
    if (layer instanceof L.Polyline) return 'Linea';
    if (layer instanceof L.Marker) return 'Punto';
    return 'Forma';
  }

  toggleLayerVisibility(layer: L.Layer) {
    if (this.map.hasLayer(layer)) {
      this.map.removeLayer(layer);
    } else {
      layer.addTo(this.map);
    }
  }

  /** Reorder layer z-index: move up in the list = bring to front on map */
  moveLayerUp(layer: L.Layer) {
    const layers = this.getOrderedLayers();
    const idx = layers.indexOf(layer);
    if (idx <= 0) return; // already at top
    // Swap z-order by re-adding in correct sequence
    this.reorderLayers(layers, idx, idx - 1);
  }

  moveLayerDown(layer: L.Layer) {
    const layers = this.getOrderedLayers();
    const idx = layers.indexOf(layer);
    if (idx < 0 || idx >= layers.length - 1) return; // already at bottom
    this.reorderLayers(layers, idx, idx + 1);
  }

  /** Get layers in current z-order (bottom to top) */
  private getOrderedLayers(): L.Layer[] {
    const layers: L.Layer[] = [];
    this.drawnItems.eachLayer((l: L.Layer) => layers.push(l));
    return layers;
  }

  /** Swap two layers and re-add all to enforce z-order */
  private reorderLayers(layers: L.Layer[], fromIdx: number, toIdx: number) {
    const [moved] = layers.splice(fromIdx, 1);
    layers.splice(toIdx, 0, moved);
    // Remove all and re-add in new order
    layers.forEach(l => this.drawnItems.removeLayer(l));
    layers.forEach(l => this.drawnItems.addLayer(l));
  }

  // Drag-and-drop state for layers panel
  private dragLayerId: number | null = null;

  onLayerDragStart(event: DragEvent, layerId: number) {
    this.dragLayerId = layerId;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(layerId));
    }
    (event.target as HTMLElement)?.classList.add('ft-layer-row--dragging');
  }

  onLayerDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  onLayerDragEnter(event: DragEvent, targetId: number) {
    if (targetId !== this.dragLayerId) {
      (event.currentTarget as HTMLElement)?.classList.add('ft-layer-row--dragover');
    }
  }

  onLayerDragLeave(event: DragEvent) {
    (event.currentTarget as HTMLElement)?.classList.remove('ft-layer-row--dragover');
  }

  onLayerDrop(event: DragEvent, targetId: number) {
    event.preventDefault();
    (event.currentTarget as HTMLElement)?.classList.remove('ft-layer-row--dragover');
    if (this.dragLayerId == null || this.dragLayerId === targetId) return;

    const layers = this.getOrderedLayers();
    const fromIdx = layers.findIndex(l => (l as any).__layerId === this.dragLayerId);
    const toIdx = layers.findIndex(l => (l as any).__layerId === targetId);
    if (fromIdx >= 0 && toIdx >= 0) {
      this.reorderLayers(layers, fromIdx, toIdx);
    }
    this.dragLayerId = null;
  }

  onLayerDragEnd(event: DragEvent) {
    (event.target as HTMLElement)?.classList.remove('ft-layer-row--dragging');
    this.dragLayerId = null;
  }

  /** Start inline rename in the layers panel (no prompt) */
  startRenameLayer(layer: L.Layer) {
    const id = (layer as any).__layerId || 0;
    const current = (layer as any).__layerName || '';
    this.editingLayerId.set(id);
    this.editingLayerValue.set(current);
  }

  /** Confirm inline rename */
  confirmRenameLayer(layer: L.Layer) {
    const newName = this.editingLayerValue().trim();
    const prevName = (layer as any).__layerName || '';
    this.editingLayerId.set(null);
    if (!newName || newName === prevName) return;
    (layer as any).__layerName = newName;
    // Track in undo
    this.undoStack.push({ action: 'rename', layer, meta: { prevName, newName } });
    this.redoStack.length = 0;
  }

  cancelRenameLayer() {
    this.editingLayerId.set(null);
    this.editingLayerValue.set('');
  }
}
