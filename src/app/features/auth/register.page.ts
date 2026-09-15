import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  applyApiErrors,
  controlError,
  passwordStrength,
  passwordsMatch,
} from '../../shared/form-errors';

@Component({
  selector: 'pf-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.page.html',
  styleUrl: './auth.scss',
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      full_name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      // Optional, but validated against the backend rule when present.
      phone: ['', [Validators.pattern(/^(?:\+91[\s-]?)?[6-9]\d{9}$/)]],
      password: ['', [Validators.required, passwordStrength]],
      confirm_password: ['', [Validators.required]],
    },
    { validators: passwordsMatch('password', 'confirm_password') },
  );

  protected error(name: string, label: string): string | null {
    return controlError(this.form.get(name), label);
  }

  protected submit(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { full_name, email, phone, password } = this.form.getRawValue();

    this.auth
      .register({ full_name, email, password, phone: phone.trim() || null })
      .subscribe({
        next: () => {
          this.notifications.success('Welcome to Punarvika Farms.');
          void this.router.navigate(['/']);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          if (error instanceof AppApiError) {
            const remaining = applyApiErrors(this.form, error);
            this.formError.set(error.hasFieldErrors ? remaining : error.message);
          } else {
            this.formError.set('Could not create your account. Please try again.');
          }
        },
      });
  }
}
