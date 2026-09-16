import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { OrderStatus, OrderSummary, Page } from '../../core/models/api.models';
import { OrderService } from '../../core/services/order.service';
import { InrPipe } from '../../shared/inr.pipe';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingComponent,
  StatusChipComponent,
} from '../../shared/ui';

const PAGE_SIZE = 10;

@Component({
  selector: 'pf-order-list',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    InrPipe,
    LoadingComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    StatusChipComponent,
  ],
  templateUrl: './order-list.page.html',
  styleUrl: './orders.scss',
})
export class OrderListPage implements OnInit {
  private readonly orders = inject(OrderService);

  protected readonly result = signal<Page<OrderSummary> | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly offset = signal(0);

  protected status: OrderStatus | '' = '';

  /** Only the statuses a customer meaningfully filters by. */
  protected readonly statuses: { value: OrderStatus | ''; label: string }[] = [
    { value: '', label: 'All orders' },
    { value: 'PENDING_PAYMENT', label: 'Awaiting payment' },
    { value: 'PAID', label: 'Paid' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'PROCESSING', label: 'Being prepared' },
    { value: 'OUT_FOR_DELIVERY', label: 'On its way' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.orders.list(this.status || undefined, PAGE_SIZE, this.offset()).subscribe({
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
