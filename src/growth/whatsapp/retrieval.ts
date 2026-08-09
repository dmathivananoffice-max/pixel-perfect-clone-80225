import { resolveApprovedAsset } from "../assets/resolve";
import type { AssetRecord } from "../assets/types";
import { DEFAULT_FAQ_THRESHOLD } from "./constants";
import { cosineSimilarity, embedText } from "./embed";
import type { FaqAsset } from "./types";

export type FaqMatch = {
  asset: FaqAsset;
  score: number;
  answer_text: string;
};

function toFaqAsset(a: AssetRecord): FaqAsset {
  return {
    id: a.id,
    status: a.status,
    type: a.type,
    title: a.title,
    version: a.version,
    question_patterns: a.question_patterns ?? [],
    answer_text: a.answer_text ?? "",
    body_ref: a.body_ref,
  };
}

/**
 * Retrieve from APPROVED FAQ assets only (G-2 / FR-W-03).
 * Unapproved assets are never returned; resolveApprovedAsset enforces send path.
 */
export function matchFaq(
  message: string,
  candidates: AssetRecord[],
  threshold = DEFAULT_FAQ_THRESHOLD,
): FaqMatch | null {
  const approved = candidates.filter(
    (a) => a.type === "FAQ_ANSWER" && a.status === "APPROVED",
  );
  if (approved.length === 0) return null;

  const q = embedText(message);
  let best: { asset: AssetRecord; score: number } | null = null;

  for (const asset of approved) {
    const patterns = asset.question_patterns?.length
      ? asset.question_patterns
      : [asset.title];
    let score = 0;
    for (const p of patterns) {
      score = Math.max(score, cosineSimilarity(q, embedText(p)));
    }
    // Also compare against answer keywords lightly
    if (asset.answer_text) {
      score = Math.max(score, cosineSimilarity(q, embedText(asset.answer_text)) * 0.85);
    }
    if (!best || score > best.score) best = { asset, score };
  }

  if (!best || best.score < threshold) return null;

  // Hard gate: must resolve as APPROVED before send
  const resolved = resolveApprovedAsset(best.asset);
  return {
    asset: toFaqAsset(best.asset),
    score: best.score,
    answer_text: resolved.answer_text ?? best.asset.answer_text ?? "",
  };
}

/** Send-path helper: resolve proof/FAQ asset by id — throws if not APPROVED. */
export async function resolveApprovedForSend(
  assetId: string,
  load: (id: string) => Promise<AssetRecord | null>,
) {
  const asset = await load(assetId);
  return resolveApprovedAsset(asset);
}
