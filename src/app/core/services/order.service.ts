import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { OrderDetail, OrderStatus, OrderSummary, Page } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/orders`;

  /**
   * Places the order. The request carries an address id and an optional note --
   * never a price or a total. The server recomputes everything from the cart.
   */
  place(addressId: number, notes?: string | null): Observable<OrderDetail> {
    return this.http.post<OrderDetail>(this.base, {
      address_id: addressId,
      notes: notes ?? null,
    });
  }

  list(status?: OrderStatus, limit = 20, offset = 0): Observable<Page<OrderSummary>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Page<OrderSummary>>(this.base, { params });
  }

  get(orderId: number): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(`${this.base}/${orderId}`);
  }

  cancel(orderId: number, reason?: string): Observable<OrderDetail> {
    return this.http.post<OrderDetail>(`${this.base}/${orderId}/cancel`, {
      reason: reason ?? null,
    });
  }
}
