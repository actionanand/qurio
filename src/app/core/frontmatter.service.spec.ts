import { describe, expect, it } from 'vitest';
import { FrontmatterService } from './frontmatter.service';

describe('FrontmatterService', () => {
  it('parses Unicode, CRLF and YAML arrays without consuming Markdown', () => {
    const result = new FrontmatterService().parse(
      '---\r\nid: plants\r\ntitle: தாவரங்கள்\r\ntype: note\r\nlanguage: ta\r\nquizIds: [quiz-1]\r\n---\r\n# Body',
    );
    expect(result.attributes.title).toBe('தாவரங்கள்');
    expect(result.body).toBe('# Body');
  });

  it('rejects missing frontmatter and unsafe YAML tags', () => {
    expect(() => new FrontmatterService().parse('# Body')).toThrow();
    expect(() => new FrontmatterService().parse('---\nid: !!js/function function(){}\n---\n')).toThrow();
  });
});
