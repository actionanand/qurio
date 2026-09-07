import { corsHeaders, json, requireStaff } from '../_shared/admin.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { targetUserId, reason } = (await request.json()) as { targetUserId?: string; reason?: string };
    if (!targetUserId || !reason?.trim()) return json({ error: 'Target user and reason are required' }, 400);
    const { admin, actor } = await requireStaff(request);
    const { data: target, error } = await admin.from('profiles').select('*').eq('id', targetUserId).single();
    if (error || !target) return json({ error: 'Account not found' }, 404);
    if (target.role === 'owner' || target.id === actor.id)
      return json({ error: 'The Owner or current account cannot be deleted here' }, 403);
    if (actor.role === 'admin' && target.role !== 'user')
      return json({ error: 'Admins may delete user accounts only' }, 403);
    const { error: auditError } = await admin.from('account_audit_log').insert({
      target_user_id: target.id,
      target_email: target.email,
      target_display_name: target.display_name,
      actor_user_id: actor.id,
      actor_email: actor.email,
      actor_role: actor.role,
      action: 'delete_user',
      previous_status: target.status,
      previous_role: target.role,
      reason: reason.trim(),
    });
    if (auditError) throw new Error('Unable to record the account action');
    const { error: deleteError } = await admin.auth.admin.deleteUser(target.id);
    if (deleteError) throw new Error('Unable to delete the account');
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return json(
      {
        error:
          message === 'Unauthorized' || message === 'Forbidden' ? message : 'Unable to complete the account action',
      },
      message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500,
    );
  }
});
