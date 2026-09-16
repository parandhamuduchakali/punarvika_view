import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { AdminCustomer, Page } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui';

const PAGE_SIZE = 20;

@Component({
  selector: 'pf-admin-customers',
  standalone: true,
  imports: [DatePipe, LoadingComponent, ErrorStateComponent],
  template: `
    <div class="pf-admin-head">
      <h2>Customers</h2>
    </div>

    @if (loading()) {
      <pf-loading label="Loading customers" />
    } @else if (failed()) {
      <pf-error message="We could not load the customers." (retry)="load()" />
    } @else if (result(); as page) {
      <section class="pf-admin-table">
        <div class="pf-table-wrap">
          <table class="pf-table">
            <caption class="pf-sr-only">Everyone with an account</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col">Role</th>
                <th scope="col">Joined</th>
                <th scope="col">Last signed in</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (customer of page.items; track customer.id) {
                <tr [class.pf-inactive]="!customer.is_active">
                  <td><strong>{{ customer.full_name }}</strong></td>
                  <td class="pf-muted">{{ customer.email }}</td>
                  <td class="pf-muted">{{ customer.phone || '—' }}</td>
                  <td>{{ customer.role === 'ADMIN' ? 'Farm admin' : 'Customer' }}</td>
                  <td>{{ customer.created_at | date: 'd MMM yyyy' }}</td>
                  <td>
                    {{
                      customer.last_login_at
                        ? (customer.last_login_at | date: 'd MMM yyyy')
                        : 'Never'
                    }}
                  </td>
                  <td>{{ customer.is_active ? 'Active' : 'Deactivated' }}</td>
                  <td>
                    <button
                      type="button"
                      class="pf-link-button"
                      [class.pf-link-button--danger]="customer.is_active"
                      [disabled]="busyId() === customer.id"
                      (click)="toggle(customer)"
                    >
                      {{ customer.is_active ? 'Deactivate' : 'Reactivate' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="pf-muted">No customers yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <p class="pf-hint" style="margin-top: 1rem">
        A deactivated customer cannot sign in and their existing sessions stop working.
        Their orders are kept.
      </p>

      @if (hasPrevious() || hasNext()) {
        <nav class="pf-pager" aria-label="Pagination">
          <button
            type="button"
            class="pf-button pf-button--ghost"
            [disabled]="!hasPrevious()"
            (click)="goToPage(page.offset - pageSize)"
          >
            &larr; Previous
          </button>
          <button
            type="button"
            class="pf-button pf-button--ghost"
            [disabled]="!hasNext()"
            (click)="goToPage(page.offset + pageSize)"
          >
            Next &rarr;
          </button>
        </nav>
      }
    }
  `,
  styleUrl: './admin.scss',
})
export class AdminCustomersPage implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly notifications = inject(NotificationService);

  protected readonly result = signal<Page<AdminCustomer> | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly offset = signal(0);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.customers(PAGE_SIZE, this.offset()).subscribe({
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

  protected toggle(customer: AdminCustomer): void {
    this.busyId.set(customer.id);

    this.admin.setCustomerStatus(customer.id, !customer.is_active).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        // The API refuses an admin deactivating their own account; show why.
        this.notifications.error(
          error instanceof AppApiError ? error.message : 'Could not change that account.',
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
