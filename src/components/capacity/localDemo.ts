import { CapacityService } from "@/growth/capacity/service";
import {
  createMemoryCapacityStore,
  demoIntake,
} from "@/growth/capacity/memoryStore";
import type {
  IntakeRecord,
  PathwayCapacityState,
  WaitlistCta,
} from "@/growth/capacity/types";

let store: ReturnType<typeof createMemoryCapacityStore> | null = null;
let svc: CapacityService | null = null;

function monthOffset(n: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function ensure() {
  if (!store) {
    store = createMemoryCapacityStore([
      demoIntake({
        pathway: "nursing-professional",
        batch_date: monthOffset(1),
        capacity: 20,
        filled: 10,
        label: "Nursing professional — next month",
      }),
      demoIntake({
        pathway: "nursing-professional",
        batch_date: monthOffset(2),
        capacity: 20,
        filled: 2,
        label: "Nursing professional — month+2",
      }),
      demoIntake({
        pathway: "nursing-ausbildung",
        batch_date: monthOffset(1),
        capacity: 15,
        filled: 5,
        label: "Ausbildung — next month",
      }),
      demoIntake({
        pathway: "nursing-ausbildung",
        batch_date: monthOffset(2),
        capacity: 15,
        filled: 1,
        label: "Ausbildung — month+2",
      }),
    ]);
    svc = new CapacityService(store);
  }
  return { store, svc: svc! };
}

export async function demoListIntakes(): Promise<IntakeRecord[]> {
  return ensure().svc.listIntakes();
}

export async function demoUpsertIntake(
  input: Parameters<CapacityService["upsertIntake"]>[0],
) {
  const row = await ensure().svc.upsertIntake(input);
  await ensure().svc.runHourlyGovernor();
  return row;
}

export async function demoRunGovernor(): Promise<PathwayCapacityState[]> {
  return ensure().svc.runHourlyGovernor();
}

export async function demoListStates(): Promise<PathwayCapacityState[]> {
  const { svc } = ensure();
  const existing = await svc.listPathwayStates();
  if (existing.length) return existing;
  return svc.runHourlyGovernor();
}

export async function demoResolveCta(pathway: string): Promise<WaitlistCta> {
  return ensure().svc.resolveCta(pathway);
}

/** Test helper: set nearest intake for pathway to a fill ratio. */
export async function demoSetFillRatio(
  pathway: string,
  ratio: number,
): Promise<IntakeRecord> {
  const { store, svc } = ensure();
  const intakes = await svc.listIntakes();
  const nearest = intakes
    .filter((i) => i.pathway === pathway)
    .sort((a, b) => a.batch_date.localeCompare(b.batch_date))[0];
  if (!nearest) throw new Error("no intake");
  const filled = Math.round(nearest.capacity * ratio);
  const row = await svc.upsertIntake({
    ...nearest,
    filled: Math.min(filled, nearest.capacity),
    updated_by: "verify",
  });
  await svc.runHourlyGovernor();
  return row;
}

export function demoCapacityStore() {
  return ensure().store;
}
