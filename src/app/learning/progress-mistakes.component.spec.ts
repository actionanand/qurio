import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { LearningExperienceService } from '../core/learning-experience.service';
import { PreferencesService } from '../core/preferences.service';
import { ProgressMistakesComponent } from './progress-mistakes.component';

describe('ProgressMistakesComponent', () => {
  const resolve = vi.fn();
  const loadWrongAnswerDetails = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resolve.mockResolvedValue({
      content: {
        id: 'quiz-1',
        schemaVersion: 2,
        type: 'quiz',
        title: 'Fractions',
        language: 'en',
        curriculum: 'cbse',
        grade: 5,
        subject: 'mathematics',
        chapter: 'fractions',
        topic: 'equivalent-fractions',
        version: 1,
        updatedAt: '2026-09-15',
        description: '',
        timeLimitSeconds: 60,
        passingPercentage: 60,
        shuffleQuestions: false,
        shuffleOptions: false,
        sourceNoteIds: [],
        questions: [
          {
            id: 'question-1',
            type: 'single-choice',
            question: 'Which fraction equals one half?',
            options: [
              { id: 'a', text: '2/4', feedback: '' },
              { id: 'b', text: '1/3', feedback: '' },
            ],
            correctOption: 'a',
            explanation: 'Two of four equal parts is one half.',
          },
        ],
      },
    });
    loadWrongAnswerDetails.mockResolvedValue([
      {
        quizId: 'quiz-1',
        questionId: 'question-1',
        selectedOptionId: 'b',
        correctOptionId: 'a',
        answeredAt: '2026-09-15T10:00:00.000Z',
      },
    ]);
  });

  it('uses singular wording and lazily loads quiz and answer details on expansion', async () => {
    const translations: Record<string, string> = {
      questionMissed: 'question missed',
      questionsMissed: 'questions missed',
      wrongAnswer: 'wrong answer',
      wrongAnswers: 'wrong answers',
      yourAnswer: 'Your answer',
      correctAnswer: 'Correct answer',
      explanation: 'Explanation',
    };
    TestBed.configureTestingModule({
      imports: [ProgressMistakesComponent],
      providers: [
        provideRouter([]),
        {
          provide: LearningExperienceService,
          useValue: {
            mistakes: signal([
              {
                quiz_id: 'quiz-1',
                question_id: 'question-1',
                attempts: 1,
                wrong_count: 1,
                last_wrong_at: '2026-09-15T10:00:00.000Z',
              },
            ]),
            mistakesLoading: signal(false),
            mistakesLoaded: signal(true),
            mistakesError: signal(false),
            loadMistakes: vi.fn().mockResolvedValue(undefined),
            loadWrongAnswerDetails,
          },
        },
        {
          provide: ContentService,
          useValue: {
            resolve,
            getContentDisplayInfo: () => ({ title: 'Fractions — Practice', unavailable: false }),
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: (key: string) => translations[key] ?? key,
            count: (value: number, one: string, many: string) => `${value} ${translations[value === 1 ? one : many]}`,
            preferences: { language: () => 'en' },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProgressMistakesComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1 question missed');
    expect(resolve).not.toHaveBeenCalled();
    expect(loadWrongAnswerDetails).not.toHaveBeenCalled();
    await fixture.componentInstance.toggle('quiz-1');
    fixture.detectChanges();
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(loadWrongAnswerDetails).toHaveBeenCalledWith('quiz-1', ['question-1']);
    expect(fixture.nativeElement.textContent).toContain('Which fraction equals one half?');
    expect(fixture.nativeElement.textContent).toContain('Your answer');
    expect(fixture.nativeElement.textContent).toContain('1/3');
    expect(fixture.nativeElement.textContent).toContain('Correct answer');
    expect(fixture.nativeElement.textContent).toContain('2/4');
    fixture.componentInstance.answerDetails.set({ 'quiz-1': {} });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Your answer');
    expect(fixture.nativeElement.textContent).toContain('2/4');
  });

  it('formats plural missed-question wording', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [I18nService, { provide: PreferencesService, useValue: { language: () => 'en' } }],
    });
    expect(TestBed.inject(I18nService).count(2, 'questionMissed', 'questionsMissed')).toBe('2 questions missed');
  });
});
