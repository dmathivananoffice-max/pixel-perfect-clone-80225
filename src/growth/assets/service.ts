import { emptyClaimChecklist, validateClaimChecklist } from "./claims";
import { assertCanRetireAsset } from "./retire";
import { resolveApprovedAsset } from "./resolve";
import type {
  AssetRecord,
  AssetStatus,
  AssetType,
  ClaimChecklist,
  ResolvedAsset,
} from "./types";

export type AssetStore = {
  getById(id: string): Promise<AssetRecord | null>;
  listByStatus(status: AssetStatus): Promise<AssetRecord[]>;
  insert(asset: Omit<AssetRecord, "id" | "created_at" | "updated_at"> & {
    id?: string;
  }): Promise<AssetRecord>;
  update(id: string, patch: Partial<AssetRecord>): Promise<AssetRecord>;
  activeSequenceRefs(assetId: string): Promise<string[]>;
};

function hashVersion(input: string): string {
  // Lightweight stable hash for version stamping (not crypto-grade).
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return `vh_${(h >>> 0).toString(16)}`;
}

export class AssetService {
  constructor(private store: AssetStore) {}

  async createDraft(input: {
    type: AssetType | string;
    title: string;
    body_ref?: string;
    body?: Record<string, unknown>;
    claim_bearing?: boolean;
    question_patterns?: string[];
    answer_text?: string;
    created_by?: string;
    parent_asset_id?: string | null;
    version?: number;
  }): Promise<AssetRecord> {
    const body = { ...(input.body ?? {}) };
    if (input.type === "FAQ_ANSWER") {
      body.question_patterns = input.question_patterns ?? [];
      body.answer_text = input.answer_text ?? "";
    }
    const payload = JSON.stringify({
      title: input.title,
      body,
      patterns: input.question_patterns ?? [],
      answer: input.answer_text ?? "",
    });
    return this.store.insert({
      type: input.type,
      title: input.title,
      version: input.version ?? 1,
      status: "DRAFT",
      claim_bearing: input.claim_bearing ?? true,
      body_ref: input.body_ref ?? `asset:${input.type.toLowerCase()}`,
      body,
      claim_checklist: emptyClaimChecklist(),
      question_patterns: input.question_patterns ?? [],
      answer_text: input.answer_text ?? null,
      approved_by: null,
      approved_at: null,
      reviewed_by: null,
      reviewed_at: null,
      review_comment: null,
      submitted_by: null,
      submitted_at: null,
      created_by: input.created_by ?? null,
      parent_asset_id: input.parent_asset_id ?? null,
      version_hash: hashVersion(payload),
    });
  }

  async submitForReview(input: {
    asset_id: string;
    submitted_by: string;
    claim_checklist: unknown;
  }): Promise<AssetRecord> {
    const asset = await this.store.getById(input.asset_id);
    if (!asset) throw new Error("asset not found");
    if (asset.status !== "DRAFT" && asset.status !== "REJECTED") {
      throw new Error(`cannot submit asset in status ${asset.status}`);
    }
    const checklist = validateClaimChecklist(input.claim_checklist);
    if (!checklist.ok) throw new Error(checklist.error);

    return this.store.update(asset.id, {
      status: "IN_REVIEW",
      claim_checklist: checklist.checklist,
      submitted_by: input.submitted_by,
      submitted_at: new Date().toISOString(),
      review_comment: null,
    });
  }

  async review(input: {
    asset_id: string;
    reviewer_id: string;
    decision: "approve" | "reject";
    comment?: string;
    claim_checklist?: unknown;
  }): Promise<AssetRecord> {
    const asset = await this.store.getById(input.asset_id);
    if (!asset) throw new Error("asset not found");
    if (asset.status !== "IN_REVIEW") {
      throw new Error(`cannot review asset in status ${asset.status}`);
    }

    let checklist: ClaimChecklist | Partial<ClaimChecklist> =
      asset.claim_checklist;
    if (input.claim_checklist) {
      const v = validateClaimChecklist(input.claim_checklist);
      if (!v.ok) throw new Error(v.error);
      checklist = v.checklist;
    }

    if (input.decision === "reject") {
      if (!input.comment?.trim()) {
        throw new Error("reject requires a comment");
      }
      return this.store.update(asset.id, {
        status: "REJECTED",
        claim_checklist: checklist,
        reviewed_by: input.reviewer_id,
        reviewed_at: new Date().toISOString(),
        review_comment: input.comment.trim(),
      });
    }

    const now = new Date().toISOString();
    return this.store.update(asset.id, {
      status: "APPROVED",
      claim_checklist: checklist,
      reviewed_by: input.reviewer_id,
      reviewed_at: now,
      approved_by: input.reviewer_id,
      approved_at: now,
      review_comment: input.comment?.trim() || null,
    });
  }

  async retire(asset_id: string): Promise<AssetRecord> {
    const asset = await this.store.getById(asset_id);
    if (!asset) throw new Error("asset not found");
    const refs = await this.store.activeSequenceRefs(asset_id);
    assertCanRetireAsset(asset, refs);
    return this.store.update(asset_id, {
      status: "RETIRED",
      updated_at: new Date().toISOString(),
    } as Partial<AssetRecord>);
  }

  /** Send-path entry — throws unless APPROVED. */
  async resolveForSend(asset_id: string): Promise<ResolvedAsset> {
    const asset = await this.store.getById(asset_id);
    return resolveApprovedAsset(asset);
  }

  listInReview(): Promise<AssetRecord[]> {
    return this.store.listByStatus("IN_REVIEW");
  }
}
