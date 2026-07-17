# Verification Studio V2 — Continuous Workflow

All 10 items from your feedback plus the sticky action bar. Single file: `src/pages/CandidateIntake.tsx` (plus small tweaks to `VerificationQueue.tsx`).

## 1. Layout rebalance (Form 56% / Doc 44%)
Widen the document panel by ~8–10%. New widths: form pane `flex-1`, doc pane `w-[44%] md:w-[43%] lg:w-[42%] xl:w-[42%]` (min-width guarded so it never squeezes below ~360px). Doc panel is the evidence — always readable without zoom at ≥1024px.

## 2. Persistent Verification Queue
Queue is already rendered — verify it stays visible in `section`, `review`, AND all overlay states (never unmounted). Add columns already surfaced (status dot, product tag, current section, %). Ensure it does not close on mobile mid-verify. Confirm the queue is inside the studio flex row, not a modal.

## 3. Success overlays — never force back
Replace immediate stage transitions with a centered success card overlay (blur backdrop, queue still visible behind). Three trigger points:

- **Missing document resolved** (after uploading a passport/medical/etc from within a section):
  - `✓ [Doc] Uploaded Successfully`
  - Primary: **Continue Verification** → resumes at the exact section it came from
  - Secondary: **Return to Mission Control**
- **Candidate approved** (after Approve on review step):
  - `✓ [Name] Approved`
  - Primary: **Verify Next Candidate** → loads next unapproved candidate at their first unverified section, form already AI pre-filled
  - Secondary: **Return to Mission Control**
- **Batch complete** (last candidate approved):
  - `✓ All [N] candidates verified`
  - Primary: **Return to Mission Control**

No auto-advance. Recruiter clicks to move on.

## 4. Preserve verification context
When a section triggers "upload missing doc", store `{ candidateId, sectionId }` before switching to the upload sub-flow. On success overlay → Continue: restore that exact section, scroll form to the field that flagged it. Never restart from section 1.

## 5. Two progress indicators in the header
- **Candidate** `3 of 42` (position in queue of non-approved candidates)
- **Section** `Passport · 3 of 12`

Both live in the sticky top bar of the studio.

## 6. Sticky bottom action bar (always visible)
New component at bottom of the form pane, `sticky bottom-0`, backdrop blur, single row that adapts to state:

```
[← Previous]  [Save Draft]  [Verify & Continue →]         [Approve Candidate]
```

On review step: `Approve Candidate` becomes primary. On overlay states, the bar is replaced by the two overlay buttons. `Return to Mission Control` moves to the header (persistent, no confirm dialog — drafts autosave).

## 7. Queue intelligence
Real-time state map: `approved` (green ✓, row collapses to one line), `verifying` (blue ring, current), `waiting` (dim), `missing_docs` (red), `manual_review` (orange). After approval → candidate row collapses in place, next candidate gets the blue "next up" highlight but does NOT open until the recruiter clicks Verify Next.

## 8. Persistent Mission Control button
Header keeps `← Mission Control` at all times (already there — verify it's shown during overlays and doesn't confirm).

## 9. Verify Next flow
`verifyNextCandidate()`: from `approvedIds` + queue order, pick first non-approved candidate, restore their snapshot (or seed if none), jump to first non-verified section, close overlay. If none remain → batch-complete overlay.

## Technical section

Changes are all in `src/pages/CandidateIntake.tsx`:

- **New state**: `overlay: null | { kind: 'doc_uploaded' | 'candidate_approved' | 'batch_done'; label: string; resumeSection?: SectionId }`, `resumeContext: { candidateId, sectionId } | null`.
- **New helpers**: `openApprovalOverlay()`, `verifyNextCandidate()`, `resumeAfterUpload()`, `getNextCandidateId()`.
- **Refactor**: split studio JSX so the queue + header + sticky action bar remain mounted while an overlay is shown (overlay is an absolute-positioned card, not a stage replacement).
- **Layout**: adjust the two flex panels' widths only; no structural change to `SectionForm` / `DocumentViewer`.
- **VerificationQueue.tsx**: add a `currentlyVerifyingId` visual state (blue ring) distinct from `activeCandidateId`, and collapse approved rows to a compact single line.

No new routes, no backend changes, no schema. Pure UI + local state.

## Out of scope (this pass)
- Real AI pre-fill for candidate N (mock data is reused; the "already pre-filled" claim holds because seeds are per-section).
- Persisting snapshots across page reloads (in-memory only, matches current behavior).
- Animating queue row collapse (simple conditional render for now).

Reply **go** to build, or tell me which items to drop/reorder.
