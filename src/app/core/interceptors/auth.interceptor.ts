import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  filter,
  merge,
  switchMap,
  take,
  throwError,
} from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/** Endpoints that must not trigger a refresh-and-retry, or we would loop. */
const REFRESH_EXEMPT = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

/**
 * Shared across concurrent 401s. Without it, several requests failing at once
 * would each fire a refresh -- and because the backend rotates refresh tokens
 * and treats a replayed one as theft, all but the first would present an
 * already-replaced token and get the whole session revoked.
 */
let refreshInFlight = false;
const refreshed$ = new BehaviorSubject<string | null>(null);
const refreshFailed$ = new Subject<unknown>();

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Only ever attach the token to our own API. Sending it to a third-party
  // origin would hand them the session.
  const isOurApi = req.url.startsWith(environment.apiBaseUrl);
  const token = auth.accessToken;

  const authorised =
    isOurApi && token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` }, withCredentials: true })
      : req.clone({ withCredentials: isOurApi });

  return next(authorised).pipe(
    catchError((error: unknown) => {
      const exempt = REFRESH_EXEMPT.some((path) => req.url.includes(path));
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !isOurApi || exempt) {
        return throwError(() => error);
      }
      return handleUnauthorised(req, next, auth, router);
    }),
  );
};

function handleUnauthorised(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router,
): Observable<HttpEvent<unknown>> {
  const retryWith = (accessToken: string): Observable<HttpEvent<unknown>> =>
    next(
      req.clone({
        setHeaders: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
      }),
    );

  if (refreshInFlight) {
    // Queue behind the refresh already running.
    return merge(
      refreshed$.pipe(filter((value): value is string => value !== null)),
      refreshFailed$.pipe(switchMap((refreshError) => throwError(() => refreshError))),
    ).pipe(take(1), switchMap(retryWith));
  }

  refreshInFlight = true;
  refreshed$.next(null);

  return auth.refresh().pipe(
    switchMap((response) => {
      refreshInFlight = false;
      refreshed$.next(response.access_token);
      return retryWith(response.access_token);
    }),
    catchError((refreshError: unknown) => {
      refreshInFlight = false;
      // Fail every request queued behind this refresh; waiting for a token
      // that will never come would leave them hanging forever.
      refreshFailed$.next(refreshError);
      auth.clearSession();
      void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      return throwError(() => refreshError);
    }),
  );
}
