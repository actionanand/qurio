import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { MarkdownComponent, MermaidAPI } from 'ngx-markdown';
@Component({
  selector: 'app-markdown-viewer',
  imports: [MarkdownComponent],
  template: `@if (ready()) {
      <markdown
        class="markdown-body"
        [data]="body()"
        mermaid
        [mermaidOptions]="mermaidOptions"
        (ready)="renderMath()" />
    } @else {
      <pre>{{ body() }}</pre>
    }`,
})
export class MarkdownViewerComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly body = input.required<string>();
  readonly ready = signal(false);
  readonly mermaidOptions: MermaidAPI.MermaidConfig = { securityLevel: 'strict', startOnLoad: false };
  constructor() {
    void import('mermaid')
      .then(module => {
        Object.assign(window, { mermaid: module.default });
        this.ready.set(true);
      })
      .catch(() => this.ready.set(true));
  }
  async renderMath() {
    const { default: renderMathInElement } = await import('katex/contrib/auto-render');
    const markdown = this.element.nativeElement.querySelector<HTMLElement>('markdown');
    if (!markdown) return;
    // Sanitize downloaded Markdown first. KaTeX then creates its own trusted layout
    // with TeX HTML commands disabled, preserving fraction positioning and MathML.
    renderMathInElement(markdown, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      ignoredClasses: ['mermaid', 'katex'],
      trust: false,
      throwOnError: false,
      maxExpand: 1000,
      maxSize: 20,
    });
  }
}
