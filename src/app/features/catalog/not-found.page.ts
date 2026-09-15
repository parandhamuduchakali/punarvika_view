import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'pf-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="pf-container pf-page pf-not-found">
      <p class="pf-not-found__icon" aria-hidden="true">🌾</p>
      <h1>We could not find that page</h1>
      <p class="pf-muted">
        The page may have moved, or the product may no longer be sold on the farm.
      </p>
      <div class="pf-not-found__actions">
        <a routerLink="/" class="pf-button">Back to the shop</a>
        <a routerLink="/products" class="pf-button pf-button--ghost">Browse products</a>
      </div>
    </div>
  `,
  styles: [
    `
      .pf-not-found {
        text-align: center;
        max-width: 42rem;
      }
      .pf-not-found__icon {
        font-size: 3rem;
        margin: 2rem 0 0.5rem;
      }
      .pf-not-found__actions {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 1.5rem;
      }
    `,
  ],
})
export class NotFoundPage {}
