import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../../../environments/environment';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { AuthService } from '../../core/services/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let httpMock: HttpTestingController;
  let router: Router;

  const tokenResponse = {
    access_token: 'access-token-value',
    token_type: 'bearer',
    expires_in: 900,
    user: {
      id: 1,
      email: 'customer@example.com',
      full_name: 'Test Customer',
      phone: null,
      role: 'CUSTOMER' as const,
      is_active: true,
      email_verified: false,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        // The real pipeline: errorInterceptor is what turns the API envelope
        // into an AppApiError, which is what the component reacts to.
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  /** Reach into the protected members the template binds to. */
  const page = () => fixture.componentInstance as unknown as {
    form: { patchValue: (v: Record<string, string>) => void };
    submit: () => void;
    formError: () => string | null;
  };

  it('does not call the API when the form is empty', () => {
    page().submit();

    httpMock.expectNone(`${environment.apiBaseUrl}/auth/login`);
  });

  it('does not call the API for a malformed email', () => {
    page().form.patchValue({ email: 'not-an-email', password: 'Punarvika1' });
    page().submit();

    httpMock.expectNone(`${environment.apiBaseUrl}/auth/login`);
  });

  it('signs in and stores the session', () => {
    page().form.patchValue({ email: 'customer@example.com', password: 'Punarvika1' });
    page().submit();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    // The refresh cookie only travels when credentials are allowed.
    expect(request.request.withCredentials).toBe(true);
    request.flush(tokenResponse);

    const auth = TestBed.inject(AuthService);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken).toBe('access-token-value');

    // The cart is loaded for the newly signed-in customer.
    httpMock.expectOne(`${environment.apiBaseUrl}/cart`).flush({
      items: [],
      pricing: {
        subtotal: '0.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        delivery_charge: '0.00',
        total_amount: '0.00',
        currency: 'INR',
      },
      item_count: 0,
      has_issues: false,
    });
  });

  it('shows the API message when the credentials are wrong', () => {
    page().form.patchValue({ email: 'customer@example.com', password: 'WrongPass1' });
    page().submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(page().formError()).toBe('Email or password is incorrect.');
    expect(TestBed.inject(AuthService).isAuthenticated()).toBe(false);
  });

  it('lands on the home page when no returnUrl was given', () => {
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    page().form.patchValue({ email: 'customer@example.com', password: 'Punarvika1' });
    page().submit();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(tokenResponse);
    httpMock.expectOne(`${environment.apiBaseUrl}/cart`).flush({
      items: [],
      pricing: {
        subtotal: '0.00',
        discount_amount: '0.00',
        tax_amount: '0.00',
        delivery_charge: '0.00',
        total_amount: '0.00',
        currency: 'INR',
      },
      item_count: 0,
      has_issues: false,
    });

    expect(navigate).toHaveBeenCalledWith('/');
  });
});

describe('returnUrl safety', () => {
  /**
   * Mirrors the check in LoginPage.submit. Only a same-site path is followed:
   * an absolute URL would make the login page an open redirect, so a crafted
   * link could bounce a customer to a lookalike site straight after signing in.
   * `//host` is rejected too -- browsers read it as protocol-relative.
   */
  const safeReturnUrl = (returnUrl: string | null): string =>
    returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';

  it.each(['/cart', '/orders/12', '/products?q=milk'])('follows the same-site path %s', (url) => {
    expect(safeReturnUrl(url)).toBe(url);
  });

  it.each([
    'https://evil.example.com',
    '//evil.example.com',
    'http://evil.example.com/cart',
    'javascript:alert(1)',
  ])('refuses %s', (url) => {
    expect(safeReturnUrl(url)).toBe('/');
  });

  it('falls back to home when absent', () => {
    expect(safeReturnUrl(null)).toBe('/');
  });
});
