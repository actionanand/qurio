import { describe, expect, it } from 'vitest';
import type { Manifest } from './models';
import { searchManifest } from './search.service';

const manifest: Manifest = {
  schemaVersion: 2,
  contentVersion: '1',
  generatedAt: '',
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  supportedLanguages: [],
  curricula: [],
  grades: [],
  exams: [],
  examPlans: [],
  subjects: [{ id: 'math', label: { en: 'Mathematics', ta: 'கணிதம்', hi: 'गणित' }, gradeScoped: true }],
  items: [
    {
      id: 'fractions-note',
      type: 'note',
      path: 'note.md',
      languages: ['en', 'ta'],
      grade: 5,
      subject: 'math',
      topic: 'equivalent-fractions',
      title: { en: 'Equivalent Fractions', ta: 'சமமான பின்னங்கள்' },
    },
    {
      id: 'fractions-quiz',
      type: 'quiz',
      path: 'quiz.json',
      languages: ['en'],
      grade: 5,
      subject: 'math',
      topic: 'equivalent-fractions',
      title: { en: 'Fraction Practice' },
    },
  ],
};

describe('searchManifest', () => {
  it('matches localized titles and topic metadata', () => {
    expect(searchManifest(manifest, 'சமமான', 'all', 'ta').map(item => item.id)).toEqual(['fractions-note']);
    expect(searchManifest(manifest, 'equivalent fractions', 'all', 'en')).toHaveLength(2);
  });
  it('filters study materials and quizzes without resolving content files', () => {
    expect(searchManifest(manifest, 'fraction', 'note', 'en').map(item => item.type)).toEqual(['note']);
    expect(searchManifest(manifest, 'fraction', 'quiz', 'en').map(item => item.type)).toEqual(['quiz']);
  });
});
