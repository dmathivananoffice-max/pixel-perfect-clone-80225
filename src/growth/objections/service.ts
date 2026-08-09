import { TAXONOMY_CODES } from "./taxonomy";
import type { ObjectionStore } from "./store";
import type {
  LogObjectionInput,
  ObjectionRecord,
  TaxonomyMapping,
  TrendRow,
} from "./types";

export class ObjectionService {
  constructor(private store: ObjectionStore) {}

  async log(input: LogObjectionInput): Promise<ObjectionRecord> {
    if (!input.logged_by?.trim()) throw new Error("logged_by required");
    if (!input.taxonomy_code?.trim()) throw new Error("taxonomy_code required");
    const code = input.taxonomy_code.trim();
    if (!(TAXONOMY_CODES as string[]).includes(code) && code !== "UNCLASSIFIED") {
      // allow unknown for webinar imports but prefer taxonomy
    }
    return this.store.log({
      ...input,
      verbatim: input.verbatim?.trim() || `(${code})`,
      taxonomy_code: code,
    });
  }

  listRecent(limit = 20) {
    return this.store.listRecent(limit);
  }

  listMappings() {
    return this.store.listMappings();
  }

  upsertMapping(
    mapping: Partial<TaxonomyMapping> & { code: string; updated_by: string },
  ) {
    if (!mapping.code) throw new Error("code required");
    if (!mapping.updated_by) throw new Error("updated_by required");
    return this.store.upsertMapping(mapping);
  }

  trends(weeks = 8, pathway?: string | null): Promise<TrendRow[]> {
    return this.store.trends(weeks, pathway);
  }
}
