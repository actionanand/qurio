import { Component, inject } from '@angular/core';
import { SnackbarService } from '../core/snackbar.service';
import { I18nService } from '../core/i18n.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-snackbar',
  imports: [IconComponent],
  template: `
    @if (snackbar.message(); as item) {
      <aside
        class="qurio-snackbar"
        [class.error]="item.tone === 'error'"
        [class.info]="item.tone === 'info'"
        role="status"
        aria-live="polite"
        aria-atomic="true">
        <app-icon [name]="item.tone === 'error' ? 'warning' : item.tone === 'info' ? 'info' : 'correct'" />
        <p>{{ item.message }}</p>
        <button type="button" [attr.aria-label]="i.t('dismiss')" (click)="snackbar.dismiss()">
          <app-icon name="close" />
        </button>
      </aside>
    }
  `,
  styles: `
    :host {
      position: fixed;
      right: 16px;
      bottom: calc(22px + env(safe-area-inset-bottom));
      left: 16px;
      z-index: 1000;
      pointer-events: none;
    }
    .qurio-snackbar {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      width: min(100%, 480px);
      min-height: 58px;
      margin-left: auto;
      padding: 9px 10px 9px 16px;
      border: 1px solid #5db58a;
      border-left: 4px solid var(--accent);
      border-radius: 15px;
      background: var(--surface);
      color: var(--ion-text-color);
      box-shadow: 0 16px 46px #071b1240;
      pointer-events: auto;
      animation: enter 0.2s ease-out;
    }
    .qurio-snackbar.error {
      border-color: var(--danger-line);
      border-left-color: var(--danger);
    }
    .qurio-snackbar.info {
      border-color: #6f9fc4;
      border-left-color: #3479a8;
    }
    p {
      margin: 0;
      font-size: 14px;
      font-weight: 650;
      line-height: 1.4;
    }
    button {
      width: 42px;
      min-height: 42px;
      padding: 0;
      border-radius: 50%;
      color: var(--muted);
      background: transparent;
    }
    @keyframes enter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
    }
    @media (max-width: 760px) {
      :host {
        bottom: calc(82px + env(safe-area-inset-bottom));
      }
      .qurio-snackbar {
        margin: auto;
      }
    }
  `,
})
export class SnackbarComponent {
  readonly snackbar = inject(SnackbarService);
  readonly i = inject(I18nService);
}
