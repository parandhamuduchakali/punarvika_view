import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminPayment, Page, PaymentStatus } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { InrPipe } from '../../shared/inr.pipe';
import {
  ErrorStateComponent,
  LoadingComponent,
  StatusChipComponent,
} from '../../shared/ui';

const PAGE_SIZE = 20;

@Component({
  selector: 'pf-admin-payments',
  standalone: true,
  imports: [
    FormsModule,
    DatePipe,
    InrPipe,
    LoadingComponent,
    ErrorStateComponent,
    StatusChipComponent,
  ],
  template: `
    <div class="pf-admin-head">
      <h2>Payments</h2>
      <div class="pf-field" style="margin: 0; min-width: 14rem">
        <label class="pf-sr-only" for="status">Filter by status</label>
        <select id="status" class="pf-select" [(ngModel)]="status" (change)="onFilterChange()">
          @for (option of statuses; track option) {
            <option [value]="option">{{ option ? label(option) : 'All statuses' }}</option>
          }
        </select>
      </div>
    </div>

    @if (loading()) {
      <pf-loading label="Loading payments" />
    } @else if (failed()) {
      <pf-error message="We could not load the payments." (retry)="load()" />
    } @else if (result(); as page) {
      <section class="pf-admin-table">
        <div class="pf-table-wrap">
          <table class="pf-table">
            <caption class="pf-sr-only">Every payment attempt</caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Method</th>
                <th scope="col" class="pf-numeric">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Paid</th>
                <th scope="col" class="pf-numeric">Attempts</th>
                <th scope="col">Gateway</th>
              </tr>
            </thead>
            <tbody>
              @for (payment of page.items; track payment.id) {
                <tr>
                  <td>
                    <strong>#{{ payment.order_id }}</strong><br />
                    <span class="pf-muted pf-reference">{{ payment.gateway_order_id }}</span>
                  </td>
                  <td>{{ payment.payment_method }}</td>
                  <td class="pf-numeric">{{ payment.amount | inr }}</td>
                  <td>
                    <pf-status [status]="payment.status" />
                    @if (payment.failure_code) {
                      <br /><span class="pf-muted">{{ payment.failure_code }}</span>
                    }
                  </td>
                  <td>
                    {{ payment.paid_at ? (payment.paid_at | date: 'd MMM, h:mm a') : '—' }}
                  </td>
                  <td class="pf-numeric">{{ payment.attempt_count }}</td>
                  <td class="pf-muted">{{ payment.gateway }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="pf-muted">No payments match.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <p class="pf-hint" style="margin-top: 1rem">
        Card numbers and UPI IDs are never stored. Only the gateway reference is kept, for
        reconciliation.
      </p>

      @if (hasPrevious() || hasNext()) {
        <nav class="pf-pager" aria-label="Pagination">
          <button
            type="button"
            class="pf-button pf-button--ghost"
            [disabled]="!hasPrevious()"
            (click)="goToPage(page.offset - pageSize)"
          >
            &larr; Newer
          </button>
          <button
            type="button"
            class="pf-button pf-button--ghost"
            [disabled]="!hasNext()"
            (click)="goToPage(page.offset + pageSize)"
          >
            Older &rarr;
          </button>
        </nav>
      }
    }
  `,
  styles: [
    `
      .pf-reference {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.78rem;
        word-break: break-all;
      }
    `,
  ],
  styleUrl: './admin.scss',
})
export class AdminPaymentsPage implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly result = signal<Page<AdminPayment> | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly offset = signal(0);

  protected status: PaymentStatus | '' = '';

  protected readonly statuses: (PaymentStatus | '')[] = [
    '',
    'CREATED',
    'PENDING',
    'PROCESSING',
    'SUCCESS',
    'FAILED',
    'CANCELLED',
    'EXPIRED',
    'REFUNDED',
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.payments(this.status || undefined, PAGE_SIZE, this.offset()).subscribe({
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

  protected label(status: string): string {
    const text = status.replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
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
