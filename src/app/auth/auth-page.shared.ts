import type { AuthError } from '@supabase/supabase-js';

export function safeAuthMessage(error: AuthError | null, fallback: string): string {
  if (!error) return '';
  if (error.status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (error.code === 'email_not_confirmed')
    return 'Your email is not verified yet. Open the confirmation email or request a new link.';
  if (error.message.toLowerCase().includes('invalid login')) return 'The email or password is incorrect.';
  if (error.message.toLowerCase().includes('password'))
    return 'Please use a stronger password with at least 8 characters.';
  return fallback;
}
