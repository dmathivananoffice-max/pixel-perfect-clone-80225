/** M11 asset library + compliance (G-2). */

export type AssetStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "RETIRED";

export type AssetType =
  | "FAQ_ANSWER"
  | "WHATSAPP_TEMPLATE"
  | "NURTURE_MESSAGE"
  | "AD_COPY"
  | "SEO_ARTICLE"
  | "PROOF_ASSET"
  | "DQ_MESSAGE";

export type ClaimKey =
  | "visa"
  | "salary"
  | "timeline"
  | "cost"
  | "recognition"
  | "employment";

export const CLAIM_KEYS: ClaimKey[] = [
  "visa",
  "salary",
  "timeline",
  "cost",
  "recognition",
  "employment",
];

export type ClaimMark = {
  status: "absent" | "present_justified";
  note?: string;
};

export type ClaimChecklist = Record<ClaimKey, ClaimMark>;

export type AssetRecord = {
  id: string;
  type: AssetType | string;
  title: string;
  version: number;
  status: AssetStatus;
  claim_bearing: boolean;
  body_ref: string;
  body: Record<string, unknown>;
  claim_checklist: Partial<ClaimChecklist>;
  question_patterns: string[];
  answer_text: string | null;
  approved_by: string | null;
  approved_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  created_by: string | null;
  parent_asset_id: string | null;
  version_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type ResolvedAsset = {
  id: string;
  type: string;
  title: string;
  version: number;
  status: "APPROVED";
  body_ref: string;
  body: Record<string, unknown>;
  question_patterns: string[];
  answer_text: string | null;
  version_hash: string | null;
};

export class AssetNotApprovedError extends Error {
  readonly asset_id: string;
  readonly status: string;

  constructor(asset_id: string, status: string) {
    super(
      `G-2 send path refused: asset ${asset_id} status=${status} (APPROVED required)`,
    );
    this.name = "AssetNotApprovedError";
    this.asset_id = asset_id;
    this.status = status;
  }
}

export class AssetRetireBlockedError extends Error {
  readonly asset_id: string;
  readonly sequence_ids: string[];

  constructor(asset_id: string, sequence_ids: string[]) {
    super(
      `FR-P-04: cannot retire asset ${asset_id}; referenced by active sequence(s): ${sequence_ids.join(", ")}`,
    );
    this.name = "AssetRetireBlockedError";
    this.asset_id = asset_id;
    this.sequence_ids = sequence_ids;
  }
}
