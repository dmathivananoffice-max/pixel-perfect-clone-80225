# SECURITY REPORT — Workforce Europe

## Findings & status

| # | Severity | Finding | Status |
|---|---|---|---|
| S1 | 🔴 High | **All tables are CRUD-accessible with the anon key.** Migration `20260718120514` added `FOR ALL TO anon USING (true)` policies ("dev anon all") on every table, on top of the proper authenticated policies. Verified live: anon key reads `candidates`, `app_users`, etc. | ⚠️ **Open — deliberate dev posture.** Before any public/staging URL: drop the anon policies (script below). Left in place so onboarding works until real users exist. |
| S2 | 🔴 High | `.env` with project URL + anon key committed to Git | ✅ Fixed: `.env`/`.env.*` gitignored. **Action required:** rotate the anon key and scrub Git history before launch (anon keys are public-by-design, but this must not become a habit for future secrets). |
| S3 | 🟠 Medium | Auth was bypassed app-wide (fake super-admin) — anyone was "logged in" | ✅ Fixed: real magic-link auth, `RouteGuard` enforced on all 19 protected routes, unprovisioned/inactive users rejected with message. |
| S4 | 🟠 Medium | Storage bucket policies allow anon access to `candidate-documents` objects | ⚠️ Tied to S1 dev posture. Bucket itself is **private** (no public URLs) — objects reachable only via signed URLs, which require storage policy access. Tighten with S1. |
| S5 | 🟠 Medium | Service-role key used by user-provisioning server functions (`lib/admin/users.functions.ts`) | ✅ Correct pattern (server-side only). Verify `SUPABASE_SERVICE_ROLE_KEY` is set only in Lovable/Cloud env — never in the repo. |
| S6 | 🟡 Low | Magic link uses `shouldCreateUser: true` | ✅ Mitigated: hydration rejects users without an active `app_users` row and signs them out. |
| S7 | 🟡 Low | `audit_events` append-only (no UPDATE/DELETE policies) | ✅ Correct — preserves audit integrity. |
| S8 | 🟡 Low | Signed URLs for documents (10 min candidate viewer / 5 min detail view) | ✅ Reasonable TTLs; documents never exposed publicly. |
| S9 | 🟡 Low | Notification read-state stored in `localStorage` | ✅ Acceptable (cosmetic state, not security). |

## Candidate isolation

- Candidates have no login by default. Candidate-portal users are matched by
  `candidates.email = auth email` — a candidate sees only their own record.
- Agency users are matched by `agencies.contact_email`. No cross-agency data path exists in the UI.
- True row-level isolation (per-candidate/agency RLS predicates) requires tightening
  RLS per S1 — currently enforced at query level, not DB level.

## Hardening script (run before public launch)

```sql
-- Drop dev-posture anon policies, keep authenticated ones
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "dev anon all %I" ON public.%I', t, t);
  END LOOP;
END $$;
-- Revoke anon grants
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
```

## Environment variables

| Var | Where | Exposure |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | client (Vite) | public by design |
| `MISTRAL_API_KEY` | server only (Nitro server function) | must never ship to client — default vision OCR backend |
| `TOGETHER_API_KEY` | server only (Nitro server function) | fallback vision backend; must never ship to client |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | same |
