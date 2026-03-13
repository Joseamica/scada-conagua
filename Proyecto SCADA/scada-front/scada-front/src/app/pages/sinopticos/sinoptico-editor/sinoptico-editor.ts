import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroSquares2x2,
  heroCloudArrowUp,
  heroArrowUturnLeft,
  heroArrowUturnRight,
  heroTag,
  heroChartBarSquare,
  heroMapPin,
  heroTableCells,
  heroPhoto,
  heroRectangleGroup,
  heroPlus,
  heroTrash,
  heroClock,
  heroArrowDownTray,
  heroDocumentText,
  heroStop,
  heroArrowTopRightOnSquare,
  heroShare,
  heroXMark,
  heroCalculator,
  heroBellAlert,
} from '@ng-icons/heroicons/outline';
import {
  SinopticoService,
  Sinoptico,
  SinopticoShare,
  CanvasWidget,
  LabelConfig,
  ChartConfig,
  MapConfig,
  TableConfig,
  HeaderConfig,
  ImageConfig,
  TextConfig,
  ShapeConfig,
  LinkConfig,
  ClockConfig,
  VariableConfig,
  AlarmConfig,
} from '../../../core/services/sinoptico.service';
import { EditorStore } from './store/editor-store';
import { SinopticoDataStore } from './store/sinoptico-data-store';
import { WidgetWrapper } from './components/widget-wrapper/widget-wrapper';
import { LabelWidget } from '../shared/widget-renderers/label-widget';
import { ChartWidget } from '../shared/widget-renderers/chart-widget';
import { MapWidget } from '../shared/widget-renderers/map-widget';
import { TableWidget } from '../shared/widget-renderers/table-widget';
import { HeaderWidget } from '../shared/widget-renderers/header-widget';
import { ImageWidget } from '../shared/widget-renderers/image-widget';
import { TextWidget } from '../shared/widget-renderers/text-widget';
import { ShapeWidget } from '../shared/widget-renderers/shape-widget';
import { LinkWidget } from '../shared/widget-renderers/link-widget';
import { ClockWidget } from '../shared/widget-renderers/clock-widget';
import { VariableWidget } from '../shared/widget-renderers/variable-widget';
import { AlarmWidget } from '../shared/widget-renderers/alarm-widget';
import { TagBrowser, TagSelection } from '../shared/tag-browser/tag-browser';
import { VariableService, VariableView, VariableViewDetail } from '../../../core/services/variable.service';
import { ActivityPanel } from '../shared/activity-panel/activity-panel';

interface PaletteItem {
  type: CanvasWidget['type'];
  label: string;
  icon: string;
}

const SERIES_COLORS = [
  '#6d002b', '#2563eb', '#059669', '#d97706', '#7c3aed',
  '#dc2626', '#0891b2', '#4f46e5', '#15803d', '#c2410c',
];

@Component({
  selector: 'app-sinoptico-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIconComponent,
    WidgetWrapper,
    LabelWidget,
    ChartWidget,
    MapWidget,
    TableWidget,
    HeaderWidget,
    ImageWidget,
    TextWidget,
    ShapeWidget,
    LinkWidget,
    ClockWidget,
    VariableWidget,
    AlarmWidget,
    TagBrowser,
    ActivityPanel,
  ],
  providers: [
    EditorStore,
    SinopticoDataStore,
    provideIcons({
      heroArrowLeft,
      heroSquares2x2,
      heroCloudArrowUp,
      heroArrowUturnLeft,
      heroArrowUturnRight,
      heroTag,
      heroChartBarSquare,
      heroMapPin,
      heroTableCells,
      heroPhoto,
      heroRectangleGroup,
      heroPlus,
      heroTrash,
      heroClock,
      heroArrowDownTray,
      heroDocumentText,
      heroStop,
      heroArrowTopRightOnSquare,
      heroShare,
      heroXMark,
      heroCalculator,
      heroBellAlert,
    }),
  ],
  templateUrl: './sinoptico-editor.html',
  styleUrl: './sinoptico-editor.css',
})
export class SinopticoEditor implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sinopticoService = inject(SinopticoService);
  private variableService = inject(VariableService);
  store = inject(EditorStore);
  dataStore = inject(SinopticoDataStore);

  @ViewChild('canvasInner') canvasInner!: ElementRef<HTMLDivElement>;

  sinoptico = signal<Sinoptico | null>(null);
  loading = signal(true);
  saving = signal(false);
  gridVisible = signal(true);

  canvasWidth = computed(() => this.sinoptico()?.canvas_width ?? 1920);
  canvasHeight = computed(() => this.sinoptico()?.canvas_height ?? 1080);

  // Alignment & grouping UI
  showAlignPopover = signal(false);
  multiSelected = computed(() => this.store.selectedWidgets().length >= 2);
  tripleSelected = computed(() => this.store.selectedWidgets().length >= 3);

  // Activity panel
  showActivityPanel = signal(false);

  // Context menu
  contextMenu = signal<{ x: number; y: number; widgetId: string | null } | null>(null);

  // Canvas & grid settings
  showCanvasSettings = signal(false);
  showGridSettings = signal(false);

  // Snap guides
  snapGuides = signal<{ type: 'h' | 'v'; pos: number }[]>([]);
  private readonly SNAP_THRESHOLD = 5;

  // Link widget: available sinopticos
  availableSinopticos = signal<{ id: number; name: string }[]>([]);

  // Variable widget: available views & detail cache
  availableViews = signal<VariableView[]>([]);
  variableViewDetail = signal<VariableViewDetail | null>(null);

  // Sharing dialog
  showShareDialog = signal(false);
  shares = signal<SinopticoShare[]>([]);
  shareCandidates = signal<{ id: number; full_name: string; email: string }[]>([]);
  shareSearchQuery = '';
  selectedCandidateId = 0;
  sharePermission: 'read' | 'edit' = 'read';

  paletteItems: PaletteItem[] = [
    { type: 'label', label: 'Etiqueta', icon: 'heroTag' },
    { type: 'chart', label: 'Grafico', icon: 'heroChartBarSquare' },
    { type: 'map', label: 'Mapa', icon: 'heroMapPin' },
    { type: 'table', label: 'Tabla', icon: 'heroTableCells' },
    { type: 'header', label: 'Encabezado', icon: 'heroRectangleGroup' },
    { type: 'image', label: 'Imagen', icon: 'heroPhoto' },
    { type: 'text', label: 'Texto', icon: 'heroDocumentText' },
    { type: 'shape', label: 'Forma', icon: 'heroStop' },
    { type: 'link', label: 'Enlace', icon: 'heroArrowTopRightOnSquare' },
    { type: 'clock', label: 'Reloj', icon: 'heroClock' },
    { type: 'variable', label: 'Variable', icon: 'heroCalculator' },
    { type: 'alarm', label: 'Alarmas', icon: 'heroBellAlert' },
  ];

  // Auto-save
  private readonly AUTO_SAVE_DELAY = 30_000; // 30 seconds
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private timeAgoTimer: ReturnType<typeof setInterval> | null = null;
  lastAutoSave = signal<Date | null>(null);
  savedTimeAgo = signal<string | null>(null);

  private autoSaveEffect = effect(() => {
    const dirty = this.store.dirty();
    const loading = this.loading();
    if (dirty && !loading) {
      this.scheduleAutoSave();
    }
  });

  private isDragging = false;
  private dragOrigins = new Map<string, { x: number; y: number }>();

  // Marquee selection
  marquee = signal<{ x: number; y: number; w: number; h: number } | null>(null);
  private marqueeStart: { clientX: number; clientY: number; canvasX: number; canvasY: number } | null = null;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.sinopticoService.getSinoptico(id).subscribe({
      next: (data) => {
        this.sinoptico.set(data);
        this.store.loadCanvas(
          data.canvas || { widgets: [], grid: { snap: true, size: 10 }, zoom: 1 },
        );
        this.loading.set(false);
        // Start data polling
        this.dataStore.startPolling(data.id, this.store.widgets());
        // Load available views for variable widget
        this.variableService.getViews().subscribe((views) => this.availableViews.set(views));
        // Load all accessible sinopticos for link widget dropdown
        this.sinopticoService.getAllSinopticos().subscribe({
          next: (list) => {
            this.availableSinopticos.set(
              list.filter((s) => +s.id !== +data.id).map((s) => ({
                id: s.id,
                name: s.project_name ? `${s.project_name} / ${s.name}` : s.name,
              })),
            );
          },
          error: () => {},
        });
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/sinopticos']);
      },
    });

    // Tick every 15s to update "hace X min" label
    this.timeAgoTimer = setInterval(() => this.updateTimeAgo(), 15_000);
  }

  ngOnDestroy(): void {
    this.dataStore.stopPolling();
    this.clearAutoSave();
    if (this.timeAgoTimer) clearInterval(this.timeAgoTimer);
  }

  // ===== TOOLBAR =====

  save(): void {
    const s = this.sinoptico();
    if (!s) return;
    this.clearAutoSave();
    this.saving.set(true);
    const canvas = this.store.getCanvasState();
    this.sinopticoService.saveSinoptico(s.id, {
      canvas: canvas as any,
      canvas_width: s.canvas_width,
      canvas_height: s.canvas_height,
      canvas_bg: s.canvas_bg,
    }).subscribe({
      next: (result) => {
        this.sinoptico.update((prev) =>
          prev ? { ...prev, version: result.version, updated_at: result.updated_at } : prev,
        );
        this.store.markSaved();
        this.saving.set(false);
        this.lastAutoSave.set(new Date());
        this.updateTimeAgo();
      },
      error: () => this.saving.set(false),
    });
  }

  private scheduleAutoSave(): void {
    this.clearAutoSave();
    this.autoSaveTimer = setTimeout(() => this.autoSave(), this.AUTO_SAVE_DELAY);
  }

  private clearAutoSave(): void {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private updateTimeAgo(): void {
    const last = this.lastAutoSave();
    if (!last) { this.savedTimeAgo.set(null); return; }
    const secs = Math.floor((Date.now() - last.getTime()) / 1000);
    if (secs < 10) this.savedTimeAgo.set('hace un momento');
    else if (secs < 60) this.savedTimeAgo.set(`hace ${secs}s`);
    else if (secs < 3600) this.savedTimeAgo.set(`hace ${Math.floor(secs / 60)} min`);
    else this.savedTimeAgo.set(`hace ${Math.floor(secs / 3600)}h`);
  }

  private autoSave(): void {
    if (!this.store.dirty() || this.saving()) return;
    const s = this.sinoptico();
    if (!s) return;
    this.saving.set(true);
    const canvas = this.store.getCanvasState();
    this.sinopticoService.saveSinoptico(s.id, {
      canvas: canvas as any,
      canvas_width: s.canvas_width,
      canvas_height: s.canvas_height,
      canvas_bg: s.canvas_bg,
    }).subscribe({
      next: (result) => {
        this.sinoptico.update((prev) =>
          prev ? { ...prev, version: result.version, updated_at: result.updated_at } : prev,
        );
        this.store.markSaved();
        this.saving.set(false);
        this.lastAutoSave.set(new Date());
        this.updateTimeAgo();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleGrid(): void {
    this.gridVisible.update((v) => !v);
  }

  toggleSettingsPopover(): void {
    const anyOpen = this.showGridSettings() || this.showCanvasSettings();
    if (anyOpen) {
      this.showGridSettings.set(false);
      this.showCanvasSettings.set(false);
    } else {
      this.showGridSettings.set(true);
    }
  }

  zoomIn(): void {
    this.store.setZoom(this.store.zoom() + 0.1);
  }

  zoomOut(): void {
    this.store.setZoom(this.store.zoom() - 0.1);
  }

  resetZoom(): void {
    this.store.setZoom(1);
  }

  goBack(): void {
    if (this.store.dirty() && !confirm('Hay cambios sin guardar. Salir?')) return;
    const projectId = this.sinoptico()?.project_id;
    if (projectId) {
      this.router.navigate(['/sinopticos/proyecto', projectId]);
    } else {
      this.router.navigate(['/sinopticos']);
    }
  }

  // ===== PALETTE DRAG → CANVAS =====

  onDragStart(event: DragEvent, type: string): void {
    event.dataTransfer?.setData('widget-type', type);
    event.dataTransfer!.effectAllowed = 'copy';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    const type = event.dataTransfer?.getData('widget-type') as CanvasWidget['type'];
    if (!type) return;

    const canvasEl = this.canvasInner?.nativeElement;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const zoom = this.store.zoom();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;

    this.store.addWidget(type, Math.max(0, x), Math.max(0, y));
  }

  addWidgetAtCenter(type: CanvasWidget['type']): void {
    const w = this.canvasWidth();
    const h = this.canvasHeight();
    this.store.addWidget(type, w / 2 - 100, h / 2 - 50);
  }

  // ===== CANVAS CLICK / MARQUEE =====

  onCanvasMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('.widget-wrapper')) return;
    if (event.button !== 0) return;

    this.showAlignPopover.set(false);

    // Start marquee selection
    const canvasEl = (event.currentTarget as HTMLElement);
    const rect = canvasEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.marqueeStart = { clientX: event.clientX, clientY: event.clientY, canvasX: x, canvasY: y };
    this.marquee.set(null);

    if (!event.shiftKey) {
      this.store.clearSelection();
    }

    const onMove = (e: MouseEvent) => {
      if (!this.marqueeStart) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const sx = this.marqueeStart.canvasX;
      const sy = this.marqueeStart.canvasY;
      this.marquee.set({
        x: Math.min(sx, mx),
        y: Math.min(sy, my),
        w: Math.abs(mx - sx),
        h: Math.abs(my - sy),
      });
    };

    const onUp = (e: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);

      const m = this.marquee();
      if (m && (m.w > 5 || m.h > 5)) {
        // Select widgets that intersect with marquee
        const zoom = this.store.zoom();
        // Convert marquee coords from zoomed canvas space to widget space
        const mLeft = m.x / zoom;
        const mTop = m.y / zoom;
        const mRight = (m.x + m.w) / zoom;
        const mBottom = (m.y + m.h) / zoom;

        for (const w of this.store.widgets()) {
          const wRight = w.x + w.width;
          const wBottom = w.y + w.height;
          if (w.x < mRight && wRight > mLeft && w.y < mBottom && wBottom > mTop) {
            this.store.select(w.id, true);
          }
        }
      }

      this.marquee.set(null);
      this.marqueeStart = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ===== WIDGET EVENTS =====

  onWidgetSelect(id: string, event: MouseEvent): void {
    this.store.select(id, event.shiftKey);
    this.store.beginBatch();
    this.isDragging = true;
    // Capture all selected positions for group drag
    this.dragOrigins.clear();
    for (const w of this.store.selectedWidgets()) {
      this.dragOrigins.set(w.id, { x: w.x, y: w.y });
    }
  }

  onWidgetMove(id: string, pos: { x: number; y: number }): void {
    const origin = this.dragOrigins.get(id);
    if (!origin) {
      this.store.moveWidgetDirect(id, pos.x, pos.y);
      return;
    }
    let dx = pos.x - origin.x;
    let dy = pos.y - origin.y;

    // Compute snap guides
    const moving = this.store.widgets().find((w) => w.id === id);
    if (moving) {
      const others = this.store.widgets().filter((w) => !this.dragOrigins.has(w.id));
      const guides: { type: 'h' | 'v'; pos: number }[] = [];
      const threshold = this.SNAP_THRESHOLD / this.store.zoom();

      const mx = origin.x + dx;
      const my = origin.y + dy;
      const mRight = mx + moving.width;
      const mBottom = my + moving.height;
      const mCenterX = mx + moving.width / 2;
      const mCenterY = my + moving.height / 2;

      let snapDx = 0;
      let snapDy = 0;
      let foundV = false;
      let foundH = false;

      for (const o of others) {
        const oRight = o.x + o.width;
        const oBottom = o.y + o.height;
        const oCenterX = o.x + o.width / 2;
        const oCenterY = o.y + o.height / 2;

        if (!foundV) {
          const vChecks = [
            { from: mx, to: o.x },
            { from: mx, to: oRight },
            { from: mRight, to: o.x },
            { from: mRight, to: oRight },
            { from: mCenterX, to: oCenterX },
          ];
          for (const c of vChecks) {
            if (Math.abs(c.from - c.to) < threshold) {
              snapDx = c.to - c.from;
              guides.push({ type: 'v', pos: c.to });
              foundV = true;
              break;
            }
          }
        }

        if (!foundH) {
          const hChecks = [
            { from: my, to: o.y },
            { from: my, to: oBottom },
            { from: mBottom, to: o.y },
            { from: mBottom, to: oBottom },
            { from: mCenterY, to: oCenterY },
          ];
          for (const c of hChecks) {
            if (Math.abs(c.from - c.to) < threshold) {
              snapDy = c.to - c.from;
              guides.push({ type: 'h', pos: c.to });
              foundH = true;
              break;
            }
          }
        }
      }

      dx += snapDx;
      dy += snapDy;
      this.snapGuides.set(guides);
    }

    for (const [wid, orig] of this.dragOrigins) {
      this.store.moveWidgetDirect(wid, orig.x + dx, orig.y + dy);
    }
  }

  onWidgetResize(
    id: string,
    dim: { width: number; height: number; x: number; y: number },
  ): void {
    this.store.resizeWidgetDirect(id, dim.width, dim.height, dim.x, dim.y);
  }

  @HostListener('window:mouseup')
  onGlobalMouseUp(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.store.commitBatch();
      this.snapGuides.set([]);
    }
  }

  // ===== CONFIG PANEL =====

  getWidgetTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      label: 'Etiqueta',
      chart: 'Grafico',
      map: 'Mapa',
      table: 'Tabla',
      header: 'Encabezado',
      image: 'Imagen',
      text: 'Texto',
      shape: 'Forma',
      link: 'Enlace',
      clock: 'Reloj',
      variable: 'Variable',
      alarm: 'Alarmas',
    };
    return labels[type] || type;
  }

  updateConfig(id: string, key: string, event: Event, isNumber = false): void {
    const el = event.target as HTMLInputElement | HTMLSelectElement;
    let value: any;
    if (el.type === 'checkbox') value = (el as HTMLInputElement).checked;
    else if (isNumber) value = Number(el.value);
    else value = el.value;
    this.store.updateWidgetConfig(id, { [key]: value });
  }

  updateMapCenter(id: string, index: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    const widget = this.store.widgets().find((w) => w.id === id);
    if (!widget) return;
    const config = widget.config as MapConfig;
    const center: [number, number] = [...config.center];
    center[index] = Number(el.value);
    this.store.updateWidgetConfig(id, { center });
  }

  // ===== TAG BROWSER HANDLERS =====

  onLabelTagSelect(widgetId: string, tag: TagSelection): void {
    if (tag.source === 'view') {
      this.store.updateWidgetConfig(widgetId, {
        source: 'view',
        viewId: tag.viewId,
        formulaId: tag.formulaId,
        formulaAlias: tag.formulaAlias,
        title: tag.formulaAlias || 'Formula',
        devEUI: '',
        measurement: '',
      });
    } else {
      this.store.updateWidgetConfig(widgetId, {
        source: 'tag',
        viewId: undefined,
        formulaId: undefined,
        formulaAlias: undefined,
        devEUI: tag.devEUI,
        measurement: tag.measurement,
        title: `${tag.siteName} - ${tag.measurement}`,
      });
    }
    this.refreshData();
  }

  // ===== CHART SERIES MANAGEMENT =====

  addChartSeries(widgetId: string, tag: TagSelection): void {
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as ChartConfig;
    const seriesIndex = cfg.series.length;
    const newSeries = {
      devEUI: tag.devEUI,
      measurement: tag.measurement,
      label:
        tag.source === 'view'
          ? (tag.formulaAlias || 'Formula')
          : `${tag.siteName} / ${tag.measurement}`,
      color: SERIES_COLORS[seriesIndex % SERIES_COLORS.length],
      lineType: 'line' as const,
      yAxisIndex: 0,
      source: tag.source || 'tag',
      viewId: tag.viewId,
      formulaId: tag.formulaId,
      formulaAlias: tag.formulaAlias,
    };
    this.store.updateWidgetConfig(widgetId, { series: [...cfg.series, newSeries] });
    this.refreshData();
  }

  removeChartSeries(widgetId: string, index: number): void {
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as ChartConfig;
    const series = [...cfg.series];
    series.splice(index, 1);
    this.store.updateWidgetConfig(widgetId, { series });
    this.refreshData();
  }

  updateSeriesColor(widgetId: string, index: number, event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as ChartConfig;
    const series = [...cfg.series];
    series[index] = { ...series[index], color };
    this.store.updateWidgetConfig(widgetId, { series });
  }

  updateSeriesLineType(widgetId: string, index: number, event: Event): void {
    const lineType = (event.target as HTMLSelectElement).value as 'line' | 'bar' | 'area';
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as ChartConfig;
    const series = [...cfg.series];
    series[index] = { ...series[index], lineType };
    this.store.updateWidgetConfig(widgetId, { series });
  }

  updateSeriesLabel(widgetId: string, index: number, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as ChartConfig;
    const series = [...cfg.series];
    series[index] = { ...series[index], label };
    this.store.updateWidgetConfig(widgetId, { series });
  }

  // ===== TABLE COLUMN MANAGEMENT =====

  addTableColumn(widgetId: string, tag: TagSelection): void {
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as TableConfig;
    const newCol = {
      devEUI: tag.devEUI,
      measurement: tag.measurement,
      label:
        tag.source === 'view'
          ? (tag.formulaAlias || 'Formula')
          : `${tag.siteName} / ${tag.measurement}`,
      unit: '',
      source: tag.source || 'tag',
      viewId: tag.viewId,
      formulaId: tag.formulaId,
      formulaAlias: tag.formulaAlias,
    };
    this.store.updateWidgetConfig(widgetId, { columns: [...cfg.columns, newCol] });
    this.refreshData();
  }

  removeTableColumn(widgetId: string, index: number): void {
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as TableConfig;
    const columns = [...cfg.columns];
    columns.splice(index, 1);
    this.store.updateWidgetConfig(widgetId, { columns });
  }

  updateColumnLabel(widgetId: string, index: number, event: Event): void {
    const label = (event.target as HTMLInputElement).value;
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as TableConfig;
    const columns = [...cfg.columns];
    columns[index] = { ...columns[index], label };
    this.store.updateWidgetConfig(widgetId, { columns });
  }

  updateColumnUnit(widgetId: string, index: number, event: Event): void {
    const unit = (event.target as HTMLInputElement).value;
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as TableConfig;
    const columns = [...cfg.columns];
    columns[index] = { ...columns[index], unit };
    this.store.updateWidgetConfig(widgetId, { columns });
  }

  // ===== ALARM RANGES (LABEL) =====

  addAlarmRange(widgetId: string): void {
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as LabelConfig;
    const ranges = [...(cfg.alarmRanges || [])];
    ranges.push({ min: 0, max: 100, color: '#dc2626', blink: false });
    this.store.updateWidgetConfig(widgetId, { alarmRanges: ranges });
  }

  removeAlarmRange(widgetId: string, index: number): void {
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as LabelConfig;
    const ranges = [...(cfg.alarmRanges || [])];
    ranges.splice(index, 1);
    this.store.updateWidgetConfig(widgetId, { alarmRanges: ranges });
  }

  updateAlarmRange(widgetId: string, index: number, key: string, event: Event): void {
    const widget = this.store.widgets().find((w) => w.id === widgetId);
    if (!widget) return;
    const cfg = widget.config as LabelConfig;
    const ranges = [...(cfg.alarmRanges || [])];
    const el = event.target as HTMLInputElement;
    const value = key === 'color' ? el.value : key === 'blink' ? el.checked : Number(el.value);
    ranges[index] = { ...ranges[index], [key]: value };
    this.store.updateWidgetConfig(widgetId, { alarmRanges: ranges });
  }

  // ===== VIEW SOURCE BADGE =====

  clearViewSource(widgetId: string): void {
    this.store.updateWidgetConfig(widgetId, {
      source: 'tag',
      viewId: undefined,
      formulaId: undefined,
      formulaAlias: undefined,
    });
    this.refreshData();
  }

  // ===== DATA REFRESH =====

  private refreshData(): void {
    const s = this.sinoptico();
    if (s) {
      this.dataStore.refresh(this.store.widgets());
    }
  }

  // ===== LIVE VALUE HELPERS =====

  getLiveValue(devEUI: string, measurement: string): number | null {
    return this.dataStore.getValue(devEUI, measurement);
  }

  getLiveValueForConfig(config: any): number | null {
    if (config.source === 'view' && config.viewId && config.formulaId) {
      return this.dataStore.getValue(`view:${config.viewId}:formula:${config.formulaId}`, '');
    }
    // Variable widget: viewId + formulaId without source field
    if (config.viewId && config.formulaId && !config.devEUI) {
      return this.dataStore.getValue(`view:${config.viewId}:formula:${config.formulaId}`, '');
    }
    // No devEUI → can't query by device (variable widgets, clock, etc.)
    if (!config.devEUI) return null;
    return this.dataStore.getValue(config.devEUI, config.measurement);
  }

  // ===== DEVICE TIMESTAMP / STALENESS HELPERS =====

  getDeviceTimestamp(config: any): string | null {
    if (config.source === 'view' || !config.devEUI) return null;
    return this.dataStore.getDeviceTimestamp(config.devEUI, config.measurement);
  }

  isDeviceStale(config: any): boolean {
    if (config.source === 'view' || !config.devEUI) return false;
    return this.dataStore.isStale(config.devEUI, config.measurement);
  }

  // Type casting helpers for template
  asLabel(config: any): LabelConfig {
    return config;
  }
  asChart(config: any): ChartConfig {
    return config;
  }
  asMap(config: any): MapConfig {
    return config;
  }
  asTable(config: any): TableConfig {
    return config;
  }
  asHeader(config: any): HeaderConfig {
    return config;
  }
  asImage(config: any): ImageConfig {
    return config;
  }
  asText(config: any): TextConfig {
    return config;
  }
  asShape(config: any): ShapeConfig {
    return config;
  }
  asLink(config: any): LinkConfig {
    return config;
  }
  asClock(config: any): ClockConfig {
    return config;
  }
  asVariable(config: any): VariableConfig {
    return config;
  }
  asAlarm(config: any): AlarmConfig {
    return config;
  }

  // ===== CONTEXT MENU =====

  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    const wrapper = (event.target as HTMLElement).closest('[data-widget-id]');
    const widgetId = wrapper?.getAttribute('data-widget-id') || null;
    if (widgetId && !this.store.selectedIds().has(widgetId)) {
      this.store.select(widgetId);
    }
    this.contextMenu.set({ x: event.clientX, y: event.clientY, widgetId });
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  isWidgetLocked(id: string): boolean {
    return this.store.widgets().find((w) => w.id === id)?.locked ?? false;
  }

  // ===== POSITION / SIZE (Feature 5) =====

  updatePosition(id: string, prop: 'x' | 'y' | 'width' | 'height', event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (isNaN(val)) return;
    if (prop === 'x' || prop === 'y') {
      const w = this.store.selectedWidget()!;
      this.store.moveWidget(id, prop === 'x' ? val : w.x, prop === 'y' ? val : w.y);
    } else {
      const w = this.store.selectedWidget()!;
      this.store.resizeWidget(id, prop === 'width' ? val : w.width, prop === 'height' ? val : w.height);
    }
  }

  // ===== OPACITY (Feature 6) =====

  updateWidgetOpacity(id: string, event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    this.store.updateWidgetField(id, 'opacity', val);
  }

  // ===== CANVAS CONFIG (Feature 8) =====

  updateCanvasSize(prop: 'canvas_width' | 'canvas_height', event: Event): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (isNaN(val) || val < 100) return;
    this.sinoptico.update((s) => (s ? { ...s, [prop]: val } : s));
    this.store.markDirty();
  }

  updateCanvasBg(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.sinoptico.update((s) => (s ? { ...s, canvas_bg: val } : s));
    this.store.markDirty();
  }

  setCanvasPreset(w: number, h: number): void {
    this.sinoptico.update((s) => (s ? { ...s, canvas_width: w, canvas_height: h } : s));
    this.store.markDirty();
  }

  // ===== GRID CONFIG (Feature 9) =====

  updateGridSize(event: Event): void {
    const size = Number((event.target as HTMLInputElement).value);
    if (size < 1 || size > 100) return;
    this.store.setGrid({ ...this.store.grid(), size });
  }

  toggleGridSnap(): void {
    this.store.setGrid({ ...this.store.grid(), snap: !this.store.grid().snap });
  }

  // ===== LINK WIDGET (Feature 11) =====

  updateLinkTarget(widgetId: string, event: Event): void {
    const id = Number((event.target as HTMLSelectElement).value) || null;
    const name = this.availableSinopticos().find((s) => s.id === id)?.name || '';
    this.store.updateWidgetConfig(widgetId, { targetSinopticoId: id, targetName: name });
  }

  // ===== VARIABLE WIDGET (source selection) =====

  onVariableViewChange(widgetId: string, event: Event): void {
    const viewId = Number((event.target as HTMLSelectElement).value) || null;
    const viewName = this.availableViews().find((v) => v.id === viewId)?.name || '';
    this.store.updateWidgetConfig(widgetId, {
      viewId,
      viewName,
      columnId: null,
      formulaId: null,
      sourceLabel: viewName,
    });
    this.variableViewDetail.set(null);
    if (viewId) {
      this.variableService.getView(viewId).subscribe((detail) => {
        // Ensure arrays exist even if API omits them
        detail.columns = detail.columns || [];
        detail.formulas = detail.formulas || [];
        this.variableViewDetail.set(detail);
      });
    }
  }

  onVariableSourceChange(widgetId: string, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    // val format: "col:ID" or "formula:ID"
    const [type, idStr] = val.split(':');
    const id = Number(idStr);
    const detail = this.variableViewDetail();
    if (!detail) return;

    if (type === 'col') {
      const col = (detail.columns || []).find((c) => c.id === id);
      this.store.updateWidgetConfig(widgetId, {
        columnId: id,
        formulaId: null,
        sourceLabel: col?.alias || col?.measurement || '',
      });
    } else if (type === 'formula') {
      const formula = (detail.formulas || []).find((f) => f.id === id);
      this.store.updateWidgetConfig(widgetId, {
        columnId: null,
        formulaId: id,
        sourceLabel: formula?.alias || '',
      });
    }
    this.refreshData();
  }

  loadVariableDetail(viewId: number): void {
    if (this.variableViewDetail()?.id === viewId) return;
    this.variableService.getView(viewId).subscribe((detail) => {
      detail.columns = detail.columns || [];
      detail.formulas = detail.formulas || [];
      this.variableViewDetail.set(detail);
    });
  }

  // ===== KEYBOARD SHORTCUTS =====

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (this.loading()) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      return;

    const ctrl = event.ctrlKey || event.metaKey;

    if (ctrl && event.key === 'z') {
      event.preventDefault();
      this.store.undo();
    } else if (ctrl && event.key === 'y') {
      event.preventDefault();
      this.store.redo();
    } else if (ctrl && event.key === 'c') {
      event.preventDefault();
      this.store.copySelected();
    } else if (ctrl && event.key === 'v') {
      event.preventDefault();
      this.store.paste();
    } else if (ctrl && event.key === 'a') {
      event.preventDefault();
      this.store.selectAll();
    } else if (ctrl && event.key === 'g') {
      event.preventDefault();
      if (this.store.hasGroupedSelection()) this.store.ungroupSelected();
      else this.store.groupSelected();
    } else if (ctrl && event.key === 'd') {
      event.preventDefault();
      this.store.duplicateSelected();
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.store.deleteSelected();
    } else if (ctrl && event.key === 's') {
      event.preventDefault();
      this.save();
    }
  }

  // ===== SHARING =====

  openShareDialog(): void {
    this.showShareDialog.set(true);
    this.loadShares();
  }

  private loadShares(): void {
    const s = this.sinoptico();
    if (!s) return;
    this.sinopticoService.getShares(s.id).subscribe({
      next: (data) => this.shares.set(data),
    });
  }

  searchShareCandidates(): void {
    const q = this.shareSearchQuery.trim();
    if (q.length < 2) {
      this.shareCandidates.set([]);
      return;
    }
    const s = this.sinoptico();
    if (!s) return;
    this.sinopticoService.searchShareCandidates(s.id, q).subscribe({
      next: (data) => this.shareCandidates.set(data),
    });
  }

  selectShareCandidate(c: { id: number; full_name: string; email: string }): void {
    this.selectedCandidateId = c.id;
    this.shareSearchQuery = c.full_name;
    this.shareCandidates.set([]);
  }

  addShare(): void {
    if (!this.selectedCandidateId) return;
    const s = this.sinoptico();
    if (!s) return;
    this.sinopticoService.addShare(s.id, this.selectedCandidateId, this.sharePermission).subscribe({
      next: () => {
        this.loadShares();
        this.selectedCandidateId = 0;
        this.shareSearchQuery = '';
        this.shareCandidates.set([]);
      },
    });
  }

  removeShare(share: SinopticoShare): void {
    const s = this.sinoptico();
    if (!s) return;
    this.sinopticoService.removeShare(s.id, share.id).subscribe({
      next: () => this.shares.update((list) => list.filter((x) => x.id !== share.id)),
    });
  }

  // ===== EXPORT PNG =====

  async exportPNG(): Promise<void> {
    const el = this.canvasInner?.nativeElement;
    if (!el) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.download = `${this.sinoptico()?.name || 'sinoptico'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  }
}
