import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPlus,
  heroTrash,
  heroPencilSquare,
  heroFolderOpen,
  heroBellAlert,
  heroChevronRight,
} from '@ng-icons/heroicons/outline';
import { AlarmService, AlarmGroup, Alarm } from '../../../core/services/alarm.service';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-alarm-config',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, FooterTabsComponent, HeaderBarComponent],
  providers: [provideIcons({ heroPlus, heroTrash, heroPencilSquare, heroFolderOpen, heroBellAlert, heroChevronRight })],
  template: `
    <app-header-bar />
    <div class="alarm-config-page">
      <div class="page-header">
        <h1>Configuracion de Alarmas</h1>
        <div class="header-actions">
          <button class="btn-secondary" (click)="router.navigate(['/alarmas/historial'])">Historial</button>
          <button class="btn-secondary" (click)="router.navigate(['/alarmas/destinatarios'])">Destinatarios</button>
          <button class="btn-primary" (click)="showCreateGroup = true">
            <ng-icon name="heroPlus" size="18" /> Nuevo Grupo
          </button>
        </div>
      </div>

      <div class="config-grid">
        <!-- Group Tree -->
        <aside class="group-sidebar">
          <h4>Grupos</h4>
          <div *ngFor="let g of groups()" class="group-item"
               [class.active]="selectedGroupId() === g.id"
               (click)="selectGroup(g)">
            <ng-icon name="heroFolderOpen" size="16" />
            <span>{{ g.name }}</span>
            <span class="badge">{{ g.alarm_count }}</span>
          </div>
          <p class="empty-hint" *ngIf="groups().length === 0">Sin grupos</p>
        </aside>

        <!-- Alarm List -->
        <main class="alarm-list-area">
          <div class="list-header" *ngIf="selectedGroupId()">
            <h2>{{ selectedGroupName() }}</h2>
            <button class="btn-primary" (click)="showCreateAlarm = true">
              <ng-icon name="heroPlus" size="16" /> Nueva Alarma
            </button>
          </div>

          <div *ngIf="loadingAlarms()" class="loading-state"><div class="spinner"></div></div>

          <div *ngIf="!loadingAlarms() && selectedGroupId()">
            <div *ngFor="let a of alarms()" class="alarm-card">
              <div class="alarm-severity" [class]="a.severity">{{ a.severity }}</div>
              <div class="alarm-info">
                <h3>{{ a.name }}</h3>
                <p>{{ a.dev_eui }} | {{ a.measurement }} {{ a.comparison_operator }} {{ a.threshold_value }}</p>
                <span class="state-badge" *ngIf="a.current_state && a.current_state !== 'INACTIVE'" [class]="a.current_state">
                  {{ a.current_state }}
                </span>
              </div>
              <div class="alarm-actions">
                <button class="btn-icon" (click)="editAlarm(a)" title="Editar">
                  <ng-icon name="heroPencilSquare" size="16" />
                </button>
                <button class="btn-icon btn-danger" (click)="deleteAlarm(a)" title="Eliminar">
                  <ng-icon name="heroTrash" size="16" />
                </button>
              </div>
            </div>
            <div class="empty-state" *ngIf="alarms().length === 0">
              <ng-icon name="heroBellAlert" size="40" />
              <p>No hay alarmas en este grupo</p>
            </div>
          </div>

          <div class="empty-state" *ngIf="!selectedGroupId()">
            <p>Selecciona un grupo para ver sus alarmas</p>
          </div>
        </main>
      </div>
    </div>

    <!-- Create Group Dialog -->
    <div class="dialog-overlay" *ngIf="showCreateGroup" (click)="showCreateGroup = false">
      <div class="dialog" (click)="$event.stopPropagation()">
        <h2>Nuevo Grupo de Alarmas</h2>
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" [(ngModel)]="newGroupName" placeholder="Nombre del grupo" />
        </div>
        <div class="form-group">
          <label>Municipio</label>
          <input type="text" [(ngModel)]="newGroupMunicipality" placeholder="Municipio (opcional)" />
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary" (click)="showCreateGroup = false">Cancelar</button>
          <button class="btn-primary" (click)="createGroup()" [disabled]="!newGroupName.trim()">Crear</button>
        </div>
      </div>
    </div>

    <!-- Create Alarm Dialog -->
    <div class="dialog-overlay" *ngIf="showCreateAlarm" (click)="showCreateAlarm = false">
      <div class="dialog dialog-wide" (click)="$event.stopPropagation()">
        <h2>Nueva Alarma</h2>
        <div class="form-row">
          <div class="form-group">
            <label>Nombre *</label>
            <input type="text" [(ngModel)]="newAlarm.name" placeholder="Nombre de la alarma" />
          </div>
          <div class="form-group">
            <label>Severidad</label>
            <select [(ngModel)]="newAlarm.severity">
              <option value="aviso">Aviso</option>
              <option value="alerta">Alerta</option>
              <option value="critico">Critico</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>DevEUI *</label>
            <input type="text" [(ngModel)]="newAlarm.dev_eui" placeholder="DevEUI del dispositivo" />
          </div>
          <div class="form-group">
            <label>Medicion *</label>
            <input type="text" [(ngModel)]="newAlarm.measurement" placeholder="caudal_lts, presion_kg..." />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Operador *</label>
            <select [(ngModel)]="newAlarm.comparison_operator">
              <option value=">">Mayor que (&gt;)</option>
              <option value="<">Menor que (&lt;)</option>
              <option value="=">Igual a (=)</option>
              <option value="<>">Diferente de (&lt;&gt;)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Umbral *</label>
            <input type="number" [(ngModel)]="newAlarm.threshold_value" placeholder="Valor umbral" />
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary" (click)="showCreateAlarm = false">Cancelar</button>
          <button class="btn-primary" (click)="createAlarm()" [disabled]="!isAlarmValid()">Crear</button>
        </div>
      </div>
    </div>

    <app-footer-tabs />
  `,
  styles: [`
    :host { display: block; font-family: 'Inter', system-ui, sans-serif; }
    .alarm-config-page { padding: 16px; padding-bottom: 80px; max-width: 1440px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
    .page-header h1 { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .header-actions { display: flex; gap: 8px; }
    .config-grid {
      display: grid; grid-template-columns: 240px 1fr;
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: 12px; overflow: hidden;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      min-height: 400px;
    }
    .group-sidebar {
      width: 240px; flex-shrink: 0;
      border-right: 1.5px solid var(--border-strong);
      background: var(--bg-card-hover);
      padding: 0; overflow-y: auto;
    }
    .group-sidebar h4 {
      padding: 10px 14px; font-size: 11px; font-weight: 600;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.06em; border-bottom: 1.5px solid var(--border-strong);
      margin: 0;
    }
    .group-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; margin: 4px 6px; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 500; color: var(--text-secondary);
      border: 1px solid transparent;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .group-item:hover { background: var(--table-hover); color: var(--text-primary); }
    .group-item.active {
      background: rgba(109, 0, 43, 0.06);
      border-color: rgba(109, 0, 43, 0.15);
      color: var(--accent); font-weight: 600;
    }
    .badge { margin-left: auto; font-size: 11px; background: var(--border-default); padding: 2px 6px; border-radius: 10px; color: var(--text-muted); }
    .list-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 14px; }
    .list-header h2 { font-size: 16px; font-weight: 600; margin: 0; color: var(--text-primary); }
    .alarm-list-area { padding: 14px; }
    .alarm-card { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 10px; margin-bottom: 10px; transition: border-color 0.15s ease; }
    .alarm-card:hover { border-color: var(--border-strong); }
    .alarm-severity { font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
    .alarm-severity.critico { background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger-border); }
    .alarm-severity.alerta { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning); }
    .alarm-severity.aviso { background: var(--info-bg); color: var(--info); border: 1px solid var(--info-border); }
    .alarm-info { flex: 1; }
    .alarm-info h3 { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: var(--text-primary); }
    .alarm-info p { font-size: 12px; color: var(--text-secondary); margin: 0; }
    .state-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-top: 4px; }
    .state-badge.ACTIVE_UNACK { background: var(--danger-bg); color: var(--danger); }
    .state-badge.ACTIVE_ACK { background: var(--warning-bg); color: var(--warning); }
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
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-secondary {
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: 8px; padding: 8px 14px; color: var(--text-primary);
      font-weight: 600; font-size: 13px; cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .btn-secondary:hover { background: var(--bg-card-hover); border-color: var(--border-strong); }
    .btn-icon {
      border-radius: 8px; padding: 7px 8px;
      border: 1px solid var(--border-strong);
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
      background: var(--bg-card); min-width: 32px; min-height: 32px;
      color: var(--text-secondary);
      transition: background 0.15s ease, transform 0.1s ease;
    }
    .btn-icon:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .btn-danger { color: var(--danger); }
    .btn-danger:hover { background: rgba(239,68,68,0.08); border-color: var(--danger); }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 40px 16px; color: var(--text-muted);
    }
    .empty-hint { font-size: 12px; color: var(--text-muted); margin: 8px 14px; }
    .loading-state { text-align: center; padding: 50px; }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid var(--border-default);
      border-top-color: var(--accent);
      border-radius: 50%; margin: 0 auto;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .dialog-overlay {
      position: fixed; inset: 0;
      background: var(--bg-modal-backdrop);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000;
    }
    .dialog {
      background: var(--bg-card); border-radius: 12px;
      padding: 24px; width: 90%; max-width: 480px;
      box-shadow: var(--shadow-lg);
    }
    .dialog-wide { max-width: 560px; }
    .dialog h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; padding: 9px 12px;
      border: 1.5px solid var(--border-default); border-radius: 8px;
      background: var(--bg-card); color: var(--text-primary);
      font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
      outline: none; box-sizing: border-box;
    }
    .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(109, 0, 43, 0.10);
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    @media (max-width: 768px) { .config-grid { grid-template-columns: 1fr; } .form-row { grid-template-columns: 1fr; } }
  `],
})
export class AlarmConfig implements OnInit {
  private alarmService = inject(AlarmService);
  router = inject(Router);

  groups = signal<AlarmGroup[]>([]);
  alarms = signal<Alarm[]>([]);
  selectedGroupId = signal<number | null>(null);
  selectedGroupName = signal('');
  loadingAlarms = signal(false);

  showCreateGroup = false;
  showCreateAlarm = false;
  newGroupName = '';
  newGroupMunicipality = '';
  newAlarm: Partial<Alarm> = { severity: 'aviso', comparison_operator: '>', threshold_value: 0 };

  ngOnInit(): void {
    this.alarmService.getGroups().subscribe({
      next: (data) => this.groups.set(data),
    });
  }

  selectGroup(group: AlarmGroup): void {
    this.selectedGroupId.set(group.id);
    this.selectedGroupName.set(group.name);
    this.loadingAlarms.set(true);
    this.alarmService.getAlarms(group.id).subscribe({
      next: (data) => { this.alarms.set(data); this.loadingAlarms.set(false); },
      error: () => this.loadingAlarms.set(false),
    });
  }

  createGroup(): void {
    if (!this.newGroupName.trim()) return;
    this.alarmService.createGroup({ name: this.newGroupName.trim(), municipality: this.newGroupMunicipality.trim() || undefined } as any).subscribe({
      next: (g) => { this.groups.update((list) => [...list, g]); this.showCreateGroup = false; this.newGroupName = ''; this.newGroupMunicipality = ''; },
    });
  }

  createAlarm(): void {
    if (!this.isAlarmValid()) return;
    this.alarmService.createAlarm({ ...this.newAlarm, group_id: this.selectedGroupId()! } as any).subscribe({
      next: (a) => { this.alarms.update((list) => [a, ...list]); this.showCreateAlarm = false; this.resetNewAlarm(); },
    });
  }

  isAlarmValid(): boolean {
    return !!(this.newAlarm.name?.trim() && this.newAlarm.dev_eui?.trim() && this.newAlarm.measurement?.trim() && this.newAlarm.comparison_operator && this.newAlarm.threshold_value !== undefined);
  }

  editAlarm(alarm: Alarm): void {
    // Phase 5: open alarm wizard for edit
  }

  deleteAlarm(alarm: Alarm): void {
    if (!confirm(`Eliminar alarma "${alarm.name}"?`)) return;
    this.alarmService.deleteAlarm(alarm.id).subscribe({
      next: () => this.alarms.update((list) => list.filter((a) => a.id !== alarm.id)),
    });
  }

  private resetNewAlarm(): void {
    this.newAlarm = { severity: 'aviso', comparison_operator: '>', threshold_value: 0 };
  }
}
