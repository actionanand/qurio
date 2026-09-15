import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonSearchbar } from '@ionic/angular';
import { BookmarkService } from '../core/bookmark.service';
import { I18nService } from '../core/i18n.service';
import { SearchService, type SearchFilter } from '../core/search.service';
import { IconComponent } from '../shared/icon.component';

@Component({
  selector: 'app-search',
  imports: [IonSearchbar, RouterLink, IconComponent],
  template: `
    <section class="search-page">
      <span class="eyebrow">QURIO · {{ i.t('search') }}</span>
      <h1>{{ i.t('searchQurio') }}</h1>
      <p class="muted">{{ i.t('searchIntro') }}</p>
      <ion-searchbar
        [placeholder]="i.t('searchPlaceholder')"
        [debounce]="120"
        (ionInput)="query.set($event.detail.value ?? '')" />
      <div class="filter-chips" role="group" [attr.aria-label]="i.t('search')">
        @for (option of filters; track option.value) {
          <button
            type="button"
            [class.active]="filter() === option.value"
            [attr.aria-pressed]="filter() === option.value"
            (click)="filter.set(option.value)">
            {{ i.t(option.label) }}
          </button>
        }
      </div>
      <div class="search-results" aria-live="polite">
        @for (result of results(); track result.id) {
          <article class="content-card search-result">
            <span class="type-icon"><app-icon [name]="result.type === 'note' ? 'note' : 'quiz'" /></span>
            <a [routerLink]="['/content', result.id]">
              <span class="eyebrow">{{ i.t(result.type === 'note' ? 'studyMaterial' : 'quiz') }}</span>
              <h2>{{ result.title }}</h2>
              <p class="muted">
                {{ result.subjectLabel }}
                @if (result.item.grade) {
                  · {{ i.t('class') }} {{ result.item.grade }}
                }
                @if (result.difficulty) {
                  · {{ result.difficulty }}
                }
              </p>
            </a>
            @if (result.item; as item) {
              <button
                type="button"
                class="icon-button"
                [attr.aria-label]="i.t(bookmarks.isBookmarked(item.id) ? 'removeBookmark' : 'bookmark')"
                (click)="bookmarks.toggle(item)">
                <app-icon [name]="bookmarks.isBookmarked(item.id) ? 'bookmarked' : 'bookmark'" />
              </button>
            }
          </article>
        } @empty {
          <div class="empty-state">
            <app-icon name="search" />
            <p>{{ i.t(query().trim() ? 'noSearchResults' : 'enterSearch') }}</p>
          </div>
        }
      </div>
    </section>
  `,
})
export class SearchPage {
  readonly i = inject(I18nService);
  readonly bookmarks = inject(BookmarkService);
  private readonly search = inject(SearchService);
  readonly query = signal('');
  readonly filter = signal<SearchFilter>('all');
  readonly filters = [
    { value: 'all' as const, label: 'all' as const },
    { value: 'note' as const, label: 'studyMaterials' as const },
    { value: 'quiz' as const, label: 'quizzes' as const },
  ];
  readonly results = computed(() => this.search.search(this.query(), this.filter(), this.i.preferences.language()));

  constructor() {
    void this.bookmarks.load();
  }
}
