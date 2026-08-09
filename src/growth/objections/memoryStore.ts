import { defaultMappings } from "./taxonomy";
import type { ObjectionStore } from "./store";
import type {
  LogObjectionInput,
  ObjectionRecord,
  TaxonomyMapping,
  TrendRow,
} from "./types";

function weekStart(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday-based
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function createMemoryObjectionStore(): ObjectionStore & {
  rows: ObjectionRecord[];
  mappings: Map<string, TaxonomyMapping>;
} {
  const rows: ObjectionRecord[] = [];
  const mappings = new Map(
    defaultMappings().map((m) => [m.code, m] as const),
  );
  // seed talk tracks for demo
  for (const [code, m] of mappings) {
    mappings.set(code, {
      ...m,
      underlying_fear: m.underlying_fear || `Fear behind ${m.label}`,
      evidence_type: m.evidence_type || "approved_faq",
      talk_track: m.talk_track || `Talk track for ${m.label}`,
    });
  }

  return {
    rows,
    mappings,
    async log(input: LogObjectionInput) {
      const row: ObjectionRecord = {
        id: crypto.randomUUID(),
        lead_id: input.lead_id ?? null,
        source: input.source,
        verbatim: input.verbatim?.trim() || `(${input.taxonomy_code})`,
        taxonomy_code: input.taxonomy_code,
        logged_by: input.logged_by,
        pathway: input.pathway ?? null,
        session_id: input.session_id ?? null,
        meta: input.meta ?? {},
        at: new Date().toISOString(),
      };
      rows.push(row);
      return structuredClone(row);
    },
    async listRecent(limit = 20) {
      return [...rows]
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, limit)
        .map((r) => structuredClone(r));
    },
    async listMappings() {
      return [...mappings.values()].map((m) => structuredClone(m));
    },
    async upsertMapping(patch) {
      const cur = mappings.get(patch.code) ?? {
        code: patch.code,
        label: patch.code,
        underlying_fear: "",
        evidence_type: "",
        approved_asset_refs: [],
        talk_track: "",
        active: true,
        updated_by: patch.updated_by,
        updated_at: new Date().toISOString(),
      };
      const next: TaxonomyMapping = {
        ...cur,
        ...patch,
        approved_asset_refs:
          patch.approved_asset_refs ?? cur.approved_asset_refs,
        updated_at: new Date().toISOString(),
      };
      mappings.set(next.code, next);
      return structuredClone(next);
    },
    async trends(weeks = 8, pathway?: string | null) {
      const cutoff = Date.now() - weeks * 7 * 86400000;
      const filtered = rows.filter((r) => {
        if (new Date(r.at).getTime() < cutoff) return false;
        if (pathway && r.pathway !== pathway) return false;
        return true;
      });
      const map = new Map<string, TrendRow>();
      for (const r of filtered) {
        const key = `${weekStart(r.at)}|${r.taxonomy_code ?? "UNCLASSIFIED"}|${r.pathway ?? "unknown"}`;
        const cur = map.get(key);
        if (cur) cur.objection_count += 1;
        else {
          map.set(key, {
            week_start: weekStart(r.at),
            taxonomy_code: r.taxonomy_code ?? "UNCLASSIFIED",
            pathway: r.pathway ?? "unknown",
            objection_count: 1,
          });
        }
      }
      return [...map.values()].sort((a, b) =>
        a.week_start.localeCompare(b.week_start),
      );
    },
  };
}
