import type {
  LogObjectionInput,
  ObjectionRecord,
  TaxonomyMapping,
  TrendRow,
} from "./types";

export type ObjectionStore = {
  log(input: LogObjectionInput): Promise<ObjectionRecord>;
  listRecent(limit?: number): Promise<ObjectionRecord[]>;
  listMappings(): Promise<TaxonomyMapping[]>;
  upsertMapping(
    mapping: Partial<TaxonomyMapping> & { code: string; updated_by: string },
  ): Promise<TaxonomyMapping>;
  trends(weeks?: number, pathway?: string | null): Promise<TrendRow[]>;
};
