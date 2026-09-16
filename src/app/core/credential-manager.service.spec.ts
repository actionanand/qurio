import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialManagerService, QURIO_CREDENTIALS, type QurioCredentialsPlugin } from './credential-manager.service';

describe('CredentialManagerService', () => {
  const nativeCredentials: QurioCredentialsPlugin = {
    savePassword: vi.fn().mockResolvedValue({ status: 'saved' }),
    getPassword: vi.fn().mockResolvedValue({ status: 'success', email: 'learner@example.test', password: 'secret' }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: QURIO_CREDENTIALS, useValue: nativeCredentials }] });
  });

  it('normalizes native retrieval results', async () => {
    const service = TestBed.inject(CredentialManagerService);
    Object.defineProperty(service, 'native', { value: true });
    expect(await service.getPassword()).toEqual({
      status: 'success',
      email: 'learner@example.test',
      password: 'secret',
    });
  });

  it('does not expose provider errors', async () => {
    vi.mocked(nativeCredentials.getPassword).mockRejectedValueOnce(new Error('provider details'));
    const service = TestBed.inject(CredentialManagerService);
    Object.defineProperty(service, 'native', { value: true });
    expect(await service.getPassword()).toEqual({ status: 'error' });
  });
});
