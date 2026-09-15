import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { AdminCategory, AdminProduct, Page, ProductUnit } from '../../core/models/api.models';
import { AdminService, ProductPayload } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { applyApiErrors, controlError } from '../../shared/form-errors';
import { InrPipe } from '../../shared/inr.pipe';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui';

const PAGE_SIZE = 20;

@Component({
  selector: 'pf-admin-products',
  standalone: true,
  imports: [ReactiveFormsModule, InrPipe, LoadingComponent, ErrorStateComponent],
  templateUrl: './products.page.html',
  styleUrl: './admin.scss',
})
export class AdminProductsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly notifications = inject(NotificationService);

  protected readonly result = signal<Page<AdminProduct> | null>(null);
  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** null = closed, 0 = creating, >0 = editing that product. */
  protected readonly editingId = signal<number | null>(null);
  protected readonly offset = signal(0);

  protected readonly units: ProductUnit[] = ['LITRE', 'KG', 'GRAM', 'PIECE', 'DOZEN', 'PACKET'];

  protected readonly form = this.fb.nonNullable.group({
    category_id: [0, [Validators.required, Validators.min(1)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    short_description: ['', [Validators.maxLength(300)]],
    description: ['', [Validators.maxLength(5000)]],
    // A price is a string all the way to the API, so no float ever touches it.
    price: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    unit: ['LITRE' as ProductUnit, [Validators.required]],
    minimum_order_quantity: ['1', [Validators.pattern(/^\d+(\.\d{1,3})?$/)]],
    maximum_order_quantity: ['', [Validators.pattern(/^\d+(\.\d{1,3})?$/)]],
    image_url: ['', [Validators.maxLength(500)]],
    is_available: [true],
    is_active: [true],
  });

  ngOnInit(): void {
    this.admin.categories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => undefined,
    });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.products(undefined, PAGE_SIZE, this.offset()).subscribe({
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
      category_id: this.categories()[0]?.id ?? 0,
      unit: 'LITRE',
      minimum_order_quantity: '1',
      is_available: true,
      is_active: true,
    });
    this.formError.set(null);
    this.editingId.set(0);
  }

  protected startEdit(product: AdminProduct): void {
    this.form.reset({
      category_id: product.category_id,
      name: product.name,
      short_description: product.short_description ?? '',
      description: product.description ?? '',
      price: product.price,
      unit: product.unit,
      minimum_order_quantity: product.minimum_order_quantity,
      maximum_order_quantity: product.maximum_order_quantity ?? '',
      image_url: product.image_url ?? '',
      is_available: product.is_available,
      is_active: product.is_active,
    });
    this.formError.set(null);
    this.editingId.set(product.id);
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
    const payload: ProductPayload = {
      category_id: Number(value.category_id),
      name: value.name,
      short_description: value.short_description.trim() || null,
      description: value.description.trim() || null,
      price: value.price,
      unit: value.unit,
      minimum_order_quantity: value.minimum_order_quantity || '1',
      maximum_order_quantity: value.maximum_order_quantity.trim() || null,
      image_url: value.image_url.trim() || null,
      is_available: value.is_available,
      is_active: value.is_active,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request =
      editingId && editingId > 0
        ? this.admin.updateProduct(editingId, payload)
        : this.admin.createProduct(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editingId.set(null);
        this.notifications.success('Product saved.');
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof AppApiError) {
          const remaining = applyApiErrors(this.form, error);
          this.formError.set(error.hasFieldErrors ? remaining : error.message);
        } else {
          this.formError.set('Could not save that product.');
        }
      },
    });
  }

  protected withdraw(product: AdminProduct): void {
    // Not a delete: order items reference products, so the API withdraws it
    // from sale and keeps the row.
    this.admin.withdrawProduct(product.id).subscribe({
      next: () => {
        this.notifications.info(`${product.name} withdrawn from sale.`);
        this.load();
      },
      error: () => this.notifications.error('Could not withdraw that product.'),
    });
  }

  protected categoryName(id: number): string {
    return this.categories().find((category) => category.id === id)?.name ?? '—';
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
