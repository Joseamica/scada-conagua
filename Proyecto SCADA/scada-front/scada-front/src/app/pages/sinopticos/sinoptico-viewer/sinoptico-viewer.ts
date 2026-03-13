import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroPencilSquare, heroClock } from '@ng-icons/heroicons/outline';
import {
  SinopticoService,
  Sinoptico,
  CanvasState,
  CanvasWidget,
  LabelConfig,
  ChartConfig,
  TableConfig,
  TextConfig,
  ShapeConfig,
  LinkConfig,
} from '../../../core/services/sinoptico.service';
import { SinopticoDataStore } from '../sinoptico-editor/store/sinoptico-data-store';
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
import { ActivityPanel } from '../shared/activity-panel/activity-panel';

@Component({
  selector: 'app-sinoptico-viewer',
  standalone: true,
  imports: [
    CommonModule,
    NgIconComponent,
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
    ActivityPanel,
  ],
  providers: [SinopticoDataStore, provideIcons({ heroArrowLeft, heroPencilSquare, heroClock })],
  templateUrl: './sinoptico-viewer.html',
  styleUrl: './sinoptico-viewer.css',
})
export class SinopticoViewer implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sinopticoService = inject(SinopticoService);
  private destroyRef = inject(DestroyRef);
  dataStore = inject(SinopticoDataStore);

  sinoptico = signal<Sinoptico | null>(null);
  loading = signal(true);
  canvas = signal<CanvasState>({ widgets: [], grid: { snap: true, size: 10 }, zoom: 1 });

  canvasWidth = computed(() => this.sinoptico()?.canvas_width ?? 1920);
  canvasHeight = computed(() => this.sinoptico()?.canvas_height ?? 1080);
  showActivityPanel = signal(false);
  widgets = computed(() => this.canvas().widgets);
  widgetCount = computed(() => this.canvas().widgets.length);

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      if (!id) return;
      this.loadSinoptico(id);
    });
  }

  private loadSinoptico(id: number): void {
    this.loading.set(true);
    this.dataStore.stopPolling();
    this.sinopticoService.getSinoptico(id).subscribe({
      next: (data) => {
        this.sinoptico.set(data);
        this.canvas.set(
          data.canvas || { widgets: [], grid: { snap: true, size: 10 }, zoom: 1 },
        );
        this.loading.set(false);
        const widgets = data.canvas?.widgets || [];
        if (widgets.length > 0) {
          this.dataStore.startPolling(data.id, widgets);
        }
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

  goBack(): void {
    const projectId = this.sinoptico()?.project_id;
    this.router.navigate(projectId ? ['/sinopticos/proyecto', projectId] : ['/sinopticos']);
  }

  openEditor(): void {
    const id = this.sinoptico()?.id;
    if (id) this.router.navigate(['/sinopticos/editor', id]);
  }

  getLiveValue(devEUI: string, measurement: string): number | null {
    return this.dataStore.getValue(devEUI, measurement);
  }

  getLiveValueForConfig(config: any): number | null {
    if (config.source === 'view' && config.viewId && config.formulaId) {
      return this.dataStore.getValue(`view:${config.viewId}:formula:${config.formulaId}`, '');
    }
    if (config.viewId && config.formulaId && !config.devEUI) {
      return this.dataStore.getValue(`view:${config.viewId}:formula:${config.formulaId}`, '');
    }
    // No devEUI → can't query by device
    if (!config.devEUI) return null;
    return this.dataStore.getValue(config.devEUI, config.measurement);
  }

  getDeviceTimestamp(config: any): string | null {
    if (config.source === 'view' || !config.devEUI) return null;
    return this.dataStore.getDeviceTimestamp(config.devEUI, config.measurement);
  }

  isDeviceStale(config: any): boolean {
    if (config.source === 'view' || !config.devEUI) return false;
    return this.dataStore.isStale(config.devEUI, config.measurement);
  }

  asLabel(config: any): LabelConfig {
    return config;
  }
  asChart(config: any): ChartConfig {
    return config;
  }
  asTable(config: any): TableConfig {
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

  onLinkNavigate(targetId: number | null): void {
    if (targetId && targetId !== this.sinoptico()?.id) {
      this.router.navigate(['/sinopticos/viewer', targetId]);
    }
  }
}
