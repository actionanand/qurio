import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProgressService } from './progress.service';
import { LearnerStateRepository } from '../services/learner-state.repository';
import { PreferencesService } from './preferences.service';

describe('ProgressService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProgressService,
        { provide: PreferencesService, useValue: { language: () => 'en' } },
        {
          provide: LearnerStateRepository,
          useValue: {
            approvedUserId: () => null,
            loadCompletedContent: async () => [],
            loadAttempts: async () => [],
            saveStudyProgress: async () => undefined,
            submitAttempt: async () => undefined,
          },
        },
      ],
    });
  });

  it('stores completion once by stable content ID', () => {
    const progress = TestBed.inject(ProgressService);
    progress.complete('math-05-equivalent-fractions');
    progress.complete('math-05-equivalent-fractions');
    expect(progress.completed()).toEqual(['math-05-equivalent-fractions']);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ProgressService,
        { provide: PreferencesService, useValue: { language: () => 'en' } },
        { provide: LearnerStateRepository, useValue: { approvedUserId: () => null } },
      ],
    });
    expect(TestBed.inject(ProgressService).completed()).toEqual(progress.completed());
  });

  it('recovers from corrupt device data', () => {
    localStorage.setItem('qurio.progress.v1', '{broken');
    expect(TestBed.inject(ProgressService).completed()).toEqual([]);
  });
});
