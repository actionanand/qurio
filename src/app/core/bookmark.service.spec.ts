import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnerStateRepository } from '../services/learner-state.repository';
import { BookmarkService } from './bookmark.service';
import { I18nService } from './i18n.service';
import { SnackbarService } from './snackbar.service';

describe('BookmarkService', () => {
  const repository = {
    loadBookmarks: vi.fn(),
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
  };
  let service: BookmarkService;
  beforeEach(() => {
    vi.clearAllMocks();
    repository.loadBookmarks.mockResolvedValue([{ contentId: 'saved', resourceType: 'note', createdAt: '2026-01-01' }]);
    repository.addBookmark.mockResolvedValue(undefined);
    repository.removeBookmark.mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        BookmarkService,
        { provide: LearnerStateRepository, useValue: repository },
        { provide: SnackbarService, useValue: { show: vi.fn() } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    });
    service = TestBed.inject(BookmarkService);
  });
  it('loads the approved user bookmarks', async () => {
    await service.load();
    expect(service.isBookmarked('saved')).toBe(true);
  });
  it('optimistically adds and removes stable content IDs', async () => {
    await service.toggle({ id: 'new-note', type: 'note', path: 'note.md', languages: ['en'] });
    expect(repository.addBookmark).toHaveBeenCalledWith('new-note', 'note');
    expect(service.isBookmarked('new-note')).toBe(true);
    await service.remove('new-note');
    expect(repository.removeBookmark).toHaveBeenCalledWith('new-note');
    expect(service.isBookmarked('new-note')).toBe(false);
  });
});
