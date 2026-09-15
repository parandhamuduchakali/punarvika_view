import { Routes } from '@angular/router';

import { guestGuard } from './core/guards/auth.guard';

/**
 * Every feature is lazily loaded, so a first-time visitor browsing the shop does
 * not download the checkout or admin code at all.
 *
 * Guards decide what renders. They are not the security boundary: every
 * protected resource is enforced again by the API.
 */
export const routes: Routes = [
  // -------------------------------------------------------------- catalog
  {
    path: '',
    loadComponent: () => import('./features/catalog/home.page').then((m) => m.HomePage),
    title: 'Punarvika Farms — fresh from the farm',
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./features/catalog/product-list.page').then((m) => m.ProductListPage),
    title: 'Shop — Punarvika Farms',
  },
  {
    path: 'products/:id',
    loadComponent: () =>
      import('./features/catalog/product-detail.page').then((m) => m.ProductDetailPage),
  },
  {
    path: 'categories/:slug',
    loadComponent: () =>
      import('./features/catalog/product-list.page').then((m) => m.ProductListPage),
  },

  // -------------------------------------------------------------- account
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
    title: 'Sign in — Punarvika Farms',
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
    title: 'Create an account — Punarvika Farms',
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/forgot-password.page').then((m) => m.ForgotPasswordPage),
    title: 'Reset your password — Punarvika Farms',
  },
  {
    // No guestGuard: a customer may follow a reset link while still signed in.
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password.page').then((m) => m.ResetPasswordPage),
    title: 'Set a new password — Punarvika Farms',
  },

  {
    path: '**',
    loadComponent: () => import('./features/catalog/not-found.page').then((m) => m.NotFoundPage),
    title: 'Page not found — Punarvika Farms',
  },
];
