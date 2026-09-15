import { describe, expect, it } from 'vitest';
import { shouldPromptForNotifications } from './notification-prompt.service';

describe('first-run notification prompt', () => {
  it('shows once on the first native Android launch', () => {
    expect(shouldPromptForNotifications(true, false, false)).toBe(true);
    expect(shouldPromptForNotifications(true, true, false)).toBe(false);
  });
  it('does not show on web or after permission is granted', () => {
    expect(shouldPromptForNotifications(false, false, false)).toBe(false);
    expect(shouldPromptForNotifications(true, false, true)).toBe(false);
  });
});
