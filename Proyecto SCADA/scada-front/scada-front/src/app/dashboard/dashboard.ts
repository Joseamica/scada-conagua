import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';

import { HeaderBarComponent } from '../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../layout/footer-tabs/footer-tabs';
import { AuthService } from '../core/services/auth.service';

import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroPresentationChartBar,
  heroMapPin,
  heroBellAlert,
  heroMap,
  heroUser,
  heroDocumentText,
} from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  imports: [
    CommonModule,
    RouterModule,
    NgIconComponent,
    HeaderBarComponent,
    FooterTabsComponent
  ],
  providers: [
    provideIcons({
      heroPresentationChartBar,
      heroMapPin,
      heroBellAlert,
      heroMap,
      heroUser,
      heroDocumentText
    })
  ]
})
export class DashboardComponent {

  private authService = inject(AuthService);

  isAdmin = computed(() => {
    const user = this.authService.currentUser();
    return user?.role_id === 1;
  });

  constructor(private router: Router) {}

  go(ruta: string) {
    this.router.navigate([`/dashboard/${ruta}`]);
  }
}
