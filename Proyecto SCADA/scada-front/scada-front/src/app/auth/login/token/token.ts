import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { OtpInput } from '../../../shared/otp-input/otp-input';

@Component({
  selector: 'token',
  standalone: true,
  imports: [CommonModule, OtpInput],
  templateUrl: './token.html',
  styleUrl: './token.css',
})
export class Token implements OnInit {
  @ViewChild(OtpInput) otpInput!: OtpInput;

  errorMsg: string = '';
  method: 'totp' | 'email' = 'email';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.method = (sessionStorage.getItem('2fa_method') as 'totp' | 'email') || 'email';
  }

  onCodeCompleted(code: string) {
    if (this.method === 'totp') {
      this.verificarTOTP(code);
    } else {
      this.verificarEmail(code);
    }
  }

  private verificarTOTP(code: string) {
    const tempToken = sessionStorage.getItem('2fa_temp_token');

    if (!tempToken) {
      this.errorMsg = 'Sesion expirada. Inicia sesion de nuevo.';
      return;
    }

    this.authService.verifyTOTP(tempToken, code).subscribe({
      next: () => {
        const returnUrl = this.getReturnUrl();
        this.limpiarSession();
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Codigo TOTP invalido o expirado';
        this.otpInput?.reset();
      },
    });
  }

  private verificarEmail(code: string) {
    const tempToken = sessionStorage.getItem('2fa_temp_token');

    if (!tempToken) {
      this.errorMsg = 'Sesion expirada. Inicia sesion de nuevo.';
      return;
    }

    this.authService.verify2FA(tempToken, code).subscribe({
      next: (res) => {
        const returnUrl = this.getReturnUrl();
        this.limpiarSession();
        // Check if TOTP setup is needed
        if (res.user && res.user.is_2fa_enabled && !res.user.totp_enabled) {
          this.router.navigate(['/auth/setup-totp']);
        } else {
          this.router.navigateByUrl(returnUrl);
        }
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Codigo invalido o expirado';
        this.otpInput?.reset();
      },
    });
  }

  reenviarToken() {
    const tempToken = sessionStorage.getItem('2fa_temp_token');

    if (!tempToken) {
      this.errorMsg = 'Sesion expirada. Inicia sesion de nuevo.';
      return;
    }

    this.authService.resend2FA(tempToken).subscribe({
      next: () => {
        this.errorMsg = 'Nuevo codigo enviado con exito.';
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'No se pudo reenviar el codigo.';
      },
    });
  }

  private limpiarSession() {
    sessionStorage.removeItem('pending_email');
    sessionStorage.removeItem('2fa_method');
    sessionStorage.removeItem('2fa_temp_token');
    sessionStorage.removeItem('returnUrl');
  }

  private getReturnUrl(): string {
    return sessionStorage.getItem('returnUrl') || '/dashboard';
  }
}
