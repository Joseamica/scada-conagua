import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HeaderBarComponent } from '../../layout/header-bar/header-bar';
import { SidebarNavComponent } from '../../layout/sidebar-nav/sidebar-nav';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner';
import { RainService, RainStation, RainCutResponse } from '../../core/services/rain.service';

@Component({
  selector: 'app-lluvias',
  standalone: true,
  templateUrl: './lluvias.html',
  styleUrls: ['./lluvias.css'],
  imports: [HeaderBarComponent, SidebarNavComponent, LoadingSpinnerComponent, DatePipe, DecimalPipe],
})
export class LluviasComponent implements OnInit {
  private rainService = inject(RainService);

  loading = signal(true);
  activeTab = signal<'monitor' | 'corte' | 'historico'>('monitor');

  // Monitor tab
  stations = signal<RainStation[]>([]);
  acumMode = signal<'6am' | '1h' | '6h'>('6am');
  filterMunicipio = signal('');
  sortBy = signal<'name' | 'value' | 'code'>('value');

  // Corte tab
  cutDate = signal(new Date().toISOString().split('T')[0]);
  cutData = signal<RainCutResponse | null>(null);
  cutLoading = signal(false);

  // KPIs
  totalStations = computed(() => this.stations().length);
  stationsWithRain = computed(() => this.stations().filter(s => s.last_value_mm > 0).length);
  maxRainfall = computed(() => {
    const vals = this.stations().map(s => s.last_value_mm);
    return vals.length > 0 ? Math.max(...vals) : 0;
  });
  totalAccumulated = computed(() =>
    this.stations().reduce((sum, s) => sum + (s.last_value_mm || 0), 0)
  );

  // Filtered & sorted stations
  filteredStations = computed(() => {
    let list = this.stations();
    const mun = this.filterMunicipio();
    if (mun) list = list.filter(s => s.municipality === mun);

    const sort = this.sortBy();
    if (sort === 'value') list = [...list].sort((a, b) => b.last_value_mm - a.last_value_mm);
    else if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'code') list = [...list].sort((a, b) => a.code.localeCompare(b.code));

    return list;
  });

  municipalities = computed(() => {
    const set = new Set(this.stations().map(s => s.municipality));
    return Array.from(set).sort();
  });

  // Corte hours for table header
  cutHours = [
    '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17',
    '18', '19', '20', '21', '22', '23', '00', '01', '02', '03', '04', '05'
  ];

  ngOnInit() {
    this.loadStations();
    this.loadCut(this.cutDate());
  }

  loadStations() {
    this.loading.set(true);
    this.rainService.getCurrent().subscribe({
      next: (data) => {
        // PostgreSQL NUMERIC comes as string — cast to number
        this.stations.set(data.map((s: any) => ({ ...s, last_value_mm: Number(s.last_value_mm) || 0 })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadCut(date: string) {
    this.cutLoading.set(true);
    this.rainService.getCuts(date).subscribe({
      next: (data) => {
        this.cutData.set(data);
        this.cutLoading.set(false);
      },
      error: () => this.cutLoading.set(false),
    });
  }

  onCutDateChange(date: string) {
    this.cutDate.set(date);
    this.loadCut(date);
  }

  getHourValue(station: any, hour: string): number {
    return Number(station[`h${hour}`]) || 0;
  }

  getIntensityClass(mm: number): string {
    if (mm >= 10) return 'rain-intense';
    if (mm >= 5) return 'rain-heavy';
    if (mm >= 1) return 'rain-moderate';
    if (mm > 0) return 'rain-light';
    return '';
  }

  timeAgo(timestamp: string | null): string {
    if (!timestamp) return 'Sin datos';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Hace ${hrs}h`;
    return `Hace ${Math.floor(hrs / 24)}d`;
  }
}
