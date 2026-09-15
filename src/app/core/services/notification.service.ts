import { Injectable, signal } from '@angular/core';

export type NoticeKind = 'success' | 'error' | 'info';

export interface Notice {
  id: number;
  kind: NoticeKind;
  message: string;
}

/**
 * Transient messages. Kept deliberately small: errors that belong to a form
 * field are rendered against that field, not here.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly _notices = signal<Notice[]>([]);
  readonly notices = this._notices.asReadonly();

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  info(message: string): void {
    this.push('info', message);
  }

  dismiss(id: number): void {
    this._notices.update((current) => current.filter((notice) => notice.id !== id));
  }

  private push(kind: NoticeKind, message: string): void {
    const notice: Notice = { id: this.nextId++, kind, message };
    this._notices.update((current) => [...current, notice]);
    // Errors stay until dismissed; confirmations get out of the way.
    if (kind !== 'error') {
      setTimeout(() => this.dismiss(notice.id), 4000);
    }
  }
}
