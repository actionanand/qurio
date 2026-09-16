import type { AuthError } from '@supabase/supabase-js';
import type { MessageKey } from '../core/i18n.service';

export function safeAuthMessage(
  error: AuthError | null,
  fallback: string,
  translate: (key: MessageKey) => string,
): string {
  if (!error) return '';
  if (error.status === 429) return translate('tooManyRequests');
  if (error.code?.toLowerCase().includes('captcha') || error.message.toLowerCase().includes('captcha'))
    return translate('securityVerificationExpired');
  if (error.code === 'email_not_confirmed') return translate('emailNotVerifiedYet');
  if (error.message.toLowerCase().includes('invalid login')) return translate('incorrectEmailOrPassword');
  if (error.message.toLowerCase().includes('password')) return translate('strongerPassword');
  return fallback;
}
