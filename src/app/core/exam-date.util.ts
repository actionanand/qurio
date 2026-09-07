import type { ExamCalendarDay, ExamPlan, ExamPlanPhase } from './models';

export function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error('Invalid local date');
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function monthKey(value: string | Date): string {
  const date = typeof value === 'string' ? parseLocalDate(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function addDays(value: string, amount: number): string {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + amount);
  return formatDateKey(date);
}

export function daysUntilTarget(targetDate: string, today = new Date()): number {
  const target = parseLocalDate(targetDate);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.ceil((target.getTime() - start.getTime()) / 86400000));
}

export function monthsRemaining(targetDate: string, today = new Date()): number {
  const target = parseLocalDate(targetDate);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const months = (target.getFullYear() - start.getFullYear()) * 12 + target.getMonth() - start.getMonth();
  return Math.max(0, months + (target.getDate() >= start.getDate() ? 0 : -1));
}

export function currentPhase(plan: ExamPlan, today = new Date()): ExamPlanPhase | undefined {
  const now = formatDateKey(today);
  return [...plan.phases]
    .sort((a, b) => a.order - b.order)
    .find(phase => phase.startDate <= now && now <= phase.endDate);
}

export function phaseState(phase: ExamPlanPhase, today = new Date()): 'completed' | 'current' | 'upcoming' {
  const now = formatDateKey(today);
  if (now < phase.startDate) return 'upcoming';
  if (now > phase.endDate) return 'completed';
  return 'current';
}

export function nearestAvailableDate(days: ExamCalendarDay[], preferred = formatDateKey(new Date())): string | null {
  if (!days.length) return null;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.some(day => day.date === preferred)) return preferred;
  const preferredTime = parseLocalDate(preferred).getTime();
  return sorted.reduce((best, day) => {
    const bestDelta = Math.abs(parseLocalDate(best.date).getTime() - preferredTime);
    const dayDelta = Math.abs(parseLocalDate(day.date).getTime() - preferredTime);
    return dayDelta < bestDelta ? day : best;
  }, sorted[0]).date;
}
