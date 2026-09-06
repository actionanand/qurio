import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { PreferencesService } from '../core/preferences.service';

@Component({
  selector: 'app-exam-prep',
  imports: [RouterLink, IconComponent],
  template: `
    <section class="exam-hero">
      <span class="eyebrow"><app-icon name="exam" />{{ i.t('examPrep') }}</span>
      <h1>{{ i.t('selectExam') }}</h1>
      <p>{{ i.t('selectPlan') }}</p>
    </section>
    @if (loading()) {
      <p role="status">{{ i.t('loading') }}</p>
    } @else if (error()) {
      <div class="panel" role="alert">
        <p>{{ i.t('error') }}</p>
        <button (click)="load()">{{ i.t('retry') }}</button>
      </div>
    } @else {
      <div class="exam-list">
        @for (exam of content.getExams(); track exam.id) {
          <section class="panel exam-group">
            <span class="eyebrow">{{ exam.shortName }}</span>
            <h2>{{ exam.label[preferences.language()] || exam.label.en }}</h2>
            <p class="muted">{{ exam.fullName[preferences.language()] || exam.fullName.en }}</p>
            <div class="content-list compact-list">
              @for (plan of plansFor(exam.id); track plan.id) {
                <a
                  class="content-card"
                  [routerLink]="['/exam-prep', plan.id, 'today']"
                  (click)="preferences.selectedExamPlanId.set(plan.id)">
                  <span class="type-icon"><app-icon name="calendar" /></span>
                  <div class="card-copy">
                    <span class="eyebrow"
                      >{{ i.t('class') }} {{ plan.entryClass }} · {{ i.t('year') }} {{ plan.examYear }}</span
                    >
                    <h3>{{ exam.shortName }} {{ plan.examYear }}</h3>
                  </div>
                  <app-icon class="arrow" name="chevron" />
                </a>
              }
            </div>
          </section>
        }
      </div>
    }
  `,
})
export class ExamPrepPage {
  readonly content = inject(ContentService);
  readonly i = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly selected = computed(() => this.preferences.selectedExamPlanId());

  constructor() {
    void this.load();
    effect(() => this.selected());
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      await this.content.loadManifest();
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  plansFor(examId: string) {
    return this.content.getExamPlansForExam(examId);
  }
}
