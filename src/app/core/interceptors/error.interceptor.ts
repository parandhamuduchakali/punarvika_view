import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ApiErrorDetail } from '../models/api.models';
import { NotificationService } from '../services/notification.service';

/** A failure the UI can act on, normalised from the API's error envelope. */
export class AppApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppApiError';
  }

  /** True when the message names specific form fields. */
  get hasFieldErrors(): boolean {
    return !!this.fields && Object.keys(this.fields).length > 0;
  }
}

/**
 * Turns every backend failure into one `AppApiError`, so components never parse
 * an HTTP error shape themselves.
 *
 * Nothing here is shown automatically except the cases a component cannot
 * meaningfully handle (network down, server error). A validation failure belongs
 * next to the field that caused it, not in a toast.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 0) {
        // No response at all: offline, DNS, CORS, or the API is down.
        const message = 'Could not reach Punarvika Farms. Please check your connection.';
        notifications.error(message);
        return throwError(() => new AppApiError('NETWORK_ERROR', message, 0));
      }

      const detail = (error.error as { error?: ApiErrorDetail } | null)?.error;
      const appError = new AppApiError(
        detail?.code ?? 'UNKNOWN_ERROR',
        detail?.message ?? 'Something went wrong. Please try again.',
        error.status,
        detail?.fields,
      );

      // 5xx is never the customer's fault and never actionable in a form.
      if (error.status >= 500) {
        notifications.error(appError.message);
      }

      return throwError(() => appError);
    }),
  );
};
