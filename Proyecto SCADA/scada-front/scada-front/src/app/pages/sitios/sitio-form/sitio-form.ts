import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroMapPin,
  heroBuildingOffice2,
  heroPhoto,
  heroCloudArrowUp,
  heroSignal,
  heroCpuChip,
  heroWrenchScrewdriver,
  heroSparkles,
} from '@ng-icons/heroicons/outline';

import { HttpErrorResponse } from '@angular/common/http';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { TelemetryService } from '../../../core/services/telemetry';
import { POZOS_DATA } from '../../pozos/pozos-data';
import { POZOS_LAYOUT } from '../../pozos/pozos-layout';

const estadosJson = require('../../../../assets/data/estados.json');

interface EstadoMunicipio {
  estado: string;
  municipios: Record<string, string>;
}

@Component({
  standalone: true,
  selector: 'app-sitio-form',
  imports: [ReactiveFormsModule, HeaderBarComponent, FooterTabsComponent, CommonModule, NgIconComponent],
  providers: [
    provideIcons({
      heroArrowLeft,
      heroMapPin,
      heroBuildingOffice2,
      heroPhoto,
      heroCloudArrowUp,
      heroSignal,
      heroCpuChip,
      heroWrenchScrewdriver,
      heroSparkles,
    }),
  ],
  templateUrl: './sitio-form.html',
  styleUrls: ['./sitio-form.css'],
})
export class SitioForm implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private telemetry = inject(TelemetryService);

  saving = signal(false);
  errorMsg = signal('');

  modo: 'create' | 'edit' = 'create';
  sitioId: string | null = null;
  renderFileName = '';

  tiposSitio = [
    { value: 'pozo', label: 'Pozo', icon: 'heroWrenchScrewdriver' },
    { value: 'pluviometro', label: 'Pluviometro', icon: 'heroCloudArrowUp' },
    { value: 'drenaje', label: 'Drenaje', icon: 'heroSignal' },
    { value: 'agua_bloque', label: 'Agua en bloque', icon: 'heroSignal' },
    { value: 'estanque', label: 'Estanque', icon: 'heroSignal' },
  ];

  estatusSitio = [
    { value: 'activo', label: 'Activo' },
    { value: 'obra', label: 'En obra' },
    { value: 'inactivo', label: 'Inactivo' },
  ];

  estados: EstadoMunicipio[] = [];
  municipiosFiltrados: string[] = [];

  proveedores = [
    { id: 1, nombre: '4PT' },
    { id: 2, nombre: 'ICH' },
  ];

  // Auto-detection state
  autoDetected = signal(false);
  locationVisible = signal(false);
  detectionFailed = signal(false);
  missingCoords = signal(false);
  private geoFeatures: any[] = [];
  private baseEstadosData: Record<string, { estado: string; municipios: Record<string, string> }> = {};

  form = this.fb.group({
    nombre: ['', Validators.required],
    tipo: ['pozo'],
    estatus: ['activo'],
    estado: ['', Validators.required],
    municipio: ['', Validators.required],
    proveedor: [null as number | null, Validators.required],
    devEUI: ['', Validators.required],
    gatewayId: [''],
    utrId: [''],
    lat: [0],
    lng: [0],
    render: [''],
  });

  ngOnInit() {
    const data: unknown = estadosJson;
    this.baseEstadosData = (data as { default: any }).default || data;
    this.estados = Object.values(this.baseEstadosData) as EstadoMunicipio[];

    this.form.get('estado')?.valueChanges.subscribe((estadoNombre) => {
      const encontrado = this.estados.find((e) => e.estado === estadoNombre);
      if (encontrado && encontrado.municipios) {
        this.municipiosFiltrados = Object.values(encontrado.municipios);
      } else {
        this.municipiosFiltrados = [];
      }
      this.form.get('municipio')?.setValue('');
    });

    // Load GeoJSON for auto-detection
    fetch('assets/mapas/edomex_municipios.geojson')
      .then((r) => r.json())
      .then((geo) => {
        this.geoFeatures = geo.features;
        // If coords come pre-filled from GIS, detect immediately
        const lat = this.form.value.lat;
        const lng = this.form.value.lng;
        if (lat && lng) {
          this.detectLocation(+lat, +lng);
        }
      })
      .catch(() => {
        /* GeoJSON unavailable — form works normally */
      });

    // detectar si viene edicion
    this.sitioId = this.route.snapshot.paramMap.get('id');
    if (this.sitioId) {
      this.modo = 'edit';
      this.locationVisible.set(true);
      this.loadSitio();
    }

    // detectar si viene desde GIS con coordenadas
    const qp = this.route.snapshot.queryParams;
    if (qp['lat']) {
      this.form.patchValue({ lat: qp['lat'], lng: qp['lng'] });
    }
  }

  loadSitio() {
    if (!this.sitioId) return;
    this.telemetry.getSite(this.sitioId).subscribe({
      next: (site) => {
        // Normalize site_type to lowercase to match form values (DB stores 'Pozo', form uses 'pozo')
        const normalizedType = (site.site_type || 'pozo').toLowerCase();
        const validTypes = this.tiposSitio.map((t) => t.value);
        const tipo = validTypes.includes(normalizedType) ? normalizedType : 'pozo';

        // Patch form with existing data
        this.form.patchValue({
          nombre: site.site_name,
          tipo,
          devEUI: site.dev_eui,
          gatewayId: site.gw_eui,
          lat: site.latitude || 0,
          lng: site.longitude || 0,
        });
        // Disable devEUI in edit mode — it's the primary key
        this.form.get('devEUI')?.disable();

        // Patch proveedor from API if available, fallback to POZOS_DATA
        if (site.proveedor) {
          const provMatch = this.proveedores.find(
            (p) => p.nombre.toLowerCase() === site.proveedor!.toLowerCase(),
          );
          if (provMatch) this.form.patchValue({ proveedor: provMatch.id });
        }
        if (site.estatus) {
          this.form.patchValue({ estatus: site.estatus });
        }

        // Fallback: look up proveedor and render from hardcoded data by devEUI
        const devEui = (site.dev_eui || '').trim();
        const dataKey = Object.keys(POZOS_DATA).find(
          (k) => (POZOS_DATA[k].devEui || '').trim() === devEui,
        );
        if (dataKey) {
          const pozoData = POZOS_DATA[dataKey];
          // Only use hardcoded proveedor if API didn't provide one
          if (!site.proveedor) {
            const provMatch = this.proveedores.find(
              (p) => p.nombre.toLowerCase() === (pozoData.proveedor || '').toLowerCase(),
            );
            if (provMatch) {
              this.form.patchValue({ proveedor: provMatch.id });
            }
          }

          // Load render from layout data
          const layoutData = POZOS_LAYOUT[dataKey];
          if (layoutData?.render) {
            this.form.patchValue({ render: 'assets/pozos/' + layoutData.render });
            this.renderFileName = layoutData.render;
          }
        }

        // Trigger location detection from lat/lng to populate estado + municipio
        if (site.latitude && site.longitude) {
          // Wait for geoFeatures to load, then detect
          const tryDetect = () => {
            if (this.geoFeatures.length > 0) {
              this.detectLocation(site.latitude!, site.longitude!);
            } else {
              setTimeout(tryDetect, 100);
            }
          };
          tryDetect();
        } else if (site.municipality) {
          // No coords — try to find municipality in estados data manually
          this.setMunicipioFromName(site.municipality);
        }
      },
      error: () => {
        this.errorMsg.set('No se pudo cargar el sitio.');
      },
    });
  }

  private setMunicipioFromName(municipality: string) {
    const normalized = municipality.trim().toLowerCase();
    for (const estado of this.estados) {
      const munNames = Object.values(estado.municipios);
      const match = munNames.find(m => m.toLowerCase() === normalized);
      if (match) {
        this.form.patchValue({ estado: estado.estado });
        setTimeout(() => {
          this.form.patchValue({ municipio: match });
          this.locationVisible.set(true);
        }, 50);
        return;
      }
    }
    // Couldn't match — just show the raw municipality in the field
    this.form.patchValue({ municipio: municipality });
    this.locationVisible.set(true);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMsg.set('');

    if (this.modo === 'create') {
      const v = this.form.value;
      const payload = {
        dev_eui: v.devEUI?.trim() || '',
        gw_eui: v.gatewayId?.trim() || undefined,
        site_name: v.nombre?.trim() || '',
        site_type: v.tipo || 'pozo',
        municipality: v.municipio?.trim() || '',
        latitude: v.lat || undefined,
        longitude: v.lng || undefined,
        proveedor: this.proveedores.find((p) => p.id === v.proveedor)?.nombre || undefined,
        estatus: v.estatus || 'activo',
      };

      this.saving.set(true);
      this.telemetry.createSite(payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/telemetria']);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.errorMsg.set(err.error?.error || 'Ya existe un sitio con ese DevEUI.');
          } else if (err.status === 400) {
            this.errorMsg.set(err.error?.error || 'Datos incompletos o invalidos.');
          } else {
            this.errorMsg.set('Error al guardar el sitio. Intenta de nuevo.');
          }
        },
      });
    } else {
      const v = this.form.getRawValue();
      const payload = {
        site_name: v.nombre?.trim() || '',
        site_type: v.tipo || 'pozo',
        municipality: v.municipio?.trim() || '',
        gw_eui: v.gatewayId?.trim() || undefined,
        latitude: v.lat || undefined,
        longitude: v.lng || undefined,
        proveedor: this.proveedores.find((p) => p.id === v.proveedor)?.nombre || undefined,
        estatus: v.estatus || 'activo',
      };

      this.saving.set(true);
      this.telemetry.updateSite(this.sitioId!, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/telemetria']);
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.errorMsg.set(err.error?.error || 'Conflicto: Gateway ID duplicado.');
          } else if (err.status === 400) {
            this.errorMsg.set(err.error?.error || 'Datos incompletos o invalidos.');
          } else {
            this.errorMsg.set('Error al actualizar el sitio. Intenta de nuevo.');
          }
        },
      });
    }
  }

  onRenderSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.renderFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.form.patchValue({ render: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  removeRender() {
    this.form.patchValue({ render: '' });
    this.renderFileName = '';
  }

  cancelar() {
    this.router.navigate(['/telemetria']);
  }

  // --- Public: triggered by button ---

  detectarUbicacion() {
    const lat = +(this.form.value.lat ?? 0);
    const lng = +(this.form.value.lng ?? 0);
    if (!lat || !lng) {
      this.missingCoords.set(true);
      return;
    }
    this.missingCoords.set(false);
    this.detectLocation(lat, lng);
  }

  // --- Auto-detection internals ---

  private detectLocation(lat: number, lng: number) {
    if (!lat || !lng || this.geoFeatures.length === 0) {
      this.autoDetected.set(false);
      this.detectionFailed.set(false);
      return;
    }

    for (const feature of this.geoFeatures) {
      const geom = feature.geometry;
      const polygons: number[][][] =
        geom.type === 'MultiPolygon'
          ? geom.coordinates.flatMap((p: number[][][]) => p)
          : geom.coordinates;

      for (const ring of polygons) {
        if (this.pointInPolygon(lat, lng, ring)) {
          const cveEnt: string = feature.properties.CVE_ENT;
          const cveMun: string = feature.properties.CVE_MUN;
          this.applyDetectedLocation(cveEnt, cveMun);
          return;
        }
      }
    }

    // No polygon matched — show fields for manual input
    this.autoDetected.set(false);
    this.detectionFailed.set(true);
    this.locationVisible.set(true);
  }

  private pointInPolygon(lat: number, lng: number, coords: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      const [xi, yi] = coords[i]; // GeoJSON = [lng, lat]
      const [xj, yj] = coords[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  private applyDetectedLocation(cveEnt: string, cveMun: string) {
    const estadoData = this.baseEstadosData[cveEnt];
    if (!estadoData) {
      this.autoDetected.set(false);
      this.detectionFailed.set(true);
      this.locationVisible.set(true);
      return;
    }

    // GeoJSON CVE_MUN is zero-padded ("039"), estados.json keys are not ("39")
    const munKey = parseInt(cveMun, 10).toString();
    const munName = estadoData.municipios[munKey];
    if (!munName) {
      this.autoDetected.set(false);
      this.detectionFailed.set(true);
      this.locationVisible.set(true);
      return;
    }

    this.detectionFailed.set(false);
    this.form.patchValue({ estado: estadoData.estado });

    // Wait a tick for municipiosFiltrados to be populated, then set municipio
    setTimeout(() => {
      if (this.municipiosFiltrados.includes(munName)) {
        this.form.patchValue({ municipio: munName });
        this.autoDetected.set(true);
        this.locationVisible.set(true);
      } else {
        this.autoDetected.set(false);
        this.detectionFailed.set(true);
        this.locationVisible.set(true);
      }
    }, 50);
  }
}
