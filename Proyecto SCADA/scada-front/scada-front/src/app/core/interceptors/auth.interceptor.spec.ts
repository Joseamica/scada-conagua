import { HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';

const { mockClearSessionAndRedirect } = vi.hoisted(() => ({
  mockClearSessionAndRedirect: vi.fn(),
}));

vi.mock('@angular/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/core')>();
  return {
    ...actual,
    inject: vi.fn().mockReturnValue({
      clearSessionAndRedirect: mockClearSessionAndRedirect,
    }),
  };
});

import { authInterceptor } from './auth.interceptor';

/** Creates a fake JWT with a given exp timestamp (seconds) */
function fakeJwt(exp: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 1, exp }));
  return `${header}.${payload}.fakesig`;
}

describe('authInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();
    mockClearSessionAndRedirect.mockClear();
  });

  afterEach(() => localStorage.clear());

  it('adds Authorization header when token exists', () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const token = fakeJwt(futureExp);
    localStorage.setItem('scada_token', token);

    const req = new HttpRequest('GET', '/api/sites');
    let clonedReq: HttpRequest<unknown> | undefined;

    const next: HttpHandlerFn = (r) => {
      clonedReq = r;
      return of({} as HttpEvent<unknown>);
    };

    authInterceptor(req, next).subscribe();

    expect(clonedReq!.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('does not add Authorization header when no token', () => {
    const req = new HttpRequest('GET', '/api/sites');
    let clonedReq: HttpRequest<unknown> | undefined;

    const next: HttpHandlerFn = (r) => {
      clonedReq = r;
      return of({} as HttpEvent<unknown>);
    };

    authInterceptor(req, next).subscribe();

    expect(clonedReq!.headers.has('Authorization')).toBe(false);
  });

  it('calls clearSessionAndRedirect on 401 for non-auth API routes', () => {
    const req = new HttpRequest('GET', '/api/sites');
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 401, url: '/api/sites' }));

    authInterceptor(req, next).subscribe({ error: () => {} });

    expect(mockClearSessionAndRedirect).toHaveBeenCalled();
  });

  it('calls clearSessionAndRedirect on 403 for non-auth API routes', () => {
    const req = new HttpRequest('GET', '/api/telemetry');
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 403, url: '/api/telemetry' }));

    authInterceptor(req, next).subscribe({ error: () => {} });

    expect(mockClearSessionAndRedirect).toHaveBeenCalled();
  });

  it('does NOT redirect on 401 for /auth/ routes (avoids login loop)', () => {
    const req = new HttpRequest('POST', '/api/auth/login', {});
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 401, url: '/api/auth/login' }));

    authInterceptor(req, next).subscribe({ error: () => {} });

    expect(mockClearSessionAndRedirect).not.toHaveBeenCalled();
  });

  it('does NOT redirect on 404 errors', () => {
    const req = new HttpRequest('GET', '/api/sites/999');
    const next: HttpHandlerFn = () =>
      throwError(() => new HttpErrorResponse({ status: 404, url: '/api/sites/999' }));

    authInterceptor(req, next).subscribe({ error: () => {} });

    expect(mockClearSessionAndRedirect).not.toHaveBeenCalled();
  });

  it('re-throws the error after handling', () => {
    const req = new HttpRequest('GET', '/api/sites');
    const originalError = new HttpErrorResponse({ status: 401, url: '/api/sites' });
    const next: HttpHandlerFn = () => throwError(() => originalError);

    let caughtError: HttpErrorResponse | undefined;
    authInterceptor(req, next).subscribe({
      error: (e) => (caughtError = e),
    });

    expect(caughtError).toBe(originalError);
  });
});
