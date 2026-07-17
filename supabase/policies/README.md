# RLS Policy Modes

This directory holds the **production-ready** Row Level Security architecture
for the platform. It is versioned separately from the day-to-day feature
migrations so we can switch the whole system from **Development Mode** to
**Production Mode** with a single migration + env flip, without touching
application code.

## The two modes

| Mode          | When                                    | Policies                          | App behaviour |
| ------------- | --------------------------------------- | --------------------------------- | ------------- |
| `development` | MVP, internal recruiter testing, demos  | Relaxed (see `development.sql`)   | `VITE_RLS_MODE=development` (default). App-layer candidate isolation still active. |
| `production`  | Real customer data, GDPR-covered users  | Strict (see `production.sql`)     | `VITE_RLS_MODE=production`. Enables strict UI copy + audit posture. |

The application NEVER hardcodes "dev vs prod" — it reads
`src/lib/security/rls-mode.ts`.

## What Production Mode enforces

1. **Candidate isolation** — every row on `candidates`, `candidate_documents`,
   `document_extractions`, `candidate_scores`, `interviews`, `assessments`,
   `contracts` is filtered by the caller's org/candidate scope via
   `auth.uid()`. Anonymous access is denied.
2. **Role-based writes** — only `documentation_officer`, `operations_manager`
   (super_admin fallback) and `super_admin` can mutate document lifecycle
   state; recruiters can create + read within their assigned candidates.
3. **Storage bucket isolation** — the `candidate-documents` bucket is
   private, and object-level policies restrict `SELECT`/`INSERT` on paths
   prefixed with a candidate id the caller is permitted to see.
4. **Audit enforcement** — writes to sensitive columns (verified,
   document_state, ocr_status transitions) require a matching row in
   `audit_events` inserted in the same transaction.
5. **Least-privilege service role** — `SUPABASE_SERVICE_ROLE_KEY` is used
   only from server functions guarded by `requireSupabaseAuth` +
   application-side role check. Never from the browser.
6. **Tenant isolation hook** — the schema is ready for a future `org_id`
   column: every policy references `has_role(auth.uid(), …)` and a
   security-definer helper `same_org(auth.uid(), row.owner_id)`, so adding
   multi-tenant tenancy is a policy change, not a schema rewrite.

## Files

- `development.sql` — the policies currently applied by the feature
  migrations. Kept here for reference / one-shot re-apply.
- `production.sql` — the strict policy set. Apply as a normal Supabase
  migration when the platform is ready to onboard external users, then set
  `VITE_RLS_MODE=production`.

## Switching modes

1. Take a database backup.
2. Apply `production.sql` as a Supabase migration (drops the relaxed
   policies and installs the strict ones in the same transaction).
3. Set `VITE_RLS_MODE=production` in the environment.
4. Redeploy. The UI switches to strict copy, badges, and audit prompts
   automatically via `src/lib/security/rls-mode.ts`.

Because the application only reads its posture from `rls-mode.ts`, no
component, hook, or server function needs to change during the switch.
