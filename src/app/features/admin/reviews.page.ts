import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminReview, Page } from '../../core/models/api.models';
import { NotificationService } from '../../core/services/notification.service';
import { ReviewService } from '../../core/services/review.service';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui';

/**
 * Review moderation.
 *
 * Reviews are customer-written and read by every visitor, so nothing is
 * published until the farm has seen it. Each row shows the order that proves
 * the purchase, so a reviewer who never bought the product cannot appear here
 * at all -- the API refuses to create such a review in the first place.
 */
@Component({
  selector: 'pf-admin-reviews',
  standalone: true,
  imports: [FormsModule, DatePipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  template: `
    <div class="pf-admin-head">
      <h2>Reviews awaiting approval</h2>
    </div>

    @if (loading()) {
      <pf-loading label="Loading reviews" />
    } @else if (failed()) {
      <pf-error message="We could not load the review queue." (retry)="load()" />
    } @else if (result(); as page) {
      @if (page.items.length === 0) {
        <pf-empty icon="✅" title="Nothing waiting" message="Every review has been checked." />
      } @else {
        <ul class="pf-moderation-list">
          @for (review of page.items; track review.id) {
            <li class="pf-card pf-moderation">
              <div class="pf-moderation__head">
                <span class="pf-moderation__stars" [attr.aria-label]="review.rating + ' out of 5'">
                  @for (star of stars; track star) {
                    <span aria-hidden="true" [class.pf-star--on]="star <= review.rating">★</span>
                  }
                </span>
                <strong>{{ review.product_name }}</strong>
                <span class="pf-muted">
                  by {{ review.author }} · {{ review.created_at | date: 'd MMM yyyy' }}
                  @if (review.order_id) {
                    · order #{{ review.order_id }}
                  }
                </span>
              </div>

              @if (review.title) {
                <h3 class="pf-moderation__title">{{ review.title }}</h3>
              }
              @if (review.body) {
                <p class="pf-moderation__body">{{ review.body }}</p>
              }

              <div class="pf-moderation__actions">
                <input
                  type="text"
                  class="pf-input pf-moderation__note"
                  [(ngModel)]="notes[review.id]"
                  placeholder="Note (optional, kept internally)"
                  maxlength="255"
                />
                <button
                  type="button"
                  class="pf-button"
                  [disabled]="busyId() === review.id"
                  (click)="moderate(review, true)"
                >
                  Publish
                </button>
                <button
                  type="button"
                  class="pf-button pf-button--danger"
                  [disabled]="busyId() === review.id"
                  (click)="moderate(review, false)"
                >
                  Reject
                </button>
              </div>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: [
    `
      .pf-moderation-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 1rem;
      }
      .pf-moderation__head {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        font-size: 0.9rem;
        margin-bottom: 0.4rem;
      }
      .pf-moderation__stars span {
        color: var(--pf-border);
      }
      .pf-star--on {
        color: #d99b0b;
      }
      .pf-moderation__title {
        margin: 0 0 0.3rem;
        font-size: 1rem;
      }
      .pf-moderation__body {
        margin: 0 0 1rem;
        color: var(--pf-muted);
      }
      .pf-moderation__actions {
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
        align-items: stretch;
        padding-top: 0.85rem;
        border-top: 1px solid var(--pf-border);
      }
      .pf-moderation__note {
        flex: 1 1 14rem;
        min-width: 0;
      }
    `,
  ],
  styleUrl: './admin.scss',
})
export class AdminReviewsPage implements OnInit {
  private readonly reviews = inject(ReviewService);
  private readonly notifications = inject(NotificationService);

  protected readonly result = signal<Page<AdminReview> | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busyId = signal<number | null>(null);

  protected notes: Record<number, string> = {};
  protected readonly stars = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.reviews.pending().subscribe({
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

  protected moderate(review: AdminReview, approve: boolean): void {
    this.busyId.set(review.id);

    this.reviews.moderate(review.id, approve, this.notes[review.id]).subscribe({
      next: () => {
        this.busyId.set(null);
        this.notifications.success(approve ? 'Review published.' : 'Review rejected.');
        this.load();
      },
      error: () => {
        this.busyId.set(null);
        this.notifications.error('Could not update that review.');
      },
    });
  }
}
