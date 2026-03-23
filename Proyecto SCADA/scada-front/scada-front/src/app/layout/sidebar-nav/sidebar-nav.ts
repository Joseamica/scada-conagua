import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroHome,
  heroChartBarSquare,
  heroMapPin,
  heroBellAlert,
  heroRectangleGroup,
  heroBriefcase,
  heroVariable,
  heroCloudArrowDown,
  heroCog6Tooth,
  heroClock,
  heroEnvelope,
  heroUsers,
  heroDocumentText,
  heroArrowRightOnRectangle,
  heroSun,
  heroMoon,
  heroComputerDesktop,
  heroPresentationChartLine,
} from '@ng-icons/heroicons/outline';
import { heroBellAlertSolid, heroEnvelopeSolid } from '@ng-icons/heroicons/solid';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { AlarmService } from '../../core/services/alarm.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
  minRole?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  templateUrl: './sidebar-nav.html',
  styleUrl: './sidebar-nav.css',
  imports: [CommonModule, NgIconComponent, RouterLink],
  providers: [
    provideIcons({
      heroHome,
      heroChartBarSquare,
      heroMapPin,
      heroBellAlert,
      heroBellAlertSolid,
      heroRectangleGroup,
      heroBriefcase,
      heroVariable,
      heroCloudArrowDown,
      heroCog6Tooth,
      heroClock,
      heroEnvelope,
      heroEnvelopeSolid,
      heroUsers,
      heroDocumentText,
      heroArrowRightOnRectangle,
      heroSun,
      heroMoon,
      heroComputerDesktop,
      heroPresentationChartLine,
    }),
  ],
})
export class SidebarNavComponent {
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private alarmService = inject(AlarmService);
  private router = inject(Router);

  expanded = signal(false);

  private allSections: NavSection[] = [
    {
      title: 'Principal',
      items: [
        { label: 'Inicio', icon: 'heroHome', route: '/dashboard', exact: true },
        { label: 'Telemetria', icon: 'heroChartBarSquare', route: '/telemetria' },
        { label: 'Mapa SIG', icon: 'heroMapPin', route: '/modulo-gis' },
      ],
    },
    {
      title: 'Monitoreo',
      items: [
        { label: 'Analiticas', icon: 'heroPresentationChartLine', route: '/analiticas' },
        { label: 'Lluvias', icon: 'heroCloudArrowDown', route: '/lluvias' },
        { label: 'Alarmas', icon: 'heroBellAlert', route: '/alarmas', exact: true },
      ],
    },
    {
      title: 'Herramientas',
      items: [
        { label: 'Sinopticos', icon: 'heroRectangleGroup', route: '/sinopticos' },
        { label: 'Variables', icon: 'heroVariable', route: '/variables' },
        { label: 'Resumen gasto', icon: 'heroPresentationChartLine', route: '/gerencia/overview-gastos' },
      ],
    },
    {
      title: 'Configuracion',
      items: [
        { label: 'Config. Alarmas', icon: 'heroCog6Tooth', route: '/alarmas/configuracion' },
        { label: 'Historial', icon: 'heroClock', route: '/alarmas/historial' },
        { label: 'Destinatarios', icon: 'heroEnvelope', route: '/alarmas/destinatarios' },
      ],
    },
    {
      title: 'Sistema',
      items: [
        { label: 'Usuarios', icon: 'heroUsers', route: '/usuarios', minRole: 1 },
        { label: 'Bitacora', icon: 'heroDocumentText', route: '/reporte' },
      ],
    },
  ];

  sections = computed(() => {
    const user = this.authService.currentUser();
    const roleId = user?.role_id ?? 99;
    return this.allSections
      .map((s) => ({
        ...s,
        items: s.items.filter((i) => !i.minRole || roleId <= i.minRole),
      }))
      .filter((s) => s.items.length > 0);
  });

  // Alerts
  alertCount = computed(() => this.alarmService.activeCount());
  alertLabel = computed(() => {
    const c = this.alertCount();
    return c === 0 ? 'Sin alertas' : `${c} Alerta${c > 1 ? 's' : ''}`;
  });

  // Theme
  themeIcon = computed(() => {
    const pref = this.themeService.preference();
    if (pref === 'dark') return 'heroMoon';
    if (pref === 'system') return 'heroComputerDesktop';
    return 'heroSun';
  });

  themeLabel = computed(() => {
    const pref = this.themeService.preference();
    if (pref === 'dark') return 'Oscuro';
    if (pref === 'system') return 'Sistema';
    return 'Claro';
  });

  toggleTheme() {
    this.themeService.toggle();
  }

  // User
  userName = computed(() => {
    const u = this.authService.currentUser();
    return u?.full_name ?? '';
  });

  userInitials = computed(() => {
    const u = this.authService.currentUser();
    if (!u?.full_name) return '?';
    const parts = u.full_name.split(' ');
    const f = parts[0]?.[0] ?? '';
    const l = parts[1]?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  });

  userRole = computed(() => {
    const map: Record<number, string> = {
      1: 'Administrador',
      2: 'Supervisor',
      3: 'Operador',
      4: 'Consulta',
    };
    return map[this.authService.currentUser()?.role_id ?? 0] ?? '';
  });

  isActive(item: NavItem): boolean {
    const url = this.router.url;
    if (item.exact) return url === item.route;
    return url.startsWith(item.route);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
