# DEPLOYMENT GUIDE — Workforce Europe

## 1. Push the code

Upload the contents of `workforce-europe-mvp-fixed.zip` to your GitHub repo
(`dmathivananoffice-max/pixel-perfect-clone-80225`), replacing existing files.
Lovable syncs automatically from GitHub.

> Excluded from the zip (rebuildable): `node_modules`, `.output`, `.git`.

## 2. Apply the two new migrations (5 minutes, required)

Supabase Dashboard → project `olxghlkfqtnxlbeprjpo` → **SQL Editor** → run, in order:

1. `supabase/migrations/20260720000000_email_logs_and_mock_cleanup.sql`
   — creates `email_logs`, deletes the 11 seeded mock candidates.
2. `supabase/migrations/20260720000100_create_storage_buckets.sql`
   — creates the private `candidate-documents` bucket (uploads fail without it).

Verify afterwards:

```sql
SELECT count(*) FROM public.candidates WHERE is_mock = true;   -- expect 0
SELECT id, public FROM storage.buckets WHERE id = 'candidate-documents';  -- expect 1 row
```

## 3. Environment variables (Lovable Cloud → Secrets)

| Var | Required | Notes |
|---|---|---|
| `TOGETHER_API_KEY` | ✅ OCR | server-side only — without it, intake OCR stops with a clear error |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ user provisioning | server-side only (User Management invite/create) |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | ✅ | already in code path |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | public anon key |

## 4. First login

1. Open the app → you land on `/login`.
2. Enter `deeban@workforce-europe.com` → magic link → click it.
   - The signup trigger already made this account **super_admin** (active).
3. Dashboard loads. Invite the team via **User Management** → each gets a magic link.
   - Users who are not provisioned in `app_users` (or are deactivated) are rejected
     at login with a clear message — this is intended.

## 5. Smoke test after deploy (10 minutes)

1. **Login** with the super-admin account → Dashboard shows real counts (mock rows are gone — counts may be small).
2. **Intake** → `/candidates/new` → upload one real PDF (or a small ZIP) → watch Processing → AI Review shows the candidate → open Verification: real OCR values + real document preview → approve (check the declaration boxes).
3. **Candidate Master** → candidate appears as `shortlisted` / `eligible`.
4. **STI** (`/sti`) → candidate in queue → run Speaking module → Save → reopen Candidate Detail → assessment visible.
5. **Email Center** → compose → appears in History as `pending` (delivery wiring is a follow-up — KNOWN_ISSUES K1).
6. **Logout** → Login with a non-provisioned email → must be rejected with the "not activated" message.

## 6. Going public (before sharing the URL beyond the team)

Run the RLS hardening script from `SECURITY_REPORT.md` §S1 (drops the dev anon
policies). Then re-run the smoke test — everything must still work when logged in,
and logged-out access must show only the login page.

## 7. Rollback

Git history has two clean commits:

- `cda3592` — MVP stabilization (auth, mocks, STI persistence)
- `cbc62bf` — Production MVP (ZIP, verification studio, buckets, UI states)

Revert per commit if anything misbehaves: `git revert <sha>` and push — Lovable resyncs.

## 8. Local development

```bash
npm install
cp .env.example .env   # fill SUPABASE_URL + anon key (or reuse the Lovable-provided .env)
npm run dev            # http://localhost:8081
npm run typecheck && npm run lint && npm run build
```
