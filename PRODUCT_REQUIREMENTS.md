# PRODUCT_REQUIREMENTS.md

> **Audience:** Claude Code / AI coding agents rebuilding this product from scratch.  
> **Owner:** Workforce Europe GmbH (G&W Unternehmensgruppe)  
> **Brand names in use:** Workforce Europe · WeccaSoft Mastermind · Recruitment Intelligence Platform (RIP)  
> **Companion docs:** `SRD.md` (Growth OS only — WFE-SRD-DGS-002), `AGENTS.md` (Lovable git rules)  
> **How to use this file:** Treat Sections 1–11 as the **Recruitment Intelligence Platform** build brief. Treat Section 12 as a pointer to the separate Growth OS (do not merge schemas). Build RIP first unless the task explicitly says Growth.

---

## 0. Agent instructions (read first)

1. This is **two systems sharing one company and one Supabase project**, not one monolith:
   - **System A — Recruitment Intelligence Platform (RIP):** candidate intake, OCR/document verification, scoring, STI, contracts, visas, placements. Schema: `public`.
   - **System B — Growth Operating System:** ads, Diagnostic lead magnet, WhatsApp qualification, counsellor tools, SEO, capacity. Schema: `growth`. Spec: `SRD.md`.
2. Growth OS **explicitly excludes** the candidate visa/document workflow (that is RIP).
3. Converted Growth leads link to RIP candidates via a shared identity key (`platform_candidate_id` / `candidate_id`). Do not duplicate identity stores.
4. Prefer **deterministic rules** for eligibility, readiness, scoring explanations, and compliance gates. LLMs extract, draft, and recommend — they must not invent OCR fields, guarantee visas/jobs/salaries, or spend ad money without human approval.
5. Never rewrite published git history on Lovable-connected branches (no force-push / rebase / amend of pushed commits). See `AGENTS.md`.
6. When implementing intake fields, address every field as `section.field_key`. Do not hard-code field keys outside a single field dictionary module.

---

## 1. Product summary

### 1.1 One-sentence pitch

Workforce Europe runs an AI-assisted recruitment platform that intakes international candidates (especially India → Germany nursing / Ausbildung / study pathways), extracts identity and credentials from documents via OCR+AI, has staff verify every section, then scores, assesses, contracts, and places those candidates — while a separate Growth OS fills the top of funnel.

### 1.2 Primary users

| Actor | System | Goals |
|---|---|---|
| Super admin / Managing director | Both | Oversight, roles, dashboards, approvals |
| Recruiter / Documentation officer | RIP | Intake batches, verify documents, advance stages |
| German trainer | RIP | Language / STI assessments |
| Sales executive / Counsellor | Growth + RIP | Qualify leads, book counselling, hand off to intake |
| Marketing operator | Growth | Approve Pending Actions (ads/SEO), watch capacity |
| Agency partner | RIP portal | Submit / track agency candidates |
| Employer | RIP portal | View matched candidates, interviews |
| Candidate | RIP portal + Growth Diagnostic | Upload docs, sign contracts, see status; take Diagnostic |

### 1.3 Staff roles (RIP DB / RLS)

`super_admin`, `managing_director`, `operations_manager`, `sales_executive`, `recruiter`, `documentation_officer`, `german_trainer`

Portal roles: `agency_partner`, `employer`, `candidate`

SQL helpers (existing pattern): `current_role_key()`, `has_role()`, `has_any_role()`, `is_admin()`, `is_staff()`. Protect last super admin from demotion/deletion.

### 1.4 Products / pathways (RIP intake)

| `product_id` | Label | Typical use |
|---|---|---|
| `nurses` | Professional Nurses | Approbation, B2 German, hospital placement |
| `ausbildung` | Ausbildung | Vocational training in Germany |
| `pre_bachelor` | Pre-Bachelor | Studienkolleg / undergrad track |
| `pre_masters` | Pre-Masters | Master intake prep |
| `mba` | MBA | Executive / business schools |

Dashboard product filter also includes `all` (executive view). Selection Engine scoring programs currently emphasize `professional_nurses` and `ausbildung`.

Growth pathways (Diagnostic, separate config): Nursing Professional, Nursing Ausbildung, Doctors, Technicians/Mechatronics, Logistics, FSJ, Bachelor, Master.

---

## 2. Recommended tech stack (match production)

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 19 + TypeScript | Vite; TanStack Start shell may mount a legacy `react-router-dom` SPA |
| UI | Tailwind + Radix/shadcn | Prefer existing design tokens over inventing a new look unless redesign is requested |
| State | Zustand + TanStack Query | Auth, product filter, selection engine, UI |
| Forms | react-hook-form + zod | |
| Backend | Supabase (PostgreSQL + Auth + Storage) | Single source of truth |
| Server fns | TanStack server functions / Nitro | OCR keys stay server-side |
| Auth | Supabase Auth magic link (OTP) | Password login may be disabled |
| Storage | Bucket `candidate-documents` | Private; staff-scoped |
| OCR / vision | Pluggable providers | Production path has used Together AI Qwen2.5-VL and/or Mistral vision; include stub for tests |
| PDF | pdfjs-dist rasterize before vision OCR | Cap width (~1024) for speed |
| Jobs (Growth) | pg-boss | Not required for minimal RIP |
| Email | EU transactional (Postmark/Brevo) | UI may exist before provider wiring |
| Hosting | Lovable-connected repo possible | Keep branch green; no history rewrites |

### 2.1 Environment variables (minimum)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server / migrations / capture jobs only
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
TOGETHER_API_KEY=                   # or MISTRAL_API_KEY depending on default vision backend
VITE_RLS_MODE=development|production
```

---

## 3. System map

```
┌─────────────────────────────────────────────────────────────┐
│ Growth OS (schema growth) — see SRD.md                      │
│ Ads → Landing → Diagnostic → Lead → Score → WhatsApp →      │
│ Counsellor → Capacity governor → SEO / Pending Actions      │
└───────────────────────────┬─────────────────────────────────┘
                            │ platform_candidate_id
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Recruitment Intelligence Platform (schema public)           │
│ Intake batch → Storage + OCR → Extractions → Verification     │
│ Studio → Shortlist → Interviews → Contract → Visa → Placed  │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Domain model (RIP — `public`)

### 4.1 Core tables

| Table | Purpose | Critical columns |
|---|---|---|
| `candidates` | Master candidate record | `candidate_id` PK, `first_name`, `last_name`, `dob`, `gender`, `country`, `email`, `phone`, `product_id`, `status`, `gate_status`, `extracted_fields` jsonb, `verification_state` jsonb, `batch_id`, `schema_version`, scores/rank, soft-delete |
| `intake_batches` | One upload/run header | `id`, `product_id`, `mode` (`single`\|`bulk`), `status`, totals, `resume_state` |
| `candidate_documents` | One uploaded file | `document_type`, `storage_path`, `sha256`, `ocr_status`, `ocr_raw`, `document_state`, `extracted_fields`, `verified` |
| `document_extractions` | Per-field AI/human values | `section`, `field_name`, `ai_value`, `human_value`, `confidence`, `bbox`, `status` |
| `candidate_scores` | Criteria scores | `criteria_name`, raw/normalized/weighted, `gate_status` |
| `assessments` | STI / speaking / training | `kind`, `scores` jsonb |
| `interviews` | Employer interview rounds | round, employer link |
| `contracts` | Offer / signed contract | `status` default `draft`, `signed_at` |
| `agencies`, `employers`, `products` | Partners / catalog | |
| `app_users`, `roles`, `permissions`, `role_permissions` | AuthZ | |
| `audit_events` | Append-only audit | **UPDATE/DELETE must be blocked** |

### 4.2 Schema migration tables (Sprint 0 / Sprint 1)

| Object | Purpose |
|---|---|
| `candidates.schema_version` | Existing cohort = `1`; new rows default `2` |
| View `intake_candidates` | Alias of `candidates` (spec name) |
| `readiness_snapshots` | Freeze of `readiness_pct` before dictionary changes |
| `system_notices` | Backing store for `migration_pending` broadcast |
| `intake_schema_meta` | Frozen `LEGACY_REQUIRED_SET`, defaults |
| `intake_education_records` | 1:N education (ordinal 0 = primary) |
| `intake_language_certificates` | 1:N language certs |
| `intake_language_modules` | Child of certificate (listening/reading/writing/speaking) |
| View `intake_field_values` | Compat view over JSON + extractions |

### 4.3 Candidate pipeline status

Forward transitions (manual override possible in admin tools):

```
waiting → shortlisted → interview1 → interview2 → contract → visa → placed
                 ↘ rejected / withdrawn (terminal)
```

`gate_status`: `eligible` | `not_placement_ready` (drives “Placement Readiness” labels in UI).

Placement readiness labels (recruiter-facing): Placed, Rejected, On Hold, Visa Processing, Contract Pending, Interview Pending, Documents Missing, Placement Ready, Assessment Pending, In Progress.

### 4.4 Document lifecycle

- **document_state:** `draft` → `ai_processed` → `verified` → `visa_ready`
- **ocr_status:** `pending` | `processing` | `complete` | `failed` | `skipped`
- Low confidence threshold: **&lt; 0.65** → flag for manual review
- Filename convention for application docs: `FIRSTNAME GermanDocWord.pdf` (e.g. `DEEBAN Reisepass.pdf`). Suffixes `oU` / `mU` reserved for signature documents — not application uploads.

### 4.5 Storage

Bucket: `candidate-documents`. All document reads for OCR/AI **must** be scoped by `candidate_id` through an isolation layer (no cross-candidate queries).

---

## 5. Intake field dictionary (canonical)

Every field is addressed as `section.field_key`. Single source of truth module (e.g. `src/intake/fieldDictionary.ts`). Mapper, merge, readiness, UI, and DB writes all resolve through it.

### 5.1 Sections and fields

| Section | Fields | Required for readiness |
|---|---|---|
| `personal` | `first_name`, `last_name`, `dob`, `gender`, `nationality` | first_name, last_name, dob, nationality |
| `passport` | `passport_no`, `issue_date`, `expiry_date`, `place_issue` | passport_no, expiry_date |
| `contact` | `email`, `phone`, `country`, `city`, `address` | email, phone |
| `education` | `qualification`, `institution`, `year`, `gpa` | qualification |
| `language` | `provider`, `level`, `exam_date`, `cert_date` | level |
| `employment` | `employer`, `role`, `from`, `to` | — |
| `internship` | `org`, `duration` | — |
| `social` | `org`, `duration` | — |
| `medical` | `fitness`, `vaccinations`, `notes` | — |
| `driving` | `licence_no`, `country`, `category`, `expiry` | — |

### 5.2 Select options

- Gender: Female, Male, Other, Prefer not to say  
- CEFR: A1, A2, B1, B2, C1, C2  
- Language provider: Goethe, TELC, ÖSD, TestDaF, Other  
- Medical fitness: Yes / No; vaccinations: Yes / Partial / No  

### 5.3 Frozen readiness set (MUST NOT reorder or rewrite casually)

```
LEGACY_REQUIRED_SET = [
  personal.first_name,
  personal.last_name,
  personal.dob,
  personal.nationality,
  passport.passport_no,
  passport.expiry_date,
  contact.email,
  contact.phone,
  education.qualification,
  language.level,
]
```

**Invariant:** For `schema_version = 1`, readiness % is computed from this frozen list so dictionary edits cannot move historical candidates’ `readiness_pct`. New candidates may use live required flags when `schema_version >= 2`, but only after Sprint 0 safety net + green parity.

### 5.4 Required uploads (verification studio)

passport, photo, degree (highest), language certificate (sprach), CV, police clearance, medical fitness, driving licence.

---

## 6. Core RIP workflows (MUST implement)

### 6.1 Intake + OCR + verification studio (`/candidates/new`)

**Stages:** `type` → `product` → `upload` → `processing` → `dashboard` → `section` → `review`

1. Choose mode: **single** or **bulk** (bulk supports folder/ZIP grouping).
2. Choose product (`nurses` | `ausbildung` | `pre_bachelor` | `pre_masters` | `mba`).
3. Upload PDF/images → create `intake_batches` + placeholder `candidates` + storage objects + `candidate_documents`.
4. Per candidate run document intelligence:
   - Download from storage
   - OCR (skip if same `sha256` already `ocr_status=complete`)
   - AI extraction from **this candidate’s OCR only**
   - Write `document_extractions`; backfill identity + `extracted_fields` jsonb
5. Staff opens verification studio: section-by-section review, human edits, confidence badges, draft autosave.
6. Approve only when:
   - All three declarations checked (reviewed / matches / complete)
   - All required sections verified
   - Then set `status=shortlisted`, `gate_status=eligible`, persist `extracted_fields`, write audit `verification_completed`

**Hang/resilience requirements (learned from production):**

- Every network step (hash, upload, OCR, DB draft write) must have a hard timeout.
- Session refresh before draft finalisation if token near expiry.
- Parallel uploads with bounded concurrency; OCR concurrency ≥ 3.
- Outer draft-phase budget so one stuck candidate cannot freeze the batch UI.

### 6.2 Document intelligence isolation (CRITICAL)

1. Every document processed must belong to the `candidateId` (verify via isolation helpers, never trust callers alone).
2. AI prompts must only contain OCR text from that candidate.
3. Never invent data the model did not extract; unmapped values go to an `unmapped` bucket.
4. Human values in `document_extractions.human_value` must never be deleted by re-extraction.

### 6.3 Mapper / merge / readiness

- **Mapper:** extractor names → canonical keys via aliases; normalisers for date, name, gender, country, CEFR, provider, passport_no, phone, email, year.
- **MRZ:** parse TD3 when present; checksum failures flag but do not drop values.
- **Merge precedence:** human-edited → valid MRZ → document authority → confidence → recency. Record conflicts; do not silently discard losers (`superseded` rows OK).
- **Readiness:** `% = requiredSatisfied / requiredTotal` using schema-versioned required set.

### 6.4 Candidates list & detail

- `/candidates` — filter by product/status, search, bulk actions, stage editor, drawer.
- `/candidates/:id` — profile, documents, audits, open intake resume.

### 6.5 Selection Engine (`/admin/scoring`)

- Configurable weighted criteria + locked gates (e.g. passport, B2 German, degree/12th).
- Programs: professional nurses, Ausbildung (extendable).
- Persist config; drive placement readiness / shortlist eligibility.

### 6.6 STI / Evaluation Center (`/sti`, `/sti/:candidateId`)

Speaking, training, interview L1/L2 modules; readiness pills from Selection Engine.

### 6.7 Contracts & portals

- `/contracts/:id/sign` — candidate signing flow.
- `/agency`, `/employer`, `/candidate` — role portals.
- `/emails` — Email Center (templates + logs; wire EU provider).
- `/admin/users`, `/admin/roles`, `/reports`, `/dashboard`, `/recruiter`.

---

## 7. Routes (RIP)

| Route | Screen |
|---|---|
| `/login` | Magic-link auth (may redirect when bypassed in dev) |
| `/dashboard` | Product-aware executive dashboard |
| `/candidates` | Candidate master list |
| `/candidates/new` | Full-screen intake studio (no chrome) |
| `/candidates/:id` | Candidate detail |
| `/candidates/:id/intake` | Resume verification (when implemented) |
| `/admin/scoring` | Selection Engine |
| `/admin/parity` | Sprint 0 migration parity (admin only) |
| `/admin/users`, `/admin/roles` | Admin |
| `/sti`, `/sti/:candidateId` | Evaluation Center |
| `/recruiter` | Recruiter hub |
| `/agency`, `/employer`, `/candidate` | Portals |
| `/contracts/:id/sign` | Contract signing |
| `/emails` | Email Center |
| `/reports` | Reports |
| `/documents/import`, `/documents/bulk` | Redirect → `/candidates/new` |

---

## 8. Schema versioning & migration safety (MUST if evolving fields)

### 8.1 Sprint 0 — Safety net (no user-facing behaviour change)

1. Add `schema_version int not null`; set existing rows to **1**; then default new rows to **2**.
2. Readiness resolves required list from `schema_version` via `LEGACY_REQUIRED_SET` for v1.
3. Capture `readiness_snapshots` for every candidate **before** dictionary changes.
4. Admin Parity screen implementing eight checks (M6); re-runnable; list failing rows.
5. Session flush: `migration_pending` realtime broadcast → open verification sessions autosave, 10-minute countdown, then read-only with banner:  
   `"Intake is being upgraded. Verification resumes at HH:MM. Your saved work is safe."`
6. Extraction debug drawer (staff): uploaded file, OCR, classification evidence, raw model JSON, mapping table (extracted → resolved key → outcome), normalisation before/after, merge decision, DB write result.

**CRITICAL:** `readiness_pct` must not change for any candidate as a result of Sprint 0. Verify before/after.

### 8.2 Suggested M6 parity checks

1. Every candidate has `schema_version` populated  
2. Existing snapshotted cohort remains on version 1  
3. New-row default is 2  
4. `LEGACY_REQUIRED_SET` matches live required keys + DB meta  
5. Live readiness % equals latest snapshot (**zero drift**)  
6. Snapshot coverage for every candidate  
7. Human values intact (counts ≥ fingerprint)  
8. Identity fields stable vs snapshot fingerprint  

### 8.3 Sprint 1 — Education / language schema migration

**Phase 1 (deploy ~3 days early, unused):** create `intake_education_records`, `intake_language_certificates`, `intake_language_modules` — do not wire to UI.

**Phase 2 (in window, do not modify SQL):** backfill with frozen literals:

- education `level = 'unknown'` — do **not** classify  
- `grade_scale = 'other'` — do **not** infer scale  
- language `overall_result = 'unknown'` — do **not** set `passed`  
- record `status` = strongest human status on any legacy field (`verified` > `human_edited`)  
- candidates with **no** legacy data get **no** record  

**Phase 3:** ordinal-0 sync triggers write back to legacy field address (`extracted_fields` / `document_extractions`).

**Compatibility layer:** `LEGACY_KEY_MAP` — reads resolve old keys → new table/column; writes go to new address only; `language.exam_date` is **read-only** (fans out to modules). Increment a resolution counter; expose on admin Parity screen.

**Gate:** Parity fully green **and** readiness drift exactly 0 before lifting freeze. On failure: **ROLL BACK** — do not patch forward inside the window.

---

## 9. Security & compliance (RIP)

| Rule | Detail |
|---|---|
| Isolation | All document/extraction reads filtered by `candidate_id` at the DB query choke-point |
| Audit | `audit_events` append-only |
| RLS | Staff vs portal policies; support `development` vs `production` modes |
| Auth | Inactive users blocked; map `auth.users` → `app_users` |
| PII | Treat candidate docs and extractions as sensitive; private storage |
| OCR honesty | Never invent fields; flag low confidence |
| Claims (Growth crossover) | No visa/job/salary guarantees in outbound copy |

---

## 10. Suggested module layout (RIP)

```
src/
  intake/                 # fieldDictionary, mapper, merge, normalisers, mrz, keyAliases
  lib/
    intake/               # batch, persist, hangBudgets, readiness*, parity*, writeNewAddresses
    docintel/             # pipeline, isolation, fingerprint, rasterize, providers/*
    workflow.ts           # stages + placement readiness
    rbac.ts               # permission catalog
    security/rls-mode.ts
  pages/                  # Dashboard, Candidate*, STI*, portals, admin, Parity
  components/intake/      # upload, processing, review, debug drawer
  components/candidates/  # list, drawer, filters, bulk
  hooks/                  # useAuth, useCandidates*, useMigrationFlush
  store/                  # auth, product, selectionEngine, ui
  integrations/supabase/  # client, types
  config/products.ts
supabase/
  migrations/             # ordered SQL
  sql/                    # rollback scripts for migration windows
tests/                    # hang, speed, readiness freeze, parity, mapper
scripts/                  # capture_readiness_snapshots, m10_gate
```

---

## 11. Acceptance criteria (RIP MVP)

Build is “done enough to operate” when:

1. Staff can create a single or bulk intake for a product, upload documents, and see OCR/AI fill section fields.
2. Cross-candidate document leakage is impossible via the isolation layer (add a regression test).
3. Staff can edit fields, verify each section, autosave drafts, and approve only with declarations + required sections.
4. Approved candidates land in `shortlisted` / `eligible` with audit events.
5. Candidate list supports stage transitions per workflow rules.
6. Selection Engine gates affect placement readiness display.
7. Auth maps to `app_users` + role; admin can manage users/roles (even if some permission UI is mock-backed initially).
8. Re-running OCR does not wipe human edits.
9. If schema versioning is shipped: Parity green and readiness drift = 0 for the frozen cohort.
10. Timeouts prevent “Finalising candidate draft…” from hanging forever.

---

## 12. Growth OS (separate product — do not rebuild into `public`)

Full requirements live in **`SRD.md`** (WFE-SRD-DGS-002). Summary only:

### 12.1 Purpose

One operator dashboard for demand generation: Meta/Google ads (read continuous, write only on approval), Pathway Diagnostic lead magnet, lead scoring, WhatsApp qualification agent, counsellor support, SEO content pipeline, capacity governor, analytics from ad impression → paid candidate.

### 12.2 Binding constraints

| ID | Constraint |
|---|---|
| C-01 | Infra ≤ €300/mo at launch (excludes ad spend / WA fees) |
| C-02 | Supabase + pg-boss; no parallel CRM |
| C-03 | GDPR/DSGVO, erasure cascade, EU residency / ZDR for LLMs on messages |
| C-04 | No outcome guarantees in outbound copy; compliance gate |
| C-05 | **Autonomous ad spend strictly banned** — every spend mutation needs Pending Action approval |
| C-06 | Diagnostic usable on low-end Android / 3G |
| C-07 | EN + Hindi at launch; no hard-coded candidate strings |
| C-08 | Non-technical operator UX; phone-approvable |

### 12.3 Module index (implement behind `growth` schema)

| ID | Module |
|---|---|
| M1 | Pathway Diagnostic |
| M2 | Lead capture / consent / GDPR erasure |
| M3 | Lead scoring + routing |
| M4 | WhatsApp qualification agent |
| M5–M6 | Nurture / Sales copilot (see SRD) |
| M7 | Objection library |
| M8 | Analytics rollups |
| M9 | Capacity governor |
| M10 | Referrals |
| M11 | Compliance assets |
| M12 | Retargeting sync |
| M13 | Ad platform control (Meta + Google, approval writes) |
| M14 | Organic SEO engine |
| M15 | Unified Operator Dashboard + Pending Actions inbox |

### 12.4 Hard architectural rule

The credential that can mutate ad spend exists **only** inside an action executor that accepts **approved Pending Action records**. No other path may reach those credentials.

---

## 13. Non-goals / out of scope (unless explicitly requested)

- Fully autonomous ad spend or autonomous candidate status changes based on LLM whim  
- Payment processing  
- TikTok / LinkedIn / DV360 ads (Growth v3)  
- Voice calling  
- Inventing OCR fields or classifying education level / pass-fail during schema backfill  
- Force-pushing Lovable-synced history  
- Merging Growth tables into `public` or RIP tables into `growth`

---

## 14. Build order for a greenfield agent

1. Supabase project: Auth, `public` tables from §4.1, storage bucket, RLS helpers, seed roles.  
2. Auth → `app_users` mapping + staff shell (dashboard, candidates list).  
3. Intake batch persist + storage upload with timeouts.  
4. Docintel isolation + stub OCR provider + pipeline writing `document_extractions`.  
5. Wire real vision OCR behind env keys.  
6. Field dictionary + mapper + merge + readiness.  
7. Verification studio UI (sections, human edit, approve).  
8. Workflow stages, Selection Engine, STI shell.  
9. Portals + contracts + audit.  
10. Sprint 0 safety net before any dictionary expansion.  
11. Only then: Growth OS per `SRD.md` in schema `growth`, linking leads → `candidates`.

---

## 15. Glossary

| Term | Meaning |
|---|---|
| RIP | Recruitment Intelligence Platform (this document §§1–11) |
| Growth OS | Demand-gen system in `SRD.md` |
| Diagnostic | Interactive Germany Career Assessment lead magnet |
| Intake (RIP) | Document upload + verification batch for a product |
| Intake (Growth) | Dated training/placement cohort with capacity ceiling |
| Readiness % | Fraction of required intake fields satisfied |
| Placement readiness | Recruiter label derived from `status` + `gate_status` |
| Pending Action | Growth recommendation awaiting human approve/reject |
| Ordinal 0 | Primary education/language row that syncs to legacy keys |
| LEGACY_REQUIRED_SET | Frozen 10 keys for schema_version 1 readiness |

---

*End of PRODUCT_REQUIREMENTS.md — keep this file as the greenfield brief; use `SRD.md` for Growth-only detail; use migration SQL on sprint branches for exact DDL when evolving live data.*
