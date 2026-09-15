import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Cart } from '../models/api.models';

/**
 * The cart, as the server sees it.
 *
 * Every mutation returns the whole recalculated cart, and that response replaces
 * local state wholesale. Nothing is computed here: quantities, line totals and
 * the basket total all come from the API, so the figure on screen is always the
 * figure the server would charge.
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/cart`;

  private readonly _cart = signal<Cart | null>(null);
  readonly cart = this._cart.asReadonly();

  readonly itemCount = computed(() => this._cart()?.item_count ?? 0);
  readonly total = computed(() => this._cart()?.pricing.total_amount ?? '0.00');
  readonly hasIssues = computed(() => this._cart()?.has_issues ?? false);

  load(): Observable<Cart> {
    return this.http.get<Cart>(this.base).pipe(tap((cart) => this._cart.set(cart)));
  }

  addItem(productId: number, quantity: string): Observable<Cart> {
    return this.http
      .post<Cart>(`${this.base}/items`, { product_id: productId, quantity })
      .pipe(tap((cart) => this._cart.set(cart)));
  }

  updateItem(itemId: number, quantity: string): Observable<Cart> {
    return this.http
      .patch<Cart>(`${this.base}/items/${itemId}`, { quantity })
      .pipe(tap((cart) => this._cart.set(cart)));
  }

  removeItem(itemId: number): Observable<Cart> {
    return this.http
      .delete<Cart>(`${this.base}/items/${itemId}`)
      .pipe(tap((cart) => this._cart.set(cart)));
  }

  clear(): Observable<Cart> {
    return this.http.delete<Cart>(this.base).pipe(tap((cart) => this._cart.set(cart)));
  }

  /** After checkout or sign-out, when the server-side cart no longer applies. */
  reset(): void {
    this._cart.set(null);
  }
}
