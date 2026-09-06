import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { contentConfig } from './content.config';
import { monthKey } from './exam-date.util';
import type { ExamCalendarMonth, ExamPlan, ExamPlanReference, Language, ResolvedContent } from './models';

@Service()
export class ExamPlanService {
  private readonly http = inject(HttpClient);
  private readonly planCache = new Map<string, Promise<ResolvedContent<ExamPlan>>>();
  private readonly markdownCache = new Map<string, Promise<ResolvedContent<string>>>();
  private readonly calendarCache = new Map<string, Promise<ResolvedContent<ExamCalendarMonth>>>();

  loadPlan(planRef: ExamPlanReference, language: Language): Promise<ResolvedContent<ExamPlan>> {
    const resolvedLanguage = planRef.languages.includes(language) ? language : 'en';
    const key = `${planRef.id}/${resolvedLanguage}/plan`;
    let pending = this.planCache.get(key);
    if (!pending) {
      pending = this.getJson<ExamPlan>(resolvedLanguage, planRef.path).then(plan => {
        validatePlan(plan, planRef.id, resolvedLanguage);
        return {
          requestedLanguage: language,
          resolvedLanguage,
          fallbackUsed: resolvedLanguage !== language,
          content: plan,
        };
      });
      this.planCache.set(key, pending);
    }
    return pending;
  }

  loadPlanMarkdown(
    planRef: ExamPlanReference,
    plan: ExamPlan,
    contentRef: keyof ExamPlan['contentRefs'],
    language: Language,
  ): Promise<ResolvedContent<string>> {
    const relativePath = plan.contentRefs[contentRef];
    if (!relativePath) return Promise.reject(new Error('Missing plan content reference'));
    const resolvedLanguage = planRef.languages.includes(language) ? language : 'en';
    const path = this.resolvePlanRelativePath(planRef, relativePath);
    const key = `${planRef.id}/${resolvedLanguage}/${path}`;
    let pending = this.markdownCache.get(key);
    if (!pending) {
      pending = firstValueFrom(
        this.http.get(`${contentConfig.contentBaseUrl}/${resolvedLanguage}/${path}`, { responseType: 'text' }),
      ).then(content => ({
        requestedLanguage: language,
        resolvedLanguage,
        fallbackUsed: resolvedLanguage !== language,
        content,
      }));
      this.markdownCache.set(key, pending);
    }
    return pending;
  }

  loadCalendar(
    planRef: ExamPlanReference,
    plan: ExamPlan,
    calendarFile: string,
    language: Language,
  ): Promise<ResolvedContent<ExamCalendarMonth>> {
    if (!plan.calendarFiles.includes(calendarFile)) return Promise.reject(new Error('Calendar month is not available'));
    const resolvedLanguage = planRef.languages.includes(language) ? language : 'en';
    const path = this.resolvePlanRelativePath(planRef, calendarFile);
    const key = `${planRef.id}/${resolvedLanguage}/${path}`;
    let pending = this.calendarCache.get(key);
    if (!pending) {
      pending = this.getJson<ExamCalendarMonth>(resolvedLanguage, path).then(month => {
        validateCalendar(month, plan.id, resolvedLanguage);
        return {
          requestedLanguage: language,
          resolvedLanguage,
          fallbackUsed: resolvedLanguage !== language,
          content: month,
        };
      });
      this.calendarCache.set(key, pending);
    }
    return pending;
  }

  getCalendarFileForMonth(plan: ExamPlan, yyyyMm: string): string | undefined {
    return plan.calendarFiles.find(file => file.endsWith(`${yyyyMm}.json`));
  }

  resolvePlanRelativePath(planRef: ExamPlanReference, relativePath: string): string {
    if (relativePath.startsWith('/') || relativePath.includes('..')) throw new Error('Unsafe plan path');
    const planDir = planRef.path.split('/').slice(0, -1).join('/');
    return `${planDir}/${relativePath}`.replace(/\/+/g, '/');
  }

  monthFromDate(plan: ExamPlan, date: string) {
    return this.getCalendarFileForMonth(plan, monthKey(date));
  }

  private getJson<T>(language: Language, path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${contentConfig.contentBaseUrl}/${language}/${path}`));
  }
}

function validatePlan(plan: ExamPlan, id: string, language: Language) {
  if (!plan || plan.schemaVersion !== 1 || plan.type !== 'exam-plan' || plan.id !== id || plan.language !== language)
    throw new Error('Invalid exam plan');
  if (!Array.isArray(plan.phases) || !Array.isArray(plan.calendarFiles)) throw new Error('Invalid exam plan');
}

function validateCalendar(month: ExamCalendarMonth, planId: string, language: Language) {
  if (
    !month ||
    month.schemaVersion !== 1 ||
    month.planId !== planId ||
    month.language !== language ||
    !Array.isArray(month.days)
  )
    throw new Error('Invalid exam calendar');
}
