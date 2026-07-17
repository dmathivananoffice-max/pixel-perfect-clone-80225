// ─────────────────────────────────────────────────────────────
// RLS Mode — dev vs production security posture.
//
// The database policies themselves are versioned in
// `supabase/policies/` (see README there). This module is the
// single source of truth for the *application* about which mode
// is active, so the UI can surface the correct badge, audit
// hooks can log accordingly, and any future feature-flagged
// permission checks stay consistent.
//
// Switching to production security is a config + policy-migration
// change — NOT a code refactor. Application logic reads from this
// module only; nothing in the app hardcodes "dev vs prod" behaviour.
// ─────────────────────────────────────────────────────────────

export type RlsMode = 'development' | 'production';

const RAW = (import.meta.env.VITE_RLS_MODE ?? '').toString().toLowerCase();

/**
 * Current RLS mode. Defaults to `development` so MVP iteration
 * stays fast. Set `VITE_RLS_MODE=production` (and apply the
 * matching production policy migration) to lock everything down.
 */
export const RLS_MODE: RlsMode = RAW === 'production' ? 'production' : 'development';

export const isProductionSecurity = () => RLS_MODE === 'production';
export const isDevelopmentSecurity = () => RLS_MODE === 'development';

export interface RlsModeDescriptor {
  mode: RlsMode;
  label: string;
  tone: 'amber' | 'emerald';
  description: string;
  /** What is enforced in this mode — for status pills / dev panels. */
  guarantees: string[];
}

export const RLS_MODE_DESCRIPTOR: RlsModeDescriptor = isProductionSecurity()
  ? {
      mode: 'production',
      label: 'Production security',
      tone: 'emerald',
      description:
        'Strict candidate isolation, role-based access, storage bucket isolation and audit enforcement.',
      guarantees: [
        'Candidate-scoped row access via auth.uid()',
        'Role-gated writes (documentation_officer, super_admin, …)',
        'Storage bucket isolation per candidate path',
        'Audit events required for state transitions',
        'Least-privilege service role usage',
      ],
    }
  : {
      mode: 'development',
      label: 'Development security (MVP)',
      tone: 'amber',
      description:
        'Relaxed RLS for internal testing. Isolation guardrails are still enforced at the application layer.',
      guarantees: [
        'Application-layer candidate isolation (docintel/isolation.ts)',
        'SHA-256 fingerprinting + duplicate blocking',
        'Audit event logging on document lifecycle changes',
      ],
    };
