import { Component, EventEmitter, HostListener, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlarmService,
  Alarm,
  AlarmSite,
  MeasurementOption,
} from '../../../core/services/alarm.service';

@Component({
  selector: 'app-alarm-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="dialog-overlay" (click)="closed.emit()">
      <div class="dialog dialog-wide" (click)="$event.stopPropagation()">
        <h2>{{ editMode() ? 'Editar Alarma' : 'Crear Alarma' }}</h2>

        <!-- IDENTIFICACION -->
        <div class="form-section">
          <div class="form-section-title">Identificacion</div>
          <div class="form-row">
            <div class="form-group">
              <label>Nombre *</label>
              <input type="text" [(ngModel)]="formName" placeholder="Nombre de la alarma" />
            </div>
            <div class="form-group">
              <label>Severidad</label>
              <select [(ngModel)]="formSeverity" [class]="'select-severity select-severity--' + formSeverity">
                <option value="critico">Critico</option>
                <option value="alerta">Alerta</option>
                <option value="aviso">Aviso</option>
              </select>
            </div>
          </div>
        </div>

        <!-- SITIO(S) Y CONDICION -->
        <div class="form-section">
          <div class="form-section-title">Sitio(s) y Condicion</div>

          <!-- Site selector -->
          <div class="form-group">
            <label>{{ editMode() ? 'Dispositivo' : 'Sitios *' }}</label>
            <div class="site-selector">
              <!-- Selected chips -->
              <div class="site-chips" *ngIf="selectedSites().length > 0">
                @for (site of selectedSites(); track site.dev_eui) {
                  <span class="chip">
                    {{ site.site_name || site.dev_eui }}
                    <button class="chip-remove" (click)="removeSite(site)" type="button">&times;</button>
                  </span>
                }
              </div>

              <!-- Loading state -->
              @if (sitesLoading()) {
                <div class="sites-loading">Cargando sitios...</div>
              }

              <!-- Search input -->
              <input
                type="text"
                [value]="siteSearchText()"
                (input)="siteSearchText.set($any($event.target).value); siteDropdownOpen = true"
                (focus)="siteDropdownOpen = true"
                placeholder="Buscar sitio por nombre o municipio..."
                class="site-search-input"
              />

              <!-- Dropdown results -->
              @if (siteDropdownOpen && filteredSites().length > 0) {
                <div class="site-dropdown">
                  @for (group of groupedFilteredSites(); track group.municipality) {
                    <div class="site-group-label">{{ group.municipality }}</div>
                    @for (site of group.sites; track site.dev_eui) {
                      <div class="site-option" (click)="addSite(site)">
                        <span class="site-option-name">{{ site.site_name }}</span>
                        <span class="site-option-meta">{{ site.site_type }} | {{ site.proveedor }}</span>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Medicion *</label>
              <select [(ngModel)]="formMeasurement">
                <option value="" disabled>Seleccionar medicion...</option>
                @for (m of filteredMeasurements(); track m.key) {
                  <option [value]="m.key">{{ m.label }} ({{ m.unit }}){{ selectedSites().length === 0 ? ' — ' + m.provider : '' }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label>Operador *</label>
              <select [(ngModel)]="formOperator">
                <option value=">">&gt; Mayor que</option>
                <option value="<">&lt; Menor que</option>
                <option value="=">= Igual a</option>
                <option value="<>">&lt;&gt; Diferente de</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Umbral *</label>
            <input type="number" [(ngModel)]="formThreshold" placeholder="Valor umbral" />
          </div>
        </div>

        <!-- NOTIFICACIONES -->
        <div class="form-section">
          <div class="form-section-title">Notificaciones</div>
          <div class="form-row">
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" [(ngModel)]="formPlaySound" />
                Reproducir sonido
              </label>
            </div>
            <div class="form-group">
              <label class="toggle-label">
                <input type="checkbox" [(ngModel)]="formShowBanner" />
                Mostrar banner
              </label>
            </div>
          </div>
          <div class="recipient-placeholder">
            <span class="lock-icon">&#128274;</span>
            Configuracion de destinatarios — disponible proximamente
          </div>
        </div>

        <!-- SAVE ERROR -->
        @if (saveError()) {
          <div class="save-error">{{ saveError() }}</div>
        }

        <!-- ACTIONS -->
        <div class="dialog-actions">
          <button class="btn-secondary" (click)="closed.emit()">Cancelar</button>
          <button class="btn-primary" (click)="save()" [disabled]="!isValid() || saving()">
            {{ saving() ? 'Guardando...' : editMode() ? 'Guardar' : selectedSites().length > 1 ? 'Crear ' + selectedSites().length + ' alarmas' : 'Crear' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .dialog-overlay {
      position: fixed; inset: 0;
      background: var(--bg-modal-backdrop);
      display: flex; align-items: center; justify-content: center;
      z-index: 2000;
    }
    .dialog {
      background: var(--bg-card); border-radius: 12px;
      padding: 24px; width: 90%; max-width: 600px;
      box-shadow: var(--shadow-lg);
      max-height: 90vh; overflow-y: auto;
    }
    .dialog-wide { max-width: 600px; }
    .dialog h2 { margin: 0 0 20px; font-size: 18px; font-weight: 700; color: var(--text-primary); }
    .form-section { margin-bottom: 20px; }
    .form-section-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-muted);
      margin-bottom: 10px; padding-bottom: 6px;
      border-bottom: 1px solid var(--border-default);
    }
    .form-group { margin-bottom: 12px; }
    .form-group label {
      display: block; font-size: 13px; font-weight: 600;
      color: var(--text-secondary); margin-bottom: 4px;
    }
    .form-group input, .form-group select, .form-group textarea {
      width: 100%; padding: 9px 12px;
      border: 1.5px solid var(--border-default); border-radius: 8px;
      background: var(--bg-card); color: var(--text-primary);
      font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
      outline: none; box-sizing: border-box;
    }
    .form-group input:focus, .form-group select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(109, 0, 43, 0.10);
    }
    .input-disabled {
      opacity: 0.6; cursor: not-allowed;
      background: var(--bg-card-hover) !important;
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    /* Severity select */
    .select-severity--critico { border-color: #dc2626; color: #dc2626; }
    .select-severity--alerta { border-color: #ea580c; color: #ea580c; }
    .select-severity--aviso { border-color: #2563eb; color: #2563eb; }

    /* Site selector */
    .site-selector { position: relative; }
    .site-chips {
      display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
    }
    .chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 4px 10px; border-radius: 999px;
      background: var(--accent-light, rgba(109, 0, 43, 0.08));
      color: var(--accent); font-size: 12px; font-weight: 600;
      border: 1px solid rgba(109, 0, 43, 0.15);
    }
    .chip-remove {
      background: none; border: none; color: var(--accent);
      cursor: pointer; font-size: 14px; line-height: 1;
      padding: 0 2px; opacity: 0.7;
    }
    .chip-remove:hover { opacity: 1; }
    .site-search-input {
      width: 100%; padding: 9px 12px;
      border: 1.5px solid var(--border-default); border-radius: 8px;
      background: var(--bg-card); color: var(--text-primary);
      font-size: 13px; font-family: 'Inter', system-ui, sans-serif;
      outline: none; box-sizing: border-box;
    }
    .site-search-input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(109, 0, 43, 0.10);
    }
    .site-dropdown {
      position: absolute; top: 100%; left: 0; right: 0;
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: 8px; box-shadow: var(--shadow-lg);
      max-height: 240px; overflow-y: auto; z-index: 10;
      margin-top: 4px;
    }
    .site-group-label {
      padding: 6px 12px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--text-muted); background: var(--bg-card-hover);
      border-bottom: 1px solid var(--border-default);
      position: sticky; top: 0;
    }
    .site-option {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 12px; cursor: pointer;
      border-bottom: 1px solid var(--border-default);
      transition: background 0.1s ease;
    }
    .site-option:last-child { border-bottom: none; }
    .site-option:hover { background: var(--bg-card-hover); }
    .site-option-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
    .site-option-meta { font-size: 11px; color: var(--text-muted); }

    /* Toggle */
    .toggle-label {
      display: flex; align-items: center; gap: 8px; cursor: pointer;
      font-size: 13px; font-weight: 500; color: var(--text-primary);
      padding: 9px 0;
    }
    .toggle-label input[type="checkbox"] {
      width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer;
    }

    /* Recipient placeholder */
    .recipient-placeholder {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 14px; border-radius: 8px;
      background: var(--bg-card-hover); border: 1px dashed var(--border-default);
      font-size: 13px; color: var(--text-muted);
    }
    .lock-icon { font-size: 16px; }

    /* Save error */
    .save-error {
      color: var(--danger, #dc2626); font-size: 13px;
      padding: 8px 12px; border-radius: 8px;
      background: var(--danger-bg, rgba(220,38,38,0.08));
      border: 1px solid var(--danger-border, rgba(220,38,38,0.2));
      margin-top: 12px;
    }

    /* Sites loading */
    .sites-loading { font-size: 12px; color: var(--text-muted); padding: 8px 4px; }

    /* Actions */
    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; border-radius: 8px; border: 1px solid transparent;
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
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
    .btn-secondary {
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: 8px; padding: 8px 16px; color: var(--text-primary);
      font-weight: 600; font-size: 13px; cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .btn-secondary:hover { background: var(--bg-card-hover); border-color: var(--border-strong); }

    @media (max-width: 768px) { .form-row { grid-template-columns: 1fr; } }
  `],
})
export class AlarmFormDialogComponent implements OnInit {
  private alarmService = inject(AlarmService);

  @Input() alarm: Alarm | null = null;
  @Input() groupId!: number;
  @Output() saved = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  // Data from backend
  sites = signal<AlarmSite[]>([]);
  measurements = signal<MeasurementOption[]>([]);

  // Form state
  selectedSites = signal<AlarmSite[]>([]);
  siteSearchText = signal('');
  siteDropdownOpen = false;
  saving = signal(false);
  saveError = signal('');
  sitesLoading = signal(true);

  // Form fields
  formName = '';
  formSeverity: 'aviso' | 'alerta' | 'critico' = 'aviso';
  formMeasurement = '';
  formOperator: '<' | '>' | '=' | '<>' = '>';
  formThreshold: number | null = null;
  formPlaySound = false;
  formShowBanner = false;

  editMode = computed(() => this.alarm !== null);

  filteredSites = computed(() => {
    const search = this.siteSearchText().toLowerCase().trim();
    const selectedIds = new Set(this.selectedSites().map((s) => s.dev_eui));
    return this.sites().filter(
      (s) =>
        !selectedIds.has(s.dev_eui) &&
        (search === '' ||
          s.site_name.toLowerCase().includes(search) ||
          s.municipality.toLowerCase().includes(search)),
    );
  });

  groupedFilteredSites = computed(() => {
    const groups = new Map<string, AlarmSite[]>();
    for (const site of this.filteredSites()) {
      const muni = site.municipality || 'Sin municipio';
      if (!groups.has(muni)) groups.set(muni, []);
      groups.get(muni)!.push(site);
    }
    return Array.from(groups.entries()).map(([municipality, sites]) => ({ municipality, sites }));
  });

  filteredMeasurements = computed(() => {
    const selected = this.selectedSites();
    if (selected.length === 0) return this.measurements();
    const providers = new Set(selected.map((s) => s.proveedor).filter(Boolean));
    if (providers.size === 0) return this.measurements();
    return this.measurements().filter((m) => providers.has(m.provider));
  });

  ngOnInit(): void {
    // Load sites and measurements
    this.alarmService.getSitesForAlarm().subscribe({
      next: (data) => {
        this.sites.set(data);
        this.sitesLoading.set(false);
        // Pre-select current site in edit mode
        if (this.alarm) {
          const match = data.find((s) => s.dev_eui === this.alarm!.dev_eui);
          if (match) {
            this.selectedSites.set([match]);
          } else {
            // Fallback: build a minimal site object so the chip shows even if not in inventory
            this.selectedSites.set([{
              dev_eui: this.alarm.dev_eui,
              site_name: this.alarm.site_name || this.alarm.dev_eui,
              municipality: '',
              proveedor: '',
              site_type: '',
              municipio_id: 0,
            }]);
          }
        }
      },
      error: () => this.sitesLoading.set(false),
    });
    this.alarmService.getMeasurements().subscribe({
      next: (data) => this.measurements.set(data.measurements),
    });

    // Populate form fields if editing
    if (this.alarm) {
      this.formName = this.alarm.name;
      this.formSeverity = this.alarm.severity;
      this.formMeasurement = this.alarm.measurement;
      this.formOperator = this.alarm.comparison_operator;
      this.formThreshold = this.alarm.threshold_value;
      this.formPlaySound = this.alarm.play_sound ?? false;
      this.formShowBanner = this.alarm.show_banner ?? false;
    }
  }

  addSite(site: AlarmSite): void {
    if (this.editMode()) {
      // Edit mode: single selection — replace current
      this.selectedSites.set([site]);
    } else {
      this.selectedSites.update((list) => [...list, site]);
    }
    this.siteSearchText.set('');
    this.siteDropdownOpen = false;
  }

  removeSite(site: AlarmSite): void {
    this.selectedSites.update((list) => list.filter((s) => s.dev_eui !== site.dev_eui));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.site-selector')) {
      this.siteDropdownOpen = false;
    }
  }

  isValid(): boolean {
    return !!(
      this.formName.trim() &&
      this.selectedSites().length > 0 &&
      this.formMeasurement &&
      this.formOperator &&
      this.formThreshold !== null &&
      this.formThreshold !== undefined
    );
  }

  save(): void {
    if (!this.isValid() || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');

    const data: Partial<Alarm> = {
      name: this.formName.trim(),
      severity: this.formSeverity,
      measurement: this.formMeasurement,
      comparison_operator: this.formOperator,
      threshold_value: this.formThreshold!,
      play_sound: this.formPlaySound,
      show_banner: this.formShowBanner,
    };

    if (this.editMode() && this.alarm) {
      data.dev_eui = this.selectedSites()[0].dev_eui;
      this.alarmService.updateAlarm(this.alarm.id, data).subscribe({
        next: () => { this.saving.set(false); this.saved.emit(); },
        error: () => { this.saving.set(false); this.saveError.set('Error al guardar. Intente de nuevo.'); },
      });
    } else if (this.selectedSites().length === 1) {
      // Single alarm
      this.alarmService.createAlarm({
        ...data,
        group_id: this.groupId,
        dev_eui: this.selectedSites()[0].dev_eui,
      }).subscribe({
        next: () => { this.saving.set(false); this.saved.emit(); },
        error: () => { this.saving.set(false); this.saveError.set('Error al guardar. Intente de nuevo.'); },
      });
    } else {
      // Batch
      const devEuis = this.selectedSites().map((s) => s.dev_eui);
      this.alarmService.createAlarmBatch(this.groupId, data, devEuis).subscribe({
        next: () => { this.saving.set(false); this.saved.emit(); },
        error: () => { this.saving.set(false); this.saveError.set('Error al guardar. Intente de nuevo.'); },
      });
    }
  }
}
