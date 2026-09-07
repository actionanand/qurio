export type Language = 'en' | 'ta' | 'hi';
export type Localized = Record<Language, string>;
export type LocalizedText = Partial<Record<Language, string>> & Record<string, string>;

export interface SupportedLanguage {
  id: Language;
  name: string;
  nativeName: string;
}
export interface Curriculum {
  id: string;
  name: string;
  isDefault?: boolean;
}
export interface GradeDefinition {
  id: number;
  label: Localized;
}
export interface SubjectDefinition {
  id: string;
  label: Localized;
  gradeScoped: boolean;
}
export interface ExamDefinition {
  id: string;
  shortName: string;
  label: Localized;
  fullName: Localized;
  category: string;
  officialInfoUrl?: string;
}
export interface ExamPlanReference {
  id: string;
  examId: string;
  entryClass: number;
  examYear: number;
  path: string;
  languages: Language[];
  demo?: boolean;
}
export interface ManifestItem {
  id: string;
  type: 'note' | 'syllabus' | 'quiz';
  path: string;
  languages: Language[];
  optional?: boolean;
  title?: LocalizedText;
  curriculum?: string;
  grade?: number;
  subject?: string;
  chapter?: string;
  topic?: string;
  seriesId?: string;
  setNumber?: number;
  sourceNoteIds?: string[];
  difficulty?: string;
  order?: number;
  estimatedMinutes?: number;
  quizIds?: string[];
  setLabel?: LocalizedText;
  timeLimitSeconds?: number;
  passingPercentage?: number;
  questionCount?: number;
}
export interface Manifest {
  schemaVersion: 2;
  contentVersion: string;
  generatedAt: string;
  defaultLanguage: Language;
  fallbackLanguage: Language;
  supportedLanguages: SupportedLanguage[];
  curricula: Curriculum[];
  grades: GradeDefinition[];
  subjects: SubjectDefinition[];
  exams: ExamDefinition[];
  examPlans: ExamPlanReference[];
  items: ManifestItem[];
}
export interface ContentDisplayInfo {
  id: string;
  type: 'note' | 'syllabus' | 'quiz' | 'unavailable';
  title: string;
  subjectLabel?: string;
  difficulty?: string;
  estimatedMinutes?: number;
  setLabel?: string;
  timeLimitSeconds?: number;
  questionCount?: number;
  item?: ManifestItem;
  unavailable: boolean;
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
  schemaVersion: 1 | 2;
  type: 'quiz';
  chapter: string;
  topic: string;
  seriesId?: string;
  setNumber?: number;
  setLabel?: string;
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
  title?: string;
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
export interface ExamPlan {
  schemaVersion: 1;
  id: string;
  type: 'exam-plan';
  examId: string;
  language: Language;
  title: string;
  subtitle: string;
  entryClass: number;
  examYear: number;
  demo?: boolean;
  officialSchedule: boolean;
  planStartDate: string;
  planEndDate: string;
  targetDate: string;
  contentRefs: ExamPlanContentRefs;
  phases: ExamPlanPhase[];
  calendarFiles: string[];
  version: number;
  updatedAt: string;
}
export interface ExamPlanContentRefs {
  overview?: string;
  syllabus?: string;
  strategy?: string;
}
export interface ExamPlanPhase {
  id: string;
  order: number;
  name: string;
  startDate: string;
  endDate: string;
}
export interface ExamCalendarMonth {
  schemaVersion: 1;
  planId: string;
  language: Language;
  month: string;
  days: ExamCalendarDay[];
}
export interface ExamCalendarDay {
  date: string;
  phaseId: string;
  weekNumber: number;
  topics: ExamTopicTask[];
  revision: ExamRevisionTask[];
  practiceQuizIds: string[];
  studyMaterialIds: string[];
  timetable: ExamTimetableEntry[];
}
export interface ExamTopicTask {
  id: string;
  subjectId: string;
  title: string;
  activityType: string;
  details?: string;
  contentId?: string;
}
export interface ExamRevisionTask {
  id: string;
  subjectId: string;
  title: string;
  activityType: string;
  details?: string;
}
export interface ExamTimetableEntry {
  id: string;
  startTime: string;
  endTime: string;
  title: string;
}
