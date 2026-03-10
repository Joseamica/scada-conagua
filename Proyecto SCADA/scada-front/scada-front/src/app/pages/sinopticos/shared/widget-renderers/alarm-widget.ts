import { Component, inject, input, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AlarmConfig } from '../../../../core/services/sinoptico.service';
import { AlarmService, ActiveAlarm } from '../../../../core/services/alarm.service';

@Component({
  selector: 'widget-alarm',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="alarm-widget" [style.fontSize.px]="config().fontSize">
      <div class="alarm-header">
        <span class="alarm-title">{{ config().title }}</span>
        <span class="alarm-count" [class.has-alarms]="alarms().length > 0"
              [class.critical]="hasCritical()">
          {{ alarms().length }}
        </span>
      </div>
      <div class="alarm-body" [class.compact]="config().compact">
        @if (alarms().length === 0) {
          <div class="alarm-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span>Sin alarmas activas</span>
          </div>
        }
        @for (a of displayAlarms(); track a.id) {
          <div class="alarm-row" [class]="'severity-' + a.severity"
               [class.unack]="!a.acknowledged_at">
            <div class="alarm-indicator"></div>
            <div class="alarm-info">
              <span class="alarm-name">{{ a.name }}</span>
              @if (config().showSiteName && a.site_name) {
                <span class="alarm-site">{{ a.site_name }}</span>
              }
            </div>
            <div class="alarm-meta">
              <span class="alarm-value">{{ a.last_value | number:'1.1-2' }}</span>
              <span class="alarm-severity-badge">{{ a.severity }}</span>
              @if (config().showTimestamp && a.last_triggered_at) {
                <span class="alarm-time">{{ a.last_triggered_at | date:'HH:mm' }}</span>
              }
            </div>
          </div>
        }
        @if (alarms().length > config().maxItems) {
          <div class="alarm-overflow">
            +{{ alarms().length - config().maxItems }} mas
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }

    .alarm-widget {
      width: 100%; height: 100%; display: flex; flex-direction: column;
      background: var(--bg-card, #fff); border-radius: 6px; overflow: hidden;
      border: 1px solid var(--border-default, #e2e8f0);
      font-family: 'Inter', system-ui, sans-serif;
    }

    .alarm-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 10px; border-bottom: 1px solid var(--border-default, #e2e8f0);
      flex-shrink: 0;
    }

    .alarm-title {
      font-weight: 600; color: var(--text-primary, #0f172a);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .alarm-count {
      font-size: 0.9em; font-weight: 700; padding: 2px 8px;
      border-radius: 10px; background: var(--bg-card-hover, #f1f5f9);
      color: var(--text-muted, #94a3b8); min-width: 20px; text-align: center;
    }
    .alarm-count.has-alarms { background: #fef3c7; color: #92400e; }
    .alarm-count.critical { background: #fee2e2; color: #991b1b; animation: pulse-badge 1.5s ease infinite; }

    @keyframes pulse-badge {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .alarm-body {
      flex: 1; overflow-y: auto; padding: 4px;
    }

    .alarm-empty {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 6px; height: 100%;
      color: var(--text-muted, #94a3b8); opacity: 0.7;
    }
    .alarm-empty span { font-size: 0.9em; }

    .alarm-row {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; border-radius: 4px; margin-bottom: 2px;
      transition: background 0.12s;
    }
    .alarm-row:hover { background: var(--bg-card-hover, #f8fafc); }

    .alarm-indicator {
      width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    }
    .severity-aviso .alarm-indicator { background: #eab308; }
    .severity-alerta .alarm-indicator { background: #f97316; }
    .severity-critico .alarm-indicator { background: #ef4444; }
    .severity-critico.unack .alarm-indicator { animation: blink-dot 1s ease infinite; }

    @keyframes blink-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.4); }
    }

    .alarm-info {
      flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;
    }

    .alarm-name {
      font-weight: 500; color: var(--text-primary, #0f172a);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .alarm-site {
      font-size: 0.85em; color: var(--text-muted, #94a3b8);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .alarm-meta {
      display: flex; align-items: center; gap: 6px; flex-shrink: 0;
    }

    .alarm-value {
      font-weight: 600; font-family: ui-monospace, monospace;
      color: var(--text-primary, #0f172a);
    }

    .alarm-severity-badge {
      font-size: 0.75em; font-weight: 700; text-transform: uppercase;
      padding: 1px 5px; border-radius: 3px; letter-spacing: 0.02em;
    }
    .severity-aviso .alarm-severity-badge { background: #fef9c3; color: #854d0e; }
    .severity-alerta .alarm-severity-badge { background: #ffedd5; color: #9a3412; }
    .severity-critico .alarm-severity-badge { background: #fee2e2; color: #991b1b; }

    .alarm-time {
      font-size: 0.8em; color: var(--text-muted, #94a3b8);
      font-family: ui-monospace, monospace;
    }

    .alarm-overflow {
      text-align: center; font-size: 0.85em; color: var(--text-muted, #94a3b8);
      padding: 4px; font-style: italic;
    }

    /* Compact mode */
    .compact .alarm-row { padding: 3px 6px; }
    .compact .alarm-site { display: none; }
    .compact .alarm-severity-badge { display: none; }
  `],
})
export class AlarmWidget implements OnInit, OnDestroy {
  private alarmService = inject(AlarmService);

  config = input.required<AlarmConfig>();
  alarms = signal<ActiveAlarm[]>([]);
  hasCritical = signal(false);

  private pollTimer: any = null;

  displayAlarms = () => this.alarms().slice(0, this.config().maxItems);

  ngOnInit(): void {
    this.fetchAlarms();
    this.pollTimer = setInterval(() => this.fetchAlarms(), 15_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private fetchAlarms(): void {
    this.alarmService.getActiveAlarms().subscribe({
      next: (data) => {
        // Sort: critico first, then alerta, then aviso
        const order: Record<string, number> = { critico: 0, alerta: 1, aviso: 2 };
        data.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
        this.alarms.set(data);
        this.hasCritical.set(data.some(a => a.severity === 'critico'));
      },
      error: () => {},
    });
  }
}
