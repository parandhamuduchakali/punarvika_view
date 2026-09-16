import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { LoginRequest, MessageResponse, RegisterRequest, TokenResponse, User } from '../models/api.models';

/**
 * Session state.
 *
 * The access token is held in memory only. Putting it in localStorage would
 * make it readable by any injected script, and it is deliberately short-lived
 * (15 minutes) for that reason. The long-lived refresh token is an HttpOnly
 * cookie the browser sends automatically and JavaScript cannot read at all --
 * which is why `withCredentials` matters on the auth calls below.
 *
 * The cost is that a page reload starts with no access token; `restoreSession`
 * asks the refresh endpoint for a new one, which succeeds only if the cookie is
 * still valid.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  private readonly _user = signal<User | null>(null);
  private readonly _accessToken = signal<string | null>(null);
  private readonly _restoring = signal(true);

  readonly user = this._user.asReadonly();
  readonly isRestoring = this._restoring.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly isAdmin = computed(() => this._user()?.role === 'ADMIN');

  /** Read by the auth interceptor. Never persisted. */
  get accessToken(): string | null {
    return this._accessToken();
  }

  register(payload: RegisterRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.base}/register`, payload, { withCredentials: true })
      .pipe(tap((response) => this.applySession(response)));
  }

  login(payload: LoginRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.base}/login`, payload, { withCredentials: true })
      .pipe(tap((response) => this.applySession(response)));
  }

  /** Exchanges the refresh cookie for a new access token. */
  refresh(): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.base}/refresh`, {}, { withCredentials: true })
      .pipe(tap((response) => this.applySession(response)));
  }

  logout(): Observable<MessageResponse> {
    return this.http
      .post<MessageResponse>(`${this.base}/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this.clearSession()));
  }

  /**
   * Ends every session, on every device. The access token already issued to this
   * browser stays valid until it expires (a JWT cannot be revoked), which is why
   * it is short-lived; the refresh tokens are what actually die here.
   */
  logoutEverywhere(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/logout-all`, {}, {
      withCredentials: true,
    });
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/reset-password`, { token, password });
  }

  changePassword(currentPassword: string, password: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.base}/change-password`, {
      current_password: currentPassword,
      password,
    });
  }

  applySession(response: TokenResponse): void {
    this._accessToken.set(response.access_token);
    this._user.set(response.user);
  }

  clearSession(): void {
    this._accessToken.set(null);
    this._user.set(null);
  }

  markRestored(): void {
    this._restoring.set(false);
  }

  /**
   * Called once at startup. A 401 here is the ordinary "not signed in" case, so
   * it resolves rather than rejects.
   */
  restoreSession(): Promise<void> {
    return new Promise((resolve) => {
      this.refresh().subscribe({
        next: () => {
          this.markRestored();
          resolve();
        },
        error: () => {
          this.clearSession();
          this.markRestored();
          resolve();
        },
      });
    });
  }
}
