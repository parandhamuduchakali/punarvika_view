import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { TokenResponse, UserRole } from '../models/api.models';
import { AuthService } from '../services/auth.service';
import { adminGuard, authGuard, guestGuard } from './auth.guard';

function session(role: UserRole): TokenResponse {
  return {
    access_token: 'token',
    token_type: 'bearer',
    expires_in: 900,
    user: {
      id: 1,
      email: role === 'ADMIN' ? 'admin@example.com' : 'customer@example.com',
      full_name: 'Test',
      phone: null,
      role,
      is_active: true,
      email_verified: true,
    },
  };
}

describe('route guards', () => {
  let auth: AuthService;
  let router: Router;

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/orders' } as RouterStateSnapshot;

  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard(route, state));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('lets a signed-in customer through', () => {
      auth.applySession(session('CUSTOMER'));

      expect(run(authGuard)).toBe(true);
    });

    it('redirects a visitor to sign in, keeping where they were going', () => {
      const result = run(authGuard);

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Forders');
    });
  });

  describe('adminGuard', () => {
    it('lets an administrator through', () => {
      auth.applySession(session('ADMIN'));

      expect(run(adminGuard)).toBe(true);
    });

    it('refuses a signed-in customer', () => {
      auth.applySession(session('CUSTOMER'));

      const result = run(adminGuard);

      expect(result).toBeInstanceOf(UrlTree);
      // Sent somewhere useful rather than shown a page they cannot use.
      expect(router.serializeUrl(result as UrlTree)).toBe('/');
    });

    it('sends a visitor to sign in rather than to the home page', () => {
      const result = run(adminGuard);

      expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Forders');
    });

    it('stops granting access the moment the session is cleared', () => {
      auth.applySession(session('ADMIN'));
      expect(run(adminGuard)).toBe(true);

      auth.clearSession();

      expect(run(adminGuard)).toBeInstanceOf(UrlTree);
    });
  });

  describe('guestGuard', () => {
    it('lets a visitor see the sign-in page', () => {
      expect(run(guestGuard)).toBe(true);
    });

    it('sends a signed-in customer away from it', () => {
      auth.applySession(session('CUSTOMER'));

      expect(run(guestGuard)).toBeInstanceOf(UrlTree);
    });
  });
});
