import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroPlus, heroTrash, heroPencilSquare, heroUserGroup } from '@ng-icons/heroicons/outline';
import { AlarmService, AlarmRecipient, RecipientCollection } from '../../../core/services/alarm.service';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';

@Component({
  selector: 'app-recipients',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent, FooterTabsComponent, HeaderBarComponent],
  providers: [provideIcons({ heroPlus, heroTrash, heroPencilSquare, heroUserGroup })],
  template: `
    <app-header-bar />
    <div class="recipients-page">
      <div class="page-header">
        <h1>Destinatarios de Alarmas</h1>
        <button class="btn-primary" (click)="showCreateRecipient = true">
          <ng-icon name="heroPlus" size="18" /> Nuevo Destinatario
        </button>
      </div>

      <div class="tabs">
        <button [class.active]="activeTab === 'recipients'" (click)="activeTab = 'recipients'">Contactos</button>
        <button [class.active]="activeTab === 'collections'" (click)="activeTab = 'collections'">Colecciones</button>
      </div>

      <!-- Recipients List -->
      <div *ngIf="activeTab === 'recipients'">
        <div *ngFor="let r of recipients()" class="recipient-card">
          <div class="recipient-info">
            <h3>{{ r.contact_name }}</h3>
            <p>
              <span *ngIf="r.email">{{ r.email }}</span>
              <span *ngIf="r.phone"> | {{ r.phone }}</span>
              <span *ngIf="r.telegram_username"> | Telegram: {{ r.telegram_username }}</span>
            </p>
          </div>
          <button class="btn-icon btn-danger" (click)="deleteRecipient(r)">
            <ng-icon name="heroTrash" size="16" />
          </button>
        </div>
        <div class="empty-state" *ngIf="recipients().length === 0">
          <ng-icon name="heroUserGroup" size="40" />
          <p>No hay destinatarios configurados</p>
        </div>
      </div>

      <!-- Collections List -->
      <div *ngIf="activeTab === 'collections'">
        <div class="collections-header">
          <button class="btn-primary btn-sm" (click)="showCreateCollection = true">
            <ng-icon name="heroPlus" size="14" /> Nueva Coleccion
          </button>
        </div>
        <div *ngFor="let c of collections()" class="recipient-card">
          <div class="recipient-info">
            <h3>{{ c.name }}</h3>
            <p>{{ c.member_count }} miembros</p>
          </div>
          <button class="btn-icon btn-danger" (click)="deleteCollection(c)">
            <ng-icon name="heroTrash" size="16" />
          </button>
        </div>
        <div class="empty-state" *ngIf="collections().length === 0">
          <p>No hay colecciones</p>
        </div>
      </div>
    </div>

    <!-- Create Recipient Dialog -->
    <div class="dialog-overlay" *ngIf="showCreateRecipient" (click)="showCreateRecipient = false">
      <div class="dialog" (click)="$event.stopPropagation()">
        <h2>Nuevo Destinatario</h2>
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" [(ngModel)]="newRecipient.contact_name" placeholder="Nombre del contacto" />
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" [(ngModel)]="newRecipient.email" placeholder="correo&#64;ejemplo.com" />
        </div>
        <div class="form-group">
          <label>Telefono</label>
          <input type="text" [(ngModel)]="newRecipient.phone" placeholder="+52 55 1234 5678" />
        </div>
        <div class="form-group">
          <label>Usuario Telegram</label>
          <input type="text" [(ngModel)]="newRecipient.telegram_username" placeholder="&#64;usuario" />
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary" (click)="showCreateRecipient = false">Cancelar</button>
          <button class="btn-primary" (click)="createRecipient()" [disabled]="!newRecipient.contact_name?.trim()">Crear</button>
        </div>
      </div>
    </div>

    <!-- Create Collection Dialog -->
    <div class="dialog-overlay" *ngIf="showCreateCollection" (click)="showCreateCollection = false">
      <div class="dialog" (click)="$event.stopPropagation()">
        <h2>Nueva Coleccion</h2>
        <div class="form-group">
          <label>Nombre *</label>
          <input type="text" [(ngModel)]="newCollectionName" placeholder="Nombre de la coleccion" />
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary" (click)="showCreateCollection = false">Cancelar</button>
          <button class="btn-primary" (click)="createCollection()" [disabled]="!newCollectionName.trim()">Crear</button>
        </div>
      </div>
    </div>

    <app-footer-tabs />
  `,
  styles: [`
    :host { display: block; font-family: 'Inter', system-ui, sans-serif; }
    .recipients-page { padding: 16px; padding-bottom: 80px; max-width: 1440px; margin: 0 auto; }
    .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .page-header h1 { font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .tabs { display: flex; gap: 0; border-bottom: 2px solid var(--border-default); margin-bottom: 16px; }
    .tabs button {
      padding: 10px 18px; font-size: 13px; font-weight: 600;
      color: var(--text-secondary); cursor: pointer;
      border-bottom: 2px solid transparent; margin-bottom: -2px;
      background: none; border-top: none; border-left: none; border-right: none;
      transition: color 0.15s ease, border-color 0.15s ease;
    }
    .tabs button:hover { color: var(--text-primary); }
    .tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
    .collections-header { margin-bottom: 12px; }
    .recipient-card {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px; background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: 12px; margin-bottom: 10px;
      transition: border-color 0.15s ease;
    }
    .recipient-card:hover { border-color: var(--border-strong); }
    .recipient-info h3 { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: var(--text-primary); }
    .recipient-info p { font-size: 12px; color: var(--text-secondary); margin: 0; }
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
    .btn-sm { padding: 6px 12px; font-size: 12px; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 40px 16px; color: var(--text-muted);
    }
    .empty-state ng-icon { opacity: 0.3; }
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
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
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
  `],
})
export class Recipients implements OnInit {
  private alarmService = inject(AlarmService);

  recipients = signal<AlarmRecipient[]>([]);
  collections = signal<RecipientCollection[]>([]);
  activeTab: 'recipients' | 'collections' = 'recipients';
  showCreateRecipient = false;
  showCreateCollection = false;
  newRecipient: Partial<AlarmRecipient> = {};
  newCollectionName = '';

  ngOnInit(): void {
    this.alarmService.getRecipients().subscribe({ next: (data) => this.recipients.set(data) });
    this.alarmService.getCollections().subscribe({ next: (data) => this.collections.set(data) });
  }

  createRecipient(): void {
    if (!this.newRecipient.contact_name?.trim()) return;
    this.alarmService.createRecipient(this.newRecipient).subscribe({
      next: (r) => { this.recipients.update((list) => [...list, r]); this.showCreateRecipient = false; this.newRecipient = {}; },
    });
  }

  deleteRecipient(r: AlarmRecipient): void {
    if (!confirm(`Eliminar "${r.contact_name}"?`)) return;
    this.alarmService.deleteRecipient(r.id).subscribe({
      next: () => this.recipients.update((list) => list.filter((x) => x.id !== r.id)),
    });
  }

  createCollection(): void {
    if (!this.newCollectionName.trim()) return;
    this.alarmService.createCollection({ name: this.newCollectionName.trim() }).subscribe({
      next: (c) => { this.collections.update((list) => [...list, c]); this.showCreateCollection = false; this.newCollectionName = ''; },
    });
  }

  deleteCollection(c: RecipientCollection): void {
    if (!confirm(`Eliminar coleccion "${c.name}"?`)) return;
    this.alarmService.deleteCollection(c.id).subscribe({
      next: () => this.collections.update((list) => list.filter((x) => x.id !== c.id)),
    });
  }
}
