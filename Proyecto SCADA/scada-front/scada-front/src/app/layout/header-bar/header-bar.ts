import { Component, ElementRef, HostListener, computed, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, ActivatedRoute, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { HeaderTitleService } from '../../core/services/header-title.service';
import {
  heroChevronDown,
  heroArrowRightOnRectangle,
  heroIdentification,
  heroSun,
  heroMoon,
  heroComputerDesktop
} from '@ng-icons/heroicons/outline';
import {
  heroBellAlertSolid,
  heroEnvelopeSolid
} from '@ng-icons/heroicons/solid';
import { AuthService } from '../../core/services/auth.service';
import { AuditService } from '../../core/services/audit.service';
import { ThemeService } from '../../core/services/theme.service';
import { AlarmService } from '../../core/services/alarm.service';
import { ROLE_MAP } from '../../core/constants/roles';

@Component({
  selector: 'app-header-bar',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  templateUrl: './header-bar.html',
  styleUrl: './header-bar.css',
  providers: [
    provideIcons({
      heroBellAlertSolid,
      heroEnvelopeSolid,
      heroChevronDown,
      heroArrowRightOnRectangle,
      heroIdentification,
      heroSun,
      heroMoon,
      heroComputerDesktop
    })
  ]
})
export class HeaderBarComponent implements OnInit, OnDestroy {

  // ======================
  // ESTADOS
  // ======================
  pageTitle: string = '';

  menuOpen = false;
  alertsOpen = false;
  inboxOpen = false;

  // ======================
  // RELOJ EN VIVO
  // ======================
  liveClock = signal('');
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  // ======================
  // ALARMAS (datos reales)
  // ======================
  alertCount = computed(() => this.alarmService.activeCount());
  alertLabel = computed(() => {
    const c = this.alertCount();
    return c === 0 ? 'Sin alertas' : `${c} Alerta${c > 1 ? 's' : ''}`;
  });
  hasCritical = computed(() => this.alarmService.criticalCount() > 0);
  bannerAlarms = computed(() => this.alarmService.bannerAlarms());
  bannerDismissed = new Set<number>();

  // ======================
  // SONIDO DE ALARMA
  // ======================
  private audioCtx: AudioContext | null = null;
  private soundInterval: any = null;
  private prevSoundIds = new Set<number>();
  private soundPending = false;

  // ======================
  // USUARIO (computed from AuthService signal)
  // ======================
  userName = computed(() => {
    const user = this.authService.currentUser();
    return user?.full_name || 'Usuario';
  });

  userEmail = computed(() => {
    const user = this.authService.currentUser();
    return user?.email || '';
  });

  userRole = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return '';
    return ROLE_MAP[user.role_id] || 'Usuario';
  });

  userInitials = computed(() => {
    const name = this.userName();
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  });

  // ======================
  // TEMA
  // ======================
  themeIcon = computed(() => {
    const pref = this.themeService.preference();
    if (pref === 'dark') return 'heroMoon';
    if (pref === 'system') return 'heroComputerDesktop';
    return 'heroSun';
  });

  themeLabel = computed(() => {
    const pref = this.themeService.preference();
    if (pref === 'dark') return 'Tema: Oscuro';
    if (pref === 'system') return 'Tema: Sistema';
    return 'Tema: Claro';
  });

  toggleTheme() {
    this.themeService.toggle();
  }

  constructor(
    private router: Router,
    private authService: AuthService,
    private auditService: AuditService,
    private elementRef: ElementRef,
    public headerTitleService: HeaderTitleService,
    private themeService: ThemeService,
    public alarmService: AlarmService
  ) {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.pageTitle = this.getRouteTitle(this.router.routerState.root);
      });
  }

  private soundEffect = effect(() => {
    const soundAlarms = this.alarmService.soundAlarms();
    const newIds = new Set(soundAlarms.map(a => a.id));
    // Check if there are NEW sound alarms we haven't seen before
    const hasNew = soundAlarms.some(a => !this.prevSoundIds.has(a.id));
    this.prevSoundIds = newIds;

    if (hasNew && soundAlarms.length > 0) {
      this.startAlarmSound();
    } else if (soundAlarms.length === 0) {
      this.stopAlarmSound();
    }
  });

  ngOnInit() {
    this.alarmService.startPolling(15000);
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
  }

  private updateClock() {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    this.liveClock.set(`${h}:${m}:${s}`);
  }

  ngOnDestroy() {
    this.alarmService.stopPolling();
    this.stopAlarmSound();
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  private getAudioCtx(): AudioContext | null {
    if (!this.audioCtx) {
      try { this.audioCtx = new AudioContext(); } catch { return null; }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private startAlarmSound() {
    this.stopAlarmSound();
    this.soundPending = true;
    this.playAlarmPattern();
    // Repeat alarm pattern every 30 seconds
    this.soundInterval = setInterval(() => this.playAlarmPattern(), 30000);
  }

  private stopAlarmSound() {
    this.soundPending = false;
    if (this.soundInterval) {
      clearInterval(this.soundInterval);
      this.soundInterval = null;
    }
  }

  private playAlarmPattern() {
    const ctx = this.getAudioCtx();
    if (!ctx || ctx.state === 'suspended') {
      // AudioContext blocked — will retry on next user click
      this.soundPending = true;
      return;
    }
    try {
      // Two-beep alarm: short pause between beeps
      const tones = [
        { freq: 880, start: 0,   dur: 0.18 },
        { freq: 880, start: 0.3, dur: 0.18 },
      ];
      for (const t of tones) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = t.freq;
        osc.type = 'square';
        gain.gain.value = 0.25;
        const s = ctx.currentTime + t.start;
        osc.start(s);
        osc.stop(s + t.dur);
      }
    } catch { /* AudioContext error */ }
  }


  dismissBanner(alarmId: number) {
    this.bannerDismissed.add(alarmId);
  }

  visibleBanners() {
    return this.bannerAlarms().filter(a => !this.bannerDismissed.has(a.id));
  }

  private getRouteTitle(route: ActivatedRoute): string {
    let currentRoute = route;
    let title = '';

    while (currentRoute.firstChild) {
      currentRoute = currentRoute.firstChild;
      if (currentRoute.snapshot.data['title']) {
        title = currentRoute.snapshot.data['title'];
      }
    }

    return title || 'SCADA';
  }

  // ======================
  // TOGGLES
  // ======================
  toggleMenu() {
    const was = this.menuOpen;
    this.closeAll();
    this.menuOpen = !was;
  }

  toggleAlerts() {
    const was = this.alertsOpen;
    this.closeAll();
    this.alertsOpen = !was;
  }

  toggleInbox() {
    const was = this.inboxOpen;
    this.closeAll();
    this.inboxOpen = !was;
  }

  closeAll() {
    this.menuOpen = false;
    this.alertsOpen = false;
    this.inboxOpen = false;
  }

  // ======================
  // CLICK FUERA
  // ======================
  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const clickedInside = this.elementRef.nativeElement.contains(event.target);
    if (!clickedInside) {
      this.closeAll();
    }
    // Resume alarm sound after user interaction unlocks AudioContext
    if (this.soundPending && this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        if (this.soundPending) this.playAlarmPattern();
      }).catch(() => {});
    }
  }

  // ======================
  // ACCIONES
  // ======================
  goHome() {
    this.closeAll();
    this.router.navigate(['/dashboard']);
  }

  goPerfil() {
    this.closeAll();
    this.router.navigate(['/perfil']);
  }

  goToAlarmas() {
    this.closeAll();
    this.router.navigate(['/alarmas']);
  }

  logout() {
    this.auditService.logAction('LOGOUT', {}).subscribe({
      complete: () => this.authService.logout(),
      error: () => this.authService.logout(),
    });
  }
}
