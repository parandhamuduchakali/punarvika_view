import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { User } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { NotificationService } from '../../core/services/notification.service';
import { ProfileService } from '../../core/services/profile.service';
import {
  applyApiErrors,
  controlError,
  passwordStrength,
  passwordsMatch,
} from '../../shared/form-errors';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui';

@Component({
  selector: 'pf-profile',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, LoadingComponent, ErrorStateComponent],
  templateUrl: './profile.page.html',
  styleUrl: './profile.scss',
})
export class ProfilePage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly user = signal<User | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly signingOutEverywhere = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);

  protected readonly profileForm = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    phone: ['', [Validators.pattern(/^(?:\+91[\s-]?)?[6-9]\d{9}$/)]],
  });

  protected readonly passwordForm = this.fb.nonNullable.group(
    {
      current_password: ['', [Validators.required]],
      password: ['', [Validators.required, passwordStrength]],
      confirm_password: ['', [Validators.required]],
    },
    { validators: passwordsMatch('password', 'confirm_password') },
  );

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.profile.profile().subscribe({
      next: (user) => {
        this.user.set(user);
        this.profileForm.patchValue({ full_name: user.full_name, phone: user.phone ?? '' });
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected profileFieldError(name: string, label: string): string | null {
    return controlError(this.profileForm.get(name), label);
  }

  protected passwordFieldError(name: string, label: string): string | null {
    return controlError(this.passwordForm.get(name), label);
  }

  protected saveProfile(): void {
    this.profileError.set(null);
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.savingProfile.set(true);
    const { full_name, phone } = this.profileForm.getRawValue();

    this.profile.updateProfile({ full_name, phone: phone.trim() || null }).subscribe({
      next: (user) => {
        this.user.set(user);
        this.savingProfile.set(false);
        this.notifications.success('Your details have been saved.');
      },
      error: (error: unknown) => {
        this.savingProfile.set(false);
        if (error instanceof AppApiError) {
          const remaining = applyApiErrors(this.profileForm, error);
          this.profileError.set(error.hasFieldErrors ? remaining : error.message);
        } else {
          this.profileError.set('Could not save your details.');
        }
      },
    });
  }

  /**
   * For a customer who thinks someone else has their password: it kills every
   * refresh token, so any other browser is signed out at its next refresh.
   */
  protected signOutEverywhere(): void {
    this.signingOutEverywhere.set(true);

    this.auth.logoutEverywhere().subscribe({
      next: (response) => {
        this.signingOutEverywhere.set(false);
        this.auth.clearSession();
        this.cart.reset();
        this.notifications.success(response.message);
        void this.router.navigate(['/login']);
      },
      error: () => {
        this.signingOutEverywhere.set(false);
        this.notifications.error('Could not sign you out everywhere.');
      },
    });
  }

  protected changePassword(): void {
    this.passwordError.set(null);
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.savingPassword.set(true);
    const { current_password, password } = this.passwordForm.getRawValue();

    this.auth.changePassword(current_password, password).subscribe({
      next: () => {
        this.savingPassword.set(false);
        // The API revokes every session, so this browser is signed out too.
        this.auth.clearSession();
        this.cart.reset();
        this.notifications.success('Your password has been changed. Please sign in again.');
        void this.router.navigate(['/login']);
      },
      error: (error: unknown) => {
        this.savingPassword.set(false);
        if (error instanceof AppApiError) {
          const remaining = applyApiErrors(this.passwordForm, error);
          this.passwordError.set(error.hasFieldErrors ? remaining : error.message);
        } else {
          this.passwordError.set('Could not change your password.');
        }
      },
    });
  }
}
