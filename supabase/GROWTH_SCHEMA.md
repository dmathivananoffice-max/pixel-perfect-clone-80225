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
