import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CategoryTree, ProductSummary } from '../../core/models/api.models';
import { CatalogService } from '../../core/services/catalog.service';
import { InrPipe } from '../../shared/inr.pipe';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui';

/** The shop front: what the farm sells, and a few products to start with. */
@Component({
  selector: 'pf-home',
  standalone: true,
  imports: [RouterLink, InrPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnInit {
  private readonly catalog = inject(CatalogService);

  protected readonly categories = signal<CategoryTree[]>([]);
  protected readonly featured = signal<ProductSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.catalog.categories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.failed.set(true),
    });

    this.catalog.products({ limit: 8, available_only: true }).subscribe({
      next: (page) => {
        this.featured.set(page.items);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      },
    });
  }
}
