import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { CategoryTree, Page, ProductSort, ProductSummary } from '../../core/models/api.models';
import { CatalogService } from '../../core/services/catalog.service';
import { InrPipe } from '../../shared/inr.pipe';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui';

const PAGE_SIZE = 12;

/**
 * Browse, search and filter the shop.
 *
 * Filter state lives in the URL, so a filtered view can be shared, bookmarked
 * and survives Back. The route serves both /products and /categories/:slug.
 */
@Component({
  selector: 'pf-product-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InrPipe,
    LoadingComponent,
    ErrorStateComponent,
    EmptyStateComponent,
  ],
  templateUrl: './product-list.page.html',
  styleUrl: './product-list.page.scss',
})
export class ProductListPage implements OnInit {
  private readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly categories = signal<CategoryTree[]>([]);
  protected readonly result = signal<Page<ProductSummary> | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly offset = signal(0);

  protected readonly filters = this.fb.nonNullable.group({
    q: [''],
    category: [''],
    min_price: [''],
    max_price: [''],
    available_only: [false],
    sort: ['newest' as ProductSort],
  });

  ngOnInit(): void {
    this.catalog.categories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => undefined,
    });

    // The URL is the source of truth, so Back and a shared link both work.
    this.route.paramMap.subscribe(() => this.syncFromUrl());
    this.route.queryParamMap.subscribe(() => this.syncFromUrl());

    // Typing should not fire a request per keystroke.
    this.filters.controls.q.valueChanges
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => this.applyFilters());
  }

  private syncFromUrl(): void {
    const query = this.route.snapshot.queryParamMap;
    // /categories/:slug and /products?category=slug are the same view.
    const slug = this.route.snapshot.paramMap.get('slug') ?? query.get('category') ?? '';

    this.filters.patchValue(
      {
        q: query.get('q') ?? '',
        category: slug,
        min_price: query.get('min_price') ?? '',
        max_price: query.get('max_price') ?? '',
        available_only: query.get('available_only') === 'true',
        sort: (query.get('sort') as ProductSort) ?? 'newest',
      },
      { emitEvent: false },
    );
    this.offset.set(Number(query.get('offset') ?? 0));
    this.load();
  }

  protected applyFilters(): void {
    const value = this.filters.getRawValue();
    const queryParams: Record<string, string | null> = {
      q: value.q || null,
      min_price: value.min_price || null,
      max_price: value.max_price || null,
      available_only: value.available_only ? 'true' : null,
      sort: value.sort === 'newest' ? null : value.sort,
      offset: null,
    };

    // Keep the pretty /categories/:slug URL when that is how we arrived.
    if (this.route.snapshot.paramMap.get('slug')) {
      void this.router.navigate([], { relativeTo: this.route, queryParams });
      return;
    }
    queryParams['category'] = value.category || null;
    void this.router.navigate(['/products'], { queryParams });
  }

  protected clearFilters(): void {
    void this.router.navigate(['/products']);
  }

  protected goToPage(newOffset: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { offset: newOffset || null },
      queryParamsHandling: 'merge',
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    const value = this.filters.getRawValue();

    this.catalog
      .products({
        q: value.q || undefined,
        category: value.category || undefined,
        min_price: value.min_price || undefined,
        max_price: value.max_price || undefined,
        available_only: value.available_only || undefined,
        sort: value.sort,
        limit: PAGE_SIZE,
        offset: this.offset(),
      })
      .subscribe({
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

  // --------------------------------------------------------------- paging
  protected get pageSize(): number {
    return PAGE_SIZE;
  }

  protected hasPrevious(): boolean {
    return this.offset() > 0;
  }

  protected hasNext(): boolean {
    const page = this.result();
    return !!page && page.offset + page.items.length < page.total;
  }

  protected showingFrom(): number {
    const page = this.result();
    return page && page.total > 0 ? page.offset + 1 : 0;
  }

  protected showingTo(): number {
    const page = this.result();
    return page ? page.offset + page.items.length : 0;
  }
}
