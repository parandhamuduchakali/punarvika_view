import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AppApiError } from '../../core/interceptors/error.interceptor';
import { ProductDetail } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { NotificationService } from '../../core/services/notification.service';
import { QuantityPipe } from '../../shared/inr.pipe';
import { ErrorStateComponent, LoadingComponent, StatusChipComponent } from '../../shared/ui';
import { ProductReviewsComponent } from './product-reviews';

@Component({
  selector: 'pf-product-detail',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    QuantityPipe,
    LoadingComponent,
    ErrorStateComponent,
    StatusChipComponent,
    ProductReviewsComponent,
  ],
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
})
export class ProductDetailPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notifications = inject(NotificationService);

  protected readonly product = signal<ProductDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly adding = signal(false);
  protected readonly addError = signal<string | null>(null);
  protected readonly selectedImage = signal<string | null>(null);

  /** Bound to the quantity input. A string, to match the API contract. */
  protected quantity = '1';

  protected readonly canBuy = computed(() => {
    const product = this.product();
    return !!product && product.is_available && product.stock_status !== 'OUT_OF_STOCK';
  });

  protected readonly isSignedIn = this.auth.isAuthenticated;

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (Number.isFinite(id) && id > 0) {
        this.load(id);
      } else {
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  protected load(id = Number(this.route.snapshot.paramMap.get('id'))): void {
    this.loading.set(true);
    this.failed.set(false);

    this.catalog.product(id).subscribe({
      next: (product) => {
        this.product.set(product);
        // Start at the minimum the farm will sell, not a hardcoded 1.
        this.quantity = stripTrailingZeros(product.minimum_order_quantity);
        this.selectedImage.set(product.image_url ?? product.images[0]?.image_url ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }

  protected step(direction: 1 | -1): void {
    const product = this.product();
    if (!product) {
      return;
    }
    const minimum = Number(product.minimum_order_quantity) || 1;
    // Step by the minimum, so a half-litre product steps in halves.
    const current = Number(this.quantity) || minimum;
    let next = current + direction * minimum;

    if (next < minimum) {
      next = minimum;
    }
    const maximum = product.maximum_order_quantity ? Number(product.maximum_order_quantity) : null;
    if (maximum !== null && next > maximum) {
      next = maximum;
    }
    this.quantity = stripTrailingZeros(String(Number(next.toFixed(3))));
  }

  protected addToCart(): void {
    const product = this.product();
    if (!product) {
      return;
    }
    if (!this.isSignedIn()) {
      // Send them to sign in and bring them back to this product.
      void this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/products/${product.id}` },
      });
      return;
    }

    this.addError.set(null);
    this.adding.set(true);

    this.cart.addItem(product.id, this.quantity).subscribe({
      next: () => {
        this.adding.set(false);
        this.notifications.success(`${product.name} added to your basket.`);
      },
      error: (error: unknown) => {
        this.adding.set(false);
        // Quantity and stock rules are the server's; show its wording.
        this.addError.set(
          error instanceof AppApiError
            ? error.message
            : 'Could not add this to your basket. Please try again.',
        );
      },
    });
  }
}

function stripTrailingZeros(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') || '0' : value;
}
