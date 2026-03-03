import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroLockClosed,
  heroEye,
  heroEyeSlash,
  heroCheckCircle,
  heroArrowLeft,
  heroExclamationTriangle,
} from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
  imports: [CommonModule, FormsModule, RouterLink, NgIconComponent],
  providers: [
    provideIcons({
      heroLockClosed,
      heroEye,
      heroEyeSlash,
      heroCheckCircle,
      heroArrowLeft,
      heroExclamationTriangle,
    }),
  ],
})
export class ResetPassword implements OnInit {
  token = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirm = false;
  isLoading = false;
  errorMsg = '';
  success = false;
  invalidToken = false;

  // Password strength indicators
  hasMinLength = false;
  hasUppercase = false;
  hasLowercase = false;
  hasNumber = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token || this.token.length !== 64) {
      this.invalidToken = true;
    }
  }

  onPasswordInput() {
    this.hasMinLength = this.password.length >= 8;
    this.hasUppercase = /[A-Z]/.test(this.password);
    this.hasLowercase = /[a-z]/.test(this.password);
    this.hasNumber = /[0-9]/.test(this.password);
  }

  get passwordValid(): boolean {
    return this.hasMinLength && this.hasUppercase && this.hasLowercase && this.hasNumber;
  }

  get passwordsMatch(): boolean {
    return this.password === this.confirmPassword && this.confirmPassword.length > 0;
  }

  onSubmit() {
    if (!this.passwordValid || !this.passwordsMatch) return;

    this.isLoading = true;
    this.errorMsg = '';

    this.authService.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.isLoading = false;
        this.success = true;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMsg = err.error?.error || 'Error al restablecer la contrasena. El enlace puede haber expirado.';
      },
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
