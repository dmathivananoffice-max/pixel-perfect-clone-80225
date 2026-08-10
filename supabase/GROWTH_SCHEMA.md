# Growth schema (`growth`)

Phase 1 database foundation for the Workforce Europe Growth OS
([SRD.md](../SRD.md) §17, §3). Migration:
`migrations/20260809090000_growth_phase1_schema.sql`.

## Tables (one line each)

| Table | Purpose |
|---|---|
| `lead` | Candidate contact identity, UTMs/click IDs, consent, and shared platform link. |
| `diagnostic_session` | Pathway Diagnostic answers, branch, rules version, and result (or abandonment). |
| `score` | Deterministic composite score + band with per-dimension values and explanation. |
| `score_override` | Counsellor/admin band override with required reason code. |
| `conversation` | Messaging thread (e.g. WhatsApp) for a lead. |
| `message` | Individual inbound/outbound messages within a conversation. |
| `objection` | Logged objection verbatim with optional taxonomy code. |
| `asset` | Versioned content/ad/FAQ assets with compliance status and claim flag. |
| `sequence` | Declarative nurture sequence config keyed by band/pathway/objection. |
| `send_event` | Attributed outbound send from a sequence step to a lead. |
| `intake` | Pathway intake cohort capacity and fill level. |
| `funnel_event` | Server-side funnel/analytics event tied to lead and/or diagnostic session. |
| `audit` | Append-only actor/action log with gate results (no app UPDATE/DELETE). |
| `llm_usage` | Per-module LLM token and € cost meter (FR-A-07 / C-01). |
| `config` | Versioned runtime config (scoring weights, bands, branches, taxonomy). |
| `config_change` | Change history for `config` writes (who/when/old→new). |
| `lead_touch` | Append-only touch history for lead merges (FR-L-02). |
| `suppression` | Hashed phone/email suppression list after GDPR erasure (FR-L-04). |

`lead` also has `erased_at` and `diagnostic_session_id` (M2).

## Roles (summary)

| Role | Use |
|---|---|
| `growth_app` | Application DB role — DML except audit UPDATE/DELETE. |
| `growth_break_glass_admin` | Emergency audit mutation only; not used by the app. |
| `growth_agent_*` | Least-privilege service roles per agent (WhatsApp, scoring, etc.). |
| JWT roles via `public.app_users` | `counsellor`, `marketing_operator`, `compliance_reviewer`, `admin` (+ existing `super_admin` / `managing_director` as admin). |

## Verify locally

```bash
./scripts/verify_growth_phase1_schema.sh
```

Checks: clean apply on a fresh database, all `growth.*` tables present,
`UPDATE` on `growth.audit` as `growth_app` fails.

## M1 additions

- `diagnostic_session`: `started_at`, `updated_at`, `last_question_id`, `last_question_index`
- `growth.mark_abandoned_diagnostic_sessions(interval)` → writes `DIAG_ABANDONED` funnel events
- Config keys: `diagnostic_rules:<branch>`, `diagnostic_branches:<branch>`

## M3 additions

- `growth.job_outbox` — pending pg-boss jobs (`growth.score.recompute`, counsellor/DQ side-effects)
- Config keys: `scoring_weights`, `scoring_bands` (**STARTING VALUES** for tuning)

## M8 / M15 additions (analytics + dashboard shell)

Migration: `migrations/20260809190000_growth_m8_analytics_dashboard.sql`.

- `funnel_daily_rollup` — daily stage × pathway × source counts (FR-DB-05)
- `diag_dropoff_rollup` — per-question Diagnostic answers
- `llm_daily_rollup` — daily AI cost by module (FR-A-07)
- `dashboard_alert` — home alert strip
- `growth.refresh_funnel_daily_rollup(days)` — hourly pg-boss target
- UI: `/dashboard` (Home / Funnel / Leads), glossary in
  `src/growth/analytics/config/glossary.v1.json`
- Edge: `analytics-dashboard`
- Late funnel stubs: COUNSELLING_ATTENDED / APPLICATION_SUBMITTED / PAID
  via counsellor manual actions

## M9 additions (capacity governor)

Migration: `migrations/20260809180000_growth_m9_capacity_governor.sql`.

- `intake` columns: `label`, `status`, `updated_by`, `updated_at`
- `pathway_capacity_state` — fill ratio, waitlist_mode, `pathway_throttled`,
  dashboard flag, waitlist copy (read by Diagnostic CTA; Phase 2 nurture/ads)
- `urgency_copy_template` — FR-N-05 scarcity schema (requires intake_id or
  calendar_event_id)
- Config: `capacity_governor` (default fill_threshold 0.85)
- Helpers: `growth.nearest_intake`, `growth.next_intake_after`
- UI: `/capacity` manual admin (platform sync = Phase 2 integration point)
- Job: `growth.capacity.governor.hourly` (pg-boss cron)
- Edge: `capacity-governor`

## M7 additions (objection intelligence)

Migration: `migrations/20260809170000_growth_m7_objection_library.sql`.

- `objection` columns: `pathway`, `session_id`, `meta`
- `objection_taxonomy_map` — FR-O-03 fear / evidence / asset refs / talk track
  (writable by `marketing_operator` + admin)
- `exit_survey_dispatch` — Diagnostic abandon → WhatsApp exit survey tracking
- `growth.objection_trends(weeks, pathway)` — weekly counts by code × pathway
- `growth.exit_survey_candidates(limit)` — abandoned sessions with contact
- UI: `/objections` (log / trends / mapping), `/exit-survey` tap-select
- Edge: `objection-library`

## M4 additions (WhatsApp qualification agent)

Migration: `migrations/20260809160000_growth_m4_whatsapp.sql`.

- `conversation` columns: `wa_phone`, token totals, `low_confidence_streak`,
  `agent_state`, `qualification_state`, opt-in / first-outbound flags,
  `diagnostic_summary`
- `llm_usage`: optional `conversation_id`, `lead_id`, `purpose`
- `wa_template` — template registry for outside-24h sends (FR-W-06)
- `counselling_slot` — stub booking slots
- `filter_log` — FR-W-10 blocked outbound drafts
- `counsellor_queue` — FR-W-05 escalations
- Config seeds: `whatsapp_token_budget`, `whatsapp_faq_retrieval`,
  `objection_taxonomy_v1`
- Edge: `whatsapp-webhook` (Meta Cloud API verify + inbound loop)
- Core: `src/growth/whatsapp/*` (filter, retrieval, budget, conversation)

## M11 additions (compliance + asset library)

Migration: `migrations/20260809150000_growth_m11_asset_compliance.sql`.

- Asset status lifecycle: `DRAFT` → `IN_REVIEW` → `APPROVED` → `RETIRED` (+ `REJECTED`);
  `PENDING_COMPLIANCE` renamed to `IN_REVIEW`
- `asset` columns: `body`, `claim_checklist`, review/submit identity + timestamps,
  `parent_asset_id`, `version_hash`, FAQ fields `question_patterns[]` / `answer_text`
- `growth.asset_active_sequence_refs(uuid)` — blocks retire when an active sequence
  references the asset (FR-P-04)
- Send-path hard gate (G-2): only `APPROVED` assets resolve; see
  `src/growth/assets/resolve.ts` and edge action `resolve`
- Internal UI: `/compliance` queue for IN_REVIEW assets
