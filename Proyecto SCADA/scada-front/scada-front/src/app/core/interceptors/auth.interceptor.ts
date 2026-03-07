import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('scada_token');

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        (error.status === 401 || error.status === 403) &&
        !req.url.includes('/auth/')
      ) {
        const authService = inject(AuthService);
        authService.clearSessionAndRedirect();
      }
      return throwError(() => error);
    })
  );
};
