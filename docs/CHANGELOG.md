# CHANGELOG — Workforce Europe MVP Stabilization

All changes validated with `npm run typecheck` (0 errors), `npm run lint` (0 errors),
`npm run build` (success) and dev-server smoke tests (all routes HTTP 200).

## Commit 1 — MVP stabilization (auth, mocks, STI persistence)

| File | Reason | Summary | Validation |
|---|---|---|---|
| `src/store/authStore.ts` | Auth was hard-bypassed (fake dev super-admin) | Real `hydrateFromSession` via `app_users`, SIGNED_IN/OUT/TOKEN_REFRESHED listener, unprovisioned users rejected with clear error | typecheck, build, smoke |
| `src/components/RouteGuard.tsx` | Guard rendered children unconditionally | Real guard: hydrating → loading state; unauthenticated → `/login` redirect; role check support | typecheck, smoke `/login` |
| `src/legacy-app.tsx` | `/login` redirected to dashboard | Renders `Login`; removed dead subscription | typecheck, smoke |
| `src/lib/authClient.ts` | Two Supabase clients (duplicate GoTrue) | `authSupabase` now aliases the single shared client | typecheck, no console warnings |
| `src/lib/mockData.ts` | 227-line fixture wired into 12 files | **Deleted** after all consumers rewired | typecheck, lint |
| `src/lib/workflow.ts` | Hash-based fake `derive*` scores | Removed; added `extractLanguageLevel` (real OCR fields) | typecheck |
| `src/hooks/useAssessments.ts` | No real per-candidate scores existed | New hook: real `assessments` + `interviews` per candidate | typecheck |
| `src/hooks/useNotifications.ts` | Static mock array | Real notifications derived from `audit_events`, localStorage read-state | typecheck |
| `src/store/selectionEngineStore.ts` | Pseudo-random hash scoring | `computeReadiness` from real `total_score`/`gate_status`; `useEngineKpis` queries live candidates | typecheck |
| `src/pages/STIAssessment.tsx` | Hardcoded sliders, toast-only saves | Full rewrite: real candidate pool, statuses from DB rows, all four modules persist to `assessments`/`interviews` | typecheck, lint, build |
| `src/pages/CandidateList.tsx` | Fake lang/scores/last-activity columns | Real OCR language level, real assessments, real `updated_at`; dead Import button removed | typecheck, lint |
| `src/pages/CandidateDetail.tsx` | Mock STI/contract/visa tabs | Real queries; fabricated score-breakdown fallback removed | typecheck |
| `src/components/candidates/CandidateDrawer.tsx` | Mock drawer data | Real per-candidate fetch with loading/not-found states | typecheck |
| `src/components/candidates/FiltersPanel.tsx` | Mock agencies | Real `agencies` table options | typecheck |
| `src/pages/AgencyPortal.tsx` `EmployerPortal.tsx` `CandidatePortal.tsx` `ContractSigning.tsx` | Pure mock pages | Rewritten: real queries, real feedback/contract-signing persistence, loading/empty states | typecheck, build |
| `src/pages/RecruiterDashboard.tsx` | Mock STI coverage | Real assessment coverage via shared hook | typecheck |
| `src/pages/EmailCenter.tsx` | Fake send + fake history | Real recipients, persisted `email_logs` (honest `pending` status) | typecheck |
| `src/hooks/useCandidates.ts` (+2 hooks) | Missing `extracted_fields` | Mapped through; added `refresh()` | typecheck |
| `src/types/*` | Stale shapes | `Candidate.extracted_fields`, `Contract.employer_name`, `CandidateDocument.storage_path` | typecheck |
| `supabase/migrations/20260720000000_email_logs_and_mock_cleanup.sql` | Email Center backing + mock seed removal | New table + `DELETE … WHERE is_mock` | SQL review |
| `.gitignore` | `.env` committed | Ignored `.env` + `.env.*` | n/a |

## Commit 2 — Production MVP (this round)

| File | Reason | Summary | Validation |
|---|---|---|---|
| `src/lib/intake/unzip.ts` | **ZIPs accepted but never extracted** (sent to OCR as binary blobs) | Client-side ZIP expansion (JSZip): folder structure preserved in `path`, junk skipped, nested zips reported | typecheck, build |
| `src/pages/CandidateIntake.tsx` | **Verification studio fabricated everything** — hardcoded `aiValue:"Deeban"`, fake confidences, fake MRZ/passport page | Loads real `document_extractions` into form + confidence chips; viewer renders the **real document** via signed URL (img/PDF iframe) or truthful extraction summary; fake seeds stripped | typecheck, lint, build |
| `src/components/intake/ProcessingStep.tsx` | lint warning | Documented intentional run-once effect | lint 0 errors |
| `supabase/migrations/20260720000100_create_storage_buckets.sql` | **`candidate-documents` bucket missing in production** (verified live: HTTP 404) — every upload failed | Idempotent bucket creation, private, 25 MB, MIME allow-list | live REST verification |
| `src/hooks/useAllCandidates.ts` | Same table fetched 3× per dashboard | zustand shared store: one fetch, 30 s freshness, error + refetch | typecheck |
| `src/hooks/usePaginatedCandidates.ts` `src/hooks/useReports.ts` | No error states | Added `error`/`loading` surfaces | typecheck |
| `src/components/QueryState.tsx` | Blank screens during loads | Shared `LoadingState` / `ErrorState(retry)` / `EmptyState` | typecheck |
| `src/pages/Dashboard.tsx` | No loading/error gates; **hardcoded widget counts (12/8/15)**; dead "Chart coming soon" card | Gates on shared store + reports; real counts via `useEntityCounts`; placeholder card removed | typecheck, lint, build |
| `src/hooks/useEntityCounts.ts` | Fabricated KPI numbers | Real head-count queries (employers/agencies/contracts) | typecheck |
| `src/components/dashboard/QuickActions.tsx` | `alert("coming soon")` buttons | Real route mapping; unmapped actions not rendered | typecheck |
| `src/pages/Reports.tsx` | No loading/error gates | Gated via `useReports` states | typecheck |
| `src/pages/CandidateDetail.tsx` (round 2) | Dead Edit/Upload/View/Update-Status buttons | View → signed URL; Update Status → real dialog (DB + audit); dead buttons removed | typecheck |
| `src/pages/RolesPermissions.tsx` `src/lib/rbac.ts` | `MOCK_USERS_BY_ROLE`, fabricated audit history | Real `app_users` grouped by role; session-local audit starts empty | typecheck, lint |
| `src/lib/api.ts` | Unused mock axios wrapper (duplicate HTTP client) | **Deleted** (axios unused app-wide) | typecheck |
| `src/pages/CandidateList.tsx` `src/pages/STIAssessment.tsx` (round 2) | Dead Import button / dead Assign dialog | Removed | typecheck, lint |

## Round 3 — 2026-07-21 (post-deployment hotfix)

Root cause found from production screen recording: ZIPs were rejected with
"has an unsupported type (application/zip)" because the deployed build predated
the unzip fix. While re-verifying the fix end-to-end, a second latent defect was
found and fixed **before redeploy**: JSZip blobs carry no MIME type, so every
extracted inner file would have been rejected again as `application/octet-stream`.

| File | Root cause | Fix | Validation |
|---|---|---|---|
| `src/lib/intake/unzip.ts` | Inner files created with `application/octet-stream` (JSZip blobs have no type) → `validateFile` bad_mime on every extracted file | `mimeOfInner()` infers real MIME from extension; `loadAsync` now takes an ArrayBuffer (env-proof) | E2E simulation test (7/7 extracted files pass validation) |
| `src/lib/docintel/types.ts` | `ALLOWED_MIME_TYPES` missing Word/text types the upload UI already accepts (`.doc,.docx`) → direct DOCX uploads rejected | Added msword / docx / txt / rtf (now consistent with UI accept list and storage bucket policy) | tsc, eslint |
| `src/lib/intake/doctype.ts` (new, extracted from `persist.ts`) | German recruitment filenames missed classification: `Shone Pass.pdf` → other, `Shone Abi.pdf` → other, `Shone B2.pdf` → other | `\bpass\b`, `abitur|\babi\b`, CEFR levels `\b(a1..c2)\b` patterns; moved to dependency-free leaf module for testability | E2E simulation (passport/cv/sprach/degree all correct) |
| `src/lib/intake/persist.ts` | — | Imports `guessDocType` from `./doctype` (no behavior change) | tsc, build |

Gates: `tsc --noEmit` 0 errors · eslint 0 errors on changed files · `npm run build` ✓ ·
simulated upload of the user's real sample ZIP (6 PDF + 1 DOCX + 2 MSG + macOS junk):
7 documents extracted, 2 skipped with note, 0 validation failures.
