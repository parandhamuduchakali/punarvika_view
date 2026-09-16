import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Payment, PaymentMethod, PaymentResult } from '../models/api.models';

/**
 * Payment orchestration.
 *
 * No amount is ever sent: the server charges `order.total_amount`, which it
 * computed itself. The browser only says which order, and whether the customer
 * chose UPI or a card. Gateway secrets stay on the server; the only credential
 * that reaches here is the gateway public key id.
 */
@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/payments`;

  create(orderId: number, method: PaymentMethod): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/create`, { order_id: orderId, method });
  }

  /**
   * Confirms the gateway callback so the customer sees the result immediately.
   * The webhook remains authoritative -- it arrives even if the browser is
   * closed mid-redirect -- so a failure here does not prove the payment failed.
   */
  verify(
    gatewayOrderId: string,
    gatewayPaymentId: string,
    signature: string,
  ): Observable<PaymentResult> {
    return this.http.post<PaymentResult>(`${this.base}/verify`, {
      gateway_order_id: gatewayOrderId,
      gateway_payment_id: gatewayPaymentId,
      signature,
    });
  }

  forOrder(orderId: number): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.base}/order/${orderId}`);
  }

  cancel(paymentId: number): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/${paymentId}/cancel`, {});
  }
}
