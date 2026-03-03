import { Component, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'login-reset-pass',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-reset-pass.html',
  styleUrl: './login-reset-pass.css',
})

export class LoginResetPass implements OnInit {
  targetUserId: number = 0;
  tempPassword = signal<string>('');
  loading = signal<boolean>(false);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService
  ) {}

  ngOnInit() {
    // Obtenemos el ID del usuario al que le resetearemos el pass
    // Puede venir por parámetros de ruta o por state
    const state = this.router.getCurrentNavigation()?.extras.state;
    this.targetUserId = state?.['userId'] || 0;

    this.generateSecurePassword();
  }

  generateSecurePassword() {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let retVal = "";
    for (let i = 0; i < 10; ++i) {
      retVal += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    this.tempPassword.set(retVal);
  }

  guardarPassword() {
    if (this.targetUserId === 0) return;

    this.loading.set(true);
    this.userService.adminResetPassword(this.targetUserId, this.tempPassword()).subscribe({
      next: () => {
        alert(`Contraseña actualizada. Nueva clave: ${this.tempPassword()}`);
        this.router.navigate(['/usuarios']);
      },
      error: (err) => {
        console.error('Error al resetear password:', err);
        this.loading.set(false);
      }
    });
  }
}
