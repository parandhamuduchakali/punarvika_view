import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { applyApiErrors, controlError } from '../../shared/form-errors';

@Component({
  selector: 'pf-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html',
  styleUrl: './auth.scss',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

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
    const { email, password } = this.form.getRawValue();

    this.auth.login({ email, password }).subscribe({
      next: () => {
        // Pick up whatever is already in this customer's basket.
        this.cart.load().subscribe({ error: () => undefined });
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        // Only ever a path on this site: an absolute URL here would be an open
        // redirect, letting a crafted link bounce a signed-in customer to a
        // lookalike page.
        const safe = returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')
          ? returnUrl
          : '/';
        void this.router.navigateByUrl(safe);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        if (error instanceof AppApiError) {
          this.formError.set(applyApiErrors(this.form, error));
          if (!error.hasFieldErrors) {
            this.formError.set(error.message);
          }
        } else {
          this.formError.set('Could not sign you in. Please try again.');
        }
      },
    });
  }
}
