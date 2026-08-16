# KNOWN ISSUES — Workforce Europe

Honest list of what remains. Nothing here is hidden; everything has a plan.

## Fixed in flight (2026-08-16) — intake draft hang

**Symptom:** Step 4 stuck on **Building candidate drafts ~40%** / overall **90%**
with status **Finalising candidate draft…** for several minutes.

**Root cause:** After long OCR, supabase-js can park forever in silent token
refresh on the next DB write. The progress UI caps at 90% until persistence
resolves, so the screen looks frozen. `onError` was also unwired.

**Fix (branch `cursor/fix-intake-draft-hang-4bf8`):**
- Refresh session before draft DB writes
- 45s hard budget for the whole draft phase + 15s per DB call
- Timeout-bound pipeline extraction persistence
- 90s drafts-stuck force-complete + wired `onError`
- Duplicate in-flight persist guard

## Must do at deployment (see DEPLOYMENT_GUIDE)

1. **Apply both new migrations** — `email_logs` table + mock-seed cleanup, and the
   `candidate-documents` storage bucket. Without them: Email Center history 404s and
   uploads fail with "Bucket not found".
2. **Set `MISTRAL_API_KEY`** in Lovable Cloud env — default OCR/vision backend
   (`mistral-medium-latest`). `TOGETHER_API_KEY` is only a fallback.
3. **RLS dev posture** — anon key can read/write everything (SECURITY_REPORT §S1).
   Run the hardening script before any public URL.

## Known limitations (by design, documented)

| # | Item | State | Plan |
|---|---|---|---|
| K1 | Email delivery | Compose + history persist (`email_logs`, status `pending`) — nothing is sent yet | Wire Supabase Edge Function + Resend/SMTP; flip pending→sent (½ day) |
| K2 | Visa tracking | No `visa_statuses` table; visa tab shows lifecycle stage honestly | Add table + stepper (1 day) |
| K3 | Role definitions editor | Permission matrix edits are session-local templates; enforcement uses `app_users.role_key` | Persist role matrix to DB (1 day) |
| K4 | Per-criterion scoring | `candidate_scores` written only when the scoring engine runs; otherwise the tab shows an honest empty state | Wire selection engine to write scores on assessment completion (½ day) |
| K5 | Double router | TanStack Start shell hosts legacy react-router app — stable but debt | Migrate routes to TanStack Router (2–3 days) |
| K6 | `document_extractions` unique key | Extractions re-inserted per re-run of a document (pipeline upserts by candidate+section+field in practice) | Add unique constraint if duplicates observed |
| K7 | DB types not regenerated | `email_logs` + `candidate_scores` queried via `(supabase.from as any)` escape hatch (established pattern in repo) | Run `supabase gen types` after migrations (15 min) |
| K8 | Employer portal identity | Employer portal lists all interview-stage candidates (no employer-login linkage yet) | Match by `employers.contact_email` when employer accounts are provisioned |

## Not executed in this environment (requires production access)

- Magic-link round-trip (needs a real mailbox).
- Live OCR run (needs `MISTRAL_API_KEY` + sample document).
- Real-world ZIP upload with nested folders.

All three have explicit, loud failure paths — no silent fallbacks.

## DOCX / TXT / RTF are stored but not OCR'd (known limitation)

The vision OCR rasterizer (`src/lib/docintel/rasterize.ts`) renders PDFs and
images only. Word/text documents upload successfully, appear in the candidate's
document list, and are previewable/downloadable — but their OCR is marked
`ocr_status=failed` ("Unsupported file type for rasterization") in isolation,
without affecting the candidate's other documents. If text extraction for DOCX
is needed later, add a `mammoth`-based text path feeding the extraction step
directly (no rasterization). Until then, ask agencies to send PDFs where possible.
