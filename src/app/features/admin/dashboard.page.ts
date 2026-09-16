import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LowStockItem, SalesReport } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { InrPipe, QuantityPipe } from '../../shared/inr.pipe';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui';

@Component({
  selector: 'pf-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    InrPipe,
    QuantityPipe,
    LoadingComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="pf-admin-head">
      <h2>Dashboard</h2>
    </div>

    @if (loading()) {
      <pf-loading label="Loading the dashboard" />
    } @else if (failed()) {
      <pf-error message="We could not load the dashboard." (retry)="load()" />
    } @else {
      @if (report(); as sales) {
        <div class="pf-stats">
          <div class="pf-stat">
            <span class="pf-stat__label">Revenue</span>
            <span class="pf-stat__value">{{ sales.revenue | inr }}</span>
          </div>
          <div class="pf-stat">
            <span class="pf-stat__label">Paid orders</span>
            <span class="pf-stat__value">{{ sales.orders_paid }}</span>
          </div>
          <div class="pf-stat">
            <span class="pf-stat__label">Average order</span>
            <span class="pf-stat__value">{{ sales.average_order_value | inr }}</span>
          </div>
          <div class="pf-stat">
            <span class="pf-stat__label">All orders</span>
            <span class="pf-stat__value">{{ sales.orders_total }}</span>
          </div>
          <div class="pf-stat">
            <span class="pf-stat__label">Cancelled</span>
            <span class="pf-stat__value">{{ sales.orders_cancelled }}</span>
          </div>
        </div>

        <!-- Revenue counts only genuinely paid orders; a pending one is not
             money, and the breakdown below makes that visible. -->
        <section class="pf-admin-table" style="margin-bottom: 1.75rem">
          <table class="pf-table">
            <caption class="pf-sr-only">Orders by status</caption>
            <thead>
              <tr>
                <th scope="col">Order status</th>
                <th scope="col" class="pf-numeric">Count</th>
              </tr>
            </thead>
            <tbody>
              @for (row of statusRows(); track row.status) {
                <tr>
                  <td>{{ label(row.status) }}</td>
                  <td class="pf-numeric">{{ row.count }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="2" class="pf-muted">No orders yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }

      <div class="pf-admin-head">
        <h2>Low stock</h2>
        <a routerLink="/admin/inventory" class="pf-button pf-button--ghost">Manage inventory</a>
      </div>

      @if (lowStock().length === 0) {
        <pf-empty icon="✅" title="Everything is well stocked" />
      } @else {
        <section class="pf-admin-table">
          <table class="pf-table">
            <caption class="pf-sr-only">Products at or below their threshold</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" class="pf-numeric">Available</th>
                <th scope="col" class="pf-numeric">Threshold</th>
              </tr>
            </thead>
            <tbody>
              @for (item of lowStock(); track item.product_id) {
                <tr>
                  <td>{{ item.product_name }}</td>
                  <td class="pf-numeric">{{ item.available_quantity | qty }}</td>
                  <td class="pf-numeric pf-muted">{{ item.low_stock_threshold | qty }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    }
  `,
  styleUrl: './admin.scss',
})
export class AdminDashboardPage implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly report = signal<SalesReport | null>(null);
  protected readonly lowStock = signal<LowStockItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.salesReport().subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });

    this.admin.lowStock().subscribe({
      next: (items) => this.lowStock.set(items),
      error: () => undefined,
    });
  }

  protected statusRows(): { status: string; count: number }[] {
    const byStatus = this.report()?.by_status ?? {};
    return Object.entries(byStatus)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }

  protected label(status: string): string {
    const text = status.replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}
