import { Routes } from '@angular/router';

/**
 * Every feature is lazily loaded, so a first-time visitor browsing the shop does
 * not download the checkout or admin code at all.
 *
 * Guards decide what renders. They are not the security boundary: every
 * protected resource is enforced again by the API.
 *
 * Routes are added here as their features land (auth and catalog, cart and
 * checkout, orders and profile, then admin).
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/catalog/home.page').then((m) => m.HomePage),
    title: 'Punarvika Farms — fresh from the farm',
  },
  {
    path: '**',
    loadComponent: () => import('./features/catalog/not-found.page').then((m) => m.NotFoundPage),
    title: 'Page not found — Punarvika Farms',
  },
];
