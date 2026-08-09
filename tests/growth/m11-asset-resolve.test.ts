import { describe, expect, test } from "bun:test";
import { emptyClaimChecklist } from "../../src/growth/assets/claims";
import { createMemoryAssetStore } from "../../src/growth/assets/memoryStore";
import { resolveApprovedAsset } from "../../src/growth/assets/resolve";
import { AssetService } from "../../src/growth/assets/service";
import {
  AssetNotApprovedError,
  AssetRetireBlockedError,
} from "../../src/growth/assets/types";

function checklistAllAbsent() {
  return emptyClaimChecklist();
}

describe("M11 APPROVED-only send resolution (G-2)", () => {
  test("resolve throws for DRAFT / IN_REVIEW / REJECTED / RETIRED", async () => {
    const store = createMemoryAssetStore();
    const svc = new AssetService(store);
    const draft = await svc.createDraft({
      type: "FAQ_ANSWER",
      title: "Visa timeline FAQ",
      question_patterns: ["how long visa", "visa timeline"],
      answer_text: "Timelines vary; we do not guarantee visa approval.",
      claim_bearing: true,
    });

    await expect(svc.resolveForSend(draft.id)).rejects.toBeInstanceOf(
      AssetNotApprovedError,
    );

    const submitted = await svc.submitForReview({
      asset_id: draft.id,
      submitted_by: crypto.randomUUID(),
      claim_checklist: {
        ...checklistAllAbsent(),
        timeline: {
          status: "present_justified",
          note: "States timelines vary; no guarantee.",
        },
        visa: {
          status: "present_justified",
          note: "Explicitly no guarantee of visa approval.",
        },
      },
    });
    expect(submitted.status).toBe("IN_REVIEW");
    await expect(svc.resolveForSend(submitted.id)).rejects.toThrow(/APPROVED required/);

    const rejected = await svc.review({
      asset_id: submitted.id,
      reviewer_id: crypto.randomUUID(),
      decision: "reject",
      comment: "Need clearer disclaimer",
    });
    expect(rejected.status).toBe("REJECTED");
    expect(() => resolveApprovedAsset(rejected)).toThrow(AssetNotApprovedError);
  });

  test("approved asset resolves; unapproved cannot", async () => {
    const store = createMemoryAssetStore();
    const svc = new AssetService(store);
    const draft = await svc.createDraft({
      type: "FAQ_ANSWER",
      title: "Recognition overview",
      question_patterns: ["what is recognition", "anerkennung"],
      answer_text: "Recognition is assessed case-by-case; outcomes are not guaranteed.",
    });
    await svc.submitForReview({
      asset_id: draft.id,
      submitted_by: crypto.randomUUID(),
      claim_checklist: {
        ...checklistAllAbsent(),
        recognition: {
          status: "present_justified",
          note: "No guaranteed recognition outcome.",
        },
      },
    });
    const approved = await svc.review({
      asset_id: draft.id,
      reviewer_id: crypto.randomUUID(),
      decision: "approve",
      comment: "Checklist complete",
    });
    expect(approved.status).toBe("APPROVED");

    const resolved = await svc.resolveForSend(approved.id);
    expect(resolved.status).toBe("APPROVED");
    expect(resolved.answer_text).toMatch(/not guaranteed/i);

    // Second unapproved asset still throws
    const other = await svc.createDraft({
      type: "NURTURE_MESSAGE",
      title: "Unchecked nurture",
      body: { text: "Hello" },
      claim_bearing: false,
    });
    await expect(svc.resolveForSend(other.id)).rejects.toBeInstanceOf(
      AssetNotApprovedError,
    );
  });
});

describe("M11 retire blocked by active sequence (FR-P-04)", () => {
  test("retire fails loudly when sequence references asset", async () => {
    const store = createMemoryAssetStore();
    const svc = new AssetService(store);
    const draft = await svc.createDraft({
      type: "NURTURE_MESSAGE",
      title: "Active sequence message",
      body: { text: "Follow-up" },
    });
    await svc.submitForReview({
      asset_id: draft.id,
      submitted_by: crypto.randomUUID(),
      claim_checklist: checklistAllAbsent(),
    });
    const approved = await svc.review({
      asset_id: draft.id,
      reviewer_id: crypto.randomUUID(),
      decision: "approve",
    });

    store.sequenceRefs.set(approved.id, ["seq-active-1"]);
    await expect(svc.retire(approved.id)).rejects.toBeInstanceOf(
      AssetRetireBlockedError,
    );

    store.sequenceRefs.set(approved.id, []);
    const retired = await svc.retire(approved.id);
    expect(retired.status).toBe("RETIRED");
    await expect(svc.resolveForSend(retired.id)).rejects.toThrow(/APPROVED required/);
  });
});
