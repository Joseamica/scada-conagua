import '../../../test-init';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

const { mockIsTokenExpired, mockNavigate } = vi.hoisted(() => ({
  mockIsTokenExpired: vi.fn(),
  mockNavigate: vi.fn(),
}));

let injectCallCount = 0;

vi.mock('@angular/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/core')>();
  return {
    ...actual,
    inject: vi.fn().mockImplementation(() => {
      injectCallCount++;
      // guestGuard calls inject(Router) first, then inject(AuthService)
      if (injectCallCount % 2 === 1) {
        return { navigate: mockNavigate };
      }
      return { isTokenExpired: mockIsTokenExpired };
    }),
  };
});

import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  beforeEach(() => {
    mockIsTokenExpired.mockReset();
    mockNavigate.mockReset();
    injectCallCount = 0;
  });

  it('allows access when token is expired (user is a guest)', () => {
    mockIsTokenExpired.mockReturnValue(true);
    expect(guestGuard(route, state)).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('allows access when no token exists', () => {
    mockIsTokenExpired.mockReturnValue(true);
    expect(guestGuard(route, state)).toBe(true);
  });

  it('blocks access and redirects to /dashboard when token is valid', () => {
    mockIsTokenExpired.mockReturnValue(false);
    expect(guestGuard(route, state)).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
