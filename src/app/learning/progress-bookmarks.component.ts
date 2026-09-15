import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BookmarkService } from '../core/bookmark.service';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-progress-bookmarks',
  imports: [RouterLink, IconComponent],
  template: `
    <div class="content-list">
      @for (entry of entries(); track entry.bookmark.contentId) {
        <article class="content-card bookmark-row" [class.unavailable]="entry.info.unavailable">
          <span class="type-icon"><app-icon [name]="entry.bookmark.resourceType" /></span>
          <div>
            @if (!entry.info.unavailable) {
              <a [routerLink]="['/content', entry.bookmark.contentId]"
                ><h3>{{ entry.info.title }}</h3></a
              >
            } @else {
              <h3>{{ i.t('contentUnavailable') }}</h3>
              <p class="muted">{{ i.t('unavailableBookmark') }}</p>
            }
            <span class="eyebrow">{{ i.t(entry.bookmark.resourceType === 'note' ? 'studyMaterial' : 'quiz') }}</span>
          </div>
          <button
            type="button"
            class="icon-button"
            [attr.aria-label]="i.t('removeBookmark')"
            (click)="bookmarks.remove(entry.bookmark.contentId)">
            <app-icon name="bookmarked" />
          </button>
        </article>
      } @empty {
        <div class="empty-state">
          <app-icon name="bookmark" />
          <p>{{ i.t('noBookmarks') }}</p>
        </div>
      }
    </div>
  `,
})
export class ProgressBookmarksComponent {
  readonly i = inject(I18nService);
  readonly bookmarks = inject(BookmarkService);
  private readonly content = inject(ContentService);
  readonly entries = computed(() =>
    this.bookmarks.bookmarks().map(bookmark => ({
      bookmark,
      info: this.content.getContentDisplayInfo(bookmark.contentId, this.i.preferences.language()),
    })),
  );

  constructor() {
    void this.bookmarks.load();
  }
}
