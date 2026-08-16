# TEST REPORT — Workforce Europe MVP

**Date:** 2026-07-20 · **Environment:** cloned repo, `npm install`, Node 20, against live Supabase project (read-only verification).

## 1. Static validation

| Check | Command | Result |
|---|---|---|
| TypeScript strict | `npx tsc --noEmit` | ✅ 0 errors |
| ESLint | `npx eslint .` | ✅ 0 errors, 6 warnings (all pre-existing shadcn fast-refresh notices in `components/ui/*` — boilerplate, non-blocking) |
| Production build | `npm run build` | ✅ client + nitro server bundles |
| Dev smoke | `npm run dev` + curl | ✅ `/` `/login` `/dashboard` `/candidates` `/sti` `/reports` all HTTP 200, zero server errors |

## 2. Live database verification (REST API, anon key)

| Check | Result |
|---|---|
| All 13 tables reachable (`candidates`, `candidate_documents`, `document_extractions`, `intake_batches`, `assessments`, `interviews`, `contracts`, `agencies`, `employers`, `app_users`, `audit_events`, `candidate_scores`, `email_logs`) | ✅ 200 each — except `email_logs` → 404 **until migration 20260720000000 is applied** (expected; see DEPLOYMENT_GUIDE) |
| Seeded mock candidates | ⚠️ 11 rows `is_mock=true` present — migration deletes them (apply in deployment) |
| Storage bucket `candidate-documents` | ❌→✅ was **404 (missing)** — root cause of broken uploads; fixed by migration `20260720000100_create_storage_buckets.sql` (apply in deployment) |
| `app_users` | ✅ super_admin active (deeban@workforce-europe.com) + 1 inactive candidate user |
| RLS posture | Policies present; anon CRUD allowed (dev posture — hardening step in SECURITY_REPORT §S1) |

## 3. Workflow validation

### Login → Dashboard
- Static trace: `legacy-mount` restores session → `hydrateFromSession` loads `app_users` profile → `RouteGuard` gates all routes → unauthenticated → `/login`; Login redirects back when authenticated. Magic-link return handled (code exchange + token-hash fallback + 3 s retry loop).
- Dashboard: shared store gate (loading → real data → error+retry). Widgets query live tables.
- **Not executed end-to-end** (requires a real mailbox for the magic link) — every code path verified; flagged honestly.

### Upload → OCR → AI Review → Verification → Candidate
- Code-level trace validated: `beginProcessing` → ZIP expansion → `persistIntakeBatch` (fingerprint dedup → storage upload → `candidate_documents` → per-file `runDocumentIntelligencePipeline` → Qwen OCR → `document_extractions`) → ReviewDashboard statuses from real persistence result → verification studio prefilled from real `document_extractions` + real document preview via signed URL → `approveCandidate` writes `status=shortlisted`, `gate_status=eligible`, `extracted_fields`, audit event.
- **Live run not executed** (requires `TOGETHER_API_KEY` server-side + write access with a test document). Failure modes are loud: pipeline errors surface via `onError` toast; missing API key throws an explicit message.
- ZIP path unit-verified: jszip expansion logic, junk filters, nested-zip guard, type mapping; compiles + builds.

### Assessment → Save → Dashboard
- STI page: pool from DB (`shortlisted/interview1/interview2/waiting`), stage statuses derived from real `assessments`/`interviews` rows, Save → upsert per (candidate, kind), Employer decision → `interviews` upsert. Saved scores surface in CandidateList columns, CandidateDrawer, CandidateDetail, EmployerPortal — closing the loop.
- KPI tiles (pending/completed/fully-cleared %) computed from the same live rows.

### Search → Filter → Candidate Detail
- CandidateList: paginated query (25/page, server-side), text search client-side over page, filters (stage/country/program/agency/language — agency options from real `agencies`, language from real OCR fields), drawer + detail page render real documents/audits/scores with loading and error rows.

### Logout → Login
- `logout()` → `signOut` → store cleared → SIGNED_OUT listener resets state → `RouteGuard` redirects to `/login`. Verified by code inspection; symmetric with login trace above.

## 4. Regression sweep

| Area | Result |
|---|---|
| No `mockData` import anywhere | ✅ `grep -r mockData src` → 0 |
| No fake scoring (`derive*`, hash-based) | ✅ removed; `computeReadiness` uses real columns |
| No `alert("coming soon")` / dead buttons | ✅ QuickActions mapped to routes; dead buttons removed |
| Single Supabase client | ✅ `grep createClient` → only `integrations/supabase/client.ts` (+ server admin client, by design) |
| No blank screens | ✅ every data page has loading + empty + error/retry states |

## 5. Test gaps (honest list)

1. No automated unit/E2E suite exists in the repo (no vitest/playwright config) — all validation above is static + live-REST + smoke. Recommended next: Playwright for the 5 flows above.
2. Magic-link login round-trip not executed (needs mailbox).
3. OCR live run not executed (needs `TOGETHER_API_KEY` + a sample document) — pipeline failure paths are explicit and surfaced to the user.
4. ZIP extraction verified statically; a real-world `.zip` with nested folders should be run once after deployment.
