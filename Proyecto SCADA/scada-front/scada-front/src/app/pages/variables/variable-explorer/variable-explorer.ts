import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPlus,
  heroFolder,
  heroTrash,
  heroTableCells,
  heroCalculator,
} from '@ng-icons/heroicons/outline';
import { VariableService, VariableView, VariableFolder } from '../../../core/services/variable.service';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-variable-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, FooterTabsComponent, HeaderBarComponent],
  providers: [provideIcons({ heroPlus, heroFolder, heroTrash, heroTableCells, heroCalculator })],
  template: `
    <app-header-bar />
    <div class="var-page">
      <div class="page-header">
        <h1>Explorador de Variables</h1>
        <button class="btn-primary" (click)="showCreateView = true">
          <ng-icon name="heroPlus" size="18" /> Nueva Vista
        </button>
      </div>

      <div class="content-grid">
        <!-- Folders -->
        <aside class="folder-sidebar">
          <h4>Carpetas</h4>
          <div class="folder-list">
            <div class="folder-item" [class.active]="selectedFolderId() === null" (click)="selectedFolderId.set(null)">
              <ng-icon name="heroTableCells" size="16" />
              <span>Todas las vistas</span>
            </div>
            <div *ngFor="let f of folders()" class="folder-item" [class.active]="selectedFolderId() === f.id" (click)="selectFolder(f)">
              <ng-icon name="heroFolder" size="16" />
              <span>{{ f.name }}</span>
            </div>
            <p class="empty-hint" *ngIf="folders().length === 0">Sin carpetas</p>
          </div>
          <div class="folder-create">
            <input type="text" [(ngModel)]="newFolderName" placeholder="Nueva carpeta" />
            <button class="btn-sm" (click)="createFolder()" [disabled]="!newFolderName.trim()">
              <ng-icon name="heroPlus" size="14" />
            </button>
          </div>
        </aside>

        <!-- Views -->
        <main class="views-area">
          <div *ngIf="loading()" class="loading-state"><div class="spinner"></div></div>
          <div *ngIf="!loading()" class="views-list">
            <div *ngFor="let v of filteredViews()" class="view-card" (click)="openView(v)">
              <div class="view-info">
                <h3>{{ v.name }}</h3>
                <p>{{ v.column_count }} columnas, {{ v.formula_count }} formulas</p>
              </div>
              <div class="view-actions">
                <button class="btn-icon btn-danger" (click)="deleteView(v); $event.stopPropagation()" title="Eliminar">
                  <ng-icon name="heroTrash" size="16" />
                </button>
              </div>
            </div>
            <div class="empty-state" *ngIf="filteredViews().length === 0">
              <ng-icon name="heroTableCells" size="40" />
              <p>No hay vistas de variables</p>
            </div>
          </div>
        </main>
      </div>
    </div>

    <!-- Create View Dialog -->
    <div class="dialog-overlay" *ngIf="showCreateView" (click)="showCreateView = false">
      <div class="dialog" (click)="$event.stopPropagation()">
        <h2>Nueva Vista de Variables</h2>
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" [(ngModel)]="newViewName" placeholder="Nombre" />
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary" (click)="showCreateView = false">Cancelar</button>
          <button class="btn-primary" (click)="createView()" [disabled]="!newViewName.trim()">Crear</button>
        </div>
      </div>
    </div>

    <app-footer-tabs />
  `,
  styles: [`
    :host { display: block; font-family: 'Inter', system-ui, sans-serif; }
    .var-page { padding: 16px; padding-bottom: 80px; max-width: 1440px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .content-grid {
      display: grid; grid-template-columns: 240px 1fr;
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: 12px; overflow: hidden;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
      min-height: 400px;
    }
    .folder-sidebar {
      width: 240px; flex-shrink: 0;
      border-right: 1.5px solid var(--border-strong);
      background: var(--bg-card-hover);
      padding: 0; overflow-y: auto;
    }
    .folder-sidebar h4 {
      padding: 10px 14px; font-size: 11px; font-weight: 600;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.06em; border-bottom: 1.5px solid var(--border-strong);
      margin: 0;
    }
    .folder-list { padding: 6px; }
    .folder-item {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 10px; border-radius: 8px; cursor: pointer;
      font-size: 13px; font-weight: 500; color: var(--text-secondary);
      border: 1px solid transparent;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .folder-item:hover { background: var(--table-hover); color: var(--text-primary); }
    .folder-item.active { background: rgba(109, 0, 43, 0.08); color: var(--accent); font-weight: 600; }
    .empty-hint { font-size: 12px; color: var(--text-muted); margin: 8px 14px; }
    .folder-create { display: flex; gap: 6px; padding: 10px; border-top: 1.5px solid var(--border-strong); }
    .folder-create input {
      flex: 1; padding: 9px 12px;
      border: 1.5px solid var(--border-default); border-radius: 8px;
      background: var(--bg-card); color: var(--text-primary);
      font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
      outline: none;
    }
    .folder-create input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(109, 0, 43, 0.10);
    }
    .btn-sm {
      padding: 6px 8px; background: var(--accent); color: var(--text-on-accent);
      border: none; border-radius: 8px; cursor: pointer;
      display: inline-flex; align-items: center; justify-content: center;
      transition: background 0.15s ease;
    }
    .btn-sm:hover { background: var(--accent-hover); }
    .btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
    .views-area { min-height: 300px; padding: 14px; }
    .view-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px; background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: 12px; margin-bottom: 10px; cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .view-card:hover { border-color: var(--border-strong); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .view-info h3 { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: var(--text-primary); }
    .view-info p { font-size: 12px; color: var(--text-secondary); margin: 0; }
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
    .empty-state ng-icon { opacity: 0.3; }
    .loading-state { text-align: center; padding: 60px; }
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
    .dialog h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
    .form-group input {
      width: 100%; padding: 9px 12px;
      border: 1.5px solid var(--border-default); border-radius: 8px;
      background: var(--bg-card); color: var(--text-primary);
      font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
      outline: none; box-sizing: border-box;
    }
    .form-group input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(109, 0, 43, 0.10);
    }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    @media (max-width: 768px) { .content-grid { grid-template-columns: 1fr; } }
  `],
})
export class VariableExplorer implements OnInit {
  private variableService = inject(VariableService);
  private router = inject(Router);

  views = signal<VariableView[]>([]);
  folders = signal<VariableFolder[]>([]);
  loading = signal(true);
  selectedFolderId = signal<number | null>(null);
  filteredViews = computed(() => {
    const fid = this.selectedFolderId();
    return fid === null ? this.views() : this.views().filter((v) => v.folder_id === fid);
  });
  showCreateView = false;
  newViewName = '';
  newFolderName = '';

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.variableService.getViews().subscribe({
      next: (data) => { this.views.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.variableService.getFolders().subscribe({
      next: (data) => this.folders.set(data),
    });
  }

  openView(view: VariableView): void {
    this.router.navigate(['/variables/view', view.id]);
  }

  selectFolder(folder: VariableFolder): void {
    this.selectedFolderId.set(this.selectedFolderId() === folder.id ? null : folder.id);
  }

  createFolder(): void {
    if (!this.newFolderName.trim()) return;
    this.variableService.createFolder(this.newFolderName.trim()).subscribe({
      next: (f) => { this.folders.update((list) => [...list, f]); this.newFolderName = ''; },
    });
  }

  createView(): void {
    if (!this.newViewName.trim()) return;
    this.variableService.createView({ name: this.newViewName.trim() }).subscribe({
      next: (v) => { this.views.update((list) => [v, ...list]); this.showCreateView = false; this.newViewName = ''; },
    });
  }

  deleteView(view: VariableView): void {
    if (!confirm(`Eliminar vista "${view.name}"?`)) return;
    this.variableService.deleteView(view.id).subscribe({
      next: () => this.views.update((list) => list.filter((v) => v.id !== view.id)),
    });
  }
}
