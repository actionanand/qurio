import { afterEach, describe, expect, it, vi } from 'vitest';
import { SnackbarService } from './snackbar.service';

describe('SnackbarService', () => {
  afterEach(() => vi.useRealTimers());

  it('replaces the current message and dismisses it after the requested duration', () => {
    vi.useFakeTimers();
    const service = new SnackbarService();
    service.show('Saved', 'success', 1000);
    expect(service.message()).toMatchObject({ message: 'Saved', tone: 'success' });
    service.show('Failed', 'error', 500);
    expect(service.message()).toMatchObject({ message: 'Failed', tone: 'error' });
    vi.advanceTimersByTime(500);
    expect(service.message()).toBeNull();
  });
});
