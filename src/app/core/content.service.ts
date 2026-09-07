import { Service, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { contentConfig } from './content.config';
import { FrontmatterService } from './frontmatter.service';
import type {
  ContentDisplayInfo,
  ExamDefinition,
  ExamPlanReference,
  Language,
  Manifest,
  ManifestItem,
  Quiz,
  ResolvedContent,
  StudyDocument,
  SubjectDefinition,
} from './models';

const manifestCacheKey = 'qurio.manifest.v3';
const previousManifestCacheKeys = ['qurio.manifest.v1', 'qurio.manifest.v2'];

@Service()
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly frontmatter = inject(FrontmatterService);
  private readonly cache = new Map<string, Promise<Quiz | StudyDocument>>();
  readonly manifest = signal<Manifest | null>(null);
  private pending?: Promise<Manifest>;

  loadManifest(): Promise<Manifest> {
    this.pending ??= this.fetchManifest().catch(error => {
      const cached = this.readCachedManifest();
      if (cached) {
        this.manifest.set(cached);
        return cached;
      }
      throw error;
    });
    return this.pending;
  }

  refreshManifest(): Promise<Manifest> {
    this.pending = this.fetchManifest();
    return this.pending;
  }

  getGrades() {
    return this.manifest()?.grades ?? [];
  }

  getSubjectsForGrade(grade: number): SubjectDefinition[] {
    const manifest = this.manifest();
    if (!manifest) return [];
    const subjectIds = new Set(
      manifest.items
        .filter(item => item.grade === grade && ['syllabus', 'note', 'quiz'].includes(item.type) && item.subject)
        .map(item => item.subject as string),
    );
    return manifest.subjects.filter(subject => subjectIds.has(subject.id));
  }

  getSyllabusForSubject(grade: number, subject: string): ManifestItem[] {
    return this.itemsFor(grade, subject).filter(item => item.type === 'syllabus');
  }

  getNotesForSubject(grade: number, subject: string): ManifestItem[] {
    return this.itemsFor(grade, subject).filter(item => item.type === 'note');
  }

  getQuizzesForSubject(grade: number, subject: string): ManifestItem[] {
    return this.sortQuizSets(this.itemsFor(grade, subject).filter(item => item.type === 'quiz'));
  }

  getQuizzesForTopic(grade: number, subject: string, chapter: string, topic: string): ManifestItem[] {
    return this.sortQuizSets(
      this.getQuizzesForSubject(grade, subject).filter(item => item.chapter === chapter && item.topic === topic),
    );
  }

  getQuizSeries(
    grade: number,
    subject: string,
    chapter: string,
    topic: string,
  ): { id: string; items: ManifestItem[] }[] {
    const grouped = new Map<string, ManifestItem[]>();
    for (const item of this.getQuizzesForTopic(grade, subject, chapter, topic)) {
      const key = item.seriesId ?? item.id;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return [...grouped.entries()].map(([id, items]) => ({ id, items: this.sortQuizSets(items) }));
  }

  getSubjectLabel(subjectId: string, language: Language): string {
    const manifest = this.manifest();
    const subject = manifest?.subjects.find(subject => subject.id === subjectId);
    if (!manifest || !subject) return subjectId;
    return (
      resolveLocalizedText(subject.label, language, manifest.fallbackLanguage, manifest.defaultLanguage) ?? subjectId
    );
  }

  getContentDisplayInfo(contentId: string, language: Language): ContentDisplayInfo {
    const manifest = this.manifest();
    const item = manifest?.items.find(item => item.id === contentId);
    if (!manifest || !item) {
      return { id: contentId, type: 'unavailable', title: 'Content unavailable', unavailable: true };
    }
    const title =
      resolveLocalizedText(item.title, language, manifest.fallbackLanguage, manifest.defaultLanguage) ??
      readableContentFallback(item) ??
      item.id;
    return {
      id: item.id,
      type: item.type,
      title,
      subjectLabel: item.subject ? this.getSubjectLabel(item.subject, language) : undefined,
      difficulty: item.difficulty,
      estimatedMinutes: item.estimatedMinutes,
      setLabel:
        resolveLocalizedText(item.setLabel, language, manifest.fallbackLanguage, manifest.defaultLanguage) ?? undefined,
      timeLimitSeconds: item.timeLimitSeconds,
      questionCount: item.questionCount,
      item,
      unavailable: false,
    };
  }

  getItemById(id: string): ManifestItem | undefined {
    return this.manifest()?.items.find(item => item.id === id);
  }

  itemsFor(grade: number, subject: string): ManifestItem[] {
    return (this.manifest()?.items.filter(item => item.grade === grade && item.subject === subject) ?? []).sort(
      compareItems,
    );
  }

  getExams(): ExamDefinition[] {
    return this.manifest()?.exams ?? [];
  }

  getExamPlans(): ExamPlanReference[] {
    return this.manifest()?.examPlans ?? [];
  }

  getExamPlansForExam(examId: string): ExamPlanReference[] {
    return this.getExamPlans()
      .filter(plan => plan.examId === examId)
      .sort((a, b) => a.examYear - b.examYear || a.entryClass - b.entryClass || a.id.localeCompare(b.id));
  }

  getExamPlanById(planId: string): ExamPlanReference | undefined {
    return this.getExamPlans().find(plan => plan.id === planId);
  }

  async resolve(id: string, requestedLanguage: Language): Promise<ResolvedContent<Quiz | StudyDocument>> {
    const manifest = await this.loadManifest();
    const item = manifest.items.find(entry => entry.id === id);
    if (!item) throw new Error('Content not found');
    const resolvedLanguage = item.languages.includes(requestedLanguage) ? requestedLanguage : manifest.fallbackLanguage;
    const key = `${manifest.contentVersion}/${resolvedLanguage}/${id}`;
    let pending = this.cache.get(key);
    if (!pending) {
      pending = firstValueFrom(
        this.http.get(`${contentConfig.contentBaseUrl}/${resolvedLanguage}/${item.path}`, { responseType: 'text' }),
      )
        .then(source => {
          const content = item.type === 'quiz' ? validateQuiz(JSON.parse(source)) : this.frontmatter.parse(source);
          const metadata = 'attributes' in content ? content.attributes : content;
          if (metadata.id !== id || metadata.language !== resolvedLanguage || metadata.type !== item.type)
            throw new Error('Content identity mismatch');
          return content;
        })
        .catch(error => {
          this.cache.delete(key);
          throw error;
        });
      this.cache.set(key, pending);
    }
    return {
      requestedLanguage,
      resolvedLanguage,
      fallbackUsed: requestedLanguage !== resolvedLanguage,
      content: await pending,
    };
  }

  private async fetchManifest(): Promise<Manifest> {
    try {
      const data = await firstValueFrom(this.http.get<unknown>(`${contentConfig.contentBaseUrl}/manifest.json`));
      const manifest = validateManifest(data);
      this.manifest.set(manifest);
      this.cache.clear();
      this.saveManifest(manifest);
      return manifest;
    } catch (error) {
      this.pending = undefined;
      throw error;
    }
  }

  private readCachedManifest(): Manifest | null {
    try {
      for (const key of previousManifestCacheKeys) {
        if (localStorage.getItem(key)) localStorage.removeItem(key);
      }
      const parsed: unknown = JSON.parse(localStorage.getItem(manifestCacheKey) ?? 'null');
      if (!parsed) return null;
      return validateManifest(parsed);
    } catch {
      try {
        localStorage.removeItem(manifestCacheKey);
      } catch {
        return null;
      }
      return null;
    }
  }

  private saveManifest(manifest: Manifest) {
    try {
      localStorage.setItem(manifestCacheKey, JSON.stringify(manifest));
    } catch {
      return;
    }
  }

  private sortQuizSets(items: ManifestItem[]): ManifestItem[] {
    return [...items].sort((a, b) => (a.setNumber ?? 1) - (b.setNumber ?? 1) || a.id.localeCompare(b.id));
  }
}

export function validateManifest(value: unknown): Manifest {
  if (!isRecord(value) || value['schemaVersion'] !== 2) throw new Error('Unsupported manifest schema');
  if (
    typeof value['contentVersion'] !== 'string' ||
    typeof value['generatedAt'] !== 'string' ||
    !isLanguage(value['defaultLanguage']) ||
    !isLanguage(value['fallbackLanguage']) ||
    !Array.isArray(value['supportedLanguages']) ||
    !Array.isArray(value['curricula']) ||
    !Array.isArray(value['grades']) ||
    !Array.isArray(value['subjects']) ||
    !Array.isArray(value['exams']) ||
    !Array.isArray(value['examPlans']) ||
    !Array.isArray(value['items'])
  )
    throw new Error('Invalid manifest');
  for (const item of value['items']) {
    if (
      !isRecord(item) ||
      typeof item['id'] !== 'string' ||
      !['note', 'syllabus', 'quiz'].includes(String(item['type']))
    )
      throw new Error('Invalid manifest item');
    if (typeof item['path'] !== 'string' || item['path'].startsWith('/') || item['path'].includes('..'))
      throw new Error('Invalid manifest item path');
    if (!Array.isArray(item['languages']) || item['languages'].some(language => !isLanguage(language)))
      throw new Error('Invalid manifest item language');
  }
  return value as unknown as Manifest;
}
export function validateQuiz(value: unknown): Quiz {
  const quiz = value as Quiz;
  if (
    !quiz ||
    ![1, 2].includes(quiz.schemaVersion) ||
    quiz.type !== 'quiz' ||
    typeof quiz.title !== 'string' ||
    typeof quiz.description !== 'string' ||
    !Number.isFinite(quiz.timeLimitSeconds) ||
    quiz.timeLimitSeconds <= 0 ||
    !Number.isFinite(quiz.passingPercentage) ||
    quiz.passingPercentage < 0 ||
    quiz.passingPercentage > 100 ||
    !Array.isArray(quiz.questions) ||
    !quiz.questions.length
  )
    throw new Error('Invalid quiz');
  const ids = new Set<string>();
  for (const question of quiz.questions) {
    if (
      !question ||
      !question.id ||
      ids.has(question.id) ||
      question.type !== 'single-choice' ||
      typeof question.question !== 'string' ||
      typeof question.explanation !== 'string' ||
      !Array.isArray(question.options) ||
      question.options.length < 2 ||
      question.options.some(
        option =>
          !option ||
          typeof option.id !== 'string' ||
          typeof option.text !== 'string' ||
          typeof option.feedback !== 'string',
      ) ||
      new Set(question.options.map(option => option.id)).size !== question.options.length ||
      !question.options.some(option => option.id === question.correctOption)
    )
      throw new Error('Invalid question');
    ids.add(question.id);
  }
  return quiz;
}

export function resolveLocalizedText(
  localized: Record<string, string> | undefined,
  requestedLanguage: string,
  fallbackLanguage: string,
  defaultLanguage: string,
): string | null {
  if (!localized) return null;
  const requested = localized[requestedLanguage]?.trim();
  if (requested) return requested;
  const fallback = localized[fallbackLanguage]?.trim();
  if (fallback) return fallback;
  const defaultText = localized[defaultLanguage]?.trim();
  if (defaultText) return defaultText;
  return Object.values(localized).find(value => value.trim()) ?? null;
}

function readableContentFallback(item: ManifestItem): string | null {
  const source = item.topic ?? item.chapter;
  if (!source) return null;
  return source
    .split('-')
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}
function compareItems(a: ManifestItem, b: ManifestItem) {
  const typeOrder = { syllabus: 0, note: 1, quiz: 2 } as const;
  return typeOrder[a.type] - typeOrder[b.type] || (a.setNumber ?? 1) - (b.setNumber ?? 1) || a.id.localeCompare(b.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'ta' || value === 'hi';
}
