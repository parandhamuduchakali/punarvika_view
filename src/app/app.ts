import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';
import { NotificationService } from './core/services/notification.service';

/**
 * The application shell: header, navigation, notices and the routed outlet.
 *
 * The cart count is loaded once a customer is known and kept in a signal, so the
 * header badge stays in step with whatever the last API response said.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  protected readonly notifications = inject(NotificationService);

  protected readonly menuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  constructor() {
    // The app initializer has already restored the session (app.config.ts), so
    // only the basket is loaded here. Refreshing again would rotate the token
    // a second time on every page load.
    if (this.auth.isAuthenticated()) {
      this.cart.load().subscribe({ error: () => undefined });
    }
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected signOut(): void {
    this.auth.logout().subscribe({
      next: () => this.afterSignOut(),
      // Even if the call fails, the local session must not linger.
      error: () => this.afterSignOut(),
    });
  }

  private afterSignOut(): void {
    this.auth.clearSession();
    this.cart.reset();
    this.closeMenu();
    void this.router.navigate(['/']);
  }
}
