import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Address, AddressPayload, User } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  profile(): Observable<User> {
    return this.http.get<User>(`${this.base}/profile`);
  }

  /** Email and role are not editable: both are server-side decisions. */
  updateProfile(payload: { full_name?: string; phone?: string | null }): Observable<User> {
    return this.http.patch<User>(`${this.base}/profile`, payload);
  }

  addresses(): Observable<Address[]> {
    return this.http.get<Address[]>(`${this.base}/addresses`);
  }

  createAddress(payload: AddressPayload): Observable<Address> {
    return this.http.post<Address>(`${this.base}/addresses`, payload);
  }

  updateAddress(id: number, payload: AddressPayload): Observable<Address> {
    return this.http.put<Address>(`${this.base}/addresses/${id}`, payload);
  }

  setDefaultAddress(id: number): Observable<Address> {
    return this.http.post<Address>(`${this.base}/addresses/${id}/default`, {});
  }

  deleteAddress(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/addresses/${id}`);
  }
}
