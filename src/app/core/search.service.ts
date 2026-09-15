import { Service, inject } from '@angular/core';
import type { ContentDisplayInfo, Language, Manifest, ManifestItem } from './models';
import { ContentService, resolveLocalizedText } from './content.service';

export type SearchFilter = 'all' | 'note' | 'quiz';
export type SearchResult = ContentDisplayInfo & { item: ManifestItem; type: 'note' | 'quiz'; unavailable: false };

@Service()
export class SearchService {
  private readonly content = inject(ContentService);

  search(query: string, filter: SearchFilter, language: Language): SearchResult[] {
    const manifest = this.content.manifest();
    if (!manifest) return [];
    return searchManifest(manifest, query, filter, language).map(item => ({
      ...this.content.getContentDisplayInfo(item.id, language),
      item,
      type: item.type as 'note' | 'quiz',
      unavailable: false,
    }));
  }
}

export function searchManifest(
  manifest: Manifest,
  query: string,
  filter: SearchFilter,
  language: Language,
): ManifestItem[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return manifest.items
    .filter(item => item.type !== 'syllabus' && (filter === 'all' || item.type === filter))
    .filter(item => {
      const subject = manifest.subjects.find(entry => entry.id === item.subject);
      const values = [
        resolveLocalizedText(item.title, language, manifest.fallbackLanguage, manifest.defaultLanguage),
        resolveLocalizedText(item.setLabel, language, manifest.fallbackLanguage, manifest.defaultLanguage),
        subject
          ? resolveLocalizedText(subject.label, language, manifest.fallbackLanguage, manifest.defaultLanguage)
          : '',
        item.chapter,
        item.topic,
        item.type,
        item.difficulty,
        item.grade === undefined ? '' : String(item.grade),
      ];
      const haystack = normalize(values.filter(Boolean).join(' '));
      return terms.every(term => haystack.includes(term));
    })
    .sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}

function normalize(value: string): string {
  return value.normalize('NFKD').toLocaleLowerCase().replace(/[-_]/g, ' ').trim();
}
