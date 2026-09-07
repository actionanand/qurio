import { Service, inject } from '@angular/core';
import type { AuditEvent, UserProfile } from './auth.models';
import { SupabaseService } from './supabase.service';

@Service()
export class AdminService {
  private readonly supabase = inject(SupabaseService).client;

  async listProfiles(): Promise<UserProfile[]> {
    const { data, error } = await this.supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as UserProfile[];
  }

  async listAudit(): Promise<AuditEvent[]> {
    const { data, error } = await this.supabase
      .from('account_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []) as AuditEvent[];
  }

  async approve(id: string) {
    await this.rpc('admin_approve_user', { target_user_id: id });
  }
  async deny(id: string, reason: string) {
    await this.rpc('admin_deny_user', { target_user_id: id, reason });
  }
  async suspend(id: string, reason: string) {
    await this.rpc('admin_suspend_user', { target_user_id: id, reason });
  }
  async reactivate(id: string, reason: string) {
    await this.rpc('admin_reactivate_user', { target_user_id: id, reason });
  }
  async promote(id: string) {
    await this.rpc('owner_promote_admin', { target_user_id: id });
  }
  async demote(id: string, reason: string) {
    await this.rpc('owner_demote_admin', { target_user_id: id, reason });
  }
  async updateMyProfile(displayName: string) {
    await this.rpc('update_my_profile', { display_name: displayName });
  }

  async deleteUser(id: string, reason: string) {
    const { data, error } = await this.supabase.functions.invoke('admin-delete-user', {
      body: { targetUserId: id, reason },
    });
    if (error) throw error;
    if (data && typeof data === 'object' && 'error' in data) throw new Error(String(data.error));
  }

  async resendVerification(id: string) {
    const { data, error } = await this.supabase.functions.invoke('admin-resend-verification', {
      body: { targetUserId: id },
    });
    if (error) throw error;
    if (data && typeof data === 'object' && 'error' in data) throw new Error(String(data.error));
  }

  private async rpc(name: string, params: Record<string, string>) {
    const { error } = await this.supabase.rpc(name, params);
    if (error) throw error;
  }
}
