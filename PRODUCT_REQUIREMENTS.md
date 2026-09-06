# Workforce Europe — Product Requirements

> Product brief only: *what* the product does and *for whom*.  
> How it is built is out of scope.

---

## 1. What this product is

**Workforce Europe** helps recruit, verify, assess, and place international candidates into German career pathways — especially nursing, Ausbildung (vocational training), and study tracks (pre-bachelor, pre-masters, MBA).

The organisation runs **two connected products**:

1. **Recruitment Intelligence Platform** — the day-to-day tool for staff who intake candidates, check documents, score readiness, run assessments, prepare people for interviews, manage offers, track visas and flights, and support onboarding in Germany.
2. **Growth Operating System** — the marketing and sales engine that attracts and qualifies leads (ads, career diagnostic, WhatsApp conversations, counsellor tools, capacity control) and hands ready people into the recruitment platform.

They share one company identity: a lead who converts becomes a candidate. They do **not** share the same job. Growth never runs visa or document work; the recruitment platform never approves ad spend.

---

## 2. Who uses it

| Who | What they need |
|---|---|
| Managing director / administrator | Oversight, roles, dashboards, high-stakes approvals |
| Recruiter / documentation officer | Intake candidates, verify documents section by section, move people through the pipeline |
| German trainer | Language and skill assessments; interview preparation |
| Counsellor / sales | Qualify leads, book advising, hand off to intake |
| Marketing operator | See growth performance, approve recommended ad and content actions (never auto-spend) |
| Agency partner | Submit and track agency candidates |
| Magnet school | Run or join school-side interviews; see candidates assigned to their school track |
| German office (Verwaltung) | Run or join the Verwaltung interview; review candidates for administrative clearance |
| Employer | Run or join the employer interview; see matched candidates and hiring progress |
| Candidate | Understand eligibility, upload documents, track status, prepare for interviews, sign offer documents, follow visa / travel / onboarding steps |

---

## 3. Career pathways

Staff choose a pathway when intake starts:

| Pathway | Purpose |
|---|---|
| Professional Nurses | Approbation track, German language, hospital placement |
| Ausbildung | Vocational training placement in Germany |
| Pre-Bachelor | Studienkolleg / undergraduate preparation |
| Pre-Masters | Master’s intake preparation |
| MBA | Business school applications and offers |

The public career assessment also covers broader families (doctors, technicians/mechatronics, logistics, FSJ, bachelor, master) to recommend a path before someone becomes a candidate.

---

## 4. Recruitment platform — what it must do

### 4.1 End-to-end candidate journey

After intake and shortlisting, a candidate progresses through this placement journey:

1. **Assessment** — skills / language / suitability checks  
2. **Interview training** — prepare the candidate for formal interviews  
3. **Interview 1 — German Verwaltung** — administrative / office interview  
4. **Interview 2 — School** — magnet school (or pathway school) interview  
5. **Interview 3 — Employer** — employer interview  
6. **Offer documents** — issue, review, and collect signed offer paperwork  
7. **Visa** — visa application and tracking  
8. **Flight booking** — travel to Germany  
9. **Onboarding in Germany** — arrival and settling support  

They may also be **Rejected** or **Withdrawn** at appropriate points. Staff always see a clear, plain-language **placement readiness** status (for example Documents Missing, Interview Training, Awaiting Verwaltung, Offer Pending, Visa Processing, Travel Booked, Onboarding in Germany).

Each interview stage has a clear **owner** (Verwaltung, school, or employer) so the right party knows when it is their turn and what they must decide.

### 4.2 Intake and document verification

Staff can:

1. Start a **single** or **bulk** intake for one pathway.
2. Upload the candidate’s documents (passport, photo, degree, language certificate, CV, police clearance, medical fitness, driving licence, and related proofs).
3. Let the system **read documents and suggest values** (names, dates, passport numbers, language level, education, and so on).
4. Review every section in a **verification studio**, fix mistakes, mark sections verified, and save drafts safely.
5. Approve a candidate only when required sections are verified and staff confirm the review declarations.

The system must never invent facts that were not on the documents. Unclear values must be obvious so a human can correct them. One candidate’s documents must never appear on another candidate’s record. When documents are read again later, **staff corrections must be kept**.

### 4.3 Information the platform captures

Typical sections staff verify:

- Personal identity (name, date of birth, gender, nationality)
- Passport
- Contact details
- Education
- German language certificate (provider, level, dates)
- Employment history
- Internship / social service (when relevant)
- Medical fitness
- Driving licence
- Document completeness checklist

Approving intake means the candidate is ready for shortlisting and the journey above — not that a visa, school place, or job is guaranteed.

### 4.4 Scoring and placement readiness

Staff configure **gates and weighted criteria** (for example passport present, German B2, required education). The platform shows who is placement-ready versus blocked by missing documents or unmet gates.

### 4.5 Assessments and interview training

- Trainers and recruiters record assessment results (speaking, training, suitability).
- **Interview training** prepares the candidate before Verwaltung, school, and employer interviews.
- Assessment and training outcomes feed readiness views and whether the candidate may advance to the next interview.

### 4.6 Interviews, offers, travel, and onboarding

The platform must support:

| Stage | Product outcome |
|---|---|
| Interview 1 — German Verwaltung | Schedule, conduct or record outcome with the German office; clear pass / fail / defer |
| Interview 2 — School | Same for the magnet school (or pathway school) |
| Interview 3 — Employer | Same for the employer |
| Offer documents | Generate / share offer paperwork; candidate (and partners as needed) review and sign |
| Visa | Track visa status and required follow-ups |
| Flight booking | Record travel arrangements to Germany |
| Onboarding in Germany | Track arrival and early settling steps so staff and partners see the candidate is landed and supported |

Verwaltung, school, and employer each see **only their interview and the candidate information they need** — not the full internal console.

### 4.7 Contracts and portals

- Candidates can review and **sign offer / contract documents**.
- **Agency**, **magnet school**, **German Verwaltung**, **employer**, and **candidate** portals show only what each party needs.
- Staff can send emails and run basic reports across the journey.

### 4.8 Trust and safety

- Important actions leave an audit trail.
- Inactive people cannot use the system.
- Outbound messages must never promise visa approval, employment, school admission, recognition success, or a specific salary.

---

## 5. Growth Operating System — what it must do

### 5.1 Purpose

Run Workforce Europe’s online growth from **one operator surface**: watch paid and organic channels, attract candidates via a Pathway Diagnostic, score and qualify leads (including WhatsApp), support counsellors, protect intake capacity, and measure cost per *qualified* candidate — not vanity leads.

### 5.2 Operating principle

The system **watches and recommends**. A human **approves** before anything spends money, publishes content, or changes paid campaigns. There is no auto-spend mode.

### 5.3 Main capabilities

| Area | Product outcome |
|---|---|
| Pathway Diagnostic | Short, mobile-friendly career assessment; shows honest eligibility (Ready / Preparable / Not Yet) *before* asking for contact |
| Lead capture | Consent-aware contact capture; no false encouragement; “Not Yet” still gets a preparation path |
| Scoring & routing | Hot / Warm / Nurture / Disqualified bands with clear reasons; protect counsellor time |
| WhatsApp conversations | Delivers results, asks qualification questions from an approved playbook, hands off to humans when unsure; discloses it is automated |
| Counsellor tools | Briefings, objection library, logging of real objections as data |
| Capacity control | Never generate more demand than confirmed intake capacity |
| Ads & SEO | Continuous monitoring; changes only via human-approved recommendations |
| Operator dashboard | One inbox of pending actions with evidence, cost, and risk in plain language |

### 5.4 Growth product rules

- Prefer honesty over hype; scarcity only when real.
- Candidate-facing languages at launch: English and Hindi.
- Usable on modest phones and slow mobile networks.
- Clear consent and the right to be forgotten for marketing data.
- Converted leads become recruitment candidates without duplicate or conflicting identities.

---

## 6. Success looks like

**Recruitment platform**

- Staff can intake and verify a candidate without losing unfinished work.
- Document mistakes are caught by humans before shortlisting.
- Assessment → interview training → Verwaltung / school / employer interviews → offer → visa → flight → German onboarding is understandable at a glance.
- Magnet school, German Verwaltung, employers, agencies, and candidates each see only their part of the journey.

**Growth**

- Cost per qualified candidate falls.
- Counselling attendance and counselling → application conversion rise.
- Unsuitable leads are filtered before they consume counsellor time.
- Demand never exceeds capacity.
- A non-technical operator can approve day-to-day growth actions from one place (including on a phone).

---

## 7. Out of scope for now

- Fully autonomous ad spending or pipeline decisions without a human
- Payment processing inside these products
- Promising visas, jobs, school places, or salaries in any candidate-facing copy
- Treating Growth and Recruitment as one undifferentiated product (they connect; they are not the same job)

---

## 8. One-line brief

A **candidate verification and placement platform** for Germany-bound pathways — from assessment and multi-party interviews through offer, visa, travel, and onboarding — fed by a separate **honest, human-approved growth engine** that qualifies demand and never oversells outcomes.
