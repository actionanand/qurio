import { corsHeaders, json, requireStaff } from '../_shared/admin.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { targetUserId } = (await request.json()) as { targetUserId?: string };
    if (!targetUserId) return json({ error: 'Target user is required' }, 400);
    const { admin, actor } = await requireStaff(request);
    const { data: target, error } = await admin.from('profiles').select('*').eq('id', targetUserId).single();
    if (error || !target) return json({ error: 'Account not found' }, 404);
    if (target.role !== 'user' || target.status !== 'pending' || target.email_verified_at)
      return json({ error: 'Verification can only be resent to an unverified pending user' }, 409);
    const redirectTo = Deno.env.get('QURIO_APP_URL');
    if (!redirectTo) throw new Error('QURIO_APP_URL is not configured');
    const { error: resendError } = await admin.auth.resend({
      type: 'signup',
      email: target.email,
      options: { emailRedirectTo: `${redirectTo}/auth/callback` },
    });
    if (resendError) throw new Error('Unable to resend verification');
    const { error: auditError } = await admin.from('account_audit_log').insert({
      target_user_id: target.id,
      target_email: target.email,
      target_display_name: target.display_name,
      actor_user_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role,
      action: 'resend_verification',
      previous_status: target.status,
      new_status: target.status,
      previous_role: target.role,
      new_role: target.role,
    });
    if (auditError) throw new Error('Unable to record the account action');
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return json(
      { error: message === 'Unauthorized' || message === 'Forbidden' ? message : 'Unable to resend verification' },
      message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500,
    );
  }
});
