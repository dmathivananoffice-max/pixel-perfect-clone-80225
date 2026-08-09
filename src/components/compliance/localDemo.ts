import { emptyClaimChecklist } from "@/growth/assets/claims";
import { createMemoryAssetStore } from "@/growth/assets/memoryStore";
import { AssetService } from "@/growth/assets/service";
import type { AssetRecord, ClaimChecklist } from "@/growth/assets/types";

let demoSvc: AssetService | null = null;
let demoStore: ReturnType<typeof createMemoryAssetStore> | null = null;

export async function ensureLocalComplianceDemo(): Promise<AssetService> {
  if (demoSvc) return demoSvc;
  demoStore = createMemoryAssetStore();
  demoSvc = new AssetService(demoStore);

  const draft = await demoSvc.createDraft({
    type: "FAQ_ANSWER",
    title: "FAQ — Visa approval is never guaranteed",
    question_patterns: ["will i get a visa", "visa guaranteed"],
    answer_text:
      "No one can guarantee a visa outcome. We help you prepare a complete file; the decision rests with the authorities.",
    claim_bearing: true,
  });
  await demoSvc.submitForReview({
    asset_id: draft.id,
    submitted_by: "demo-submitter",
    claim_checklist: {
      ...emptyClaimChecklist(),
      visa: {
        status: "present_justified",
        note: "Explicit no-guarantee wording.",
      },
    },
  });
  return demoSvc;
}

export async function demoListInReview(): Promise<AssetRecord[]> {
  const svc = await ensureLocalComplianceDemo();
  return svc.listInReview();
}

export async function demoGet(assetId: string): Promise<{
  asset: AssetRecord;
  prior: AssetRecord | null;
}> {
  await ensureLocalComplianceDemo();
  const asset = await demoStore!.getById(assetId);
  if (!asset) throw new Error("not found");
  const prior = asset.parent_asset_id
    ? await demoStore!.getById(asset.parent_asset_id)
    : null;
  return { asset, prior };
}

export async function demoReview(input: {
  asset_id: string;
  actor_id: string;
  decision: "approve" | "reject";
  comment?: string;
  claim_checklist?: ClaimChecklist;
}) {
  const svc = await ensureLocalComplianceDemo();
  return svc.review({
    asset_id: input.asset_id,
    reviewer_id: input.actor_id,
    decision: input.decision,
    comment: input.comment,
    claim_checklist: input.claim_checklist,
  });
}

export function demoResolve(assetId: string) {
  if (!demoSvc) throw new Error("demo not ready");
  return demoSvc.resolveForSend(assetId);
}
