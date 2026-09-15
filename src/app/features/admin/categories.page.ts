import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { AdminCategory } from '../../core/models/api.models';
import { AdminService, CategoryPayload } from '../../core/services/admin.service';
import { NotificationService } from '../../core/services/notification.service';
import { applyApiErrors, controlError } from '../../shared/form-errors';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui';

@Component({
  selector: 'pf-admin-categories',
  standalone: true,
  imports: [ReactiveFormsModule, LoadingComponent, ErrorStateComponent],
  template: `
    <div class="pf-admin-head">
      <h2>Categories</h2>
      @if (editingId() === null) {
        <button type="button" class="pf-button" (click)="startCreate()">Add a category</button>
      }
    </div>

    @if (editingId() !== null) {
      <section class="pf-admin-form">
        <h3>{{ editingId() === 0 ? 'Add a category' : 'Edit category' }}</h3>

        @if (formError()) {
          <div class="pf-alert pf-alert--error" role="alert">{{ formError() }}</div>
        }

        <form [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="pf-form-row">
            <div class="pf-field">
              <label class="pf-label" for="name">Name</label>
              <input
                id="name"
                type="text"
                class="pf-input"
                [class.pf-invalid]="error('name', 'Name')"
                formControlName="name"
              />
              @if (error('name', 'Name'); as message) {
                <span class="pf-error-text">{{ message }}</span>
              }
            </div>

            <div class="pf-field">
              <label class="pf-label" for="parent_id">Parent category</label>
              <select id="parent_id" class="pf-select" formControlName="parent_id">
                <option [value]="0">None (top level)</option>
                @for (category of parentOptions(); track category.id) {
                  <option [value]="category.id">{{ category.name }}</option>
                }
              </select>
              <!-- The API refuses a parent that would create a loop, since that
                   would make category browsing recurse forever. -->
              <span class="pf-hint">A category cannot be its own ancestor.</span>
            </div>
          </div>

          <div class="pf-form-row">
            <div class="pf-field">
              <label class="pf-label" for="display_order">Display order</label>
              <input
                id="display_order"
                type="number"
                class="pf-input"
                formControlName="display_order"
                min="0"
              />
            </div>
            <div class="pf-field pf-check" style="align-self: end; padding-bottom: 1rem">
              <input id="is_active" type="checkbox" formControlName="is_active" />
              <label for="is_active">Show in the shop</label>
            </div>
          </div>

          <div class="pf-field">
            <label class="pf-label" for="description">Description</label>
            <textarea id="description" class="pf-textarea" formControlName="description"></textarea>
          </div>

          <div class="pf-form-actions">
            <button type="submit" class="pf-button" [disabled]="saving()">
              {{ saving() ? 'Saving…' : 'Save category' }}
            </button>
            <button
              type="button"
              class="pf-button pf-button--ghost"
              [disabled]="saving()"
              (click)="cancel()"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    }

    @if (loading()) {
      <pf-loading label="Loading categories" />
    } @else if (failed()) {
      <pf-error message="We could not load the categories." (retry)="load()" />
    } @else {
      <section class="pf-admin-table">
        <div class="pf-table-wrap">
          <table class="pf-table">
            <caption class="pf-sr-only">All categories</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Parent</th>
                <th scope="col" class="pf-numeric">Order</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (category of categories(); track category.id) {
                <tr [class.pf-inactive]="!category.is_active">
                  <td><strong>{{ category.name }}</strong></td>
                  <td class="pf-muted">{{ category.slug }}</td>
                  <td>{{ parentName(category.parent_id) }}</td>
                  <td class="pf-numeric">{{ category.display_order }}</td>
                  <td>{{ category.is_active ? 'Active' : 'Hidden' }}</td>
                  <td>
                    <div class="pf-row-actions">
                      <button type="button" class="pf-link-button" (click)="startEdit(category)">
                        Edit
                      </button>
                      @if (category.is_active) {
                        <button
                          type="button"
                          class="pf-link-button pf-link-button--danger"
                          (click)="retire(category)"
                        >
                          Retire
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="pf-muted">No categories yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `,
  styleUrl: './admin.scss',
})
export class AdminCategoriesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly admin = inject(AdminService);
  private readonly notifications = inject(NotificationService);

  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly editingId = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    parent_id: [0],
    description: ['', [Validators.maxLength(2000)]],
    display_order: [0, [Validators.min(0), Validators.max(9999)]],
    is_active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.admin.categories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
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

  /** A category may not be offered as its own parent. */
  protected parentOptions(): AdminCategory[] {
    const editingId = this.editingId();
    return this.categories().filter((category) => category.id !== editingId);
  }

  protected parentName(parentId: number | null): string {
    if (parentId === null) {
      return '—';
    }
    return this.categories().find((category) => category.id === parentId)?.name ?? '—';
  }

  protected startCreate(): void {
    this.form.reset({ parent_id: 0, display_order: 0, is_active: true });
    this.formError.set(null);
    this.editingId.set(0);
  }

  protected startEdit(category: AdminCategory): void {
    this.form.reset({
      name: category.name,
      parent_id: category.parent_id ?? 0,
      description: category.description ?? '',
      display_order: category.display_order,
      is_active: category.is_active,
    });
    this.formError.set(null);
    this.editingId.set(category.id);
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
    const payload: CategoryPayload = {
      name: value.name,
      // 0 is the "top level" option in the select, not a real id.
      parent_id: Number(value.parent_id) || null,
      description: value.description.trim() || null,
      display_order: Number(value.display_order),
      is_active: value.is_active,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request =
      editingId && editingId > 0
        ? this.admin.updateCategory(editingId, payload)
        : this.admin.createCategory(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editingId.set(null);
        this.notifications.success('Category saved.');
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof AppApiError) {
          const remaining = applyApiErrors(this.form, error);
          this.formError.set(error.hasFieldErrors ? remaining : error.message);
        } else {
          this.formError.set('Could not save that category.');
        }
      },
    });
  }

  protected retire(category: AdminCategory): void {
    // The API deactivates rather than deletes when products reference it.
    this.admin.deleteCategory(category.id).subscribe({
      next: (response) => {
        this.notifications.info(response.message);
        this.load();
      },
      error: (error: unknown) => {
        this.notifications.error(
          error instanceof AppApiError ? error.message : 'Could not retire that category.',
        );
      },
    });
  }
}
