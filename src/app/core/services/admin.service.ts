import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AdminCategory,
  AdminCoupon,
  AdminProductImage,
  AdminCustomer,
  AdminPayment,
  AdminProduct,
  DiscountType,
  Inventory,
  LowStockItem,
  MessageResponse,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Page,
  PaymentStatus,
  AuditEntry,
  ProductImagePayload,
  ProductUnit,
  SalesReport,
} from '../models/api.models';

export interface CategoryPayload {
  name: string;
  slug?: string | null;
  parent_id?: number | null;
  description?: string | null;
  image_url?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface CouponPayload {
  code: string;
  description?: string | null;
  discount_type: DiscountType;
  /** Percent (1-100) or a rupee amount, per discount_type. A string, like all money. */
  value: string;
  max_discount_amount?: string | null;
  minimum_order_value?: string;
  /** 0 means unlimited, for both. */
  usage_limit?: number;
  per_customer_limit?: number;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active?: boolean;
}

export interface ProductPayload {
  category_id: number;
  name: string;
  slug?: string | null;
  sku?: string | null;
  description?: string | null;
  short_description?: string | null;
  price: string;
  unit: ProductUnit;
  minimum_order_quantity?: string;
  maximum_order_quantity?: string | null;
  image_url?: string | null;
  is_available?: boolean;
  is_active?: boolean;
}

/**
 * Farm administration.
 *
 * Every call here is refused by the API for a non-admin. The admin guard only
 * decides what is rendered; it is not what keeps these endpoints closed.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin`;

  // ------------------------------------------------------------ categories
  categories(): Observable<AdminCategory[]> {
    return this.http.get<AdminCategory[]>(`${this.base}/categories`);
  }

  createCategory(payload: CategoryPayload): Observable<AdminCategory> {
    return this.http.post<AdminCategory>(`${this.base}/categories`, payload);
  }

  updateCategory(id: number, payload: CategoryPayload): Observable<AdminCategory> {
    return this.http.put<AdminCategory>(`${this.base}/categories/${id}`, payload);
  }

  deleteCategory(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.base}/categories/${id}`);
  }

  // -------------------------------------------------------------- products
  products(q?: string, limit = 20, offset = 0): Observable<Page<AdminProduct>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (q) {
      params = params.set('q', q);
    }
    return this.http.get<Page<AdminProduct>>(`${this.base}/products`, { params });
  }

  product(id: number): Observable<AdminProduct> {
    return this.http.get<AdminProduct>(`${this.base}/products/${id}`);
  }

  createProduct(payload: ProductPayload): Observable<AdminProduct> {
    return this.http.post<AdminProduct>(`${this.base}/products`, payload);
  }

  updateProduct(id: number, payload: ProductPayload): Observable<AdminProduct> {
    return this.http.put<AdminProduct>(`${this.base}/products/${id}`, payload);
  }

  withdrawProduct(id: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(`${this.base}/products/${id}`);
  }

  // -------------------------------------------------------- product images
  productImages(productId: number): Observable<AdminProductImage[]> {
    return this.http.get<AdminProductImage[]>(`${this.base}/products/${productId}/images`);
  }

  addProductImage(
    productId: number,
    payload: ProductImagePayload,
  ): Observable<AdminProductImage> {
    return this.http.post<AdminProductImage>(
      `${this.base}/products/${productId}/images`,
      payload,
    );
  }

  setPrimaryImage(productId: number, imageId: number): Observable<AdminProductImage> {
    return this.http.post<AdminProductImage>(
      `${this.base}/products/${productId}/images/${imageId}/primary`,
      {},
    );
  }

  deleteProductImage(productId: number, imageId: number): Observable<MessageResponse> {
    return this.http.delete<MessageResponse>(
      `${this.base}/products/${productId}/images/${imageId}`,
    );
  }

  // ------------------------------------------------------------- audit log
  /** Read-only. There is deliberately no endpoint that edits or deletes an entry. */
  auditLog(
    filters: { entity_type?: string; entity_id?: string; action?: string } = {},
    limit = 50,
    offset = 0,
  ): Observable<Page<AuditEntry>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params = params.set(key, value);
      }
    }
    return this.http.get<Page<AuditEntry>>(`${this.base}/audit-log`, { params });
  }

  // ------------------------------------------------------------- inventory
  inventory(productId: number): Observable<Inventory> {
    return this.http.get<Inventory>(`${this.base}/inventory/${productId}`);
  }

  /** Send either an absolute quantity or a delta, never both. */
  adjustInventory(
    productId: number,
    payload: {
      stock_quantity?: string;
      delta?: string;
      low_stock_threshold?: string;
      reason?: string;
    },
  ): Observable<Inventory> {
    return this.http.patch<Inventory>(`${this.base}/inventory/${productId}`, payload);
  }

  lowStock(): Observable<LowStockItem[]> {
    return this.http.get<LowStockItem[]>(`${this.base}/inventory`);
  }

  // ---------------------------------------------------------------- orders
  orders(
    status?: OrderStatus,
    userId?: number,
    limit = 20,
    offset = 0,
  ): Observable<Page<OrderSummary>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (status) {
      params = params.set('status', status);
    }
    if (userId) {
      params = params.set('user_id', userId);
    }
    return this.http.get<Page<OrderSummary>>(`${this.base}/orders`, { params });
  }

  order(id: number): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(`${this.base}/orders/${id}`);
  }

  /** Rejected by the API if the transition is not legal for the current status. */
  setOrderStatus(id: number, status: OrderStatus, reason?: string): Observable<OrderDetail> {
    return this.http.patch<OrderDetail>(`${this.base}/orders/${id}/status`, {
      status,
      reason: reason ?? null,
    });
  }

  // ------------------------------------------------------------- customers
  customers(limit = 20, offset = 0): Observable<Page<AdminCustomer>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<Page<AdminCustomer>>(`${this.base}/customers`, { params });
  }

  customer(id: number): Observable<AdminCustomer> {
    return this.http.get<AdminCustomer>(`${this.base}/customers/${id}`);
  }

  setCustomerStatus(id: number, isActive: boolean, reason?: string): Observable<AdminCustomer> {
    return this.http.patch<AdminCustomer>(`${this.base}/customers/${id}/status`, {
      is_active: isActive,
      reason: reason ?? null,
    });
  }

  // -------------------------------------------------------------- payments
  payments(status?: PaymentStatus, limit = 20, offset = 0): Observable<Page<AdminPayment>> {
    let params = new HttpParams().set('limit', limit).set('offset', offset);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<Page<AdminPayment>>(`${this.base}/payments`, { params });
  }

  // --------------------------------------------------------------- coupons
  coupons(limit = 50, offset = 0): Observable<Page<AdminCoupon>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<Page<AdminCoupon>>(`${this.base}/coupons`, { params });
  }

  createCoupon(payload: CouponPayload): Observable<AdminCoupon> {
    return this.http.post<AdminCoupon>(`${this.base}/coupons`, payload);
  }

  /** The API refuses to change the terms of a coupon that has been redeemed. */
  updateCoupon(id: number, payload: CouponPayload): Observable<AdminCoupon> {
    return this.http.put<AdminCoupon>(`${this.base}/coupons/${id}`, payload);
  }

  deactivateCoupon(id: number): Observable<AdminCoupon> {
    return this.http.delete<AdminCoupon>(`${this.base}/coupons/${id}`);
  }

  // --------------------------------------------------------------- reports
  salesReport(): Observable<SalesReport> {
    return this.http.get<SalesReport>(`${this.base}/reports/sales`);
  }
}
