import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonSelect, IonSelectOption } from '@ionic/angular';
import { IconComponent } from '../shared/icon.component';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import { PreferencesService } from '../core/preferences.service';
import { ProgressService } from '../core/progress.service';
import { ManifestItem } from '../core/models';
@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  imports: [RouterLink, IonSelect, IonSelectOption, IconComponent],
})
export class HomePage {
  readonly content = inject(ContentService);
  readonly i = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  readonly progress = inject(ProgressService);
  readonly subject = signal('');
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly titles = signal<Record<string, string>>({});
  readonly subjects = computed(() => this.content.getSubjectsForGrade(this.preferences.grade()));
  readonly items = computed(() => this.content.itemsFor(this.preferences.grade(), this.subject()));
  readonly activeSubject = computed(() => this.content.manifest()?.subjects.find(s => s.id === this.subject()));
  constructor() {
    void this.load();
    effect(onCleanup => {
      const items = this.items();
      const language = this.preferences.language();
      let cancelled = false;
      this.titles.set({});
      for (const item of items)
        void this.content
          .resolve(item.id, language)
          .then(result => {
            if (!cancelled)
              this.titles.update(titles => ({
                ...titles,
                [item.id]: 'attributes' in result.content ? result.content.attributes.title : result.content.title,
              }));
          })
          .catch(() => undefined);
      onCleanup(() => {
        cancelled = true;
      });
    });
  }
  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const manifest = await this.content.loadManifest();
      if (!manifest.grades.some(g => g.id === this.preferences.grade()) && manifest.grades[0])
        this.preferences.grade.set(manifest.grades[0].id);
      this.subject.set(this.content.getSubjectsForGrade(this.preferences.grade())[0]?.id ?? '');
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
  grade(value: unknown) {
    const grade = Number(value);
    if (this.content.manifest()?.grades.some(entry => entry.id === grade)) this.preferences.grade.set(grade);
  }
  subjectIcon(id: string) {
    switch (id) {
      case 'mathematics':
      case 'science':
      case 'english':
      case 'social-studies':
      case 'intelligence':
        return id;
      default:
        return 'book' as const;
    }
  }
  title(item: ManifestItem) {
    return (
      this.titles()[item.id] ??
      item.path
        .split('/')
        .pop()
        ?.replace(/\.(md|json)$/, '')
        .replace(/-/g, ' ') ??
      item.id
    );
  }
}
