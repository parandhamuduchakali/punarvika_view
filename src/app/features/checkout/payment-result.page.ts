import { Component, Directive, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrderDetail } from '../../core/models/api.models';
import { CartService } from '../../core/services/cart.service';
import { OrderService } from '../../core/services/order.service';
import { InrPipe } from '../../shared/inr.pipe';
import { LoadingComponent } from '../../shared/ui';

/**
 * Shared by the success and failure pages.
 *
 * Both re-read the order from the API rather than trusting anything in the URL.
 * The query string only says *which* order to look at; whether it was actually
 * paid is read from the server, so landing on /payment/success by hand shows the
 * real status.
 */
// @Directive() is required for an abstract class that uses inject() and a
// lifecycle hook; Angular refuses to compile an undecorated one.
@Directive()
abstract class PaymentResultBase implements OnInit {
  protected readonly route = inject(ActivatedRoute);
  protected readonly orders = inject(OrderService);
  protected readonly cart = inject(CartService);

  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly loading = signal(true);

  ngOnInit(): void {
    // The basket was converted by checkout; make sure the header badge agrees.
    this.cart.reset();

    const orderId = Number(this.route.snapshot.queryParamMap.get('order'));
    if (!Number.isFinite(orderId) || orderId <= 0) {
      this.loading.set(false);
      return;
    }

    this.orders.get(orderId).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      // A 404 here means the order is not this customer's, so show nothing.
      error: () => this.loading.set(false),
    });
  }
}

@Component({
  selector: 'pf-payment-success',
  standalone: true,
  imports: [RouterLink, InrPipe, LoadingComponent],
  template: `
    <div class="pf-container pf-page">
      @if (loading()) {
        <pf-loading label="Confirming your order" />
      } @else {
        <div class="pf-result pf-card">
          <p class="pf-result__icon" aria-hidden="true">✅</p>
          <h1>Thank you — your order is confirmed</h1>

          @if (order(); as placed) {
            <p class="pf-muted">
              Order <strong>{{ placed.order_number }}</strong>
            </p>
            <p class="pf-result__amount">{{ placed.total_amount | inr }}</p>
            <p>
              We are preparing your order at the farm. You will get an update when it is on
              its way to
              {{ placed.delivery_address.city }}.
            </p>
            <div class="pf-result__actions">
              <a [routerLink]="['/orders', placed.id]" class="pf-button">View your order</a>
              <a routerLink="/products" class="pf-button pf-button--ghost">Keep shopping</a>
            </div>
          } @else {
            <p class="pf-muted">
              Your payment went through. You can see the details in your orders.
            </p>
            <div class="pf-result__actions">
              <a routerLink="/orders" class="pf-button">Your orders</a>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './payment-result.page.scss',
})
export class PaymentSuccessPage extends PaymentResultBase {}

@Component({
  selector: 'pf-payment-failed',
  standalone: true,
  imports: [RouterLink, InrPipe, LoadingComponent],
  template: `
    <div class="pf-container pf-page">
      @if (loading()) {
        <pf-loading label="Checking your payment" />
      } @else {
        <div class="pf-result pf-card">
          <p class="pf-result__icon" aria-hidden="true">⚠️</p>
          <h1>Your payment did not go through</h1>

          @if (order(); as placed) {
            <p class="pf-muted">
              Order <strong>{{ placed.order_number }}</strong> —
              {{ placed.total_amount | inr }}
            </p>
            <!-- Stock stays reserved, so retrying does not mean re-shopping. -->
            <p>
              Nothing has been charged. Your order is still held for you, so you can try
              paying again.
            </p>
            <div class="pf-result__actions">
              <a [routerLink]="['/orders', placed.id]" class="pf-button">Try paying again</a>
              <a routerLink="/orders" class="pf-button pf-button--ghost">Your orders</a>
            </div>
          } @else {
            <p>Nothing has been charged. Please try again from your orders.</p>
            <div class="pf-result__actions">
              <a routerLink="/orders" class="pf-button">Your orders</a>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './payment-result.page.scss',
})
export class PaymentFailedPage extends PaymentResultBase {}
