import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { QuizSession, shuffle } from './quiz-session';
import { Quiz } from './models';

const quiz: Quiz = {
  schemaVersion: 1,
  id: 'quiz-1',
  type: 'quiz',
  title: 'Practice',
  description: '',
  language: 'en',
  curriculum: 'general',
  grade: 5,
  subject: 'mathematics',
  chapter: 'fractions',
  topic: 'fractions',
  version: 1,
  updatedAt: '2026-09-05',
  timeLimitSeconds: 10,
  passingPercentage: 70,
  shuffleQuestions: true,
  shuffleOptions: true,
  sourceNoteIds: [],
  questions: [
    {
      id: 'q1',
      type: 'single-choice',
      question: 'Half?',
      hint: 'Think',
      correctOption: 'b',
      explanation: 'Equal parts',
      options: [
        { id: 'a', text: '1/3', feedback: 'No' },
        { id: 'b', text: '2/4', feedback: 'Yes' },
      ],
    },
    {
      id: 'q2',
      type: 'single-choice',
      question: 'Half again?',
      correctOption: 'b',
      explanation: 'Equal parts',
      options: [
        { id: 'a', text: '1/3', feedback: 'No' },
        { id: 'b', text: '2/4', feedback: 'Yes' },
      ],
    },
  ],
};

describe('QuizSession', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('locks checked answers and scores by stable IDs without mutating content', () => {
    const original = JSON.stringify(quiz);
    const save = vi.fn();
    const session = new QuizSession(quiz, save);
    session.start();
    session.select('b');
    session.check();
    session.select('a');
    expect(session.selected()).toBe('b');
    session.next();
    session.select('b');
    session.check();
    session.next();
    expect(session.result()).toMatchObject({ correct: 2, wrong: 0, unanswered: 0, scorePercentage: 100, passed: true });
    expect(save).toHaveBeenCalledOnce();
    expect(JSON.stringify(quiz)).toBe(original);
  });

  it('uses one timer and auto-submits checked answers exactly once', () => {
    const save = vi.fn();
    const session = new QuizSession(quiz, save);
    session.start();
    session.start();
    session.select('a');
    session.check();
    session.next();
    session.select('b');
    vi.advanceTimersByTime(11_000);
    session.finish(true);
    expect(session.result()).toMatchObject({
      correct: 0,
      wrong: 1,
      unanswered: 1,
      autoSubmitted: true,
      elapsedSeconds: 10,
    });
    expect(save).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not accept answers at the deadline and cleans up on navigation', () => {
    const save = vi.fn();
    const session = new QuizSession(quiz, save);
    session.start();
    session.select('b');
    vi.setSystemTime(Date.now() + 10_000);
    session.check();
    expect(session.result()).toMatchObject({ correct: 0, autoSubmitted: true });
    session.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shuffles a copy', () => {
    const input = [1, 2, 3];
    expect(shuffle(input).sort()).toEqual(input);
  });
});
