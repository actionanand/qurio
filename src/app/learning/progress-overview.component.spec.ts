import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import type { Attempt } from '../core/models';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { LearningExperienceService } from '../core/learning-experience.service';
import { ProgressService } from '../core/progress.service';
import { ProgressOverviewComponent } from './progress-overview.component';

const createAttempt = (index: number): Attempt => ({
  id: `attempt-${index}`,
  quizId: 'quiz-best',
  total: 10,
  correct: index < 2 ? 8 + index : 5,
  wrong: 5,
  unanswered: 0,
  scorePercentage: index < 2 ? 80 + index * 10 : 50,
  passed: index < 2,
  elapsedSeconds: 60,
  completedAt: new Date(Date.UTC(2026, 8, 15, 10, 0, 20 - index)).toISOString(),
  languageUsed: 'en',
  autoSubmitted: false,
});

describe('ProgressOverviewComponent', () => {
  it('uses corrected labels, paginates by ten, marks best attempts, and limits sync noise', () => {
    const attempts = signal(Array.from({ length: 12 }, (_, index) => createAttempt(index)));
    const syncState = vi.fn((id: string) =>
      id === 'attempt-2' ? 'failed' : id === 'attempt-3' ? 'pending' : 'synced',
    );
    const translations: Record<string, string> = {
      notesDone: 'Lessons completed',
      wrongAnswers: 'Wrong answers',
      best: 'Best',
      viewMore: 'View more',
      syncFailed: 'Sync failed',
      pendingSync: 'Pending sync',
    };
    TestBed.configureTestingModule({
      imports: [ProgressOverviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: ProgressService,
          useValue: {
            attempts,
            legacyAttempts: signal([]),
            loading: signal(false),
            loaded: signal(true),
            error: signal(false),
            canonicalRevision: signal(0),
            syncState,
            retryAttemptSync: vi.fn(),
          },
        },
        {
          provide: LearningExperienceService,
          useValue: {
            summary: signal({
              lessonsStarted: 2,
              lessonsCompleted: 1,
              quizAttempts: 12,
              uniqueQuizzesAttempted: 11,
              correctAnswers: 7,
              wrongAnswers: 2,
              averageScore: 55,
              bestScore: 90,
            }),
            overviewLoading: signal(false),
            overviewLoaded: signal(true),
            overviewError: signal(false),
            loadOverview: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: I18nService,
          useValue: { t: (key: string) => translations[key] ?? key, preferences: { language: () => 'en' } },
        },
        {
          provide: ContentService,
          useValue: { getContentDisplayInfo: (id: string) => ({ id, title: id, unavailable: false }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProgressOverviewComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Lessons completed');
    expect(fixture.nativeElement.textContent).toContain('Wrong answers');
    expect(fixture.nativeElement.querySelectorAll('.history-card')).toHaveLength(10);
    expect(fixture.nativeElement.querySelectorAll('.best-badge')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Sync failed');
    expect(fixture.nativeElement.textContent).toContain('Pending sync');
    expect(fixture.nativeElement.querySelectorAll('.sync-state')).toHaveLength(2);
    (fixture.nativeElement.querySelector('.view-more') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.history-card')).toHaveLength(12);
    expect(fixture.nativeElement.querySelector('.view-more')).toBeNull();
  });
});
