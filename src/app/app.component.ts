import { Component, DestroyRef, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonApp, IonSelect, IonSelectOption } from '@ionic/angular';
import { NgOptimizedImage } from '@angular/common';
import { IconComponent } from './shared/icon.component';
import { I18nService } from './core/i18n.service';
import { PreferencesService } from './core/preferences.service';
import type { Appearance } from './core/preferences.service';
import type { Language } from './core/models';
import { ProgressService } from './core/progress.service';
import { AuthService } from './services/auth.service';
@Component({
  selector: 'app-root',
  imports: [
    IonApp,
    IonSelect,
    IonSelectOption,
    NgOptimizedImage,
    IconComponent,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly i = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  readonly progress = inject(ProgressService);
  readonly auth = inject(AuthService);
  constructor() {
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(event => {
      if (event instanceof NavigationEnd)
        setTimeout(() => {
          document.getElementById('main')?.focus();
          document.getElementById('main')?.scrollTo(0, 0);
        });
    });
  }
  language(value: unknown) {
    if (typeof value !== 'string') return;
    if (['en', 'ta', 'hi'].includes(value)) this.preferences.language.set(value as Language);
  }
  appearance(value: unknown) {
    if (typeof value !== 'string') return;
    if (['light', 'dark', 'system'].includes(value)) this.preferences.appearance.set(value as Appearance);
  }
  async signOut() {
    await this.auth.signOut();
    await this.router.navigateByUrl('/auth/login');
  }
}
