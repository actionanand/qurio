import { NgOptimizedImage } from '@angular/common';
import { afterNextRender, Component, DestroyRef, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../environments/environment';
import { I18nService } from '../core/i18n.service';
import { IconComponent } from './icon.component';

const dismissKey = 'qurio.androidBannerDismissed';
const autoHideMs = 15_000;

export function buildAndroidIntent(deepLink: string, packageName: string, fallbackUrl: string): string {
  const separator = deepLink.indexOf('://');
  if (separator < 1) return fallbackUrl;
  return `intent://${deepLink.slice(separator + 3)}#Intent;scheme=${deepLink.slice(0, separator)};package=${packageName};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

@Component({
  selector: 'app-install-app-banner',
  imports: [NgOptimizedImage, IconComponent],
  template: `
    @if (visible()) {
      <aside class="install-banner" role="region" [attr.aria-label]="i.t('openAndroidApp')">
        <img ngSrc="assets/qurio.png" width="44" height="44" alt="" />
        <div>
          <strong>{{ i.t('openAndroidApp') }}</strong>
          <span>{{ i.t('androidAppPrompt') }}</span>
        </div>
        <button type="button" class="open" (click)="openApp()">{{ i.t('open') }}</button>
        <button type="button" class="dismiss" [attr.aria-label]="i.t('dismiss')" (click)="dismiss()">
          <app-icon name="close" />
        </button>
      </aside>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: auto 12px calc(82px + env(safe-area-inset-bottom));
      z-index: 900;
      pointer-events: none;
    }
    .install-banner {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 11px;
      width: min(100%, 540px);
      margin: auto;
      padding: 11px 12px;
      border: 1px solid var(--line);
      border-radius: 17px;
      color: var(--ion-text-color);
      background: var(--surface);
      box-shadow: 0 18px 52px #071b1245;
      pointer-events: auto;
      animation: enter 0.25s ease-out;
    }
    img {
      border-radius: 11px;
      object-fit: contain;
    }
    strong,
    span {
      display: block;
    }
    strong {
      font-size: 14px;
    }
    span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }
    button {
      min-height: 42px;
      padding: 8px 14px;
    }
    .dismiss {
      width: 42px;
      padding: 0;
      color: var(--muted);
      background: transparent;
    }
    @keyframes enter {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
    }
    @media (min-width: 761px) {
      :host {
        inset: auto 20px 20px auto;
      }
      .install-banner {
        width: 540px;
      }
    }
    @media (max-width: 520px) {
      .install-banner {
        grid-template-columns: auto minmax(0, 1fr) auto;
      }
      .open {
        grid-column: 2;
        justify-self: start;
      }
      .dismiss {
        grid-column: 3;
        grid-row: 1 / span 2;
      }
    }
  `,
})
export class InstallAppBannerComponent {
  readonly i = inject(I18nService);
  readonly visible = signal(false);
  private readonly destroyRef = inject(DestroyRef);
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => {
      if (!this.shouldShow()) return;
      this.visible.set(true);
      this.timer = setTimeout(() => this.visible.set(false), autoHideMs);
      this.destroyRef.onDestroy(() => this.clearTimer());
    });
  }

  openApp(): void {
    const deepLink = `${environment.androidDeepLinkBaseUrl}home`;
    const target =
      /android/i.test(navigator.userAgent) && /chrome\/\d+/i.test(navigator.userAgent)
        ? buildAndroidIntent(deepLink, environment.androidPackageName, environment.androidPlayStoreUrl)
        : deepLink;
    this.dismiss();
    window.location.href = target;
  }

  dismiss(): void {
    this.visible.set(false);
    this.clearTimer();
    try {
      sessionStorage.setItem(dismissKey, '1');
    } catch {
      return;
    }
  }

  private shouldShow(): boolean {
    if (Capacitor.isNativePlatform() || !/android/i.test(navigator.userAgent)) return false;
    try {
      return sessionStorage.getItem(dismissKey) !== '1';
    } catch {
      return true;
    }
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
