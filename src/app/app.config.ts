import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // Land at the top of a new page, but restore position on Back.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(
      // Order matters: authInterceptor runs first so it can retry a 401 with a
      // fresh token *before* errorInterceptor turns it into an AppApiError.
      withInterceptors([authInterceptor, errorInterceptor]),
    ),
    /**
     * The access token lives in memory, so a reload starts signed out. This asks
     * the refresh endpoint (using the HttpOnly cookie) for a new one before the
     * first route renders, which stops a signed-in customer being bounced to
     * /login by the auth guard on every refresh.
     */
    provideAppInitializer(() => inject(AuthService).restoreSession()),
  ],
};
