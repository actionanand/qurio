import { beforeEach, describe, expect, it } from 'vitest';
import { ProgressService } from './progress.service';

describe('ProgressService', () => {
  beforeEach(() => localStorage.clear());

  it('stores completion once by stable content ID', () => {
    const progress = new ProgressService();
    progress.complete('math-05-equivalent-fractions');
    progress.complete('math-05-equivalent-fractions');
    expect(progress.completed()).toEqual(['math-05-equivalent-fractions']);
    expect(new ProgressService().completed()).toEqual(progress.completed());
  });

  it('recovers from corrupt device data', () => {
    localStorage.setItem('qurio.progress.v1', '{broken');
    expect(new ProgressService().completed()).toEqual([]);
  });
});
