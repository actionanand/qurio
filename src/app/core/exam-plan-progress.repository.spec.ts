import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ExamPlanProgressRepository } from './exam-plan-progress.repository';
import { LearnerStateRepository } from '../services/learner-state.repository';

const learningState = {
  completed: ['sci-05-photosynthesis'],
  attempts: [{ id: 'a1', quizId: 'sci-05-photosynthesis-01' }],
};

describe('ExamPlanProgressRepository', () => {
  beforeEach(() => localStorage.clear());

  it('creates stable task keys and persists plan-only completion without touching learner progress', () => {
    localStorage.setItem('qurio.progress.v1', JSON.stringify(learningState));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ExamPlanProgressRepository,
        {
          provide: LearnerStateRepository,
          useValue: {
            approvedUserId: () => null,
            loadExamTaskKeys: async () => [],
            saveExamTask: async () => undefined,
          },
        },
      ],
    });
    const repo = TestBed.inject(ExamPlanProgressRepository);
    const key = repo.taskKey('plan-1', '2026-09-05', 'revision', 'revision-1');
    expect(key).toBe('plan-1:2026-09-05:revision:revision-1');
    repo.setTaskCompleted('plan-1', '2026-09-05', key, true);
    expect(TestBed.inject(ExamPlanProgressRepository).getTaskCompletion('plan-1', key)).toBe(true);
    expect(JSON.parse(localStorage.getItem('qurio.progress.v1') ?? '{}')).toEqual(learningState);
  });
});
