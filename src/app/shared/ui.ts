import { Component, input, output } from '@angular/core';

/** A spinner with an accessible label. Used while any page is fetching. */
@Component({
  selector: 'pf-loading',
  standalone: true,
  template: `
    <div class="pf-loading" role="status" [attr.aria-label]="label()">
      <span class="pf-spinner" aria-hidden="true"></span>
      <span class="pf-loading__text">{{ label() }}</span>
    </div>
  `,
  styles: [
    `
      .pf-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        padding: 3rem 1rem;
        color: var(--pf-muted);
      }
      .pf-spinner {
        width: 1.5rem;
        height: 1.5rem;
        border: 2px solid var(--pf-border);
        border-top-color: var(--pf-green);
        border-radius: 50%;
        animation: pf-spin 0.7s linear infinite;
      }
      @keyframes pf-spin {
        to {
          transform: rotate(360deg);
        }
      }
      /* Respect a reduced-motion preference rather than spinning regardless. */
      @media (prefers-reduced-motion: reduce) {
        .pf-spinner {
          animation-duration: 3s;
        }
      }
    `,
  ],
})
export class LoadingComponent {
  readonly label = input('Loading');
}

/** Shown where a list has no rows, with an optional call to action. */
@Component({
  selector: 'pf-empty',
  standalone: true,
  template: `
    <div class="pf-empty">
      <p class="pf-empty__icon" aria-hidden="true">{{ icon() }}</p>
      <h3 class="pf-empty__title">{{ title() }}</h3>
      @if (message()) {
        <p class="pf-empty__message">{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: [
    `
      .pf-empty {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--pf-muted);
      }
      .pf-empty__icon {
        font-size: 2.5rem;
        margin: 0 0 0.5rem;
      }
      .pf-empty__title {
        margin: 0 0 0.35rem;
        color: var(--pf-text);
        font-size: 1.1rem;
      }
      .pf-empty__message {
        margin: 0 0 1rem;
        font-size: 0.925rem;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input('🧺');
  readonly title = input('Nothing here yet');
  readonly message = input<string | null>(null);
}

/** An error with a retry affordance, for a failed fetch. */
@Component({
  selector: 'pf-error',
  standalone: true,
  template: `
    <div class="pf-error" role="alert">
      <p class="pf-error__message">{{ message() }}</p>
      @if (retryable()) {
        <button type="button" class="pf-button pf-button--ghost" (click)="retry.emit()">
          Try again
        </button>
      }
    </div>
  `,
  styles: [
    `
      .pf-error {
        text-align: center;
        padding: 2rem 1rem;
        border: 1px solid var(--pf-danger-border);
        background: var(--pf-danger-bg);
        border-radius: var(--pf-radius);
        color: var(--pf-danger);
      }
      .pf-error__message {
        margin: 0 0 0.75rem;
      }
    `,
  ],
})
export class ErrorStateComponent {
  readonly message = input('Something went wrong.');
  readonly retryable = input(true);
  readonly retry = output<void>();
}

/** Colour-coded status chip for order and payment statuses. */
@Component({
  selector: 'pf-status',
  standalone: true,
  template: `<span class="pf-status" [class]="'pf-status--' + tone()">{{ label() }}</span>`,
  styles: [
    `
      .pf-status {
        display: inline-block;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.775rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      .pf-status--neutral {
        background: var(--pf-surface-2);
        color: var(--pf-muted);
      }
      .pf-status--progress {
        background: #fff4e0;
        color: #96590a;
      }
      .pf-status--good {
        background: #e4f6ea;
        color: #17683a;
      }
      .pf-status--bad {
        background: var(--pf-danger-bg);
        color: var(--pf-danger);
      }
    `,
  ],
})
export class StatusChipComponent {
  readonly status = input.required<string>();

  label(): string {
    // PENDING_PAYMENT -> Pending payment
    const text = this.status().replace(/_/g, ' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  tone(): 'neutral' | 'progress' | 'good' | 'bad' {
    const status = this.status();
    if (['DELIVERED', 'PAID', 'SUCCESS', 'CONFIRMED', 'IN_STOCK'].includes(status)) {
      return 'good';
    }
    if (
      ['CANCELLED', 'FAILED', 'EXPIRED', 'REFUNDED', 'REFUND_PENDING', 'OUT_OF_STOCK'].includes(
        status,
      )
    ) {
      return 'bad';
    }
    if (
      [
        'PENDING_PAYMENT',
        'PAYMENT_PROCESSING',
        'PROCESSING',
        'READY_FOR_DELIVERY',
        'OUT_FOR_DELIVERY',
        'PENDING',
        'CREATED',
        'LOW_STOCK',
      ].includes(status)
    ) {
      return 'progress';
    }
    return 'neutral';
  }
}


/** Read-only star rating. Hidden entirely when nothing has been rated yet. */
@Component({
  selector: 'pf-stars',
  standalone: true,
  template: `
    @if (count() > 0) {
      <span class="pf-stars" [attr.aria-label]="label()">
        <span class="pf-stars__marks" aria-hidden="true">
          @for (star of [1, 2, 3, 4, 5]; track star) {
            <span [class.pf-stars__on]="star <= (average() ?? 0)">★</span>
          }
        </span>
        @if (showCount()) {
          <span class="pf-stars__count">({{ count() }})</span>
        }
      </span>
    }
  `,
  styles: [
    `
      .pf-stars {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.85rem;
      }
      .pf-stars__marks span {
        color: var(--pf-border);
        font-size: 0.95rem;
      }
      .pf-stars__on {
        color: #d99b0b;
      }
      .pf-stars__count {
        color: var(--pf-muted);
      }
    `,
  ],
})
export class StarRatingComponent {
  readonly average = input<number | null>(null);
  readonly count = input(0);
  readonly showCount = input(true);

  label(): string {
    return `Rated ${this.average() ?? 0} out of 5 from ${this.count()} reviews`;
  }
}