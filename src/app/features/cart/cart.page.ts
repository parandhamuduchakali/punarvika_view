import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { CartItem } from '../../core/models/api.models';
import { CartService } from '../../core/services/cart.service';
import { NotificationService } from '../../core/services/notification.service';
import { InrPipe, QuantityPipe } from '../../shared/inr.pipe';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui';

/**
 * The basket.
 *
 * Nothing on this page is computed locally. Every quantity change round-trips to
 * the API, which re-prices the whole basket and returns it, so the totals shown
 * are always the ones the server would charge.
 */
@Component({
  selector: 'pf-cart',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    InrPipe,
    QuantityPipe,
    LoadingComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.scss',
})
export class CartPage implements OnInit {
  protected readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  /** The id of the line currently being changed, so only its row shows a spinner. */
  protected readonly busyItem = signal<number | null>(null);
  protected readonly lineError = signal<string | null>(null);

  /** Local edit buffer, keyed by line id, so typing does not fight the server. */
  protected quantities: Record<number, string> = {};

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.cart.load().subscribe({
      next: (cart) => {
        this.syncQuantities(cart.items);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  private syncQuantities(items: CartItem[]): void {
    this.quantities = {};
    for (const item of items) {
      this.quantities[item.id] = stripTrailingZeros(item.quantity);
    }
  }

  protected step(item: CartItem, direction: 1 | -1): void {
    const minimum = Number(item.minimum_order_quantity) || 1;
    const current = Number(this.quantities[item.id] ?? item.quantity) || minimum;
    let next = current + direction * minimum;

    if (next < minimum) {
      next = minimum;
    }
    const maximum = item.maximum_order_quantity ? Number(item.maximum_order_quantity) : null;
    if (maximum !== null && next > maximum) {
      next = maximum;
    }
    this.quantities[item.id] = stripTrailingZeros(String(Number(next.toFixed(3))));
    this.updateQuantity(item);
  }

  protected updateQuantity(item: CartItem): void {
    const quantity = this.quantities[item.id];
    if (!quantity || quantity === stripTrailingZeros(item.quantity)) {
      return;
    }

    this.lineError.set(null);
    this.busyItem.set(item.id);

    this.cart.updateItem(item.id, quantity).subscribe({
      next: (cart) => {
        this.syncQuantities(cart.items);
        this.busyItem.set(null);
      },
      error: (error: unknown) => {
        this.busyItem.set(null);
        // Put the server's number back so the field never shows a rejected value.
        this.quantities[item.id] = stripTrailingZeros(item.quantity);
        this.lineError.set(
          error instanceof AppApiError ? error.message : 'Could not update that item.',
        );
      },
    });
  }

  protected remove(item: CartItem): void {
    this.busyItem.set(item.id);
    this.cart.removeItem(item.id).subscribe({
      next: (cart) => {
        this.syncQuantities(cart.items);
        this.busyItem.set(null);
        this.notifications.info(`${item.product_name} removed from your basket.`);
      },
      error: () => {
        this.busyItem.set(null);
        this.notifications.error('Could not remove that item.');
      },
    });
  }

  protected clear(): void {
    this.cart.clear().subscribe({
      next: (cart) => this.syncQuantities(cart.items),
      error: () => this.notifications.error('Could not empty your basket.'),
    });
  }

  protected checkout(): void {
    void this.router.navigate(['/checkout']);
  }
}

function stripTrailingZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') || '0' : value;
}
