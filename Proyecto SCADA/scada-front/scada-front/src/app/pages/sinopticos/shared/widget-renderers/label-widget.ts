import { Component, input, signal, computed, effect, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';

interface LabelConfig {
  devEUI: string;
  measurement: string;
  title: string;
  unit: string;
  decimals: number;
  fontSize: number;
  alarmRanges: { min: number; max: number; color: string; blink: boolean; textColor?: string }[];
}

@Component({
  selector: 'widget-label',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="label-widget" [class.label-stale]="isStale()" [style.font-family]="'Inter, system-ui, sans-serif'">
      <div class="label-title">{{ cfg().title || 'Valor' }}</div>
      <div
        class="label-value"
        [style.fontSize.px]="cfg().fontSize || 32"
        [style.color]="isStale() ? '' : valueColor()"
      >
        @if (isStale()) {
          <span class="stale-value">SIN COM.</span>
        } @else {
          {{ displayValue() }}
          <span class="label-unit" *ngIf="cfg().unit">{{ cfg().unit }}</span>
          @if (partialQuality()) {
            <span class="label-partial" title="Valor parcial — datos incompletos">*</span>
          }
        }
      </div>
      @if (relativeTime()) {
        <div class="label-timestamp" [class.timestamp-stale]="isStale()">
          {{ relativeTime() }}
        </div>
      }
      <div class="label-source" *ngIf="cfg().devEUI">
        {{ cfg().devEUI | slice: 0 : 8 }}... / {{ cfg().measurement }}
      </div>
      <div class="label-placeholder" *ngIf="!cfg().devEUI">Sin variable asignada</div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .label-widget {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 8px;
        box-sizing: border-box;
        text-align: center;
        background: var(--bg-card);
        overflow: hidden;
      }
      .label-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .label-value {
        font-weight: 700;
        color: var(--text-primary);
        line-height: 1.1;
        transition: color 0.3s ease;
      }
      .label-unit {
        font-size: 0.5em;
        font-weight: 500;
        color: var(--text-muted);
        margin-left: 4px;
      }
      .label-source {
        font-size: 10px;
        color: var(--text-muted);
        margin-top: 4px;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .label-placeholder {
        font-size: 12px;
        color: var(--text-muted);
        font-style: italic;
      }
      .label-stale {
        opacity: 0.6;
      }
      .label-stale .label-value {
        color: var(--text-muted) !important;
      }
      .stale-value {
        font-size: 0.6em;
        color: #f59e0b;
        font-weight: 700;
        letter-spacing: 0.02em;
      }
      .label-timestamp {
        font-size: 10px;
        font-weight: 500;
        color: var(--text-muted);
        margin-top: 2px;
        text-align: center;
      }
      .timestamp-stale {
        color: #f59e0b;
        font-weight: 600;
      }
      .label-partial {
        color: #f59e0b;
        font-weight: 700;
        font-size: 0.5em;
        margin-left: 2px;
        cursor: help;
      }
      @keyframes blink {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.3;
        }
      }
      :host(.blinking) .label-value {
        animation: blink 1s ease-in-out infinite;
      }
    `,
  ],
})
export class LabelWidget {
  cfg = input.required<LabelConfig>({ alias: 'config' });
  liveValue = input<number | null>(null);
  lastUpdatedAt = input<string | null>(null);
  isStale = input<boolean>(false);
  partialQuality = input<boolean>(false);

  displayValue = signal('--');
  valueColor = signal('var(--text-primary)');

  relativeTime = computed(() => {
    const ts = this.lastUpdatedAt();
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'ahora';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
  });

  @HostBinding('class.blinking') isBlinking = false;

  constructor() {
    // React to liveValue changes
    effect(() => {
      const val = this.liveValue();
      this.updateValue(val);
    });
  }

  /** Called externally or via liveValue input when values update */
  updateValue(val: number | null): void {
    if (val === null || val === undefined) {
      this.displayValue.set('--');
      this.valueColor.set('var(--text-muted)');
      this.isBlinking = false;
      return;
    }
    const dec = this.cfg().decimals ?? 2;
    this.displayValue.set(val.toFixed(dec));

    // Check alarm ranges
    const ranges = this.cfg().alarmRanges || [];
    let color = 'var(--text-primary)';
    let blink = false;
    for (const r of ranges) {
      if (val >= r.min && val <= r.max) {
        color = r.color;
        blink = r.blink ?? false;
        break;
      }
    }
    this.valueColor.set(color);
    this.isBlinking = blink;
  }
}
