import { Routes } from '@angular/router';

import { adminGuard } from '../../core/guards/auth.guard';

/**
 * The farm management area.
 *
 * `adminGuard` is applied on the parent route in app.routes.ts and repeated on
 * the shell here, so a child route cannot be reached by a direct URL even if the
 * parent guard is ever loosened. The API refuses these calls for a non-admin
 * regardless -- the guards only decide what is rendered.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: '',
        loadComponent: () => import('./dashboard.page').then((m) => m.AdminDashboardPage),
        title: 'Farm admin — Punarvika Farms',
      },
      {
        path: 'products',
        loadComponent: () => import('./products.page').then((m) => m.AdminProductsPage),
        title: 'Products — Farm admin',
      },
      {
        path: 'categories',
        loadComponent: () => import('./categories.page').then((m) => m.AdminCategoriesPage),
        title: 'Categories — Farm admin',
      },
      {
        path: 'inventory',
        loadComponent: () => import('./inventory.page').then((m) => m.AdminInventoryPage),
        title: 'Inventory — Farm admin',
      },
      {
        path: 'coupons',
        loadComponent: () => import('./coupons.page').then((m) => m.AdminCouponsPage),
        title: 'Coupons — Farm admin',
      },
      {
        path: 'reviews',
        loadComponent: () => import('./reviews.page').then((m) => m.AdminReviewsPage),
        title: 'Reviews — Farm admin',
      },
      {
        path: 'orders',
        loadComponent: () => import('./orders.page').then((m) => m.AdminOrdersPage),
        title: 'Orders — Farm admin',
      },
      {
        path: 'customers',
        loadComponent: () => import('./customers.page').then((m) => m.AdminCustomersPage),
        title: 'Customers — Farm admin',
      },
      {
        path: 'payments',
        loadComponent: () => import('./payments.page').then((m) => m.AdminPaymentsPage),
        title: 'Payments — Farm admin',
      },
      {
        path: 'audit-log',
        loadComponent: () => import('./audit-log.page').then((m) => m.AdminAuditLogPage),
        title: 'Audit log — Farm admin',
      },
      { path: '**', redirectTo: '' },
    ],
  },
];
