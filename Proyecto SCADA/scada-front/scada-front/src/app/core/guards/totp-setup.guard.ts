import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const totpSetupGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();

  // If 2FA is required but TOTP not yet configured, force setup
  if (user && user.is_2fa_enabled && !user.totp_enabled) {
    router.navigate(['/auth/setup-totp']);
    return false;
  }

  return true;
};
