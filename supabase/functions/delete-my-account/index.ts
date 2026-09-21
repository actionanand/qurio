import { corsHeaders, json, requireAuthenticated } from '../_shared/admin.ts';

const selfDeleteReason = 'Account permanently deleted by the user';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { confirmationEmail } = (await request.json()) as { confirmationEmail?: string };
    const { admin, user } = await requireAuthenticated(request);
    const email = user.email?.trim().toLowerCase();
    if (!email || confirmationEmail?.trim().toLowerCase() !== email)
      return json({ error: 'Confirmation email does not match' }, 400);
    const { data: profile, error: profileError } = await admin.from('profiles').select('*').eq('id', user.id).single();
    if (profileError || !profile) return json({ error: 'Account not found' }, 404);
    if (profile.role === 'owner') return json({ error: 'Owner account cannot be deleted' }, 403);
    const { error: auditError } = await admin.from('account_audit_log').insert({
      target_user_id: profile.id,
      target_email: profile.email,
      target_display_name: profile.display_name,
      actor_user_id: profile.id,
      actor_email: profile.email,
      actor_role: profile.role,
      action: 'self_delete',
      previous_status: profile.status,
      previous_role: profile.role,
      reason: selfDeleteReason,
    });
    if (auditError) throw new Error('Unable to record account action');
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error('Unable to delete account');
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return json(
      {
        error:
          message === 'Unauthorized' || message === 'Owner account cannot be deleted'
            ? message
            : 'Unable to delete account',
      },
      message === 'Unauthorized' ? 401 : message === 'Owner account cannot be deleted' ? 403 : 500,
    );
  }
});
