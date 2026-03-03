import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'verify-email',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.css',
})
export class VerifyEmail implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  errorMsg = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.status = 'error';
      this.errorMsg = 'Enlace de verificacion invalido.';
      return;
    }

    this.authService.verifyEmailToken(token).subscribe({
      next: (res) => {
        this.status = 'success';
        // Check if TOTP setup is needed
        if (res.user && res.user.is_2fa_enabled && !res.user.totp_enabled) {
          setTimeout(() => this.router.navigate(['/auth/setup-totp']), 1500);
        } else {
          setTimeout(() => this.router.navigate(['/dashboard']), 1500);
        }
      },
      error: (err) => {
        this.status = 'error';
        this.errorMsg = err.error?.error || 'El enlace ha expirado o ya fue utilizado.';
      },
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
}
