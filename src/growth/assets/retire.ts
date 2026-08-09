import { AssetRetireBlockedError, type AssetRecord } from "./types";

/**
 * FR-P-04: retiring an asset referenced by an active sequence fails loudly.
 */
export function assertCanRetireAsset(
  asset: AssetRecord,
  activeSequenceIds: string[],
): void {
  if (asset.status === "RETIRED") {
    throw new Error(`asset ${asset.id} is already RETIRED`);
  }
  if (activeSequenceIds.length > 0) {
    throw new AssetRetireBlockedError(asset.id, activeSequenceIds);
  }
}
