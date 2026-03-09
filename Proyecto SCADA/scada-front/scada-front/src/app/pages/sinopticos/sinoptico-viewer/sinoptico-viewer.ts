import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroPencilSquare } from '@ng-icons/heroicons/outline';
import {
  SinopticoService,
  Sinoptico,
  CanvasState,
  CanvasWidget,
  LabelConfig,
  ChartConfig,
  TableConfig,
} from '../../../core/services/sinoptico.service';
import { SinopticoDataStore } from '../sinoptico-editor/store/sinoptico-data-store';
import { LabelWidget } from '../shared/widget-renderers/label-widget';
import { ChartWidget } from '../shared/widget-renderers/chart-widget';
import { MapWidget } from '../shared/widget-renderers/map-widget';
import { TableWidget } from '../shared/widget-renderers/table-widget';
import { HeaderWidget } from '../shared/widget-renderers/header-widget';
import { ImageWidget } from '../shared/widget-renderers/image-widget';

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
  ],
  providers: [SinopticoDataStore, provideIcons({ heroArrowLeft, heroPencilSquare })],
  templateUrl: './sinoptico-viewer.html',
  styleUrl: './sinoptico-viewer.css',
})
export class SinopticoViewer implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sinopticoService = inject(SinopticoService);
  dataStore = inject(SinopticoDataStore);

  sinoptico = signal<Sinoptico | null>(null);
  loading = signal(true);
  canvas = signal<CanvasState>({ widgets: [], grid: { snap: true, size: 10 }, zoom: 1 });

  canvasWidth = computed(() => this.sinoptico()?.canvas_width ?? 1920);
  canvasHeight = computed(() => this.sinoptico()?.canvas_height ?? 1080);
  widgets = computed(() => this.canvas().widgets);
  widgetCount = computed(() => this.canvas().widgets.length);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.sinopticoService.getSinoptico(id).subscribe({
      next: (data) => {
        this.sinoptico.set(data);
        this.canvas.set(
          data.canvas || { widgets: [], grid: { snap: true, size: 10 }, zoom: 1 },
        );
        this.loading.set(false);
        // Start data polling for live values
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
    return this.dataStore.getValue(config.devEUI, config.measurement);
  }

  getDeviceTimestamp(config: any): string | null {
    if (config.source === 'view') return null;
    return this.dataStore.getDeviceTimestamp(config.devEUI, config.measurement);
  }

  isDeviceStale(config: any): boolean {
    if (config.source === 'view') return false;
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
}
