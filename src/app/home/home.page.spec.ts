import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentConfig } from '../core/content.config';
import type { Manifest } from '../core/models';
import { ALL_STUDY_MATERIALS, HomePage } from './home.page';

const labels = (en: string) => ({ en, ta: `${en} TA`, hi: `${en} HI` });
const manifest: Manifest = {
  schemaVersion: 2,
  contentVersion: 'home-topic-layout',
  generatedAt: '2026-09-08T00:00:00Z',
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  supportedLanguages: [],
  curricula: [{ id: 'general', name: 'General', isDefault: true }],
  grades: [
    { id: 5, label: labels('Grade 5') },
    { id: 6, label: labels('Grade 6') },
  ],
  subjects: [
    { id: 'mathematics', label: labels('Mathematics'), gradeScoped: true },
    { id: 'science', label: labels('Science'), gradeScoped: true },
  ],
  exams: [],
  examPlans: [],
  items: [
    {
      id: 'math-syllabus',
      type: 'syllabus',
      path: 'grade-05/mathematics/syllabus.md',
      languages: ['en'],
      title: labels('Mathematics — Grade 5 Syllabus'),
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
    },
    {
      id: 'fractions',
      type: 'note',
      path: 'opaque/study-a.md',
      languages: ['en'],
      title: labels('Equivalent Fractions'),
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
      chapter: 'fractions',
      topic: 'equivalent-fractions',
      order: 1,
    },
    {
      id: 'probability',
      type: 'note',
      path: 'opaque/study-b.md',
      languages: ['en'],
      title: labels('Probability'),
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
      chapter: 'data-handling',
      topic: 'probability',
      order: 2,
    },
    {
      id: 'probability',
      type: 'note',
      path: 'opaque/study-b.md',
      languages: ['en'],
      title: labels('Probability'),
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
      chapter: 'data-handling',
      topic: 'probability',
      order: 2,
    },
    {
      id: 'fractions-01',
      type: 'quiz',
      path: 'opaque/q-a.json',
      languages: ['en'],
      title: labels('Equivalent Fractions'),
      setLabel: labels('Practice Set 1'),
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
      chapter: 'fractions',
      topic: 'equivalent-fractions',
      sourceNoteIds: ['fractions'],
      seriesId: 'fractions',
      setNumber: 1,
    },
    {
      id: 'probability-01',
      type: 'quiz',
      path: 'opaque/q-b.json',
      languages: ['en'],
      title: labels('Probability'),
      setLabel: labels('Practice Set 1'),
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
      chapter: 'data-handling',
      topic: 'probability',
      sourceNoteIds: ['probability'],
      seriesId: 'probability',
      setNumber: 1,
    },
    {
      id: 'probability-01',
      type: 'quiz',
      path: 'opaque/q-b.json',
      languages: ['en'],
      title: labels('Probability'),
      setLabel: labels('Practice Set 1'),
      curriculum: 'general',
      grade: 5,
      subject: 'mathematics',
      chapter: 'data-handling',
      topic: 'probability',
      sourceNoteIds: ['probability'],
      seriesId: 'probability',
      setNumber: 1,
    },
    {
      id: 'science-05-note',
      type: 'note',
      path: 'opaque/science-five.md',
      languages: ['en'],
      title: labels('Photosynthesis'),
      curriculum: 'general',
      grade: 5,
      subject: 'science',
      chapter: 'plants',
      topic: 'photosynthesis',
      order: 1,
    },
    {
      id: 'science-06-note',
      type: 'note',
      path: 'opaque/science.md',
      languages: ['en'],
      title: labels('Living Things'),
      curriculum: 'general',
      grade: 6,
      subject: 'science',
      chapter: 'biology',
      topic: 'living-things',
      order: 1,
    },
  ],
};

describe('HomePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  async function createHome() {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush(manifest);
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders grade, subject, separate syllabus, and manifest study options including All', async () => {
    const fixture = await createHome();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Grade 5');
    expect(text).toContain('Mathematics');
    expect(text).toContain('Mathematics — Grade 5 Syllabus');
    expect(text).toContain('View Syllabus');
    expect(text).toContain('All');
    expect(text).toContain('Equivalent Fractions');
    expect(text).toContain('Probability');
    expect(fixture.componentInstance.quizOptions()).toHaveLength(2);
  });

  it('filters quizzes by study material and clears the selected quiz when the topic changes', async () => {
    const fixture = await createHome();
    const page = fixture.componentInstance;
    page.selectStudyMaterial('probability');
    expect(page.quizOptions().map(item => item.id)).toEqual(['probability-01']);
    page.selectQuiz('probability-01');
    expect(page.selectedQuizId()).toBe('probability-01');

    page.selectStudyMaterial('fractions');
    expect(page.quizOptions().map(item => item.id)).toEqual(['fractions-01']);
    expect(page.selectedQuizId()).toBe('');

    page.selectStudyMaterial(ALL_STUDY_MATERIALS);
    expect(page.quizOptions()).toHaveLength(2);
  });

  it('resets study material and quiz when grade or subject changes', async () => {
    const fixture = await createHome();
    const page = fixture.componentInstance;
    page.selectStudyMaterial('probability');
    page.selectQuiz('probability-01');
    page.selectGrade(6);
    expect(page.subject()).toBe('science');
    expect(page.selectedStudyMaterialId()).toBe(ALL_STUDY_MATERIALS);
    expect(page.selectedQuizId()).toBe('');

    page.selectGrade(5);
    page.selectStudyMaterial('fractions');
    page.selectQuiz('fractions-01');
    page.selectSubject('science');
    expect(page.selectedStudyMaterialId()).toBe(ALL_STUDY_MATERIALS);
    expect(page.selectedQuizId()).toBe('');
  });

  it('browses selections with only the manifest request', async () => {
    const fixture = await createHome();
    const page = fixture.componentInstance;
    page.selectStudyMaterial('probability');
    page.selectQuiz('probability-01');
    page.selectStudyMaterial(ALL_STUDY_MATERIALS);
    fixture.detectChanges();
    http.expectNone(request => request.url !== `${contentConfig.contentBaseUrl}/manifest.json`);
  });
});
