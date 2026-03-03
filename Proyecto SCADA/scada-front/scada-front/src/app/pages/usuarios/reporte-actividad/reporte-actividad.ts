import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowPath,
  heroDocumentChartBar,
  heroSquaresPlus,
  heroMagnifyingGlass,
  heroUserGroup,
  heroGlobeAmericas,
  heroBolt
} from '@ng-icons/heroicons/outline';
import { AuditService, AuditLogEntry, AuditLogParams } from '../../../core/services/audit.service';
import { ROLE_MAP } from '../../../core/constants/roles';
import { DateRangePickerComponent, DateRangeOutput } from '../../../shared/date-range-picker/date-range-picker';

interface ActionMeta {
  label: string;
  category: 'auth' | 'user' | 'control' | 'entity' | 'export' | 'nav';
}

const ACTION_META: Record<string, ActionMeta> = {
  // Auth
  LOGIN_SUCCESS:            { label: 'Login exitoso',        category: 'auth' },
  LOGIN_FAILED:             { label: 'Login fallido',        category: 'auth' },
  LOGOUT:                   { label: 'Logout',               category: 'auth' },
  TOTP_ENABLED:             { label: '2FA activado',         category: 'auth' },
  TOTP_DISABLED:            { label: '2FA desactivado',      category: 'auth' },
  PASSWORD_RESET_REQUESTED: { label: 'Reset solicitado',     category: 'auth' },
  PASSWORD_RESET_SUCCESS:   { label: 'Reset exitoso',        category: 'auth' },
  // User management
  CREATE_USER_SUCCESS:      { label: 'Usuario creado',       category: 'user' },
  CREATE_USER_FAILED:       { label: 'Error crear usuario',  category: 'user' },
  UPDATE_USER:              { label: 'Usuario actualizado',  category: 'user' },
  USER_SOFT_DELETE:         { label: 'Usuario desactivado',  category: 'user' },
  ADMIN_PASSWORD_RESET:     { label: 'Reset por admin',      category: 'user' },
  PERMISSION_UPDATED:       { label: 'Permisos actualizados', category: 'user' },
  // Control
  PUMP_COMMAND_SENT:        { label: 'Bomba: comando',       category: 'control' },
  PUMP_COMMAND_FAILED:      { label: 'Bomba: error',         category: 'control' },
  // Entities / Inventory
  ENTITY_CREATED:           { label: 'Entidad creada',       category: 'entity' },
  SITE_CREATED:             { label: 'Sitio creado',         category: 'entity' },
  // Data export
  EXPORT_CHART_PNG:         { label: 'Export PNG',           category: 'export' },
  EXPORT_TELEMETRY_CSV:     { label: 'Export CSV',           category: 'export' },
  EXPORT_AUDIT_CSV:         { label: 'Export auditoria',     category: 'export' },
  // Navigation
  NAVIGATE_TO_MODULE:       { label: 'Navegacion',           category: 'nav' },
};

// Backward-compatible flat labels for filters
const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(ACTION_META).map(([k, v]) => [k, v.label])
);

@Component({
  selector: 'reporte-actividad',
  standalone: true,
  imports: [
    CommonModule,
    HeaderBarComponent,
    FooterTabsComponent,
    NgIconComponent,
    DateRangePickerComponent
  ],
  providers: [
    provideIcons({
      heroArrowPath,
      heroDocumentChartBar,
      heroSquaresPlus,
      heroMagnifyingGlass,
      heroUserGroup,
      heroGlobeAmericas,
      heroBolt
    })
  ],
  templateUrl: './reporte-actividad.html',
  styleUrl: './reporte-actividad.css',
})
export class ReporteActividad implements OnInit {

  constructor(private auditService: AuditService) {}

  /* =========================
     UI STATE
  ========================= */

  search = signal('');
  filtersOpen = signal(false);

  fechaDesde = signal('');
  fechaHasta = signal('');
  filterRol = signal<string>('ALL');
  filterNivel = signal<string>('ALL');
  filterAccion = signal<string>('ALL');

  roleOptions = Object.values(ROLE_MAP);

  actionOptions = Object.entries(ACTION_LABELS)
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  translateAction(action: string): string {
    return ACTION_LABELS[action] || action;
  }

  actionCategory(action: string): string {
    return ACTION_META[action]?.category || 'nav';
  }

  /* =========================
     DATA
  ========================= */

  logs = signal<AuditLogEntry[]>([]);
  currentPage = signal(1);
  totalPages = signal(1);
  totalRecords = signal(0);
  loading = signal(false);

  ngOnInit() {
    this.loadLogs();
  }

  /* =========================
     DATA LOADING
  ========================= */

  loadLogs() {
    this.loading.set(true);
    const params: AuditLogParams = {
      page: this.currentPage(),
      limit: 50
    };

    if (this.fechaDesde()) params.from = this.fechaDesde();
    if (this.fechaHasta()) params.to = this.fechaHasta();

    this.auditService.getLogs(params).subscribe({
      next: (res) => {
        this.logs.set(res.data);
        this.totalPages.set(res.pagination.pages);
        this.totalRecords.set(res.pagination.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading audit logs:', err);
        this.loading.set(false);
      }
    });
  }

  /* =========================
     FILTERING (client-side on loaded page)
  ========================= */

  filteredLogs = computed(() => {
    const q = this.search().trim().toLowerCase();
    const rol = this.filterRol();
    const nivel = this.filterNivel();
    const accion = this.filterAccion();

    return this.logs().filter(l => {
      const matchesQ =
        !q ||
        `${l.full_name} ${l.email} ${l.action} ${this.translateAction(l.action)}`.toLowerCase().includes(q);

      const matchesRol =
        rol === 'ALL' || l.role_name === rol;

      const matchesNivel =
        nivel === 'ALL' || l.scope === nivel;

      const matchesAccion =
        accion === 'ALL' || l.action === accion;

      return matchesQ && matchesRol && matchesNivel && matchesAccion;
    });
  });

  /* =========================
     ACTIONS
  ========================= */

  toggleFilters() {
    this.filtersOpen.set(!this.filtersOpen());
  }

  clearFilters() {
    this.search.set('');
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.filterRol.set('ALL');
    this.filterNivel.set('ALL');
    this.filterAccion.set('ALL');
    this.currentPage.set(1);
    this.loadLogs();
  }

  onRangeApplied(range: DateRangeOutput) {
    this.fechaDesde.set(range.from);
    this.fechaHasta.set(range.to);
    this.currentPage.set(1);
    this.loadLogs();
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
      this.loadLogs();
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
      this.loadLogs();
    }
  }

  downloadReport() {
    const params: AuditLogParams = {};
    if (this.fechaDesde()) params.from = this.fechaDesde();
    if (this.fechaHasta()) params.to = this.fechaHasta();

    this.auditService.exportCSV(params).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reporte_auditoria.csv';
        a.click();
        window.URL.revokeObjectURL(url);
        this.auditService.logAction('EXPORT_AUDIT_CSV', {}).subscribe();
      },
      error: (err) => {
        console.error('Error downloading report:', err);
      }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('es-MX', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }
}
