import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Guard inverso: si el usuario ya tiene sesión válida, redirige a /dashboard */
export const guestGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (authService.isTokenExpired()) {
    return true; // Token ausente/expirado → puede ver login
  }

  // Ya autenticado → redirigir al dashboard
  router.navigate(['/dashboard']);
  return false;
};
