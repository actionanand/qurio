import { Service, effect, inject, signal } from '@angular/core';
import type { Language } from './models';
import { LearnerStateRepository } from '../services/learner-state.repository';
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
  private readonly remote = inject(LearnerStateRepository);
  readonly language = signal<Language>('en');
  readonly appearance = signal<Appearance>('system');
  readonly grade = signal(5);
  readonly selectedExamPlanId = signal<string | null>(null);
  readonly selectedCurriculum = signal<string | null>(null);
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
      if ('selectedCurriculum' in saved && typeof saved.selectedCurriculum === 'string')
        this.selectedCurriculum.set(saved.selectedCurriculum);
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
            selectedCurriculum: this.selectedCurriculum(),
          }),
        );
      } catch {
        this.storageUnavailable.set(true);
      }
    });
    let loadedUser: string | null = null;
    effect(onCleanup => {
      const userId = this.remote.approvedUserId();
      if (!userId) return;
      if (userId !== loadedUser) {
        loadedUser = userId;
        void this.remote.loadSettings().then(settings => {
          if (!settings) return;
          if (settings.preferred_language) this.language.set(settings.preferred_language);
          if (settings.theme) this.appearance.set(settings.theme);
          if (settings.selected_grade) this.grade.set(settings.selected_grade);
          this.selectedCurriculum.set(settings.selected_curriculum);
          this.selectedExamPlanId.set(settings.selected_exam_plan_id);
        });
      }
      const settings = {
        preferred_language: this.language(),
        theme: this.appearance(),
        selected_curriculum: this.selectedCurriculum(),
        selected_grade: this.grade(),
        selected_exam_plan_id: this.selectedExamPlanId(),
      };
      const timer = window.setTimeout(() => void this.remote.saveSettings(settings), 500);
      onCleanup(() => window.clearTimeout(timer));
    });
  }
}
