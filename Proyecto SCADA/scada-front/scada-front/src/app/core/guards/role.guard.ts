import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const expectedRole = route.data['expectedRole'] as number;

  // Try signal first, then fallback to JWT decode
  let roleId = authService.currentUser()?.role_id;

  if (roleId == null) {
    const token = localStorage.getItem('scada_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        roleId = payload.role_id;
      } catch {
        // invalid token
      }
    }
  }

  // Hierarchical: role_id <= expectedRole (lower = more permissions)
  // 1=Admin, 2=Supervisor, 3=Operador, 4=Tecnico
  if (roleId != null && roleId <= expectedRole) {
    return true;
  }

  console.warn(
    `>>> [RoleGuard] Acceso denegado. Usuario tiene rol ${roleId}, se requiere <= ${expectedRole}`,
  );
  router.navigate(['/dashboard']);
  return false;
};
