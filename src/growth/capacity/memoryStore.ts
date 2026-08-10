import { DEFAULT_GOVERNOR_CONFIG } from "./governor";
import { assertUrgencyTemplate } from "./scarcity";
import type { CapacityStore } from "./store";
import type {
  GovernorConfig,
  IntakeRecord,
  PathwayCapacityState,
  UrgencyCopyTemplate,
} from "./types";

export function createMemoryCapacityStore(
  seed: IntakeRecord[] = [],
  config: GovernorConfig = DEFAULT_GOVERNOR_CONFIG,
): CapacityStore & {
  intakes: Map<string, IntakeRecord>;
  states: Map<string, PathwayCapacityState>;
  templates: UrgencyCopyTemplate[];
} {
  const intakes = new Map(seed.map((i) => [i.id, structuredClone(i)]));
  const states = new Map<string, PathwayCapacityState>();
  const templates: UrgencyCopyTemplate[] = [];
  let cfg = { ...config };

  return {
    intakes,
    states,
    templates,
    async listIntakes() {
      return [...intakes.values()]
        .map((i) => structuredClone(i))
        .sort((a, b) => a.batch_date.localeCompare(b.batch_date));
    },
    async getIntake(id) {
      const row = intakes.get(id);
      return row ? structuredClone(row) : null;
    },
    async upsertIntake(input) {
      const now = new Date().toISOString();
      const id = input.id ?? crypto.randomUUID();
      const prev = intakes.get(id);
      const row: IntakeRecord = {
        id,
        pathway: input.pathway,
        batch_date: input.batch_date,
        capacity: input.capacity,
        filled: input.filled,
        label: input.label ?? null,
        status: input.status,
        synced_at: input.synced_at ?? prev?.synced_at ?? null,
        updated_by: input.updated_by ?? null,
        updated_at: now,
        created_at: prev?.created_at ?? now,
      };
      intakes.set(id, row);
      return structuredClone(row);
    },
    async listPathwayStates() {
      return [...states.values()].map((s) => structuredClone(s));
    },
    async getPathwayState(pathway) {
      const s = states.get(pathway);
      return s ? structuredClone(s) : null;
    },
    async savePathwayStates(next) {
      for (const s of next) states.set(s.pathway, structuredClone(s));
    },
    async getConfig() {
      return { ...cfg };
    },
    async saveUrgencyTemplate(input) {
      assertUrgencyTemplate(input);
      const now = new Date().toISOString();
      const row: UrgencyCopyTemplate = {
        id: input.id ?? crypto.randomUUID(),
        key: input.key,
        body: input.body,
        intake_id: input.intake_id,
        calendar_event_id: input.calendar_event_id,
        active: input.active,
        updated_by: input.updated_by,
        updated_at: now,
      };
      const idx = templates.findIndex((t) => t.id === row.id || t.key === row.key);
      if (idx >= 0) templates[idx] = row;
      else templates.push(row);
      return structuredClone(row);
    },
  };
}

export function demoIntake(partial: Partial<IntakeRecord> & Pick<IntakeRecord, "pathway" | "batch_date" | "capacity" | "filled">): IntakeRecord {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? crypto.randomUUID(),
    pathway: partial.pathway,
    batch_date: partial.batch_date,
    capacity: partial.capacity,
    filled: partial.filled,
    label: partial.label ?? null,
    status: partial.status ?? "OPEN",
    synced_at: partial.synced_at ?? null,
    updated_by: partial.updated_by ?? "demo",
    updated_at: partial.updated_at ?? now,
    created_at: partial.created_at ?? now,
  };
}
