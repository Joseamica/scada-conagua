import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  
  // Verificamos si existe el pasaporte en el local storage
  const token = localStorage.getItem('scada_token');

  if (token) {
    // Si hay token, permitimos el acceso
    return true;
  } else {
    // Si no hay token, lo mandamos directo al login
    console.warn('>>> [AuthGuard] Acceso denegado: No se encontró scada_token. Redirigiendo...');
    router.navigate(['/login']);
    return false;
  }
};