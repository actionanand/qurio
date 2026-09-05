import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contentConfig } from './content.config';
import { ContentService, validateQuiz } from './content.service';

const manifest = {
  schemaVersion: 1,
  contentVersion: 'test',
  generatedAt: '2026-09-05T00:00:00Z',
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  supportedLanguages: [],
  curricula: [],
  grades: [],
  subjects: [],
  items: [{ id: 'note-1', type: 'note', path: 'grade-05/science/note.md', languages: ['en'] }],
};

describe('ContentService', () => {
  let service: ContentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    try {
      http.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('resolves fallback centrally and reuses the resolved-language cache', async () => {
    const pending = service.resolve('note-1', 'ta');
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush(manifest);
    const request = await vi.waitFor(() =>
      http.expectOne(`${contentConfig.contentBaseUrl}/en/grade-05/science/note.md`),
    );
    request.flush('---\nid: note-1\ntitle: Plants\ntype: note\nlanguage: en\n---\n# Plants');
    const result = await pending;
    expect(result).toMatchObject({ requestedLanguage: 'ta', resolvedLanguage: 'en', fallbackUsed: true });
    expect((await service.resolve('note-1', 'hi')).fallbackUsed).toBe(true);
  });

  it('allows a manifest retry after a network failure', async () => {
    const first = service.loadManifest();
    const rejected = expect(first).rejects.toBeTruthy();
    http
      .expectOne(`${contentConfig.contentBaseUrl}/manifest.json`)
      .flush('offline', { status: 503, statusText: 'Offline' });
    await rejected;
    const retry = service.loadManifest();
    http.expectOne(`${contentConfig.contentBaseUrl}/manifest.json`).flush({ ...manifest, items: [] });
    await retry;
  });

  it('rejects malformed quiz data', () => {
    expect(() => validateQuiz({})).toThrow();
  });
});
