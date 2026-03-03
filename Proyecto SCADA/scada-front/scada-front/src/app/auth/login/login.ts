import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroEnvelope,
  heroLockClosed,
  heroEye,
  heroEyeSlash,
  heroArrowRightOnRectangle
} from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrl: './login.css',
  imports: [CommonModule, FormsModule, RouterLink, NgIconComponent],
  providers: [
    provideIcons({
      heroEnvelope,
      heroLockClosed,
      heroEye,
      heroEyeSlash,
      heroArrowRightOnRectangle
    })
  ]
})
export class Login {

  username = '';
  password = '';
  errorMsg = '';
  isLoading = false;
  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    this.username = this.username.trim().toLowerCase();
    if (!this.username || !this.password) return;

    this.isLoading = true;
    this.errorMsg = '';

    this.authService.login(this.username, this.password).subscribe({
      next: (res) => {
        if (res.requires2FA) {
          sessionStorage.setItem('pending_email', this.username);
          sessionStorage.setItem('2fa_method', res.method || 'email');
          if (res.tempToken) {
            sessionStorage.setItem('2fa_temp_token', res.tempToken);
          }
          this.router.navigate(['/auth/login/token']);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.error || 'Error de autenticacion';
      }
    });
  }
}
