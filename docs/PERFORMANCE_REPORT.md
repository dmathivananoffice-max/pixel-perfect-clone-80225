# PERFORMANCE REPORT — Workforce Europe

## Fixed this round

| Issue | Root cause | Fix | Effect |
|---|---|---|---|
| Dashboard fetched the full `candidates` table 3× per render (Dashboard + ExecutiveDashboard/useProductMetrics + selection engine) | Independent hooks, no shared cache | `useAllCandidates` is now a zustand store: single in-flight fetch, 30 s freshness window, shared across all consumers | −2 duplicate full-table queries per dashboard load |
| Candidate list enrichment | Was per-row hash functions (fake but cheap) | Now one batched `useAssessments` query per page (`.in(candidate_id, ids)` ×2 tables) | 2 queries/page regardless of row count |
| Duplicate Supabase clients | `lib/authClient.ts` created a second GoTrue instance | Alias to the single shared client | No duplicated token refresh timers; no competing listeners |
| Dead axios dependency path | `lib/api.ts` unused axios wrapper | Deleted | Smaller dependency surface |
| Verification viewer | Re-created signed URL on any render | URL fetch keyed to `storage_path` only | No redundant storage API calls |
| Entity counts on Dashboard | n/a | Head-only count queries (`count: exact, head: true`) | Zero row transfer |

## Existing good practices (kept)

- Full route-level code splitting (every page lazy-loaded).
- pdfjs isolated in its own 754 kB chunk, loaded only during intake OCR.
- Pagination (25/page) on the candidate master.
- `audit_events` queries always `LIMIT`-ed (8 for dashboard activity, 20 for notifications, 30 for drawer).
- `legacy-mount` has an 8 s hard-timeout fallback — the app can never hang on "Loading…".

## Measured bundle (production build)

- Main entry: ~140 kB gzip-equivalent (Vite report), feature chunks split per route.
- Largest chunk: OCR/pdfjs (intake only).

## Watch items (not regressions)

| Item | Threshold | Action when hit |
|---|---|---|
| `useCandidates` (detail page) loads full tables | ~5k candidates | Switch to per-candidate scoped queries |
| `useAllCandidates` full-table fetch | ~10k candidates | Introduce server-side aggregation views |
| ZIP extraction in browser | ~100 MB archives | Show per-archive progress; consider worker thread |
| STI page loads full evaluation pool | ~2k concurrent candidates | Paginate the queue table |

## Memory & leaks

- All async effects reviewed: every one has a `cancelled` guard (no setState-after-unmount).
- `ProcessingStep` intervals/timeouts cleared on unmount; run-once ref guard.
- `useNotifications` read-set capped at 200 entries in localStorage.
- No global event listeners added without cleanup (single auth listener, module-level).
