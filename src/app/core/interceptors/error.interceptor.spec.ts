import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { NotificationService } from '../services/notification.service';
import { AppApiError, errorInterceptor } from './error.interceptor';

const API = environment.apiBaseUrl;

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
  });

  function failWith(body: object | string, status: number): Promise<AppApiError> {
    return new Promise((resolve) => {
      http.get(`${API}/thing`).subscribe({ error: (e: AppApiError) => resolve(e) });
      httpMock.expectOne(`${API}/thing`).flush(body, { status, statusText: 'Error' });
    });
  }

  // ------------------------------------------------------------- envelope
  it('turns the API envelope into an AppApiError', async () => {
    const error = await failWith(
      {
        success: false,
        error: { code: 'INSUFFICIENT_STOCK', message: 'Requested quantity is not available.' },
      },
      409,
    );

    expect(error).toBeInstanceOf(AppApiError);
    expect(error.code).toBe('INSUFFICIENT_STOCK');
    expect(error.message).toBe('Requested quantity is not available.');
    expect(error.status).toBe(409);
  });

  it('carries field errors through for form binding', async () => {
    const error = await failWith(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'The request is invalid.',
          fields: { email: ['Enter a valid email address.'] },
        },
      },
      400,
    );

    expect(error.hasFieldErrors).toBe(true);
    expect(error.fields).toEqual({ email: ['Enter a valid email address.'] });
  });

  it('reports no field errors when the envelope carries none', async () => {
    const error = await failWith(
      { success: false, error: { code: 'FORBIDDEN', message: 'Not permitted.' } },
      403,
    );

    expect(error.hasFieldErrors).toBe(false);
  });

  it('falls back sensibly when the body is not our envelope', async () => {
    // A proxy or gateway can return HTML or an empty body.
    const error = await failWith('<html>502 Bad Gateway</html>', 502);

    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.message).toBe('Something went wrong. Please try again.');
    expect(error.status).toBe(502);
  });

  // -------------------------------------------------------- notifications
  it('does not toast a validation error', async () => {
    // It belongs beside the field that caused it, not in a corner of the screen.
    await failWith(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid.' } },
      400,
    );

    expect(notifications.notices().length).toBe(0);
  });

  it('does not toast a 404 or a 409', async () => {
    await failWith({ success: false, error: { code: 'NOT_FOUND', message: 'Gone.' } }, 404);
    await failWith({ success: false, error: { code: 'CONFLICT', message: 'Clash.' } }, 409);

    expect(notifications.notices().length).toBe(0);
  });

  it('toasts a server error, which no component can act on', async () => {
    await failWith(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } },
      500,
    );

    const notices = notifications.notices();
    expect(notices.length).toBe(1);
    expect(notices[0].kind).toBe('error');
  });

  it('reports an unreachable API distinctly from a server error', async () => {
    // status 0 means no response at all: offline, DNS, CORS, or the API is down.
    const error = await new Promise<AppApiError>((resolve) => {
      http.get(`${API}/thing`).subscribe({ error: (e: AppApiError) => resolve(e) });
      httpMock.expectOne(`${API}/thing`).error(new ProgressEvent('error'), { status: 0 });
    });

    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.message).toContain('Could not reach');
    expect(notifications.notices().length).toBe(1);
  });

  it('leaves a successful response untouched', () => {
    let body: unknown;
    http.get(`${API}/products`).subscribe((value) => (body = value));

    httpMock.expectOne(`${API}/products`).flush({ items: [], total: 0 });

    expect(body).toEqual({ items: [], total: 0 });
    expect(notifications.notices().length).toBe(0);
  });
});
