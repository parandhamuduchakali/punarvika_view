import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { AdminProduct, Inventory } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { QuantityPipe } from '../../shared/inr.pipe';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui';

/**
 * Stock management.
 *
 * Adjustments are sent as a delta rather than an absolute figure wherever
 * possible: a blind "set to 50" racing a concurrent order would silently discard
 * the other change. The API accepts one or the other, never both.
 */
@Component({
  selector: 'pf-admin-inventory',
  standalone: true,
  imports: [FormsModule, QuantityPipe, LoadingComponent, ErrorStateComponent],
  template: `
    <div class="pf-admin-head">
      <h2>Inventory</h2>
    </div>

    @if (loading()) {
      <pf-loading label="Loading inventory" />
    } @else if (failed()) {
      <pf-error message="We could not load the inventory." (retry)="load()" />
    } @else {
      @if (adjustError()) {
        <div class="pf-alert pf-alert--error" role="alert">{{ adjustError() }}</div>
      }

      <section class="pf-admin-table">
        <div class="pf-table-wrap">
          <table class="pf-table">
            <caption class="pf-sr-only">Stock levels for every listed product</caption>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col" class="pf-numeric">On hand</th>
                <th scope="col" class="pf-numeric">Reserved</th>
                <th scope="col" class="pf-numeric">Available</th>
                <th scope="col" class="pf-numeric">Low at</th>
                <th scope="col">Adjust</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.product.id) {
                <tr [class.pf-inactive]="!row.product.is_active">
                  <td>
                    <strong>{{ row.product.name }}</strong><br />
                    <span class="pf-muted">{{ row.product.unit.toLowerCase() }}</span>
                  </td>
                  @if (row.inventory; as stock) {
                    <td class="pf-numeric">{{ stock.stock_quantity | qty }}</td>
                    <td class="pf-numeric pf-muted">{{ stock.reserved_quantity | qty }}</td>
                    <td class="pf-numeric" [class.pf-low]="stock.is_low">
                      {{ stock.available_quantity | qty }}
                    </td>
                    <td class="pf-numeric pf-muted">{{ stock.low_stock_threshold | qty }}</td>
                  } @else {
                    <td colspan="4" class="pf-muted">No stock record</td>
                  }
                  <td>
                    <div class="pf-adjust">
                      <input
                        type="text"
                        class="pf-input pf-adjust__input"
                        [(ngModel)]="deltas[row.product.id]"
                        [attr.aria-label]="'Stock change for ' + row.product.name"
                        placeholder="+ / −"
                        inputmode="decimal"
                        [disabled]="busyId() === row.product.id"
                      />
                      <button
                        type="button"
                        class="pf-button pf-button--ghost pf-adjust__go"
                        [disabled]="busyId() === row.product.id"
                        (click)="adjust(row.product)"
                      >
                        Apply
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="pf-muted">No products yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <p class="pf-hint" style="margin-top: 1rem">
        Enter a change, not a total: <code>+20</code> for a morning milking,
        <code>-5</code> for spoilage. Stock cannot be taken below what is already
        reserved for placed orders.
      </p>
    }
  `,
  styles: [
    `
      .pf-adjust {
        display: flex;
        gap: 0.4rem;
        align-items: stretch;
      }
      .pf-adjust__input {
        width: 6rem;
        min-height: 38px;
        text-align: center;
      }
      .pf-adjust__go {
        min-height: 38px;
        padding: 0.35rem 0.75rem;
      }
      .pf-low {
        color: var(--pf-danger);
        font-weight: 700;
      }
      code {
        background: var(--pf-surface-2);
        padding: 0.05rem 0.3rem;
        border-radius: 4px;
      }
    `,
  ],
  styleUrl: './admin.scss',
})
export class AdminInventoryPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly notifications = inject(NotificationService);

  protected readonly rows = signal<{ product: AdminProduct; inventory: Inventory | null }[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly adjustError = signal<string | null>(null);

  protected deltas: Record<number, string> = {};

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.products(undefined, 100, 0).subscribe({
      next: (page) => {
        this.rows.set(page.items.map((product) => ({ product, inventory: null })));
        this.loading.set(false);
        // Stock is a separate record per product, so fetch each one.
        for (const product of page.items) {
          this.admin.inventory(product.id).subscribe({
            next: (inventory) =>
              this.rows.update((rows) =>
                rows.map((row) =>
                  row.product.id === product.id ? { ...row, inventory } : row,
                ),
              ),
            error: () => undefined,
          });
        }
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected adjust(product: AdminProduct): void {
    const delta = (this.deltas[product.id] ?? '').trim();
    if (!delta) {
      return;
    }
    this.adjustError.set(null);
    this.busyId.set(product.id);

    this.admin
      .adjustInventory(product.id, { delta, reason: 'Adjusted from farm admin' })
      .subscribe({
        next: (inventory) => {
          this.rows.update((rows) =>
            rows.map((row) => (row.product.id === product.id ? { ...row, inventory } : row)),
          );
          this.deltas[product.id] = '';
          this.busyId.set(null);
          this.notifications.success(`Stock updated for ${product.name}.`);
        },
        error: (error: unknown) => {
          this.busyId.set(null);
          this.adjustError.set(
            error instanceof AppApiError ? error.message : 'Could not adjust that stock.',
          );
        },
      });
  }
}
