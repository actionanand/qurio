import { Service, signal } from '@angular/core';

export type SnackbarTone = 'error' | 'info' | 'success' | 'warning';

export interface SnackbarOptions {
  tone?: SnackbarTone;
  duration?: number;
  actionText?: string;
  action?: () => void;
}

export interface SnackbarMessage {
  id: number;
  message: string;
  tone: SnackbarTone;
  actionText?: string;
  action?: () => void;
}

@Service()
export class SnackbarService {
  private readonly state = signal<SnackbarMessage | null>(null);
  private timer?: ReturnType<typeof setTimeout>;
  private nextId = 0;
  readonly message = this.state.asReadonly();

  show(message: string, options?: SnackbarTone | SnackbarOptions, legacyDuration = 4200): void {
    const normalized = typeof options === 'string' ? { tone: options, duration: legacyDuration } : (options ?? {});
    this.dismiss();
    this.state.set({
      id: ++this.nextId,
      message,
      tone: normalized.tone ?? 'success',
      actionText: normalized.actionText,
      action: normalized.action,
    });
    this.timer = setTimeout(() => this.dismiss(), normalized.duration ?? 4200);
  }

  runAction(): void {
    const action = this.state()?.action;
    this.dismiss();
    action?.();
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.state.set(null);
  }
}
