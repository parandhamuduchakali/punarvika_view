/**
 * Contract tests for the thin API services.
 *
 * These carry little logic, so the risk is not a wrong calculation — it is
 * sending the wrong shape, or sending something that must never leave the
 * browser. That is what these pin: the URL, the method, and above all that no
 * price, total or identity ever appears in a request body.
 */
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { CatalogService } from './catalog.service';
import { OrderService } from './order.service';
import { PaymentService } from './payment.service';
import { ProfileService } from './profile.service';
import { ReviewService } from './review.service';

const API = environment.apiBaseUrl;

describe('API services', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  // ---------------------------------------------------------------- catalog
  describe('CatalogService', () => {
    it('omits empty filters rather than sending blanks', () => {
      // `q=''` would filter on the empty string instead of not filtering.
      TestBed.inject(CatalogService)
        .products({ q: '', category: 'dairy', min_price: undefined, limit: 12 })
        .subscribe();

      const request = httpMock.expectOne((r) => r.url === `${API}/products`);
      expect(request.request.params.has('q')).toBe(false);
      expect(request.request.params.has('min_price')).toBe(false);
      expect(request.request.params.get('category')).toBe('dairy');
      expect(request.request.params.get('limit')).toBe('12');
      request.flush({ items: [], total: 0, limit: 12, offset: 0 });
    });

    it('sends prices as strings, never parsed to number', () => {
      TestBed.inject(CatalogService).products({ min_price: '70.00' }).subscribe();

      const request = httpMock.expectOne((r) => r.url === `${API}/products`);
      expect(request.request.params.get('min_price')).toBe('70.00');
      request.flush({ items: [], total: 0, limit: 20, offset: 0 });
    });

    it('fetches a product by slug on its own route', () => {
      TestBed.inject(CatalogService).productBySlug('buffalo-milk').subscribe();

      httpMock.expectOne(`${API}/products/slug/buffalo-milk`).flush({});
    });
  });

  // ----------------------------------------------------------------- orders
  describe('OrderService', () => {
    it('sends only an address, a note and a coupon code', () => {
      // Never a price, a total or a line item -- the server recomputes all of it.
      TestBed.inject(OrderService).place(7, 'Leave at the gate', 'WELCOME10').subscribe();

      const request = httpMock.expectOne(`${API}/orders`);
      expect(request.request.body).toEqual({
        address_id: 7,
        notes: 'Leave at the gate',
        coupon_code: 'WELCOME10',
      });
      request.flush({});
    });

    it('sends nulls rather than omitting optional fields', () => {
      TestBed.inject(OrderService).place(7).subscribe();

      const request = httpMock.expectOne(`${API}/orders`);
      expect(request.request.body).toEqual({
        address_id: 7,
        notes: null,
        coupon_code: null,
      });
      request.flush({});
    });

    it('never puts a user id in an order request', () => {
      // Identity comes from the token; a user_id in the body would be an IDOR
      // attempt waiting to happen.
      TestBed.inject(OrderService).place(7).subscribe();

      const request = httpMock.expectOne(`${API}/orders`);
      expect(Object.keys(request.request.body as object)).not.toContain('user_id');
      request.flush({});
    });
  });

  // --------------------------------------------------------------- payments
  describe('PaymentService', () => {
    it('sends an order id and a method, never an amount', () => {
      TestBed.inject(PaymentService).create(42, 'UPI').subscribe();

      const request = httpMock.expectOne(`${API}/payments/create`);
      expect(request.request.body).toEqual({ order_id: 42, method: 'UPI' });
      expect(Object.keys(request.request.body as object)).not.toContain('amount');
      request.flush({});
    });

    it('passes the gateway signature through untouched', () => {
      TestBed.inject(PaymentService).verify('order_x', 'pay_y', 'sig_z').subscribe();

      const request = httpMock.expectOne(`${API}/payments/verify`);
      expect(request.request.body).toEqual({
        gateway_order_id: 'order_x',
        gateway_payment_id: 'pay_y',
        signature: 'sig_z',
      });
      request.flush({});
    });
  });

  // ---------------------------------------------------------------- reviews
  describe('ReviewService', () => {
    it('unwraps the can-review flag', () => {
      let allowed: boolean | undefined;
      TestBed.inject(ReviewService)
        .canReview(5)
        .subscribe((value) => (allowed = value));

      httpMock.expectOne(`${API}/products/5/reviews/can-review`).flush({ can_review: true });

      expect(allowed).toBe(true);
    });

    it('posts a review against its product', () => {
      TestBed.inject(ReviewService)
        .create(5, { rating: 4, title: 'Good', body: null })
        .subscribe();

      const request = httpMock.expectOne(`${API}/products/5/reviews`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ rating: 4, title: 'Good', body: null });
      request.flush({});
    });

    it('sends the moderation decision to the admin route', () => {
      TestBed.inject(ReviewService).moderate(9, false, 'Abusive').subscribe();

      const request = httpMock.expectOne(`${API}/admin/reviews/9`);
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ approve: false, note: 'Abusive' });
      request.flush({});
    });
  });

  // ---------------------------------------------------------------- profile
  describe('ProfileService', () => {
    it('patches only the fields the API accepts', () => {
      // Email and role are server-side decisions and are not in the payload.
      TestBed.inject(ProfileService)
        .updateProfile({ full_name: 'New Name', phone: null })
        .subscribe();

      const request = httpMock.expectOne(`${API}/profile`);
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ full_name: 'New Name', phone: null });
      request.flush({});
    });

    it('deletes an address by id', () => {
      TestBed.inject(ProfileService).deleteAddress(3).subscribe();

      const request = httpMock.expectOne(`${API}/addresses/3`);
      expect(request.request.method).toBe('DELETE');
      request.flush(null);
    });
  });
});
