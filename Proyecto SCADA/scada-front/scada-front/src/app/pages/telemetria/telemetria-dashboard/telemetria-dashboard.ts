import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';

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
  heroTrash
} from '@ng-icons/heroicons/outline';

import { TelemetryService } from '../../../core/services/telemetry';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner';

// JSON Estados / Municipios
import estadosJson from '../../../../assets/data/estados.json';


@Component({
  selector: 'app-telemetria-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderBarComponent,
    FooterTabsComponent,
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
      heroTrash
    })
  ],
  templateUrl: './telemetria-dashboard.html',
  styleUrls: ['./telemetria-dashboard.css']
})
export class TelemetriaDashboard implements OnInit {

  // =========================
  // FILTROS (signals)
  // =========================
  estadoSel = signal<string>('');
  municipioSel = signal<string>('');
  tipoSel = signal<string | null>(null);
  statusSel = signal<string>('');
  busqueda = signal<string>('');
  filtersCollapsed = signal(false);

  loading = signal(true);
  sitios: any[] = [];

  // =========================
  // CATÁLOGOS
  // =========================

  // Derived from actual site data — only show states/municipios with wells
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
  // SITIOS ACTIVOS
  // =========================
  sites = signal<any[]>([]);

  // =========================
  // KPI COMPUTED
  // =========================
  sitesActivos = computed(() =>
    this.sites().filter(s => s.status === 'ok').length
  );

  sitesSinGasto = computed(() =>
    this.sites().filter(s => s.status === 'no-flow').length
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

  private normalize(v: string) {
    return v.toUpperCase().replace(/\s+/g, ' ').trim();
  }

  sitesFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();

    return this.sites().filter(site => {
      if (this.estadoSel() && site.estado !== this.estadoSel()) return false;
      if (this.municipioSel() && site.municipio !== this.municipioSel()) return false;
      if (this.tipoSel() && site.type !== this.tipoSel()) return false;
      if (this.statusSel() && site.status !== this.statusSel()) return false;

      if (q) {
        return site.name.toLowerCase().includes(q);
      }

      return true;
    });
  });

  // =========================
  // LAST UPDATED
  // =========================
  lastUpdated = signal(this.formatNow());

  private formatNow(): string {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  embed = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private telemetryService: TelemetryService,
    private authService: AuthService
  ) {
    this.embed.set(this.route.snapshot.queryParamMap.get('embed') === '1');
  }

  ngOnInit(): void {
    this.loadSites();
  }

  private loadSites(): void {
    this.telemetryService.getSites().subscribe({
      next: (apiSites) => {
        const mapped = apiSites.map(s => {
          const siteType = s.site_type
            ? s.site_type.charAt(0).toUpperCase() + s.site_type.slice(1).toLowerCase()
            : 'Pozo';
          const municipio = s.municipality?.trim() || 'Sin zona';
          const flow = s.last_flow_value != null ? Number(s.last_flow_value) : null;
          const hasTelemetry = s.last_updated_at != null;
          const hasFlow = flow != null && flow > 0.01;

          // Detect COMM LOSS: has telemetry record but last update >15 min ago
          const isStale = hasTelemetry && (Date.now() - new Date(s.last_updated_at!).getTime() > 15 * 60 * 1000);

          let status: string;
          if (!hasTelemetry) {
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
            timestamp: hasTelemetry ? this.formatTimestamp(s.last_updated_at!) : 'Esperando primera lectura',
          };
        });

        // Scope filtering is handled by the backend (municipio_id scope in GET /sites)
        // No client-side filtering needed — avoids name mismatch bugs
        this.sites.set(mapped);
        this.lastUpdated.set(this.formatNow());
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

  countByMunicipio(municipio: string): number {
    return this.sites().filter(s => s.municipio === municipio).length;
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
    this.tipoSel.set(null);
    this.statusSel.set('');
    this.busqueda.set('');
  }

  goToAdvancedCharts() {
    this.router.navigate(['/telemetria/avanzadas']);
  }

  openAdvancedCharts(site: any) {
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

  editarSitio(site: any) {
    if (site.devEUI) {
      this.router.navigate(['/sitios/editar', site.devEUI]);
    }
  }

  goToSiteDetail(site: any, event: MouseEvent) {
    // Don't navigate if user clicked an action button
    const target = event.target as HTMLElement;
    if (target.closest('.col-actions-cell')) return;
    if (site.devEUI) {
      this.router.navigate(['/pozos', site.devEUI]);
    }
  }

  eliminarSitio(site: any) {
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
