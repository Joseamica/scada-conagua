import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Obtenemos el rol requerido desde la configuración de la ruta
  const expectedRole = route.data['expectedRole'] as number;
  
  // Obtenemos el usuario actual del Signal
  const user = authService.currentUser();

  // Jerárquico: role_id <= expectedRole (roles menores tienen más permisos)
  // 1=Admin, 2=Supervisor, 3=Operador, 4=Ejecutivo
  if (user && user.role_id <= expectedRole) {
    return true;
  }

  console.warn(`>>> [RoleGuard] Acceso denegado. Usuario tiene rol ${user?.role_id}, se requiere <= ${expectedRole}`);
  router.navigate(['/dashboard']);
  return false;
};