import { Service, inject, signal } from '@angular/core';
import type { Bookmark, ManifestItem } from './models';
import { LearnerStateRepository } from '../services/learner-state.repository';
import { SnackbarService } from './snackbar.service';
import { I18nService } from './i18n.service';

@Service()
export class BookmarkService {
  private readonly repository = inject(LearnerStateRepository);
  private readonly snackbar = inject(SnackbarService);
  private readonly i = inject(I18nService);
  readonly bookmarks = signal<Bookmark[]>([]);
  readonly loaded = signal(false);
  readonly loading = signal(false);

  async load(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      this.bookmarks.set(await this.repository.loadBookmarks());
      this.loaded.set(true);
    } catch {
      this.snackbar.show(this.i.t('operationFailed'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  isBookmarked(contentId: string): boolean {
    return this.bookmarks().some(bookmark => bookmark.contentId === contentId);
  }

  async toggle(item: ManifestItem): Promise<void> {
    if (item.type === 'syllabus') return;
    const before = this.bookmarks();
    const existing = before.find(bookmark => bookmark.contentId === item.id);
    if (existing) this.bookmarks.set(before.filter(bookmark => bookmark.contentId !== item.id));
    else
      this.bookmarks.set([
        { contentId: item.id, resourceType: item.type, createdAt: new Date().toISOString() },
        ...before,
      ]);
    try {
      if (existing) await this.repository.removeBookmark(item.id);
      else await this.repository.addBookmark(item.id, item.type);
      this.snackbar.show(this.i.t(existing ? 'bookmarkRemoved' : 'bookmarkAdded'));
    } catch {
      this.bookmarks.set(before);
      this.snackbar.show(this.i.t('operationFailed'), 'error');
    }
  }

  async remove(contentId: string): Promise<void> {
    const before = this.bookmarks();
    this.bookmarks.set(before.filter(bookmark => bookmark.contentId !== contentId));
    try {
      await this.repository.removeBookmark(contentId);
      this.snackbar.show(this.i.t('bookmarkRemoved'));
    } catch {
      this.bookmarks.set(before);
      this.snackbar.show(this.i.t('operationFailed'), 'error');
    }
  }
}
