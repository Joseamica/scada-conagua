import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { OtpInput } from '../../shared/otp-input/otp-input';

@Component({
  selector: 'setup-totp',
  standalone: true,
  imports: [CommonModule, OtpInput],
  templateUrl: './setup-totp.html',
  styleUrl: './setup-totp.css',
})
export class SetupTotp implements OnInit {
  @ViewChild(OtpInput) otpInput!: OtpInput;

  qrCode = '';
  totpSecret = '';
  errorMsg = '';
  secretCopied = false;
  isVerifying = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.setupTOTP().subscribe({
      next: (res) => {
        this.qrCode = res.qrCode;
        this.totpSecret = res.secret;
      },
      error: (err) => {
        this.errorMsg = err.error?.error || 'Error al generar codigo QR';
      },
    });
  }

  onCodeCompleted(code: string) {
    this.verifyCode(code);
  }

  verifyCode(code: string) {
    if (this.isVerifying) return;
    this.isVerifying = true;
    this.errorMsg = '';

    this.authService.verifyTOTPSetup(code).subscribe({
      next: () => {
        // Update local user data with totp_enabled = true
        const userData = localStorage.getItem('scada_user_data');
        if (userData) {
          const user = JSON.parse(userData);
          user.totp_enabled = true;
          localStorage.setItem('scada_user_data', JSON.stringify(user));
          this.authService.currentUser.set(user);
        }
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isVerifying = false;
        this.errorMsg = err.error?.error || 'Codigo invalido. Intenta de nuevo.';
        this.otpInput?.reset();
      },
    });
  }

  copySecret() {
    navigator.clipboard.writeText(this.totpSecret);
    this.secretCopied = true;
    setTimeout(() => (this.secretCopied = false), 2000);
  }

  logout() {
    this.authService.logout();
  }
}
