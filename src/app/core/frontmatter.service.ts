import { Service } from '@angular/core';
import { JSON_SCHEMA, load } from 'js-yaml';
import type { StudyDocument } from './models';

@Service()
export class FrontmatterService {
  parse(source: string): StudyDocument {
    const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
    if (!match) throw new Error('Missing frontmatter');
    const attributes: unknown = load(match[1], { schema: JSON_SCHEMA });
    if (
      !attributes ||
      typeof attributes !== 'object' ||
      !('id' in attributes) ||
      !('title' in attributes) ||
      typeof attributes.id !== 'string' ||
      typeof attributes.title !== 'string' ||
      !('type' in attributes) ||
      !['note', 'syllabus'].includes(String(attributes.type))
    ) {
      throw new Error('Invalid frontmatter');
    }
    return { attributes: attributes as StudyDocument['attributes'], body: source.slice(match[0].length) };
  }
}
