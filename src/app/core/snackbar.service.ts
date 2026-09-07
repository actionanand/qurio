import { Service, signal } from '@angular/core';

export type SnackbarTone = 'error' | 'info' | 'success';

interface SnackbarMessage {
  id: number;
  message: string;
  tone: SnackbarTone;
}

@Service()
export class SnackbarService {
  private readonly state = signal<SnackbarMessage | null>(null);
  private timer?: ReturnType<typeof setTimeout>;
  private nextId = 0;
  readonly message = this.state.asReadonly();

  show(message: string, tone: SnackbarTone = 'success', duration = 4200): void {
    this.dismiss();
    this.state.set({ id: ++this.nextId, message, tone });
    this.timer = setTimeout(() => this.dismiss(), duration);
  }

  dismiss(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.state.set(null);
  }
}
