//src/app/core/services/auth.service.ts

import { Router } from '@angular/router';
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthResponse, TotpSetupResponse, UserSession } from '../models/auth.models';
import { Observable, tap } from 'rxjs';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly URL = `${environment.apiQueryUrl}/auth`;
  
  // Usamos Signals para una gestión de estado moderna y reactiva
  currentUser = signal<UserSession | null>(null);

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService
  ) {
    this.loadSession(); // Cargamos la sesión al inicializar el servicio
  }

  login(email: string, password: string): Observable<AuthResponse> {
  return this.http.post<AuthResponse>(`${this.URL}/login`, { email, password }).pipe(
    tap(res => {
      if (res && !res.requires2FA && res.token) {
        this.saveSession(res.token, res.user!);
      }
    })
  );
}

  verify2FA(tempToken: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}/verify-2fa`, { tempToken, code }).pipe(
      tap(res => {
        if (res && res.token) {
          this.saveSession(res.token, res.user!);
        }
      })
    );
  }

  private saveSession(token: string, user: UserSession) {
    localStorage.setItem('scada_token', token);
    localStorage.setItem('scada_user_data', JSON.stringify(user));
    this.currentUser.set(user);
  }

  private loadSession() {
    const token = localStorage.getItem('scada_token');
    const userData = localStorage.getItem('scada_user_data');

    if (token && userData) {
      try {
        this.currentUser.set(JSON.parse(userData));
      } catch (e) {
        this.logout();
      }
    }
  }

  // Llama al backend para generar un nuevo correo de verificación 2FA
  resend2FA(tempToken: string): Observable<any> {
    return this.http.post(`${this.URL}/resend-2fa`, { tempToken });
  }

  // TOTP (Google Authenticator)
  verifyTOTP(tempToken: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}/verify-totp`, { tempToken, code }).pipe(
      tap(res => {
        if (res && res.token) {
          this.saveSession(res.token, res.user!);
        }
      })
    );
  }

  setupTOTP(): Observable<TotpSetupResponse> {
    return this.http.post<TotpSetupResponse>(`${this.URL}/2fa/setup`, {});
  }

  verifyTOTPSetup(code: string): Observable<any> {
    return this.http.post(`${this.URL}/2fa/verify-setup`, { code });
  }

  disableTOTP(code: string): Observable<any> {
    return this.http.post(`${this.URL}/2fa/disable`, { code });
  }

  verifyEmailToken(token: string): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.URL}/verify-email`, { params: { token } }).pipe(
      tap(res => {
        if (res && res.token) {
          this.saveSession(res.token, res.user!);
        }
      })
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.URL}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.URL}/reset-password`, { token, password });
  }

  logout() {
  const userData = localStorage.getItem('scada_user_data');
  const user = userData ? JSON.parse(userData) : null;

  if (user && user.id) {
    this.userService.update(user.id, { is_active: false }).subscribe({
      next: () => this.procederConLimpiezaLocal(),
      error: () => this.procederConLimpiezaLocal()
    });
  } else {
    this.procederConLimpiezaLocal();
  }
}

// Encapsulamos tu lógica original para llamarla tras la respuesta de OCI
private procederConLimpiezaLocal() {
  // 3. Borrado explícito
  localStorage.removeItem('scada_token');
  localStorage.removeItem('scada_user_data');

  // 4. Reset del estado reactivo
  this.currentUser.set(null);

  // 5. Navegación final y recarga
  this.router.navigate(['/login']).then(() => {
    window.location.reload(); 
  });
}
}