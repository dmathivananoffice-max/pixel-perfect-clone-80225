export type UserRole =
  | 'super_admin'
  | 'managing_director'
  | 'sales_executive'
  | 'recruiter'
  | 'documentation_officer'
  | 'german_trainer'
  | 'agency_partner'
  | 'employer'
  | 'candidate';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
  status: UserStatus;
  mfa_enabled: boolean;
  avatar?: string;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember_me?: boolean;
}

export interface MFAVerifyPayload {
  code: string;
  temp_token: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'candidate_update' | 'interview_scheduled' | 'contract_ready' | 'visa_update' | 'placed' | 'system';
  read: boolean;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}
