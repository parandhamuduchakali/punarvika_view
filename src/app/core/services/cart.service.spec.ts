import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { Cart } from '../models/api.models';
import { CartService } from './cart.service';

const CART_URL = `${environment.apiBaseUrl}/cart`;

function cartResponse(overrides: Partial<Cart> = {}): Cart {
  return {
    items: [],
    pricing: {
      subtotal: '0.00',
      discount_amount: '0.00',
      tax_amount: '0.00',
      delivery_charge: '0.00',
      total_amount: '0.00',
      currency: 'INR',
    },
    item_count: 0,
    has_issues: false,
    coupon_code: null,
    coupon_error: null,
    ...overrides,
  };
}

describe('CartService', () => {
  let service: CartService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CartService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('starts empty', () => {
    expect(service.cart()).toBeNull();
    expect(service.itemCount()).toBe(0);
    expect(service.total()).toBe('0.00');
  });

  it('takes its state from the API response', () => {
    service.load().subscribe();

    httpMock.expectOne(CART_URL).flush(
      cartResponse({
        item_count: 2,
        pricing: {
          subtotal: '140.00',
          discount_amount: '0.00',
          tax_amount: '0.00',
          delivery_charge: '40.00',
          total_amount: '180.00',
          currency: 'INR',
        },
      }),
    );

    expect(service.itemCount()).toBe(2);
    // The total is whatever the server said -- 140 + 40, not recomputed here.
    expect(service.total()).toBe('180.00');
  });

  it('sends only the product and quantity when adding, never a price', () => {
    service.addItem(7, '2').subscribe();

    const request = httpMock.expectOne(`${CART_URL}/items`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ product_id: 7, quantity: '2' });
    // Nothing price-shaped may be in the payload.
    expect(Object.keys(request.request.body as object)).not.toContain('unit_price');
    expect(Object.keys(request.request.body as object)).not.toContain('line_total');
    request.flush(cartResponse({ item_count: 1 }));
  });

  it('replaces local state wholesale after every mutation', () => {
    service.load().subscribe();
    httpMock.expectOne(CART_URL).flush(cartResponse({ item_count: 3 }));
    expect(service.itemCount()).toBe(3);

    service.removeItem(1).subscribe();
    httpMock.expectOne(`${CART_URL}/items/1`).flush(cartResponse({ item_count: 0 }));

    expect(service.itemCount()).toBe(0);
  });

  it('exposes whether any line cannot be ordered', () => {
    service.load().subscribe();
    httpMock.expectOne(CART_URL).flush(cartResponse({ has_issues: true }));

    expect(service.hasIssues()).toBe(true);
  });

  it('clears state on reset, for sign-out and after checkout', () => {
    service.load().subscribe();
    httpMock.expectOne(CART_URL).flush(cartResponse({ item_count: 4 }));

    service.reset();

    expect(service.cart()).toBeNull();
    expect(service.itemCount()).toBe(0);
  });

  it('sends a quantity as a string, matching the API contract', () => {
    service.updateItem(3, '1.5').subscribe();

    const request = httpMock.expectOne(`${CART_URL}/items/3`);
    expect(request.request.body).toEqual({ quantity: '1.5' });
    expect(typeof (request.request.body as { quantity: unknown }).quantity).toBe('string');
    request.flush(cartResponse());
  });
});
