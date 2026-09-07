import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function requireStaff(
  request: Request,
): Promise<{ admin: SupabaseClient; actor: Record<string, unknown> }> {
  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !publishableKey || !serviceRoleKey || !authorization?.startsWith('Bearer '))
    throw new Error('Unauthorized');
  const token = authorization.slice(7);
  const authClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error('Unauthorized');
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: actor, error } = await admin.from('profiles').select('*').eq('id', userData.user.id).single();
  if (error || actor.status !== 'approved' || !['owner', 'admin'].includes(actor.role)) throw new Error('Forbidden');
  return { admin, actor };
}
