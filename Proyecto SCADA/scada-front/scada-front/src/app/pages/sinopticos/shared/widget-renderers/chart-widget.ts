import {
  Component,
  input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as echarts from 'echarts';
import { ThemeService } from '../../../../core/services/theme.service';
import { getEChartsColors } from '../../../../core/utils/echarts-theme';

interface ChartConfig {
  series: {
    devEUI: string;
    measurement: string;
    label: string;
    color: string;
    lineType: 'line' | 'bar' | 'area';
    yAxisIndex: number;
    source?: 'tag' | 'view';
    viewId?: number;
    formulaId?: number;
    formulaAlias?: string;
  }[];
  timeRange: string;
  showLegend: boolean;
  showGrid: boolean;
}

@Component({
  selector: 'widget-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-widget">
      <div #chartEl class="chart-container"></div>
      <div class="chart-placeholder" *ngIf="cfg().series.length === 0">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M3 3v18h18" />
          <path d="m7 14 4-4 4 4 5-5" />
        </svg>
        <span>Configura series para ver el grafico</span>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .chart-widget {
        width: 100%;
        height: 100%;
        background: var(--bg-card);
        position: relative;
      }
      .chart-container {
        width: 100%;
        height: 100%;
      }
      .chart-placeholder {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: var(--text-muted);
        font-size: 12px;
        background: var(--bg-card);
        z-index: 1;
      }
    `,
  ],
})
export class ChartWidget implements AfterViewInit, OnDestroy {
  @ViewChild('chartEl') chartEl?: ElementRef<HTMLDivElement>;
  cfg = input.required<ChartConfig>({ alias: 'config' });

  /** Chart data keyed by "devEUI:measurement" → [[timestamp, value], ...] */
  chartData = input<Record<string, [number, number][]>>({});

  private themeService = inject(ThemeService);
  private chart: echarts.ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    // Re-render on theme change
    effect(() => {
      this.themeService.resolved();
      if (this.chart) this.renderChart();
    });

    // Re-render when data changes
    effect(() => {
      const data = this.chartData();
      if (this.chart && data && Object.keys(data).length > 0) {
        this.renderChart(data);
      }
    });

    // Initialize chart when series are added (handles case where series start empty)
    effect(() => {
      const cfg = this.cfg();
      if (cfg.series.length > 0 && !this.chart && this.chartEl) {
        this.initChart();
      } else if (this.chart) {
        this.renderChart(this.chartData());
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.chartEl && this.cfg().series.length > 0) {
      this.initChart();
    }
  }

  private initChart(): void {
    if (!this.chartEl || this.chart) return;
    this.chart = echarts.init(this.chartEl.nativeElement);
    this.renderChart(this.chartData());
    this.resizeObserver = new ResizeObserver(() => this.chart?.resize());
    this.resizeObserver.observe(this.chartEl.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.chart?.dispose();
  }

  renderChart(data?: Record<string, [number, number][]>): void {
    if (!this.chart) return;
    const colors = getEChartsColors(this.themeService.resolved());
    const cfg = this.cfg();

    const series: any[] = cfg.series.map((s, i) => {
      const seriesKey =
        s.source === 'view' && s.viewId && s.formulaId
          ? `view:${s.viewId}:formula:${s.formulaId}`
          : `${s.devEUI}:${s.measurement}`;
      return {
        name: s.label || `Serie ${i + 1}`,
        type: s.lineType === 'area' ? 'line' : s.lineType,
        areaStyle: s.lineType === 'area' ? { opacity: 0.15 } : undefined,
        data: data?.[seriesKey] || [],
        color: s.color || undefined,
        yAxisIndex: s.yAxisIndex || 0,
        smooth: true,
        symbolSize: 3,
      };
    });

    this.chart.setOption(
      {
        backgroundColor: colors.backgroundColor,
        grid: { top: 30, right: 16, bottom: 30, left: 50, containLabel: false },
        tooltip: {
          trigger: 'axis',
          backgroundColor: colors.tooltip.bg,
          borderColor: colors.tooltip.border,
          textStyle: { color: colors.tooltip.textColor, fontSize: 12 },
        },
        legend: cfg.showLegend
          ? {
              bottom: 0,
              textStyle: { color: colors.subtextColor, fontSize: 11 },
            }
          : undefined,
        xAxis: {
          type: 'time',
          axisLine: { lineStyle: { color: colors.axisLine } },
          axisLabel: { color: colors.subtextColor, fontSize: 10 },
          splitLine: { show: false },
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          axisLabel: { color: colors.subtextColor, fontSize: 10 },
          splitLine: { lineStyle: { color: colors.splitLine } },
        },
        series,
      },
      true,
    );
  }
}
