import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { controlError } from '../../shared/form-errors';

@Component({
  selector: 'pf-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="pf-container pf-page">
      <div class="pf-auth">
        @if (sent()) {
          <h1>Check your email</h1>
          <div class="pf-alert pf-alert--success" role="status">{{ message() }}</div>
          <p class="pf-muted">
            The link is valid for a short time. If it expires, request another one.
          </p>
          <a routerLink="/login" class="pf-button pf-button--block">Back to sign in</a>
        } @else {
          <h1>Reset your password</h1>
          <p class="pf-muted">
            Enter the email address on your account and we will send you a reset link.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="pf-field">
              <label class="pf-label" for="email">Email address</label>
              <input
                id="email"
                type="email"
                class="pf-input"
                [class.pf-invalid]="error()"
                formControlName="email"
                autocomplete="email"
                inputmode="email"
              />
              @if (error(); as text) {
                <span class="pf-error-text">{{ text }}</span>
              }
            </div>

            <button type="submit" class="pf-button pf-button--block" [disabled]="submitting()">
              {{ submitting() ? 'Sending…' : 'Send reset link' }}
            </button>
          </form>

          <div class="pf-auth__links">
            <a routerLink="/login">Back to sign in</a>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './auth.scss',
})
export class ForgotPasswordPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly message = signal('');

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected error(): string | null {
    return controlError(this.form.get('email'), 'Email');
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);

    this.auth.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (response) => {
        // The API answers identically whether or not the account exists, so the
        // UI must not imply anything either way.
        this.message.set(response.message);
        this.sent.set(true);
        this.submitting.set(false);
      },
      error: () => {
        // Same outcome on failure, for the same reason.
        this.message.set('If that email address has an account, a reset link is on its way.');
        this.sent.set(true);
        this.submitting.set(false);
      },
    });
  }
}
