import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../shared/icon.component';
import { ContentService } from '../core/content.service';
import { ExamPlanProgressRepository } from '../core/exam-plan-progress.repository';
import { ExamPlanService } from '../core/exam-plan.service';
import {
  addDays,
  currentPhase,
  daysUntilTarget,
  formatDateKey,
  monthsRemaining,
  nearestAvailableDate,
  phaseState,
} from '../core/exam-date.util';
import { I18nService } from '../core/i18n.service';
import { ProgressService } from '../core/progress.service';
import type {
  ExamCalendarDay,
  ExamCalendarMonth,
  ExamPlan,
  ExamPlanReference,
  ContentDisplayInfo,
} from '../core/models';
import { MarkdownViewerComponent } from '../learning/markdown-viewer.component';

@Component({
  selector: 'app-exam-plan',
  imports: [DatePipe, NgTemplateOutlet, RouterLink, RouterLinkActive, IconComponent, MarkdownViewerComponent],
  template: `
    <a class="back-link" routerLink="/exam-prep"><app-icon name="back" />{{ i.t('examPrep') }}</a>
    @if (loading()) {
      <p role="status">{{ i.t('loading') }}</p>
    } @else if (error()) {
      <div class="panel" role="alert">
        <p>{{ i.t('error') }}</p>
        <button (click)="load()">{{ i.t('retry') }}</button>
      </div>
    } @else if (plan(); as activePlan) {
      <section class="plan-header panel">
        <span class="eyebrow"><app-icon name="exam" />{{ examName() }}</span>
        <h1>{{ activePlan.title }}</h1>
        <p>{{ activePlan.subtitle }}</p>
        <div class="plan-chips">
          <span class="chip"><app-icon name="calendar" />{{ daysLeft() }} {{ i.t('daysLeft') }}</span>
          <span class="chip">{{ monthsLeft() }} {{ i.t('monthsRemaining') }}</span>
          <span class="chip">{{ i.t('targetDate') }} {{ activePlan.targetDate }}</span>
          @if (phase(); as current) {
            <span class="chip">{{ i.t('currentPhase') }} {{ current.name }}</span>
          }
        </div>
      </section>
      <nav class="plan-tabs" aria-label="{{ i.t('examPrep') }}">
        <a [routerLink]="['/exam-prep', planId(), 'today']" routerLinkActive="active"
          ><app-icon name="calendar" />{{ i.t('today') }}</a
        >
        <a [routerLink]="['/exam-prep', planId(), 'week']" routerLinkActive="active"
          ><app-icon name="list" />{{ i.t('weekView') }}</a
        >
        <a [routerLink]="['/exam-prep', planId(), 'phases']" routerLinkActive="active"
          ><app-icon name="progress" />{{ i.t('phasePlan') }}</a
        >
        <a [routerLink]="['/exam-prep', planId(), 'syllabus']" routerLinkActive="active"
          ><app-icon name="syllabus" />{{ i.t('syllabus') }}</a
        >
        <a [routerLink]="['/exam-prep', planId(), 'strategy']" routerLinkActive="active"
          ><app-icon name="reader" />{{ i.t('strategy') }}</a
        >
        <a [routerLink]="['/exam-prep', planId(), 'progress']" routerLinkActive="active"
          ><app-icon name="trophy" />{{ i.t('planProgress') }}</a
        >
      </nav>
      @switch (view()) {
        @case ('week') {
          <section class="panel">
            <h2>{{ i.t('weekView') }}</h2>
            <div class="week-grid">
              @for (day of weekDays(); track day.date) {
                <button class="day-card" [class.selected]="selectedDate() === day.date" (click)="selectDate(day.date)">
                  <strong>{{ day.date | date: 'EEE, MMM d' }}</strong
                  ><span>{{ day.topics.length }} {{ i.t('topics') }}</span
                  ><span>{{ day.revision.length }} {{ i.t('revision') }}</span
                  ><span>{{ day.practiceQuizIds.length }} {{ i.t('quiz') }}</span>
                </button>
              }
            </div>
          </section>
        }
        @case ('phases') {
          <section class="panel">
            <h2>{{ i.t('phasePlan') }}</h2>
            <div class="phase-list">
              @for (item of activePlan.phases; track item.id) {
                <article class="phase-card" [class.current]="phaseState(item) === 'current'">
                  <span class="eyebrow">{{ phaseState(item) }}</span>
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.startDate }} - {{ item.endDate }}</p>
                </article>
              }
            </div>
          </section>
        }
        @case ('syllabus') {
          <section class="panel reader">
            <h2>{{ i.t('syllabus') }}</h2>
            @if (markdown(); as body) {
              <app-markdown-viewer [body]="body" />
            } @else {
              <p>{{ i.t('loading') }}</p>
            }
          </section>
        }
        @case ('strategy') {
          <section class="panel reader">
            <h2>{{ i.t('strategy') }}</h2>
            @if (markdown(); as body) {
              <app-markdown-viewer [body]="body" />
            } @else {
              <p>{{ i.t('loading') }}</p>
            }
          </section>
        }
        @case ('overview') {
          <section class="panel reader">
            <h2>{{ i.t('overview') }}</h2>
            @if (markdown(); as body) {
              <app-markdown-viewer [body]="body" />
            } @else {
              <p>{{ i.t('loading') }}</p>
            }
          </section>
        }
        @case ('progress') {
          <section class="panel">
            <h2>{{ i.t('planProgress') }}</h2>
            <p class="score">{{ progressPercent() }}%</p>
            <p class="muted">{{ i.t('noCalendar') }}</p>
          </section>
        }
        @default {
          <ng-container [ngTemplateOutlet]="todayView" />
        }
      }
      <ng-template #todayView>
        <section class="panel day-panel">
          <div class="day-nav">
            <button (click)="move(-1)" aria-label="{{ i.t('previousDay') }}">
              <app-icon name="back" />{{ i.t('previousDay') }}</button
            ><button (click)="goToday()">{{ i.t('today') }}</button
            ><button (click)="move(1)" aria-label="{{ i.t('nextDay') }}">
              {{ i.t('nextDay') }}<app-icon name="forward" />
            </button>
          </div>
          <h2>{{ selectedDate() | date: 'fullDate' }}</h2>
          @if (day(); as currentDay) {
            <p class="muted">{{ i.t('weekView') }} {{ currentDay.weekNumber }} · {{ phaseName(currentDay.phaseId) }}</p>
            <div class="task-section">
              <h3>{{ i.t('topics') }}</h3>
              @for (topic of currentDay.topics; track topic.id) {
                <article class="task-card">
                  <label
                    ><input
                      type="checkbox"
                      [checked]="topicDone(currentDay.date, topic.id)"
                      (change)="toggleTopic(currentDay.date, topic.id, $event)" />
                    <strong>{{ topic.title }}</strong></label
                  >
                  <p>{{ topic.details }}</p>
                  @if (topic.contentId && content.getItemById(topic.contentId)) {
                    <a class="button secondary" [routerLink]="['/content', topic.contentId]"
                      ><app-icon name="note" />{{ i.t('open') }}</a
                    >
                  }
                </article>
              }
            </div>
            <div class="task-section">
              <h3>{{ i.t('revision') }}</h3>
              @for (item of currentDay.revision; track item.id) {
                <article class="task-card">
                  <label
                    ><input
                      type="checkbox"
                      [checked]="revisionDone(currentDay.date, item.id)"
                      (change)="toggleRevision(currentDay.date, item.id, $event)" />
                    <strong>{{ item.title }}</strong></label
                  >
                  <p>{{ item.details }}</p>
                </article>
              }
            </div>
            <div class="task-section">
              <h3>{{ i.t('practiceSets') }}</h3>
              <div class="content-list compact-list">
                @for (quiz of quizDisplays(currentDay.practiceQuizIds); track quiz.id) {
                  @if (!quiz.unavailable && quiz.item) {
                    <a class="content-card" [routerLink]="['/content', quiz.id]"
                      ><span class="type-icon"><app-icon name="quiz" /></span>
                      <div class="card-copy">
                        <h3>{{ quiz.title }}</h3>
                        <p class="muted">{{ metadata(quiz) }}</p>
                      </div>
                      <app-icon class="arrow" name="chevron"
                    /></a>
                  } @else {
                    <article class="content-card unavailable-card">
                      <span class="type-icon"><app-icon name="quiz" /></span>
                      <div class="card-copy">
                        <h3>{{ quiz.title }}</h3>
                      </div>
                    </article>
                  }
                } @empty {
                  <p class="muted">{{ i.t('empty') }}</p>
                }
              </div>
            </div>
            <div class="task-section">
              <h3>{{ i.t('dailyStudyMaterial') }}</h3>
              <div class="content-list compact-list">
                @for (item of studyDisplays(currentDay.studyMaterialIds); track item.id) {
                  @if (!item.unavailable && item.item) {
                    <a class="content-card" [routerLink]="['/content', item.id]"
                      ><span class="type-icon"
                        ><app-icon [name]="item.type === 'unavailable' ? 'note' : item.type"
                      /></span>
                      <div class="card-copy">
                        <h3>{{ item.title }}</h3>
                        <p class="muted">{{ metadata(item) }}</p>
                      </div>
                      <app-icon class="arrow" name="chevron"
                    /></a>
                  } @else {
                    <article class="content-card unavailable-card">
                      <span class="type-icon"><app-icon name="note" /></span>
                      <div class="card-copy">
                        <h3>{{ item.title }}</h3>
                      </div>
                    </article>
                  }
                } @empty {
                  <p class="muted">{{ i.t('empty') }}</p>
                }
              </div>
            </div>
            <div class="task-section">
              <h3>{{ i.t('timetable') }}</h3>
              @for (entry of currentDay.timetable; track entry.id) {
                <article class="task-card timetable-row">
                  <label
                    ><input
                      type="checkbox"
                      [checked]="timetableDone(currentDay.date, entry.id)"
                      (change)="toggleTimetable(currentDay.date, entry.id, $event)" />
                    <strong>{{ entry.startTime }}-{{ entry.endTime }}</strong></label
                  ><span>{{ entry.title }}</span>
                </article>
              }
            </div>
          } @else {
            <p class="notice">{{ i.t('noPlanForDate') }}</p>
          }
        </section>
      </ng-template>
    }
  `,
})
export class ExamPlanPage {
  readonly planId = input.required<string>();
  readonly view = input('today');
  readonly content = inject(ContentService);
  readonly plans = inject(ExamPlanService);
  readonly planProgress = inject(ExamPlanProgressRepository);
  readonly learningProgress = inject(ProgressService);
  readonly i = inject(I18nService);
  readonly planRef = signal<ExamPlanReference | null>(null);
  readonly plan = signal<ExamPlan | null>(null);
  readonly calendars = signal<Record<string, ExamCalendarMonth>>({});
  readonly selectedDate = signal(formatDateKey(new Date()));
  readonly markdown = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly day = computed(
    () =>
      Object.values(this.calendars())
        .flatMap(month => month.days)
        .find(day => day.date === this.selectedDate()) ?? null,
  );
  readonly phase = computed(() => {
    const plan = this.plan();
    return plan ? currentPhase(plan) : undefined;
  });
  readonly daysLeft = computed(() => {
    const plan = this.plan();
    return plan ? daysUntilTarget(plan.targetDate) : 0;
  });
  readonly monthsLeft = computed(() => {
    const plan = this.plan();
    return plan ? monthsRemaining(plan.targetDate) : 0;
  });
  readonly weekDays = computed(() => {
    const day = this.day();
    if (!day) return [];
    return Object.values(this.calendars())
      .flatMap(month => month.days)
      .filter(entry => entry.weekNumber === day.weekNumber)
      .sort((a, b) => a.date.localeCompare(b.date));
  });
  readonly progressPercent = computed(() => {
    const days = Object.values(this.calendars()).flatMap(month => month.days);
    const total = days.reduce(
      (sum, day) =>
        sum +
        day.topics.length +
        day.revision.length +
        day.timetable.length +
        day.studyMaterialIds.length +
        day.practiceQuizIds.length,
      0,
    );
    if (!total || !this.plan()) return 0;
    const done = days.reduce((sum, day) => sum + this.completedCount(day), 0);
    return Math.round((done / total) * 100);
  });

  constructor() {
    effect(() => {
      this.view();
      void this.loadMarkdown();
    });
    effect(() => {
      this.planId();
      this.i.preferences.language();
      void this.load();
    });
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    this.markdown.set(null);
    try {
      await this.content.loadManifest();
      const ref = this.content.getExamPlanById(this.planId());
      if (!ref) throw new Error('Plan not found');
      this.planRef.set(ref);
      this.i.preferences.selectedExamPlanId.set(ref.id);
      const result = await this.plans.loadPlan(ref, this.i.preferences.language());
      this.plan.set(result.content);
      const firstCalendar = result.content.calendarFiles[0];
      if (firstCalendar) await this.loadCalendar(firstCalendar);
      const available = Object.values(this.calendars()).flatMap(month => month.days);
      this.selectedDate.set(nearestAvailableDate(available) ?? formatDateKey(new Date()));
      await this.loadMarkdown();
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  async loadMarkdown() {
    const ref = this.planRef();
    const plan = this.plan();
    const view = this.view();
    if (!ref || !plan || !['syllabus', 'strategy', 'overview'].includes(view)) return;
    this.markdown.set(null);
    try {
      const result = await this.plans.loadPlanMarkdown(
        ref,
        plan,
        view as 'syllabus' | 'strategy' | 'overview',
        this.i.preferences.language(),
      );
      this.markdown.set(result.content);
    } catch {
      this.markdown.set(this.i.t('error'));
    }
  }

  async selectDate(date: string) {
    this.selectedDate.set(date);
    await this.ensureMonth(date);
  }

  async move(amount: number) {
    const next = addDays(this.selectedDate(), amount);
    this.selectedDate.set(next);
    await this.ensureMonth(next);
  }

  async goToday() {
    await this.selectDate(formatDateKey(new Date()));
  }

  async ensureMonth(date: string) {
    const plan = this.plan();
    if (!plan) return;
    const file = this.plans.monthFromDate(plan, date);
    if (file) await this.loadCalendar(file);
  }

  async loadCalendar(file: string) {
    const ref = this.planRef();
    const plan = this.plan();
    if (!ref || !plan || this.calendars()[file]) return;
    const result = await this.plans.loadCalendar(ref, plan, file, this.i.preferences.language());
    this.calendars.update(calendars => ({ ...calendars, [file]: result.content }));
  }

  phaseName(id: string) {
    return this.plan()?.phases.find(phase => phase.id === id)?.name ?? '';
  }

  phaseState = phaseState;

  examName() {
    const examId = this.planRef()?.examId;
    const exam = this.content.getExams().find(exam => exam.id === examId);
    return exam?.shortName ?? this.i.t('examPrep');
  }

  quizDisplays(ids: string[]) {
    return ids
      .map(id => this.content.getContentDisplayInfo(id, this.i.preferences.language()))
      .filter(display => display.unavailable || display.type === 'quiz');
  }

  studyDisplays(ids: string[]) {
    return ids
      .map(id => this.content.getContentDisplayInfo(id, this.i.preferences.language()))
      .filter(display => display.unavailable || display.type !== 'quiz');
  }

  metadata(display: ContentDisplayInfo) {
    const parts = [
      display.setLabel,
      display.subjectLabel,
      display.difficulty,
      this.minutes(display),
      this.questions(display),
    ].filter((value): value is string => !!value);
    return parts.join(' · ');
  }

  private minutes(display: ContentDisplayInfo) {
    const minutes =
      display.estimatedMinutes ?? (display.timeLimitSeconds ? Math.round(display.timeLimitSeconds / 60) : undefined);
    return minutes ? `${minutes} ${this.i.t('min')}` : undefined;
  }

  private questions(display: ContentDisplayInfo) {
    return display.questionCount ? `${display.questionCount} ${this.i.t('questions').toLowerCase()}` : undefined;
  }

  topicDone(date: string, id: string) {
    return this.done(date, 'topic', id);
  }
  revisionDone(date: string, id: string) {
    return this.done(date, 'revision', id);
  }
  timetableDone(date: string, id: string) {
    return this.done(date, 'timetable', id);
  }
  toggleTopic(date: string, id: string, event: Event) {
    this.toggle(date, 'topic', id, event);
  }
  toggleRevision(date: string, id: string, event: Event) {
    this.toggle(date, 'revision', id, event);
  }
  toggleTimetable(date: string, id: string, event: Event) {
    this.toggle(date, 'timetable', id, event);
  }

  private done(date: string, section: 'topic' | 'revision' | 'timetable', id: string) {
    const plan = this.plan();
    return (
      !!plan && this.planProgress.getTaskCompletion(plan.id, this.planProgress.taskKey(plan.id, date, section, id))
    );
  }

  private toggle(date: string, section: 'topic' | 'revision' | 'timetable', id: string, event: Event) {
    const plan = this.plan();
    const checked = event.target instanceof HTMLInputElement && event.target.checked;
    if (plan)
      this.planProgress.setTaskCompleted(plan.id, date, this.planProgress.taskKey(plan.id, date, section, id), checked);
  }

  private completedCount(day: ExamCalendarDay) {
    const plan = this.plan();
    if (!plan) return 0;
    const planOnly =
      day.topics.filter(task => this.topicDone(day.date, task.id)).length +
      day.revision.filter(task => this.revisionDone(day.date, task.id)).length +
      day.timetable.filter(entry => this.timetableDone(day.date, entry.id)).length;
    const study = day.studyMaterialIds.filter(id => this.learningProgress.completed().includes(id)).length;
    const quizzes = day.practiceQuizIds.filter(id =>
      this.learningProgress.attempts().some(attempt => attempt.quizId === id),
    ).length;
    return planOnly + study + quizzes;
  }
}
