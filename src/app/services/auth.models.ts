export type AppRole = 'owner' | 'admin' | 'user';
export type AccountStatus = 'pending' | 'approved' | 'denied' | 'suspended';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: AppRole;
  status: AccountStatus;
  email_verified_at: string | null;
  status_reason: string | null;
  status_changed_by: string | null;
  status_changed_at: string | null;
  role_changed_by: string | null;
  role_changed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: number;
  target_user_id: string | null;
  target_email: string | null;
  target_display_name: string | null;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: AppRole | null;
  action: string;
  previous_status: AccountStatus | null;
  new_status: AccountStatus | null;
  previous_role: AppRole | null;
  new_role: AppRole | null;
  reason: string | null;
  created_at: string;
}
