import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowDownTray, heroFunnel } from '@ng-icons/heroicons/outline';
import { AlarmService, AlarmHistoryEntry } from '../../../core/services/alarm.service';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-alarm-history',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, FooterTabsComponent, HeaderBarComponent],
  providers: [provideIcons({ heroArrowDownTray, heroFunnel })],
  template: `
    <app-header-bar />
    <div class="history-page">
      <div class="page-header">
        <h1>Historial de Alarmas</h1>
        <button class="btn-primary" (click)="exportCsv()">
          <ng-icon name="heroArrowDownTray" size="18" /> Exportar CSV
        </button>
      </div>

      <div class="filters">
        <input type="date" [(ngModel)]="filterFrom" placeholder="Desde" />
        <input type="date" [(ngModel)]="filterTo" placeholder="Hasta" />
        <select [(ngModel)]="filterSeverity">
          <option value="">Todas las severidades</option>
          <option value="critico">Critico</option>
          <option value="alerta">Alerta</option>
          <option value="aviso">Aviso</option>
        </select>
        <button class="btn-secondary" (click)="loadHistory()">Filtrar</button>
      </div>

      <div class="history-table-wrap">
        <table class="history-table" *ngIf="!loading()">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Alarma</th>
              <th>DevEUI</th>
              <th>Severidad</th>
              <th>Estado Anterior</th>
              <th>Nuevo Estado</th>
              <th>Valor</th>
              <th>Umbral</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let h of history()">
              <td>{{ h.created_at | date:'short' }}</td>
              <td>{{ h.alarm_name }}</td>
              <td>{{ h.dev_eui }}</td>
              <td><span class="severity-badge" [class]="h.severity">{{ h.severity }}</span></td>
              <td>{{ h.previous_state }}</td>
              <td>{{ h.new_state }}</td>
              <td>{{ h.trigger_value }}</td>
              <td>{{ h.threshold_value }}</td>
              <td>{{ h.user_name || '-' }}</td>
            </tr>
          </tbody>
        </table>
        <div *ngIf="loading()" class="loading-state"><div class="spinner"></div></div>
        <div *ngIf="!loading() && history().length === 0" class="empty-state">
          <p>No hay registros en el historial</p>
        </div>
      </div>

      <div class="pagination" *ngIf="totalPages() > 1">
        <button class="btn-sm" (click)="prevPage()" [disabled]="page() <= 1">Anterior</button>
        <span>Pagina {{ page() }} de {{ totalPages() }}</span>
        <button class="btn-sm" (click)="nextPage()" [disabled]="page() >= totalPages()">Siguiente</button>
      </div>
    </div>
    <app-footer-tabs />
  `,
  styles: [`
    :host { display: block; font-family: 'Inter', system-ui, sans-serif; }
    .history-page { padding: 16px; padding-bottom: 80px; max-width: 1440px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .filters input, .filters select {
      padding: 9px 12px;
      border: 1.5px solid var(--border-default); border-radius: 8px;
      background: var(--bg-card); color: var(--text-primary);
      font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
      outline: none;
    }
    .filters input:focus, .filters select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(109, 0, 43, 0.10);
    }
    .history-table-wrap {
      overflow-x: auto; background: var(--bg-card);
      border: 1px solid var(--border-default); border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }
    .history-table { width: 100%; border-collapse: collapse; }
    .history-table th {
      padding: 10px 14px; text-align: left;
      font-size: 11px; font-weight: 600; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.05em;
      background: var(--table-header-bg); border-bottom: 2px solid var(--border-strong);
      white-space: nowrap;
    }
    .history-table td {
      padding: 10px 14px; border-bottom: 1px solid var(--border-default);
      font-size: 13px; color: var(--text-primary);
    }
    .history-table tbody tr:hover td { background: var(--table-hover); }
    .severity-badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 999px; }
    .severity-badge.critico { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }
    .severity-badge.alerta { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning); }
    .severity-badge.aviso { background: var(--info-bg); color: var(--info); border: 1px solid var(--info-border); }
    .pagination {
      display: flex; align-items: center; justify-content: center;
      gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border-default);
    }
    .pagination span { font-size: 13px; color: var(--text-secondary); }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: 8px; border: 1px solid transparent;
      background: var(--accent); color: var(--text-on-accent);
      font-weight: 600; font-size: 13px; cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
    }
    .btn-primary:hover {
      background: var(--accent-hover);
      box-shadow: 0 4px 12px rgba(109, 0, 43, 0.3);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: 8px; padding: 8px 14px; color: var(--text-primary);
      font-weight: 600; font-size: 13px; cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .btn-secondary:hover { background: var(--bg-card-hover); border-color: var(--border-strong); }
    .btn-sm {
      padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border-default);
      background: var(--bg-card); color: var(--text-secondary);
      font-size: 13px; cursor: pointer;
    }
    .btn-sm:hover { background: var(--bg-card-hover); border-color: var(--border-strong); }
    .btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 40px 16px; color: var(--text-muted);
    }
    .loading-state { text-align: center; padding: 50px; }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid var(--border-default);
      border-top-color: var(--accent);
      border-radius: 50%; margin: 0 auto;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class AlarmHistory implements OnInit {
  private alarmService = inject(AlarmService);

  history = signal<AlarmHistoryEntry[]>([]);
  loading = signal(true);
  page = signal(1);
  total = signal(0);
  limit = 50;
  totalPages = signal(0);

  filterFrom = '';
  filterTo = '';
  filterSeverity = '';

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory(): void {
    this.loading.set(true);
    this.alarmService.getHistory({
      page: this.page(),
      limit: this.limit,
      from: this.filterFrom || undefined,
      to: this.filterTo || undefined,
      severity: this.filterSeverity || undefined,
    }).subscribe({
      next: (res) => {
        this.history.set(res.data);
        this.total.set(res.total);
        this.totalPages.set(Math.ceil(res.total / this.limit));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  prevPage(): void {
    if (this.page() > 1) { this.page.update((p) => p - 1); this.loadHistory(); }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) { this.page.update((p) => p + 1); this.loadHistory(); }
  }

  exportCsv(): void {
    this.alarmService.exportHistory(this.filterFrom || undefined, this.filterTo || undefined).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'alarm_history.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }
}
