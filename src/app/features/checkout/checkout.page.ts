import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AppApiError } from '../../core/interceptors/error.interceptor';
import {
  Address,
  Cart,
  OrderDetail,
  Payment,
  PaymentMethod,
  PaymentResult,
} from '../../core/models/api.models';
import { CartService } from '../../core/services/cart.service';
import { NotificationService } from '../../core/services/notification.service';
import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { ProfileService } from '../../core/services/profile.service';
import { InrPipe, QuantityPipe } from '../../shared/inr.pipe';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui';

type Step = 'review' | 'paying';

/**
 * Checkout.
 *
 * The browser sends a delivery address id and an optional note. It sends no
 * price, no quantity and no total: the server recomputes the whole order from
 * the cart and the live product prices, and the figure shown here is whatever it
 * returned. That is why the summary is re-read from the placed order rather than
 * carried over from the basket.
 */
@Component({
  selector: 'pf-checkout',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    InrPipe,
    QuantityPipe,
    LoadingComponent,
    ErrorStateComponent,
  ],
  templateUrl: './checkout.page.html',
  styleUrl: './checkout.page.scss',
})
export class CheckoutPage implements OnInit {
  private readonly cartService = inject(CartService);
  private readonly profile = inject(ProfileService);
  private readonly orders = inject(OrderService);
  private readonly payments = inject(PaymentService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);
  private readonly http = inject(HttpClient);

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly submitting = signal(false);
  protected readonly step = signal<Step>('review');
  protected readonly error = signal<string | null>(null);

  protected readonly cart = signal<Cart | null>(null);
  protected readonly addresses = signal<Address[]>([]);
  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly payment = signal<Payment | null>(null);

  protected selectedAddressId: number | null = null;
  protected method: PaymentMethod = 'UPI';
  protected notes = '';
  /** Carried from the cart. Re-validated and re-priced by the server. */
  protected readonly coupon = this.route.snapshot.queryParamMap.get('coupon');

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.cartService.load(this.coupon).subscribe({
      next: (cart) => {
        this.cart.set(cart);
        if (cart.items.length === 0) {
          void this.router.navigate(['/cart']);
          return;
        }
        this.profile.addresses().subscribe({
          next: (addresses) => {
            this.addresses.set(addresses);
            // Preselect the default so the common case is one click.
            this.selectedAddressId =
              addresses.find((a) => a.is_default)?.id ?? addresses[0]?.id ?? null;
            this.loading.set(false);
          },
          error: () => {
            this.failed.set(true);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected get canPlace(): boolean {
    const cart = this.cart();
    return (
      !!this.selectedAddressId &&
      !!cart &&
      cart.items.length > 0 &&
      cart.pricing.total_amount !== '0.00'
    );
  }

  /** Step 1: create the order, then open a payment against it. */
  protected placeOrder(): void {
    if (!this.canPlace || !this.selectedAddressId) {
      return;
    }
    this.error.set(null);
    this.submitting.set(true);

    this.orders.place(this.selectedAddressId, this.notes.trim() || null, this.coupon).subscribe({
      next: (order) => {
        this.order.set(order);
        // The basket is now converted server-side.
        this.cartService.reset();
        this.openPayment(order);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.error.set(
          error instanceof AppApiError
            ? error.message
            : 'We could not place your order. Please try again.',
        );
      },
    });
  }

  private openPayment(order: OrderDetail): void {
    this.payments.create(order.id, this.method).subscribe({
      next: (payment) => {
        this.payment.set(payment);
        this.step.set('paying');
        this.submitting.set(false);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        // The order exists and is awaiting payment, so send them to it rather
        // than losing it.
        this.notifications.error(
          error instanceof AppApiError
            ? error.message
            : 'Your order was placed but payment could not be started.',
        );
        void this.router.navigate(['/orders', order.id]);
      },
    });
  }

  /**
   * Step 2, development only.
   *
   * The mock gateway signs with a server-side secret, so the browser cannot
   * produce a valid signature. This calls the backend stand-in for the gateway
   * callback. With a real gateway this is replaced by the provider's checkout
   * widget, which returns a payment id and signature for /payments/verify.
   */
  protected completeMockPayment(outcome: 'success' | 'failed'): void {
    const payment = this.payment();
    const order = this.order();
    if (!payment || !order) {
      return;
    }
    this.submitting.set(true);

    this.http
      .post<PaymentResult>(
        `${environment.apiBaseUrl}/payments/${payment.id}/simulate?outcome=${outcome}`,
        {},
      )
      .subscribe({
        next: (result) => {
          this.submitting.set(false);
          void this.router.navigate([result.success ? '/payment/success' : '/payment/failed'], {
            queryParams: { order: result.order_id },
          });
        },
        error: () => {
          this.submitting.set(false);
          void this.router.navigate(['/payment/failed'], { queryParams: { order: order.id } });
        },
      });
  }

  protected get isMockGateway(): boolean {
    return this.payment()?.gateway === 'mock';
  }
}
