import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  HostListener,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
} from '@ng-icons/heroicons/outline';
import {
  SinopticoService,
  Sinoptico,
  CanvasWidget,
  LabelConfig,
  ChartConfig,
  MapConfig,
  TableConfig,
  HeaderConfig,
  ImageConfig,
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
import { TagBrowser, TagSelection } from '../shared/tag-browser/tag-browser';

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
    NgIconComponent,
    WidgetWrapper,
    LabelWidget,
    ChartWidget,
    MapWidget,
    TableWidget,
    HeaderWidget,
    ImageWidget,
    TagBrowser,
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
    }),
  ],
  templateUrl: './sinoptico-editor.html',
  styleUrl: './sinoptico-editor.css',
})
export class SinopticoEditor implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sinopticoService = inject(SinopticoService);
  store = inject(EditorStore);
  dataStore = inject(SinopticoDataStore);

  @ViewChild('canvasInner') canvasInner!: ElementRef<HTMLDivElement>;

  sinoptico = signal<Sinoptico | null>(null);
  loading = signal(true);
  saving = signal(false);
  gridVisible = signal(true);

  canvasWidth = computed(() => this.sinoptico()?.canvas_width ?? 1920);
  canvasHeight = computed(() => this.sinoptico()?.canvas_height ?? 1080);

  paletteItems: PaletteItem[] = [
    { type: 'label', label: 'Etiqueta', icon: 'heroTag' },
    { type: 'chart', label: 'Grafico', icon: 'heroChartBarSquare' },
    { type: 'map', label: 'Mapa', icon: 'heroMapPin' },
    { type: 'table', label: 'Tabla', icon: 'heroTableCells' },
    { type: 'header', label: 'Encabezado', icon: 'heroRectangleGroup' },
    { type: 'image', label: 'Imagen', icon: 'heroPhoto' },
  ];

  private isDragging = false;

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
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/sinopticos']);
      },
    });
  }

  ngOnDestroy(): void {
    this.dataStore.stopPolling();
  }

  // ===== TOOLBAR =====

  save(): void {
    const s = this.sinoptico();
    if (!s) return;
    this.saving.set(true);
    const canvas = this.store.getCanvasState();
    this.sinopticoService.saveSinoptico(s.id, { canvas: canvas as any }).subscribe({
      next: (result) => {
        this.sinoptico.update((prev) =>
          prev ? { ...prev, version: result.version, updated_at: result.updated_at } : prev,
        );
        this.store.markSaved();
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  toggleGrid(): void {
    this.gridVisible.update((v) => !v);
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

  // ===== CANVAS CLICK =====

  onCanvasClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('.widget-wrapper')) return;
    this.store.clearSelection();
  }

  // ===== WIDGET EVENTS =====

  onWidgetSelect(id: string, event: MouseEvent): void {
    this.store.select(id, event.shiftKey);
    this.store.beginBatch();
    this.isDragging = true;
  }

  onWidgetMove(id: string, pos: { x: number; y: number }): void {
    this.store.moveWidgetDirect(id, pos.x, pos.y);
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
    return this.dataStore.getValue(config.devEUI, config.measurement);
  }

  // ===== DEVICE TIMESTAMP / STALENESS HELPERS =====

  getDeviceTimestamp(config: any): string | null {
    if (config.source === 'view') return null;
    return this.dataStore.getDeviceTimestamp(config.devEUI, config.measurement);
  }

  isDeviceStale(config: any): boolean {
    if (config.source === 'view') return false;
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
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.store.deleteSelected();
    } else if (ctrl && event.key === 's') {
      event.preventDefault();
      this.save();
    }
  }
}
