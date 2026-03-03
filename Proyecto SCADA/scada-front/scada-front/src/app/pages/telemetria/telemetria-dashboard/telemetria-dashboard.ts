import { Component, signal, computed } from '@angular/core';
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

import { PozosStore } from '../../../core/stores/pozos.store';

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
export class TelemetriaDashboard {

  // =========================
  // FILTROS (signals)
  // =========================
  estadoSel = signal<string>('ESTADO DE MEXICO');
  municipioSel = signal<string>('ECATEPEC DE MORELOS');
  tipoSel = signal<string | null>(null);
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
  sites = computed(() =>
    this.pozosActivos().map(nombre => ({
      name: nombre,
      type: 'Pozo',
      estado: 'ESTADO DE MEXICO',
      municipio: 'ECATEPEC DE MORELOS',
      zone: 'Zona operativa',
      value: 'N/A',
      unit: 'L/s',
      status: 'ok',
      timestamp: '-'
    }))
  );

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
  private readonly DEFAULT_ESTADO = 'ESTADO DE MEXICO';
  private readonly DEFAULT_MUNICIPIO = 'ECATEPEC DE MORELOS';

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.estadoSel() && this.estadoSel() !== this.DEFAULT_ESTADO) count++;
    if (this.municipioSel() && this.municipioSel() !== this.DEFAULT_MUNICIPIO) count++;
    if (this.tipoSel()) count++;
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

  constructor(private router: Router, private pozosStore: PozosStore) {}

  get pozosActivos() {
    return this.pozosStore.highlightWells;
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
    this.busqueda.set('');
  }

  goToAdvancedCharts() {
    this.router.navigate(['/telemetria/avanzadas']);
  }

  openAdvancedCharts(site: any) {
    this.router.navigate(['/telemetria/avanzadas'], {
      state: { site }
    });
  }

  crearNuevoSitio() {
    this.router.navigate(['/sitios/nuevo'], {
      queryParams: {
        source: 'telemetria'
      }
    });
  }

  editarSitio(site: any, index: number) {
    this.router.navigate(['/sitios/editar', index]);
  }
}
