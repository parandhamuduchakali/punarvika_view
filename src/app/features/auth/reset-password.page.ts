import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
  selector: 'pf-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pf-container pf-page">
      <div class="pf-auth">
        <h1>Set a new password</h1>

        @if (!token) {
          <div class="pf-alert pf-alert--error" role="alert">
            This reset link is incomplete. Please request a new one.
          </div>
          <a routerLink="/forgot-password" class="pf-button pf-button--block">
            Request a new link
          </a>
        } @else {
          @if (formError()) {
            <div class="pf-alert pf-alert--error" role="alert">{{ formError() }}</div>
          }

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="pf-field">
              <label class="pf-label" for="password">New password</label>
              <input
                id="password"
                type="password"
                class="pf-input"
                [class.pf-invalid]="error('password', 'Password')"
                formControlName="password"
                autocomplete="new-password"
              />
              @if (error('password', 'Password'); as message) {
                <span class="pf-error-text">{{ message }}</span>
              } @else {
                <span class="pf-hint">
                  At least 8 characters, including a letter and a number.
                </span>
              }
            </div>

            <div class="pf-field">
              <label class="pf-label" for="confirm_password">Confirm new password</label>
              <input
                id="confirm_password"
                type="password"
                class="pf-input"
                [class.pf-invalid]="error('confirm_password', 'Confirmation')"
                formControlName="confirm_password"
                autocomplete="new-password"
              />
              @if (error('confirm_password', 'Confirmation'); as message) {
                <span class="pf-error-text">{{ message }}</span>
              }
            </div>

            <button type="submit" class="pf-button pf-button--block" [disabled]="submitting()">
              {{ submitting() ? 'Saving…' : 'Change password' }}
            </button>
          </form>

          <p class="pf-hint" style="margin-top: 1rem">
            Changing your password signs you out everywhere else.
          </p>
        }
      </div>
    </div>
  `,
  styleUrl: './auth.scss',
})
export class ResetPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);

  /** Read from the link the customer was emailed. */
  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
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
    if (this.form.invalid || !this.token) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);

    this.auth.resetPassword(this.token, this.form.getRawValue().password).subscribe({
      next: () => {
        // Every session was revoked server-side, so the customer signs in fresh.
        this.auth.clearSession();
        this.notifications.success('Your password has been changed. Please sign in.');
        void this.router.navigate(['/login']);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        if (error instanceof AppApiError) {
          const remaining = applyApiErrors(this.form, error);
          this.formError.set(error.hasFieldErrors ? remaining : error.message);
        } else {
          this.formError.set('Could not change your password. Please try again.');
        }
      },
    });
  }
}
