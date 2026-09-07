import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonSelect, IonSelectOption } from '@ionic/angular';
import { ContentService } from '../core/content.service';
import { I18nService } from '../core/i18n.service';
import type { ContentDisplayInfo, ManifestItem } from '../core/models';
import { PreferencesService } from '../core/preferences.service';
import { ProgressService } from '../core/progress.service';
import { IconComponent } from '../shared/icon.component';

export const ALL_STUDY_MATERIALS = '__all__';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
  imports: [RouterLink, IonSelect, IonSelectOption, IconComponent],
})
export class HomePage {
  readonly allStudyMaterials = ALL_STUDY_MATERIALS;
  readonly content = inject(ContentService);
  readonly i = inject(I18nService);
  readonly preferences = inject(PreferencesService);
  readonly progress = inject(ProgressService);
  readonly subject = signal('');
  readonly selectedStudyMaterialId = signal(ALL_STUDY_MATERIALS);
  readonly selectedQuizId = signal('');
  readonly loading = signal(true);
  readonly error = signal(false);

  readonly curriculum = computed(
    () =>
      this.preferences.selectedCurriculum() ??
      this.content.manifest()?.curricula.find(entry => entry.isDefault)?.id ??
      'general',
  );
  readonly subjects = computed(() => this.content.getSubjectsForGrade(this.preferences.grade(), this.curriculum()));
  readonly activeSubject = computed(() => this.subjects().find(entry => entry.id === this.subject()));
  readonly syllabus = computed(
    () => this.content.getSyllabusForSubject(this.preferences.grade(), this.subject(), this.curriculum())[0] ?? null,
  );
  readonly studyMaterials = computed(() =>
    this.content.getStudyMaterialsForSubject(
      this.preferences.grade(),
      this.subject(),
      this.curriculum(),
      this.preferences.language(),
    ),
  );
  readonly quizOptions = computed(() =>
    this.content.getQuizzesForSelection(
      this.preferences.grade(),
      this.subject(),
      this.selectedStudyMaterialId(),
      this.curriculum(),
      this.preferences.language(),
    ),
  );
  readonly selectedStudyMaterial = computed(
    () => this.studyMaterials().find(item => item.id === this.selectedStudyMaterialId()) ?? null,
  );
  readonly selectedQuiz = computed(() => this.quizOptions().find(item => item.id === this.selectedQuizId()) ?? null);

  constructor() {
    let previousCurriculum: string | undefined;
    effect(() => {
      const curriculum = this.curriculum();
      if (previousCurriculum !== undefined && curriculum !== previousCurriculum) this.resetScopeSelection();
      previousCurriculum = curriculum;
    });
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(false);
    try {
      const manifest = await this.content.loadManifest();
      if (!manifest.grades.some(entry => entry.id === this.preferences.grade()) && manifest.grades[0])
        this.preferences.grade.set(manifest.grades[0].id);
      this.ensureValidSubject();
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  selectGrade(value: unknown) {
    const grade = Number(value);
    if (!this.content.manifest()?.grades.some(entry => entry.id === grade) || grade === this.preferences.grade())
      return;
    this.preferences.grade.set(grade);
    this.ensureValidSubject();
    this.resetContentSelection();
  }

  selectSubject(subject: string) {
    if (subject === this.subject() || !this.subjects().some(entry => entry.id === subject)) return;
    this.subject.set(subject);
    this.resetContentSelection();
  }

  selectStudyMaterial(value: unknown) {
    const id = typeof value === 'string' ? value : ALL_STUDY_MATERIALS;
    const valid = id === ALL_STUDY_MATERIALS || this.studyMaterials().some(item => item.id === id);
    this.selectedStudyMaterialId.set(valid ? id : ALL_STUDY_MATERIALS);
    this.selectedQuizId.set('');
  }

  selectQuiz(value: unknown) {
    const id = typeof value === 'string' ? value : '';
    this.selectedQuizId.set(this.quizOptions().some(item => item.id === id) ? id : '');
  }

  displayInfo(item: ManifestItem): ContentDisplayInfo {
    return this.content.getContentDisplayInfo(item.id, this.preferences.language());
  }

  quizLabel(item: ManifestItem): string {
    const info = this.displayInfo(item);
    if (!info.setLabel || info.title.toLocaleLowerCase().includes(info.setLabel.toLocaleLowerCase())) return info.title;
    return `${info.title} — ${info.setLabel}`;
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

  private ensureValidSubject() {
    if (!this.subjects().some(entry => entry.id === this.subject())) this.subject.set(this.subjects()[0]?.id ?? '');
  }

  private resetScopeSelection() {
    this.ensureValidSubject();
    this.resetContentSelection();
  }

  private resetContentSelection() {
    this.selectedStudyMaterialId.set(ALL_STUDY_MATERIALS);
    this.selectedQuizId.set('');
  }
}
