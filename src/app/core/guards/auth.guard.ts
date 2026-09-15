import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Requires a signed-in customer.
 *
 * The guard is a convenience, not the security boundary -- it only decides what
 * the browser renders. Every protected resource is enforced server-side, so a
 * user who edits their way past this still gets a 401 or 404 from the API.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Requires an administrator. Admin APIs enforce this again server-side. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) {
    return true;
  }
  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  // Signed in but not an administrator: send them somewhere useful rather than
  // showing a page they cannot use.
  return router.createUrlTree(['/']);
};

/** For /login and /register: a signed-in customer has no use for them. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
