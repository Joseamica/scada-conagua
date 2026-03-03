import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'token',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './token.html',
  styleUrl: './token.css',
})

export class Token implements OnInit {
  tokenValue: string = '';
  errorMsg: string = '';
  method: 'totp' | 'email' = 'email';

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.method = (sessionStorage.getItem('2fa_method') as 'totp' | 'email') || 'email';
  }

  verificarToken() {
    if (this.tokenValue.length < 6) {
      this.errorMsg = 'El codigo debe ser de 6 digitos.';
      return;
    }

    if (this.method === 'totp') {
      this.verificarTOTP();
    } else {
      this.verificarEmail();
    }
  }

  private verificarTOTP() {
    const tempToken = sessionStorage.getItem('2fa_temp_token');

    if (!tempToken) {
      this.errorMsg = 'Sesion expirada. Inicia sesion de nuevo.';
      return;
    }

    this.authService.verifyTOTP(tempToken, this.tokenValue).subscribe({
      next: () => {
        this.limpiarSession();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Codigo TOTP invalido o expirado';
      }
    });
  }

  private verificarEmail() {
    const email = sessionStorage.getItem('pending_email');

    if (!email) {
      this.errorMsg = 'Sesion expirada. Inicia sesion de nuevo.';
      return;
    }

    this.authService.verify2FA(email, this.tokenValue).subscribe({
      next: () => {
        this.limpiarSession();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Codigo invalido o expirado';
      }
    });
  }

  reenviarToken() {
    const email = sessionStorage.getItem('pending_email');

    if (!email) {
      this.errorMsg = 'Sesion invalida. Regresa al login.';
      return;
    }

    this.authService.resend2FA(email).subscribe({
      next: () => {
        this.errorMsg = 'Nuevo codigo enviado con exito.';
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'No se pudo reenviar el codigo.';
      }
    });
  }

  private limpiarSession() {
    sessionStorage.removeItem('pending_email');
    sessionStorage.removeItem('2fa_method');
    sessionStorage.removeItem('2fa_temp_token');
  }
}
