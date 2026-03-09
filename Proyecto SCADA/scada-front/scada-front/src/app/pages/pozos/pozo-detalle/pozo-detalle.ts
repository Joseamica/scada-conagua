// src/app/pages/pozos/pozo-detalle/pozo-detalle.ts

import { Component, computed, signal, ViewChild, ElementRef, AfterViewInit, OnInit, inject, DestroyRef, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { POZOS_DATA } from '../pozos-data';
import { POZOS_LAYOUT } from '../pozos-layout';
import { TIME_RANGES, TimeRange } from '../../../shared/time-ranges';
import { TelemetryService } from '../../../core/services/telemetry';
import { AuditService } from '../../../core/services/audit.service';
import { timer, forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as echarts from 'echarts';
import { ThemeService } from '../../../core/services/theme.service';
import { getEChartsColors } from '../../../core/utils/echarts-theme';

// ICONOS
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroChartBarSquare, heroBolt, heroBeaker, heroChartBar,
  heroSignal, heroCog6Tooth, heroPresentationChartLine, heroExclamationTriangle,
  heroLockClosed, heroArrowsPointingOut, heroArrowsPointingIn,
  heroMagnifyingGlassPlus, heroArrowPath, heroArrowDownTray,
  heroCursorArrowRays, heroTableCells, heroChartPie,
  heroViewfinderCircle, heroPencil, heroChevronDown
} from '@ng-icons/heroicons/outline';
import { bootstrapBatteryFull, bootstrapBatteryHalf, bootstrapBatteryLow } from '@ng-icons/bootstrap-icons';
import { DateRangePickerComponent, DateRangeOutput } from '../../../shared/date-range-picker/date-range-picker';
import { LoadingSpinnerComponent } from '../../../shared/loading-spinner/loading-spinner';

type AlertLevel = 'info' | 'warning' | 'critical';

export interface LiveStatusResponse {
    site_name: string;
    devEui: string;
    municipality: string;
    site_type: string;
    last_flow_value: number;
    last_pressure_value: number;
    battery_level: number;
    is_cfe_on: boolean | string;  // Soportar boolean y 't'/'f'
    last_updated_at: string;
    rssi: number;
    snr: number;
    // 🚀 Nuevos campos para Ixtapaluca e interlocking
    bomba_activa: boolean | string;
    fallo_arrancador: boolean | string;
    last_total_flow: number;
}

export interface TelemetryPoint {
  timestamp: string;
  value: number;
  unit: string;
}

export interface TelemetryHistoryResponse {
  siteName: string;
  devEui: string;
  measurement: string;
  data: TelemetryPoint[];
}

interface TelemetryReading {
  flow: number;     // Lt/s
  pressure: number; // bar
  timestamp: Date;
}

export interface ChartVariable {
  key: string;
  label: string;
  unit: string;
  color: string;
  position: 'left' | 'right';
  defaultOn: boolean;
}

const CHART_VARIABLES: ChartVariable[] = [
  { key: 'caudal_lts',  label: 'Caudal',    unit: 'Lt/s',   color: '#007bff', position: 'left',  defaultOn: true },
  { key: 'presion_kg',  label: 'Presión',   unit: 'Kg/cm²', color: '#28a745', position: 'right', defaultOn: true },
  { key: 'rssi',        label: 'Señal LTE', unit: '%',      color: '#ffc107', position: 'right', defaultOn: false },
  { key: 'snr',         label: 'SNR',       unit: 'dB',     color: '#9333ea', position: 'right', defaultOn: false },
  { key: 'nivel_m',    label: 'Nivel',     unit: 'm',      color: '#06b6d4', position: 'left',  defaultOn: false },
  { key: 'lluvia_mm',  label: 'Lluvia',    unit: 'mm',     color: '#8b5cf6', position: 'right', defaultOn: false },
];

type ChartType = 'line' | 'bar' | 'area' | 'gauge';

const CHART_TYPE_OPTIONS: { key: ChartType; label: string; icon: string }[] = [
  { key: 'line',  label: 'Línea',  icon: 'heroPresentationChartLine' },
  { key: 'bar',   label: 'Barras', icon: 'heroChartBar' },
  { key: 'area',  label: 'Área',   icon: 'heroChartBarSquare' },
  { key: 'gauge', label: 'Gauge',  icon: 'heroChartPie' },
];

@Component({
  selector: 'app-pozo-detalle',
  standalone: true,
  imports: [CommonModule, HeaderBarComponent, FooterTabsComponent, NgIconComponent, DateRangePickerComponent, LoadingSpinnerComponent],
  providers: [
    provideIcons({
      heroChartBarSquare, heroBolt, heroBeaker, heroChartBar,
      heroSignal, heroCog6Tooth, heroPresentationChartLine, heroExclamationTriangle,
      heroLockClosed, bootstrapBatteryFull, bootstrapBatteryHalf, bootstrapBatteryLow,
      heroArrowsPointingOut, heroArrowsPointingIn, heroMagnifyingGlassPlus,
      heroArrowPath, heroArrowDownTray, heroCursorArrowRays, heroTableCells, heroChartPie,
      heroViewfinderCircle, heroPencil, heroChevronDown
    })
  ],
  templateUrl: './pozo-detalle.html',
  styleUrl: './pozo-detalle.css'
})
export class PozoDetalleComponent implements OnInit, AfterViewInit, OnDestroy {
  // Inyecciones
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private telemetryService = inject(TelemetryService);
  private destroyRef = inject(DestroyRef);
  private themeService = inject(ThemeService);
  private auditService = inject(AuditService);

  private lastTotalizerData: [number, number | null][] = [];

  private themeEffect = effect(() => {
    this.themeService.resolved(); // track signal
    if (this.mainChart && Object.keys(this.lastChartData).length > 0) {
      this.renderMainChart();
      this.mainChart.resize();
    }
    if (this.totalizerChart && this.lastTotalizerData.length > 0) {
      this.updateTotalizerChart(this.lastTotalizerData);
      this.totalizerChart.resize();
    }
  });
  public liveStatus = signal<LiveStatusResponse | null>(null);

  // Role-based control: only Admin (1) and Supervisor (2) can operate pumps
  public canControlPump = computed(() => {
    const userData = localStorage.getItem('scada_user_data');
    if (!userData) return false;
    const user = JSON.parse(userData);
    return !!user.can_operate;
  });

  private resizeHandler = () => { this.mainChart?.resize(); this.totalizerChart?.resize(); };

  // 1. Estado para evitar el efecto del refresh de 60s
  public isCommandPending = signal<boolean>(false);

  // 2. Lógica de Interbloqueo (Computed para los botones)
  public controlsDisabled = computed(() => {
    const status = this.liveStatus(); // ✅ Ahora sí existe el nombre
    if (!status) return true;

    // REGLAS DE ANÍBAL:
    const isCfeOff = status.is_cfe_on === false || status.is_cfe_on === 'f';
    const hasStarterFault = status.fallo_arrancador === true || status.fallo_arrancador === 't';
    
    return isCfeOff || hasStarterFault || this.isCommandPending();
  });

  goToAdvanced() {
    this.router.navigate(['/telemetria/avanzadas'], {
      queryParams: { devEUI: this.pozoId() },
    });
  }

  // VIEWCHILD
  @ViewChild('mainChart') mainChartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('totalizerChart') totalizerChartRef!: ElementRef<HTMLDivElement>;
  @ViewChild('datePicker') datePickerRef!: DateRangePickerComponent;
  mainChart!: echarts.ECharts;
  totalizerChart!: echarts.ECharts;

  // Duración en ms de cada botón rápido
  private quickRangeMs: Record<string, number> = {
    '15m': 15*60e3, '30m': 30*60e3, '1h': 3600e3, '6h': 6*3600e3,
    '12h': 12*3600e3, '24h': 86400e3, '7d': 7*86400e3, '1m': 30*86400e3, '1y': 365*86400e3
  };

  // =========================
  // RANGOS
  // =========================
  timeRanges = TIME_RANGES;
  range = signal<TimeRange>('24h');

  setRange(r: TimeRange) {
    this.range.set(r);
    // Sincronizar el date picker con las fechas correspondientes
    if (this.datePickerRef) {
      const now = new Date();
      const ms = this.quickRangeMs[r] || 86400e3;
      const from = new Date(now.getTime() - ms);
      this.datePickerRef.syncFromQuickRange(from, now);
    }
    this.clearCustomRange();
  }

  // =========================
  // RANGO PERSONALIZADO
  // =========================
  customFrom        = signal<string>('');
  customTo          = signal<string>('');
  customInterval    = signal<string>('');
  customRangeActive = computed(() => !!this.customFrom() && !!this.customTo());

  // Pills: descripción legible del filtro activo
  activeRangeLabel = computed(() => {
    if (this.customRangeActive()) {
      const fmt = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
      };
      return `${fmt(this.customFrom())} – ${fmt(this.customTo())}`;
    }
    const labels: Record<string, string> = {
      '15m': 'Últimos 15 min', '30m': 'Últimos 30 min', '1h': 'Última hora',
      '6h': 'Últimas 6h', '12h': 'Últimas 12h', '24h': 'Último día',
      '7d': 'Última semana', '1m': 'Último mes', '1y': 'Último año'
    };
    return labels[this.range()] || this.range();
  });

  activeIntervalLabel = computed(() => {
    if (this.customRangeActive() && this.customInterval()) {
      const map: Record<string, string> = {
        '1m': '1 min', '5m': '5 min', '15m': '15 min', '30m': '30 min',
        '1h': '1 hora', '6h': '6 horas', '1d': '1 día'
      };
      return map[this.customInterval()] || this.customInterval();
    }
    const autoMap: Record<string, string> = {
      '15m': '1 min', '30m': '2 min', '1h': '5 min', '6h': '15 min',
      '12h': '30 min', '24h': '1 hora', '7d': '6 horas', '1m': '1 día', '1y': '7 días'
    };
    return 'Auto (' + (autoMap[this.range()] || '1h') + ')';
  });

  onRangeApplied(event: DateRangeOutput): void {
    this.customFrom.set(event.from);
    this.customTo.set(event.to);
    this.customInterval.set(event.interval);
    console.log('[SCADA] Rango aplicado:', event.from, '→', event.to, '| intervalo:', event.interval || 'Auto', '| preset:', event.preset);
    this.loadCharts();
  }

  clearCustomRange(): void {
    this.customFrom.set('');
    this.customTo.set('');
    this.customInterval.set('');
    this.loadCharts();
  }

  clearInterval(): void {
    this.customInterval.set('');
    this.loadCharts();
  }

  // =========================
  // ESTADO GENERAL (HTML)
  // =========================
  pozoId = signal<string>('');
  pageLoading = signal(true);
  pozoNombre = signal('Cargando...');
  alertLevel = signal<AlertLevel>('warning');
  alertText = signal('');
  isOnline = signal(true);
  loading = signal(false);
  lat = signal<number>(0);
  lng = signal<number>(0);

  // Variable selector for chart
  // Ignition/ICH devices don't have LoRaWAN metrics (RSSI, SNR)
  // Ignition/ICH devices don't have LoRaWAN SNR (no rxInfo in payload)
  isIgnitionDevice = computed(() => this.pozoId().toLowerCase().startsWith('dev'));
  chartVariables = computed(() =>
    this.isIgnitionDevice()
      ? CHART_VARIABLES.filter(v => v.key !== 'snr')
      : CHART_VARIABLES
  );
  selectedVars = signal<Set<string>>(new Set(['caudal_lts', 'presion_kg']));

  // Chart type selector
  chartTypeOptions = CHART_TYPE_OPTIONS;
  chartType = signal<ChartType>('line');
  private lastChartData: Record<string, [number, number | null][]> = {};

  // Totalizer collapse
  totalizerCollapsed = signal(true);

  toggleTotalizer() {
    this.totalizerCollapsed.set(!this.totalizerCollapsed());
    if (!this.totalizerCollapsed()) {
      setTimeout(() => this.totalizerChart?.resize(), 50);
    }
  }

  // Professional toolbar signals
  crosshairEnabled = signal(false);
  activeBrushType = signal<'none' | 'lineX' | 'rect' | 'polygon'>('none');
  isFullscreen = signal(false);
  variableStats = signal<Record<string, { min: number; max: number; avg: number; current: number }>>({});

  private escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.isFullscreen()) {
      this.isFullscreen.set(false);
      setTimeout(() => this.mainChart?.resize(), 50);
    }
  };

  getLiveValue(key: string): number {
    switch (key) {
      case 'caudal_lts': return this.datos().caudal;
      case 'presion_kg': return this.datos().presion;
      case 'rssi': return this.signalPercent();
      case 'snr': return this.commStats().snr;
      case 'nivel_m': return this.datos().nivel;
      case 'lluvia_mm': return this.datos().lluvia;
      default: return 0;
    }
  }

  layout = signal<any>(null);
  datos = signal<any>({
    caudal: 0,
    presion: 0,
    nivel: 0,
    lluvia: 0,
    nombre: 'Cargando...',
    alerta: 'Sincronizando...',
    lte: { rssi: 0, snr: 0 }
  });
  
  // SEÑALES DE ESTADÍSTICAS (Requeridas por el HTML)
  statsFlow = signal({ min: 0, max: 0, avg: 0, accumulated: 0 });
  statsPressure = signal({ min: 0, max: 0, avg: 0 });

  // DATOS OPERATIVOS
  commStats = signal({ lteRssi: 0, snr: 0 });
  batteryLevel = signal<number>(0);
  liveTotalFlow = signal<number>(0);
  estadoBomba = signal<'on' | 'off'>('on');
  estadoEnergia = signal<'on' | 'off'>('on');
  fallaArrancador = signal<'on' | 'off'>('off');

  // =========================
  // LOGICA DEL ARRANCADOR
  // =========================
  // Verde: Listo para arrancar (Bomba parada)
  readonly pilotStartReady = computed(() => this.estadoBomba() === 'off');

  // Rojo: En operación (Bomba corriendo)
  readonly pilotStopReady = computed(() => this.estadoBomba() === 'on');

  // Amarillo: Falla técnica
  readonly pilotFault = computed(() => this.fallaArrancador() === 'on');
  // DETERMINA SI EL BOTÓN DE "ARRANCAR" PUEDE CLIQUEARSE (Solo arranca si: parada + sin falla + hay CFE)
  readonly canStart = computed(() => {
    // Regla: Solo si está parada, NO hay falla y hay energía CFE
    return this.estadoBomba() === 'off' && 
         this.fallaArrancador() === 'off' && 
         this.estadoEnergia() === 'on';
  });

  // DETERMINA SI EL BOTÓN DE "PARAR" PUEDE CLIQUEARSE
  readonly canStop = computed(() => {
    // Regla: Solo si está operando y NO hay falla
    return this.estadoBomba() === 'on' && 
         this.fallaArrancador() === 'off';
  });

  // =========================
  // COMPUTED SIGNALS (Resuelven error TS2339)
  // =========================
  
  statusPill = computed(() =>
    this.isOnline() ? { text: 'On line', cls: 'pill pill--ok' } : { text: 'Off line', cls: 'pill pill--critical' }
  );

  batteryIcon = computed(() => {
    const lvl = this.batteryLevel();
    if (lvl >= 70) return 'bootstrapBatteryFull';
    if (lvl >= 25) return 'bootstrapBatteryHalf';
    return 'bootstrapBatteryLow';
  });

  batteryClass = computed(() => {
    const lvl = this.batteryLevel();
    if (lvl >= 70) return 'battery--full';
    if (lvl >= 25) return 'battery--medium';
    return 'battery--critical';
  });

  signalPercent = computed(() => {
    const rssi = this.commStats().lteRssi;
    // -30 dBm = 100%, -120 dBm = 0%
    const pct = Math.round(((rssi + 120) / 90) * 100);
    return Math.max(0, Math.min(100, pct));
  });

  // ✅ Resuelve: Property 'commQualityLabel' does not exist
  commQualityLabel = computed(() => {
    const rssi = this.commStats().lteRssi;
    if (rssi >= -70) return 'Excelente';
    if (rssi >= -85) return 'Bueno';
    return 'Malo';
  });

  // ✅ Resuelve: Property 'commQualityClass' does not exist
  commQualityClass = computed(() => {
    const rssi = this.commStats().lteRssi;
    if (rssi >= -70) return 'comm-excellent';
    if (rssi >= -85) return 'comm-good';
    return 'comm-bad';
  });

  // =========================
  // OVERLAY LTE
  // =========================
  overlayVisible = signal(false);

  toggleOverlay() {
    this.overlayVisible.set(!this.overlayVisible());
  }

  cerrarOverlay() {
    this.overlayVisible.set(false);
  }

  // =========================
  // CONFIRMACIÓN
  // =========================
  accionPendiente = signal<'start' | 'stop' | null>(null);
  confirmInput = signal('');
  readonly stopConfirmValid = computed(() =>
    this.confirmInput().trim().toLowerCase() === this.pozoNombre().trim().toLowerCase()
  );

  abrirConfirmacion(a: 'start' | 'stop') {
    // Validación de seguridad antes de abrir el modal
    if (a === 'start' && !this.canStart()) {
      console.warn('Acción bloqueada: Condiciones inseguras para arranque.');
      return;
    }

    if (a === 'stop' && !this.canStop()) {
      console.warn('Acción bloqueada: Condiciones inseguras para paro.');
      return;
    }

    this.confirmInput.set('');
    this.accionPendiente.set(a);
  }

  cancelarAccion() {
    this.confirmInput.set('');
    this.accionPendiente.set(null);
  }

  confirmarAccion() {
    const action = this.accionPendiente();
    
    // Role check: only Admin/Supervisor can control pumps
    if (!this.canControlPump()) {
      console.warn('Acción de control denegada: rol insuficiente.');
      return;
    }

    // Seguridad: No procedemos si no hay acción o si los controles están bloqueados (CFE/Fallo)
    if (!action || this.controlsDisabled()) {
      console.warn('Acción de control abortada por interbloqueo de seguridad.');
      return;
    }

    const command = action === 'start' ? 'START' : 'STOP';
    
    // 🔒 Activamos el bloqueo de 90 segundos para ignorar el refresh de la página
    this.isCommandPending.set(true);

    // 📡 Enviamos el payload con site_name para que el backend construya el tópico de Ignition
    this.telemetryService.sendControlCommand({
      devEUI: this.pozoId(),
      command: command,
      siteName: this.liveStatus()?.site_name 
    }).subscribe({
      next: () => {
        // 💡 Optimistic UI Update: Reflejamos el cambio en la UI de inmediato
        this.estadoBomba.set(action === 'start' ? 'on' : 'off');
        
        // Si ya tenemos el status cargado, actualizamos su valor local para ser consistentes
        const currentStatus = this.liveStatus();
        if (currentStatus) {
          this.liveStatus.set({
            ...currentStatus,
            bomba_activa: action === 'start'
          });
        }

        this.accionPendiente.set(null);

        // ⏱️ Desbloqueamos después de 90 segundos (superior al refresh de 60s)
        setTimeout(() => {
          this.isCommandPending.set(false);
          console.log(`[SCADA] Lockout finalizado para ${this.pozoId()}`);
        }, 90000);
      },
      error: (err) => {
        this.isCommandPending.set(false);
        console.error('🛑 Control command failed:', err);
        alert('Error al enviar el comando. Por favor, verifique la conexión con el sitio.');
      }
    });
  }

  // =========================
  // CICLO DE VIDA
  // =========================
  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('id')!;
    let staticData = POZOS_DATA[slug];
    let layoutKey = slug;

    // If slug is a devEUI (not a human-readable slug), find the matching entry
    if (!staticData) {
      const entry = Object.entries(POZOS_DATA).find(
        ([, v]) => (v as any).devEui === slug
      );
      if (entry) {
        layoutKey = entry[0];
        staticData = entry[1] as any;
      }
    }

    if (staticData?.devEui) {
      // Sitio hardcodeado — usar datos estáticos
      this.pozoId.set(staticData.devEui);
      this.lat.set(staticData.lat);
      this.lng.set(staticData.lng);
      this.layout.set(POZOS_LAYOUT[layoutKey]);
      this.startAutoRefresh(staticData.devEui);
    } else {
      // Sitio dinámico — el slug es el devEUI, cargar desde API
      const devEui = slug;
      this.pozoId.set(devEui);
      this.telemetryService.getSite(devEui).subscribe({
        next: (site) => {
          this.pozoNombre.set(site.site_name || devEui);
          if (site.latitude) this.lat.set(site.latitude);
          if (site.longitude) this.lng.set(site.longitude);
        },
        error: () => {
          this.pozoNombre.set(devEui);
        },
      });
      this.startAutoRefresh(devEui);
    }
  }

  ngAfterViewInit() {
    this.mainChart = echarts.init(this.mainChartRef.nativeElement);
    this.totalizerChart = echarts.init(this.totalizerChartRef.nativeElement);

    // Brush-to-zoom: when user drags a range, zoom into that range
    this.mainChart.on('brushEnd', (params: any) => {
      const areas = params.areas;
      if (!areas?.length || !areas[0].coordRange) return;

      const brushType = this.activeBrushType();
      const range = areas[0].coordRange;

      let xStart: number, xEnd: number;

      if (brushType === 'lineX') {
        // coordRange = [xMin, xMax]
        [xStart, xEnd] = range;
      } else if (brushType === 'rect') {
        // coordRange = [[xMin, xMax], [yMin, yMax]]
        [xStart, xEnd] = range[0];
      } else if (brushType === 'polygon') {
        // coordRange = [[x1,y1], [x2,y2], ...] — extract min/max x
        const xs = range.map((p: number[]) => p[0]);
        xStart = Math.min(...xs);
        xEnd = Math.max(...xs);
      } else {
        return;
      }

      this.mainChart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, startValue: xStart, endValue: xEnd });
      this.mainChart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, startValue: xStart, endValue: xEnd });
      // Clear brush selection and deactivate cursor
      this.mainChart.dispatchAction({ type: 'brush', areas: [] });
      this.mainChart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: { brushType: false, brushMode: 'single' }
      });
      this.activeBrushType.set('none');
    });

    this.loadCharts();
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy() {
    if (this.mainChart) this.mainChart.dispose();
    if (this.totalizerChart) this.totalizerChart.dispose();
    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('keydown', this.escHandler);
  }

  private startAutoRefresh(devEui: string) {
    // Carga inmediata del status (no requiere chart inicializado)
    this.loadLiveStatus(devEui);

    // Refresh cada 60s (la primera carga de charts viene de ngAfterViewInit)
    timer(60000, 60000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadLiveStatus(devEui);
        if (this.mainChart) this.loadCharts();
      });
  }

  // =========================
  // LÓGICA DE DATOS
  // =========================
  loadLiveStatus(devEUI: string) {
    this.telemetryService.getSiteStatus(devEUI).subscribe({
      error: (err: any) => {
        if (err.status === 404) {
          this.pozoNombre.set(this.pozoNombre() || devEUI);
        }
        this.pageLoading.set(false);
      },
      next: (data: any) => {
        if (this.isCommandPending()) {
          console.warn(`[SCADA] Refresh ignorado para ${devEUI} debido a comando en proceso.`);
          return;
        }

        this.liveStatus.set(data as LiveStatusResponse);

        // Sincronizamos el estado visual de la bomba
        const isActive = data.bomba_activa === true || data.bomba_activa === 't';
        const hasExplicitBomba = data.bomba_activa != null;

        const flowVal = Number(data.last_flow_value) || 0;
        const pressureVal = Number(data.last_pressure_value) || 0;
        const batteryVal = Number(data.battery_level) || 0;

        // 1. Sincronización básica de UI
        this.pozoNombre.set(data.site_name || this.pozoNombre());
        // PostgreSQL puede devolver 't'/'f' strings — no usar truthiness directa
        const cfeOn = data.is_cfe_on === true || data.is_cfe_on === 't';
        this.isOnline.set(cfeOn);
        this.batteryLevel.set(batteryVal);
        this.liveTotalFlow.set(Number(data.last_total_flow) || 0);
        this.estadoBomba.set(
          hasExplicitBomba ? (isActive ? 'on' : 'off') : (flowVal > 0 ? 'on' : 'off')
        );
        this.estadoEnergia.set(cfeOn ? 'on' : 'off');
        const hasFault = data.fallo_arrancador === true || data.fallo_arrancador === 't';
        this.fallaArrancador.set(hasFault ? 'on' : 'off');
        const rawRssi = Number(data.rssi);
        this.commStats.set({ lteRssi: rawRssi > 0 ? -rawRssi : rawRssi, snr: Number(data.snr) });

        // ✅ 2. Actualizamos 'datos' para que el HTML encuentre los valores
        this.datos.set({
          caudal: flowVal,
          presion: pressureVal,
          nivel: Number(data.last_nivel_value) || 0,
          lluvia: Number(data.last_lluvia_value) || 0,
        });

        this.pageLoading.set(false);
      }
    });
  }

  loadCharts() {
    const devEUI = this.pozoId();
    if (!devEUI) return;

    // Determinar parámetros de rango
    let rangeStr = `-${this.range()}`;
    if (this.range() === '1m') rangeStr = '-1mo';

    const options: { from?: string; to?: string; interval?: string } = {};
    if (this.customRangeActive()) {
      options.from = this.customFrom();
      options.to   = this.customTo();
    }
    if (this.customInterval()) {
      options.interval = this.customInterval();
    }

    this.loading.set(true);

    const selected = this.selectedVars();
    const requests: Record<string, any> = {};

    // Fetch selected chart variables
    for (const v of this.chartVariables()) {
      if (selected.has(v.key)) {
        requests[v.key] = this.telemetryService.getHistory(devEUI, v.key, rangeStr, options);
      }
    }

    // Always fetch flow + pressure for statistics even if not on chart
    if (!selected.has('caudal_lts'))
      requests['_stats_flow'] = this.telemetryService.getHistory(devEUI, 'caudal_lts', rangeStr, options);
    if (!selected.has('presion_kg'))
      requests['_stats_pressure'] = this.telemetryService.getHistory(devEUI, 'presion_kg', rangeStr, options);

    // Always fetch totalizer for bottom chart
    requests['last_total_flow'] = this.telemetryService.getHistory(devEUI, 'last_total_flow', rangeStr, options);

    forkJoin(requests).subscribe({
      next: (res: any) => {
        // Convertir a [timestamp_ms, value] para ECharts time axis
        const toPoint = (p: any): [number, number | null] => {
          const ts = new Date(p.timestamp).getTime();
          const v = p.value;
          return [ts, v != null ? Number(v) : null];
        };

        // Build chart data for selected variables
        const chartData: Record<string, [number, number | null][]> = {};
        for (const v of this.chartVariables()) {
          if (selected.has(v.key) && res[v.key]) {
            if (v.key === 'rssi') {
              // RSSI: convert raw dBm to percentage (0–100%)
              // API returns positive values (e.g. 77 meaning -77 dBm)
              // Formula: -30 dBm = 100%, -120 dBm = 0%
              chartData[v.key] = res[v.key].data.map((p: any) => {
                const ts = new Date(p.timestamp).getTime();
                if (p.value == null) return [ts, null] as [number, number | null];
                const raw = Number(p.value);
                const dbm = raw > 0 ? -raw : raw;
                const pct = Math.max(0, Math.min(100, Math.round(((dbm + 120) / 90) * 100)));
                return [ts, pct] as [number, number | null];
              });
            } else if (v.key === 'snr') {
              // SNR: keep raw values (no zero-threshold filter)
              chartData[v.key] = res[v.key].data.map((p: any) =>
                [new Date(p.timestamp).getTime(), p.value ?? null] as [number, number | null]);
            } else {
              chartData[v.key] = res[v.key].data.map(toPoint);
            }
          }
        }

        // Statistics: always from flow + pressure
        const flowData = res['caudal_lts'] || res['_stats_flow'];
        const pressureData = res['presion_kg'] || res['_stats_pressure'];
        if (flowData && pressureData) {
          const readings: TelemetryReading[] = flowData.data
            .map((p: any, i: number) => ({
              flow:      p.value ?? 0,
              pressure:  pressureData.data[i]?.value ?? 0,
              timestamp: new Date(p.timestamp)
            }))
            .filter((r: TelemetryReading) => !isNaN(r.timestamp.getTime()));
          readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          this.calculateStatistics(readings);
        }

        const totalFlows = res['last_total_flow'].data.map((p: any) =>
          [new Date(p.timestamp).getTime(), p.value ?? null] as [number, number | null]);

        this.lastChartData = chartData;
        this.lastTotalizerData = totalFlows;
        this.computeVariableStats();
        this.renderMainChart();
        this.updateTotalizerChart(totalFlows);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading history:', err);
        this.loading.set(false);
      }
    });
  }

  private calculateStatistics(readings: TelemetryReading[]): void {
    if (readings.length < 2) return;

    // Compute the median interval from the data to detect real gaps (device offline)
    // vs normal aggregation intervals (1h, 6h, 1d). Gaps > 3× median are skipped.
    const intervals = readings.slice(1).map(
      (r, i) => (r.timestamp.getTime() - readings[i].timestamp.getTime()) / 1000
    ).filter(d => d > 0).sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)] ?? 3600;
    const MAX_SIGNAL_GAP_SECONDS = medianInterval * 3;

    let totalAccumulatedLiters = 0;

    // Integrate flow over time using the trapezoidal rule, skipping real gaps
    for (let i = 1; i < readings.length; i++) {
      const durationSeconds = (readings[i].timestamp.getTime() - readings[i - 1].timestamp.getTime()) / 1000;
      if (durationSeconds > 0 && durationSeconds <= MAX_SIGNAL_GAP_SECONDS) {
        const averageFlow = (readings[i].flow + readings[i - 1].flow) / 2;
        totalAccumulatedLiters += averageFlow * durationSeconds;
      }
    }

    const round3 = (n: number) => Math.round(n * 1000) / 1000;

    const flowVals     = readings.map(r => r.flow);
    const pressureVals = readings.map(r => r.pressure);

    this.statsFlow.set({
      min:         round3(Math.min(...flowVals)),
      max:         round3(Math.max(...flowVals)),
      avg:         round3(flowVals.reduce((a, b) => a + b, 0) / flowVals.length),
      accumulated: round3(totalAccumulatedLiters / 1000)
    });

    this.statsPressure.set({
      min: round3(Math.min(...pressureVals)),
      max: round3(Math.max(...pressureVals)),
      avg: round3(pressureVals.reduce((a, b) => a + b, 0) / pressureVals.length)
    });
  }


  private updateMainChart(data: Record<string, [number, number | null][]>): void {
    const selected = this.selectedVars();
    const activeVars = this.chartVariables().filter(v => selected.has(v.key) && data[v.key]);
    const themeColors = getEChartsColors(this.themeService.resolved());

    // Y AXES
    const yAxis: any[] = [];
    const varAxisIndex: Record<string, number> = {};
    let rightOffset = 0;

    for (const v of activeVars) {
      const idx = yAxis.length;
      varAxisIndex[v.key] = idx;
      const isLeft = v.position === 'left';

      const axis: any = {
        type: 'value', name: v.unit, position: isLeft ? 'left' : 'right',
        scale: true,
        axisLabel: { color: v.color, fontSize: 11 },
        nameTextStyle: { color: v.color },
        splitLine: { show: idx === 0, lineStyle: { color: themeColors.splitLine, type: 'dashed' } }
      };

      if (!isLeft && rightOffset > 0) axis.offset = rightOffset;
      if (!isLeft) rightOffset += 60;

      yAxis.push(axis);
    }

    // SERIES
    const series: any[] = [];
    const legendData: string[] = [];
    const type = this.chartType();
    const isBar = type === 'bar';
    const isArea = type === 'area';

    for (const v of activeVars) {
      legendData.push(v.label);
      const isDashed = v.key === 'rssi' || v.key === 'snr';
      const pointCount = data[v.key]?.filter(p => p[1] !== null).length ?? 0;
      const sparse = pointCount < 10;
      const s: any = {
        name: v.label,
        type: isBar ? 'bar' : 'line',
        yAxisIndex: varAxisIndex[v.key],
        data: data[v.key],
        showSymbol: sparse, symbolSize: sparse ? 6 : 4,
        smooth: false, sampling: 'lttb',
        connectNulls: false
      };
      if (isBar) {
        s.itemStyle = { color: v.color };
        s.barMaxWidth = 8;
      } else {
        s.lineStyle = { width: isDashed ? 1 : 1.5, color: v.color, ...(isDashed ? { type: 'dashed' } : {}) };
      }
      if (isArea) {
        s.areaStyle = { color: v.color + '25' };
        s.stack = 'total';
      }
      series.push(s);
    }

    const rightAxes = activeVars.filter(v => v.position === 'right').length;
    const gridRight = Math.max(55, 55 + (rightAxes - 1) * 60);
    const chartVars = this.chartVariables();

    const option: any = {
      backgroundColor: themeColors.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        axisPointer: this.crosshairEnabled()
          ? { type: 'cross', crossStyle: { color: '#94a3b8', type: 'dashed' } }
          : { type: 'line', lineStyle: { color: '#94a3b8', type: 'dashed' } },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const date = new Date(params[0].value[0]);
          const dateStr = date.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          let html = `<div style="margin-bottom:6px;font-weight:600;color:#f1f5f9">${dateStr}</div>`;
          for (const p of params) {
            const cv = chartVars.find(cv => cv.label === p.seriesName);
            const unit = cv?.unit || '';
            const val = p.value[1] !== null && p.value[1] !== undefined ? Number(p.value[1]).toFixed(2) : '—';
            html += `<div style="display:flex;align-items:center;gap:6px;margin:3px 0">`;
            html += `<span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>`;
            html += `<span style="flex:1;color:#cbd5e1">${p.seriesName}</span>`;
            html += `<span style="font-weight:600;color:#f1f5f9">${val} ${unit}</span>`;
            html += `</div>`;
          }
          return html;
        }
      },
      legend: { data: legendData, top: 0, textStyle: { color: themeColors.textColor } },
      grid: { left: 55, right: gridRight, bottom: 70, top: 45 },
      xAxis: {
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          fontSize: 11,
          color: themeColors.subtextColor,
          formatter: (value: number) => {
            const d = new Date(value);
            return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
              + '\n' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          }
        },
        axisLine: { lineStyle: { color: themeColors.axisLine } },
        splitLine: { show: false }
      },
      yAxis,
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
        {
          type: 'slider', xAxisIndex: 0, bottom: 8, height: 22,
          handleSize: '80%',
          handleStyle: { color: '#94a3b8', borderColor: '#64748b' },
          borderColor: 'transparent',
          backgroundColor: 'rgba(148,163,184,0.08)',
          fillerColor: 'rgba(0,123,255,0.12)',
          dataBackground: {
            lineStyle: { color: themeColors.subtextColor, width: 0.5 },
            areaStyle: { color: 'rgba(203,213,225,0.15)' }
          }
        }
      ],
      series
    };

    this.mainChart.setOption(option, true);
  }



  private updateTotalizerChart(totalFlows: [number, number | null][]): void {
    const vals = totalFlows.map(p => p[1]).filter((v): v is number => v !== null);
    const c = getEChartsColors(this.themeService.resolved());
    if (vals.length === 0) {
      this.totalizerChart.setOption({ backgroundColor: c.backgroundColor, title: { text: 'Sin datos de caudal totalizado', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } }, series: [] }, true);
      return;
    }

    this.totalizerChart.setOption({
      backgroundColor: c.backgroundColor,
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15,23,42,0.92)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const d = new Date(p.value[0]);
          return `${d.toLocaleString()}<br/><b>${p.marker} ${p.value[1]?.toLocaleString()} m³</b>`;
        }
      },
      grid: { left: 70, right: 20, bottom: 70, top: 40 },
      xAxis: {
        type: 'time', boundaryGap: false,
        axisLabel: { color: c.subtextColor },
        axisLine: { lineStyle: { color: c.axisLine } }
      },
      yAxis: {
        type: 'value', name: 'm³',
        axisLabel: { color: c.subtextColor },
        nameTextStyle: { color: c.subtextColor },
        splitLine: { lineStyle: { color: c.splitLine, type: 'dashed' } }
      },
      dataZoom: [
        { type: 'inside', xAxisIndex: 0, filterMode: 'filter' },
        {
          type: 'slider', xAxisIndex: 0, bottom: 8, height: 22, handleSize: '80%',
          handleStyle: { color: '#94a3b8', borderColor: '#64748b' },
          borderColor: 'transparent',
          backgroundColor: 'rgba(148,163,184,0.08)',
          fillerColor: 'rgba(0,123,255,0.12)',
          dataBackground: {
            lineStyle: { color: c.subtextColor, width: 0.5 },
            areaStyle: { color: 'rgba(203,213,225,0.15)' }
          }
        }
      ],
      series: [{
        name: 'Totalizado',
        type: 'line',
        data: totalFlows,
        showSymbol: false,
        smooth: false,
        sampling: 'lttb',
        lineStyle: { width: 1.5, color: '#e91e8f' },
        areaStyle: { color: 'rgba(233,30,143,0.08)' },
        connectNulls: false
      }]
    }, true);
  }

  toggleVar(key: string) {
    const current = new Set(this.selectedVars());
    if (current.has(key)) {
      if (current.size <= 1) return; // al menos una variable
      current.delete(key);
    } else {
      current.add(key);
    }
    this.selectedVars.set(current);
    this.loadCharts();
  }

  isVarSelected(key: string): boolean {
    return this.selectedVars().has(key);
  }

  setChartType(t: ChartType) {
    this.chartType.set(t);
    // Gauge uses live data, no need to re-fetch
    if (t === 'gauge') {
      this.renderGauge();
      return;
    }
    // Re-render from cached data if available
    if (Object.keys(this.lastChartData).length > 0) {
      this.renderMainChart();
    } else {
      this.loadCharts();
    }
  }

  private renderMainChart() {
    if (this.chartType() === 'gauge') {
      this.renderGauge();
    } else {
      this.updateMainChart(this.lastChartData);
    }
  }

  // =========================
  // GAUGE CHART
  // =========================
  private renderGauge(): void {
    const selected = this.selectedVars();
    const activeVars = this.chartVariables().filter(v => selected.has(v.key));
    const series: any[] = [];
    const count = activeVars.length;

    activeVars.forEach((v, i) => {
      let currentValue = 0;
      let max = 100;

      if (v.key === 'caudal_lts') {
        currentValue = this.datos().caudal;
        max = Math.max(50, currentValue * 1.5);
      } else if (v.key === 'presion_kg') {
        currentValue = this.datos().presion;
        max = Math.max(10, currentValue * 1.5);
      } else if (v.key === 'rssi') {
        currentValue = this.signalPercent();
        max = 100;
      } else if (v.key === 'snr') {
        currentValue = this.commStats().snr;
        max = 30;
      }

      const centerX = `${(100 / (count + 1)) * (i + 1)}%`;

      series.push({
        type: 'gauge',
        center: [centerX, '55%'],
        radius: count <= 2 ? '75%' : '55%',
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: Math.ceil(max),
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 18,
            color: [[0.3, '#e5e7eb'], [0.7, v.color + '60'], [1, v.color]]
          }
        },
        axisTick: { distance: -18, length: 6, lineStyle: { color: '#fff', width: 2 } },
        splitLine: { distance: -18, length: 18, lineStyle: { color: '#fff', width: 3 } },
        axisLabel: { distance: 25, color: '#64748b', fontSize: 11 },
        pointer: { width: 5, length: '60%', itemStyle: { color: v.color } },
        anchor: { show: true, size: 14, itemStyle: { borderWidth: 2, borderColor: v.color } },
        title: { show: true, offsetCenter: [0, '85%'], fontSize: 14, color: '#475569', fontWeight: 600 },
        detail: {
          valueAnimation: true,
          formatter: `{value} ${v.unit}`,
          fontSize: 18, fontWeight: 700,
          color: v.color,
          offsetCenter: [0, '65%']
        },
        data: [{ value: Number(currentValue.toFixed(2)), name: v.label }]
      });
    });

    this.mainChart.setOption({ series }, true);
  }

  // =========================
  // TOOLBAR ACTIONS
  // =========================
  toggleCrosshair() {
    this.crosshairEnabled.set(!this.crosshairEnabled());
    if (Object.keys(this.lastChartData).length > 0 && this.chartType() !== 'gauge') {
      this.updateMainChart(this.lastChartData);
    }
  }

  setBrushType(type: 'lineX' | 'rect' | 'polygon') {
    if (!this.mainChart) return;
    const current = this.activeBrushType();
    if (current === type) {
      // Toggle off
      this.activeBrushType.set('none');
      this.mainChart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: { brushType: false, brushMode: 'single' }
      });
    } else {
      // Register brush on-demand (hidden from UI) then activate
      this.mainChart.setOption({ brush: { toolbox: [], xAxisIndex: 0 } });
      this.activeBrushType.set(type);
      this.mainChart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: { brushType: type, brushMode: 'single' }
      });
    }
  }

  resetZoom() {
    if (!this.mainChart) return;
    this.activeBrushType.set('none');
    this.mainChart.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: { brushType: false, brushMode: 'single' }
    });
    this.mainChart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 0, start: 0, end: 100 });
    this.mainChart.dispatchAction({ type: 'dataZoom', dataZoomIndex: 1, start: 0, end: 100 });
  }

  toggleFullscreen() {
    const next = !this.isFullscreen();
    this.isFullscreen.set(next);
    if (next) {
      document.addEventListener('keydown', this.escHandler);
    } else {
      document.removeEventListener('keydown', this.escHandler);
    }
    setTimeout(() => {
      this.mainChart?.resize();
      this.totalizerChart?.resize();
    }, 50);
  }

  downloadChartPng() {
    if (!this.mainChart) return;
    const url = this.mainChart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.pozoNombre()}_grafica.png`;
    a.click();
    this.auditService.logAction('EXPORT_CHART_PNG', { details: { site: this.pozoNombre() } }).subscribe();
  }

  exportCsv() {
    const selected = this.selectedVars();
    const activeVars = this.chartVariables().filter(v => selected.has(v.key));
    if (activeVars.length === 0) return;

    const allTimestamps = new Set<number>();
    for (const v of activeVars) {
      const d = this.lastChartData[v.key];
      if (d) d.forEach(p => allTimestamps.add(p[0]));
    }
    const sorted = Array.from(allTimestamps).sort((a, b) => a - b);

    const lookups: Record<string, Map<number, number | null>> = {};
    for (const v of activeVars) {
      const map = new Map<number, number | null>();
      const d = this.lastChartData[v.key];
      if (d) d.forEach(p => map.set(p[0], p[1]));
      lookups[v.key] = map;
    }

    const headers = ['Fecha', ...activeVars.map(v => `${v.label} (${v.unit})`)];
    const rows = sorted.map(ts => {
      const date = new Date(ts).toLocaleString('es-MX');
      const values = activeVars.map(v => {
        const val = lookups[v.key].get(ts);
        return val !== null && val !== undefined ? val.toString() : '';
      });
      return [date, ...values].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.pozoNombre()}_telemetria.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.auditService.logAction('EXPORT_TELEMETRY_CSV', { details: { site: this.pozoNombre() } }).subscribe();
  }

  private computeVariableStats() {
    const stats: Record<string, { min: number; max: number; avg: number; current: number }> = {};
    for (const v of this.chartVariables()) {
      if (!this.selectedVars().has(v.key)) continue;
      const data = this.lastChartData[v.key];
      if (!data || data.length === 0) continue;
      const values = data.map(d => d[1]).filter((x): x is number => x !== null);
      if (values.length === 0) continue;
      stats[v.key] = {
        min: Math.round(Math.min(...values) * 1000) / 1000,
        max: Math.round(Math.max(...values) * 1000) / 1000,
        avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 1000) / 1000,
        current: Math.round(values[values.length - 1] * 1000) / 1000
      };
    }
    this.variableStats.set(stats);
  }

}