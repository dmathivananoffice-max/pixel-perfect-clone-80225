/**
 * Create draft → approve → prove unapproved cannot resolve.
 * bun scripts/verify_m11_approve_resolve.ts
 */
import { emptyClaimChecklist } from "../src/growth/assets/claims";
import { createMemoryAssetStore } from "../src/growth/assets/memoryStore";
import { AssetService } from "../src/growth/assets/service";
import { AssetNotApprovedError } from "../src/growth/assets/types";

const store = createMemoryAssetStore();
const svc = new AssetService(store);

console.log("1) Create DRAFT FAQ asset");
const draft = await svc.createDraft({
  type: "FAQ_ANSWER",
  title: "FAQ — Salary expectations",
  question_patterns: ["what salary", "how much will i earn"],
  answer_text:
    "Salaries vary by employer and region. We do not promise a specific salary.",
  claim_bearing: true,
});
console.log("   status=", draft.status, "id=", draft.id);

console.log("2) Unapproved resolve must throw");
let threw = false;
try {
  await svc.resolveForSend(draft.id);
} catch (err) {
  threw = err instanceof AssetNotApprovedError;
  console.log("   threw AssetNotApprovedError:", threw, String(err));
}
if (!threw) {
  console.error("FAIL: expected throw for DRAFT");
  process.exit(1);
}

console.log("3) Submit → IN_REVIEW → Approve");
await svc.submitForReview({
  asset_id: draft.id,
  submitted_by: crypto.randomUUID(),
  claim_checklist: {
    ...emptyClaimChecklist(),
    salary: {
      status: "present_justified",
      note: "Explicitly no specific salary promise.",
    },
  },
});
const approved = await svc.review({
  asset_id: draft.id,
  reviewer_id: crypto.randomUUID(),
  decision: "approve",
  comment: "Claims justified",
});
console.log("   status=", approved.status);

console.log("4) APPROVED resolves for send path");
const resolved = await svc.resolveForSend(approved.id);
console.log("   resolved version", resolved.version, resolved.title);

console.log("5) Separate unapproved asset still blocked");
const other = await svc.createDraft({
  type: "WHATSAPP_TEMPLATE",
  title: "Unapproved template",
  body: { text: "Hi" },
});
try {
  await svc.resolveForSend(other.id);
  console.error("FAIL: unapproved resolved");
  process.exit(1);
} catch (err) {
  console.log("   blocked:", err instanceof AssetNotApprovedError);
}

console.log("\nOK: draft→approve works; unapproved send-path resolve throws");
