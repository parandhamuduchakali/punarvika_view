import { Routes } from '@angular/router';

import { adminGuard, authGuard, guestGuard } from './core/guards/auth.guard';

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

  // ------------------------------------------------------ basket and pay
  {
    path: 'cart',
    canActivate: [authGuard],
    loadComponent: () => import('./features/cart/cart.page').then((m) => m.CartPage),
    title: 'Your basket — Punarvika Farms',
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./features/checkout/checkout.page').then((m) => m.CheckoutPage),
    title: 'Checkout — Punarvika Farms',
  },
  {
    path: 'payment/success',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/checkout/payment-result.page').then((m) => m.PaymentSuccessPage),
    title: 'Order confirmed — Punarvika Farms',
  },
  {
    path: 'payment/failed',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/checkout/payment-result.page').then((m) => m.PaymentFailedPage),
    title: 'Payment failed — Punarvika Farms',
  },

  // --------------------------------------------------- orders and account
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./features/orders/order-list.page').then((m) => m.OrderListPage),
    title: 'Your orders — Punarvika Farms',
  },
  {
    path: 'orders/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/orders/order-detail.page').then((m) => m.OrderDetailPage),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/profile.page').then((m) => m.ProfilePage),
    title: 'Your profile — Punarvika Farms',
  },
  {
    path: 'my-reviews',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/my-reviews.page').then((m) => m.MyReviewsPage),
    title: 'Your reviews — Punarvika Farms',
  },
  {
    path: 'addresses',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/addresses.page').then((m) => m.AddressesPage),
    title: 'Delivery addresses — Punarvika Farms',
  },

  // ----------------------------------------------------------------- admin
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },

  {
    path: '**',
    loadComponent: () => import('./features/catalog/not-found.page').then((m) => m.NotFoundPage),
    title: 'Page not found — Punarvika Farms',
  },
];
