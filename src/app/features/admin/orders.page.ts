import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { OrderDetail, OrderStatus, OrderSummary, Page } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { InrPipe, QuantityPipe } from '../../shared/inr.pipe';
import {
  ErrorStateComponent,
  LoadingComponent,
  StatusChipComponent,
} from '../../shared/ui';

const PAGE_SIZE = 20;

/**
 * What an order may move to next, mirroring ORDER_TRANSITIONS on the backend.
 *
 * This only decides which buttons are offered. The API validates the transition
 * again and rejects an illegal one, so a stale page here cannot force a bad
 * state change.
 */
const NEXT_STATUSES: Record<string, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAYMENT_PROCESSING: ['PAID', 'PENDING_PAYMENT', 'CANCELLED'],
  PAID: ['CONFIRMED', 'CANCELLED', 'REFUND_PENDING'],
  CONFIRMED: ['PROCESSING', 'CANCELLED', 'REFUND_PENDING'],
  PROCESSING: ['READY_FOR_DELIVERY', 'REFUND_PENDING'],
  READY_FOR_DELIVERY: ['OUT_FOR_DELIVERY', 'REFUND_PENDING'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'REFUND_PENDING'],
  DELIVERED: [],
  CANCELLED: ['REFUND_PENDING'],
  REFUND_PENDING: ['REFUNDED'],
  REFUNDED: [],
};

@Component({
  selector: 'pf-admin-orders',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    InrPipe,
    QuantityPipe,
    LoadingComponent,
    ErrorStateComponent,
    StatusChipComponent,
  ],
  templateUrl: './orders.page.html',
  styleUrl: './admin.scss',
})
export class AdminOrdersPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly notifications = inject(NotificationService);

  protected readonly result = signal<Page<OrderSummary> | null>(null);
  protected readonly selected = signal<OrderDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);
  protected readonly offset = signal(0);

  protected status: OrderStatus | '' = '';

  protected readonly statuses: (OrderStatus | '')[] = [
    '',
    'PENDING_PAYMENT',
    'PAYMENT_PROCESSING',
    'PAID',
    'CONFIRMED',
    'PROCESSING',
    'READY_FOR_DELIVERY',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED',
    'REFUND_PENDING',
    'REFUNDED',
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.orders(this.status || undefined, undefined, PAGE_SIZE, this.offset()).subscribe({
      next: (page) => {
        this.result.set(page);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected onFilterChange(): void {
    this.offset.set(0);
    this.load();
  }

  protected open(order: OrderSummary): void {
    this.admin.order(order.id).subscribe({
      next: (detail) => this.selected.set(detail),
      error: () => this.notifications.error('Could not load that order.'),
    });
  }

  protected close(): void {
    this.selected.set(null);
  }

  protected nextStatuses(status: string): OrderStatus[] {
    return NEXT_STATUSES[status] ?? [];
  }

  protected label(status: string): string {
    const text = status.replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected moveTo(order: OrderDetail, status: OrderStatus): void {
    this.busy.set(true);

    this.admin.setOrderStatus(order.id, status).subscribe({
      next: (updated) => {
        this.selected.set(updated);
        this.busy.set(false);
        this.notifications.success(`Order ${updated.order_number} is now ${this.label(status)}.`);
        this.load();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        // The API rejects an illegal transition; show its reason verbatim.
        this.notifications.error(
          error instanceof AppApiError ? error.message : 'Could not update that order.',
        );
      },
    });
  }

  protected goToPage(newOffset: number): void {
    this.offset.set(Math.max(0, newOffset));
    this.load();
  }

  protected get pageSize(): number {
    return PAGE_SIZE;
  }

  protected hasPrevious(): boolean {
    return this.offset() > 0;
  }

  protected hasNext(): boolean {
    const page = this.result();
    return !!page && page.offset + page.items.length < page.total;
  }
}
