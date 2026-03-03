import { Component, ElementRef, HostListener, computed } from '@angular/core';
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
import { ThemeService } from '../../core/services/theme.service';
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
export class HeaderBarComponent {

  // ======================
  // ESTADOS
  // ======================
  pageTitle: string = '';

  menuOpen = false;
  alertsOpen = false;
  inboxOpen = false;

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
    private elementRef: ElementRef,
    public headerTitleService: HeaderTitleService,
    private themeService: ThemeService
  ) {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.pageTitle = this.getRouteTitle(this.router.routerState.root);
      });
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

  logout() {
    this.authService.logout();
  }
}
