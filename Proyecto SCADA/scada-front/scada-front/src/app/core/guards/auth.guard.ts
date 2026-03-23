import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);

  if (!authService.isTokenExpired()) {
    return true;
  }

  // Token ausente o expirado — limpiar y redirigir, preservando returnUrl
  authService.clearSessionAndRedirect(state.url);
  return false;
};
