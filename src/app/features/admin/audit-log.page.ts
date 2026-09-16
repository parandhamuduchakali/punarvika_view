import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AuditEntry, Page } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui';

const PAGE_SIZE = 50;

/**
 * The audit trail, read-only.
 *
 * This is the page that answers "who changed this price" and "who moved that
 * order" without opening a database client. There is deliberately no way to
 * edit or delete an entry from here — or from the API — because a trail an
 * administrator can rewrite proves nothing.
 */
@Component({
  selector: 'pf-admin-audit-log',
  standalone: true,
  imports: [FormsModule, DatePipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './audit-log.page.html',
  styleUrl: './admin.scss',
})
export class AdminAuditLogPage implements OnInit {
  private readonly admin = inject(AdminService);

  protected readonly result = signal<Page<AuditEntry> | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly offset = signal(0);

  protected entityType = '';
  protected action = '';

  /** The entity types the trail actually records. */
  protected readonly entityTypes = [
    '',
    'Order',
    'Payment',
    'Product',
    'ProductImage',
    'ProductCategory',
    'ProductInventory',
    'Coupon',
    'User',
  ];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin
      .auditLog(
        { entity_type: this.entityType || undefined, action: this.action || undefined },
        PAGE_SIZE,
        this.offset(),
      )
      .subscribe({
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

  /** Render the JSON blobs compactly; they are small by design. */
  protected summarise(values: Record<string, unknown> | null): string {
    if (!values || Object.keys(values).length === 0) {
      return '—';
    }
    return Object.entries(values)
      .map(([key, value]) => `${key}: ${value ?? '—'}`)
      .join(', ');
  }

  protected label(action: string): string {
    const text = action.replace(/_/g, ' ');
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
