/** G-2 APPROVED-only resolve (edge copy). */
export function resolveApprovedAsset(asset: {
  id: string;
  status: string;
  type: string;
  title: string;
  version: number;
  body_ref: string;
  body?: Record<string, unknown>;
  question_patterns?: string[];
  answer_text?: string | null;
  version_hash?: string | null;
} | null) {
  if (!asset) throw new Error("G-2 send path refused: asset missing (APPROVED required)");
  if (asset.status !== "APPROVED") {
    throw new Error(
      `G-2 send path refused: asset ${asset.id} status=${asset.status} (APPROVED required)`,
    );
  }
  return asset;
}
