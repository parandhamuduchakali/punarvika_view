import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { AdminCoupon, DiscountType, Page } from '../../core/models/api.models';
import { AdminService, CouponPayload } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { applyApiErrors, controlError } from '../../shared/form-errors';
import { InrPipe } from '../../shared/inr.pipe';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui';

/**
 * Coupon management.
 *
 * A coupon is a rule, not an amount. What it is worth against a given basket is
 * decided by the server at checkout, so nothing here can set a discount figure
 * directly.
 */
@Component({
  selector: 'pf-admin-coupons',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, InrPipe, LoadingComponent, ErrorStateComponent],
  templateUrl: './coupons.page.html',
  styleUrl: './admin.scss',
})
export class AdminCouponsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly notifications = inject(NotificationService);

  protected readonly result = signal<Page<AdminCoupon> | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** null = closed, 0 = creating, >0 = editing that coupon. */
  protected readonly editingId = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]{3,40}$/)]],
    description: ['', [Validators.maxLength(255)]],
    discount_type: ['PERCENT' as DiscountType, [Validators.required]],
    value: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    max_discount_amount: ['', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    minimum_order_value: ['0.00', [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    usage_limit: [0, [Validators.min(0)]],
    per_customer_limit: [1, [Validators.min(0)]],
    valid_until: [''],
    is_active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.coupons().subscribe({
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

  protected error(name: string, label: string): string | null {
    return controlError(this.form.get(name), label);
  }

  protected startCreate(): void {
    this.form.reset({
      discount_type: 'PERCENT',
      minimum_order_value: '0.00',
      usage_limit: 0,
      per_customer_limit: 1,
      is_active: true,
    });
    this.formError.set(null);
    this.editingId.set(0);
  }

  protected startEdit(coupon: AdminCoupon): void {
    this.form.reset({
      code: coupon.code,
      description: coupon.description ?? '',
      discount_type: coupon.discount_type,
      value: coupon.value,
      max_discount_amount: coupon.max_discount_amount ?? '',
      minimum_order_value: coupon.minimum_order_value,
      usage_limit: coupon.usage_limit,
      per_customer_limit: coupon.per_customer_limit,
      valid_until: coupon.valid_until ? coupon.valid_until.slice(0, 10) : '',
      is_active: coupon.is_active,
    });
    this.formError.set(null);
    this.editingId.set(coupon.id);
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.formError.set(null);
  }

  protected save(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload: CouponPayload = {
      code: value.code,
      description: value.description.trim() || null,
      discount_type: value.discount_type,
      value: value.value,
      max_discount_amount: value.max_discount_amount.trim() || null,
      minimum_order_value: value.minimum_order_value || '0.00',
      usage_limit: Number(value.usage_limit),
      per_customer_limit: Number(value.per_customer_limit),
      // A date input gives yyyy-MM-dd; make it end-of-day so the coupon is
      // usable throughout its final day rather than expiring at midnight.
      valid_until: value.valid_until ? `${value.valid_until}T23:59:59` : null,
      is_active: value.is_active,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request =
      editingId && editingId > 0
        ? this.admin.updateCoupon(editingId, payload)
        : this.admin.createCoupon(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editingId.set(null);
        this.notifications.success('Coupon saved.');
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof AppApiError) {
          const remaining = applyApiErrors(this.form, error);
          // The API refuses to change the terms of a coupon that has been used.
          this.formError.set(error.hasFieldErrors ? remaining : error.message);
        } else {
          this.formError.set('Could not save that coupon.');
        }
      },
    });
  }

  protected deactivate(coupon: AdminCoupon): void {
    this.admin.deactivateCoupon(coupon.id).subscribe({
      next: () => {
        this.notifications.info(`${coupon.code} deactivated.`);
        this.load();
      },
      error: () => this.notifications.error('Could not deactivate that coupon.'),
    });
  }
}
