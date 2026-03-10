import { Component, input, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VariableConfig } from '../../../../core/services/sinoptico.service';
import { VariableService } from '../../../../core/services/variable.service';

@Component({
  selector: 'widget-variable',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="var-body"
      [style.fontSize.px]="config().fontSize"
      [style.color]="config().color"
      [style.backgroundColor]="config().bgColor"
    >
      <span class="var-title">{{ config().title || config().sourceLabel || 'Variable' }}</span>
      <span class="var-value">
        @if (loading()) {
          <span class="var-loading">...</span>
        } @else if (value() !== null) {
          {{ value()! | number: '1.0-' + config().decimals }}
          @if (config().unit) {
            <span class="var-unit">{{ config().unit }}</span>
          }
        } @else if (!config().viewId) {
          <span class="var-empty">Sin fuente</span>
        } @else {
          <span class="var-empty">--</span>
        }
      </span>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .var-body {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        box-sizing: border-box;
        padding: 8px;
        border-radius: 6px;
        overflow: hidden;
        font-family: 'Inter', system-ui, sans-serif;
      }
      .var-title {
        font-size: 0.35em;
        font-weight: 600;
        opacity: 0.6;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .var-value {
        font-weight: 700;
        font-family: ui-monospace, 'SF Mono', monospace;
        line-height: 1.1;
      }
      .var-unit {
        font-size: 0.5em;
        font-weight: 500;
        opacity: 0.7;
        margin-left: 2px;
      }
      .var-loading {
        opacity: 0.4;
        animation: pulse 1.2s ease-in-out infinite;
      }
      .var-empty {
        opacity: 0.3;
        font-weight: 400;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 0.5em;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 0.4;
        }
        50% {
          opacity: 0.8;
        }
      }
    `,
  ],
})
export class VariableWidget implements OnInit, OnDestroy {
  config = input.required<VariableConfig>();
  /** Optional externally-provided live value (from SinopticoDataStore). */
  liveValue = input<number | null>(null);

  private variableService = inject(VariableService);

  value = signal<number | null>(null);
  loading = signal(false);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastViewId: number | null = null;
  private lastFormulaId: number | null = null;
  private lastColumnId: number | null = null;

  ngOnInit(): void {
    this.fetchValue();
    // Poll every 30s for fresh data
    this.pollTimer = setInterval(() => this.fetchValue(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private fetchValue(): void {
    // If a live value is being provided externally, use that
    const live = this.liveValue();
    if (live !== null && live !== undefined) {
      this.value.set(live);
      return;
    }

    const cfg = this.config();
    if (!cfg.viewId) return;

    // Only re-fetch if the source changed
    if (
      cfg.viewId === this.lastViewId &&
      cfg.formulaId === this.lastFormulaId &&
      cfg.columnId === this.lastColumnId &&
      this.value() !== null
    ) {
      return;
    }

    this.lastViewId = cfg.viewId;
    this.lastFormulaId = cfg.formulaId;
    this.lastColumnId = cfg.columnId;
    this.loading.set(true);

    this.variableService.executeView(cfg.viewId).subscribe({
      next: (result) => {
        this.loading.set(false);
        // Find the value: formula takes priority, then column
        if (cfg.formulaId) {
          const key = `formula:${cfg.formulaId}`;
          this.value.set(result.values[key] ?? null);
        } else if (cfg.columnId) {
          const key = `col:${cfg.columnId}`;
          this.value.set(result.values[key] ?? null);
        } else {
          // Try first available value
          const vals = Object.values(result.values).filter((v) => v !== null);
          this.value.set(vals.length > 0 ? (vals[0] as number) : null);
        }
      },
      error: () => this.loading.set(false),
    });
  }
}
