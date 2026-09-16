import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  CategoryTree,
  Page,
  ProductDetail,
  ProductQuery,
  ProductSummary,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  categories(): Observable<CategoryTree[]> {
    return this.http.get<CategoryTree[]>(`${this.base}/categories`);
  }

  products(query: ProductQuery = {}): Observable<Page<ProductSummary>> {
    let params = new HttpParams();
    // Only send what was actually set: an empty `q` would filter on "".
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<Page<ProductSummary>>(`${this.base}/products`, { params });
  }

  product(id: number): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.base}/products/${id}`);
  }

  productBySlug(slug: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.base}/products/slug/${slug}`);
  }
}
