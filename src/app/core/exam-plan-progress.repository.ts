import { Service, signal } from '@angular/core';
import { readLocal } from './preferences.service';

export interface ExamPlanProgress {
  completedTaskKeys: string[];
}

const key = 'qurio.examPlanProgress.v1';

@Service()
export class ExamPlanProgressRepository {
  private readonly state = signal<Record<string, ExamPlanProgress>>({});
  readonly storageUnavailable = signal(false);

  constructor() {
    const saved = readLocal(key);
    if (saved && typeof saved === 'object') {
      const next: Record<string, ExamPlanProgress> = {};
      for (const [planId, value] of Object.entries(saved)) {
        if (
          value &&
          typeof value === 'object' &&
          'completedTaskKeys' in value &&
          Array.isArray(value.completedTaskKeys)
        ) {
          next[planId] = {
            completedTaskKeys: (value.completedTaskKeys as unknown[]).filter(
              (id: unknown): id is string => typeof id === 'string',
            ),
          };
        }
      }
      this.state.set(next);
    }
  }

  loadPlanProgress(planId: string): ExamPlanProgress {
    return this.state()[planId] ?? { completedTaskKeys: [] };
  }

  getTaskCompletion(planId: string, taskKey: string): boolean {
    return this.loadPlanProgress(planId).completedTaskKeys.includes(taskKey);
  }

  setTaskCompleted(planId: string, _date: string, taskKey: string, completed: boolean) {
    this.state.update(state => {
      const current = state[planId]?.completedTaskKeys ?? [];
      const completedTaskKeys = completed
        ? [...new Set([...current, taskKey])]
        : current.filter(key => key !== taskKey);
      return { ...state, [planId]: { completedTaskKeys } };
    });
    this.save();
  }

  clearPlanProgress(planId: string) {
    this.state.update(state => {
      const next = { ...state };
      delete next[planId];
      return next;
    });
    this.save();
  }

  taskKey(planId: string, date: string, section: 'topic' | 'revision' | 'timetable', id: string) {
    return `${planId}:${date}:${section}:${id}`;
  }

  private save() {
    try {
      localStorage.setItem(key, JSON.stringify(this.state()));
    } catch {
      this.storageUnavailable.set(true);
    }
  }
}
