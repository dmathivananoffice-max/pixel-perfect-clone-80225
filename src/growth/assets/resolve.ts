import {
  AssetNotApprovedError,
  type AssetRecord,
  type ResolvedAsset,
} from "./types";

/**
 * G-2 / FR-P send-path resolution: ONLY status = APPROVED may resolve.
 * Anything else throws AssetNotApprovedError.
 */
export function resolveApprovedAsset(asset: AssetRecord | null | undefined): ResolvedAsset {
  if (!asset) {
    throw new AssetNotApprovedError("unknown", "MISSING");
  }
  if (asset.status !== "APPROVED") {
    throw new AssetNotApprovedError(asset.id, asset.status);
  }
  return {
    id: asset.id,
    type: asset.type,
    title: asset.title,
    version: asset.version,
    status: "APPROVED",
    body_ref: asset.body_ref,
    body: asset.body,
    question_patterns: asset.question_patterns ?? [],
    answer_text: asset.answer_text,
    version_hash: asset.version_hash,
  };
}

/** Resolve by id via a lookup function — hard gate for WhatsApp/nurture send paths. */
export async function resolveApprovedAssetById(
  assetId: string,
  load: (id: string) => Promise<AssetRecord | null>,
): Promise<ResolvedAsset> {
  const asset = await load(assetId);
  return resolveApprovedAsset(asset);
}
