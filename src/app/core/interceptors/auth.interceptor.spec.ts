import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { TokenResponse } from '../models/api.models';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const API = environment.apiBaseUrl;

function tokenResponse(accessToken: string): TokenResponse {
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 900,
    user: {
      id: 1,
      email: 'customer@example.com',
      full_name: 'Test Customer',
      phone: null,
      role: 'CUSTOMER',
      is_active: true,
      email_verified: true,
    },
  };
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  // ------------------------------------------------------ attaching a token
  it('attaches the access token to our own API', () => {
    auth.applySession(tokenResponse('token-abc'));

    http.get(`${API}/orders`).subscribe();

    const request = httpMock.expectOne(`${API}/orders`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-abc');
    expect(request.request.withCredentials).toBe(true);
    request.flush({});
  });

  it('never sends the token to a third-party origin', () => {
    // Sending it elsewhere would hand that origin the session outright.
    auth.applySession(tokenResponse('token-abc'));

    http.get('https://someone-else.example.com/track').subscribe();

    const request = httpMock.expectOne('https://someone-else.example.com/track');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.withCredentials).toBe(false);
    request.flush({});
  });

  it('sends no Authorization header when signed out', () => {
    http.get(`${API}/products`).subscribe();

    const request = httpMock.expectOne(`${API}/products`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  // ---------------------------------------------------- refresh and retry
  it('refreshes once on a 401 and retries the original request', () => {
    auth.applySession(tokenResponse('stale-token'));
    const results: unknown[] = [];

    http.get(`${API}/orders`).subscribe((value) => results.push(value));

    httpMock
      .expectOne(`${API}/orders`)
      .flush({ error: { code: 'TOKEN_EXPIRED' } }, { status: 401, statusText: 'Unauthorized' });

    // The interceptor asks for a new access token...
    httpMock.expectOne(`${API}/auth/refresh`).flush(tokenResponse('fresh-token'));

    // ...and replays the original request with it.
    const retried = httpMock.expectOne(`${API}/orders`);
    expect(retried.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retried.flush({ ok: true });

    expect(results).toEqual([{ ok: true }]);
    expect(auth.accessToken).toBe('fresh-token');
  });

  it('fires only ONE refresh for several simultaneous 401s', () => {
    /**
     * The backend rotates refresh tokens and treats a replayed one as theft. If
     * three parallel failures each triggered a refresh, two would present an
     * already-replaced token and the whole session would be revoked. This is the
     * single most important behaviour in this file.
     */
    auth.applySession(tokenResponse('stale-token'));
    const completed: string[] = [];

    http.get(`${API}/orders`).subscribe(() => completed.push('orders'));
    http.get(`${API}/cart`).subscribe(() => completed.push('cart'));
    http.get(`${API}/profile`).subscribe(() => completed.push('profile'));

    for (const url of [`${API}/orders`, `${API}/cart`, `${API}/profile`]) {
      httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    }

    // Exactly one refresh, not three.
    const refreshes = httpMock.match(`${API}/auth/refresh`);
    expect(refreshes.length).toBe(1);
    refreshes[0].flush(tokenResponse('fresh-token'));

    // All three are replayed with the new token.
    for (const url of [`${API}/orders`, `${API}/cart`, `${API}/profile`]) {
      const retried = httpMock.expectOne(url);
      expect(retried.request.headers.get('Authorization')).toBe('Bearer fresh-token');
      retried.flush({});
    }

    expect(completed.sort()).toEqual(['cart', 'orders', 'profile']);
  });

  it('clears the session and redirects when the refresh itself fails', () => {
    auth.applySession(tokenResponse('stale-token'));
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let failed = false;

    http.get(`${API}/orders`).subscribe({ error: () => (failed = true) });

    httpMock.expectOne(`${API}/orders`).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.anything());
  });

  it('fails every request queued behind a refresh that fails', () => {
    auth.applySession(tokenResponse('stale-token'));
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const failed: string[] = [];

    for (const url of [`${API}/orders`, `${API}/cart`]) {
      http.get(url).subscribe({ error: () => failed.push(url) });
    }
    for (const url of [`${API}/orders`, `${API}/cart`]) {
      httpMock.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    }
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(failed.sort()).toEqual([`${API}/cart`, `${API}/orders`]);
  });

  it('recovers after a failed refresh instead of deadlocking', () => {
    /**
     * `refreshInFlight` is module-level state. If a failed refresh left it set,
     * every later 401 would queue behind a refresh that never comes and the app
     * would wedge until reload.
     */
    auth.applySession(tokenResponse('stale-token'));
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(`${API}/orders`).subscribe({ error: () => undefined });
    httpMock.expectOne(`${API}/orders`).flush({}, { status: 401, statusText: 'Unauthorized' });
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    // A later request must still be able to trigger a fresh refresh.
    auth.applySession(tokenResponse('another-token'));
    http.get(`${API}/cart`).subscribe({ error: () => undefined });
    httpMock.expectOne(`${API}/cart`).flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectOne(`${API}/auth/refresh`).flush(tokenResponse('recovered-token'));
    httpMock.expectOne(`${API}/cart`).flush({});

    expect(auth.accessToken).toBe('recovered-token');
  });

  // ------------------------------------------------------------- exempt
  it('does not try to refresh a failed login', () => {
    // Retrying /auth/login through a refresh would loop.
    let failed = false;

    http.post(`${API}/auth/login`, {}).subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne(`${API}/auth/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${API}/auth/refresh`);
    expect(failed).toBe(true);
  });

  it('does not try to refresh a failed refresh', () => {
    let failed = false;

    http.post(`${API}/auth/refresh`, {}).subscribe({ error: () => (failed = true) });

    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock.verify();
    expect(failed).toBe(true);
  });

  it('leaves a non-401 failure alone', () => {
    auth.applySession(tokenResponse('token-abc'));
    let status = 0;

    http.get(`${API}/orders/999`).subscribe({
      error: (error: { status: number }) => (status = error.status),
    });

    httpMock
      .expectOne(`${API}/orders/999`)
      .flush({}, { status: 404, statusText: 'Not Found' });

    httpMock.expectNone(`${API}/auth/refresh`);
    expect(status).toBe(404);
  });

  it('does not refresh a 401 from a third-party origin', () => {
    auth.applySession(tokenResponse('token-abc'));

    http.get('https://someone-else.example.com/thing').subscribe({ error: () => undefined });

    httpMock
      .expectOne('https://someone-else.example.com/thing')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    httpMock.expectNone(`${API}/auth/refresh`);
  });
});
