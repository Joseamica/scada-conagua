import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

const { mockIsTokenExpired, mockClearSessionAndRedirect } = vi.hoisted(() => ({
  mockIsTokenExpired: vi.fn(),
  mockClearSessionAndRedirect: vi.fn(),
}));

vi.mock('@angular/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/core')>();
  return {
    ...actual,
    inject: vi.fn().mockReturnValue({
      isTokenExpired: mockIsTokenExpired,
      clearSessionAndRedirect: mockClearSessionAndRedirect,
    }),
  };
});

import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  beforeEach(() => {
    mockIsTokenExpired.mockReset();
    mockClearSessionAndRedirect.mockReset();
  });

  it('allows access when token is valid (not expired)', () => {
    mockIsTokenExpired.mockReturnValue(false);
    expect(authGuard(route, state)).toBe(true);
    expect(mockClearSessionAndRedirect).not.toHaveBeenCalled();
  });

  it('blocks access and redirects when token is expired', () => {
    mockIsTokenExpired.mockReturnValue(true);
    expect(authGuard(route, state)).toBe(false);
    expect(mockClearSessionAndRedirect).toHaveBeenCalled();
  });

  it('blocks access when no token exists', () => {
    mockIsTokenExpired.mockReturnValue(true);
    expect(authGuard(route, state)).toBe(false);
    expect(mockClearSessionAndRedirect).toHaveBeenCalled();
  });
});
