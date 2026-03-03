import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

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
  heroMagnifyingGlass
} from '@ng-icons/heroicons/outline';

import { TelemetryService } from '../../../core/services/telemetry';
import { AuthService } from '../../../core/services/auth.service';

// JSON Estados / Municipios
import estadosJson from '../../../../assets/data/estados.json';


@Component({
  selector: 'app-telemetria-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderBarComponent,
    FooterTabsComponent,
    NgIconComponent
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
      heroMagnifyingGlass
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

  sitios: any[] = [];

  // =========================
  // CATÁLOGOS
  // =========================

  estados: string[] = Object.values(estadosJson)
    .map((e: any) => e.estado)
    .filter(e => e !== 'SIN ESTADO');

  municipios = computed(() => {
    if (!this.estadoSel()) return [];

    const estadoObj = Object.values(estadosJson)
      .find((e: any) => e.estado === this.estadoSel());

    if (!estadoObj) return [];

    return Object.values(estadoObj.municipios)
      .filter((m: any) => m !== 'SIN MUNICIPIO');
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

  sitesSinSenal = computed(() =>
    this.sites().filter(s => s.status === 'no-signal').length
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

  constructor(
    private router: Router,
    private telemetryService: TelemetryService,
    private authService: AuthService
  ) {}

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
          const municipio = s.municipality?.toUpperCase().trim() || 'SIN MUNICIPIO';
          const flow = s.last_flow_value != null ? Number(s.last_flow_value) : null;
          const hasTelemetry = s.last_updated_at != null;
          const hasFlow = flow != null && flow > 0.01;

          let status: string;
          if (!hasTelemetry) {
            status = 'pending';
          } else if (hasFlow) {
            status = 'ok';
          } else {
            status = 'no-signal';
          }

          return {
            devEUI: s.dev_eui,
            name: s.site_name,
            type: siteType,
            estado: 'ESTADO DE MEXICO',
            municipio,
            zone: s.municipality || 'Sin zona',
            value: flow != null ? flow.toFixed(2) : 'N/A',
            unit: 'L/s',
            status,
            timestamp: hasTelemetry ? this.formatTimestamp(s.last_updated_at!) : 'Esperando primera lectura',
          };
        });

        // Municipal scope isolation
        const user = this.authService.currentUser();
        if (user?.scope === 'Municipal' && user.estado_id && user.scope_id) {
          const estadoEntry = (estadosJson as any)[String(user.estado_id)];
          if (estadoEntry?.municipios) {
            const userMunicipio = estadoEntry.municipios[String(user.scope_id)];
            if (userMunicipio) {
              const normalizedUserMunicipio = this.normalize(userMunicipio);
              this.sites.set(mapped.filter(s => this.normalize(s.municipio) === normalizedUserMunicipio));
              this.lastUpdated.set(this.formatNow());
              return;
            }
          }
        }

        this.sites.set(mapped);
        this.lastUpdated.set(this.formatNow());
      },
      error: (err) => {
        console.error('TelemetriaDashboard: Error al cargar sitios', err);
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
}
