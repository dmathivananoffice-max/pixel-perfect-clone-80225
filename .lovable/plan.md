# Candidate Intelligence Center — Phased Implementation Plan

All 42 recommendations accepted. Delivering in 6 phases so each phase ships a usable slice and we can course-correct between them. Current data layer is `mockData` — plan works against that now and swaps to Lovable Cloud tables in Phase 6 without changing UI code (single `useCandidatesQuery` hook is the seam).

---

## Phase 1 — Design system + shell (foundation)

Goal: Apple/Linear/Stripe/Notion visual language, applied app-wide.

- Refresh `src/styles.css` tokens: neutral-first palette, refined radii, elevation scale (subtle shadows only), motion tokens (150/220/320ms), focus rings.
- Typography: Inter Display for UI + Söhne-like body via system stack fallback; tabular numerals for tables.
- New primitives: `DataTable`, `Drawer`, `CommandPalette`, `Kbd`, `Toolbar`, `FilterChip`, `StatusPill`, `CountryFlag` (uses `country-flag-icons`), `Avatar`, `EmptyState`, `SkeletonRow`.
- Global `⌘K` command palette (`cmdk`), global toast (`sonner`), global keyboard map hook.
- Sticky app chrome; remove heavy borders across existing pages.

## Phase 2 — Candidate list core (the operational spine)

Goal: replace `src/pages/CandidateList.tsx` with the Intelligence Center list.

- Header: sticky, product selector, global search, filter button, saved-views menu, Import, Export, Bulk Actions, primary **+ Add Candidate** (shortcut `A`).
- URL-synced state via TanStack Router `validateSearch` (page, q, filters, view, open drawer id, sort). All filter/search/sort live in the URL.
- Columns (product-adaptive presets): Rank · Candidate (avatar + name + flag tooltip) · Product · Stage (inline editable) · AI Score (bar+num) · Language Level · Speaking · STI/Training · Interview · Status pills · Recruiter · Last Activity · Actions.
- Virtual scrolling via `@tanstack/react-virtual`, sticky header + sticky first column.
- Row hover prefetches drawer data (250ms intent).
- Keyboard: `j/k` row, `Enter` drawer, `x` select, `Shift+x` range select, `/` search, `F` filter, `E` export, `A` add.
- Inline stage editor: popover with allowed transitions + optional ≤120-char note; optimistic update with 5s undo toast; writes to `candidate_status_history`.
- Duplicate detection on Add (email/phone/passport fuzzy).

## Phase 3 — Filters, saved views, bulk actions

- Filter panel: multi-select product, country, country-group, language level, speaking/STI/interview/visa/recognition status, recruiter, trainer, assessor, employer, score range, registration date, document status, placement-ready, consent status, passport-expiry window.
- Saved Views: per-user, pinnable to sidebar; stored in Cloud (Phase 6) with localStorage fallback until then.
- Bulk actions bar (appears on selection): Assign Speaking / STI / Interview / Recruiter / Employer, Move Stage, Request Documents, Email, WhatsApp, SMS, Generate Report, Export. Each opens a compact modal (trainer + date for Speaking, etc.) and shows per-row success/fail summary.

## Phase 4 — Candidate Drawer (Candidate 360° compact)

Right-side drawer, deep-linkable (`?open=CID`). Sections as tabs: Overview · Timeline · Documents · Assessments (Speaking, Training, Interview 1, Interview 2 — each independent) · Visa · Recognition · Communication · Notes · History · AI. Drawer and `/candidates/:id` full page share the same section components (single source of truth = the Candidate 360° pattern).

- AI panel: strengths, weaknesses, placement probability, recommended employers, recommended product, missing docs, next best action, risk flags. Uses Lovable AI Gateway (server function, no key exposed).
- Comments with `@mentions`, internal-only visibility.

## Phase 5 — Assessment split + workflow config

- Split STI into two independent modules: **Speaking Assessment** and **Training** (separate tables, separate scoring rubrics, separate queues, separate filters). Types + mock data updated.
- Workflow config: `workflow_stages`, `workflow_transitions`, `products`, `assessments`, `country_groups`, `filters_config` — seeded from current hard-coded values but editable in an Admin → Configuration page.
- Table columns/quick-actions read from product config (already the pattern in `src/config/products.ts`) — extended to include column presets.

## Phase 6 — Lovable Cloud data layer

Migrate mock data behind server functions + RLS. Tables (all with GRANT + RLS + `service_role`):

- `candidates` (add `nationality`, `current_country`, `passport_country`, `passport_expiry`, `consent_flags jsonb`, `assigned_team jsonb`, `last_activity_at`, `placement_readiness numeric`, `org_id`, `region_id`, `deleted_at`)
- `speaking_assessments`, `training_assessments`, `interview_rounds` (round 1..n)
- `candidate_status_history` (append-only; actor, from, to, note ≤120, at)
- `workflow_stages`, `workflow_transitions`, `products`, `assessments_config`, `country_groups`
- `saved_views`, `candidate_comments`, `candidate_ai_summaries` (cached)
- Materialized view `candidate_intelligence_v` (joins latest scores, doc completeness, days-since-activity) — refreshed on write via trigger.
- Postgres `tsvector` search column + GIN index.
- Roles: `user_roles` + `has_role()` (per knowledge). Field-level PII redaction handled in server function based on `pii:read` role.
- GDPR: soft-delete + 30-day purge cron via `/api/public/cron/purge` (secret-verified), consent gate on any bulk email/SMS/WhatsApp action, data-residency tag.
- Server functions: `listCandidates`, `getCandidate`, `updateStage`, `assignSpeaking`, `assignTraining`, `assignInterview`, `bulkAction`, `aiSummary`, `savedViews.*`, `commentAdd`. All authenticated; audit every mutation.

---

## Technical notes

- No new page routes for drawer; state lives in URL search params.
- Virtual list uses server-side pagination (cursor) from Phase 6; Phase 2 uses in-memory pagination over mock data with the same hook signature.
- All colors/shadows via CSS tokens — no hard-coded hex in components.
- No Supabase Edge Functions; all app logic via `createServerFn`. Cron/webhooks via `/api/public/*` server routes.
- AI calls go through Lovable AI Gateway from a server function; no key in browser.

## Out of scope for this pass

- Native mobile shell (responsive web only).
- White-label theme editor UI (tokens ready, admin UI later).
- Full multi-tenant org switcher UI (schema ready, single-org default).

---

**Proposed execution order:** ship Phase 1 + Phase 2 in the first build (visible transformation), then Phase 3, then Phase 4+5 together (drawer needs the split assessments), then Phase 6 (Cloud).

Reply **"go"** to start with Phase 1 + 2, or tell me to reorder / drop specific items.
