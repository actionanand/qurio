import { Service, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { contentConfig } from './content.config';
import { FrontmatterService } from './frontmatter.service';
import type { Language, Manifest, ManifestItem, Quiz, ResolvedContent, StudyDocument } from './models';

@Service()
export class ContentService {
  private readonly http = inject(HttpClient);
  private readonly frontmatter = inject(FrontmatterService);
  private readonly cache = new Map<string, Promise<Quiz | StudyDocument>>();
  readonly manifest = signal<Manifest | null>(null);
  private pending?: Promise<Manifest>;

  loadManifest(): Promise<Manifest> {
    return (this.pending ??= firstValueFrom(this.http.get<Manifest>(`${contentConfig.contentBaseUrl}/manifest.json`))
      .then(data => {
        if (
          data.schemaVersion !== 1 ||
          !Array.isArray(data.items) ||
          !Array.isArray(data.grades) ||
          !Array.isArray(data.subjects)
        )
          throw new Error('Invalid manifest');
        if (
          data.items.some(item => !item.id || !/^[\w/-]+\.(md|json)$/.test(item.path) || !Array.isArray(item.languages))
        )
          throw new Error('Invalid manifest item');
        this.manifest.set(data);
        return data;
      })
      .catch(error => {
        this.pending = undefined;
        throw error;
      }));
  }

  itemsFor(grade: number, subject: string): ManifestItem[] {
    return (
      this.manifest()?.items.filter(item =>
        item.path.startsWith(`grade-${String(grade).padStart(2, '0')}/${subject}/`),
      ) ?? []
    );
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
}

export function validateQuiz(value: unknown): Quiz {
  const quiz = value as Quiz;
  if (
    !quiz ||
    quiz.schemaVersion !== 1 ||
    quiz.type !== 'quiz' ||
    typeof quiz.title !== 'string' ||
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
