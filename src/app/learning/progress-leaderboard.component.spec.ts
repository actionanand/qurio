import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { LearningExperienceService } from '../core/learning-experience.service';
import { ProgressLeaderboardComponent } from './progress-leaderboard.component';

describe('ProgressLeaderboardComponent', () => {
  it('builds localized active labels from manifest metadata without resolving quiz files', () => {
    const loadLeaderboard = vi.fn().mockResolvedValue(undefined);
    const resolve = vi.fn();
    const manifest = signal({
      items: [
        {
          id: 'math-note',
          type: 'note',
          grade: 5,
          subject: 'mathematics',
          topic: 'equivalent-fractions',
        },
        {
          id: 'math-quiz',
          type: 'quiz',
          grade: 5,
          subject: 'mathematics',
          topic: 'equivalent-fractions',
        },
      ],
    });
    TestBed.configureTestingModule({
      imports: [ProgressLeaderboardComponent],
      providers: [
        {
          provide: LearningExperienceService,
          useValue: {
            leaderboard: signal([
              {
                rank: 1,
                displayName: 'Current learner',
                points: 100,
                averageScore: 100,
                quizzesCompleted: 1,
                correctAnswers: 10,
                isCurrentUser: true,
              },
            ]),
            myRank: signal({
              rank: 1,
              displayName: 'Current learner',
              points: 100,
              averageScore: 100,
              quizzesCompleted: 1,
              correctAnswers: 10,
              isCurrentUser: true,
            }),
            loading: signal(false),
            error: signal(false),
            loadLeaderboard,
          },
        },
        {
          provide: ContentService,
          useValue: {
            manifest,
            resolve,
            getSubjectLabel: () => 'Mathematics',
            getContentDisplayInfo: (id: string) => ({
              title: id === 'math-note' ? 'Equivalent Fractions' : 'Practice Set 1',
            }),
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: (key: string) =>
              ({ class: 'Grade', overall: 'Overall', grade: 'Grade', subject: 'Subject', topic: 'Topic' })[key] ?? key,
            count: (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`,
            preferences: { language: () => 'en' },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProgressLeaderboardComponent);
    const component = fixture.componentInstance;
    component.setScope('topic');
    fixture.detectChanges();
    expect(component.activeSelection()).toBe('Grade 5 · Mathematics · Equivalent Fractions');
    expect(fixture.nativeElement.textContent).toContain('Grade 5 · Mathematics · Equivalent Fractions');
    expect(fixture.nativeElement.querySelectorAll('.leaderboard-row.current')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.leaderboard-row.podium')).toHaveLength(1);
    expect(resolve).not.toHaveBeenCalled();
  });
});
