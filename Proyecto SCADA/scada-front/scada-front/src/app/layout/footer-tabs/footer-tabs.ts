import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroHome,
  heroChartBarSquare,
  heroMapPin,
  heroBriefcase,
  heroBellAlert,
  heroUsers
} from '@ng-icons/heroicons/outline';
import { AuthService } from '../../core/services/auth.service';

interface NavTab {
  label: string;
  icon: string;
  route: string;
  exact: boolean;
  minRole?: number; // role_id <= minRole to see this tab
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
      heroBriefcase,
      heroBellAlert,
      heroUsers
    })
  ]
})
export class FooterTabsComponent {

  private authService = inject(AuthService);

  private allTabs: NavTab[] = [
    { label: 'Inicio',       icon: 'heroHome',           route: '/dashboard',  exact: true  },
    { label: 'Telemetria',   icon: 'heroChartBarSquare',  route: '/telemetria', exact: false },
    { label: 'Mapa SIG',     icon: 'heroMapPin',          route: '/modulo-gis', exact: false },
    { label: 'Proyectos',    icon: 'heroBriefcase',       route: '/gerencia/overview-gastos', exact: false },
    { label: 'Alarmas',      icon: 'heroBellAlert',       route: '/dashboard/alarmas',        exact: false },
    { label: 'Usuarios',     icon: 'heroUsers',           route: '/usuarios',   exact: false, minRole: 1 }
  ];

  tabs = computed(() => {
    const user = this.authService.currentUser();
    const roleId = user?.role_id ?? 99;
    return this.allTabs.filter(tab => !tab.minRole || roleId <= tab.minRole);
  });

  constructor(private router: Router) {}

  isActive(tab: NavTab): boolean {
    const url = this.router.url;
    if (tab.exact) return url === tab.route;
    return url.startsWith(tab.route);
  }
}
