# ARCHITECTURE REPORT — Workforce Europe

## 1. System overview

```
Browser (React 19 SPA, react-router-dom)
  └─ mounted inside TanStack Start SSR shell (routes: / and /* → legacy app)
       │
       ├─ Supabase JS client (single instance) ──────────────┐
       │   ├─ Postgres (RLS)        → all business tables     │
       │   ├─ Auth (magic link)     → sessions, app_users     │
       │   └─ Storage             → candidate-documents       │
       │                                                     │
       └─ TanStack server function (Nitro)                   │
           └─ Together AI Qwen2.5-VL-72B → OCR + extraction ┘
```

## 2. Front-end structure

| Area | Location | Notes |
|---|---|---|
| SSR shell | `src/routes/__root.tsx`, `index.tsx`, `$.tsx` | Mounts legacy SPA client-side only |
| App router | `src/legacy-app.tsx` | 20 routes, all except `/login` behind `RouteGuard` |
| Auth lifecycle | `src/legacy-mount.tsx` + `src/store/authStore.ts` | Session restore, magic-link code exchange, profile hydration from `app_users` |
| State | zustand: `authStore`, `candidateFiltersStore`, `selectionEngineStore` (persisted config), `useAllCandidates` store (shared data) | TanStack Query present but most data flows via hooks |
| Supabase client | `src/integrations/supabase/client.ts` | **the only client**; `lib/authClient.ts` re-exports it |

## 3. Intake pipeline (the critical workflow)

```
UploadStep (files / folders / ZIP)
  → expandZipUploads()            lib/intake/unzip.ts        (JSZip, client-side)
  → ProcessingStep
      └─ persistIntakeBatch()     lib/intake/persist.ts
           ├─ SHA-256 fingerprint dedup   lib/docintel/fingerprint.ts
           ├─ storage upload              candidate-documents bucket
           ├─ candidate_documents rows
           └─ per file: runDocumentIntelligencePipeline()   lib/docintel/pipeline.ts
                ├─ rasterize PDF (pdfjs) / image
                ├─ OCR: Qwen2.5-VL via server function      lib/docintel/providers/together.ts
                ├─ structured extraction (same model, JSON)
                └─ document_extractions rows (+ candidate identity backfill)
  → ReviewDashboard               real statuses from persistence result
  → Verification studio           real extractions + real document preview
  → approveCandidate()            candidates.status=shortlisted, gate_status=eligible,
                                  extracted_fields persisted, audit event written
  → Dashboard / Candidate Master  live queries
```

## 4. Database schema (Supabase project `olxghlkfqtnxlbeprjpo`)

| Table | Role |
|---|---|
| `candidates` | Master record; `status` (waiting→shortlisted→interview1/2→contract→visa→placed/rejected/withdrawn), `gate_status`, `total_score`, `extracted_fields` jsonb |
| `candidate_documents` | Storage path, type, OCR status per uploaded file |
| `document_extractions` | Per-field AI values + confidence (verification source of truth) |
| `intake_batches` | Batch header for each upload run |
| `assessments` | Speaking/training/STI scores (kind + scores jsonb + overall + recommendation) |
| `interviews` | Interview rounds incl. employer decision |
| `contracts` | Contract status incl. signed_at |
| `agencies`, `employers` | Partner records |
| `app_users` | Role assignments (`role_key`), activation |
| `audit_events` | Append-only event stream (also powers notifications) |
| `candidate_scores`, `scoring_models` | Selection engine outputs/config |
| `email_logs` | Composed email history (status pending until mail provider) |

RLS: enabled on all tables. Policies: `authenticated FOR ALL (true)` + dev-posture
`anon FOR ALL (true)` (see SECURITY_REPORT §S1 — tighten before public launch).
Storage: policies on `storage.objects` for `candidate-documents`; bucket created by
migration `20260720000100`.

## 5. Access control

- Authentication: Supabase magic link; `app_users` row must exist and be active
  (founder bootstrap: `deeban@workforce-europe.com` → super_admin via trigger).
- Authorization: `RouteGuard` (authentication + optional role list) + `lib/rbac.ts`
  permission matrix consulted by UI. Role hierarchy: super_admin > admin/managing_director
  > hr_manager/team_lead/recruiter > agency/employer/candidate.

## 6. External services

| Service | Use | Env var |
|---|---|---|
| Supabase (olxghlkfqtnxlbeprjpo) | DB, Auth, Storage | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` |
| Together AI | Qwen2.5-VL OCR + extraction (server-side) | `TOGETHER_API_KEY` (server only) |
| Service role | User provisioning server functions | `SUPABASE_SERVICE_ROLE_KEY` (server only) |

## 7. Known architectural debts (not rewritten, by design)

- Double router (TanStack Start shell + legacy react-router app). Stable; migrate
  long-term (P7 in KNOWN_ISSUES).
- `useCandidates` loads full table + documents + audits for the detail page — fine
  at current scale; paginate at ~5k+ rows.
