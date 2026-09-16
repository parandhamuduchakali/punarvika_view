import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AdminReview,
  MyReview,
  Page,
  RatingSummary,
  Review,
  ReviewPayload,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Public. Only approved reviews come back. */
  forProduct(productId: number, limit = 20, offset = 0): Observable<Page<Review>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<Page<Review>>(`${this.base}/products/${productId}/reviews`, { params });
  }

  summary(productId: number): Observable<RatingSummary> {
    return this.http.get<RatingSummary>(`${this.base}/products/${productId}/reviews/summary`);
  }

  /**
   * Whether to offer the review form. Not a security check -- the API re-verifies
   * the delivered order when the review is actually posted.
   */
  canReview(productId: number): Observable<boolean> {
    return this.http
      .get<{ can_review: boolean }>(`${this.base}/products/${productId}/reviews/can-review`)
      .pipe(map((r) => r.can_review));
  }

  create(productId: number, payload: ReviewPayload): Observable<Review> {
    return this.http.post<Review>(`${this.base}/products/${productId}/reviews`, payload);
  }

  mine(): Observable<MyReview[]> {
    return this.http.get<MyReview[]>(`${this.base}/reviews/mine`);
  }

  update(reviewId: number, payload: ReviewPayload): Observable<Review> {
    return this.http.put<Review>(`${this.base}/reviews/${reviewId}`, payload);
  }

  remove(reviewId: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/reviews/${reviewId}`);
  }

  // ------------------------------------------------------------- moderation
  pending(limit = 50, offset = 0): Observable<Page<AdminReview>> {
    const params = new HttpParams().set('limit', limit).set('offset', offset);
    return this.http.get<Page<AdminReview>>(`${this.base}/admin/reviews/pending`, { params });
  }

  moderate(reviewId: number, approve: boolean, note?: string): Observable<AdminReview> {
    return this.http.patch<AdminReview>(`${this.base}/admin/reviews/${reviewId}`, {
      approve,
      note: note ?? null,
    });
  }
}
