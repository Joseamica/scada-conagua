import {
  Component,
  input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

interface MapConfig {
  center: [number, number];
  zoom: number;
  markers: { devEUI: string; label: string; lat: number; lng: number; navigateTo?: number }[];
  showLayer: boolean;
}

@Component({
  selector: 'widget-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="map-widget">
      <div #mapEl class="map-container" *ngIf="hasPosition()"></div>
      <div class="map-placeholder" *ngIf="!hasPosition()">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span>Configura la ubicacion del mapa</span>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
      .map-widget {
        width: 100%;
        height: 100%;
        background: var(--bg-card);
      }
      .map-container {
        width: 100%;
        height: 100%;
      }
      .map-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 8px;
        color: var(--text-muted);
        font-size: 12px;
      }
    `,
  ],
})
export class MapWidget implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;
  cfg = input.required<MapConfig>({ alias: 'config' });

  private map: L.Map | null = null;
  private resizeObserver: ResizeObserver | null = null;

  hasPosition(): boolean {
    const c = this.cfg().center;
    return c[0] !== 0 || c[1] !== 0;
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  private initMap(): void {
    if (!this.mapEl) return;
    const cfg = this.cfg();
    this.map = L.map(this.mapEl.nativeElement, {
      center: cfg.center,
      zoom: cfg.zoom || 12,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(
      this.map,
    );

    for (const m of cfg.markers) {
      L.marker([m.lat, m.lng]).addTo(this.map!).bindTooltip(m.label);
    }

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapEl.nativeElement);
  }
}
