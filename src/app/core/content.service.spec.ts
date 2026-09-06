import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentConfig } from './content.config';
import { ContentService, validateManifest, validateQuiz } from './content.service';

const manifest = {
  schemaVersion: 2,
  contentVersion: 'test-v2',
  generatedAt: '2026-09-05T00:00:00Z',
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  supportedLanguages: [],
  curricula: [],
  grades: [{ id: 5, label: { en: 'Class 5', ta: 'Class 5', hi: 'Class 5' } }],
  subjects: [
    { id: 'mathematics', label: { en: 'Mathematics', ta: 'Math', hi: 'Math' }, gradeScoped: true },
    { id: 'general-knowledge', label: { en: 'General Knowledge', ta: 'GK', hi: 'GK' }, gradeScoped: false },
  ],
  exams: [
    {
      id: 'aissee',
      shortName: 'AISSEE',
      label: { en: 'Sainik School Entrance', ta: 'AISSEE', hi: 'AISSEE' },
      fullName: { en: 'All India Sainik Schools Entrance Examination', ta: 'AISSEE', hi: 'AISSEE' },
      category: 'school-entrance',
    },
  ],
  examPlans: [
    {
      id: 'aissee-2027-class-06-demo',
      examId: 'aissee',
      entryClass: 6,
      examYear: 2027,
      path: 'exams/aissee/class-06/2027/plan.json',
      languages: ['en'],
    },
  ],
  items: [
    {
      id: 'math-note',
      type: 'note',
      path: 'grade-05/mathematics/notes/fractions/equivalent-fractions.md',
      languages: ['en'],
      grade: 5,
      subject: 'mathematics',
      chapter: 'fractions',
      topic: 'equivalent-fractions',
    },
    {
      id: 'quiz-3',
      type: 'quiz',
      path: 'grade-05/mathematics/quizzes/equivalent-fractions-03.json',
      languages: ['en'],
      grade: 5,
      subject: 'mathematics',
      chapter: 'fractions',
      topic: 'equivalent-fractions',
      seriesId: 'series',
      setNumber: 3,
    },
    {
      id: 'quiz-1',
      type: 'quiz',
      path: 'grade-05/mathematics/quizzes/equivalent-fractions-01.json',
      languages: ['en'],
      grade: 5,
      subject: 'mathematics',
      chapter: 'fractions',
      topic: 'equivalent-fractions',
      seriesId: 'series',
      setNumber: 1,
    },
    {
      id: 'quiz-2',
      type: 'quiz',
      path: 'grade-05/mathematics/quizzes/equivalent-fractions-02.json',
      languages: ['en'],
      grade: 5,
      subject: 'mathematics',
      chapter: 'fractions',
      topic: 'equivalent-fractions',
      seriesId: 'series',
      setNumber: 2,
    },
  ],
} as const;

describe('ContentService', () => {
  let service: ContentService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ContentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('parses manifest v2 and rejects unsupported cached manifest v1', async () => {
    localStorage.setItem('qurio.manifest.v2', JSON.stringify({ schemaVersion: 1, items: [] }));
    const pending = service.loadManifest();
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush(manifest);
    await expect(pending).resolves.toMatchObject({ schemaVersion: 2, contentVersion: 'test-v2' });
  });

  it('filters subjects and items using explicit metadata', async () => {
    const pending = service.loadManifest();
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush(manifest);
    await pending;
    expect(service.getSubjectsForGrade(5).map(subject => subject.id)).toEqual(['mathematics']);
    expect(service.itemsFor(5, 'mathematics').map(item => item.id)).toContain('math-note');
  });

  it('returns all quiz sets sorted by setNumber and grouped by seriesId', async () => {
    const pending = service.loadManifest();
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush(manifest);
    await pending;
    expect(
      service.getQuizzesForTopic(5, 'mathematics', 'fractions', 'equivalent-fractions').map(item => item.id),
    ).toEqual(['quiz-1', 'quiz-2', 'quiz-3']);
    expect(service.getQuizSeries(5, 'mathematics', 'fractions', 'equivalent-fractions')).toEqual([
      { id: 'series', items: [manifest.items[2], manifest.items[3], manifest.items[1]] },
    ]);
  });

  it('looks up exam plan references', async () => {
    const pending = service.loadManifest();
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush(manifest);
    await pending;
    expect(service.getExamPlansForExam('aissee')[0].id).toBe('aissee-2027-class-06-demo');
  });

  it('resolves fallback centrally and reuses the resolved-language cache', async () => {
    const pending = service.resolve('math-note', 'ta');
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush(manifest);
    http
      .expectOne(`${contentConfig.contentBaseUrl}/en/grade-05/mathematics/notes/fractions/equivalent-fractions.md`)
      .flush(
        '---\nid: math-note\ntitle: Fractions\ntype: note\nlanguage: en\ncurriculum: general\ngrade: 5\nsubject: mathematics\nversion: 1\nupdatedAt: 2026-09-05\nchapter: fractions\ntopic: equivalent-fractions\norder: 1\nquizIds:\n  - quiz-1\n  - quiz-2\n  - quiz-3\n---\n# Fractions',
      );
    const result = await pending;
    expect(result).toMatchObject({ requestedLanguage: 'ta', resolvedLanguage: 'en', fallbackUsed: true });
  });

  it('rejects malformed manifest and quiz data', () => {
    expect(() => validateManifest({ schemaVersion: 1 })).toThrow();
    expect(() => validateQuiz({})).toThrow();
  });
});
