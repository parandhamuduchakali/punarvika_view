import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { environment } from '../../../environments/environment';
import { AppApiError } from '../../core/interceptors/error.interceptor';
import {
  OrderDetail,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentResult,
} from '../../core/models/api.models';
import { NotificationService } from '../../core/services/notification.service';
import { OrderService } from '../../core/services/order.service';
import { PaymentService } from '../../core/services/payment.service';
import { InrPipe, QuantityPipe } from '../../shared/inr.pipe';
import { ErrorStateComponent, LoadingComponent, StatusChipComponent } from '../../shared/ui';

/** The fulfilment path an order walks, for the progress timeline. */
const TIMELINE: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING_PAYMENT', label: 'Placed' },
  { status: 'PAID', label: 'Paid' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PROCESSING', label: 'Being prepared' },
  { status: 'READY_FOR_DELIVERY', label: 'Ready' },
  { status: 'OUT_FOR_DELIVERY', label: 'On its way' },
  { status: 'DELIVERED', label: 'Delivered' },
];

@Component({
  selector: 'pf-order-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    InrPipe,
    QuantityPipe,
    LoadingComponent,
    ErrorStateComponent,
    StatusChipComponent,
  ],
  templateUrl: './order-detail.page.html',
  styleUrl: './orders.scss',
})
export class OrderDetailPage implements OnInit {
  private readonly orders = inject(OrderService);
  private readonly payments = inject(PaymentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly http = inject(HttpClient);

  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly orderPayments = signal<Payment[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly activePayment = signal<Payment | null>(null);

  protected readonly timeline = TIMELINE;

  /** True once an order has left the happy path; the timeline is then hidden. */
  protected readonly isCancelled = computed(() => {
    const status = this.order()?.status;
    return status === 'CANCELLED' || status === 'REFUNDED' || status === 'REFUND_PENDING';
  });

  protected readonly canPay = computed(() => {
    const status = this.order()?.status;
    return status === 'PENDING_PAYMENT' || status === 'PAYMENT_PROCESSING';
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (Number.isFinite(id) && id > 0) {
        this.load(id);
      } else {
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  protected load(id = Number(this.route.snapshot.paramMap.get('id'))): void {
    this.loading.set(true);
    this.failed.set(false);

    this.orders.get(id).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
        this.payments.forOrder(order.id).subscribe({
          next: (list) => this.orderPayments.set(list),
          error: () => undefined,
        });
      },
      error: () => {
        // A 404 here also covers "not your order" -- the API does not
        // distinguish, and neither should this page.
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** How far along the timeline this order is; -1 once cancelled. */
  protected stepIndex(): number {
    const status = this.order()?.status;
    if (!status || this.isCancelled()) {
      return -1;
    }
    const index = TIMELINE.findIndex((step) => step.status === status);
    // PAYMENT_PROCESSING sits between "placed" and "paid".
    return index === -1 && status === 'PAYMENT_PROCESSING' ? 0 : index;
  }

  protected cancel(): void {
    const order = this.order();
    if (!order || !order.can_cancel) {
      return;
    }
    this.cancelling.set(true);

    this.orders.cancel(order.id).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.cancelling.set(false);
        this.notifications.info(`Order ${updated.order_number} has been cancelled.`);
      },
      error: (error: unknown) => {
        this.cancelling.set(false);
        this.notifications.error(
          error instanceof AppApiError ? error.message : 'Could not cancel that order.',
        );
      },
    });
  }

  protected retryPayment(method: PaymentMethod): void {
    const order = this.order();
    if (!order) {
      return;
    }
    this.busy.set(true);

    this.payments.create(order.id, method).subscribe({
      next: (payment) => {
        this.activePayment.set(payment);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.notifications.error(
          error instanceof AppApiError ? error.message : 'Could not start a payment.',
        );
      },
    });
  }

  /** Development stand-in for the gateway callback. See CheckoutPage. */
  protected completeMockPayment(outcome: 'success' | 'failed'): void {
    const payment = this.activePayment();
    if (!payment) {
      return;
    }
    this.busy.set(true);

    this.http
      .post<PaymentResult>(
        `${environment.apiBaseUrl}/payments/${payment.id}/simulate?outcome=${outcome}`,
        {},
      )
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.activePayment.set(null);
          void this.router.navigate([result.success ? '/payment/success' : '/payment/failed'], {
            queryParams: { order: result.order_id },
          });
        },
        error: () => {
          this.busy.set(false);
          this.notifications.error('The payment could not be completed.');
        },
      });
  }

  protected get isMockGateway(): boolean {
    return this.activePayment()?.gateway === 'mock';
  }
}
