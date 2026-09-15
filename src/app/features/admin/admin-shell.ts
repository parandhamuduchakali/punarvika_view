import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Sidebar layout wrapping every admin page. */
@Component({
  selector: 'pf-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="pf-container pf-page">
      <h1 class="pf-admin__title">Farm management</h1>

      <div class="pf-admin">
        <nav class="pf-admin__nav" aria-label="Farm management">
          <a routerLink="/admin" routerLinkActive="pf-admin__link--active" [routerLinkActiveOptions]="{ exact: true }">
            Dashboard
          </a>
          <a routerLink="/admin/orders" routerLinkActive="pf-admin__link--active">Orders</a>
          <a routerLink="/admin/products" routerLinkActive="pf-admin__link--active">Products</a>
          <a routerLink="/admin/categories" routerLinkActive="pf-admin__link--active">
            Categories
          </a>
          <a routerLink="/admin/inventory" routerLinkActive="pf-admin__link--active">Inventory</a>
          <a routerLink="/admin/coupons" routerLinkActive="pf-admin__link--active">Coupons</a>
          <a routerLink="/admin/reviews" routerLinkActive="pf-admin__link--active">Reviews</a>
          <a routerLink="/admin/customers" routerLinkActive="pf-admin__link--active">Customers</a>
          <a routerLink="/admin/payments" routerLinkActive="pf-admin__link--active">Payments</a>
        </nav>

        <div class="pf-admin__content">
          <router-outlet />
        </div>
      </div>
    </div>
  `,
  styleUrl: './admin.scss',
})
export class AdminShell {}
