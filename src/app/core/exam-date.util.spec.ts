import { describe, expect, it } from 'vitest';
import {
  currentPhase,
  daysUntilTarget,
  formatDateKey,
  monthKey,
  monthsRemaining,
  nearestAvailableDate,
  parseLocalDate,
  phaseState,
} from './exam-date.util';
import type { ExamPlan } from './models';

const plan: ExamPlan = {
  schemaVersion: 1,
  id: 'aissee-2027-class-06-demo',
  type: 'exam-plan',
  examId: 'aissee',
  language: 'en',
  title: 'AISSEE 2027',
  subtitle: 'Class 6',
  entryClass: 6,
  examYear: 2027,
  officialSchedule: false,
  planStartDate: '2026-04-01',
  planEndDate: '2027-01-31',
  targetDate: '2027-01-31',
  contentRefs: { syllabus: 'syllabus.md', strategy: 'strategy.md' },
  phases: [
    { id: 'phase-1', order: 1, name: 'Foundation', startDate: '2026-04-01', endDate: '2026-05-31' },
    { id: 'phase-3', order: 3, name: 'Practice', startDate: '2026-09-01', endDate: '2026-09-30' },
  ],
  calendarFiles: ['calendar/2026-09.json'],
  version: 1,
  updatedAt: '2026-09-05',
};

describe('exam date utilities', () => {
  it('parses YYYY-MM-DD as a local date without shifting the calendar day', () => {
    expect(formatDateKey(parseLocalDate('2026-09-05'))).toBe('2026-09-05');
    expect(monthKey('2026-09-05')).toBe('2026-09');
  });

  it('calculates days and months remaining from local calendar dates', () => {
    const today = parseLocalDate('2026-09-05');
    expect(daysUntilTarget('2026-09-07', today)).toBe(2);
    expect(monthsRemaining('2026-12-05', today)).toBe(3);
  });

  it('detects current phase and phase state', () => {
    const today = parseLocalDate('2026-09-05');
    expect(currentPhase(plan, today)?.id).toBe('phase-3');
    expect(phaseState(plan.phases[0], today)).toBe('completed');
    expect(phaseState(plan.phases[1], today)).toBe('current');
  });

  it('selects nearest available calendar day when the selected date has no plan', () => {
    expect(
      nearestAvailableDate(
        [
          {
            date: '2026-09-04',
            phaseId: 'phase-3',
            weekNumber: 22,
            topics: [],
            revision: [],
            practiceQuizIds: [],
            studyMaterialIds: [],
            timetable: [],
          },
          {
            date: '2026-09-06',
            phaseId: 'phase-3',
            weekNumber: 22,
            topics: [],
            revision: [],
            practiceQuizIds: [],
            studyMaterialIds: [],
            timetable: [],
          },
        ],
        '2026-09-05',
      ),
    ).toBe('2026-09-04');
  });
});
