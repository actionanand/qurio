import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentConfig } from './content.config';
import { ContentService, validateManifest, validateQuiz } from './content.service';
import type { Manifest, ManifestItem } from './models';

const title = (en: string) => ({ en, ta: `${en} TA`, hi: `${en} HI` });
const note = (
  id: string,
  chapter: string,
  topic: string,
  order: number,
  displayTitle: string,
  path = `grade-05/mathematics/topics/${chapter}/${topic}/study.md`,
): ManifestItem => ({
  id,
  type: 'note',
  path,
  languages: ['en'],
  title: title(displayTitle),
  curriculum: 'general',
  grade: 5,
  subject: 'mathematics',
  chapter,
  topic,
  order,
  difficulty: 'Beginner',
  estimatedMinutes: 12,
});
const quiz = (
  id: string,
  noteId: string | undefined,
  chapter: string,
  topic: string,
  setNumber: number,
  displayTitle: string,
  path = `grade-05/mathematics/topics/${chapter}/${topic}/quizzes/0${setNumber}.json`,
): ManifestItem => ({
  id,
  type: 'quiz',
  path,
  languages: ['en'],
  title: title(displayTitle),
  curriculum: 'general',
  grade: 5,
  subject: 'mathematics',
  chapter,
  topic,
  sourceNoteIds: noteId ? [noteId] : undefined,
  seriesId: `${topic}-series`,
  setNumber,
  setLabel: title(`Practice Set ${setNumber}`),
  questionCount: 5,
  timeLimitSeconds: 300,
});

const fractions = note('math-05-equivalent-fractions', 'fractions', 'equivalent-fractions', 1, 'Equivalent Fractions');
const probability = note('math-05-probability', 'data-handling', 'probability', 2, 'Probability');
const factorial = note('math-05-factorial', 'number-operations', 'factorial', 3, 'Factorial');
const primes = note('math-05-prime-numbers', 'numbers', 'prime-numbers', 4, 'Prime Numbers');

const manifest: Manifest = {
  schemaVersion: 2,
  contentVersion: 'topic-layout-v1',
  generatedAt: '2026-09-08T00:00:00Z',
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  supportedLanguages: [],
  curricula: [{ id: 'general', name: 'General', isDefault: true }],
  grades: [
    { id: 5, label: title('Grade 5') },
    { id: 6, label: title('Grade 6') },
  ],
  subjects: [
    { id: 'mathematics', label: title('Mathematics'), gradeScoped: true },
    { id: 'science', label: title('Science'), gradeScoped: true },
  ],
  exams: [
    {
      id: 'aissee',
      shortName: 'AISSEE',
      label: title('Sainik School Entrance'),
      fullName: title('All India Sainik Schools Entrance Examination'),
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
      id: 'math-05-syllabus',
      type: 'syllabus',
      path: 'grade-05/mathematics/syllabus.md',
      languages: ['en'],
      title: title('Mathematics — Grade 5 Syllabus'),
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
    },
    fractions,
    { ...fractions },
    probability,
    factorial,
    primes,
    quiz(
      'math-05-equivalent-fractions-03',
      fractions.id,
      'fractions',
      'equivalent-fractions',
      3,
      'Equivalent Fractions',
    ),
    quiz(
      'math-05-equivalent-fractions-03',
      fractions.id,
      'fractions',
      'equivalent-fractions',
      3,
      'Equivalent Fractions',
    ),
    quiz(
      'math-05-equivalent-fractions-01',
      fractions.id,
      'fractions',
      'equivalent-fractions',
      1,
      'Equivalent Fractions',
    ),
    quiz(
      'math-05-equivalent-fractions-02',
      fractions.id,
      'fractions',
      'equivalent-fractions',
      2,
      'Equivalent Fractions',
    ),
    quiz('math-05-probability-02', probability.id, 'data-handling', 'probability', 2, 'Probability'),
    {
      ...quiz(
        'math-05-probability-01',
        probability.id,
        'unrelated',
        'transport-independent',
        1,
        'Probability',
        'opaque/x9.json',
      ),
      seriesId: 'probability-series',
    },
    quiz('math-05-factorial-02', undefined, 'number-operations', 'factorial', 2, 'Factorial', 'opaque/archive/b.json'),
    quiz('math-05-factorial-01', undefined, 'number-operations', 'factorial', 1, 'Factorial', 'opaque/archive/a.json'),
    quiz('math-05-prime-numbers-02', primes.id, 'numbers', 'prime-numbers', 2, 'Prime Numbers'),
    quiz('math-05-prime-numbers-01', primes.id, 'numbers', 'prime-numbers', 1, 'Prime Numbers'),
    {
      ...note(
        'science-05-photosynthesis',
        'plants',
        'photosynthesis',
        1,
        'Photosynthesis',
        'grade-05/science/topics/plants/photosynthesis/study.md',
      ),
      subject: 'science',
    },
    {
      ...quiz(
        'science-05-photosynthesis-01',
        'science-05-photosynthesis',
        'plants',
        'photosynthesis',
        1,
        'Photosynthesis',
        'grade-05/science/topics/plants/photosynthesis/quizzes/01.json',
      ),
      subject: 'science',
    },
  ],
};

describe('ContentService', () => {
  let service: ContentService;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ContentService);
    http = TestBed.inject(HttpTestingController);
    const pending = service.loadManifest();
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush(manifest);
    await pending;
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('uses schema v2 while preserving exams and exam plans', () => {
    expect(validateManifest(manifest).schemaVersion).toBe(2);
    expect(service.getExamPlansForExam('aissee')[0].id).toBe('aissee-2027-class-06-demo');
  });

  it('returns only subject study materials in manifest order', () => {
    expect(service.getStudyMaterialsForSubject(5, 'mathematics').map(item => item.id)).toEqual([
      fractions.id,
      probability.id,
      factorial.id,
      primes.id,
    ]);
  });

  it('deduplicates repeated manifest records by stable content ID', () => {
    expect(service.getStudyMaterialsForSubject(5, 'mathematics').filter(item => item.id === fractions.id)).toHaveLength(
      1,
    );
    expect(
      service.getQuizzesForSubject(5, 'mathematics').filter(item => item.id === 'math-05-equivalent-fractions-03'),
    ).toHaveLength(1);
  });

  it('returns every Mathematics quiz and excludes Science', () => {
    const ids = service.getQuizzesForSubject(5, 'mathematics').map(item => item.id);
    expect(ids).toHaveLength(9);
    expect(ids).not.toContain('science-05-photosynthesis-01');
  });

  it('filters Probability using sourceNoteIds even when its path and topic metadata are unrelated', () => {
    expect(service.getQuizzesForStudyMaterial(probability.id).map(item => item.id)).toEqual([
      'math-05-probability-01',
      'math-05-probability-02',
    ]);
  });

  it('uses metadata fallback and set ordering for Factorial when sourceNoteIds is absent', () => {
    expect(service.getQuizzesForStudyMaterial(factorial.id).map(item => item.id)).toEqual([
      'math-05-factorial-01',
      'math-05-factorial-02',
    ]);
  });

  it('returns all subject quizzes for the UI All sentinel', () => {
    expect(service.getQuizzesForSelection(5, 'mathematics', '__all__')).toHaveLength(9);
  });

  it('uses localized manifest metadata and never filenames for display labels', () => {
    expect(service.getContentDisplayInfo('math-05-probability-01', 'en').title).toBe('Probability');
    expect(service.getContentDisplayInfo('math-05-factorial-01', 'en').title).not.toContain('a.json');
  });

  it('fetches a note using the exact manifest path', async () => {
    const pending = service.resolve(fractions.id, 'en');
    await Promise.resolve();
    http
      .expectOne(
        `${contentConfig.contentBaseUrl}/en/grade-05/mathematics/topics/fractions/equivalent-fractions/study.md`,
      )
      .flush(
        '---\nid: math-05-equivalent-fractions\ntitle: Equivalent Fractions\ntype: note\nlanguage: en\ncurriculum: general\ngrade: 5\nsubject: mathematics\nversion: 1\nupdatedAt: 2026-09-08\nchapter: fractions\ntopic: equivalent-fractions\norder: 1\n---\n# Fractions',
      );
    await expect(pending).resolves.toMatchObject({ fallbackUsed: false });
  });

  it('fetches a quiz using the exact opaque manifest path without reconstruction', async () => {
    const pending = service.resolve('math-05-probability-01', 'en');
    await Promise.resolve();
    http.expectOne(`${contentConfig.contentBaseUrl}/en/opaque/x9.json`).flush({
      schemaVersion: 2,
      id: 'math-05-probability-01',
      type: 'quiz',
      title: 'Probability',
      description: 'Practice',
      language: 'en',
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
      chapter: 'unrelated',
      topic: 'transport-independent',
      version: 1,
      updatedAt: '2026-09-08',
      timeLimitSeconds: 60,
      passingPercentage: 60,
      shuffleQuestions: false,
      shuffleOptions: false,
      sourceNoteIds: [probability.id],
      questions: [
        {
          id: 'q1',
          type: 'single-choice',
          question: 'Question?',
          options: [
            { id: 'a', text: 'A', feedback: 'Yes' },
            { id: 'b', text: 'B', feedback: 'No' },
          ],
          correctOption: 'a',
          explanation: 'Because.',
        },
      ],
    });
    await expect(pending).resolves.toMatchObject({ content: { id: 'math-05-probability-01' } });
  });

  it('rejects malformed manifest and quiz data', () => {
    expect(() => validateManifest({ schemaVersion: 1 })).toThrow();
    expect(() => validateQuiz({})).toThrow();
  });
});
