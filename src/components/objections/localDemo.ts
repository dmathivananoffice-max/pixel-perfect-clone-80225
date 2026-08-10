import { ObjectionService } from "@/growth/objections/service";
import { createMemoryObjectionStore } from "@/growth/objections/memoryStore";
import { answerExitSurvey } from "@/growth/objections/exitSurvey";
import type {
  LogObjectionInput,
  ObjectionRecord,
  TaxonomyMapping,
  TrendRow,
} from "@/growth/objections/types";

let store: ReturnType<typeof createMemoryObjectionStore> | null = null;
let svc: ObjectionService | null = null;

function ensure() {
  if (!store) {
    store = createMemoryObjectionStore();
    svc = new ObjectionService(store);
    // seed a couple historical rows so trends aren't empty
    const weekAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    store.rows.push({
      id: crypto.randomUUID(),
      lead_id: null,
      source: "whatsapp",
      verbatim: "too expensive",
      taxonomy_code: "COST",
      logged_by: "whatsapp_agent",
      pathway: "nursing-professional",
      session_id: null,
      meta: {},
      at: weekAgo,
    });
  }
  return { store, svc: svc! };
}

export async function demoLog(input: LogObjectionInput): Promise<ObjectionRecord> {
  return ensure().svc.log(input);
}

export async function demoTrends(weeks = 8, pathway?: string): Promise<TrendRow[]> {
  return ensure().svc.trends(weeks, pathway);
}

export async function demoMappings(): Promise<TaxonomyMapping[]> {
  return ensure().svc.listMappings();
}

export async function demoUpsertMapping(
  mapping: Partial<TaxonomyMapping> & { code: string; updated_by: string },
) {
  return ensure().svc.upsertMapping(mapping);
}

export async function demoRecent(limit = 20) {
  return ensure().svc.listRecent(limit);
}

export async function demoExitAnswer(input: {
  reply: string;
  lead_id: string;
  pathway?: string;
  session_id?: string;
}) {
  return answerExitSurvey(ensure().svc, input);
}

export function demoStore() {
  return ensure().store;
}
