# Software Requirements Document

## Workforce Europe — AI-Native Growth Operating System

### Demand Generation · Ads Control · Lead Qualification · Sales · SEO · Analytics — One System

| | |
|---|---|
| **Document ID** | WFE-SRD-DGS-002 |
| **Version** | 2.0 |
| **Date** | 09 August 2026 |
| **Status** | Draft for review |
| **Owner** | Workforce Europe GmbH (G&W Unternehmensgruppe) |
| **Audience** | AI build agent (primary), engineering contractor, internal stakeholders |
| **Supersedes** | WFE-SRD-DGS-001 v1.0 |

**What changed in v2.0:** Added M13 (Ad Platform Control — Meta Ads API + Google Ads API with approval-based execution), M14 (Organic SEO Engine — Search Console + content pipeline + CMS publishing), M15 (Unified Operator Dashboard — the single control surface), the Pending Actions approval framework (Section 12), expanded data model, revised phases, and non-IT usability requirements (NFR-09/10/11). Core v1 modules M1–M12 carry forward unchanged except where amendments are marked **[v2]**.

---

## 1. Introduction

### 1.1 Purpose

This document specifies one integrated system that runs Workforce Europe's entire online growth operation from a single dashboard: ad campaigns on Meta and Google (monitored automatically, changed only with human approval), the Pathway Diagnostic lead magnet, lead scoring and WhatsApp qualification, counsellor sales support, organic SEO content, and end-to-end analytics from ad impression to paid candidate.

**The operating principle:** the System watches everything, recommends actions with evidence, and executes only what a human approves. Nothing spends money, publishes content, or changes a candidate's status on its own.

The commercial objectives, in priority order:

1. Reduce **cost per qualified candidate** (not cost per lead).
2. Increase **counselling attendance** and **counselling → application** conversion.
3. Protect counsellor capacity by **disqualifying unsuitable leads automatically**.
4. Never generate demand beyond confirmed **intake capacity**.
5. Give a **non-technical operator full control** without logging into Meta Ads Manager, Google Ads, or a CMS for routine operations.

### 1.2 Scope

**In scope:** everything from v1 (Diagnostic, lead engine, scoring, WhatsApp agent, nurture, copilot, objection library, analytics, capacity governor, referrals, content compliance pipeline, retargeting sync) **plus**: Meta Marketing API and Google Ads API integration (read continuously, write via approval), Google Search Console integration, SEO content brief → draft → publish pipeline, the Pending Actions approval queue, and the Unified Operator Dashboard as the single control surface.

**Out of scope (all versions until explicitly revised):** fully autonomous spend changes of any kind (hard ban, Section 12.1), payment processing, the candidate visa/document workflow (existing Recruitment Intelligence Platform), employer-side B2B marketing, voice calling, programmatic/DV360, TikTok/LinkedIn ads (v3 candidates).

### 1.3 Definitions

| Term | Definition |
|---|---|
| Lead / MQL / SQL | As v1: contact → completed Diagnostic + score ≥ threshold → confirmed by qualification |
| Pathway | Nursing Professional, Nursing Ausbildung, Doctors, Technicians/Mechatronics, Logistics, FSJ, Bachelor, Master |
| Diagnostic | Germany Career Assessment interactive tool (Section 5) |
| Intake | Dated training/placement cohort with hard capacity ceiling |
| Claim | Any outbound statement about outcomes, timelines, costs, salaries, visas, or recognition |
| **Pending Action** | A system-generated recommendation with evidence, awaiting human approve/reject, that executes via API only on approval |
| **Guardrail** | A hard numeric limit on what any approved action may change (e.g., max budget delta per action) |
| Operator | The human who reviews Pending Actions — marketing operator or MD |

### 1.4 Constraints (binding)

| ID | Constraint |
|---|---|
| C-01 | Recurring infrastructure cost ≤ **€300/month** at launch volume (excludes ad spend, WhatsApp conversation fees, and optional SEO data provider — see 2.3). |
| C-02 | Integrates with existing stack: **Supabase (PostgreSQL), pg-boss**, React/TypeScript. Supabase is the single source of truth; no parallel CRM. |
| C-03 | GDPR/DSGVO: lawful basis logging, erasure cascade, EU data residency for personal data at rest, ZDR terms for LLM providers touching message content. |
| C-04 | No outbound message may state or imply a guarantee of visa approval, employment, recognition, Kenntnisprüfung success, or specific salary. All claim-bearing content passes the compliance gate before first use. |
| C-05 | **Autonomous spend is strictly banned.** No API write that creates, increases, decreases, pauses, or resumes paid spend may execute without an explicit human approval recorded in the audit log. There is no configuration flag, feature toggle, or agent permission that can bypass this. This constraint is architectural (Section 12.1), not policy. |
| C-06 | Primary candidate devices: low/mid-range Android on variable connectivity in India. Diagnostic usable at 3G speeds. |
| C-07 | Candidate-facing languages at launch: English + Hindi. No hard-coded strings. |
| C-08 | **Operator surfaces must be usable by a non-technical person.** Plain language, no ad-platform jargon without inline explanation, every recommendation self-contained (what, why, evidence, cost, risk), approvals possible from a phone. |

### 1.5 Design principles

1. **One inbox for everything.** All decisions the System wants a human to make arrive as Pending Action cards in one queue. The operator never hunts across platforms.
2. **Recommend with evidence, execute on approval.** Every card shows the numbers that justify it. Approve = API executes + audit entry. Reject = logged with reason, and the System learns not to repeat it.
3. **One question per screen, tap over type** (candidate surfaces). Payout before the ask.
4. **Honesty converts.** Realistic eligibility including "not yet." Scarcity only from real calendar events.
5. **Capacity gates demand.** Ads, CTAs, and sequences throttle from the intake calendar.
6. **Every objection is data.** One library feeding content, follow-up, ads angles, and SEO briefs.
7. **AI invisible to candidates, transparent to operators.** Every AI action is labeled and auditable internally; the WhatsApp bot discloses it is automated.

---

## 2. System context and architecture

### 2.1 Context diagram (textual)

```
   PAID CHANNELS                         ORGANIC
┌────────────────┐                 ┌────────────────┐
│ Meta Ads       │◄───approved────│ SEO pages (CMS)│◄── approved publish
│ Google Ads     │    actions     │ Search Console │
└──────┬─────────┘                └──────┬─────────┘
       │ metrics (hourly read)           │ rankings/impressions (daily read)
       ▼                                 ▼
┌──────────────────────────────────────────────────────────────┐
│              M15 UNIFIED OPERATOR DASHBOARD                  │
│  Today's numbers · Pending Actions inbox · Alerts · Memos    │
└──────┬───────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│ Landing pages + Pathway Diagnostic (M1)                      │
│        ↓                                                     │
│ Lead engine: capture/dedupe/consent (M2) → Scoring (M3)      │
│        ↓                    ↓                                │
│ WhatsApp Agent (M4)   Nurture Engine (M5)                    │
│        ↓                                                     │
│ Counsellor workspace: Copilot (M6) · Objection Library (M7)  │
│        ↓                                                     │
│ Analytics + Attribution (M8) · Capacity Governor (M9)        │
│ Referrals (M10) · Content/Compliance (M11) · Audiences (M12) │
│ Ad Platform Control (M13) · SEO Engine (M14)                 │
│                                                              │
│           Supabase (single DB) · pg-boss (jobs)              │
│           Audit log (append-only) · LLM cost meter           │
└──────────────────────────────────────────────────────────────┘
       ▲                                 ▲
       │ offline conversions (CAPI/GAds) │ audience sync (hashed)
       └────────────── back to ad platforms ────────────────────┘
```

### 2.2 Technology decisions

| Layer | Decision | Rationale |
|---|---|---|
| Database | Supabase PostgreSQL, schema `growth` | C-02; one identity across recruitment + marketing |
| Async jobs | pg-boss | Existing; hourly/daily API sync jobs, action execution jobs |
| Frontend | React/TypeScript; Diagnostic static-first; Dashboard responsive (phone-first for approvals) | C-06, C-08 |
| LLM — conversation | Anthropic API, haiku-class for WhatsApp; sonnet-class for briefings, memos, recommendation drafting | Cost under C-01 |
| Meta integration | **Meta Marketing API** (system user token, Business Manager app). Scopes: `ads_read` always; `ads_management` used exclusively by the action executor service (Section 12.3) | M13 |
| Google Ads integration | **Google Ads API** (developer token + OAuth service account). Read continuous; mutate calls only from action executor | M13; token approval lead time → R-01 |
| SEO data | **Google Search Console API** (read-only, free). Optional: DataForSEO for keyword volumes (~€50/mo, outside C-01 envelope, owner decision OQ-04) | M14 |
| CMS publishing | CMS REST API (WordPress REST / Webflow API — confirm current site CMS, OQ-05). Publishing is an approved action only | M14 |
| WhatsApp | Meta WhatsApp Business Cloud API (direct) | C-01 |
| Email | EU transactional provider (Postmark/Brevo EU — OQ-01) | C-03 |
| Analytics | Server-side event log (Postgres) + GA4 client + Meta CAPI + Google offline conversions (server) | Attribution integrity |

### 2.3 Budget envelope (C-01)

| Item | Est. €/month |
|---|---|
| Supabase uplift | 0–25 |
| LLM API (qualification + briefings + recommendations, ~3k leads/mo) | 70–130 |
| Email provider | 15–30 |
| Hosting/edge | 0–20 |
| Meta Marketing API / Google Ads API / Search Console API | 0 (no fees) |
| Monitoring | 0 (free tiers) |
| **Ceiling (C-01)** | **300** |
| Optional, outside envelope: keyword data provider (OQ-04) | ~50 |
| Optional, outside envelope: WhatsApp conversation fees | usage-based |

FR-A-07 (cost meter) makes this observable per module per day.

---

## 3. Actors and roles

| Actor | Description | Access |
|---|---|---|
| Candidate | Prospective applicant, mobile-first, India | Public surfaces |
| Family member | Parent/spouse in the decision unit | Public surfaces; parent track |
| Counsellor | Sales/advisory staff (Noida) | Counsellor workspace |
| **Operator** | Reviews and approves/rejects Pending Actions; runs campaigns and content | Dashboard incl. Pending Actions, campaigns, content, SEO |
| Compliance reviewer | Approves claim-bearing content and ad copy | Compliance queue, audit |
| Admin / MD | Full oversight; can also approve Pending Actions (phone-friendly) | Everything + configuration + guardrails |
| System agents | Non-human actors (Section 11) | Scoped service credentials; the action executor service alone holds write credentials to ad platforms/CMS |

**Separation of duties (C-05 support):** the credential able to mutate ad spend exists only inside the action executor service, which accepts exactly one input type — an approved Pending Action record. No other service, agent, admin panel, or script path can reach those credentials.

---

## 4. Module index

| ID | Module | Priority | v2 status |
|---|---|---|---|
| M1 | Pathway Diagnostic | Must | unchanged |
| M2 | Lead capture, identity, consent | Must | unchanged |
| M3 | Lead scoring and routing | Must | unchanged |
| M4 | WhatsApp qualification agent | Must | unchanged |
| M5 | Nurture and follow-up engine | Must | unchanged |
| M6 | Sales copilot | Should | unchanged |
| M7 | Objection intelligence library | Must | unchanged |
| M8 | Analytics, attribution | Must | **amended [v2]** |
| M9 | Capacity governor | Must | **amended [v2]** |
| M10 | Referral engine | Should | unchanged |
| M11 | Content and compliance pipeline | Must | **amended [v2]** — covers ad copy + SEO articles |
| M12 | Retargeting audience sync | Should | unchanged |
| **M13** | **Ad Platform Control (Meta + Google)** | **Must** | **new** |
| **M14** | **Organic SEO Engine** | **Should** | **new** |
| **M15** | **Unified Operator Dashboard + Pending Actions** | **Must** | **new** |

Sections 5–10 of v1 (M1–M7 detailed requirements) carry forward verbatim and are included below unchanged for single-document completeness, followed by the new material.

---

## 5. M1 — Pathway Diagnostic

The core lead magnet. Replaces "book a free consultation" as the primary CTA everywhere.

| ID | Requirement | Priority |
|---|---|---|
| FR-D-01 | One question per screen, tap-to-select. No free text before results. | Must |
| FR-D-02 | 6–9 questions per branch; every question must change pathway, eligibility band, or gap list, or it may not ship. | Must |
| FR-D-03 | Persistent progress indicator ("3 of 8"). | Must |
| FR-D-04 | Branching from Q1 profile family; branches are config data, not code. | Must |
| FR-D-05 | Results render **before** any contact request: recommended pathway, eligibility band (Ready / Preparable / Not Yet), named gaps, realistic timeline range, honest risk notes, next step. | Must |
| FR-D-06 | Eligibility is a deterministic versioned rules engine, never an LLM call. Same answers → same result. | Must |
| FR-D-07 | Contact capture after results, framed as "get this plan on WhatsApp + speak to an advisor"; results stay visible if declined. | Must |
| FR-D-08 | Partial sessions persist (anonymous session ID); abandonment measurable per question. | Must |
| FR-D-09 | "Not Yet" results include a concrete preparation path and a distinct nurture track. Never a dead end, never false encouragement. | Must |
| FR-D-10 | First question interactive ≤ 2.5 s on simulated 3G; Diagnostic JS ≤ 150 KB gzipped. | Must |
| FR-D-11 | Source-specific deep links into pre-branched entries. | Should |
| FR-D-12 | Parent-facing variant sharing the engine. | Could |

Acceptance: per-question drop-off instrumented, no question (except contact) loses > 15% after two tuning weeks; deterministic outputs verified; Lighthouse mobile ≥ 85; "Not Yet" track verified end-to-end.

---

## 6. M2 — Lead capture, identity, consent

| ID | Requirement | Priority |
|---|---|---|
| FR-L-01 | Lead stores source (UTM + landing path), first-touch timestamp, Diagnostic link, consent flags with timestamp + consent-text version. | Must |
| FR-L-02 | Dedupe on E.164 phone; merge-not-overwrite; history preserved. | Must |
| FR-L-03 | Granular consent (WhatsApp / email / assessment processing); no pre-ticked boxes. | Must |
| FR-L-04 | Erasure cascades to growth schema, message logs, provider suppression lists within 30 days, audited. | Must |
| FR-L-05 | Converted leads link to platform candidate record (shared identity key). | Must |
| FR-L-06 | gclid/fbclid stored server-side for offline conversion upload. | Must |

---

## 7. M3 — Lead scoring and routing

Composite of five deterministic sub-scores (FIT, INTENT, CAPABILITY, TIMING, ENGAGEMENT), weights as config.

| ID | Requirement | Priority |
|---|---|---|
| FR-S-01 | Every score writes an explanation record (rule, inputs, weight version). Never opaque. | Must |
| FR-S-02 | Bands: HOT (counsellor SLA 4 business hours) / WARM / NURTURE / DISQUALIFIED; thresholds config. | Must |
| FR-S-03 | Band transitions enqueue pg-boss jobs (e.g., WARM→HOT → counsellor task + copilot briefing). | Must |
| FR-S-04 | Disqualification is respectful, names the gap, offers a genuine alternative where one exists; DQ leads excluded from retargeting. | Must |
| FR-S-05 | LLM may propose bounded score deltas (±15), logged as AI-proposed; can never move a lead into/out of DISQUALIFIED. | Must |
| FR-S-06 | Counsellor overrides require reason codes; feed weekly scoring-quality report. | Must |

---

## 8. M4 — WhatsApp qualification agent

| ID | Requirement | Priority |
|---|---|---|
| FR-W-01 | First message delivers Diagnostic summary + automation disclosure + "reply ADVISOR for a human." | Must |
| FR-W-02 | Closed skill set: deliver result, ask unanswered qualification questions, answer from approved FAQ corpus, send approved proof assets, book counselling, hand off. Outside the set → graceful handoff. | Must |
| FR-W-03 | FAQ answers are retrieval-only from approved corpus; low confidence → "I'll check" + escalate. No open generation about visas, salaries, timelines, costs, outcomes. | Must |
| FR-W-04 | Objection detection against taxonomy; logged to lead + library; selects next nurture asset. | Must |
| FR-W-05 | Escalation triggers: ADVISOR, complaint sentiment, out-of-corpus question, payment/refund mention, personal legal/visa question, 3 consecutive low-confidence turns. | Must |
| FR-W-06 | WhatsApp 24-hour window + template rules enforced at messaging layer. | Must |
| FR-W-07 | Full logs on lead record; erasure cascade applies. | Must |
| FR-W-08 | Hindi with automatic language matching. | Should |
| FR-W-09 | Per-conversation LLM budget cap; breach → human handoff, never silent degradation. | Must |
| FR-W-10 | Output filter blocks probability-of-visa, employment promises, guaranteed salary, certainty phrasing; hits logged and reviewed weekly. | Must |

---

## 9. M7 — Objection intelligence library

| ID | Requirement | Priority |
|---|---|---|
| FR-O-01 | Central objection records: verbatim, source, lead ref, taxonomy code, timestamp. Sources: WhatsApp (auto), counsellor one-tap UI, Diagnostic exit survey, webinar imports. | Must |
| FR-O-02 | Taxonomy v1: COST, TRUST/FRAUD-FEAR, VISA-RISK, LANGUAGE-DIFFICULTY, PARENT-APPROVAL, RECOGNITION-RISK, TIMELINE, COMPETITOR-COMPARISON, SAFETY-ABROAD, SELF-DOUBT. Config-managed. | Must |
| FR-O-03 | Each code maps to underlying fear, required evidence, approved response assets, counsellor talk track. | Must |
| FR-O-04 | Weekly LLM clustering proposes new clusters → human review queue; taxonomy never mutates autonomously. | Should |
| FR-O-05 | Objection trend dashboard + "rising objection" alert (7-day share > +50% vs 28-day baseline). **[v2]** Rising objections also generate SEO brief proposals (FR-SEO-03) and ad-angle suggestions (FR-AD-10). | Should |

---

## 10. M5 — Nurture and follow-up engine

| ID | Requirement | Priority |
|---|---|---|
| FR-N-01 | Follow-ups resolve the last unresolved objection; sequence key = (band, pathway, objection code, DU flag). Never "just checking in." | Must |
| FR-N-02 | Sequences are declarative config, editable without deployment. | Must |
| FR-N-03 | Exit conditions evaluated before every send (booked, new objection → re-route, opted out, DQ, converted). | Must |
| FR-N-04 | Frequency cap: ≤ 3 proactive contacts per lead per 7 days, all channels combined. | Must |
| FR-N-05 | Urgency references only real dated events from the intake calendar; template schema requires the event ID — scarcity without a calendar reference is structurally impossible. | Must |
| FR-N-06 | Parent/DU track with candidate consent; parent webinar invitations. | Should |
| FR-N-07 | Every send is an attributed event for asset-level conversion analysis. | Must |

---

## 11. AI agent architecture

| Agent | Autonomy | Human gate |
|---|---|---|
| WhatsApp Qualification Agent | Autonomous within closed skill set | FR-W-05 escalations |
| Scoring Adjustment Agent | Bounded proposals (±15) | DQ human/rules-only |
| Objection Clustering Agent | Propose-only | Taxonomy review queue |
| Copilot Briefing Agent | Free generation, internal-only | Never candidate-facing |
| Content Draft Agent | Drafts freely | 100% claim-bearing content through compliance gate |
| **Ads Intelligence Agent [v2]** | Read-only analysis; drafts Pending Actions with evidence | Every action requires operator approval (Section 12) |
| **SEO Intelligence Agent [v2]** | Drafts briefs and articles; drafts publish actions | Compliance gate + publish approval |
| Anomaly/Bottleneck Agent | Read-only weekly constraint memo | Informational |

**Gate rules (normative):**

- **G-1 Money:** no agent initiates anything with financial effect. Spend-affecting API writes occur only via the Pending Actions executor (Section 12.3). *(Strengthened in v2 — see C-05.)*
- **G-2 Claims:** candidate-facing text containing visa/salary/timeline/cost/recognition/employment statements exists only as versioned APPROVED assets; agents send by reference. **[v2]** Ad copy and SEO articles are claim-bearing assets under the same gate.
- **G-3 Status:** transitions into DISQUALIFIED, APPLICATION, PAID are human or deterministic-rule only.
- **G-4 Audit:** every agent action logs actor, model + version, input hash, output, gate decisions — append-only.

---

## 12. The Pending Actions framework **[v2 — core of this revision]**

### 12.1 The hard ban, stated architecturally

Autonomous spending is banned by construction, not configuration:

1. Ad-platform and CMS **write credentials exist only in the action executor service** — a separate service with no LLM, no scheduler-initiated writes, and one entry point: `execute(approved_action_id)`.
2. The executor verifies before every call: the action row exists, `status = APPROVED`, `approved_by` is a real user with the approval role, `approved_at` is set, the action is unexpired, and its parameters are within guardrails. Any check fails → no API call, incident logged.
3. There is **no code path** from any agent, cron job, or admin screen to a spend-affecting API write that does not pass through this verification. Code review requirement: any PR adding ad-platform/CMS write calls outside the executor is rejected (enforced by dependency lint rule — the API client libraries are importable only by the executor package).

This is the answer to "approval-based pending is possible, am I thinking right?" — yes, and this section is what makes it safe rather than merely intended.

### 12.2 Pending Action lifecycle

```
DRAFTED (by agent or operator)
   → PENDING (visible in inbox)
      → APPROVED (operator/MD tap) → EXECUTING → EXECUTED ✔ / FAILED ✖(alert)
      → REJECTED (reason required)
      → EXPIRED (auto, per-type TTL — stale recommendations never execute)
      → SUPERSEDED (newer action on same object)
```

| ID | Requirement | Priority |
|---|---|---|
| FR-PA-01 | Every Pending Action card contains, in plain language (C-08): **What** (one sentence), **Why now** (the trigger), **Evidence** (the actual numbers, e.g., "Campaign 'Nursing-Kerala-Video-2' — CPL €1.90 but 0 of 41 leads reached HOT in 14 days; account median 11%"), **Cost impact** (€ delta and new daily total), **Risk if approved / risk if rejected**, and **Guardrail check** (shown as passed). | Must |
| FR-PA-02 | Approve and Reject are single-tap, phone-friendly, with reject requiring a reason (tap-select list + optional note). Rejection reasons feed back to the recommending agent's context to suppress repeat recommendations. | Must |
| FR-PA-03 | Per-type TTL (default: budget changes 48 h, pauses 24 h, publishes 7 days). Expired actions never execute and are logged. | Must |
| FR-PA-04 | Approval permissions: `operator` and `admin` roles only; configurable per action type (e.g., budget increases > €X/day require `admin`). Approver identity immutable in the record. | Must |
| FR-PA-05 | Execution results (API response, new state) written back to the card; failures alert the operator with a plain-language explanation and never auto-retry spend-affecting calls more than once. | Must |
| FR-PA-06 | Batch view: related actions (e.g., "pause 3 underperforming ad sets") can be presented as one card with itemized sub-actions individually toggleable before approval. | Should |
| FR-PA-07 | Weekly digest: actions approved/rejected/expired, and measured outcome of executed actions after 7 days ("You approved pausing X — CPL since: …"). This closes the learning loop for the operator, not just the system. | Should |

### 12.3 Guardrails (hard numeric limits, admin-configurable, enforced at execution)

| Guardrail | Default |
|---|---|
| Max single budget change | ±30% of current daily budget, and ≤ €50/day absolute |
| Max account-wide daily spend ceiling | set by MD; no approved action may breach it |
| Max budget-affecting actions executed per day | 5 per platform |
| New campaign creation | Executor can create in **PAUSED state only**; activation is a separate Pending Action |
| Audience changes | Additive only via approval; DQ/opt-out exclusion lists are always applied and cannot be removed by any action |
| CMS publishing | Only assets in APPROVED status (G-2); publish action references asset version hash |

Guardrail changes themselves require `admin` role and are audit-logged.

---

## 13. M13 — Ad Platform Control (Meta + Google)

### 13.1 Read side (continuous, autonomous — reading is safe)

| ID | Requirement | Priority |
|---|---|---|
| FR-AD-01 | Hourly sync of Meta (campaign/ad set/ad) and Google Ads (campaign/ad group/keyword) entities + metrics: spend, impressions, clicks, CTR, CPC, platform-reported conversions. Stored in `campaign_metric` time series. | Must |
| FR-AD-02 | Join platform metrics to owned funnel data via UTM/click IDs: the dashboard shows, per campaign, **cost per MQL, cost per SQL, cost per attended counselling, cost per application** — not just CPL. This join is the System's core advantage over the native ad platforms. | Must |
| FR-AD-03 | Offline conversion upload: MQL, SQL, counselling-attended, application events pushed to Meta CAPI and Google offline conversions (hashed identifiers), so platform optimization targets quality. | Must |
| FR-AD-04 | UTM discipline: the System generates tracking templates per campaign; ads with missing/malformed UTMs are flagged on the dashboard within one sync cycle. | Must |

### 13.2 Recommendation side (Ads Intelligence Agent → Pending Actions)

| ID | Requirement | Priority |
|---|---|---|
| FR-AD-05 | Daily evaluation producing Pending Actions for: (a) pause — spend above threshold with qualified-lead rate below account median × factor; (b) budget shift — reallocate from low to high cost-per-SQL performers within guardrails; (c) budget reduction on capacity signal from M9; (d) resume/scale when a paused campaign's audience shows organic demand signals. Each with FR-PA-01 evidence. | Must |
| FR-AD-06 | Recommendation thresholds and minimum-data rules (e.g., never recommend on < 1,000 impressions or < 14 days unless spend > €X with zero MQLs) are config, shown on every card. | Must |
| FR-AD-07 | New campaign drafting: the agent may draft full campaign structures (targeting, budget, schedule, ad copy referencing APPROVED assets) as Pending Actions; execution creates them **paused** (guardrail); activation is a second approval. | Should |
| FR-AD-08 | Creative/ad-copy suggestions are drafted into M11 as DRAFT assets (they are claim-bearing) — never attached directly to a live ad. | Must |
| FR-AD-09 | Anomaly alerts (not actions): spend spike, delivery stop, disapproved ads, learning-phase resets — plain-language alert cards with a "what this means" line (C-08). | Must |
| FR-AD-10 | Rising objections (FR-O-05) generate ad-angle suggestions ("SAFETY-ABROAD objections up 60% — no active creative addresses it") as informational cards linked to M11 drafting. | Should |

### 13.3 Platform prerequisites (start week 1 — lead times)

Meta: Business verification, Marketing API app, system user token, `ads_read` immediately, `ads_management` scoped to executor. Google: developer token application (**approval can take 2–6 weeks — R-01**), OAuth service account, read-only until executor ships. Both accounts linked under existing Business Manager / MCC as applicable.

---

## 14. M14 — Organic SEO Engine

| ID | Requirement | Priority |
|---|---|---|
| FR-SEO-01 | Daily Search Console sync: queries, impressions, clicks, position per URL → `seo_page_metric`. | Should |
| FR-SEO-02 | SEO pages join to funnel events: per-URL Diagnostic starts, leads, MQLs — "which articles produce candidates, not just traffic." | Should |
| FR-SEO-03 | Brief generation: SEO Intelligence Agent proposes content briefs from (a) objection library rising codes, (b) Search Console queries where the site ranks 5–20 (striking distance), (c) WhatsApp question mining. Briefs = target query, intent class (informational/commercial/transactional), objection link, required proof, internal links, CTA (always a Diagnostic entry). Briefs enter a review queue. | Should |
| FR-SEO-04 | Article drafting: from an approved brief, the agent drafts the article as a DRAFT asset in M11 → compliance gate (articles about visas/costs/salaries are claim-bearing) → APPROVED. | Should |
| FR-SEO-05 | Publishing: a Pending Action ("Publish 'Kenntnisprüfung preparation timeline' to /blog/…") executes via CMS API on approval, with the asset version hash recorded. Updates to published pages follow the same path. | Should |
| FR-SEO-06 | Topic clusters as config: Germany Nursing, Nursing Ausbildung, German language, Recognition, Kenntnisprüfung, Doctors, Technical careers, Study pathways, Costs, Living, Visa/process. Every article assigned to a cluster; cluster-level performance on the dashboard. | Should |
| FR-SEO-07 | Every article ends in a pathway-matched Diagnostic deep link (FR-D-11) — the SEO → assessment → lead chain is the point of the module. | Must (if M14 ships) |
| FR-SEO-08 | No keyword-volume provider required for v2 launch; striking-distance mining from Search Console suffices. Volume provider is OQ-04. | — |

---

## 15. M15 — Unified Operator Dashboard

The single surface. A non-technical operator runs the entire growth operation here and only here (C-08).

### 15.1 Structure

| Area | Contents |
|---|---|
| **Home (Today)** | Yesterday/today at a glance: spend, leads, MQLs, bookings, attendance; Pending Actions count; active alerts; next intake fill status. Every number tappable → drill-down. |
| **Pending Actions** | The inbox (Section 12.2). Sorted by impact; badge count; phone-optimized. |
| **Funnel** | Full chain by channel/campaign/pathway: impression → click → Diagnostic start/complete → lead → MQL → SQL → booked → attended → application → paid. Cost-per-stage at every step (FR-AD-02). Per-question Diagnostic drop-off. |
| **Campaigns** | Meta + Google side by side, same metric definitions, sorted by cost per SQL. Anomaly flags inline. Manual action drafting ("pause this") — operator-drafted actions also flow through the same approval record for audit symmetry, executing immediately on self-approval within guardrails. |
| **Leads** | Band distribution, HOT queue SLA status, DQ reasons, scoring-quality report (override analysis). |
| **Objections** | Trend view, rising alerts, coverage map (which codes lack approved assets). |
| **Content & SEO** | Asset library with statuses; compliance queue; brief queue; published-page performance (FR-SEO-02); cluster view. |
| **Capacity** | Intake calendar, fill levels, governor status, waitlist counts. |
| **System** | LLM/infra cost meter vs. C-01; API sync health; audit log search; guardrail settings (admin). |

### 15.2 Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-DB-01 | Every metric has an inline plain-language definition on tap ("Cost per SQL: what you paid in ads for each lead a counsellor confirmed as genuine"). No unexplained jargon anywhere (C-08). | Must |
| FR-DB-02 | The Home + Pending Actions views are fully functional on a phone; approval flow ≤ 3 taps from notification. | Must |
| FR-DB-03 | Push/WhatsApp notification to the operator for: new high-impact Pending Action, action execution failure, spend anomaly, HOT-queue SLA breach. Notification preferences per role. | Must |
| FR-DB-04 | Weekly Bottleneck Memo (Anomaly Agent) rendered as a card: the single binding constraint, the numbers behind it, one suggested focus. Plain language, ≤ 200 words. | Should |
| FR-DB-05 | All dashboard queries ≤ 5 s at 100k-lead scale (pre-aggregated rollups via pg-boss). | Must |
| FR-DB-06 | Role-scoped views: counsellors see Leads only; compliance sees queues + audit; operator sees all operational areas; admin adds guardrails/config. | Must |

---

## 16. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Privacy: EU data residency at rest; RoPA maintained; DPAs for every provider; ZDR for LLM providers on message content; hashed identifiers only in ad-platform uploads. |
| NFR-02 | Security: RBAC per Section 3; per-agent scoped credentials; executor-only ad/CMS write credentials (12.1); no candidate PII client-side; audit append-only (no UPDATE/DELETE grants). |
| NFR-03 | Availability: candidate surfaces 99.5% monthly; WhatsApp degradation = human queue + auto-reply, never silence; ad-platform sync failure > 3 h → operator alert. |
| NFR-04 | Performance: FR-D-10 (Diagnostic); workspace load ≤ 3 s; FR-DB-05 (dashboard). |
| NFR-05 | Observability: structured logs, error tracking, FR-A-07 cost meter, weekly data-quality job (orphaned leads, consent gaps, dead sequence refs, UTM violations). |
| NFR-06 | Configurability without redeploy: scoring weights, thresholds, taxonomy, sequences, Diagnostic branches, guardrails, recommendation thresholds, SEO clusters — all versioned config. |
| NFR-07 | Localization: candidate-facing strings externalized; operator surfaces English-only v2. |
| NFR-08 | Retention: unconverted leads auto-anonymized after configurable period (default 24 months). |
| **NFR-09 [v2]** | **Plain-language mandate:** all operator-facing generated text (action cards, alerts, memos) at a general-reader level; a glossary service supplies inline definitions; forbidden-jargon list enforced in agent prompts (e.g., "CBO", "ROAS" never appear without expansion). |
| **NFR-10 [v2]** | **Trust calibration:** the System must state uncertainty honestly on cards ("14 days of data — low confidence") and never present a recommendation without its minimum-data check visible. |
| **NFR-11 [v2]** | **Onboarding:** first-run guided tour of Home + Pending Actions; every card type has a "why am I seeing this" link. Target: a new non-technical operator approves their first action correctly within 15 minutes, unassisted. |

---

## 17. Data model (core entities — v2 additions marked)

```
lead(id, phone_e164 UNIQUE, name, email, city, language, source_utm jsonb,
     click_ids jsonb, first_touch_at, consent jsonb, du_flag,
     referrer_lead_id, platform_candidate_id NULL)

diagnostic_session(id, lead_id NULL, branch, answers jsonb, completed_at NULL,
     abandoned_at_question NULL, rules_version, result jsonb)

score(id, lead_id, computed_at, fit, intent, capability, timing, engagement,
     composite, band, weights_version, explanation jsonb)
score_override(id, lead_id, by_user, from_band, to_band, reason_code, at)

conversation(id, lead_id, channel, opened_at, closed_at, handled_by)
message(id, conversation_id, direction, body, template_ref NULL,
     agent_meta jsonb NULL, at)

objection(id, lead_id NULL, source, verbatim, taxonomy_code NULL, logged_by, at)

asset(id, type, title, version, status, claim_bearing bool, body_ref,
     approved_by NULL, approved_at NULL)
sequence(id, key jsonb, steps jsonb, active bool, updated_by, version)
send_event(id, lead_id, sequence_id, step, asset_id, channel, at, outcome)

intake(id, pathway, batch_date, capacity, filled, synced_at)
funnel_event(id, lead_id NULL, session_id, type, stage, meta jsonb, at)
audit(id, actor, action, entity, before_hash, after_hash, gate_results jsonb, at)
llm_usage(id, module, model, tokens_in, tokens_out, cost_eur, day)

-- [v2] Ad platform control
ad_account(id, platform, external_id, name, currency, daily_ceiling_eur, status)
ad_entity(id, ad_account_id, level, external_id, name, parent_id,
     status, utm_template, synced_at)
campaign_metric(id, ad_entity_id, date, hour NULL, spend_eur, impressions,
     clicks, platform_conversions, synced_at)
     -- funnel joins via funnel_event ↔ click_ids/UTM

pending_action(id, type, target_ref jsonb, params jsonb,
     drafted_by, evidence jsonb, cost_impact jsonb, risk_note text,
     guardrail_check jsonb, status, ttl_expires_at,
     approved_by NULL, approved_at NULL, rejected_reason NULL,
     executed_at NULL, execution_result jsonb NULL)

guardrail(id, key, value jsonb, updated_by, updated_at)   -- versioned

conversion_upload(id, platform, event_type, lead_id, uploaded_at,
     response jsonb)

-- [v2] SEO
seo_page(id, url, cluster, asset_id NULL, published_at, version_hash)
seo_page_metric(id, seo_page_id NULL, url, date, query NULL, impressions,
     clicks, position)
content_brief(id, source(objection|striking_distance|question_mining),
     target_query, intent_class, objection_code NULL, outline jsonb,
     status, asset_id NULL)
```

Append-only enforcement on `audit`; executor-only DB role for `pending_action` status transition to EXECUTING/EXECUTED.

---

## 18. Delivery phases (revised)

### Phase 1 — Weeks 1–4 (v2 acceptance boundary, unchanged core)

M2 lead engine → M1 Diagnostic (nursing branches) → M3 scoring → M11 compliance gate + launch assets → M4 WhatsApp (English) → M7 objection logging → M8 core events → **M15 Dashboard shell: Home, Funnel, Leads** → M9 capacity governor → **M13 read-only: Meta + Google metric sync into the funnel view** (Google read may lag on token approval, R-01 — Meta first). **Week 1 in parallel:** Meta business verification, Google developer token application, Search Console verification.

Exit: all Must FRs for these modules pass; 50 real leads end-to-end in production; approved launch asset set; erasure cascade demonstrated; both ad platforms' spend visible next to owned funnel data.

### Phase 2 — Weeks 5–8

**Pending Actions framework + executor service + guardrails (Section 12)** → **M13 recommendations live (pause/shift/reduce types first)** → M5 sequence engine → remaining Diagnostic branches → Hindi → offline conversion uploads (FR-AD-03) → M12 audience sync → notification system (FR-DB-03).

Exit: first 20 Pending Actions processed with zero guardrail violations and zero unauthorized API writes (verified from audit + platform change history); operator NFR-11 onboarding test passed.

### Phase 3 — Weeks 9–12

M6 copilot → **M14 SEO engine (Search Console sync → briefs → drafts → approved publishing)** → M10 referrals → parent/DU track → multi-touch attribution view → Bottleneck Memo → clustering agent → FR-AD-07 campaign drafting → performance hardening.

Each phase closes with a KPI review; later scope re-cut based on the observed constraint.

---

## 19. KPIs

| KPI | Baseline | Target (90 days post-launch) |
|---|---|---|
| Diagnostic completion (started → results) | new | ≥ 55% |
| Diagnostic → contact capture | new | ≥ 45% of completions |
| Cost per MQL vs. current CPL × historical qual rate | measure week 1 | −30% |
| Counselling attendance rate | current | +20% relative |
| Counsellor time on disqualified profiles | estimate via survey | −50% |
| WhatsApp escalation precision | new | ≥ 70% |
| Claim-filter violations reaching a candidate | — | 0 |
| **Unauthorized spend-affecting API writes** | — | **0 (absolute)** |
| **Operator time in native ad platforms** | current (est.) | −80% (routine ops fully in-system) |
| **Pending Action median decision time** | — | < 12 h |
| **Executed-action 7-day outcome positive rate** (FR-PA-07) | — | ≥ 60% |
| **SEO: article → Diagnostic start rate** | new | establish baseline, then +25% qtr-over-qtr |
| Infra spend | — | ≤ €300/mo |

---

## 20. Risks and open questions

| ID | Item | Mitigation / decision needed |
|---|---|---|
| R-01 | Google Ads developer token approval takes 2–6 weeks | Apply week 1; Meta-first sequencing; read-only basic-access token sufficient initially |
| R-02 | Eligibility rules encode immigration-adjacent judgments | Rules reviewed by visa-casework owner; versioned rules engine as audit trail |
| R-03 | LLM cost blowout | FR-W-09 caps, FR-A-07 metering, haiku default |
| R-04 | Compliance reviewer bottleneck (now also covers ad copy + articles) | Queue latency tracked day 1; pre-approved asset families; second reviewer if median > 48 h |
| R-05 | Platform candidate-query pagination issue affects shared views | Coordinate with platform audit backlog before FR-L-05 |
| R-06 **[v2]** | Ad platform API changes/version deprecations break sync or executor | Pin API versions; sync-health alerts (NFR-03); executor fails closed (no call on any doubt) |
| R-07 **[v2]** | Operator approval fatigue → rubber-stamping | FR-PA-07 outcome digest keeps approvals consequential; daily action caps; batch cards (FR-PA-06); monitor approval-without-view time |
| R-08 **[v2]** | Meta/Google account suspension risk (recruitment/immigration ad categories face heightened review) | Human-reviewed ad copy only (G-2); no prohibited claims; special-ad-category settings verified per campaign; alert on any disapproval |
| OQ-01 | Email provider | Week 1 deliverability test |
| OQ-02 | FSJ pathway branch in v1? | Owner decision before Phase 2 |
| OQ-03 | Parent second-contact consent — contacting a non-data-subject | Legal review before FR-N-06 |
| OQ-04 **[v2]** | Keyword-volume provider (~€50/mo, outside envelope)? | Defer to Phase 3 review; Search Console mining first |
| OQ-05 **[v2]** | Which CMS does the current site run? (Determines FR-SEO-05 integration) | Confirm before Phase 3 |
| OQ-06 **[v2]** | Account-wide daily spend ceilings per platform (guardrail seed values) | MD sets before Phase 2 executor go-live |

---

## 21. Traceability

Qualified-outcome optimization → FR-AD-02/FR-AD-03; approval-based spend control → Section 12 + C-05 + G-1; single-system operation for a non-technical operator → M15 + C-08 + NFR-09/10/11; trust through honesty → FR-D-05/09, FR-G-03, NFR-10; no fabricated claims → G-2, FR-W-10, FR-P-01 (extended to ad copy and SEO articles); no artificial scarcity → FR-N-05; decision-unit selling → FR-N-06/FR-D-12; objections as intelligence → M7 → nurture + ads angles + SEO briefs; capacity-aware marketing → M9 → FR-AD-05(c); disqualification protects counsellors → FR-S-04; SEO as a lead system, not a traffic system → FR-SEO-02/07.

Still deliberately out: autonomous bidding, webinar platform automation, cross-company CEO intelligence layer, additional ad platforms — each requires its own addendum with its own gates.

---

*End of document. WFE-SRD-DGS-002 v2.0 — 09 Aug 2026.*
