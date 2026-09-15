import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { Address, AddressPayload } from '../../core/models/api.models';
import { NotificationService } from '../../core/services/notification.service';
import { ProfileService } from '../../core/services/profile.service';
import { applyApiErrors, controlError } from '../../shared/form-errors';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingComponent,
} from '../../shared/ui';

@Component({
  selector: 'pf-addresses',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LoadingComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './addresses.page.html',
  styleUrl: './profile.scss',
})
export class AddressesPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profile = inject(ProfileService);
  private readonly notifications = inject(NotificationService);

  protected readonly addresses = signal<Address[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  /** null = form closed, 0 = adding, >0 = editing that address. */
  protected readonly editingId = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    contact_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    contact_phone: ['', [Validators.required, Validators.pattern(/^(?:\+91[\s-]?)?[6-9]\d{9}$/)]],
    line1: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(255)]],
    line2: ['', [Validators.maxLength(255)]],
    landmark: ['', [Validators.maxLength(255)]],
    city: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    state: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    pincode: ['', [Validators.required, Validators.pattern(/^[1-9]\d{5}$/)]],
    is_default: [false],
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.profile.addresses().subscribe({
      next: (addresses) => {
        this.addresses.set(addresses);
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

  protected startAdd(): void {
    this.form.reset({ is_default: this.addresses().length === 0 });
    this.formError.set(null);
    this.editingId.set(0);
  }

  protected startEdit(address: Address): void {
    this.form.reset({
      contact_name: address.contact_name,
      contact_phone: address.contact_phone,
      line1: address.line1,
      line2: address.line2 ?? '',
      landmark: address.landmark ?? '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      is_default: address.is_default,
    });
    this.formError.set(null);
    this.editingId.set(address.id);
  }

  protected cancelEdit(): void {
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
    const payload: AddressPayload = {
      contact_name: value.contact_name,
      contact_phone: value.contact_phone,
      line1: value.line1,
      // Blank optional fields are sent as null, not "".
      line2: value.line2.trim() || null,
      landmark: value.landmark.trim() || null,
      city: value.city,
      state: value.state,
      pincode: value.pincode,
      is_default: value.is_default,
    };

    this.saving.set(true);
    const editingId = this.editingId();
    const request =
      editingId && editingId > 0
        ? this.profile.updateAddress(editingId, payload)
        : this.profile.createAddress(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editingId.set(null);
        this.notifications.success('Address saved.');
        // Reload rather than patching locally: the server decides which address
        // is default, and saving one may demote another.
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        if (error instanceof AppApiError) {
          const remaining = applyApiErrors(this.form, error);
          this.formError.set(error.hasFieldErrors ? remaining : error.message);
        } else {
          this.formError.set('Could not save that address.');
        }
      },
    });
  }

  protected makeDefault(address: Address): void {
    this.profile.setDefaultAddress(address.id).subscribe({
      next: () => this.load(),
      error: () => this.notifications.error('Could not set the default address.'),
    });
  }

  protected remove(address: Address): void {
    this.profile.deleteAddress(address.id).subscribe({
      next: () => {
        this.notifications.info('Address removed.');
        this.load();
      },
      error: (error: unknown) => {
        this.notifications.error(
          error instanceof AppApiError ? error.message : 'Could not remove that address.',
        );
      },
    });
  }
}
