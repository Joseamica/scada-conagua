import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderBarComponent } from '../../../layout/header-bar/header-bar';
import { FooterTabsComponent } from '../../../layout/footer-tabs/footer-tabs';
import { AuthService } from '../../../core/services/auth.service';
import { ROLE_MAP } from '../../../core/constants/roles';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroUser,
  heroEnvelope,
  heroShieldCheck,
  heroKey,
  heroDevicePhoneMobile,
  heroLockClosed,
  heroLockOpen,
  heroClipboardDocument,
  heroExclamationTriangle,
  heroCheckCircle,
  heroXMark,
  heroIdentification,
  heroBuildingOffice2,
  heroQrCode
} from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-perfil-usuario',
  templateUrl: './perfil-usuario.html',
  styleUrls: ['./perfil-usuario.css'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HeaderBarComponent,
    FooterTabsComponent,
    NgIconComponent
  ],
  providers: [
    provideIcons({
      heroUser,
      heroEnvelope,
      heroShieldCheck,
      heroKey,
      heroDevicePhoneMobile,
      heroLockClosed,
      heroLockOpen,
      heroClipboardDocument,
      heroExclamationTriangle,
      heroCheckCircle,
      heroXMark,
      heroIdentification,
      heroBuildingOffice2,
      heroQrCode
    })
  ]
})
export class PerfilUsuario implements OnInit {

  user = {
    nombre: '',
    email: '',
    rol: '',
    rolId: 0,
    nivel: ''
  };

  userInitials = signal('');

  // TOTP state
  totpEnabled = false;
  showTotpSetup = false;
  qrCode = '';
  totpSecret = '';
  verifyCode = '';
  disableCode = '';
  totpMsg = '';
  totpError = '';
  showDisableForm = false;
  secretCopied = false;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const userData = localStorage.getItem('scada_user_data');
    if (userData) {
      const parsed = JSON.parse(userData);
      this.user.nombre = parsed.full_name || '';
      this.user.email = parsed.email || '';
      this.user.rolId = parsed.role_id || 0;
      this.user.rol = this.getRoleName(parsed.role_id);
      this.user.nivel = parsed.scope || '';
      this.totpEnabled = !!parsed.totp_enabled;
      this.userInitials.set(this.getInitials(this.user.nombre));
    }
  }

  private getRoleName(roleId: number): string {
    return ROLE_MAP[roleId] || 'Sin rol';
  }

  getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  goToChangePassword() {
    this.router.navigate(['/auth/login/reset-pass']);
  }

  copySecret() {
    navigator.clipboard.writeText(this.totpSecret).then(() => {
      this.secretCopied = true;
      setTimeout(() => this.secretCopied = false, 2000);
    });
  }

  // ── TOTP Setup Flow ──

  startTotpSetup() {
    this.totpError = '';
    this.totpMsg = '';
    this.authService.setupTOTP().subscribe({
      next: (res) => {
        this.qrCode = res.qrCode;
        this.totpSecret = res.secret;
        this.showTotpSetup = true;
      },
      error: (err) => {
        this.totpError = err.error?.error || 'Error al generar QR';
      }
    });
  }

  confirmTotpSetup() {
    if (this.verifyCode.length < 6) {
      this.totpError = 'Ingresa el codigo de 6 digitos';
      return;
    }

    this.totpError = '';
    this.authService.verifyTOTPSetup(this.verifyCode).subscribe({
      next: () => {
        this.totpEnabled = true;
        this.showTotpSetup = false;
        this.totpMsg = 'Google Authenticator activado correctamente.';
        this.verifyCode = '';
        this.updateStoredTotpStatus(true);
      },
      error: (err) => {
        this.totpError = err.error?.error || 'Codigo invalido. Intenta de nuevo.';
      }
    });
  }

  cancelTotpSetup() {
    this.showTotpSetup = false;
    this.qrCode = '';
    this.totpSecret = '';
    this.verifyCode = '';
    this.totpError = '';
  }

  private updateStoredTotpStatus(enabled: boolean) {
    const raw = localStorage.getItem('scada_user_data');
    if (raw) {
      const data = JSON.parse(raw);
      data.totp_enabled = enabled;
      localStorage.setItem('scada_user_data', JSON.stringify(data));
    }
  }

  confirmDisableTotp() {
    if (this.disableCode.length < 6) {
      this.totpError = 'Ingresa el codigo actual de 6 digitos';
      return;
    }

    this.totpError = '';
    this.authService.disableTOTP(this.disableCode).subscribe({
      next: () => {
        this.totpEnabled = false;
        this.showDisableForm = false;
        this.totpMsg = 'Google Authenticator desactivado.';
        this.disableCode = '';
        this.updateStoredTotpStatus(false);
      },
      error: (err) => {
        this.totpError = err.error?.error || 'Codigo invalido.';
      }
    });
  }
}
