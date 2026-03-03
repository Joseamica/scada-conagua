import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroEnvelope, heroArrowLeft, heroCheckCircle } from '@ng-icons/heroicons/outline';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
  imports: [CommonModule, FormsModule, RouterLink, NgIconComponent],
  providers: [
    provideIcons({ heroEnvelope, heroArrowLeft, heroCheckCircle }),
  ],
})
export class ForgotPassword {
  email = '';
  isLoading = false;
  sent = false;
  errorMsg = '';

  constructor(private authService: AuthService) {}

  onSubmit() {
    this.email = this.email.trim().toLowerCase();
    if (!this.email) return;

    this.isLoading = true;
    this.errorMsg = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.sent = true;
      },
      error: () => {
        // Even on network error, show the same "sent" message
        // so we never reveal if the email exists
        this.isLoading = false;
        this.sent = true;
      },
    });
  }
}
