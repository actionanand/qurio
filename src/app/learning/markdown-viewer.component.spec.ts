import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { provideMarkdown } from 'ngx-markdown';
import { MarkdownViewerComponent } from './markdown-viewer.component';

// This regression exercises real Markdown and KaTeX, not Mermaid's diagram engine.
vi.mock('mermaid', () => ({ default: { initialize: vi.fn(), run: vi.fn().mockResolvedValue(undefined) } }));

describe('MarkdownViewerComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('preserves fraction layout after sanitizing Markdown and leaves code untouched', async () => {
    TestBed.configureTestingModule({ providers: [provideMarkdown()] });
    const fixture = TestBed.createComponent(MarkdownViewerComponent);
    fixture.componentRef.setInput(
      'body',
      [
        'Inline $\\frac{1}{2}$.',
        '',
        '$$',
        '\\frac{1}{2} = \\frac{2}{4}',
        '$$',
        '',
        '`$x$`',
        '',
        '<img src="x" onerror="alert(1)">',
      ].join('\n'),
    );
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    await vi.waitFor(
      () => {
        fixture.detectChanges();
        expect(element.querySelectorAll('.katex').length).toBe(2);
      },
      { timeout: 10000 },
    );
    expect(element.querySelector('.katex .vlist > span[style]')).not.toBeNull();
    expect(element.querySelector('.katex-display math')).not.toBeNull();
    expect(element.querySelector('code')?.textContent).toBe('$x$');
    expect(element.querySelector('[onerror]')).toBeNull();
  });
});
