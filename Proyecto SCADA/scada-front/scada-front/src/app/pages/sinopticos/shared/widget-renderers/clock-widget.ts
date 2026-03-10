import { Component, input, signal, OnInit, OnDestroy } from '@angular/core';

export interface ClockConfig {
  format: '12h' | '24h';
  showDate: boolean;
  showSeconds: boolean;
  fontSize: number;
  color: string;
  bgColor: string;
}

@Component({
  selector: 'widget-clock',
  standalone: true,
  template: `
    <div
      class="clock-body"
      [style.fontSize.px]="config().fontSize"
      [style.color]="config().color"
      [style.backgroundColor]="config().bgColor"
    >
      <div class="clock-time">{{ timeDisplay() }}</div>
      @if (config().showDate) {
        <div class="clock-date">{{ dateDisplay() }}</div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .clock-body {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        padding: 8px;
        font-family: ui-monospace, 'Cascadia Code', monospace;
        font-weight: 600;
        overflow: hidden;
      }
      .clock-date {
        font-size: 0.45em;
        opacity: 0.7;
        font-weight: 400;
        margin-top: 2px;
        font-family: 'Inter', system-ui, sans-serif;
      }
    `,
  ],
})
export class ClockWidget implements OnInit, OnDestroy {
  config = input.required<ClockConfig>();
  timeDisplay = signal('');
  dateDisplay = signal('');
  private intervalId: any;

  ngOnInit(): void {
    this.tick();
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  private tick(): void {
    const now = new Date();
    const cfg = this.config();
    let h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    let suffix = '';
    if (cfg.format === '12h') {
      suffix = h >= 12 ? ' PM' : ' AM';
      h = h % 12 || 12;
    }
    const hStr = h.toString().padStart(2, '0');
    this.timeDisplay.set(
      cfg.showSeconds ? `${hStr}:${m}:${s}${suffix}` : `${hStr}:${m}${suffix}`,
    );
    if (cfg.showDate) {
      this.dateDisplay.set(
        now.toLocaleDateString('es-MX', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      );
    }
  }
}
