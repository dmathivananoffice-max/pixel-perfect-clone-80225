import type { AssetStore } from "./service";
import type { AssetRecord, AssetStatus } from "./types";

export function createMemoryAssetStore(): AssetStore & {
  assets: Map<string, AssetRecord>;
  sequenceRefs: Map<string, string[]>;
} {
  const assets = new Map<string, AssetRecord>();
  const sequenceRefs = new Map<string, string[]>();

  return {
    assets,
    sequenceRefs,
    async getById(id) {
      return assets.get(id) ? structuredClone(assets.get(id)!) : null;
    },
    async listByStatus(status: AssetStatus) {
      return [...assets.values()]
        .filter((a) => a.status === status)
        .map((a) => structuredClone(a));
    },
    async insert(asset) {
      const now = new Date().toISOString();
      const row: AssetRecord = {
        ...(asset as AssetRecord),
        id: asset.id ?? crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      };
      assets.set(row.id, row);
      return structuredClone(row);
    },
    async update(id, patch) {
      const cur = assets.get(id);
      if (!cur) throw new Error("asset not found");
      const next = {
        ...cur,
        ...patch,
        updated_at: new Date().toISOString(),
      };
      assets.set(id, next);
      return structuredClone(next);
    },
    async activeSequenceRefs(assetId) {
      return sequenceRefs.get(assetId) ?? [];
    },
  };
}
