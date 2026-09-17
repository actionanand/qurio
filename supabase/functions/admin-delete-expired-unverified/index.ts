import { corsHeaders, json, requireStaff } from '../_shared/admin.ts';

const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
const cleanupReason = 'Unverified account permanently deleted after remaining unverified for 90 days';

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  status: string;
  email_verified_at: string | null;
  created_at: string;
};

function isEligibleProfile(profile: Profile, cutoff: Date): boolean {
  return (
    profile.role === 'user' &&
    profile.status === 'unverified' &&
    profile.email_verified_at === null &&
    new Date(profile.created_at).getTime() <= cutoff.getTime()
  );
}

async function listProfileCandidates(admin: Awaited<ReturnType<typeof requireStaff>>['admin'], cutoff: Date) {
  const candidates: Profile[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('profiles')
      .select('id,email,display_name,role,status,email_verified_at,created_at')
      .eq('role', 'user')
      .eq('status', 'unverified')
      .is('email_verified_at', null)
      .lte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error('Unable to review unverified accounts');
    const page = (data ?? []) as Profile[];
    candidates.push(...page);
    if (page.length < pageSize) return candidates;
  }
}

async function confirmedEligibleProfile(
  admin: Awaited<ReturnType<typeof requireStaff>>['admin'],
  id: string,
  cutoff: Date,
): Promise<Profile | null> {
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,email,display_name,role,status,email_verified_at,created_at')
    .eq('id', id)
    .maybeSingle();
  if (profileError || !profile || !isEligibleProfile(profile as Profile, cutoff)) return null;
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user || data.user.email_confirmed_at !== null) return null;
  return profile as Profile;
}

async function eligibleProfiles(admin: Awaited<ReturnType<typeof requireStaff>>['admin'], cutoff: Date) {
  const candidates = await listProfileCandidates(admin, cutoff);
  const eligible: Profile[] = [];
  for (const candidate of candidates) {
    const confirmed = await confirmedEligibleProfile(admin, candidate.id, cutoff);
    if (confirmed) eligible.push(confirmed);
  }
  return eligible;
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { action } = (await request.json()) as { action?: 'preview' | 'delete' };
    if (action !== 'preview' && action !== 'delete') return json({ error: 'Invalid action' }, 400);
    const { admin, actor } = await requireStaff(request);
    const cutoff = new Date(Date.now() - ninetyDaysMs);
    if (action === 'preview') {
      const eligible = await eligibleProfiles(admin, cutoff);
      return json({ eligibleCount: eligible.length, cutoff: cutoff.toISOString() });
    }

    const candidates = await listProfileCandidates(admin, cutoff);
    let deletedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    for (const candidate of candidates) {
      const target = await confirmedEligibleProfile(admin, candidate.id, cutoff);
      if (!target) {
        skippedCount += 1;
        continue;
      }
      const { error: auditError } = await admin.from('account_audit_log').insert({
        target_user_id: target.id,
        target_email: target.email,
        target_display_name: target.display_name,
        actor_user_id: actor.id,
        actor_email: actor.email,
        actor_role: actor.role,
        action: 'expired_unverified_delete',
        previous_status: 'unverified',
        previous_role: 'user',
        reason: cleanupReason,
      });
      if (auditError) {
        failedCount += 1;
        continue;
      }
      const { error: deleteError } = await admin.auth.admin.deleteUser(target.id);
      if (deleteError) failedCount += 1;
      else deletedCount += 1;
    }
    return json({ deletedCount, skippedCount, failedCount, cutoff: cutoff.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return json(
      { error: message === 'Unauthorized' || message === 'Forbidden' ? message : 'Unable to complete account cleanup' },
      message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500,
    );
  }
});
