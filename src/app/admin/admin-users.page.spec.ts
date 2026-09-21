import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersPage } from './admin-users.page';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../services/auth.service';
import { CaptchaService } from '../auth/captcha.service';
import { I18nService } from '../core/i18n.service';
import { AlertController } from '@ionic/angular';
import { SnackbarService } from '../core/snackbar.service';

describe('AdminUsersPage account cleanup', () => {
  const getExpiredUnverifiedPreview = vi.fn();
  const deleteExpiredUnverified = vi.fn();
  const snackbar = { show: vi.fn() };
  const alert = {
    present: vi.fn(async () => undefined),
    onDidDismiss: vi.fn(async () => ({ role: 'cancel' })),
  };
  const auth = {
    profile: signal(null),
    isOwner: () => true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getExpiredUnverifiedPreview.mockResolvedValue({ eligibleCount: 0, cutoff: '2026-06-19T00:00:00.000Z' });
    deleteExpiredUnverified.mockResolvedValue({ deletedCount: 0, skippedCount: 0, failedCount: 0 });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AdminService,
          useValue: {
            listProfiles: vi.fn(async () => []),
            getAppSettings: vi.fn(async () => ({ auto_approve_verified_users: false })),
            getExpiredUnverifiedPreview,
            deleteExpiredUnverified,
          },
        },
        { provide: AuthService, useValue: auth },
        { provide: CaptchaService, useValue: { canSubmit: () => false } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
        { provide: AlertController, useValue: { create: vi.fn(async () => alert) } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
  });

  it('keeps the cleanup card hidden when the server preview has no eligible accounts', async () => {
    const page = TestBed.runInInjectionContext(() => new AdminUsersPage());
    await vi.waitFor(() => expect(page.loading()).toBe(false));
    await vi.waitFor(() => expect(page.eligibleCleanupCount()).toBe(0));
    expect(page.cleanupDescription(1)).toBe('expiredUnverifiedOne');
  });

  it('does not delete when the cleanup confirmation is cancelled', async () => {
    getExpiredUnverifiedPreview.mockResolvedValue({ eligibleCount: 1, cutoff: '2026-06-19T00:00:00.000Z' });
    const page = TestBed.runInInjectionContext(() => new AdminUsersPage());
    await vi.waitFor(() => expect(page.eligibleCleanupCount()).toBe(1));

    await page.confirmExpiredCleanup();

    expect(deleteExpiredUnverified).not.toHaveBeenCalled();
  });

  it('uses the plural count from the server preview and deletes only after confirmation', async () => {
    getExpiredUnverifiedPreview.mockResolvedValue({ eligibleCount: 2, cutoff: '2026-06-19T00:00:00.000Z' });
    deleteExpiredUnverified.mockResolvedValue({ deletedCount: 1, skippedCount: 1, failedCount: 0 });
    alert.onDidDismiss.mockResolvedValue({ role: 'confirm' });
    const page = TestBed.runInInjectionContext(() => new AdminUsersPage());
    await vi.waitFor(() => expect(page.eligibleCleanupCount()).toBe(2));

    expect(page.cleanupDescription(2)).toBe('expiredUnverifiedMany');
    expect(page.cleanupButtonLabel(2)).toBe('deleteExpiredAccounts');
    await page.confirmExpiredCleanup();

    expect(deleteExpiredUnverified).toHaveBeenCalledOnce();
    expect(snackbar.show).toHaveBeenCalledWith('cleanupDeletedOne');
    expect(snackbar.show).toHaveBeenCalledWith('cleanupPartial', 'info');
  });
});
