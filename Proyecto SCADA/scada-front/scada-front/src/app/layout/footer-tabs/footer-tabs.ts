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
  heroEllipsisHorizontal,
  heroBriefcase,
  heroVariable,
  heroCog6Tooth,
  heroClock,
  heroEnvelope,
  heroUsers,
  heroDocumentText,
  heroUserCircle,
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../core/services/auth.service';

interface NavTab {
  label: string;
  icon: string;
  route: string;
  exact: boolean;
  minRole?: number;
}

interface MoreItem {
  label: string;
  icon: string;
  route: string;
  description: string;
  minRole?: number;
}

@Component({
  selector: 'app-footer-tabs',
  standalone: true,
  templateUrl: './footer-tabs.html',
  styleUrl: './footer-tabs.css',
  imports: [CommonModule, NgIconComponent, RouterLink],
  providers: [
    provideIcons({
      heroHome,
      heroChartBarSquare,
      heroMapPin,
      heroBellAlert,
      heroRectangleGroup,
      heroEllipsisHorizontal,
      heroBriefcase,
      heroVariable,
      heroCog6Tooth,
      heroClock,
      heroEnvelope,
      heroUsers,
      heroDocumentText,
      heroUserCircle,
    }),
  ],
})
export class FooterTabsComponent {
  private authService = inject(AuthService);

  showMore = signal(false);

  private mainTabs: NavTab[] = [
    { label: 'Inicio', icon: 'heroHome', route: '/dashboard', exact: true },
    { label: 'Telemetria', icon: 'heroChartBarSquare', route: '/telemetria', exact: false },
    { label: 'Mapa SIG', icon: 'heroMapPin', route: '/modulo-gis', exact: false },
    { label: 'Sinopticos', icon: 'heroRectangleGroup', route: '/sinopticos', exact: false },
    { label: 'Alarmas', icon: 'heroBellAlert', route: '/alarmas', exact: false },
  ];

  private allMoreItems: MoreItem[] = [
    {
      label: 'Proyectos',
      icon: 'heroBriefcase',
      route: '/gerencia/overview-gastos',
      description: 'Overview de gastos',
    },
    {
      label: 'Variables',
      icon: 'heroVariable',
      route: '/variables',
      description: 'Explorador de vistas',
    },
    {
      label: 'Config. Alarmas',
      icon: 'heroCog6Tooth',
      route: '/alarmas/configuracion',
      description: 'Grupos y definiciones',
    },
    {
      label: 'Historial',
      icon: 'heroClock',
      route: '/alarmas/historial',
      description: 'Historial de alarmas',
    },
    {
      label: 'Destinatarios',
      icon: 'heroEnvelope',
      route: '/alarmas/destinatarios',
      description: 'Contactos y colecciones',
    },
    {
      label: 'Usuarios',
      icon: 'heroUsers',
      route: '/usuarios',
      description: 'Gestion de usuarios',
      minRole: 1,
    },
    {
      label: 'Bitacora',
      icon: 'heroDocumentText',
      route: '/reporte',
      description: 'Registro de actividad',
    },
    {
      label: 'Perfil',
      icon: 'heroUserCircle',
      route: '/perfil',
      description: 'Mi cuenta',
    },
  ];

  tabs = computed(() => this.mainTabs);

  moreItems = computed(() => {
    const user = this.authService.currentUser();
    const roleId = user?.role_id ?? 99;
    return this.allMoreItems.filter((item) => !item.minRole || roleId <= item.minRole);
  });

  constructor(private router: Router) {}

  isActive(tab: NavTab): boolean {
    const url = this.router.url;
    if (tab.exact) return url === tab.route;
    return url.startsWith(tab.route);
  }

  isMoreActive(): boolean {
    const url = this.router.url;
    return this.allMoreItems.some((item) => url.startsWith(item.route));
  }

  toggleMore(): void {
    this.showMore.update((v) => !v);
  }

  navigateTo(route: string): void {
    this.showMore.set(false);
    this.router.navigate([route]);
  }

  closeMore(): void {
    this.showMore.set(false);
  }
}
