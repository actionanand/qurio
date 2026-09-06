import { Service, effect, signal } from '@angular/core';
import type { Language } from './models';
export type Appearance = 'light' | 'dark' | 'system';
export function readLocal(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
@Service()
export class PreferencesService {
  readonly language = signal<Language>('en');
  readonly appearance = signal<Appearance>('system');
  readonly grade = signal(5);
  readonly selectedExamPlanId = signal<string | null>(null);
  readonly storageUnavailable = signal(false);
  constructor() {
    const saved = readLocal('qurio.preferences');
    if (saved && typeof saved === 'object') {
      if ('language' in saved && ['en', 'ta', 'hi'].includes(String(saved.language)))
        this.language.set(saved.language as Language);
      if ('appearance' in saved && ['light', 'dark', 'system'].includes(String(saved.appearance)))
        this.appearance.set(saved.appearance as Appearance);
      if ('grade' in saved && typeof saved.grade === 'number') this.grade.set(saved.grade);
      if ('selectedExamPlanId' in saved && typeof saved.selectedExamPlanId === 'string')
        this.selectedExamPlanId.set(saved.selectedExamPlanId);
    }
    effect(onCleanup => {
      const appearance = this.appearance();
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () =>
        document.documentElement.classList.toggle(
          'dark',
          appearance === 'dark' || (appearance === 'system' && media.matches),
        );
      apply();
      media.addEventListener('change', apply);
      onCleanup(() => media.removeEventListener('change', apply));
      document.documentElement.lang = this.language();
      try {
        localStorage.setItem(
          'qurio.preferences',
          JSON.stringify({
            language: this.language(),
            appearance,
            grade: this.grade(),
            selectedExamPlanId: this.selectedExamPlanId(),
          }),
        );
      } catch {
        this.storageUnavailable.set(true);
      }
    });
  }
}
