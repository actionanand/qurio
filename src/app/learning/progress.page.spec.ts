import { describe, expect, it } from 'vitest';
import { progressTabs } from './progress.page';

describe('Progress sections', () => {
  it('provides Overview, Mistakes, Leaderboard, and Bookmarks', () => {
    expect(progressTabs.map(tab => tab.id)).toEqual(['overview', 'mistakes', 'leaderboard', 'bookmarks']);
  });
});
