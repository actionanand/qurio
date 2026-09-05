import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { contentConfig } from '../core/content.config';
import { HomePage } from './home.page';

describe('HomePage', () => {
  it('renders manifest subjects and grade labels', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${contentConfig.contentBaseUrl}/manifest.json`)
      .flush({
        schemaVersion: 1,
        contentVersion: 'test',
        generatedAt: '2026-09-05T00:00:00Z',
        defaultLanguage: 'en',
        fallbackLanguage: 'en',
        supportedLanguages: [],
        curricula: [],
        grades: [{ id: 5, label: { en: 'Grade 5', ta: '5ஆம் வகுப்பு', hi: 'कक्षा 5' } }],
        subjects: [{ id: 'science', label: { en: 'Science', ta: 'அறிவியல்', hi: 'विज्ञान' }, gradeScoped: true }],
        items: [],
      });
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Science');
    expect(fixture.nativeElement.textContent).toContain('Grade 5');
  });
});
