import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { MyReview } from '../../core/models/api.models';
import { NotificationService } from '../../core/services/notification.service';
import { ReviewService } from '../../core/services/review.service';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingComponent,
} from '../../shared/ui';

/**
 * The customer's own reviews, including ones not yet published.
 *
 * Worth having as a page of its own: a review is held for moderation, so
 * without this a customer who wrote one has no way to see that it exists, let
 * alone edit it.
 */
@Component({
  selector: 'pf-my-reviews',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    LoadingComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './my-reviews.page.html',
  styleUrl: './profile.scss',
})
export class MyReviewsPage implements OnInit {
  private readonly reviews = inject(ReviewService);
  private readonly notifications = inject(NotificationService);

  protected readonly items = signal<MyReview[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly saving = signal(false);
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
    this.failed.set(false);

    this.reviews.mine().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected startEdit(review: MyReview): void {
    this.rating = review.rating;
    this.title = review.title ?? '';
    this.body = review.body ?? '';
    this.formError.set(null);
    this.editingId.set(review.id);
  }

  protected cancel(): void {
    this.editingId.set(null);
    this.formError.set(null);
  }

  protected save(): void {
    const reviewId = this.editingId();
    if (!reviewId) {
      return;
    }
    this.formError.set(null);
    this.saving.set(true);

    this.reviews
      .update(reviewId, {
        rating: this.rating,
        title: this.title.trim() || null,
        body: this.body.trim() || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editingId.set(null);
          // Editing sends it back to the queue, so say so rather than let the
          // customer wonder why it vanished from the product page.
          this.notifications.info('Updated. The farm will check it again before it appears.');
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.formError.set(
            error instanceof AppApiError ? error.message : 'Could not save your review.',
          );
        },
      });
  }

  protected remove(review: MyReview): void {
    this.reviews.remove(review.id).subscribe({
      next: () => {
        this.notifications.info('Review removed.');
        this.load();
      },
      error: () => this.notifications.error('Could not remove that review.'),
    });
  }
}
