import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { contentConfig } from './content.config';
import { ExamPlanService } from './exam-plan.service';
import type { ExamPlanReference } from './models';

const ref: ExamPlanReference = {
  id: 'aissee-2027-class-06-demo',
  examId: 'aissee',
  entryClass: 6,
  examYear: 2027,
  path: 'exams/aissee/class-06/2027/plan.json',
  languages: ['en'],
};

describe('ExamPlanService', () => {
  let service: ExamPlanService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ExamPlanService);
    http = TestBed.inject(HttpTestingController);
  });

  it('resolves plan-relative content and calendar paths safely', () => {
    expect(service.resolvePlanRelativePath(ref, 'syllabus.md')).toBe('exams/aissee/class-06/2027/syllabus.md');
    expect(service.resolvePlanRelativePath(ref, 'calendar/2026-09.json')).toBe(
      'exams/aissee/class-06/2027/calendar/2026-09.json',
    );
    expect(() => service.resolvePlanRelativePath(ref, '../secret.md')).toThrow();
  });

  it('falls back Tamil plan requests to English', async () => {
    const pending = service.loadPlan(ref, 'ta');
    http.expectOne(`${contentConfig.contentBaseUrl}/en/exams/aissee/class-06/2027/plan.json`).flush({
      schemaVersion: 1,
      id: ref.id,
      type: 'exam-plan',
      examId: 'aissee',
      language: 'en',
      title: 'Plan',
      subtitle: 'Demo',
      entryClass: 6,
      examYear: 2027,
      officialSchedule: false,
      planStartDate: '2026-04-01',
      planEndDate: '2027-01-31',
      targetDate: '2027-01-31',
      contentRefs: { syllabus: 'syllabus.md' },
      phases: [],
      calendarFiles: ['calendar/2026-09.json'],
      version: 1,
      updatedAt: '2026-09-05',
    });
    await expect(pending).resolves.toMatchObject({
      requestedLanguage: 'ta',
      resolvedLanguage: 'en',
      fallbackUsed: true,
    });
  });
});
