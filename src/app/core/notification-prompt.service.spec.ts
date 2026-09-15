import { describe, expect, it } from 'vitest';
import { shouldPromptForNotifications } from './notification-prompt.service';

describe('first-run notification prompt', () => {
  it('shows once for an approved native Android user', () => {
    expect(shouldPromptForNotifications(true, true, false, false)).toBe(true);
    expect(shouldPromptForNotifications(true, true, true, false)).toBe(false);
  });
  it('does not show on web, for unapproved users, or after permission is granted', () => {
    expect(shouldPromptForNotifications(true, false, false, false)).toBe(false);
    expect(shouldPromptForNotifications(false, true, false, false)).toBe(false);
    expect(shouldPromptForNotifications(true, true, false, true)).toBe(false);
  });
});
