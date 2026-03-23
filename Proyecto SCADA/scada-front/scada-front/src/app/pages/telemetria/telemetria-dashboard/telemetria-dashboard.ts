import { Component, signal, computed, OnInit, OnDestroy, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { SidebarNavComponent } from '../../../layout/sidebar-nav/sidebar-nav';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroChartBarSquare,
  heroCog8Tooth,
  heroArrowPath,
  heroPlus,
  heroPencilSquare,
  heroSignal,
  heroCheckCircle,
  heroExclamationTriangle,
  heroFunnel,
  heroClock,
  heroAdjustmentsHorizontal,
  heroChevronDown,
  heroChevronUp,
  heroChevronRight,
  heroArrowLeft,
  heroMapPin,
  heroMagnifyingGlass,
  heroTrash,
  heroXCircle,
  heroWifi,
} from '@ng-icons/heroicons/outline';

import { TelemetryService } from '../../../core/services/telemetry';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner';

// Shared constant for COMM LOSS detection
const COMM_LOSS_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes


// Status labels and colors
const STATUS_LABELS: Record<string, string> = {
  'ok': 'Operando',
  'no-flow': 'Sin gasto',
  'no-signal': 'Sin com.',
  'pending': 'Pendiente',
  'obra': 'En obra',
};

interface DashboardSite {
  devEUI: string;
  name: string;
  type: string;
  estado: string;
  municipio: string;
  zone: string;
  value: string;
  unit: string;
  status: string;
  rssi: number | null;
  signalPct: number | null;
  timestamp: string;
}

@Component({
  selector: 'app-telemetria-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderBarComponent,
    SidebarNavComponent,
    NgIconComponent,
    LoadingSpinnerComponent
  ],
  providers: [
    provideIcons({
      heroChartBarSquare,
      heroCog8Tooth,
      heroArrowPath,
      heroPlus,
      heroPencilSquare,
      heroSignal,
      heroCheckCircle,
      heroExclamationTriangle,
      heroFunnel,
      heroClock,
      heroAdjustmentsHorizontal,
      heroChevronDown,
      heroChevronUp,
      heroChevronRight,
      heroArrowLeft,
      heroMapPin,
      heroMagnifyingGlass,
      heroTrash,
      heroXCircle,
      heroWifi,
    })
  ],
  templateUrl: './telemetria-dashboard.html',
  styleUrls: ['./telemetria-dashboard.css']
})
export class TelemetriaDashboard implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);

  // =========================
  // FILTROS (signals) — all use '' for "no filter"
  // =========================
  estadoSel = signal<string>('');
  municipioSel = signal<string>('');
  tipoSel = signal<string>('');
  statusSel = signal<string>('');
  busqueda = signal<string>('');
  filtersCollapsed = signal(false);

  loading = signal(true);

  // =========================
  // CATÁLOGOS
  // =========================
  estados = computed(() => {
    const unique = [...new Set(this.sites().map(s => s.estado))];
    return unique.filter(e => e).sort();
  });

  municipios = computed(() => {
    if (!this.estadoSel()) return [];
    const unique = [...new Set(
      this.sites()
        .filter(s => s.estado === this.estadoSel())
        .map(s => s.municipio)
    )];
    return unique.filter(m => m && m !== 'Sin zona').sort();
  });

  tiposSitio: string[] = [
    'Pozo',
    'Red Primaria',
    'Agua en Bloque',
    'Tanque',
    'Rebombeo',
    'PTAR'
  ];

  // =========================
  // SITIOS
  // =========================
  sites = signal<DashboardSite[]>([]);

  // =========================
  // KPI COMPUTED — react to filters, separated by status
  // =========================
  sitesOperando = computed(() =>
    this.sitesFiltrados().filter(s => s.status === 'ok').length
  );

  sitesSinGasto = computed(() =>
    this.sitesFiltrados().filter(s => s.status === 'no-flow').length
  );

  sitesSinCom = computed(() =>
    this.sitesFiltrados().filter(s => s.status === 'no-signal').length
  );

  sitesPendientes = computed(() =>
    this.sitesFiltrados().filter(s => s.status === 'pending').length
  );

  // =========================
  // FILTRO CENTRAL
  // =========================
  activeFilterCount = computed(() => {
    let count = 0;
    if (this.estadoSel()) count++;
    if (this.municipioSel()) count++;
    if (this.tipoSel()) count++;
    if (this.statusSel()) count++;
    if (this.busqueda()) count++;
    return count;
  });

  // Status priority for sorting: problems first, then active, then pending
  private readonly STATUS_ORDER: Record<string, number> = {
    'no-signal': 0, 'no-flow': 1, 'ok': 2, 'obra': 3, 'pending': 4
  };

  sitesFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();

    const filtered = this.sites().filter(site => {
      if (this.estadoSel() && site.estado !== this.estadoSel()) return false;
      if (this.municipioSel() && site.municipio !== this.municipioSel()) return false;
      if (this.tipoSel() && site.type !== this.tipoSel()) return false;
      if (this.statusSel() && site.status !== this.statusSel()) return false;

      if (q) {
        return site.name.toLowerCase().includes(q) || site.devEUI.toLowerCase().includes(q);
      }

      return true;
    });

    // Sort: problems first (no-signal → no-flow → ok → obra → pending)
    return filtered.sort((a, b) => {
      const oa = this.STATUS_ORDER[a.status] ?? 9;
      const ob = this.STATUS_ORDER[b.status] ?? 9;
      return oa - ob;
    });
  });

  // Pre-computed municipio counts (replaces O(n*m) countByMunicipio method)
  municipioCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const s of this.sites()) {
      counts.set(s.municipio, (counts.get(s.municipio) || 0) + 1);
    }
    return counts;
  });

  // Count of sites for the selected estado (used in tree "Todos los municipios")
  estadoSiteCount = computed(() => {
    const est = this.estadoSel();
    if (!est) return this.sites().length;
    return this.sites().filter(s => s.estado === est).length;
  });

  // =========================
  // PERMISSIONS
  // =========================
  canEdit = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return false;
    if (user.role_id === 1) return true;
    return user.role_id <= 3; // Admin, Supervisor, Operador
  });

  // =========================
  // LAST UPDATED
  // =========================
  lastUpdated = signal('Cargando...');
  lastUpdatedStale = signal(false);
  private lastLoadTime = 0;

  private updateRelativeTime() {
    if (!this.lastLoadTime) return;
    const elapsed = Math.floor((Date.now() - this.lastLoadTime) / 1000);
    if (elapsed < 5) {
      this.lastUpdated.set('Justo ahora');
    } else if (elapsed < 60) {
      this.lastUpdated.set(`Hace ${elapsed}s`);
    } else {
      const mins = Math.floor(elapsed / 60);
      this.lastUpdated.set(`Hace ${mins}m`);
    }
    this.lastUpdatedStale.set(elapsed > 120); // stale after 2 min
  }

  embed = signal(false);
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private timeInterval: ReturnType<typeof setInterval> | null = null;

  private skipParamSync = true; // prevent effect from firing on initial read

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private telemetryService: TelemetryService,
    private authService: AuthService
  ) {
    this.embed.set(this.route.snapshot.queryParamMap.get('embed') === '1');

    // Read filters from URL on init
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('estado')) this.estadoSel.set(qp.get('estado')!);
    if (qp.get('municipio')) this.municipioSel.set(qp.get('municipio')!);
    if (qp.get('tipo')) this.tipoSel.set(qp.get('tipo')!);
    if (qp.get('status')) this.statusSel.set(qp.get('status')!);
    if (qp.get('q')) this.busqueda.set(qp.get('q')!);
    // Sync filters → URL (replaceUrl so no extra history entries)
    effect(() => {
      const estado = this.estadoSel();
      const municipio = this.municipioSel();
      const tipo = this.tipoSel();
      const status = this.statusSel();
      const q = this.busqueda();

      if (this.skipParamSync) return;

      const params: Record<string, string> = {};
      if (estado) params['estado'] = estado;
      if (municipio) params['municipio'] = municipio;
      if (tipo) params['tipo'] = tipo;
      if (status) params['status'] = status;
      if (q) params['q'] = q;

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: params,
        replaceUrl: true,
      });
    });
  }

  ngOnInit(): void {
    this.loadSites();
    this.skipParamSync = false; // enable param sync after init
    // Auto-refresh every 60 seconds
    this.refreshInterval = setInterval(() => this.loadSites(), 60_000);
    // Update relative time every 5 seconds
    this.timeInterval = setInterval(() => this.updateRelativeTime(), 5_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  private loadSites(): void {
    this.telemetryService.getSites().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (apiSites) => {
        const now = Date.now();
        const mapped: DashboardSite[] = apiSites.map(s => {
          const siteType = s.site_type
            ? s.site_type.charAt(0).toUpperCase() + s.site_type.slice(1).toLowerCase()
            : 'Pozo';
          const municipio = s.municipality?.trim() || 'Sin zona';
          const flow = s.last_flow_value != null ? Number(s.last_flow_value) : null;
          const hasTelemetry = s.last_updated_at != null;
          const hasFlow = flow != null && flow > 0.01;
          const estatus = ((s as any).estatus || 'activo').toLowerCase();

          // Detect COMM LOSS
          const isStale = hasTelemetry && (now - new Date(s.last_updated_at!).getTime() > COMM_LOSS_THRESHOLD_MS);

          let status: string;
          if (estatus === 'obra') {
            status = 'obra';
          } else if (!hasTelemetry) {
            status = 'pending';
          } else if (isStale) {
            status = 'no-signal';
          } else if (hasFlow) {
            status = 'ok';
          } else {
            status = 'no-flow';
          }

          return {
            devEUI: s.dev_eui,
            name: s.site_name,
            type: siteType,
            estado: 'Estado de México',
            municipio,
            zone: municipio,
            value: flow != null ? flow.toFixed(2) : 'N/A',
            unit: 'L/s',
            status,
            rssi: s.rssi ?? null,
            signalPct: this.rssiToPercent(s.rssi),
            timestamp: hasTelemetry ? this.formatTimestamp(s.last_updated_at!) : '—',
          };
        });

        this.sites.set(mapped);
        this.lastLoadTime = Date.now();
        this.updateRelativeTime();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('TelemetriaDashboard: Error al cargar sitios', err);
        this.loading.set(false);
      },
    });
  }

  private formatTimestamp(isoString: string): string {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    const day = d.getDate().toString().padStart(2, '0');
    const mon = (d.getMonth() + 1).toString().padStart(2, '0');
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${day}/${mon} ${h}:${m}`;
  }

  // =========================
  // HELPERS
  // =========================

  statusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
  }

  /** Convert RSSI (dBm) to 0–100 % (LoRaWAN typical range: -120 dBm = 0%, -30 dBm = 100%) */
  private rssiToPercent(rssi: number | null | undefined): number | null {
    if (rssi == null) return null;
    const clamped = Math.max(-120, Math.min(-30, rssi));
    return Math.round(((clamped + 120) / 90) * 100);
  }

  signalLevel(pct: number | null): string {
    if (pct == null) return 'none';
    if (pct >= 60) return 'good';
    if (pct >= 30) return 'fair';
    return 'poor';
  }

  // =========================
  // ACCIONES
  // =========================

  resetFiltros() {
    this.estadoSel.set('');
    this.municipioSel.set('');
    this.tipoSel.set('');
    this.statusSel.set('');
    this.busqueda.set('');
  }

  // Quick-filter from KPI card click
  filterByStatus(status: string) {
    if (this.statusSel() === status) {
      this.statusSel.set(''); // toggle off
    } else {
      this.statusSel.set(status);
    }
  }

  refreshData() {
    this.loadSites();
  }

  goToAdvancedCharts() {
    this.router.navigate(['/telemetria/avanzadas']);
  }

  openAdvancedCharts(site: DashboardSite) {
    this.router.navigate(['/telemetria/avanzadas'], {
      queryParams: { devEUI: site.devEUI }
    });
  }

  crearNuevoSitio() {
    this.router.navigate(['/sitios/nuevo'], {
      queryParams: {
        source: 'telemetria'
      }
    });
  }

  editarSitio(site: DashboardSite) {
    if (site.devEUI) {
      this.router.navigate(['/sitios/editar', site.devEUI]);
    }
  }

  goToSiteDetail(site: DashboardSite, event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('.col-actions-cell')) return;
    if (site.devEUI) {
      this.router.navigate(['/pozos', site.devEUI]);
    }
  }

  eliminarSitio(site: DashboardSite) {
    if (!site.devEUI) return;
    if (!confirm(`¿Eliminar el sitio "${site.name}"? Esta acción no se puede deshacer.`)) return;

    this.telemetryService.deleteSite(site.devEUI).subscribe({
      next: () => {
        this.sites.update(sites => sites.filter(s => s.devEUI !== site.devEUI));
      },
      error: (err) => {
        console.error('Error al eliminar sitio:', err);
        alert(err.error?.error || 'Error al eliminar el sitio.');
      },
    });
  }
}
