import {
  Component,
  inject,
  signal,
  input,
  output,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark, heroClock } from '@ng-icons/heroicons/outline';
import {
  SinopticoService,
  ActivityLogEntry,
} from '../../../../core/services/sinoptico.service';

@Component({
  selector: 'activity-panel',
  standalone: true,
  imports: [CommonModule, NgIconComponent, DatePipe],
  providers: [provideIcons({ heroXMark, heroClock })],
  template: `
    <div class="activity-overlay" [class.open]="open()" (click)="closePanel.emit()"></div>
    <aside class="activity-panel" [class.open]="open()">
      <div class="panel-header">
        <h3>
          <ng-icon name="heroClock" size="16" />
          Historial de Cambios
        </h3>
        <button class="panel-close" (click)="closePanel.emit()">
          <ng-icon name="heroXMark" size="18" />
        </button>
      </div>
      <div class="panel-body">
        @if (loading()) {
          <div class="panel-loading"><div class="spinner"></div></div>
        }
        @for (entry of entries(); track entry.id) {
          <div class="activity-entry">
            <div class="entry-header">
              <span class="entry-user">{{ entry.full_name || 'Sistema' }}</span>
              <span class="entry-time">{{ entry.created_at | date: 'dd/MM/yy HH:mm' }}</span>
            </div>
            <div class="entry-action">{{ translateAction(entry.action) }}</div>
          </div>
        } @empty {
          @if (!loading()) {
            <div class="panel-empty">Sin actividad registrada</div>
          }
        }
      </div>
    </aside>
  `,
  styles: [
    `
      .activity-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.2);
        z-index: 999;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      .activity-overlay.open {
        opacity: 1;
        pointer-events: auto;
      }

      .activity-panel {
        position: fixed;
        top: 0;
        right: -360px;
        width: 360px;
        height: 100vh;
        background: var(--bg-card);
        border-left: 1px solid var(--border-default);
        box-shadow: var(--shadow-lg, 0 4px 24px rgba(0, 0, 0, 0.15));
        z-index: 1000;
        transition: right 0.25s ease;
        display: flex;
        flex-direction: column;
        font-family: 'Inter', system-ui, sans-serif;
      }
      .activity-panel.open {
        right: 0;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--border-default);
        flex-shrink: 0;
      }
      .panel-header h3 {
        font-size: 14px;
        font-weight: 600;
        margin: 0;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .panel-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-muted);
        padding: 4px;
        border-radius: 4px;
        display: flex;
        transition: background 0.12s;
      }
      .panel-close:hover {
        background: var(--bg-card-hover);
        color: var(--text-primary);
      }

      .panel-body {
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px;
      }

      .panel-loading {
        display: flex;
        justify-content: center;
        padding: 40px 0;
      }
      .spinner {
        width: 24px;
        height: 24px;
        border: 2.5px solid var(--border-default);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .activity-entry {
        padding: 10px 0;
        border-bottom: 1px solid var(--border-default);
      }
      .activity-entry:last-child {
        border-bottom: none;
      }
      .entry-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }
      .entry-user {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .entry-time {
        font-size: 11px;
        color: var(--text-muted);
      }
      .entry-action {
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 2px;
      }

      .panel-empty {
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
        padding: 40px 0;
      }
    `,
  ],
})
export class ActivityPanel implements OnChanges {
  private sinopticoService = inject(SinopticoService);

  sinopticoId = input.required<number>();
  open = input(false);
  closePanel = output<void>();

  entries = signal<ActivityLogEntry[]>([]);
  loading = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open()) {
      this.loadActivity();
    }
  }

  private loadActivity(): void {
    this.loading.set(true);
    this.sinopticoService.getActivity(this.sinopticoId(), 200).subscribe({
      next: (data) => {
        this.entries.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  translateAction(action: string): string {
    const map: Record<string, string> = {
      created: 'Creo el sinoptico',
      saved: 'Guardo el sinoptico',
      canvas_updated: 'Actualizo el canvas',
      duplicated: 'Duplico el sinoptico',
      shared: 'Compartio el sinoptico',
      unshared: 'Quito acceso compartido',
      permissions_updated: 'Actualizo permisos',
      restored: 'Restauro el sinoptico',
      deleted: 'Elimino el sinoptico',
    };
    return map[action] || action;
  }
}
