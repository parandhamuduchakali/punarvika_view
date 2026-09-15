import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { Review } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { ReviewService } from '../../core/services/review.service';
import { EmptyStateComponent, LoadingComponent } from '../../shared/ui';

/**
 * Reviews for one product.
 *
 * The write form is offered only when the API says this customer may review --
 * they must have taken delivery of the product. That is a UI convenience; the
 * API re-checks the delivered order when the review is posted, so nothing is
 * trusted from here.
 *
 * Review text is interpolated, never bound through `innerHTML`, so Angular's
 * default escaping applies to customer-written content.
 */
@Component({
  selector: 'pf-product-reviews',
  standalone: true,
  imports: [FormsModule, DatePipe, LoadingComponent, EmptyStateComponent],
  templateUrl: './product-reviews.html',
  styleUrl: './product-reviews.scss',
})
export class ProductReviewsComponent implements OnInit {
  readonly productId = input.required<number>();

  private readonly reviews = inject(ReviewService);
  private readonly notifications = inject(NotificationService);
  protected readonly auth = inject(AuthService);

  protected readonly items = signal<Review[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly canReview = signal(false);
  protected readonly submitting = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected rating = 5;
  protected title = '';
  protected body = '';

  protected readonly stars = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);

    this.reviews.forProduct(this.productId()).subscribe({
      next: (page) => {
        this.items.set(page.items);
        this.total.set(page.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    if (this.auth.isAuthenticated()) {
      this.reviews.canReview(this.productId()).subscribe({
        next: (allowed) => this.canReview.set(allowed),
        error: () => this.canReview.set(false),
      });
    }
  }

  protected submit(): void {
    this.formError.set(null);
    this.submitting.set(true);

    this.reviews
      .create(this.productId(), {
        rating: this.rating,
        title: this.title.trim() || null,
        body: this.body.trim() || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.formOpen.set(false);
          this.canReview.set(false);
          this.title = '';
          this.body = '';
          // It will not appear in the list yet -- say so rather than leave the
          // customer wondering where it went.
          this.notifications.success(
            'Thank you. Your review will appear once the farm has checked it.',
          );
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.formError.set(
            error instanceof AppApiError ? error.message : 'Could not save your review.',
          );
        },
      });
  }
}
