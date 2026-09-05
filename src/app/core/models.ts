export type Language = 'en' | 'ta' | 'hi';
export type Localized = Record<Language, string>;
export interface ManifestItem {
  id: string;
  type: 'note' | 'syllabus' | 'quiz';
  path: string;
  languages: Language[];
  optional?: boolean;
}
export interface Manifest {
  schemaVersion: number;
  contentVersion: string;
  generatedAt: string;
  defaultLanguage: Language;
  fallbackLanguage: Language;
  supportedLanguages: { id: Language; name: string; nativeName: string }[];
  curricula: { id: string; name: string; isDefault?: boolean }[];
  grades: { id: number; label: Localized }[];
  subjects: { id: string; label: Localized; gradeScoped: boolean }[];
  items: ManifestItem[];
}
export interface ContentMetadata {
  id: string;
  title: string;
  language: Language;
  curriculum: string;
  grade: number;
  subject: string;
  version: number;
  updatedAt: string;
}
export interface NoteAttributes extends ContentMetadata {
  type: 'note';
  chapter: string;
  topic: string;
  order: number;
  difficulty?: string;
  estimatedMinutes?: number;
  quizIds?: string[];
  tags?: string[];
}
export interface SyllabusAttributes extends ContentMetadata {
  type: 'syllabus';
  optional?: boolean;
}
export interface StudyDocument {
  attributes: NoteAttributes | SyllabusAttributes;
  body: string;
}
export interface Option {
  id: string;
  text: string;
  feedback: string;
}
export interface Question {
  id: string;
  type: 'single-choice';
  question: string;
  hint?: string;
  options: Option[];
  correctOption: string;
  explanation: string;
}
export interface Quiz extends ContentMetadata {
  schemaVersion: number;
  type: 'quiz';
  chapter: string;
  topic: string;
  description: string;
  difficulty?: string;
  timeLimitSeconds: number;
  passingPercentage: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  sourceNoteIds: string[];
  questions: Question[];
}
export interface ResolvedContent<T> {
  requestedLanguage: Language;
  resolvedLanguage: Language;
  fallbackUsed: boolean;
  content: T;
}
export interface Attempt {
  id: string;
  quizId: string;
  total: number;
  correct: number;
  wrong: number;
  unanswered: number;
  scorePercentage: number;
  passed: boolean;
  elapsedSeconds: number;
  completedAt: string;
  languageUsed: Language;
  autoSubmitted: boolean;
}
